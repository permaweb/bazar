import { describe, expect, it } from 'vitest';

import type { SwapOrder } from 'api/asset-marketplace';

import {
	deriveFungibleOperationActivities,
	deriveOperationActivities,
	discoverFungibleOperationActivities,
	discoverOperationActivities,
	FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY,
	fungibleOperationActivityId,
	type FungibleOperationActivitySummary,
	loadFungibleOperationActivities,
	loadOperationActivities,
	mergeFungibleOperationActivities,
	OPERATION_ACTIVITY_STORAGE_KEY,
	type OperationActivity,
	reduceFungibleRuntimeActivities,
	removeFungibleOperationActivity,
	saveFungibleOperationActivities,
	saveOperationActivities,
	upsertFungibleOperationActivity,
} from './operation-activity';

const owner = 'A'.repeat(43);
const otherOwner = 'B'.repeat(43);

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
