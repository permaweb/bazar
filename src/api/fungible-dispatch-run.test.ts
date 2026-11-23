import { beforeEach, describe, expect, it, vi } from 'vitest';

import vectors from '../helpers/host-account.vectors.json';

const mocks = vi.hoisted(() => ({ waitForAssetState: vi.fn() }));

vi.mock('./asset-marketplace', async (importOriginal) => ({
	...(await importOriginal<typeof import('./asset-marketplace')>()),
	waitForAssetState: mocks.waitForAssetState,
}));

import { TransactionDispatchNotSentError, TransactionDispatchRejectedError } from 'weave-wrangler';

import { ASSET_BALANCE_STATE_UNAVAILABLE, type AssetState } from './asset-marketplace';
import { type AssetTransactionClient, SIGNED_TRANSACTION_PREFIX } from './asset-transactions';
import {
	discardRejectedDispatchSignature,
	DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED,
	DISPATCH_SIGNED_TRANSACTION_REJECTED,
	type DispatchPlan,
	loadDispatchPlan,
	runDispatch,
	saveDispatchPlan,
} from './fungible-dispatch';

const processId = 'P'.repeat(43);
const sender = 'S'.repeat(43);
const recipientA = 'A'.repeat(43);
const recipientB = 'E'.repeat(43);
const transactionA = 'T'.repeat(43);
const transactionB = 'U'.repeat(43);

function plan(rows: DispatchPlan['rows']): DispatchPlan {
	return {
		processId,
		sender,
		createdAt: 1,
		baseline: Object.fromEntries(rows.map((row) => [row.address, '0'])),
		rows,
	};
}

function memoryStorage() {
	const held = new Map<string, string>();
	return {
		held,
		storage: {
			getItem: (key: string) => held.get(key) ?? null,
			setItem: (key: string, value: string) => void held.set(key, value),
			removeItem: (key: string) => void held.delete(key),
		},
	};
}

function prepared(id: string) {
	return {
		id,
		cost: 0n,
		dispatch: vi.fn(async () => ({ status: 'accepted' as const, httpStatus: 200, observer: 'gateway' })),
		setRequiredBalance: vi.fn(),
	};
}

function client(overrides: Partial<AssetTransactionClient> = {}) {
	return {
		restore: vi.fn(),
		transferFungible: vi.fn(),
		...overrides,
	} as unknown as AssetTransactionClient;
}

beforeEach(() => {
	mocks.waitForAssetState.mockReset();
	mocks.waitForAssetState.mockImplementation(async (_id, accept) => {
		const state = { balances: { [recipientA]: '10', [recipientB]: '10' } };
		if (!(await accept(state))) throw new Error('test-settlement-not-accepted');
		return { state, provider: 'test', verifiedAt: 1, maxAge: 0 };
	});
});

it('settles a raw-recipient dispatch when replay credits its host account', async () => {
	const recipient = vectors.valid[2];
	const dispatchPlan = plan([
		{ address: recipient.raw, quantity: '10', status: 'posted', transactionId: transactionA },
	]);
	dispatchPlan.baseline[recipient.raw] = '2';
	mocks.waitForAssetState.mockImplementationOnce(async (_id, accept) => {
		const state = { balances: { [recipient.host]: '12' } };
		expect(await accept(state)).toBe(true);
		return { state, provider: 'test' };
	});
	const result = await runDispatch(dispatchPlan, { client: client(), storage: memoryStorage().storage });
	expect(result.rows[0].status).toBe('settled');
	expect(result.rows[0].address).toBe(recipient.raw);
});

