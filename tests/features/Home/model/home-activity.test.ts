import { describe, expect, it } from 'vitest';

import type { CollectionActivityEvent } from 'api/discovery';

import {
	homeActivityHistoryError,
	homeActivityReducer,
	homeActivityScope,
	type HomeActivityState,
	homeActivityView,
	INITIAL_HOME_ACTIVITY,
	mergeHomeActivityEvents,
} from 'features/Home/model/home-activity';
import { appError } from 'helpers/app-error';

import { assetId, imageCollection } from '../../../fixtures/home-market';

function event(id: string, purchaseProof?: { transactionId: string; height: number }): CollectionActivityEvent {
	return {
		id,
		processId: assetId('A'),
		action: 'register-interest',
		actor: assetId('W'),
		height: 1,
		timestamp: 1,
		...(purchaseProof ? { purchaseProof } : {}),
	};
}

const cached = [event('cached')];
const scanned = [event('cached'), event('scanned')];
const indexError = appError('index-unavailable');

function reduce(state: HomeActivityState, ...events: Parameters<typeof homeActivityReducer>[1][]) {
	return events.reduce(homeActivityReducer, state);
}

describe('home activity feed', () => {
	it('starts loading with no events and no failure', () => {
		expect(homeActivityView(INITIAL_HOME_ACTIVITY)).toEqual({
			events: [],
			loading: true,
			error: undefined,
			verifyingPurchases: false,
			purchaseVerificationFailures: 0,
			purchaseVerificationIncomplete: false,
		});
	});

	it('shows restored cached events while the scan keeps loading', () => {
		const view = homeActivityView(reduce(INITIAL_HOME_ACTIVITY, { type: 'restored', events: cached }));
		expect(view).toMatchObject({ events: cached, loading: true });
	});

	it('keeps visible events through a refresh and replaces them for a new scope', () => {
		const loaded = reduce(
			INITIAL_HOME_ACTIVITY,
			{ type: 'published', events: cached },
			{ type: 'history-finished' },
			{ type: 'settled', failures: 0, incomplete: false }
		);
		expect(homeActivityView(loaded)).toMatchObject({ events: cached, loading: false });

		const refreshing = homeActivityReducer(loaded, { type: 'started' });
		expect(homeActivityView(refreshing)).toMatchObject({ events: cached, loading: true });

		const rescoped = homeActivityReducer(refreshing, { type: 'started', events: [] });
		expect(homeActivityView(rescoped)).toMatchObject({ events: [], loading: true });
	});

	it('finishes the history scan before verification and reports verification results', () => {
		const scanning = reduce(INITIAL_HOME_ACTIVITY, { type: 'published', events: scanned });
		const verifying = reduce(scanning, { type: 'history-finished' }, { type: 'verification-started' });
		expect(homeActivityView(verifying)).toMatchObject({
			events: scanned,
			loading: false,
			verifyingPurchases: true,
		});

		const settled = homeActivityReducer(verifying, { type: 'settled', failures: 2, incomplete: true });
		expect(homeActivityView(settled)).toMatchObject({
			verifyingPurchases: false,
			purchaseVerificationFailures: 2,
			purchaseVerificationIncomplete: true,
		});
	});

	it('keeps loaded events visible beside an index failure and clears the failure on the next scan', () => {
		const stale = reduce(
			INITIAL_HOME_ACTIVITY,
			{ type: 'published', events: scanned },
			{ type: 'history-finished' },
			{ type: 'settled', failures: 0, incomplete: false, error: indexError }
		);
		expect(homeActivityView(stale)).toMatchObject({ events: scanned, loading: false, error: indexError });

		const retried = homeActivityReducer(stale, { type: 'started' });
		expect(homeActivityView(retried)).toMatchObject({ events: scanned, loading: true, error: undefined });
	});

	it('reports a failed scan with no events as an error and keeps it while nothing is loaded', () => {
		const failed = reduce(
			INITIAL_HOME_ACTIVITY,
			{ type: 'history-finished' },
			{ type: 'settled', failures: 0, incomplete: false, error: indexError }
		);
		expect(homeActivityView(failed)).toMatchObject({ events: [], error: indexError });

		const cleared = homeActivityReducer(failed, { type: 'cleared' });
		expect(homeActivityView(cleared)).toMatchObject({ events: [], loading: false, error: indexError });

		const restored = homeActivityReducer(failed, { type: 'restored', events: cached });
		expect(homeActivityView(restored)).toMatchObject({ events: cached, error: indexError });
	});

	it('clears a successful feed when no collections remain', () => {
		const loaded = reduce(
			INITIAL_HOME_ACTIVITY,
			{ type: 'published', events: cached },
			{ type: 'history-finished' },
			{ type: 'verification-started' }
		);
		expect(homeActivityView(homeActivityReducer(loaded, { type: 'cleared' }))).toEqual({
			events: [],
			loading: false,
			error: undefined,
			verifyingPurchases: false,
			purchaseVerificationFailures: 0,
			purchaseVerificationIncomplete: false,
		});
	});

	it('keeps an existing purchase proof when the index returns the event again without one', () => {
		const found = new Map<string, CollectionActivityEvent>();
		mergeHomeActivityEvents(found, [event('a', { transactionId: 'settlement', height: 9 })]);
		mergeHomeActivityEvents(found, [event('a')]);
		expect(found.get('a')?.purchaseProof).toEqual({ transactionId: 'settlement', height: 9 });

		mergeHomeActivityEvents(found, [event('a', { transactionId: 'newer', height: 10 })]);
		expect(found.get('a')?.purchaseProof).toEqual({ transactionId: 'newer', height: 10 });
	});

	it('identifies the cached scope by collection and asset window', () => {
		const assets = [{ id: assetId('A'), name: 'First' }];
		expect(homeActivityScope([imageCollection('art', assets), imageCollection('names', [])])).toBe(
			homeActivityScope([imageCollection('names', []), imageCollection('art', assets)])
		);
		expect(homeActivityScope([imageCollection('art', assets)])).not.toBe(
			homeActivityScope([imageCollection('art', [])])
		);
		expect(homeActivityScope([])).toBe('');
	});

	it('prefers rate limiting over other index outages, and reports nothing without failures', () => {
		expect(homeActivityHistoryError([])).toBeUndefined();
		expect(homeActivityHistoryError([new Error('offline')])?.reason).toBe('index-unavailable');
		expect(homeActivityHistoryError([new Error('offline'), appError('rate-limited')])?.reason).toBe(
			'index-rate-limited'
		);
	});
});
