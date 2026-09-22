import React from 'react';

import { warmAoFetch } from 'api/ao';
import {
	type Collection,
	hiddenCollectionAssetIndex,
	hiddenCollectionAssetIndexComplete,
	loadCollections,
	loadMoreCarrierNames,
	loadMoreFungibleTokens,
	mergeCollectionSnapshots,
	storeHiddenCollectionAssetIndex,
	storeMarketShellSnapshot,
} from 'api/collections';
import {
	CREATED_COLLECTION_ID,
	createdCollection,
	loadMintedAssets,
	loadMintedCollections,
	type MintedAsset,
} from 'api/mint';

import { scheduleIdleTask } from 'helpers/idle';
import { marketplaceErrorMessage as errorMessage } from 'helpers/marketplace-error';

import {
	initialMarketCollections,
	marketCatalogueCollections,
	storedMarketCollections,
	verifiedCollectionIdsFrom,
} from './catalogue';

export type MarketContextValue = {
	collections: Collection[];
	verifiedCollectionIds: ReadonlySet<string>;
	visibilityReady: boolean;
	loading: boolean;
	error: string | null;
	notice: string | null;
	pageRefreshing: boolean;
	loadMore(collectionId: string, signal?: AbortSignal): Promise<number>;
	addCreatedAsset(asset: MintedAsset): void;
	addCollection(collection: Collection): void;
	setPageRefreshing(refreshing: boolean): void;
	retry(): void;
};

export const MarketContext = React.createContext<MarketContextValue>({
	collections: [],
	verifiedCollectionIds: new Set(),
	visibilityReady: false,
	loading: true,
	error: null,
	notice: null,
	pageRefreshing: false,
	loadMore: async () => 0,
	addCreatedAsset: () => undefined,
	addCollection: () => undefined,
	setPageRefreshing: () => undefined,
	retry: () => undefined,
});

export function useMarketProvider(): MarketContextValue {
	return React.useContext(MarketContext);
}

