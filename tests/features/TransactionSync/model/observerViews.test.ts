import { describe, expect, it } from 'vitest';

import type { ArweaveObserverResponseDetail } from 'api/observers';
import type { Observer, ObserverView } from 'api/transactions';

import {
	createLiveObserverResponseStore,
	latestObserverState,
	liveObserverResponseKey,
	mergeLiveObserverViews,
	observedTransactionIds,
	observerViewFromResponse,
	writeCachedObserverViews,
} from 'features/TransactionSync/model/observerViews';

const transactionId = 'T'.repeat(43);
const observer: Observer = { url: 'https://observer.example', label: 'observer', source: 'peer', failures: 0 };

function detail(overrides: Partial<ArweaveObserverResponseDetail>): ArweaveObserverResponseDetail {
	return {
		transactionId,
		observer,
		status: 404,
		observedAt: 10,
		latency: 42,
		...overrides,
	} as ArweaveObserverResponseDetail;
}

function view(updatedAt: number, state: ObserverView['state'] = 'pending', lastSeenAt?: number): ObserverView {
	return { observer, state, confirmations: 0, updatedAt, changedAt: updatedAt, lastSeenAt };
}

function memoryStorage() {
	const values = new Map<string, string>();
	return {
		values,
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => void values.set(key, value),
		removeItem: (key: string) => void values.delete(key),
	};
}

describe('observer responses', () => {
	it('maps not-found, pending, and confirmed responses to observer views', () => {
		expect(observerViewFromResponse(detail({ status: 404 }), undefined)).toMatchObject({
			state: 'not-found',
			confirmations: 0,
			httpStatus: 404,
			latency: 42,
			changedAt: 10,
		});
		expect(observerViewFromResponse(detail({ status: 202 }), undefined)?.state).toBe('pending');
		expect(
			observerViewFromResponse(
				detail({
					status: 200,
					body: { number_of_confirmations: '3', block_indep_hash: 'block', block_height: 1_500_000 },
				}),
				undefined
			)
		).toMatchObject({ state: 'confirmed', confirmations: 3, blockId: 'block', blockHeight: 1_500_000 });
	});

	it('rejects unusable responses instead of recording them', () => {
		expect(observerViewFromResponse(detail({ status: 500 }), undefined)).toBeUndefined();
		expect(observerViewFromResponse(detail({ status: 200, body: 'confirmed' }), undefined)).toBeUndefined();
		expect(
			observerViewFromResponse(
				detail({ status: 200, body: { number_of_confirmations: 0, block_indep_hash: 'b' } }),
				undefined
			)
		).toBeUndefined();
		expect(
			observerViewFromResponse(detail({ status: 200, body: { number_of_confirmations: 2 } }), undefined)
		).toBeUndefined();
	});

	it('keeps the change time while an observer repeats the same answer', () => {
		const first = observerViewFromResponse(detail({ status: 202, observedAt: 10 }), undefined);
		const repeated = observerViewFromResponse(detail({ status: 202, observedAt: 20 }), first);
		const changed = observerViewFromResponse(detail({ status: 404, observedAt: 30 }), repeated);

		expect(repeated).toMatchObject({ changedAt: 10, updatedAt: 20, lastSeenAt: 20 });
		expect(changed).toMatchObject({ changedAt: 30 });
	});
});

describe('live observer response store', () => {
	it('keys the store by step and transaction', () => {
		const steps = [
			{ key: 'register', label: 'Register', target: 5, transaction: { id: transactionId, views: [] } },
			{ key: 'pay', label: 'Pay', target: 5 },
		];
		expect(liveObserverResponseKey(steps)).toBe(`register:${transactionId}|pay:`);
		expect([...observedTransactionIds(steps)]).toEqual([transactionId]);
	});

	it('restores cached views and keeps whichever view is newest', () => {
		const storage = memoryStorage();
		writeCachedObserverViews(storage, transactionId, [view(50, 'confirmed')]);
		const store = createLiveObserverResponseStore(
			'key',
			[{ key: 'pay', label: 'Pay', target: 5, transaction: { id: transactionId, views: [view(20)] } }],
			storage
		);

		expect(store.viewsByTransaction.get(transactionId)?.get(observer.url)?.state).toBe('confirmed');
		expect(createLiveObserverResponseStore('key', [], undefined).viewsByTransaction.size).toBe(0);
	});

	it('merges live views into a transaction without replacing newer props', () => {
		const live = new Map([[transactionId, new Map([[observer.url, view(30, 'confirmed')]])]]);
		expect(mergeLiveObserverViews({ id: transactionId, views: [view(10)] }, live)?.views).toEqual([
			view(30, 'confirmed'),
		]);
		expect(mergeLiveObserverViews({ id: transactionId, views: [view(40)] }, live)?.views).toEqual([view(40)]);
		expect(mergeLiveObserverViews({ id: transactionId, views: [view(10, 'pending', 60)] }, live)?.views).toEqual([
			view(10, 'pending', 60),
		]);
		expect(mergeLiveObserverViews(undefined, live)).toBeUndefined();
	});

	it('reports the state of the most recently updated observer', () => {
		expect(latestObserverState([])).toBe('unknown');
		expect(latestObserverState([view(10, 'confirmed'), view(20, 'pending')])).toBe('pending');
	});
});
