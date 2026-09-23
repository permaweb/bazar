import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	type AssetSummary,
	type Collection,
	type HomeListingShell,
	replaceHiddenCollectionAssetIndex,
} from 'api/collections';

import { HOME_MESSAGES } from 'features/Home/messages';
import { homeCollectionDescription, type HomeMarketSummary } from 'features/Home/model/home-market';
import {
	homeCollectionActivityKey,
	homeCollectionSummaryKey,
	homeCollectionSummaryVersion,
	homeDiscoverSelection,
	homeDisplayAssetPrices,
	homeDisplayedAssets,
	homeDisplayListings,
	homeFailedSummaryIds,
	homeListingActivityIndex,
	homeLiveListingShells,
	homeLoadedAssetLimit,
	homeMarketProgress,
	homePartialTokenCollection,
	homePortableStateKey,
	homeSummaryFailures,
	homeTokenPriceChangeTone,
	homeVisibleCollections,
	mergeHomeListingShells,
	recordHomeCollectionActivity,
} from 'features/Home/model/home-market-view';

import {
	assetId,
	imageCollection,
	READY_HIDDEN_COLLECTION_INDEX,
	resolvedListing,
} from '../../../fixtures/home-market';

const first: AssetSummary = { id: assetId('A'), name: 'First', image: 'image-a' };
const second: AssetSummary = { id: assetId('B'), name: 'Second', image: 'image-b' };
const art = imageCollection('art', [first, second]);
const tokens: Collection = {
	id: 'tokens',
	name: 'Tokens',
	description: '',
	kind: 'tokens',
	assets: [{ id: assetId('T'), name: 'Token', ticker: 'TKN' }],
	hasMore: true,
};
const resolved = { status: 'resolved', value: '1 AR' } as const;
const unlisted = { status: 'resolved', value: null } as const;
const unavailable = { status: 'unavailable', source: 'compute', kind: 'unavailable' } as const;

function shell(asset: AssetSummary, price = '1 AR', height = 10): HomeListingShell {
	return { asset, collection: art, activity: { processId: asset.id, height, timestamp: height }, price };
}

beforeEach(() => replaceHiddenCollectionAssetIndex(READY_HIDDEN_COLLECTION_INDEX));
afterEach(() => replaceHiddenCollectionAssetIndex({}));

const describeCollection = (collection: Collection) => homeCollectionDescription(collection, HOME_MESSAGES.en);

describe('home collections view', () => {
	it('keeps non-token collections that match the search and orders them by recent activity', () => {
		const older = { ...imageCollection('older', []), name: 'Older art' };
		const newer = { ...imageCollection('newer', []), name: 'Newer art' };
		const activity = {
			older: { processId: assetId('A'), height: 1, timestamp: 1 },
			newer: { processId: assetId('B'), height: 2, timestamp: 2 },
		};

		expect(
			homeVisibleCollections([tokens, older, newer], '', null, 'recent', activity, describeCollection).map(
				(collection) => collection.id
			)
		).toEqual(['newer', 'older']);
		expect(
			homeVisibleCollections([older, newer], 'newer', null, 'recent', activity, describeCollection).map(
				(item) => item.id
			)
		).toEqual(['newer']);
		expect(
			homeVisibleCollections(
				[older],
				'unrelated',
				new Map([[older, [first]]]),
				'recent',
				{},
				describeCollection
			).map((item) => item.id)
		).toEqual(['older']);
	});

	it('records only strictly newer collection activity', () => {
		const initial = recordHomeCollectionActivity(
			{},
			{
				collectionId: 'art',
				activity: { processId: first.id, height: 5, timestamp: 50 },
			}
		);
		const sameHeightOlder = recordHomeCollectionActivity(initial, {
			collectionId: 'art',
			activity: { processId: first.id, height: 5, timestamp: 40 },
		});
		expect(sameHeightOlder).toBe(initial);

		const newer = recordHomeCollectionActivity(initial, {
			collectionId: 'art',
			activity: { processId: second.id, height: 6, timestamp: 10 },
		});
		expect(newer.art.height).toBe(6);
	});

	it('identifies collection scopes by their loaded assets and AO routing', () => {
		expect(homeCollectionSummaryKey([art], 'peer-a')).not.toBe(homeCollectionSummaryKey([art], 'peer-b'));
		expect(homeCollectionSummaryVersion(art, 'peer-a')).toBe(
			homeCollectionSummaryVersion({ ...art, assets: [second, first] }, 'peer-a')
		);
		expect(homeCollectionActivityKey([art])).not.toBe(homeCollectionActivityKey([{ ...art, assets: [first] }]));
	});

	it('reports a partly loaded token collection only while searching', () => {
		expect(homePartialTokenCollection([art, tokens], 'tok')).toBe(tokens);
		expect(homePartialTokenCollection([art, tokens], '')).toBeUndefined();
		expect(homePartialTokenCollection([art, { ...tokens, hasMore: false }], 'tok')).toBeUndefined();
	});
});

