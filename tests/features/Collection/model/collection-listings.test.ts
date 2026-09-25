import { describe, expect, it } from 'vitest';

import {
	collectionCardPrices,
	collectionListingData,
	collectionListingPage,
	collectionListingReducer,
	type CollectionListingState,
	countListingFailures,
	EMPTY_COLLECTION_LISTINGS,
	initialCollectionListingState,
	planCollectionListingScan,
	revalidatedListingPublication,
	settledListingPublication,
	sortCollectionListingCandidates,
} from 'features/Collection/model/collection-listings';
import { appError } from 'helpers/app-error';

import {
	assetSummary,
	candidateFixture,
	collectionFixture,
	orderFixture,
	processId,
	resolvedFixture,
} from '../../../fixtures/collection';

const collection = collectionFixture([assetSummary(1), assetSummary(2), assetSummary(3)]);
const failure = appError('index-unavailable');

function reduce(state: CollectionListingState, ...events: Parameters<typeof collectionListingReducer>[1][]) {
	return events.reduce(collectionListingReducer, state);
}

function started(continuing = false) {
	return reduce(initialCollectionListingState(true), { type: 'scan-started', continuing, requested: true });
}

describe('collection listing reducer', () => {
	it('starts loading only when a collection is present', () => {
		expect(initialCollectionListingState(true).listings.status).toBe('loading');
		expect(initialCollectionListingState(false).listings.status).toBe('idle');
		expect(initialCollectionListingState(false).prices).toEqual({ status: 'success', data: {} });
	});

	it('starts a fresh pass with no listings, a pending price check, and no recheck', () => {
		const withPrice = reduce(initialCollectionListingState(true), {
			type: 'listing-resolved',
			outcome: { processId: processId(1), result: null },
			price: { status: 'unindexed' },
		});
		const state = reduce(
			{ ...withPrice, rechecking: true },
			{ type: 'scan-started', continuing: false, requested: true }
		);
		expect(state.listings).toEqual({ status: 'loading' });
		expect(state.prices).toEqual({ status: 'refreshing', data: {} });
		expect(state.rechecking).toBe(false);
	});

	it('continues a pass with earlier results, resets its page count, and keeps a recheck running', () => {
		const completed = reduce(
			started(),
			{ type: 'scan-page', candidates: [candidateFixture(1)], added: 1, unindexed: [processId(2)] },
			{ type: 'scan-completed', candidates: [candidateFixture(1)] },
			{ type: 'recheck-started' }
		);
		const continued = reduce(completed, { type: 'scan-started', continuing: true, requested: true });
		expect(continued.listings.status).toBe('refreshing');
		expect(collectionListingData(continued.listings).progress).toEqual({
			...EMPTY_COLLECTION_LISTINGS.progress,
			total: 1,
		});
		expect(collectionListingData(continued.listings).candidates).toEqual([candidateFixture(1)]);
		expect(collectionCardPrices(continued.prices)).toEqual({ [processId(2)]: { status: 'unindexed' } });
		expect(continued.rechecking).toBe(true);
	});

	it('settles immediately when a pass has nothing to request, keeping a price failure visible', () => {
		const failed = reduce(started(), { type: 'scan-failed', error: failure });
		const state = reduce(failed, { type: 'scan-started', continuing: true, requested: false });
		expect(state.listings).toEqual({ status: 'success', data: EMPTY_COLLECTION_LISTINGS });
		expect(state.prices).toEqual({ status: 'stale', data: {}, error: failure });
	});

	it('publishes index pages progressively and marks assets without offers as unlisted', () => {
		const state = reduce(started(), {
			type: 'scan-page',
			candidates: [candidateFixture(2), candidateFixture(1)],
			added: 2,
			unindexed: [processId(3)],
		});
		expect(state.listings.status).toBe('refreshing');
		expect(collectionListingData(state.listings).candidates).toEqual([candidateFixture(2), candidateFixture(1)]);
		expect(collectionListingData(state.listings).progress).toMatchObject({ pages: 1, total: 2 });
		expect(collectionCardPrices(state.prices)).toEqual({ [processId(3)]: { status: 'unindexed' } });
	});

	it('keeps price identity when a page has no unlisted assets', () => {
		const initial = started();
		const state = reduce(initial, { type: 'scan-page', candidates: [], added: 0, unindexed: [] });
		expect(state.prices).toBe(initial.prices);
	});

	it('merges a published frame of live-state results into listings, prices, and counters', () => {
		const live = resolvedFixture(assetSummary(1), collection);
		const cancelled = resolvedFixture(assetSummary(2), collection, [orderFixture({ status: 'cancelled' })]);
		const state = reduce(started(), {
			type: 'scan-published',
			batch: [
				settledListingPublication(processId(1), live),
				settledListingPublication(processId(2), cancelled),
				settledListingPublication(processId(3), null, 'rate-limited'),
			],
		});
		const data = collectionListingData(state.listings);
		expect(data.listed).toEqual([live]);
		expect(data.progress).toMatchObject({ resolved: 3, failures: 1, rateLimited: 1 });
		expect(collectionCardPrices(state.prices)[processId(2)]).toEqual({ status: 'resolved', label: null });
		expect(collectionCardPrices(state.prices)[processId(3)]).toEqual({
			status: 'unavailable',
			kind: 'rate-limited',
		});
	});

	it('does not count background revalidations as newly checked', () => {
		const initial = reduce(started(), { type: 'scan-page', candidates: [], added: 0, unindexed: [] });
		const progress = collectionListingData(initial.listings).progress;
		const state = reduce(initial, {
			type: 'scan-published',
			batch: [revalidatedListingPublication(processId(1), resolvedFixture(assetSummary(1), collection))],
		});
		expect(collectionListingData(state.listings).progress).toBe(progress);
	});

	it('completes a pass with the final candidate total and settles the price check', () => {
		const state = reduce(started(), {
			type: 'scan-completed',
			candidates: [candidateFixture(1), candidateFixture(2)],
		});
		expect(state.listings.status).toBe('success');
		expect(collectionListingData(state.listings).progress.total).toBe(2);
		expect(state.prices.status).toBe('success');
	});

	it('fails a pass without discarding listings it already confirmed', () => {
		const live = resolvedFixture(assetSummary(1), collection);
		const partial = reduce(started(), {
			type: 'scan-published',
			batch: [settledListingPublication(processId(1), live)],
		});
		const state = reduce(partial, { type: 'scan-failed', error: failure });
		expect(state.listings).toMatchObject({ status: 'stale', error: failure });
		expect(collectionListingData(state.listings).listed).toEqual([live]);
		expect(state.prices).toMatchObject({ status: 'stale', error: failure });

		const empty = reduce(started(), { type: 'scan-failed', error: failure });
		expect(empty.listings).toEqual({ status: 'error', error: failure });
	});

	it('resets prices for a new scope while keeping a running check pending', () => {
		const checking = reduce(
			started(),
			{ type: 'prices-unindexed', processIds: [processId(1)] },
			{ type: 'price-check-failed', error: failure },
			{ type: 'price-check-started', pending: true }
		);
		expect(reduce(checking, { type: 'prices-reset' }).prices).toEqual({ status: 'refreshing', data: {} });
		const failed = reduce(checking, { type: 'price-check-failed', error: failure });
		expect(reduce(failed, { type: 'prices-reset' }).prices).toEqual({ status: 'success', data: {} });
	});

	it('marks the visible price check pending only when cards need prices', () => {
		const idle = reduce(started(), { type: 'price-check-started', pending: false });
		expect(idle.prices.status).toBe('success');
		expect(reduce(idle, { type: 'price-check-started', pending: false })).toBe(idle);
		expect(reduce(idle, { type: 'price-check-started', pending: true }).prices.status).toBe('refreshing');
	});

	it('keeps a failed price check stale after it settles', () => {
		const state = reduce(
			started(),
			{ type: 'price-check-failed', error: failure },
			{ type: 'price-check-settled' }
		);
		expect(state.prices).toEqual({ status: 'stale', data: {}, error: failure });
	});

	it('resolves one listing at a time for the visible price check', () => {
		const live = resolvedFixture(assetSummary(1), collection);
		const state = reduce(started(), {
			type: 'listing-resolved',
			outcome: { processId: processId(1), result: live },
			price: { status: 'resolved', label: '1 AR' },
		});
		expect(collectionListingData(state.listings).listed).toEqual([live]);
		expect(collectionCardPrices(state.prices)).toEqual({ [processId(1)]: { status: 'resolved', label: '1 AR' } });
		const removed = reduce(state, {
			type: 'listing-resolved',
			outcome: { processId: processId(1), result: null },
			price: { status: 'unavailable', kind: 'unavailable' },
		});
		expect(collectionListingData(removed.listings).listed).toEqual([]);
	});

	it('retries only the named unavailable prices and clears the failure', () => {
		const state = reduce(
			started(),
			{
				type: 'scan-published',
				batch: [
					settledListingPublication(processId(1), null, 'unavailable'),
					settledListingPublication(processId(2), null, 'rate-limited'),
					settledListingPublication(processId(3), resolvedFixture(assetSummary(3), collection)),
				],
			},
			{ type: 'price-check-failed', error: failure },
			{ type: 'prices-retried', processIds: [processId(1), processId(3)] }
		);
		expect(state.prices.status).toBe('success');
		expect(Object.keys(collectionCardPrices(state.prices)).sort()).toEqual([processId(2), processId(3)].sort());
	});

	it('tracks a recheck of unavailable listing candidates with absolute failure counts', () => {
		const live = resolvedFixture(assetSummary(1), collection);
		const state = reduce(
			started(),
			{
				type: 'scan-published',
				batch: [
					settledListingPublication(processId(1), null, 'rate-limited'),
					settledListingPublication(processId(2), null, 'unavailable'),
				],
			},
			{ type: 'scan-completed', candidates: [] },
			{ type: 'recheck-started' },
			{
				type: 'listing-rechecked',
				outcome: { processId: processId(1), result: live },
				price: { status: 'resolved', label: '1 AR' },
				failures: 1,
				rateLimited: 0,
			}
		);
		expect(state.rechecking).toBe(true);
		expect(collectionListingData(state.listings).listed).toEqual([live]);
		expect(collectionListingData(state.listings).progress).toMatchObject({ failures: 1, rateLimited: 0 });
		const finished = reduce(state, { type: 'recheck-finished' });
		expect(finished.rechecking).toBe(false);
		expect(reduce(finished, { type: 'recheck-finished' })).toBe(finished);
	});

	it('forgets the pass when the collection is gone, leaving prices alone', () => {
		const state = reduce(
			started(),
			{ type: 'prices-unindexed', processIds: [processId(1)] },
			{ type: 'recheck-started' },
			{ type: 'cleared' }
		);
		expect(state.listings).toEqual({ status: 'idle' });
		expect(state.rechecking).toBe(false);
		expect(collectionCardPrices(state.prices)).toEqual({ [processId(1)]: { status: 'unindexed' } });
	});

	it('ignores events that change nothing', () => {
		const initial = started();
		expect(reduce(initial, { type: 'prices-unindexed', processIds: [] })).toBe(initial);
		expect(reduce(initial, { type: 'recheck-finished' })).toBe(initial);
	});
});