describe('dispatch resume signing boundary', () => {
	it('does not prepare an unsigned row when fresh holder balances are incomplete', async () => {
		const transferFungible = vi.fn();
		const readCurrentState = vi.fn(async () => ({ state: { holderBalancesAvailable: false } }));

		await expect(
			runDispatch(plan([{ address: recipientA, quantity: '10', status: 'unsent' }]), {
				client: client({ transferFungible } as Partial<AssetTransactionClient>),
				readCurrentState,
			})
		).rejects.toThrow(ASSET_BALANCE_STATE_UNAVAILABLE);

		expect(readCurrentState).toHaveBeenCalledWith(processId, { signal: undefined, maxAge: 0 });
		expect(transferFungible).not.toHaveBeenCalled();
		expect(mocks.waitForAssetState).not.toHaveBeenCalled();
	});

	it('requires the fresh reader to prove holder completeness explicitly', async () => {
		const transferFungible = vi.fn();
		const readCurrentState = vi.fn(async () => ({ state: {} }));

		await expect(
			runDispatch(plan([{ address: recipientA, quantity: '10', status: 'unsent' }]), {
				client: client({ transferFungible } as Partial<AssetTransactionClient>),
				readCurrentState,
			})
		).rejects.toThrow(ASSET_BALANCE_STATE_UNAVAILABLE);

		expect(transferFungible).not.toHaveBeenCalled();
	});

	it('resumes a restorable signed row without requiring complete holder state or a new signature', async () => {
		const recovered = prepared(transactionA);
		const restore = vi.fn(() => recovered);
		const transferFungible = vi.fn();
		const readCurrentState = vi.fn(async () => ({ state: { holderBalancesAvailable: false } }));

		const result = await runDispatch(
			plan([
				{
					address: recipientA,
					quantity: '10',
					status: 'unsent',
					transactionId: transactionA,
				},
			]),
			{
				client: client({ restore, transferFungible } as Partial<AssetTransactionClient>),
				readCurrentState,
			}
		);

		expect(restore).toHaveBeenCalledWith(transactionA, sender);
		expect(recovered.dispatch).toHaveBeenCalledOnce();
		expect(transferFungible).not.toHaveBeenCalled();
		expect(readCurrentState).not.toHaveBeenCalled();
		expect(result.rows[0]).toMatchObject({ status: 'settled', transactionId: transactionA });
	});

	it('only observes a posted row without restoring, reading a signing gate, or preparing a replacement', async () => {
		const restore = vi.fn();
		const transferFungible = vi.fn();
		const readCurrentState = vi.fn();

		const result = await runDispatch(
			plan([
				{
					address: recipientA,
					quantity: '10',
					status: 'posted',
					transactionId: transactionA,
				},
			]),
			{
				client: client({ restore, transferFungible } as Partial<AssetTransactionClient>),
				readCurrentState,
			}
		);

		expect(restore).not.toHaveBeenCalled();
		expect(transferFungible).not.toHaveBeenCalled();
		expect(readCurrentState).not.toHaveBeenCalled();
		expect(mocks.waitForAssetState).toHaveBeenCalledOnce();
		expect(result.rows[0]).toMatchObject({ status: 'settled', transactionId: transactionA });
	});

	it('preserves the transaction id and plan when signed recovery cannot be restored', async () => {
		const restore = vi.fn(() => {
			throw new Error('signed-transaction-not-found');
		});
		const transferFungible = vi.fn();
		const readCurrentState = vi.fn();
		const { storage } = memoryStorage();
		const initial = plan([
			{
				address: recipientA,
				quantity: '10',
				status: 'unsent',
				transactionId: transactionA,
			},
		]);

		await expect(
			runDispatch(initial, {
				client: client({ restore, transferFungible } as Partial<AssetTransactionClient>),
				readCurrentState,
				storage,
			})
		).rejects.toThrow(DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED);

		expect(transferFungible).not.toHaveBeenCalled();
		expect(readCurrentState).not.toHaveBeenCalled();
		expect(mocks.waitForAssetState).not.toHaveBeenCalled();
		expect(initial.rows[0].transactionId).toBe(transactionA);
		expect(loadDispatchPlan(processId, storage)?.rows[0]).toMatchObject({
			status: 'unsent',
			transactionId: transactionA,
		});
	});

	it('uses one fresh completeness gate for all genuinely new signatures in one run', async () => {
		const preparedA = prepared(transactionA);
		const preparedB = prepared(transactionB);
		const transferFungible = vi.fn().mockResolvedValueOnce(preparedA).mockResolvedValueOnce(preparedB);
		const readCurrentState = vi.fn(async () => ({ state: { holderBalancesAvailable: true } }));

		const result = await runDispatch(
			plan([
				{ address: recipientA, quantity: '10', status: 'unsent' },
				{ address: recipientB, quantity: '10', status: 'unsent' },
			]),
			{
				client: client({ transferFungible } as Partial<AssetTransactionClient>),
				readCurrentState,
			}
		);

		expect(readCurrentState).toHaveBeenCalledOnce();
		expect(transferFungible).toHaveBeenCalledTimes(2);
		expect(preparedA.dispatch).toHaveBeenCalledOnce();
		expect(preparedB.dispatch).toHaveBeenCalledOnce();
		expect(result.rows.every((row) => row.status === 'settled')).toBe(true);
	});
});

