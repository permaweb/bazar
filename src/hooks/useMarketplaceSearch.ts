import React from 'react';

import {
	type AssetSummary,
	type Collection,
	collectionKindLabel,
	collectionSearchAssets,
	directTokenSearchCollection,
	interleaveCollectionAssets,
	isVisibleAssetId,
	isVisibleCollectionId,
	marketplaceAssetMatchesSearch,
	searchResultScore,
} from 'api/collections';
import { searchBazarAtomicAssetsByName } from 'api/discovery';
import { prefetchAssetPage } from 'api/marketplace';

import { toAppError } from 'helpers/app-error';
import { asyncData, type AsyncState, IDLE, isAsyncPending, LOADING } from 'helpers/async-state';
import { useMarketProvider } from 'providers/MarketProvider';

const INDEX_SEARCH_DEBOUNCE_MS = 250;
const COLLECTION_RESULT_LIMIT = 6;
const ASSET_RESULT_LIMIT = 8;

export type MarketplaceSearchScope = 'all' | 'collections' | 'tokens' | 'assets' | 'names';

export type MarketplaceSearchResult = { asset: AssetSummary; collection: Collection };

export type MarketplaceCollectionResult = { collection: Collection; kindLabel: string };

/** The permanent creation-record index search: not needed for this query and scope, running, failed, or settled. */
export type MarketplaceIndexSearchStatus = 'inactive' | 'pending' | 'failed' | 'settled';

export type MarketplaceSearch = {
	collectionResults: MarketplaceCollectionResult[];
	tokenResults: MarketplaceSearchResult[];
	collectibleResults: MarketplaceSearchResult[];
	/** The token collection to check `query` against as a process ID, when no loaded result already matches it. */
	directTokenCollection: Collection | undefined;
	/** A token collection with more records than are loaded, so token matches may be incomplete. */
	partialTokenCollection: Collection | undefined;
	indexSearch: MarketplaceIndexSearchStatus;
	/** Warms an asset page's data and code before the user opens it. */
	prefetchAsset(assetId: string, fungible: boolean): void;
};

type IndexSearchState = { query: string; state: AsyncState<MarketplaceSearchResult[]> };

/**
 * Searches the loaded marketplace catalogue and, for asset scopes, the permanent Bazar creation-record index.
 * Catalogue matching follows React's deferred query; the index search is debounced and only the latest query's
 * response is kept.
 */