describe('home listing shells', () => {
	it('overlays cached shells with live ones and keeps the rest', () => {
		const merged = mergeHomeListingShells([shell(first, '1 AR'), shell(second, '2 AR')], [shell(first, '3 AR')]);
		expect(merged.map((listing) => listing.price)).toEqual(['3 AR', '2 AR']);
	});

	it('builds shells only for live listings', () => {
		expect(homeLiveListingShells([resolvedListing(first, art, '1000000000000')])).toHaveLength(1);
		expect(homeLiveListingShells([resolvedListing(first, art)])).toEqual([]);
	});

	it('refreshes shells with the current collection and its loaded artwork', () => {
		const withoutImage = { ...first, image: undefined };
		const listings = homeDisplayListings([shell(withoutImage)], [art]);
		expect(listings[0].asset.image).toBe('image-a');
		expect(listings[0].collection).toBe(art);
	});

	it('counts loaded assets plus visible listings for the search limit', () => {
		expect(homeLoadedAssetLimit([art, tokens], 3)).toBe(6);
	});

	it('identifies each listing state revision', () => {
		const listing = resolvedListing(first, art, '1000000000000');
		expect(homePortableStateKey([listing])).toBe(`${first.id}:100`);
		expect(homePortableStateKey([])).toBe('');
	});
});

describe('home discover view', () => {
	const entries = [
		{ asset: first, collection: art },
		{ asset: second, collection: art },
		{ asset: tokens.assets[0], collection: tokens },
	];

	it('prices assets from shells until a live summary replaces them', () => {
		const prices = homeDisplayAssetPrices([shell(first, '1 AR'), shell(second, '2 AR')], {
			[first.id]: { status: 'resolved', value: '5 AR' },
			[second.id]: unavailable,
			[tokens.assets[0].id]: unavailable,
		});

		expect(prices[first.id]).toEqual({ status: 'resolved', value: '5 AR' });
		expect(prices[second.id]).toEqual({ status: 'resolved', value: '2 AR' });
		expect(prices[tokens.assets[0].id]).toBe(unavailable);
	});

	it('indexes the newest listing activity per asset', () => {
		const index = homeListingActivityIndex(
			{ [first.id]: { processId: first.id, height: 4, timestamp: 4 } },
			homeDisplayListings([shell(first, '1 AR', 9), shell(second, '2 AR', 2)], [art])
		);
		expect(index.get(first.id)?.height).toBe(9);
		expect(index.get(second.id)?.height).toBe(2);
	});

	it('filters by asset type and view, then orders by price or listing recency', () => {
		const prices: Record<string, HomeMarketSummary> = {
			[first.id]: { status: 'resolved', value: '9 AR' },
			[second.id]: resolved,
		};
		const activity = new Map([
			[first.id, { processId: first.id, height: 2, timestamp: 2 }],
			[second.id, { processId: second.id, height: 9, timestamp: 9 }],
		]);

		expect(homeDisplayedAssets(entries, prices, 'all', 'all', activity)).toHaveLength(3);
		expect(homeDisplayedAssets(entries, prices, 'tokens', 'all', activity).map(({ asset }) => asset.id)).toEqual([
			tokens.assets[0].id,
		]);
		expect(homeDisplayedAssets(entries, prices, 'all', 'listed', activity).map(({ asset }) => asset.id)).toEqual([
			second.id,
			first.id,
		]);
		expect(homeDisplayedAssets(entries, prices, 'all', 'price-low', activity).map(({ asset }) => asset.id)).toEqual(
			[second.id, first.id]
		);
		expect(
			homeDisplayedAssets(entries, prices, 'all', 'price-high', activity).map(({ asset }) => asset.id)
		).toEqual([first.id, second.id]);
		expect(homeDisplayedAssets(entries, { [first.id]: unlisted }, 'all', 'listed', activity)).toEqual([]);
	});

	it('pages the overview and loads summaries for exactly what it shows', () => {
		const selection = homeDiscoverSelection({
			displayed: entries,
			candidates: entries,
			assetType: 'all',
			assetView: 'all',
			assetPage: 1,
			tokenPage: 1,
		});

		expect(selection.tokens.map(({ asset }) => asset.id)).toEqual([tokens.assets[0].id]);
		expect(selection.collectibles).toHaveLength(2);
		expect(selection.visibleTokenKey).toBe(tokens.assets[0].id);
		expect(selection.summaryAssets).toHaveLength(3);
		expect(selection.assetPagination).toMatchObject({ page: 1, pageCount: 1 });
	});

	it('clamps a page past the end and loads summaries for every candidate outside the all view', () => {
		const many = Array.from({ length: 20 }, (_, index) => ({
			asset: { id: assetId(String.fromCharCode(97 + index)), name: `Asset ${index}` },
			collection: art,
		}));
		const selection = homeDiscoverSelection({
			displayed: many,
			candidates: many.slice(0, 5),
			assetType: 'atomic',
			assetView: 'listed',
			assetPage: 9,
			tokenPage: 4,
		});

		expect(selection.assetPagination).toMatchObject({ page: 3, pageCount: 3 });
		expect(selection.assetPagination.items).toHaveLength(2);
		expect(selection.visibleTokenKey).toBe('');
		expect(selection.summaryAssets).toHaveLength(5);
	});
});

