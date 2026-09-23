import {
	type AssetSummary,
	type Collection,
	collectionAsset,
	collectionSearchAssets,
	type HomeListingShell,
	isVisibleAssetId,
	isVisibleCollectionId,
	type SearchAsset,
} from 'api/collections';
import type { ResolvedAsset } from 'api/discovery';

import { collectionActivityVersion } from 'features/Activity';
import { homeListingShell } from 'features/Catalogue';

import {
	compareHomeCollections,
	compareHomeListingRecency,
	HOME_DISCOVER_TOKEN_PAGE_SIZE,
	HOME_LISTING_ASSET_LIMIT,
	homeAllAssets,
	homeAssetPage,
	type HomeAssetType,
	homeAssetTypeMatches,
	type HomeAssetView,
	homeAssetVisibleForView,
	type HomeCollectionSort,
	homeDiscoveryAssets,
	type HomeListingActivity,
	homeMarketHasPending,
	homeMarketPriceValue,
	homeMarketShellLoading,
	homeMarketShowsInitialLoader,
	homeMarketSummariesReady,
	type HomeMarketSummary,
	homeSearchAssets,
	type HomeTab,
	type HomeTokenPriceChange,
} from './home-market';

// One asset card or token row on the Home market.
export type HomeMarketEntry = { asset: AssetSummary; collection: Collection };

export type HomeDisplayListing = HomeMarketEntry & { activity: HomeListingShell['activity'] };

export type HomeAssetPageResult = { items: HomeMarketEntry[]; page: number; pageCount: number };

export type HomeSearchMatches = ReadonlyMap<Collection, AssetSummary[]>;

// Everything the Discover panel renders.
export type HomeDiscoverView = {
	displayed: HomeMarketEntry[];
	tokens: HomeMarketEntry[];
	collectibles: HomeMarketEntry[];
	tokenPagination: HomeAssetPageResult;
	assetPagination: HomeAssetPageResult;
	prices: Record<string, HomeMarketSummary>;
	images: Record<string, string>;
	tokenPriceChanges: Record<string, HomeTokenPriceChange>;
	pending: boolean;
	initialLoading: boolean;
	failed: boolean;
};

// Everything the Collections panel renders.
export type HomeCollectionsView = {
	items: Collection[];
	floors: Record<string, HomeMarketSummary>;
	pending: boolean;
	ready: boolean;
	retrying: boolean;
};

export function homeSearchMatches(collections: Collection[], normalizedQuery: string): HomeSearchMatches | null {
	return normalizedQuery
		? new Map(collections.map((collection) => [collection, collectionSearchAssets(collection, normalizedQuery)]))
		: null;
}

// A searched token collection that is only partly loaded, so the search cannot claim to cover every token.
export function homePartialTokenCollection(collections: Collection[], normalizedQuery: string) {
	return normalizedQuery
		? collections.find((collection) => collection.kind === 'tokens' && collection.hasMore)
		: undefined;
}

// Non-token collections matching the search, in the selected order.
export function homeVisibleCollections(
	collections: Collection[],
	normalizedQuery: string,
	matches: HomeSearchMatches | null,
	sort: HomeCollectionSort,
	activityByCollection: Record<string, HomeListingActivity>
) {
	const activity = new Map(Object.entries(activityByCollection));
	return collections
		.filter((collection) => {
			if (collection.kind === 'tokens') return false;
			if (!normalizedQuery) return true;
			return (
				`${collection.name} ${collection.description}`.toLowerCase().includes(normalizedQuery) ||
				Boolean(matches?.get(collection)?.length)
			);
		})
		.sort((left, right) => compareHomeCollections(left, right, sort, activity));
}

// Keeps the stored latest activity unless the new event is strictly newer.
export function recordHomeCollectionActivity(
	current: Record<string, HomeListingActivity>,
	update: { collectionId: string; activity: HomeListingActivity }
) {
	const previous = current[update.collectionId];
	if (
		previous &&
		(previous.height > update.activity.height ||
			(previous.height === update.activity.height && previous.timestamp >= update.activity.timestamp))
	)
		return current;
	return { ...current, [update.collectionId]: update.activity };
}

export function homeCollectionActivityKey(collections: Collection[]) {
	return collections
		.map((collection) => `${collection.id}:${collectionActivityVersion(collection)}`)
		.sort()
		.join('|');
}

// Identifies the visible collections and their loaded assets within one AO routing scope.
export function homeCollectionSummaryKey(collections: Collection[], aoRoutingScope: string) {
	return collections
		.map((collection) => `${collection.id}:${collection.assets.map((asset) => asset.id).join('.')}`)
		.sort()
		.concat(aoRoutingScope)
		.join(',');
}

// The version a collection floor was computed for; a change discards the floor and its scans.
export function homeCollectionSummaryVersion(collection: Collection, aoRoutingScope: string) {
	return `${aoRoutingScope}:${collection.id}:${collection.assets
		.map((asset) => asset.id)
		.sort()
		.join('.')}`;
}

