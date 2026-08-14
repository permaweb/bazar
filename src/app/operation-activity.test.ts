import { describe, expect, it } from 'vitest';

import type { AssetState, SwapOrder } from 'api/asset-marketplace';

import {
	atomicPurchaseRecoveryCanBeDiscarded,
	deriveFungibleOperationActivities,
	deriveOperationActivities,
	discoverFungibleOperationActivities,
	discoverOperationActivities,
	FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY,
	fungibleOperationActivityId,
	type FungibleOperationActivitySummary,
	fungiblePurchaseRecoveryCanBeDiscarded,
	loadFungibleOperationActivities,
	loadOperationActivities,
	mergeFungibleOperationActivities,
	OPERATION_ACTIVITY_STORAGE_KEY,
	type OperationActivity,
	operationRecoveryCanStillApply,
	reduceFungibleRuntimeActivities,
	removeFungibleOperationActivity,
	saveFungibleOperationActivities,
	saveOperationActivities,
	upsertFungibleOperationActivity,
} from './operation-activity';

const owner = 'A'.repeat(43);
const otherOwner = 'B'.repeat(43);
const order: SwapOrder = {
	orderId: 'O'.repeat(43),
	creator: owner,
	recipient: owner,
	asking: '1000',
	deposit: '50',
	minimumFee: '25',
	deadline: 100,
	createdAt: 10,
	quantity: '1000',
	status: 'open',
};

function assetState(overrides: Partial<AssetState> = {}): AssetState {
	return {
		device: 'token@1.0',
		name: 'Test asset',
		ticker: 'TEST',
		denomination: 0,
		totalSupply: '1',
		balances: { [owner]: '1' },
		orders: {},
		swapHeight: 0,
		value: null,
		raw: {},
		...overrides,
	};
}

class MemoryStorage {
	readonly values = new Map<string, string>();

	get length() {
		return this.values.size;
	}

	key(index: number) {
		return [...this.values.keys()][index] ?? null;
	}

	getItem(key: string) {
		return this.values.get(key) ?? null;
	}

	setItem(key: string, value: string) {
		this.values.set(key, value);
	}

	removeItem(key: string) {
		this.values.delete(key);
	}
}

function activity(overrides: Partial<OperationActivity> = {}): OperationActivity {
	return {
		id: 'activity-1',
		asset: { id: 'asset-1', name: 'Permanent Strata #001', image: 'https://arweave.net/image' },
		collectionId: 'collection-1',
		owner,
		operation: { kind: 'sell', value: '0.5' },
		phase: 'working',
		status: 'Watching Arweave confirmations…',
		confirmations: 0,
		confirmationTarget: 5,
		createdAt: 100,
		...overrides,
	};
}

