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
	mergeSearchAssets,
	type SearchAsset,
	storeHiddenCollectionAssetIndex,
	storeMarketShellSnapshot,
} from 'api/collections';
import { CREATED_COLLECTION_ID, loadMintedAssets, loadMintedCollections, type MintedAsset } from 'api/mint';

import { appErrorMessage, toAppError } from 'helpers/app-error';
import { formatMessage } from 'helpers/i18n';
import { scheduleIdleTask } from 'helpers/idle';
import { useAppErrorMessages } from 'hooks/useAppErrorMessage';
import { useMessages } from 'providers/LanguageProvider';

import {
	displayCreatedCollection,
	initialMarketCollections,
	marketCatalogueCollections,
	storedMarketCollections,
	verifiedCollectionIdsFrom,
} from './catalogue';
import { MARKET_PROVIDER_MESSAGES } from './messages';

export type MarketContextValue = {
	collections: Collection[];
	/** Assets encountered outside the catalogue indexes, shared with search so they stay findable. */
	searchAssets: SearchAsset[];
	rememberSearchAssets(assets: SearchAsset[]): void;
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
	searchAssets: [],
	rememberSearchAssets: () => undefined,
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
	const messages = useMessages(MARKET_PROVIDER_MESSAGES);
	const errorMessages = useAppErrorMessages();
	const [marketRetry, setMarketRetry] = React.useState(0);
	const [, setNetworkPolicyRevision] = React.useState(0);
	const [pageRefreshing, setPageRefreshing] = React.useState(false);
	const [market, setMarket] = React.useState<MarketContextValue>(() => ({
		collections: initialMarketCollections(messages),
		searchAssets: [],
		rememberSearchAssets: () => undefined,
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
					collections: current.collections.length ? current.collections : storedMarketCollections(messages),
					visibilityReady: true,
				}));
			},
			(label) => {
				if (controller.signal.aborted) return;
				setMarket((current) => ({
					...current,
					notice: current.notice ?? formatMessage(messages.marketCollectionIndexUnavailable, { label }),
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
								? [displayCreatedCollection(mintedAssets, messages)]
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
							? formatMessage(messages.marketBundledIndexesNotice, {
									collections: unavailable.join(messages.marketCollectionListSeparator),
							  })
							: null,
					};
				});
			},
			(cause) => {
				if (!controller.signal.aborted) {
					const message = appErrorMessage(errorMessages, toAppError(cause, 'collection-indexes-unavailable'));
					setMarket((current) =>
						current.collections.length
							? {
									...current,
									loading: false,
									error: null,
									notice: formatMessage(messages.marketCollectionIndexRefreshFailed, {
										error: message,
									}),
							  }
							: { ...current, loading: false, error: message, notice: null }
					);
				}
			}
		);
		return () => {
			controller.abort();
			stopAoWarmup();
		};
	}, [errorMessages, marketRetry, messages]);
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
	const addCreatedAsset = React.useCallback(
		(asset: MintedAsset) => {
			setMarket((current) => {
				const existing = current.collections.find((item) => item.id === CREATED_COLLECTION_ID);
				const assets = [asset, ...(existing?.assets ?? []).filter((item) => item.id !== asset.id)];
				const created = displayCreatedCollection(assets, messages);
				return {
					...current,
					collections: marketCatalogueCollections(
						existing
							? current.collections.map((item) => (item.id === CREATED_COLLECTION_ID ? created : item))
							: [...current.collections, created]
					),
				};
			});
		},
		[messages]
	);
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
	const rememberSearchAssets = React.useCallback((assets: SearchAsset[]) => {
		if (!assets.length) return;
		setMarket((current) => ({ ...current, searchAssets: mergeSearchAssets(current.searchAssets, assets) }));
	}, []);
	const retry = React.useCallback(() => setMarketRetry((current) => current + 1), []);
	const value = React.useMemo(
		() => ({
			...market,
			pageRefreshing,
			loadMore,
			addCreatedAsset,
			addCollection,
			rememberSearchAssets,
			setPageRefreshing,
			retry,
		}),
		[addCollection, addCreatedAsset, loadMore, market, pageRefreshing, rememberSearchAssets, retry]
	);

	return <MarketContext.Provider value={value}>{props.children}</MarketContext.Provider>;
}