export function homeLiveListingShells(listings: ResolvedAsset[]) {
	return listings.flatMap((result) => homeListingShell(result) ?? []);
}

// Session-cached listing shells overlaid by live ones for the same asset.
export function mergeHomeListingShells(cached: HomeListingShell[], live: HomeListingShell[]) {
	const listings = new Map(cached.map((listing) => [listing.asset.id, listing]));
	for (const listing of live) listings.set(listing.asset.id, listing);
	return [...listings.values()];
}

// Visible listing shells, refreshed with the current collection and any artwork the catalogue has loaded since.
export function homeDisplayListings(shells: HomeListingShell[], collections: Collection[]): HomeDisplayListing[] {
	return shells
		.filter(({ asset, collection }) => isVisibleCollectionId(collection.id) && isVisibleAssetId(asset.id))
		.map(({ asset, collection, activity }) => {
			const currentCollection = collections.find((candidate) => candidate.id === collection.id);
			const currentAsset = currentCollection ? collectionAsset(currentCollection, asset.id) : undefined;
			return {
				asset: currentAsset?.image && !asset.image ? { ...asset, image: currentAsset.image } : asset,
				collection: currentCollection ?? collection,
				activity,
			};
		});
}

export function homeLoadedAssetLimit(collections: Collection[], displayListingCount: number) {
	return collections.reduce((total, collection) => total + collection.assets.length, 0) + displayListingCount;
}

export function homeAssetCandidates(input: {
	collections: Collection[];
	displayListings: HomeDisplayListing[];
	/** Assets already encountered elsewhere in the app, so a Discover card stays findable from Home's search. */
	searchAssets: SearchAsset[];
	verifiedListings: Record<string, AssetSummary[]>;
	normalizedQuery: string;
	assetView: HomeAssetView;
	loadedAssetLimit: number;
	searchMatches: HomeSearchMatches | null;
}): HomeMarketEntry[] {
	if (input.normalizedQuery) {
		return homeSearchAssets(
			input.collections,
			[...input.displayListings, ...input.searchAssets],
			input.normalizedQuery,
			input.loadedAssetLimit,
			input.searchMatches ?? undefined
		);
	}
	return input.assetView === 'all'
		? homeAllAssets(input.collections, input.loadedAssetLimit, input.displayListings)
		: homeDiscoveryAssets(
				input.collections,
				input.verifiedListings,
				HOME_LISTING_ASSET_LIMIT,
				input.displayListings
		  );
}

// Listing shells price their assets until a live summary replaces them; a live failure never hides a shell price.
export function homeDisplayAssetPrices(shells: HomeListingShell[], assetPrices: Record<string, HomeMarketSummary>) {
	const prices: Record<string, HomeMarketSummary> = Object.fromEntries(
		shells.map((listing) => [
			listing.asset.id,
			{ status: 'resolved', value: listing.price } satisfies HomeMarketSummary,
		])
	);
	for (const [assetId, summary] of Object.entries(assetPrices)) {
		if (summary.status === 'resolved') prices[assetId] = summary;
		else if (!prices[assetId]) prices[assetId] = summary;
	}
	return prices;
}

// The newest known listing activity per asset, from verified collection scans and listing shells.
export function homeListingActivityIndex(
	verifiedActivity: Record<string, HomeListingActivity>,
	displayListings: HomeDisplayListing[]
) {
	const indexed = new Map<string, HomeListingActivity>(Object.entries(verifiedActivity));
	for (const result of displayListings) {
		const current = indexed.get(result.asset.id);
		if (
			!current ||
			result.activity.height > current.height ||
			(result.activity.height === current.height && result.activity.timestamp > current.timestamp)
		) {
			indexed.set(result.asset.id, result.activity);
		}
	}
	return indexed;
}

export function homeDisplayedAssets(
	candidates: HomeMarketEntry[],
	prices: Record<string, HomeMarketSummary>,
	assetType: HomeAssetType,
	assetView: HomeAssetView,
	activityByAsset: ReadonlyMap<string, HomeListingActivity>
) {
	const price = (assetId: string) => {
		const summary = prices[assetId];
		if (!summary || summary.status !== 'resolved' || !summary.value) return Number.POSITIVE_INFINITY;
		return homeMarketPriceValue(summary.value);
	};
	return [...candidates]
		.filter(({ asset }) => homeAssetVisibleForView(prices[asset.id], assetView))
		.filter(({ collection }) => homeAssetTypeMatches(collection, assetType))
		.sort((left, right) => {
			if (assetView === 'all') return 0;
			if (assetView === 'listed')
				return compareHomeListingRecency(left.asset.id, right.asset.id, activityByAsset);
			const leftPrice = price(left.asset.id);
			const rightPrice = price(right.asset.id);
			if (Number.isFinite(leftPrice) !== Number.isFinite(rightPrice)) {
				return Number.isFinite(leftPrice) ? -1 : 1;
			}
			return assetView === 'price-low' ? leftPrice - rightPrice : rightPrice - leftPrice;
		});
}