export function useMarketplaceSearch(options: {
	open: boolean;
	query: string;
	scope: MarketplaceSearchScope;
}): MarketplaceSearch {
	const market = useMarketProvider();
	const normalizedQuery = options.query.trim().toLowerCase();
	const deferredQuery = React.useDeferredValue(options.query.trim());
	const deferredNormalizedQuery = deferredQuery.toLowerCase();
	const [indexSearch, setIndexSearch] = React.useState<IndexSearchState>({ query: '', state: IDLE });
	const shouldSearchIndex =
		options.open && Boolean(deferredNormalizedQuery) && searchScopeIncludesIndexedAssets(options.scope);

	React.useEffect(() => {
		if (!shouldSearchIndex || !market.visibilityReady) {
			setIndexSearch({ query: deferredNormalizedQuery, state: IDLE });
			return;
		}
		const controller = new AbortController();
		const requestedQuery = deferredNormalizedQuery;
		setIndexSearch({ query: requestedQuery, state: LOADING });
		const timer = window.setTimeout(() => {
			void searchBazarAtomicAssetsByName(deferredQuery, { signal: controller.signal }).then(
				(results) => {
					if (!controller.signal.aborted) {
						setIndexSearch({ query: requestedQuery, state: { status: 'success', data: results } });
					}
				},
				(cause) => {
					if (!controller.signal.aborted) {
						setIndexSearch({
							query: requestedQuery,
							state: { status: 'error', error: toAppError(cause, 'index-unavailable') },
						});
					}
				}
			);
		}, INDEX_SEARCH_DEBOUNCE_MS);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [deferredNormalizedQuery, deferredQuery, market.visibilityReady, shouldSearchIndex]);

	const indexSearchCurrent = shouldSearchIndex && indexSearch.query === deferredNormalizedQuery;
	const indexSearchStatus: MarketplaceIndexSearchStatus = !shouldSearchIndex
		? 'inactive'
		: !indexSearchCurrent || isAsyncPending(indexSearch.state)
		? 'pending'
		: indexSearch.state.status === 'error'
		? 'failed'
		: 'settled';
	const indexResults = indexSearchCurrent ? asyncData(indexSearch.state) : undefined;

	const relevantCollections = React.useMemo(
		() => scopedSearchCollections(market.collections, options.scope),
		[market.collections, options.scope]
	);
	const localMatches = React.useMemo(
		() =>
			new Map(
				relevantCollections.map((collection) => [
					collection,
					collectionSearchAssets(collection, deferredNormalizedQuery),
				])
			),
		[deferredNormalizedQuery, relevantCollections]
	);
	const collectionResults = React.useMemo(
		() =>
			(options.scope === 'assets' || options.scope === 'tokens'
				? []
				: relevantCollections
						.filter((collection) => collection.kind !== 'tokens')
						.filter(
							(collection) =>
								!deferredNormalizedQuery ||
								`${collection.name} ${collection.description}`
									.toLowerCase()
									.includes(deferredNormalizedQuery) ||
								Boolean(localMatches.get(collection)?.length)
						)
						.slice(0, COLLECTION_RESULT_LIMIT)
			).map((collection) => ({ collection, kindLabel: collectionKindLabel(collection) })),
		[deferredNormalizedQuery, localMatches, options.scope, relevantCollections]
	);
	const searchableCollections = React.useMemo(
		() => (options.scope === 'collections' ? [] : relevantCollections),
		[options.scope, relevantCollections]
	);
	const localAssetResults = React.useMemo(
		() => rankedLocalAssetResults(searchableCollections, localMatches, deferredNormalizedQuery),
		[deferredNormalizedQuery, localMatches, searchableCollections]
	);
	const assetResults = React.useMemo(
		() => mergedAssetResults(localAssetResults, indexResults ?? [], deferredNormalizedQuery),
		[deferredNormalizedQuery, indexResults, localAssetResults]
	);
	const tokenScope = options.scope !== 'collections' && options.scope !== 'assets' && options.scope !== 'names';
	const directTokenCollection = tokenScope
		? directTokenSearchCollection(market.collections, options.query)
		: undefined;
	const directTokenProcess =
		directTokenCollection && !assetResults.some((result) => result.asset.id === options.query.trim());
	const prefetchAsset = React.useCallback((assetId: string, fungible: boolean) => {
		prefetchAssetPage(assetId, fungible);
	}, []);

	return {
		collectionResults,
		tokenResults: assetResults.filter((result) => result.collection.kind === 'tokens'),
		collectibleResults: assetResults.filter((result) => result.collection.kind !== 'tokens'),
		directTokenCollection: directTokenProcess ? directTokenCollection : undefined,
		partialTokenCollection:
			normalizedQuery && tokenScope
				? market.collections.find((collection) => collection.kind === 'tokens' && collection.hasMore)
				: undefined,
		indexSearch: indexSearchStatus,
		prefetchAsset,
	};
}

function searchScopeIncludesIndexedAssets(scope: MarketplaceSearchScope): boolean {
	return scope !== 'collections' && scope !== 'tokens' && scope !== 'names';
}

export function scopedSearchCollections(collections: Collection[], scope: MarketplaceSearchScope): Collection[] {
	return collections.filter((collection) =>
		scope === 'names'
			? collection.kind === 'names'
			: scope === 'tokens'
			? collection.kind === 'tokens'
			: scope === 'assets'
			? collection.kind !== 'tokens'
			: true
	);
}

/**
 * The best catalogue matches for a query, or, with no query, a mix of each collection's assets that have artwork
 * (names and tokens always qualify).
 */
export function rankedLocalAssetResults(
	collections: Collection[],
	matches: Map<Collection, AssetSummary[]>,
	query: string
): MarketplaceSearchResult[] {
	if (!query) {
		return interleaveCollectionAssets(
			collections,
			ASSET_RESULT_LIMIT,
			(asset, collection) =>
				Boolean(asset.image || asset.media) || collection.kind === 'names' || collection.kind === 'tokens'
		);
	}
	return collections
		.flatMap((collection) => (matches.get(collection) ?? []).map((asset) => ({ asset, collection })))
		.filter((result) => marketplaceAssetMatchesSearch(result.asset, result.collection, query))
		.sort((left, right) => searchResultScore(right, query) - searchResultScore(left, query))
		.slice(0, ASSET_RESULT_LIMIT);
}

/** Visible catalogue and index results, deduplicated by asset and ranked together. */
export function mergedAssetResults(
	localResults: MarketplaceSearchResult[],
	indexResults: MarketplaceSearchResult[],
	query: string
): MarketplaceSearchResult[] {
	return [...localResults, ...indexResults]
		.filter((result) => isVisibleCollectionId(result.collection.id) && isVisibleAssetId(result.asset.id))
		.filter(
			(result, index, results) =>
				results.findIndex((candidate) => candidate.asset.id === result.asset.id) === index
		)
		.sort((left, right) => searchResultScore(right, query) - searchResultScore(left, query))
		.slice(0, ASSET_RESULT_LIMIT);
}
