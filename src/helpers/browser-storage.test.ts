import { describe, expect, it } from 'vitest';

import {
	ASSET_SHELL_STORAGE_PREFIX,
	HIDDEN_COLLECTION_ASSETS_STORAGE_KEY,
	HOME_LISTING_SHELL_STORAGE_KEY,
	MARKET_ACTIVITY_STORAGE_KEY,
	MARKET_SHELL_STORAGE_KEY,
	setCriticalStorageItem,
	WALLET_CANDIDATE_SCAN_STORAGE_PREFIX,
} from './browser-storage';

function quotaError() {
	return Object.assign(new Error("Failed to execute 'setItem' on 'Storage': exceeded the quota."), {
		name: 'QuotaExceededError',
		code: 22,
	});
}

function entryBytes(key: string, value: string) {
	return 2 * (key.length + value.length);
}

function storageWithLimit(initial: Array<[string, string]>, limit: number) {
	const values = new Map(initial);
	const storage = {
		setItem: (key: string, value: string) => {
			const next = new Map(values).set(key, value);
			if ([...next].reduce((total, entry) => total + entryBytes(...entry), 0) > limit) throw quotaError();
			values.set(key, value);
		},
		removeItem: (key: string) => values.delete(key),
		key: (index: number) => [...values.keys()][index] ?? null,
		get length() {
			return values.size;
		},
	};
	return { storage, values };
}

describe('critical browser storage writes', () => {
	it('clears only source-defined rebuildable caches and retries once', () => {
		const signedKey = `bazar-signed-transaction:${'s'.repeat(43)}`;
		const purchaseKey = 'bazar-purchase:asset:wallet';
		const initial: Array<[string, string]> = [
			[MARKET_SHELL_STORAGE_KEY, 'market-cache'.repeat(80)],
			[MARKET_ACTIVITY_STORAGE_KEY, 'activity-cache'.repeat(20)],
			[HOME_LISTING_SHELL_STORAGE_KEY, 'listing-cache'],
			[HIDDEN_COLLECTION_ASSETS_STORAGE_KEY, 'hidden-index'],
			[`${ASSET_SHELL_STORAGE_PREFIX}${'a'.repeat(43)}`, 'asset-cache'],
			[`${WALLET_CANDIDATE_SCAN_STORAGE_PREFIX}:v1:${'w'.repeat(43)}:graphql`, 'wallet-scan'],
			[signedKey, 'older-signed-transaction'],
			[purchaseKey, 'purchase-recovery'],
			['another-app', 'shared-origin-data'],
		];
		const initialBytes = initial.reduce((total, entry) => total + entryBytes(...entry), 0);
		const newKey = `bazar-signed-transaction:${'n'.repeat(43)}`;
		const newValue = 'new-signed-transaction';
		const { storage, values } = storageWithLimit(initial, initialBytes + entryBytes(newKey, newValue) - 1);

		setCriticalStorageItem(storage, newKey, newValue);

		expect(values.get(newKey)).toBe(newValue);
		expect([...values.keys()].some((key) => key.includes('shell') || key.includes('candidate-scan'))).toBe(false);
		expect(values.has(MARKET_ACTIVITY_STORAGE_KEY)).toBe(false);
		expect(values.has(HIDDEN_COLLECTION_ASSETS_STORAGE_KEY)).toBe(false);
		expect(values.get(signedKey)).toBe('older-signed-transaction');
		expect(values.get(purchaseKey)).toBe('purchase-recovery');
		expect(values.get('another-app')).toBe('shared-origin-data');
	});

	it('returns a stable error if clearing site caches is insufficient', () => {
		const initial: Array<[string, string]> = [['another-app', 'shared-origin-data']];
		const { storage, values } = storageWithLimit(initial, entryBytes(...initial[0]));

		expect(() => setCriticalStorageItem(storage, 'critical', 'value')).toThrow('browser-storage-full');
		expect(values.get('another-app')).toBe('shared-origin-data');
	});

	it('preserves non-quota storage failures', () => {
		const failure = new Error('storage-disabled');
		expect(() =>
			setCriticalStorageItem(
				{
					setItem: () => {
						throw failure;
					},
				},
				'critical',
				'value'
			)
		).toThrow(failure);
	});
});
