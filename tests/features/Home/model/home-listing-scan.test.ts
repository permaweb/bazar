import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type HomeListingShell, replaceHiddenCollectionAssetIndex } from 'api/collections';

import {
	homeListingScanFailure,
	homeListingScanReducer,
	type HomeListingScanState,
	initialHomeListingScan,
	mergeHomeListingPublications,
} from 'features/Home/model/home-listing-scan';

import {
	assetId,
	imageCollection,
	READY_HIDDEN_COLLECTION_INDEX,
	resolvedListing,
	uniqueAssetState,
} from '../../../fixtures/home-market';

const first = { id: assetId('A'), name: 'First' };
const second = { id: assetId('B'), name: 'Second' };
const collection = imageCollection('art', [first, second]);
const listedFirst = resolvedListing(first, collection, '1000000000000');
const listedSecond = resolvedListing(second, collection, '2000000000000');
const failure = { status: 'unavailable', source: 'index', kind: 'rate-limited' } as const;

function shell(asset: typeof first): HomeListingShell {
	return {
		asset,
		collection,
		activity: { processId: asset.id, height: 1, timestamp: 1 },
		price: '1 AR',
	};
}

function scanning(run = 1, state = initialHomeListingScan()): HomeListingScanState {
	return homeListingScanReducer(state, { type: 'started', run });
}

beforeEach(() => replaceHiddenCollectionAssetIndex(READY_HIDDEN_COLLECTION_INDEX));
afterEach(() => replaceHiddenCollectionAssetIndex({}));

describe('home listing scan', () => {
	it('starts idle with the session snapshot and no live listings', () => {
		const state = initialHomeListingScan([shell(first)]);
		expect(state).toEqual({ run: null, status: { status: 'idle' }, cached: [shell(first)], listings: [] });
		expect(homeListingScanFailure(state)).toBeUndefined();
	});

	it('publishes live listings and settles their snapshot shells', () => {
		const state = homeListingScanReducer(scanning(1, initialHomeListingScan([shell(first), shell(second)])), {
			type: 'published',
			run: 1,
			batch: [{ processId: first.id, result: listedFirst }],
		});

		expect(state.listings).toEqual([listedFirst]);
		expect(state.cached).toEqual([shell(second)]);
	});

	it('drops a settled asset that is no longer listed, even from the snapshot', () => {
		const listed = homeListingScanReducer(scanning(1, initialHomeListingScan([shell(second)])), {
			type: 'published',
			run: 1,
			batch: [{ processId: first.id, result: listedFirst }],
		});
		const settled = homeListingScanReducer(listed, {
			type: 'published',
			run: 1,
			batch: [
				{ processId: first.id, result: resolvedListing(first, collection) },
				{ processId: second.id, result: null },
			],
		});

		expect(settled.listings).toEqual([]);
		expect(settled.cached).toEqual([]);
	});

	it('applies revalidated state only to published listings and removes listings that closed', () => {
		const listed = mergeHomeListingPublications([], [{ processId: first.id, result: listedFirst }]);
		const repriced = uniqueAssetState('3000000000000');

		const refreshed = mergeHomeListingPublications(listed, [
			{ processId: first.id, state: repriced, provider: 'https://other.example', refresh: true },
			{ processId: second.id, state: repriced, provider: 'https://other.example', refresh: true },
		]);
		expect(refreshed).toEqual([{ ...listedFirst, state: repriced, provider: 'https://other.example' }]);

		const closed = mergeHomeListingPublications(refreshed, [
			{ processId: first.id, state: uniqueAssetState(), provider: 'https://other.example', refresh: true },
		]);
		expect(closed).toEqual([]);
	});

	it('completes or fails the current scan and keeps accepting its late revalidations', () => {
		const complete = homeListingScanReducer(scanning(), { type: 'finished', run: 1 });
		expect(complete.status).toEqual({ status: 'complete' });

		const failed = homeListingScanReducer(scanning(), { type: 'finished', run: 1, failure });
		expect(failed.status).toEqual({ status: 'failed', failure });
		expect(homeListingScanFailure(failed)).toBe(failure);

		const late = homeListingScanReducer(complete, {
			type: 'published',
			run: 1,
			batch: [{ processId: second.id, result: listedSecond }],
		});
		expect(late.listings).toEqual([listedSecond]);
	});

	it('ignores results from a superseded or stopped scan', () => {
		const restarted = scanning(2, scanning(1));
		const stalePublish = homeListingScanReducer(restarted, {
			type: 'published',
			run: 1,
			batch: [{ processId: first.id, result: listedFirst }],
		});
		expect(stalePublish).toBe(restarted);
		expect(homeListingScanReducer(restarted, { type: 'finished', run: 1, failure })).toBe(restarted);

		const stopped = homeListingScanReducer(scanning(), { type: 'stopped' });
		expect(stopped.status).toEqual({ status: 'idle' });
		expect(
			homeListingScanReducer(stopped, {
				type: 'published',
				run: 1,
				batch: [{ processId: first.id, result: listedFirst }],
			})
		).toBe(stopped);
		expect(homeListingScanReducer(stopped, { type: 'finished', run: 1 })).toBe(stopped);
	});

	it('keeps a settled outcome when stopped and records a blocked scan as failed', () => {
		const complete = homeListingScanReducer(scanning(), { type: 'finished', run: 1 });
		expect(homeListingScanReducer(complete, { type: 'stopped' }).status).toEqual({ status: 'complete' });

		const blocked = homeListingScanReducer(complete, { type: 'blocked', failure });
		expect(blocked).toMatchObject({ run: null, status: { status: 'failed', failure } });
	});

	it('replaces the snapshot without disturbing the scan', () => {
		const state = homeListingScanReducer(scanning(), { type: 'snapshot-restored', cached: [shell(second)] });
		expect(state).toMatchObject({ run: 1, status: { status: 'scanning' }, cached: [shell(second)] });
	});
});
