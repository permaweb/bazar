import React from 'react';

import type { Collection } from 'api/collections';

import { aoRoutingScopeFromLocation, arweaveGraphqlEndpoint } from 'helpers/config';
import { useMessages } from 'providers/LanguageProvider';
import { useMarketProvider } from 'providers/MarketProvider';

import { HOME_MESSAGES } from '../messages';
import { type HomeListingFailure, homeListingScanFailure } from '../model/home-listing-scan';
import {
	type HomeAssetType,
	type HomeAssetView,
	homeCollectionDescription,
	type HomeCollectionSort,
	type HomeTab,
	shouldLoadHomeAssetSummaries,
	shouldLoadHomeCollectionSummaries,
} from '../model/home-market';
import { EMPTY_HOME_MARKET_SUMMARIES, homeMarketSummariesReducer } from '../model/home-market-summaries';
import {
	homeAssetCandidates,
	homeCollectionSummaryKey,
	type HomeCollectionsView,
	homeDiscoverSelection,
	type HomeDiscoverView,
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
	homeSearchMatches,
	homeSummaryFailures,
	homeVisibleCollections,
	mergeHomeListingShells,
	recordHomeCollectionActivity,
} from '../model/home-market-view';

import { useHomeAssetSummaries } from './useHomeAssetSummaries';
import { useHomeCollectionActivity } from './useHomeCollectionActivity';
import { useHomeCollectionSummaries } from './useHomeCollectionSummaries';
import { useHomeListingScan, useHomeListingScanStore } from './useHomeListingScan';
import { useHomeSummaryRetry } from './useHomeSummaryRetry';
import { useHomeTokenPriceChanges } from './useHomeTokenPriceChanges';

export type HomeMarketData = {
	normalizedQuery: string;
	assetType: HomeAssetType;
	assetView: HomeAssetView;
	collectionSort: HomeCollectionSort;
	setAssetType(assetType: HomeAssetType): void;
	setAssetView(assetView: HomeAssetView): void;
	setCollectionSort(sort: HomeCollectionSort): void;
	setAssetPage(page: number): void;
	setTokenPage(page: number): void;
	partialTokenCollection: Collection | undefined;
	listingFailure: HomeListingFailure | undefined;
	retryListings(): void;
	discover: HomeDiscoverView;
	collections: HomeCollectionsView;
};

/**
 * The Home market's Discover and Collections data: search and filters over the market catalogue, the live listing
 * scan, per-asset prices, per-collection floors, 24-hour token changes, and automatic summary retries. Only the
 * active tab's loaders run; their results persist across tab switches.
 */
