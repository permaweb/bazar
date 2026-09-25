import { describe, expect, it } from 'vitest';

import { replaceAsyncData, settleAsyncData } from 'features/Collection/model/async-data';
import {
	collectionActivityReducer,
	collectionActivityScope,
	type CollectionActivityState,
	type CollectionActivityTransition,
	INITIAL_COLLECTION_ACTIVITY,
	planCollectionActivityScan,
} from 'features/Collection/model/collection-activity';
import { appError } from 'helpers/app-error';

import { activityEventFixture, assetSummary, collectionFixture, processId } from '../../../fixtures/collection';

const failure = appError('index-unavailable');
const cached = [activityEventFixture(1), activityEventFixture(2)];
const collection = collectionFixture([assetSummary(1), assetSummary(2)]);

function reduce(state: CollectionActivityState, ...transitions: CollectionActivityTransition[]) {
	return transitions.reduce(collectionActivityReducer, state);
}

describe('collection activity reducer', () => {
	it('loads from nothing, then publishes each page while the pass continues', () => {
		const started = reduce(INITIAL_COLLECTION_ACTIVITY, { type: 'scan-started', events: [] });
		expect(started).toEqual({ events: { status: 'loading' }, pages: 0, preserving: false });
		const paged = reduce(started, { type: 'page-loaded', events: cached });
		expect(paged).toEqual({ events: { status: 'refreshing', data: cached }, pages: 1, preserving: false });
		const completed = reduce(paged, { type: 'scan-completed', events: cached });
		expect(completed).toEqual({ events: { status: 'success', data: cached }, pages: 1, preserving: false });
	});

	it('keeps cached events visible while it refreshes them', () => {
		const started = reduce(INITIAL_COLLECTION_ACTIVITY, { type: 'scan-started', events: cached });
		expect(started).toEqual({ events: { status: 'refreshing', data: cached }, pages: 0, preserving: true });
		expect(reduce(started, { type: 'scan-completed', events: cached }).preserving).toBe(false);
	});

	it('keeps the events it already has when a pass fails, and drops the failure on the next pass', () => {
		const failed = reduce(
			INITIAL_COLLECTION_ACTIVITY,
			{ type: 'scan-started', events: cached },
			{ type: 'scan-failed', error: failure }
		);
		expect(failed.events).toEqual({ status: 'stale', data: cached, error: failure });
		expect(reduce(failed, { type: 'page-loaded', events: cached }).events).toEqual({
			status: 'stale',
			data: cached,
			error: failure,
		});
		expect(reduce(failed, { type: 'scan-started', events: cached }).events).toEqual({
			status: 'refreshing',
			data: cached,
		});
	});

	it('reports a failure with nothing to show as an error', () => {
		const failed = reduce(
			INITIAL_COLLECTION_ACTIVITY,
			{ type: 'scan-started', events: [] },
			{ type: 'scan-failed', error: failure }
		);
		expect(failed.events).toEqual({ status: 'error', error: failure });
	});
});

describe('collection activity scope and planning', () => {
	it('scopes a pass by the manifest, or by the name index version', () => {
		expect(collectionActivityScope(collection)).toBe('collection-a:manifest-a');
		expect(collectionActivityScope({ ...collection, manifestId: undefined })).toBe('collection-a:collection-a');
		expect(
			collectionActivityScope(
				collectionFixture([], { kind: 'names', namespace: { manifestId: 'names-manifest', namesById: {} } })
			)
		).toBe('collection-a:names-manifest');
	});

	it('starts over for a new scope, preferring cached events when nothing is loaded', () => {
		expect(
			planCollectionActivityScan({
				kind: 'images',
				sameScope: false,
				runMode: 'refresh',
				assetIds: [processId(1), processId(2)],
				loadedAssetIds: new Set([processId(1)]),
				currentEvents: [activityEventFixture(3)],
				cachedEvents: cached,
			})
		).toEqual({ incremental: false, initialEvents: cached, recipients: [processId(1), processId(2)] });
	});

	it('reads only the assets a growing window added', () => {
		expect(
			planCollectionActivityScan({
				kind: 'images',
				sameScope: true,
				runMode: 'refresh',
				assetIds: [processId(1), processId(2)],
				loadedAssetIds: new Set([processId(1)]),
				currentEvents: cached,
				cachedEvents: [],
			})
		).toEqual({ incremental: true, initialEvents: cached, recipients: [processId(2)] });
	});

	it('reads only the assets a failed pass never completed when retrying', () => {
		expect(
			planCollectionActivityScan({
				kind: 'images',
				sameScope: true,
				runMode: 'retry',
				assetIds: [processId(1), processId(2)],
				loadedAssetIds: new Set([processId(1)]),
				currentEvents: cached,
				cachedEvents: [],
			})
		).toMatchObject({ incremental: true, recipients: [processId(2)] });
	});

	it('starts over when an asset left the window, and never batches a name index', () => {
		expect(
			planCollectionActivityScan({
				kind: 'images',
				sameScope: true,
				runMode: 'retry',
				assetIds: [processId(2)],
				loadedAssetIds: new Set([processId(1)]),
				currentEvents: cached,
				cachedEvents: [],
			})
		).toMatchObject({ incremental: false, recipients: [processId(2)] });
		expect(
			planCollectionActivityScan({
				kind: 'names',
				sameScope: true,
				runMode: 'retry',
				assetIds: [processId(1)],
				loadedAssetIds: new Set(),
				currentEvents: cached,
				cachedEvents: [],
			})
		).toMatchObject({ incremental: false });
	});
});

describe('async data transitions', () => {
	it('keeps pending and failed states while replacing the data they show', () => {
		expect(replaceAsyncData({ status: 'idle' }, 1)).toEqual({ status: 'success', data: 1 });
		expect(replaceAsyncData({ status: 'loading' }, 1)).toEqual({ status: 'refreshing', data: 1 });
		expect(replaceAsyncData({ status: 'refreshing', data: 0 }, 1)).toEqual({ status: 'refreshing', data: 1 });
		expect(replaceAsyncData({ status: 'success', data: 0 }, 1)).toEqual({ status: 'success', data: 1 });
		expect(replaceAsyncData({ status: 'error', error: failure }, 1)).toEqual({
			status: 'stale',
			data: 1,
			error: failure,
		});
		expect(replaceAsyncData({ status: 'stale', data: 0, error: failure }, 1)).toEqual({
			status: 'stale',
			data: 1,
			error: failure,
		});
	});

	it('settles a pending load on its data, or on the empty value when it had none', () => {
		expect(settleAsyncData({ status: 'refreshing', data: 1 }, 0)).toEqual({ status: 'success', data: 1 });
		expect(settleAsyncData({ status: 'loading' }, 0)).toEqual({ status: 'success', data: 0 });
		const failed = { status: 'stale', data: 1, error: failure } as const;
		expect(settleAsyncData(failed, 0)).toBe(failed);
		expect(settleAsyncData({ status: 'idle' }, 0)).toEqual({ status: 'idle' });
	});
});