describe('dispatch row rejected by the gateway', () => {
	const signedKey = (id: string) => `${SIGNED_TRANSACTION_PREFIX}${id}`;
	const completeState = vi.fn(async () => ({ state: { holderBalancesAvailable: true } }));

	function rejecting(
		id: string,
		error: Error = new TransactionDispatchRejectedError(400, 'transaction-dispatch-400: <html>bad</html>')
	) {
		const transaction = prepared(id);
		transaction.dispatch.mockRejectedValue(error);
		return transaction;
	}

	it('drops a freshly signed rejected transfer so the next resume signs a replacement for that row only', async () => {
		const { held, storage } = memoryStorage();
		const rejected = rejecting(transactionA);
		const firstSign = vi.fn(async () => {
			held.set(signedKey(transactionA), '{}'); // the real client persists before returning
			return rejected;
		});

		await expect(
			runDispatch(plan([{ address: recipientA, quantity: '10', status: 'unsent' }]), {
				client: client({ transferFungible: firstSign } as Partial<AssetTransactionClient>),
				readCurrentState: completeState,
				storage,
			})
		).rejects.toMatchObject({ code: 'transaction-dispatch-rejected' });

		const saved = loadDispatchPlan(processId, storage)!;
		expect(saved.rows[0].status).toBe('unsent');
		expect(saved.rows[0].transactionId).toBeUndefined();
		expect(held.has(signedKey(transactionA))).toBe(false);
		expect(mocks.waitForAssetState).not.toHaveBeenCalled();

		const replacement = prepared(transactionB);
		const restore = vi.fn();
		const secondSign = vi.fn(async () => replacement);
		const result = await runDispatch(saved, {
			client: client({ restore, transferFungible: secondSign } as Partial<AssetTransactionClient>),
			readCurrentState: completeState,
			storage,
		});

		expect(restore).not.toHaveBeenCalled();
		expect(secondSign).toHaveBeenCalledOnce();
		expect(rejected.dispatch).toHaveBeenCalledOnce();
		expect(result.rows[0]).toMatchObject({ status: 'settled', transactionId: transactionB });
	});

	it('keeps a restored rejected signature, marks only that row rejected, and finishes the other rows', async () => {
		const { held, storage } = memoryStorage();
		held.set(signedKey(transactionA), '{}');
		const restored = rejecting(transactionA);
		const restore = vi.fn(() => restored);
		const fresh = prepared(transactionB);
		const transferFungible = vi.fn(async () => fresh);

		const run = runDispatch(
			plan([
				{ address: recipientA, quantity: '10', status: 'unsent', transactionId: transactionA },
				{ address: recipientB, quantity: '10', status: 'unsent' },
			]),
			{
				client: client({ restore, transferFungible } as Partial<AssetTransactionClient>),
				readCurrentState: completeState,
				storage,
			}
		);

		await expect(run).rejects.toMatchObject({
			code: DISPATCH_SIGNED_TRANSACTION_REJECTED,
			addresses: [recipientA],
		});
		expect(transferFungible).toHaveBeenCalledOnce();
		expect(transferFungible).toHaveBeenCalledWith(processId, recipientB, '10', sender, undefined);
		expect(held.has(signedKey(transactionA))).toBe(true);
		expect(loadDispatchPlan(processId, storage)?.rows).toEqual([
			{ address: recipientA, quantity: '10', status: 'rejected', transactionId: transactionA },
			{ address: recipientB, quantity: '10', status: 'settled', transactionId: transactionB },
		]);
	});

	it('excludes rejected rows from the work loop: a resume neither re-posts nor re-signs them', async () => {
		const { storage } = memoryStorage();
		const restore = vi.fn();
		const transferFungible = vi.fn();
		const readCurrentState = vi.fn();

		await expect(
			runDispatch(
				plan([
					{ address: recipientA, quantity: '10', status: 'rejected', transactionId: transactionA },
					{ address: recipientB, quantity: '10', status: 'settled', transactionId: transactionB },
				]),
				{
					client: client({ restore, transferFungible } as Partial<AssetTransactionClient>),
					readCurrentState,
					storage,
				}
			)
		).rejects.toMatchObject({ code: 'dispatch-signed-transaction-rejected', addresses: [recipientA] });

		expect(restore).not.toHaveBeenCalled();
		expect(transferFungible).not.toHaveBeenCalled();
		expect(readCurrentState).not.toHaveBeenCalled();
		expect(mocks.waitForAssetState).not.toHaveBeenCalled();
	});

	it('keeps the signed transaction id when the post was not sent or the gateway is unavailable', async () => {
		for (const error of [
			new TransactionDispatchNotSentError('wallet-account-changed'),
			new Error('transaction-dispatch-503: <html>busy</html>'),
		]) {
			const { held, storage } = memoryStorage();
			const transaction = rejecting(transactionA, error);
			const transferFungible = vi.fn(async () => {
				held.set(signedKey(transactionA), '{}');
				return transaction;
			});

			await expect(
				runDispatch(plan([{ address: recipientA, quantity: '10', status: 'unsent' }]), {
					client: client({ transferFungible } as Partial<AssetTransactionClient>),
					readCurrentState: completeState,
					storage,
				})
			).rejects.toBe(error);

			expect(loadDispatchPlan(processId, storage)?.rows[0]).toEqual({
				address: recipientA,
				quantity: '10',
				status: 'unsent',
				transactionId: transactionA,
			});
			expect(held.has(signedKey(transactionA))).toBe(true);
		}
	});
});