describe('operation activity persistence', () => {
	it('persists recoverable work while omitting forms and completed entries', () => {
		const storage = new MemoryStorage();
		saveOperationActivities(
			storage,
			[
				activity(),
				activity({ id: 'form', phase: 'form' }),
				activity({ id: 'done', phase: 'done' }),
				activity({ id: 'error', phase: 'error' }),
			],
			[owner]
		);

		const stored = JSON.parse(storage.getItem(OPERATION_ACTIVITY_STORAGE_KEY) ?? '{}');
		expect(stored.activities.map((item: OperationActivity) => item.id)).toEqual(['activity-1', 'error']);
	});

	it('preserves another wallet activity when replacing the current wallet records', () => {
		const storage = new MemoryStorage();
		saveOperationActivities(storage, [activity({ id: 'other', owner: otherOwner })], [otherOwner]);
		saveOperationActivities(storage, [activity()], [owner]);
		storage.setItem(
			`bazar-operation:asset-1:${otherOwner}`,
			JSON.stringify({ signer: otherOwner, txId: 'U'.repeat(43), kind: 'sell' })
		);
		storage.setItem(
			`bazar-operation:asset-1:${owner}`,
			JSON.stringify({ signer: owner, txId: 'T'.repeat(43), kind: 'sell' })
		);

		expect(loadOperationActivities(storage, otherOwner).map((item) => item.id)).toEqual(['other']);
		expect(loadOperationActivities(storage, owner).map((item) => item.id)).toEqual(['activity-1']);
	});

	it('rehydrates the signed transaction id before restarting a marketplace action', () => {
		const storage = new MemoryStorage();
		saveOperationActivities(storage, [activity()], [owner]);
		storage.setItem(
			`bazar-operation:asset-1:${owner}`,
			JSON.stringify({ signer: owner, txId: 'T'.repeat(43), kind: 'sell', value: '0.5' })
		);

		const [restored] = loadOperationActivities(storage, owner);
		expect(restored.operation).toEqual({ kind: 'sell', resumeId: 'T'.repeat(43), value: '0.5' });
		expect(restored.status).toBe('Resuming signed transaction…');
	});

	it('uses the latest purchase snapshot instead of restarting the purchase from scratch', () => {
		const storage = new MemoryStorage();
		const order = { orderId: 'O'.repeat(43) } as SwapOrder;
		saveOperationActivities(
			storage,
			[activity({ operation: { kind: 'buy', order }, status: 'Reserving asset…' })],
			[owner]
		);
		const snapshot = { registration: { id: 'R'.repeat(43), dispatched: true } };
		storage.setItem(`bazar-purchase:asset-1:${owner}`, JSON.stringify({ buyer: owner, order, snapshot }));

		const [restored] = loadOperationActivities(storage, owner);
		expect(restored.operation).toEqual({ kind: 'buy', order, resume: snapshot });
		expect(restored.status).toBe('Resuming purchase…');
	});

	it('drops cached activity when its durable recovery record is gone', () => {
		const storage = new MemoryStorage();
		saveOperationActivities(storage, [activity()], [owner]);

		expect(loadOperationActivities(storage, owner)).toEqual([]);
		expect(storage.getItem(OPERATION_ACTIVITY_STORAGE_KEY)).toBeNull();
	});

	it('drops corrupt registry data without throwing', () => {
		const storage = new MemoryStorage();
		storage.setItem(OPERATION_ACTIVITY_STORAGE_KEY, '{not-json');

		expect(loadOperationActivities(storage, owner)).toEqual([]);
		expect(storage.getItem(OPERATION_ACTIVITY_STORAGE_KEY)).toBeNull();
	});

	it('discovers recovery-backed atomic work even when the activity metadata cache is missing', () => {
		const storage = new MemoryStorage();
		storage.setItem(
			`bazar-operation:asset-1:${owner}`,
			JSON.stringify({ signer: owner, txId: 'T'.repeat(43), kind: 'transfer', value: '1', createdAt: 125 })
		);
		const collection = {
			id: 'collection-1',
			name: 'Atomic assets',
			description: '',
			kind: 'images' as const,
			assets: [{ id: 'asset-1', name: 'Permanent Strata #001' }],
		};

		const restored = discoverOperationActivities(storage, owner, [collection]);
		expect(restored).toHaveLength(1);
		expect(restored[0]).toMatchObject({
			collectionId: 'collection-1',
			operation: { kind: 'transfer', resumeId: 'T'.repeat(43), value: '1' },
			status: 'Resume signed transaction',
			createdAt: 125,
		});
		expect(deriveOperationActivities(storage, owner, [collection])).toEqual(restored);
	});

	it('uses recovery-owned asset metadata when the collection index has not loaded yet', () => {
		const storage = new MemoryStorage();
		storage.setItem(
			`bazar-operation:asset-1:${owner}`,
			JSON.stringify({
				signer: owner,
				txId: 'T'.repeat(43),
				kind: 'sell',
				asset: { id: 'asset-1', name: 'Permanent Strata #001' },
				activityKind: 'atomic',
				collectionId: 'collection-1',
			})
		);

		expect(discoverOperationActivities(storage, owner, [])).toMatchObject([
			{ asset: { id: 'asset-1', name: 'Permanent Strata #001' }, collectionId: 'collection-1' },
		]);
	});
});