describe('collection listing pass planning', () => {
	it('requests every loaded asset for a new scope', () => {
		expect(planCollectionListingScan(collection, false, [])).toEqual({
			continuing: false,
			requestedAssetIds: [processId(1), processId(2), processId(3)],
			requested: true,
		});
	});

	it('continues from the assets already checked in the same scope', () => {
		expect(planCollectionListingScan(collection, true, [processId(1), processId(2)])).toEqual({
			continuing: true,
			requestedAssetIds: [processId(3)],
			requested: true,
		});
		expect(planCollectionListingScan(collection, true, [processId(1), processId(2), processId(3)])).toEqual({
			continuing: true,
			requestedAssetIds: [],
			requested: false,
		});
	});

	it('starts over when an asset leaves the window', () => {
		expect(planCollectionListingScan(collection, true, [processId(9)])).toMatchObject({
			continuing: false,
			requestedAssetIds: [processId(1), processId(2), processId(3)],
		});
	});

	it('always requests the namespace scan for name collections', () => {
		const names = collectionFixture([], { kind: 'names' });
		expect(planCollectionListingScan(names, true, [])).toEqual({
			continuing: true,
			requestedAssetIds: [],
			requested: true,
		});
	});
});

describe('collection listing pages', () => {
	const includes = (id: string) => id !== processId(9);

	it('keeps this collection’s candidates and separates new ones from known ones', () => {
		const known = new Map([[processId(1), candidateFixture(1)]]);
		const page = [candidateFixture(1), candidateFixture(2), candidateFixture(9)];
		expect(collectionListingPage(known, page, [], includes)).toEqual({
			candidates: [candidateFixture(1), candidateFixture(2)],
			added: [candidateFixture(2)],
			unindexed: [],
		});
	});

	it('marks completed collection assets without any candidate as unlisted', () => {
		expect(
			collectionListingPage(
				new Map(),
				[candidateFixture(1)],
				[processId(1), processId(2), processId(9)],
				includes
			)
		).toMatchObject({ unindexed: [processId(2)] });
	});

	it('sorts candidates newest first with a stable process ID tie-break', () => {
		const sorted = sortCollectionListingCandidates([
			candidateFixture(1, 5),
			candidateFixture(3, 9),
			candidateFixture(2, 5),
		]);
		expect(sorted.map((candidate) => candidate.processId)).toEqual([processId(3), processId(1), processId(2)]);
	});

	it('counts unavailable and rate-limited candidates', () => {
		expect(countListingFailures([])).toEqual({ failures: 0, rateLimited: 0 });
		expect(
			countListingFailures([
				{ candidate: candidateFixture(1), kind: 'rate-limited' },
				{ candidate: candidateFixture(2), kind: 'unavailable' },
			])
		).toEqual({ failures: 2, rateLimited: 1 });
	});
});