// Splits the displayed assets into the Discover overview, pages, and the assets whose live summaries load.
export function homeDiscoverSelection(input: {
	displayed: HomeMarketEntry[];
	candidates: HomeMarketEntry[];
	assetType: HomeAssetType;
	assetView: HomeAssetView;
	assetPage: number;
	tokenPage: number;
}) {
	const tokens = input.displayed.filter(({ collection }) => collection.kind === 'tokens');
	const collectibles = input.displayed.filter(({ collection }) => collection.kind !== 'tokens');
	const tokenPagination = homeAssetPage(tokens, input.tokenPage, HOME_DISCOVER_TOKEN_PAGE_SIZE);
	const overview = [...tokenPagination.items, ...collectibles.slice(0, 12)];
	const assetPagination = homeAssetPage(input.displayed, input.assetPage);
	const visibleTokens =
		input.assetType === 'all'
			? tokenPagination.items
			: input.assetType === 'tokens'
			? assetPagination.items.filter(({ collection }) => collection.kind === 'tokens')
			: [];
	const summaryAssets =
		input.assetView === 'all' ? (input.assetType === 'all' ? overview : assetPagination.items) : input.candidates;
	// Read what the visitor is looking at first: the current page, then this type's matches, then the rest.
	const summaryPriorityKey = [
		...new Set(
			[
				...(input.assetType === 'all' ? overview : assetPagination.items),
				...summaryAssets.filter(({ collection }) => homeAssetTypeMatches(collection, input.assetType)),
				...summaryAssets,
			].map(({ asset }) => asset.id)
		),
	].join(',');
	return {
		tokens,
		collectibles,
		tokenPagination,
		assetPagination,
		visibleTokenKey: visibleTokens.map(({ asset }) => asset.id).join(','),
		summaryAssets,
		summaryPriorityKey,
	};
}

// Identifies each live listing's state revision so price summaries refresh when a listing's state changes.
export function homePortableStateKey(listings: ResolvedAsset[]) {
	return listings
		.map((result) => `${result.asset.id}:${String(result.state.raw['at-slot'] ?? result.state.swapHeight)}`)
		.join(',');
}

export function homeFailedSummaryIds(ids: string[], summaries: Record<string, HomeMarketSummary>) {
	return ids.filter((id) => summaries[id]?.status === 'unavailable');
}

export function homeSummaryFailures(...summaryGroups: Array<Record<string, HomeMarketSummary>>) {
	return summaryGroups
		.flatMap((summaries) => Object.values(summaries))
		.filter(
			(summary): summary is Extract<HomeMarketSummary, { status: 'unavailable' }> =>
				summary.status === 'unavailable'
		);
}

// Loading, pending, and failure flags for both market tabs, derived from one consistent snapshot.
export function homeMarketProgress(input: {
	tab: HomeTab;
	marketLoading: boolean;
	marketCollectionCount: number;
	collectionIds: string[];
	collectionFloors: Record<string, HomeMarketSummary>;
	failedCollectionCount: number;
	collectionsRetrying: boolean;
	assetIds: string[];
	assetPrices: Record<string, HomeMarketSummary>;
	failedAssetCount: number;
	assetsRetrying: boolean;
	listingsScanning: boolean;
	listingsFailed: boolean;
	summaryFailureCount: number;
	displayedAssetCount: number;
}) {
	const collectionsReady = homeMarketSummariesReady(
		homeMarketShellLoading(input.marketLoading, input.marketCollectionCount),
		input.collectionIds,
		input.collectionFloors
	);
	const collectionsPending = homeMarketHasPending(
		input.marketLoading || input.collectionsRetrying || input.failedCollectionCount > 0,
		input.collectionIds,
		input.collectionFloors
	);
	const discoverPending = homeMarketHasPending(
		input.marketLoading || input.assetsRetrying || input.listingsScanning || input.failedAssetCount > 0,
		input.assetIds,
		input.assetPrices
	);
	return {
		collectionsReady,
		collectionsPending,
		discoverPending,
		discoverFailed: input.listingsFailed || input.summaryFailureCount > 0,
		discoverInitialLoading: homeMarketShowsInitialLoader(discoverPending, input.displayedAssetCount),
		pageRefreshing:
			input.tab === 'discover' ? discoverPending : input.tab === 'collections' ? collectionsPending : false,
	};
}

export function homeTokenPriceChangeTone(change: HomeTokenPriceChange | undefined) {
	if (typeof change !== 'number') return 'muted';
	return change > 0 ? 'positive' : change < 0 ? 'negative' : 'muted';
}