export default function MarketProvider(props: { children: React.ReactNode }) {
	const [marketRetry, setMarketRetry] = React.useState(0);
	const [, setNetworkPolicyRevision] = React.useState(0);
	const [pageRefreshing, setPageRefreshing] = React.useState(false);
	const [market, setMarket] = React.useState<MarketContextValue>(() => ({
		collections: initialMarketCollections(),
		verifiedCollectionIds: new Set(),
		visibilityReady: hiddenCollectionAssetIndexComplete(),
		loading: true,
		error: null,
		notice: null,
		pageRefreshing: false,
		loadMore: async () => 0,
		addCreatedAsset: () => undefined,
		addCollection: () => undefined,
		setPageRefreshing: () => undefined,
		retry: () => undefined,
	}));
	React.useEffect(() => {
		if (!market.collections.length) return;
		return scheduleIdleTask(() => storeMarketShellSnapshot(window.localStorage, market.collections), 750);
	}, [market.collections]);
	React.useEffect(() => {
		const controller = new AbortController();
		setMarket((current) => ({ ...current, verifiedCollectionIds: new Set(), loading: true, error: null }));
		const stopAoWarmup = warmAoFetch(() => {
			if (!controller.signal.aborted) setNetworkPolicyRevision((revision) => revision + 1);
		});
		void loadCollections(
			controller.signal,
			(collections) => {
				if (!controller.signal.aborted) {
					setMarket((current) => ({
						...current,
						collections: marketCatalogueCollections(
							mergeCollectionSnapshots(current.collections, collections)
						),
						verifiedCollectionIds: new Set([
							...current.verifiedCollectionIds,
							...verifiedCollectionIdsFrom(collections),
						]),
					}));
				}
			},
			() => {
				if (controller.signal.aborted) return;
				storeHiddenCollectionAssetIndex(window.localStorage, hiddenCollectionAssetIndex());
				setMarket((current) => ({
					...current,
					collections: current.collections.length ? current.collections : storedMarketCollections(),
					visibilityReady: true,
				}));
			},
			(label) => {
				if (controller.signal.aborted) return;
				setMarket((current) => ({
					...current,
					notice:
						current.notice ?? `${label} is unavailable. Loaded gateway-backed collections remain usable.`,
				}));
			}
		).then(
			({ collections, unavailable }) => {
				if (controller.signal.aborted) return;
				const mintedAssets = loadMintedAssets();
				const localCollections = loadMintedCollections();
				setMarket((current) => {
					const resolved = mergeCollectionSnapshots(current.collections, collections, true);
					const known = new Set(resolved.map((collection) => collection.id));
					return {
						...current,
						collections: marketCatalogueCollections([
							...resolved,
							...localCollections.filter((collection) => !known.has(collection.id)),
							...(mintedAssets.length && !known.has(CREATED_COLLECTION_ID)
								? [createdCollection(mintedAssets)]
								: []),
						]),
						verifiedCollectionIds: new Set([
							...current.verifiedCollectionIds,
							...verifiedCollectionIdsFrom(collections),
							...localCollections.map((collection) => collection.id),
						]),
						loading: false,
						error: null,
						notice: unavailable.length
							? `The latest Arweave references for ${unavailable.join(
									', '
							  )} could not be checked. Showing their bundled immutable indexes; ownership, listings, and prices are still read from live state.`
							: null,
					};
				});
			},
			(error) => {
				if (!controller.signal.aborted) {
					setMarket((current) =>
						current.collections.length
							? {
									...current,
									loading: false,
									error: null,
									notice: `Collection indexes could not be refreshed: ${errorMessage(
										error
									)}. Previously loaded collections remain available.`,
							  }
							: { ...current, loading: false, error: errorMessage(error), notice: null }
					);
				}
			}
		);
		return () => {
			controller.abort();
			stopAoWarmup();
		};
	}, [marketRetry]);
	const loadMore = React.useCallback(
		async (collectionId: string, signal?: AbortSignal) => {
			const collection = market.collections.find((item) => item.id === collectionId);
			if (!collection) return 0;
			const updated =
				collection.kind === 'tokens'
					? await loadMoreFungibleTokens(collection, signal)
					: await loadMoreCarrierNames(collection, signal);
			const previous = new Set(collection.assets.map((asset) => asset.id));
			const added = updated.assets.filter((asset) => !previous.has(asset.id)).length;
			setMarket((current) => ({
				...current,
				collections: marketCatalogueCollections(
					current.collections.map((item) => {
						if (item.id !== collectionId) return item;
						const seen = new Set(item.assets.map((asset) => asset.id));
						const additions = updated.assets.filter((asset) => !seen.has(asset.id));
						return {
							...item,
							...updated,
							assets: [...item.assets, ...additions],
						};
					})
				),
			}));
			return added;
		},
		[market.collections]
	);
	const addCreatedAsset = React.useCallback((asset: MintedAsset) => {
		setMarket((current) => {
			const existing = current.collections.find((item) => item.id === CREATED_COLLECTION_ID);
			const assets = [asset, ...(existing?.assets ?? []).filter((item) => item.id !== asset.id)];
			const created = createdCollection(assets);
			return {
				...current,
				collections: marketCatalogueCollections(
					existing
						? current.collections.map((item) => (item.id === CREATED_COLLECTION_ID ? created : item))
						: [...current.collections, created]
				),
			};
		});
	}, []);
	const addCollection = React.useCallback((collection: Collection) => {
		setMarket((current) => ({
			...current,
			collections: marketCatalogueCollections([
				collection,
				...current.collections.filter((item) => item.id !== collection.id),
			]),
			verifiedCollectionIds: new Set([...current.verifiedCollectionIds, collection.id]),
		}));
	}, []);
	const retry = React.useCallback(() => setMarketRetry((current) => current + 1), []);
	const value = React.useMemo(
		() => ({ ...market, pageRefreshing, loadMore, addCreatedAsset, addCollection, setPageRefreshing, retry }),
		[addCollection, addCreatedAsset, loadMore, market, pageRefreshing, retry]
	);

	return <MarketContext.Provider value={value}>{props.children}</MarketContext.Provider>;
}