export function useHomeMarket(tab: HomeTab, query: string): HomeMarketData {
	const market = useMarketProvider();
	const messages = useMessages(HOME_MESSAGES);
	const setPageRefreshing = market.setPageRefreshing;
	const [assetType, setAssetType] = React.useState<HomeAssetType>('all');
	const [assetView, setAssetView] = React.useState<HomeAssetView>('listed');
	const [collectionSort, setCollectionSort] = React.useState<HomeCollectionSort>('recent');
	const [assetPage, setAssetPage] = React.useState(1);
	const [tokenPage, setTokenPage] = React.useState(1);
	const aoRoutingScope = aoRoutingScopeFromLocation();
	const snapshotScope = `${arweaveGraphqlEndpoint()}|${aoRoutingScope}`;
	const normalizedQuery = query.trim().toLowerCase();
	const loadsAssetSummaries = shouldLoadHomeAssetSummaries(tab);
	const loadsCollectionSummaries = shouldLoadHomeCollectionSummaries(tab);

	// Remote state the loaders below fill in.
	const [listingScan, dispatchListingScan] = useHomeListingScanStore(snapshotScope);
	const [summaries, dispatchSummary] = React.useReducer(homeMarketSummariesReducer, EMPTY_HOME_MARKET_SUMMARIES);
	const [collectionActivity, recordCollectionActivity] = React.useReducer(recordHomeCollectionActivity, {});

	const searchMatches = React.useMemo(
		() => homeSearchMatches(market.collections, normalizedQuery),
		[market.collections, normalizedQuery]
	);
	const partialTokenCollection = React.useMemo(
		() => homePartialTokenCollection(market.collections, normalizedQuery),
		[market.collections, normalizedQuery]
	);
	const describeCollection = React.useCallback(
		(collection: Collection) => homeCollectionDescription(collection, messages),
		[messages]
	);
	const collections = React.useMemo(
		() =>
			homeVisibleCollections(
				market.collections,
				normalizedQuery,
				searchMatches,
				collectionSort,
				collectionActivity,
				describeCollection
			),
		[collectionActivity, collectionSort, describeCollection, searchMatches, market.collections, normalizedQuery]
	);
	const liveShells = React.useMemo(() => homeLiveListingShells(listingScan.listings), [listingScan.listings]);
	const listingShells = React.useMemo(
		() => mergeHomeListingShells(listingScan.cached, liveShells),
		[listingScan.cached, liveShells]
	);
	const displayListings = React.useMemo(
		() => homeDisplayListings(listingShells, market.collections),
		[listingShells, market.collections]
	);
	const rememberSearchAssets = market.rememberSearchAssets;
	// Listings shown on Discover stay searchable from the header and from Home, without any catalogue-wide fetch.
	React.useEffect(() => rememberSearchAssets(displayListings), [displayListings, rememberSearchAssets]);
	const loadedAssetLimit = React.useMemo(
		() => homeLoadedAssetLimit(market.collections, displayListings.length),
		[displayListings.length, market.collections]
	);
	const candidates = React.useMemo(
		() =>
			homeAssetCandidates({
				collections: market.collections,
				displayListings,
				searchAssets: market.searchAssets,
				verifiedListings: summaries.verifiedListings,
				normalizedQuery,
				assetView,
				loadedAssetLimit,
				searchMatches,
			}),
		[
			assetView,
			displayListings,
			loadedAssetLimit,
			market.collections,
			market.searchAssets,
			normalizedQuery,
			searchMatches,
			summaries.verifiedListings,
		]
	);
	const displayPrices = React.useMemo(
		() => homeDisplayAssetPrices(listingShells, summaries.assetPrices),
		[listingShells, summaries.assetPrices]
	);
	const listingActivityByAsset = React.useMemo(
		() => homeListingActivityIndex(summaries.verifiedActivity, displayListings),
		[displayListings, summaries.verifiedActivity]
	);
	const displayed = React.useMemo(
		() => homeDisplayedAssets(candidates, displayPrices, assetType, assetView, listingActivityByAsset),
		[assetType, assetView, candidates, displayPrices, listingActivityByAsset]
	);
	const selection = homeDiscoverSelection({ displayed, candidates, assetType, assetView, assetPage, tokenPage });
	const summaryAssetKey = selection.summaryAssets.map(({ asset }) => asset.id).join(',');
	const listingById = React.useMemo(
		() => new Map(listingScan.listings.map((result) => [result.asset.id, result])),
		[listingScan.listings]
	);
	const listingStateKey = React.useMemo(() => homePortableStateKey(listingScan.listings), [listingScan.listings]);
	const collectionKey = React.useMemo(
		() => homeCollectionSummaryKey(collections, aoRoutingScope),
		[aoRoutingScope, collections]
	);
	const listingFailure = homeListingScanFailure(listingScan);
	const failedAssetIds = homeFailedSummaryIds(
		selection.summaryAssets.map(({ asset }) => asset.id),
		summaries.assetPrices
	);
	const failedCollectionIds = homeFailedSummaryIds(
		collections.map((collection) => collection.id),
		summaries.collectionFloors
	);

	// Loaders, declared in the order their requests start.
	const tokenPriceChanges = useHomeTokenPriceChanges({
		active: loadsAssetSummaries,
		tokenKey: selection.visibleTokenKey,
		scope: snapshotScope,
	});
	const listingScanner = useHomeListingScan({
		dispatch: dispatchListingScan,
		liveShells,
		complete: listingScan.status.status === 'complete',
		active: market.collections.length > 0 && loadsAssetSummaries && !market.error,
		aoRoutingScope,
		collections: market.collections,
		snapshotScope,
		visibilityReady: market.visibilityReady,
	});
	const summaryRetry = useHomeSummaryRetry({ failedAssetIds, failedCollectionIds, listingFailure });
	useHomeAssetSummaries({
		active: loadsAssetSummaries,
		assets: selection.summaryAssets,
		assetKey: summaryAssetKey,
		priorityKey: selection.summaryPriorityKey,
		assetPrices: summaries.assetPrices,
		listingById,
		listingStateKey,
		dispatch: dispatchSummary,
		retry: summaryRetry,
	});
	useHomeCollectionSummaries({
		active: loadsCollectionSummaries,
		collections,
		collectionKey,
		aoRoutingScope,
		collectionFloors: summaries.collectionFloors,
		dispatch: dispatchSummary,
		retry: summaryRetry,
	});
	useHomeCollectionActivity({
		active: loadsCollectionSummaries && collectionSort === 'recent',
		collections,
		onActivity: recordCollectionActivity,
	});

	// A new filter or search starts from the first page; a shrinking result set clamps the page.
	React.useEffect(() => setAssetPage(1), [assetType, assetView, normalizedQuery]);
	React.useEffect(() => setTokenPage(1), [assetType, assetView, normalizedQuery]);
	React.useEffect(() => {
		if (assetPage !== selection.assetPagination.page) setAssetPage(selection.assetPagination.page);
	}, [assetPage, selection.assetPagination.page]);
	React.useEffect(() => {
		if (tokenPage !== selection.tokenPagination.page) setTokenPage(selection.tokenPagination.page);
	}, [tokenPage, selection.tokenPagination.page]);

	const progress = homeMarketProgress({
		tab,
		marketLoading: market.loading,
		marketCollectionCount: market.collections.length,
		collectionIds: collections.map((collection) => collection.id),
		collectionFloors: summaries.collectionFloors,
		failedCollectionCount: failedCollectionIds.length,
		collectionsRetrying: summaryRetry.collectionsRetrying,
		assetIds: selection.summaryAssets.map(({ asset }) => asset.id),
		assetPrices: summaries.assetPrices,
		failedAssetCount: failedAssetIds.length,
		assetsRetrying: summaryRetry.assetsRetrying,
		listingsScanning: listingScan.status.status === 'scanning',
		listingsFailed: Boolean(listingFailure),
		summaryFailureCount: homeSummaryFailures(summaries.assetPrices, summaries.collectionFloors).length,
		displayedAssetCount: displayed.length,
	});
	React.useEffect(() => {
		setPageRefreshing(progress.pageRefreshing);
		return () => setPageRefreshing(false);
	}, [progress.pageRefreshing, setPageRefreshing]);

	return {
		normalizedQuery,
		assetType,
		assetView,
		collectionSort,
		setAssetType,
		setAssetView,
		setCollectionSort,
		setAssetPage,
		setTokenPage,
		partialTokenCollection,
		listingFailure,
		retryListings: listingScanner.retry,
		discover: {
			displayed,
			tokens: selection.tokens,
			collectibles: selection.collectibles,
			tokenPagination: selection.tokenPagination,
			assetPagination: selection.assetPagination,
			prices: displayPrices,
			images: summaries.assetImages,
			tokenPriceChanges,
			pending: progress.discoverPending,
			initialLoading: progress.discoverInitialLoading,
			failed: progress.discoverFailed,
		},
		collections: {
			items: collections,
			floors: summaries.collectionFloors,
			pending: progress.collectionsPending,
			ready: progress.collectionsReady,
			retrying: summaryRetry.collectionsRetrying,
		},
	};
}
