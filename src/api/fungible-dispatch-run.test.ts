import { beforeEach, describe, expect, it, vi } from 'vitest';

import vectors from '../helpers/host-account.vectors.json';

const mocks = vi.hoisted(() => ({ waitForAssetState: vi.fn(), readAssetState: vi.fn() }));

vi.mock('./asset-marketplace', async (importOriginal) => ({
	...(await importOriginal<typeof import('./asset-marketplace')>()),
	waitForAssetState: mocks.waitForAssetState,
	readAssetState: mocks.readAssetState,
}));

import { TransactionDispatchNotSentError, TransactionDispatchRejectedError } from 'weave-wrangler';

import { ASSET_BALANCE_STATE_UNAVAILABLE, type AssetState } from './asset-marketplace';
import {
	ASSET_BALANCE_PROOF_UNAVAILABLE,
	type AssetTransactionClient,
	SIGNED_TRANSACTION_PREFIX,
} from './asset-transactions';
import {
	createDispatchPlan,
	discardRejectedDispatchSignature,
	DISPATCH_PROOF_CONCURRENCY,
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
	mocks.readAssetState.mockReset();
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

describe('dispatch settlement on the exact transfer receipt', () => {
	const signedKey = (id: string) => `${SIGNED_TRANSACTION_PREFIX}${id}`;
	const startingSlot = 41;
	const receiptPlan = (rows: DispatchPlan['rows']): DispatchPlan => ({ ...plan(rows), startingSlot });
	const posted = (address: string, transactionId: string) => ({
		address,
		quantity: '10',
		status: 'posted' as const,
		transactionId,
	});
	const balances = (held: Record<string, string>) => {
		mocks.waitForAssetState.mockImplementation(async (_id, accept) => {
			const state = { balances: held };
			if (!(await accept(state))) throw new Error('asset-state-timeout');
			return { state, provider: 'test' };
		});
	};
	const seeded = (...ids: string[]) => {
		const memory = memoryStorage();
		for (const id of ids) memory.held.set(signedKey(id), '{}');
		return memory;
	};

	it('settles on the receipt even when the recipient spent the tokens during the window', async () => {
		balances({ [recipientA]: '0' }); // received 10, then sold them before any poll
		const { held, storage } = seeded(transactionA);
		const waitForFungibleTransfer = vi.fn(async () => ({} as AssetState));

		const result = await runDispatch(receiptPlan([posted(recipientA, transactionA)]), {
			client: client({ waitForFungibleTransfer } as Partial<AssetTransactionClient>),
			storage,
		});

		expect(waitForFungibleTransfer).toHaveBeenCalledWith(
			processId,
			transactionA,
			sender,
			recipientA,
			'10',
			{ startingSlot },
			undefined
		);
		expect(result.rows[0]).toMatchObject({ status: 'settled', transactionId: transactionA });
		expect(held.has(signedKey(transactionA))).toBe(false);
		expect(mocks.waitForAssetState).not.toHaveBeenCalled();
	});

	it('does not settle on a third-party credit while this transfer has no receipt', async () => {
		balances({ [recipientA]: '10' }); // someone else sent recipientA 10
		const { held, storage } = seeded(transactionA);
		const waitForFungibleTransfer = vi.fn(async () => {
			throw new Error('asset-state-timeout');
		});

		await expect(
			runDispatch(receiptPlan([posted(recipientA, transactionA)]), {
				client: client({ waitForFungibleTransfer } as Partial<AssetTransactionClient>),
				storage,
			})
		).rejects.toThrow('asset-state-timeout');

		expect(loadDispatchPlan(processId, storage)?.rows[0]).toEqual(posted(recipientA, transactionA));
		expect(held.has(signedKey(transactionA))).toBe(true);
	});

	it('keeps an unproven outcome posted with its error, never rejected, and still proves the other rows', async () => {
		for (const code of [
			'fungible-transfer-proof-mismatch',
			ASSET_BALANCE_PROOF_UNAVAILABLE,
			'scheduled-action-state-missing',
		]) {
			balances({ [recipientA]: '0', [recipientB]: '0' });
			const { held, storage } = seeded(transactionA, transactionB);
			const waitForFungibleTransfer = vi.fn(async (_process: string, transactionId: string) => {
				if (transactionId === transactionA) throw new Error(code);
				return {} as AssetState;
			});

			await expect(
				runDispatch(receiptPlan([posted(recipientA, transactionA), posted(recipientB, transactionB)]), {
					client: client({ waitForFungibleTransfer } as Partial<AssetTransactionClient>),
					storage,
				})
			).rejects.toThrow(code);

			expect(loadDispatchPlan(processId, storage)?.rows).toEqual([
				posted(recipientA, transactionA),
				{ ...posted(recipientB, transactionB), status: 'settled' },
			]);
			expect(held.has(signedKey(transactionA))).toBe(true);
			expect(held.has(signedKey(transactionB))).toBe(false);
		}
	});

	it("marks a proven 'fungible-transfer-rejected' row Not applied and stops working on it", async () => {
		balances({ [recipientA]: '0', [recipientB]: '0' });
		const { held, storage } = seeded(transactionA, transactionB);
		const waitForFungibleTransfer = vi.fn(async (_process: string, transactionId: string) => {
			if (transactionId === transactionA) throw new Error('fungible-transfer-rejected');
			return {} as AssetState;
		});
		const options = {
			client: client({ waitForFungibleTransfer } as Partial<AssetTransactionClient>),
			storage,
		};

		await expect(
			runDispatch(receiptPlan([posted(recipientA, transactionA), posted(recipientB, transactionB)]), options)
		).rejects.toMatchObject({
			code: DISPATCH_SIGNED_TRANSACTION_REJECTED,
			addresses: [recipientA],
			processRejected: [recipientA],
		});

		const saved = loadDispatchPlan(processId, storage)!;
		expect(saved.rows).toEqual([
			{ ...posted(recipientA, transactionA), status: 'rejected', rejectedBy: 'process' },
			{ ...posted(recipientB, transactionB), status: 'settled' },
		]);
		// Kept for review until the user chooses Sign again.
		expect(held.has(signedKey(transactionA))).toBe(true);

		waitForFungibleTransfer.mockClear();
		await expect(runDispatch(saved, options)).rejects.toMatchObject({ processRejected: [recipientA] });
		expect(waitForFungibleTransfer).not.toHaveBeenCalled();
	});

	it('never runs more exact proofs at once than the pool size', async () => {
		const rows = Array.from({ length: 10 }, (_, index) =>
			posted(`${'r'.repeat(42)}${index}`, `${'x'.repeat(42)}${index}`)
		);
		let inFlight = 0;
		let peak = 0;
		const waitForFungibleTransfer = vi.fn(async () => {
			inFlight += 1;
			peak = Math.max(peak, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 1));
			inFlight -= 1;
			return {} as AssetState;
		});

		const result = await runDispatch(receiptPlan(rows), {
			client: client({ waitForFungibleTransfer } as Partial<AssetTransactionClient>),
			storage: memoryStorage().storage,
		});

		expect(waitForFungibleTransfer).toHaveBeenCalledTimes(10);
		expect(peak).toBe(DISPATCH_PROOF_CONCURRENCY);
		expect(result.rows.every((row) => row.status === 'settled')).toBe(true);
	});

	it('keeps the balance rule for a plan saved without startingSlot', async () => {
		const waitForFungibleTransfer = vi.fn();

		const result = await runDispatch(plan([posted(recipientA, transactionA)]), {
			client: client({ waitForFungibleTransfer } as Partial<AssetTransactionClient>),
			storage: memoryStorage().storage,
		});

		expect(waitForFungibleTransfer).not.toHaveBeenCalled();
		expect(mocks.waitForAssetState).toHaveBeenCalledOnce();
		expect(result.rows[0].status).toBe('settled');
	});

	it('captures startingSlot once from the preflight state, and omits it when the route exposes none', async () => {
		const state = (raw: Record<string, unknown>) => ({
			state: { holderBalancesAvailable: true, balances: { [sender]: '100', [recipientA]: '3' }, raw },
		});
		mocks.readAssetState.mockResolvedValueOnce(state({ 'at-slot': '41' }));
		const created = await createDispatchPlan(processId, sender, [{ address: recipientA, quantity: '10' }]);
		expect(created).toMatchObject({ startingSlot: 41, baseline: { [recipientA]: '3' } });

		mocks.readAssetState.mockResolvedValueOnce(state({}));
		const legacy = await createDispatchPlan(processId, sender, [{ address: recipientA, quantity: '10' }]);
		expect('startingSlot' in legacy).toBe(false);

		// Resume never re-reads it: a later slot would hide this plan's transfers.
		const waitForFungibleTransfer = vi.fn(async () => ({} as AssetState));
		await runDispatch(
			{ ...created, rows: [posted(recipientA, transactionA)] },
			{
				client: client({ waitForFungibleTransfer } as Partial<AssetTransactionClient>),
				storage: memoryStorage().storage,
			}
		);
		expect(mocks.readAssetState).toHaveBeenCalledTimes(2);
		expect(waitForFungibleTransfer).toHaveBeenCalledWith(
			processId,
			transactionA,
			sender,
			recipientA,
			'10',
			{ startingSlot: 41 },
			undefined
		);
	});

	it('Sign again on a Not applied row skips the balance check: an unrelated credit cannot settle it', async () => {
		const memory = seeded(transactionA);
		const rejectedPlan = receiptPlan([
			{ ...posted(recipientA, transactionA), status: 'rejected', rejectedBy: 'process' },
		]);
		const readCurrentState = vi.fn(async () => ({
			state: { holderBalancesAvailable: true, balances: { [recipientA]: '10' } } as unknown as AssetState,
		}));

		const result = await discardRejectedDispatchSignature(rejectedPlan, recipientA, {
			storage: memory.storage,
			readCurrentState,
		});

		expect(readCurrentState).not.toHaveBeenCalled();
		expect(result.outcome).toBe('discarded');
		expect(result.plan.rows).toEqual([{ address: recipientA, quantity: '10', status: 'unsent' }]);
		expect(memory.held.has(signedKey(transactionA))).toBe(false);
	});
});