describe('live operation activity reconciliation', () => {
	it('drops a cancellation recovery after its order is no longer open', () => {
		const recovery = { kind: 'cancel', order, txId: 'C'.repeat(43) };
		expect(
			operationRecoveryCanStillApply(
				assetState({ orders: { [order.orderId]: order } }),
				owner,
				recovery,
				'atomic'
			)
		).toBe(true);
		expect(
			operationRecoveryCanStillApply(
				assetState({ orders: { [order.orderId]: { ...order, status: 'cancelled' } } }),
				owner,
				recovery,
				'atomic'
			)
		).toBe(false);
		expect(operationRecoveryCanStillApply(assetState(), owner, recovery, 'atomic')).toBe(false);
	});

	it('drops a listing recovery once its transaction is present in live state', () => {
		const txId = 'S'.repeat(43);
		const recovery = { kind: 'sell', txId, quantity: '2.5' };
		expect(operationRecoveryCanStillApply(assetState(), owner, recovery, 'atomic')).toBe(true);
		expect(
			operationRecoveryCanStillApply(
				assetState({ orders: { [txId]: { ...order, orderId: txId, status: 'expired' } } }),
				owner,
				recovery,
				'atomic'
			)
		).toBe(false);
		expect(
			operationRecoveryCanStillApply(
				assetState({
					denomination: 1,
					totalSupply: '1000',
					balances: { [owner]: '100' },
					orders: { [txId]: { ...order, orderId: txId, quantity: '25' } },
				}),
				owner,
				recovery,
				'fungible'
			)
		).toBe(false);
	});

	it('retains only purchases whose order is available or whose seller payment was dispatched', () => {
		const missingOrderState = assetState({ totalSupply: '1000', balances: { [owner]: '1000' } });
		expect(
			atomicPurchaseRecoveryCanBeDiscarded(missingOrderState, otherOwner, order, {
				registration: { id: 'R'.repeat(43), dispatched: true },
			})
		).toBe(true);
		expect(
			atomicPurchaseRecoveryCanBeDiscarded(missingOrderState, otherOwner, order, {
				registration: { id: 'R'.repeat(43), dispatched: true },
				payment: { id: 'P'.repeat(43), dispatched: true },
			})
		).toBe(false);
		expect(
			atomicPurchaseRecoveryCanBeDiscarded(
				assetState({ orders: { [order.orderId]: order } }),
				otherOwner,
				order,
				{ registration: { id: 'R'.repeat(43), dispatched: true } }
			)
		).toBe(false);

		const batch = {
			entries: [
				{
					order,
					fillQuantity: order.quantity,
					snapshot: { registration: { id: 'R'.repeat(43), dispatched: true } },
				},
			],
		};
		expect(fungiblePurchaseRecoveryCanBeDiscarded(missingOrderState, otherOwner, batch)).toBe(true);
		expect(
			fungiblePurchaseRecoveryCanBeDiscarded(missingOrderState, otherOwner, {
				entries: [
					{
						...batch.entries[0],
						snapshot: { payment: { id: 'P'.repeat(43), dispatched: true } },
					},
				],
			})
		).toBe(false);
	});
});

function fungibleActivity(overrides: Partial<FungibleOperationActivitySummary> = {}): FungibleOperationActivitySummary {
	return {
		id: fungibleOperationActivityId('asset-1', owner, 'buy'),
		asset: { id: 'asset-1', name: 'Weave Credit', image: 'https://arweave.net/weave' },
		collectionId: 'fungible-tokens',
		owner,
		operationKind: 'buy',
		phase: 'working',
		status: 'Transaction in progress',
		createdAt: 200,
		...overrides,
	};
}