describe('home market progress', () => {
	const base = {
		tab: 'discover' as const,
		marketLoading: false,
		marketCollectionCount: 1,
		collectionIds: [art.id],
		collectionFloors: { [art.id]: resolved } as Record<string, HomeMarketSummary>,
		failedCollectionCount: 0,
		collectionsRetrying: false,
		assetIds: [first.id],
		assetPrices: { [first.id]: resolved } as Record<string, HomeMarketSummary>,
		failedAssetCount: 0,
		assetsRetrying: false,
		listingsScanning: false,
		listingsFailed: false,
		summaryFailureCount: 0,
		displayedAssetCount: 1,
	};

	it('settles once every visible summary resolved', () => {
		expect(homeMarketProgress(base)).toEqual({
			collectionsReady: true,
			collectionsPending: false,
			discoverPending: false,
			discoverFailed: false,
			discoverInitialLoading: false,
			pageRefreshing: false,
		});
	});

	it('stays pending while summaries are missing, scanning, retrying, or failed', () => {
		expect(homeMarketProgress({ ...base, assetPrices: {} }).discoverPending).toBe(true);
		expect(homeMarketProgress({ ...base, listingsScanning: true }).discoverPending).toBe(true);
		expect(homeMarketProgress({ ...base, failedAssetCount: 1 }).discoverPending).toBe(true);
		expect(homeMarketProgress({ ...base, assetsRetrying: true }).discoverPending).toBe(true);
		expect(homeMarketProgress({ ...base, collectionsRetrying: true }).collectionsPending).toBe(true);
	});

	it('shows the initial loader only while nothing is displayed, and reports failures', () => {
		expect(homeMarketProgress({ ...base, assetPrices: {}, displayedAssetCount: 0 }).discoverInitialLoading).toBe(
			true
		);
		expect(homeMarketProgress({ ...base, assetPrices: {} }).discoverInitialLoading).toBe(false);
		expect(homeMarketProgress({ ...base, listingsFailed: true }).discoverFailed).toBe(true);
		expect(homeMarketProgress({ ...base, summaryFailureCount: 1 }).discoverFailed).toBe(true);
	});

	it('refreshes the page indicator for the visible tab only', () => {
		expect(homeMarketProgress({ ...base, assetPrices: {} }).pageRefreshing).toBe(true);
		expect(homeMarketProgress({ ...base, tab: 'collections', collectionFloors: {} }).pageRefreshing).toBe(true);
		expect(homeMarketProgress({ ...base, tab: 'activity', assetPrices: {} }).pageRefreshing).toBe(false);
		expect(homeMarketProgress({ ...base, marketLoading: true, marketCollectionCount: 0 }).collectionsReady).toBe(
			false
		);
	});

	it('collects failures and unavailable summary keys', () => {
		expect(homeFailedSummaryIds([first.id, second.id], { [first.id]: unavailable, [second.id]: resolved })).toEqual(
			[first.id]
		);
		expect(homeSummaryFailures({ [first.id]: unavailable }, { [art.id]: resolved })).toEqual([unavailable]);
	});

	it('tones token price changes by direction', () => {
		expect(homeTokenPriceChangeTone(5)).toBe('positive');
		expect(homeTokenPriceChangeTone(-5)).toBe('negative');
		expect(homeTokenPriceChangeTone(0)).toBe('muted');
		expect(homeTokenPriceChangeTone(null)).toBe('muted');
		expect(homeTokenPriceChangeTone('unavailable')).toBe('muted');
		expect(homeTokenPriceChangeTone(undefined)).toBe('muted');
	});
});
