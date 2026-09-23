import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { replaceHiddenCollectionAssetIndex } from 'api/collections';

import {
	EMPTY_HOME_MARKET_SUMMARIES,
	homeAssetStateSummary,
	type HomeMarketSummaries,
	homeMarketSummariesReducer,
} from 'features/Home/model/home-market-summaries';

import {
	assetId,
	candidate,
	imageCollection,
	READY_HIDDEN_COLLECTION_INDEX,
	uniqueAssetState,
} from '../../../fixtures/home-market';

const first = { id: assetId('A'), name: 'First' };
const second = { id: assetId('B'), name: 'Second' };
const collection = imageCollection('art', [first, second]);

function reduce(...events: Parameters<typeof homeMarketSummariesReducer>[1][]): HomeMarketSummaries {
	return events.reduce(homeMarketSummariesReducer, EMPTY_HOME_MARKET_SUMMARIES);
}

beforeEach(() => replaceHiddenCollectionAssetIndex(READY_HIDDEN_COLLECTION_INDEX));
afterEach(() => replaceHiddenCollectionAssetIndex({}));

describe('home market summaries', () => {
	it('records asset prices and new artwork, keeping artwork identity when unchanged', () => {
		const priced = reduce({ type: 'asset-price-resolved', assetId: first.id, price: '1 AR', image: 'image-1' });
		expect(priced.assetPrices).toEqual({ [first.id]: { status: 'resolved', value: '1 AR' } });
		expect(priced.assetImages).toEqual({ [first.id]: 'image-1' });

		const repriced = homeMarketSummariesReducer(priced, {
			type: 'asset-price-resolved',
			assetId: first.id,
			price: null,
			image: 'image-1',
		});
		expect(repriced.assetPrices[first.id]).toEqual({ status: 'resolved', value: null });
		expect(repriced.assetImages).toBe(priced.assetImages);
	});

	it('records compute failures and prunes summaries for assets no longer visible', () => {
		const state = reduce(
			{ type: 'asset-price-resolved', assetId: first.id, price: '1 AR', image: 'image-1' },
			{ type: 'asset-price-failed', assetId: second.id, kind: 'rate-limited' },
			{ type: 'assets-retained', assetIds: new Set([second.id]) }
		);

		expect(state.assetPrices).toEqual({
			[second.id]: { status: 'unavailable', source: 'compute', kind: 'rate-limited' },
		});
		expect(state.assetImages).toEqual({});
	});

	it('publishes a verified listing with its price and activity, then withdraws it when unlisted', () => {
		const activity = candidate(first.id, 20, 2_000);
		const listed = reduce({
			type: 'listing-resolved',
			collectionId: collection.id,
			asset: first,
			listing: { price: '1 AR', activity },
		});
		expect(listed.verifiedListings).toEqual({ [collection.id]: [first] });
		expect(listed.assetPrices[first.id]).toEqual({ status: 'resolved', value: '1 AR' });
		expect(listed.verifiedActivity[first.id]).toBe(activity);

		const unlisted = homeMarketSummariesReducer(listed, {
			type: 'listing-resolved',
			collectionId: collection.id,
			asset: first,
			listing: null,
		});
		expect(unlisted.verifiedListings).toEqual({ [collection.id]: [] });
		expect(unlisted.assetPrices).toBe(listed.assetPrices);
	});

	it('returns the same state for an unlisted asset that was never published', () => {
		expect(
			homeMarketSummariesReducer(EMPTY_HOME_MARKET_SUMMARIES, {
				type: 'listing-resolved',
				collectionId: collection.id,
				asset: first,
				listing: null,
			})
		).toBe(EMPTY_HOME_MARKET_SUMMARIES);
	});

	it('settles a collection floor with its verified listings and keeps unchanged listings by identity', () => {
		const activity = candidate(second.id);
		const floor = { status: 'resolved', value: '1 AR' } as const;
		const settled = reduce({
			type: 'collection-floor-resolved',
			collection,
			listingIds: [second.id],
			activity: { [second.id]: activity },
			floor,
		});
		expect(settled.verifiedListings).toEqual({ [collection.id]: [second] });
		expect(settled.verifiedActivity).toEqual({ [second.id]: activity });
		expect(settled.collectionFloors).toEqual({ [collection.id]: floor });

		const again = homeMarketSummariesReducer(settled, {
			type: 'collection-floor-resolved',
			collection,
			listingIds: [second.id],
			activity: {},
			floor,
		});
		expect(again.verifiedListings).toBe(settled.verifiedListings);
	});

	it('records index failures and discards floors for hidden or changed collections', () => {
		const floor = { status: 'resolved', value: '1 AR' } as const;
		const state = reduce(
			{ type: 'collection-floor-resolved', collection, listingIds: [], activity: {}, floor },
			{
				type: 'collection-floor-resolved',
				collection: imageCollection('changed', []),
				listingIds: [],
				activity: {},
				floor,
			},
			{
				type: 'collection-floor-resolved',
				collection: imageCollection('hidden', []),
				listingIds: [],
				activity: {},
				floor,
			},
			{ type: 'collection-floor-failed', collectionId: 'failed', kind: 'unavailable' },
			{
				type: 'collections-retained',
				collectionIds: new Set([collection.id, 'changed', 'failed']),
				changedCollectionIds: new Set(['changed']),
			}
		);

		expect(state.collectionFloors).toEqual({
			[collection.id]: floor,
			failed: { status: 'unavailable', source: 'index', kind: 'unavailable' },
		});
	});

	it('derives an asset price label and artwork from live state', () => {
		expect(homeAssetStateSummary(collection, first.id, uniqueAssetState('1500000000000'))).toEqual({
			price: '1.5 AR',
			image: undefined,
		});
		expect(homeAssetStateSummary(collection, first.id, uniqueAssetState()).price).toBeNull();
	});
});