describe('fungible operation activity persistence', () => {
	it('uses one active slot for asset mutations and a separate slot for purchases', () => {
		const sell = fungibleOperationActivityId('asset-1', owner, 'sell');
		expect(fungibleOperationActivityId('asset-1', owner, 'cancel')).toBe(sell);
		expect(fungibleOperationActivityId('asset-1', owner, 'transfer')).toBe(sell);
		expect(fungibleOperationActivityId('asset-1', owner, 'buy')).not.toBe(sell);
	});

	it('hydrates only activities backed by recoverable transaction state after refresh', () => {
		const storage = new MemoryStorage();
		saveFungibleOperationActivities(
			storage,
			[fungibleActivity(), fungibleActivity({ id: 'stale', asset: { id: 'asset-2', name: 'Stale' } })],
			[owner]
		);
		storage.setItem(
			`bazar-purchase-batch:asset-1:${owner}`,
			JSON.stringify({
				buyer: owner,
				entries: [
					{
						order: { orderId: 'O'.repeat(43) },
						snapshot: { registration: { id: 'R'.repeat(43), dispatched: true } },
					},
				],
			})
		);

		expect(loadFungibleOperationActivities(storage, owner).map((item) => item.id)).toEqual([
			fungibleOperationActivityId('asset-1', owner, 'buy'),
		]);
		const stored = JSON.parse(storage.getItem(FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY) ?? '{}');
		expect(stored.activities).toHaveLength(1);
	});

	it('drops denylisted tokens from stale persisted and runtime activity', () => {
		const storage = new MemoryStorage();
		const hidden = fungibleActivity({
			id: 'hidden',
			asset: {
				id: 'bASFYsRBQm_dfG__wqRVwMh8bqwEvSTl4lURRBqfu2M',
				name: '[TEST] PcMK spawn trade transfer',
			},
		});
		storage.setItem(FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY, JSON.stringify({ version: 1, activities: [hidden] }));

		expect(loadFungibleOperationActivities(storage, owner)).toEqual([]);
		expect(storage.getItem(FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY)).toBeNull();
		expect(mergeFungibleOperationActivities([], [hidden], owner)).toEqual([]);
		expect(reduceFungibleRuntimeActivities([], { type: 'upsert', activity: hidden })).toEqual([]);
	});

	it('upserts and removes one wallet activity without disturbing another wallet', () => {
		const storage = new MemoryStorage();
		saveFungibleOperationActivities(storage, [fungibleActivity({ owner: otherOwner })], [otherOwner]);
		storage.setItem(
			`bazar-purchase-batch:asset-1:${otherOwner}`,
			JSON.stringify({
				buyer: otherOwner,
				entries: [
					{
						order: { orderId: 'O'.repeat(43) },
						snapshot: { registration: { id: 'R'.repeat(43), dispatched: true } },
					},
				],
			})
		);
		upsertFungibleOperationActivity(storage, fungibleActivity());
		removeFungibleOperationActivity(storage, fungibleActivity().id, owner);

		expect(loadFungibleOperationActivities(storage, owner)).toEqual([]);
		expect(loadFungibleOperationActivities(storage, otherOwner)).toHaveLength(1);
	});

	it('discovers pre-index recovery records so existing work appears immediately after upgrade', () => {
		const storage = new MemoryStorage();
		storage.setItem(
			`bazar-operation:asset-1:${owner}`,
			JSON.stringify({ signer: owner, kind: 'transfer', txId: 'T'.repeat(43), createdAt: 123 })
		);
		const collection = {
			id: 'fungible-tokens',
			name: 'Fungible tokens',
			description: '',
			kind: 'tokens' as const,
			assets: [{ id: 'asset-1', name: 'Weave Credit' }],
		};

		const [restored] = discoverFungibleOperationActivities(storage, owner, [collection]);
		expect(restored).toMatchObject({
			id: fungibleOperationActivityId('asset-1', owner, 'transfer'),
			collectionId: 'fungible-tokens',
			operationKind: 'transfer',
			status: 'Resume signed transaction',
			createdAt: 123,
		});
	});

	it('uses runtime state while mounted and falls back to recovery-derived state when it unmounts', () => {
		const recovered = fungibleActivity({ status: 'Resume signed transaction', phase: 'working' });
		const runtime = fungibleActivity({ status: 'Waiting for wallet approval', phase: 'approval' });

		expect(mergeFungibleOperationActivities([recovered], [runtime], owner)).toEqual([runtime]);
		const afterUnmount = reduceFungibleRuntimeActivities([runtime], {
			type: 'remove',
			id: runtime.id,
			owner,
		});
		expect(mergeFungibleOperationActivities([recovered], afterUnmount, owner)).toEqual([recovered]);
	});

	it('never derives fungible activity from metadata without valid recovery', () => {
		const storage = new MemoryStorage();
		saveFungibleOperationActivities(storage, [fungibleActivity()], [owner]);
		const collection = {
			id: 'fungible-tokens',
			name: 'Fungible tokens',
			description: '',
			kind: 'tokens' as const,
			assets: [{ id: 'asset-1', name: 'Weave Credit' }],
		};

		expect(deriveFungibleOperationActivities(storage, owner, [collection])).toEqual([]);
		expect(storage.getItem(FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY)).toBeNull();
	});

	it('classifies recovery-owned metadata so atomic and fungible loaders cannot claim the same action', () => {
		const storage = new MemoryStorage();
		storage.setItem(
			`bazar-operation:asset-1:${owner}`,
			JSON.stringify({
				signer: owner,
				txId: 'T'.repeat(43),
				kind: 'transfer',
				asset: { id: 'asset-1', name: 'Weave Credit' },
				activityKind: 'fungible',
				collectionId: 'fungible-tokens',
			})
		);

		expect(discoverOperationActivities(storage, owner, [])).toEqual([]);
		expect(discoverFungibleOperationActivities(storage, owner, [])).toMatchObject([
			{ asset: { id: 'asset-1', name: 'Weave Credit' }, collectionId: 'fungible-tokens' },
		]);
	});
});
