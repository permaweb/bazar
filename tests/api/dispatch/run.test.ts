import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ waitForAssetState: vi.fn() }));

vi.mock('api/marketplace/adapter', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/marketplace/adapter')>()),
	waitForAssetState: mocks.waitForAssetState,
}));

import {
	DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED,
	type DispatchPlan,
	loadDispatchPlan,
	runDispatch,
} from 'api/dispatch/adapter';
import { ASSET_BALANCE_STATE_UNAVAILABLE } from 'api/marketplace/adapter';
import type { AssetTransactionClient } from 'api/transactions/adapter';

const processId = 'P'.repeat(43);
const sender = 'S'.repeat(43);
const recipientA = 'A'.repeat(43);
const recipientB = 'B'.repeat(43);
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
