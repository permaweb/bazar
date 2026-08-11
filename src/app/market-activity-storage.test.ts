import { describe, expect, it } from 'vitest';

import type { CollectionActivityEvent } from 'api/asset-discovery';

import { loadMarketActivity, MARKET_ACTIVITY_STORAGE_KEY, saveMarketActivity } from './market-activity-storage';

class MemoryStorage {
	value: string | null = null;
	getItem() {
		return this.value;
	}
	setItem(_key: string, value: string) {
		this.value = value;
	}
	removeItem() {
		this.value = null;
	}
}

const event = (id: string): CollectionActivityEvent => ({
	id,
	processId: 'P'.repeat(43),
	action: 'make-offer',
	actor: 'A'.repeat(43),
	height: 10,
	timestamp: 20,
});

describe('market activity display cache', () => {
	it('restores immutable history for the same collection scope', () => {
		const storage = new MemoryStorage();
		saveMarketActivity(storage, 'scope-a', [event('one')], 30);

		expect(loadMarketActivity(storage, 'scope-a')).toEqual([event('one')]);
		expect(loadMarketActivity(storage, 'scope-b')).toEqual([]);
	});

	it('bounds independent scopes and rejects malformed display data', () => {
		const storage = new MemoryStorage();
		for (let index = 0; index < 26; index += 1)
			saveMarketActivity(storage, `scope-${index}`, [event(String(index))]);

		const stored = JSON.parse(storage.value ?? '{}');
		expect(stored.entries).toHaveLength(24);
		expect(loadMarketActivity(storage, 'scope-25')).toEqual([event('25')]);
		storage.value = JSON.stringify({ version: 1, entries: [{ scope: 'bad', savedAt: 1, events: [{ id: 4 }] }] });
		expect(loadMarketActivity(storage, 'bad')).toEqual([]);
	});

	it('drops corrupt storage without affecting live discovery', () => {
		const storage = new MemoryStorage();
		storage.value = '{broken';

		expect(loadMarketActivity(storage, 'scope')).toEqual([]);
		expect(storage.value).toBeNull();
		expect(MARKET_ACTIVITY_STORAGE_KEY).toBe('bazar-market-activity:v1');
	});
});
