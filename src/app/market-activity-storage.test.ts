import { describe, expect, it } from 'vitest';

import type { CollectionActivityEvent } from 'api/asset-discovery';

import {
	loadMarketActivity,
	MARKET_ACTIVITY_STORAGE_KEY,
	MARKET_ACTIVITY_STORAGE_SCOPE_LIMIT,
	saveMarketActivity,
} from './market-activity-storage';

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
		for (let index = 0; index < MARKET_ACTIVITY_STORAGE_SCOPE_LIMIT + 2; index += 1)
			saveMarketActivity(storage, `scope-${index}`, [event(String(index))]);

		const stored = JSON.parse(storage.value ?? '{}');
		expect(stored.entries).toHaveLength(MARKET_ACTIVITY_STORAGE_SCOPE_LIMIT);
		expect(loadMarketActivity(storage, `scope-${MARKET_ACTIVITY_STORAGE_SCOPE_LIMIT + 1}`)).toEqual([
			event(String(MARKET_ACTIVITY_STORAGE_SCOPE_LIMIT + 1)),
		]);
		storage.value = JSON.stringify({ version: 1, entries: [{ scope: 'bad', savedAt: 1, events: [{ id: 4 }] }] });
		expect(loadMarketActivity(storage, 'bad')).toEqual([]);
	});

	it('retains the complete event history for the current collection scope', () => {
		const storage = new MemoryStorage();
		const events = Array.from({ length: 250 }, (_, index) => event(String(index)));

		saveMarketActivity(storage, 'complete', events);

		expect(loadMarketActivity(storage, 'complete')).toHaveLength(250);
	});

	it('drops corrupt storage without affecting live discovery', () => {
		const storage = new MemoryStorage();
		storage.value = '{broken';

		expect(loadMarketActivity(storage, 'scope')).toEqual([]);
		expect(storage.value).toBeNull();
		expect(MARKET_ACTIVITY_STORAGE_KEY).toBe('bazar-market-activity:v1');
	});
});