describe('discardRejectedDispatchSignature', () => {
	const signedKey = (id: string) => `${SIGNED_TRANSACTION_PREFIX}${id}`;
	const rejectedPlan = () =>
		plan([
			{ address: recipientA, quantity: '10', status: 'rejected', transactionId: transactionA },
			{ address: recipientB, quantity: '10', status: 'posted', transactionId: transactionB },
		]);
	const reader = (balance: string, holderBalancesAvailable = true) =>
		vi.fn(async () => ({
			state: { holderBalancesAvailable, balances: { [recipientA]: balance } } as unknown as AssetState,
		}));

	function seeded() {
		const memory = memoryStorage();
		saveDispatchPlan(rejectedPlan(), memory.storage);
		memory.held.set(signedKey(transactionA), '{}');
		memory.held.set(signedKey(transactionB), '{}');
		return memory;
	}

	it('refuses to clear the signature when the recipient balance already rose, and marks the row settled', async () => {
		const { held, storage } = seeded();
		const readCurrentState = reader('10');

		const result = await discardRejectedDispatchSignature(rejectedPlan(), recipientA, {
			storage,
			readCurrentState,
		});

		expect(readCurrentState).toHaveBeenCalledWith(processId, { signal: undefined, maxAge: 0 });
		expect(result.outcome).toBe('settled');
		expect(result.plan.rows[0]).toEqual({
			address: recipientA,
			quantity: '10',
			status: 'settled',
			transactionId: transactionA,
		});
		expect(loadDispatchPlan(processId, storage)).toEqual(result.plan);
		// Settled like any balance-settled row: its signed record is no longer needed.
		expect(held.has(signedKey(transactionA))).toBe(false);
		expect(held.has(signedKey(transactionB))).toBe(true);
	});

	it('clears only that row back to plain unsent when the balance has not risen', async () => {
		const { held, storage } = seeded();

		const result = await discardRejectedDispatchSignature(rejectedPlan(), recipientA, {
			storage,
			readCurrentState: reader('9'),
		});

		expect(result.outcome).toBe('discarded');
		expect(result.plan.rows).toEqual([
			{ address: recipientA, quantity: '10', status: 'unsent' },
			{ address: recipientB, quantity: '10', status: 'posted', transactionId: transactionB },
		]);
		expect(loadDispatchPlan(processId, storage)).toEqual(result.plan);
		expect(held.has(signedKey(transactionA))).toBe(false);
		expect(held.has(signedKey(transactionB))).toBe(true);
	});

	it('changes nothing without complete fresh holder balances, or for a row that is not rejected', async () => {
		const { held, storage } = seeded();

		await expect(
			discardRejectedDispatchSignature(rejectedPlan(), recipientA, {
				storage,
				readCurrentState: reader('0', false),
			})
		).rejects.toThrow(ASSET_BALANCE_STATE_UNAVAILABLE);
		await expect(
			discardRejectedDispatchSignature(rejectedPlan(), recipientB, { storage, readCurrentState: reader('0') })
		).rejects.toThrow('dispatch-row-not-rejected');

		expect(loadDispatchPlan(processId, storage)).toEqual(rejectedPlan());
		expect(held.has(signedKey(transactionA))).toBe(true);
	});
});
