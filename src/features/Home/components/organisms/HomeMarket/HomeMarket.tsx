import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Compass, History, LayoutGrid } from 'lucide-react';

import {
	type AssetSummary,
	collectionAsset,
	collectionSearchAssets,
	type HomeListingShell,
	isVisibleAssetId,
	isVisibleCollectionId,
	loadHomeListingSnapshot,
	storeHomeListingSnapshot,
} from 'api/collections';
import {
	type AssetCandidate,
	createAssetCandidateResolver,
	discoverCollectionActivity,
	discoverCollectionActivityBatched,
	discoverMarketActivity,
	discoverMarketActivityBatched,
	isLiveListing,
	partitionAssetCandidateSupport,
	type ResolvedAsset,
	verifyAssetCandidateSupport,
} from 'api/discovery';
import { type AssetState, bestAskOfAsset, prefetchAssetPage, readAssetStateCached } from 'api/marketplace';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { BazarMark } from 'components/atoms/BazarMark';
import { Button } from 'components/atoms/Button';
import { Eyebrow } from 'components/atoms/Eyebrow';
import { Icon } from 'components/atoms/Icon';
import { Loading } from 'components/atoms/Loading';
import { NamesCubePreview } from 'components/atoms/NamesCubePreview';
import { Select } from 'components/atoms/Select';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { VisuallyHidden } from 'components/atoms/VisuallyHidden';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import { Pagination } from 'components/molecules/Pagination';
import { TokenMarketRow } from 'components/molecules/TokenMarketRow';
import { collectionActivityVersion, collectionCandidateMembership } from 'features/Activity';
import { DiscoveryAssetArtwork, homeListingShell, orderPriceLabel, unitPriceWinston } from 'features/Catalogue';
import { ListingResolutionOutcome } from 'features/Collection';
import { createAnimationFrameBatch } from 'helpers/animation-frame-batch';
import { mapConcurrent } from 'helpers/concurrency';
import { aoRoutingScopeFromLocation, arweaveGraphqlEndpoint } from 'helpers/config';
import { short } from 'helpers/format';
import { scheduleIdleTask } from 'helpers/idle';
import {
	type MarketplaceFailureKind,
	marketplaceFailureKind,
	marketplaceRequestFailureMessage,
} from 'helpers/marketplace-error';
import { useMarketProvider } from 'providers/MarketProvider';

import {
	commitHomeActivityBatch,
	commitHomeFloorResult,
	compareHomeCollections,
	compareHomeListingRecency,
	completeHomeActivityScan,
	completeHomeSummaryRetryGroup,
	HOME_ASSET_PAGE_SIZE,
	HOME_DISCOVER_TOKEN_PAGE_SIZE,
	HOME_LISTING_ASSET_LIMIT,
	HOME_LISTING_SNAPSHOT_MAX_AGE_MS,
	HOME_STATE_MAX_AGE,
	HOME_STATE_STALE_WHILE_REVALIDATE,
	HomeActivityScan,
	homeAllAssets,
	homeAssetPage,
	HomeAssetType,
	homeAssetTypeMatches,
	HomeAssetView,
	homeAssetVisibleForView,
	homeCollectionAssetCountLabel,
	HomeCollectionSort,
	homeDiscoveryAssets,
	homeFloorCandidateNeedsResolution,
	HomeFloorScan,
	homeFloorScanSummary,
	HomeListingActivity,
	HomeListingComputeCircuit,
	homeListingComputeFailure,
	homeListingSupportVersion,
	homeMarketHasPending,
	homeMarketPriceValue,
	homeMarketShellLoading,
	homeMarketShowsInitialLoader,
	homeMarketSummariesReady,
	HomeMarketSummary,
	homeMarketSummaryLabel,
	homeMarketSummaryListed,
	homeRouteSearch,
	homeSearchAssets,
	homeSummaryRequestKeys,
	HomeSummaryRetryRun,
	HomeTab,
	homeTabFromPathname,
	homeTabPath,
	homeTokenPriceChangeLabel,
	homeTokenPriceChangePercent,
	pendingHomeActivityRecipients,
	publishHomeListingResult,
	reconcileHomeActivityScan,
	reconcileHomeFloorScan,
	reconcileHomeListingAssets,
	recordHomeListingComputeResult,
	shouldLoadHomeAssetSummaries,
	shouldLoadHomeCollectionSummaries,
} from '../../../model/home-market';
import { HomeMarketGhostCard } from '../../molecules/HomeMarketGhostCard';
import { HomePendingMarketValue } from '../../molecules/HomePendingMarketValue';
import { HomeActivityPanel } from '../HomeActivityPanel';

export default function HomeMarket() {
	const market = useMarketProvider();
	const location = useLocation();
	const navigate = useNavigate();
	const { search } = location;
	const marketPaneRef = React.useRef<HTMLDivElement>(null);
	const homeTab = homeTabFromPathname(location.pathname);
	const [assetType, setAssetType] = React.useState<HomeAssetType>('all');
	const [assetView, setAssetView] = React.useState<HomeAssetView>('listed');
	const [collectionSort, setCollectionSort] = React.useState<HomeCollectionSort>('recent');
	const [collectionActivity, setCollectionActivity] = React.useState<Record<string, HomeListingActivity>>({});
	const [assetPage, setAssetPage] = React.useState(1);
	const [discoverTokenPage, setDiscoverTokenPage] = React.useState(1);
	const aoRoutingScope = aoRoutingScopeFromLocation();
	const homeListingSnapshotScope = `${arweaveGraphqlEndpoint()}|${aoRoutingScope}`;
	const query = new URLSearchParams(search).get('q') ?? '';
	const normalizedQuery = query.trim().toLowerCase();
	const homeSearchMatches = React.useMemo(
		() =>
			normalizedQuery
				? new Map(
						market.collections.map((collection) => [
							collection,
							collectionSearchAssets(collection, normalizedQuery),
						])
				  )
				: null,
		[market.collections, normalizedQuery]
	);
	const partialTokenCollection = React.useMemo(
		() =>
			normalizedQuery
				? market.collections.find((collection) => collection.kind === 'tokens' && collection.hasMore)
				: undefined,
		[market.collections, normalizedQuery]
	);
	const collections = React.useMemo(() => {
		const activity = new Map(Object.entries(collectionActivity));
		return market.collections
			.filter((collection) => {
				if (collection.kind === 'tokens') return false;
				if (!normalizedQuery) return true;
				return (
					`${collection.name} ${collection.description}`.toLowerCase().includes(normalizedQuery) ||
					Boolean(homeSearchMatches?.get(collection)?.length)
				);
			})
			.sort((left, right) => compareHomeCollections(left, right, collectionSort, activity));
	}, [collectionActivity, collectionSort, homeSearchMatches, market.collections, normalizedQuery]);
	const [verifiedHomeListings, setVerifiedHomeListings] = React.useState<Record<string, AssetSummary[]>>({});
	const [verifiedHomeListingActivity, setVerifiedHomeListingActivity] = React.useState<
		Record<string, HomeListingActivity>
	>({});
	const [portableHomeListings, setPortableHomeListings] = React.useState<ResolvedAsset[]>([]);
	const [cachedHomeListings, setCachedHomeListings] = React.useState<HomeListingShell[]>(() =>
		loadHomeListingSnapshot(window.sessionStorage, homeListingSnapshotScope, HOME_LISTING_SNAPSHOT_MAX_AGE_MS)
	);
	React.useEffect(() => {
		setCachedHomeListings(
			loadHomeListingSnapshot(window.sessionStorage, homeListingSnapshotScope, HOME_LISTING_SNAPSHOT_MAX_AGE_MS)
		);
	}, [homeListingSnapshotScope, market.visibilityReady]);
	const liveHomeListingShells = React.useMemo(
		() => portableHomeListings.flatMap((result) => homeListingShell(result) ?? []),
		[portableHomeListings]
	);
	const homeListingShells = React.useMemo(() => {
		const listings = new Map(cachedHomeListings.map((listing) => [listing.asset.id, listing]));
		for (const listing of liveHomeListingShells) listings.set(listing.asset.id, listing);
		return [...listings.values()];
	}, [cachedHomeListings, liveHomeListingShells]);
	const displayHomeListings = React.useMemo(
		() =>
			homeListingShells
				.filter(({ asset, collection }) => isVisibleCollectionId(collection.id) && isVisibleAssetId(asset.id))
				.map(({ asset, collection, activity }) => {
					const currentCollection = market.collections.find((candidate) => candidate.id === collection.id);
					const currentAsset = currentCollection ? collectionAsset(currentCollection, asset.id) : undefined;
					return {
						asset: currentAsset?.image && !asset.image ? { ...asset, image: currentAsset.image } : asset,
						collection: currentCollection ?? collection,
						activity,
					};
				}),
		[homeListingShells, market.collections]
	);
	const [portableHomeListingsLoading, setPortableHomeListingsLoading] = React.useState(false);
	const [portableHomeListingsComplete, setPortableHomeListingsComplete] = React.useState(false);
	const [portableHomeListingsFailure, setPortableHomeListingsFailure] = React.useState<
		Extract<HomeMarketSummary, { status: 'unavailable' }> | undefined
	>();
	const [portableHomeRetry, setPortableHomeRetry] = React.useState(0);
	const portableHomeComputeCircuit = React.useRef<HomeListingComputeCircuit>({
		scope: '',
		consecutiveFailures: 0,
	});
	const marketShellReady = market.collections.length > 0;
	const listingSupportVersion = React.useMemo(
		() => homeListingSupportVersion(market.collections),
		[market.collections]
	);
	const marketCollectionsRef = React.useRef(market.collections);
	marketCollectionsRef.current = market.collections;
	const loadedAssetLimit = React.useMemo(
		() =>
			market.collections.reduce((total, collection) => total + collection.assets.length, 0) +
			displayHomeListings.length,
		[displayHomeListings.length, market.collections]
	);
	const listingAssetLimit = HOME_LISTING_ASSET_LIMIT;
	const assetCandidates = React.useMemo(
		() =>
			normalizedQuery
				? homeSearchAssets(
						market.collections,
						displayHomeListings,
						normalizedQuery,
						assetView === 'all' ? loadedAssetLimit : listingAssetLimit,
						homeSearchMatches ?? undefined
				  )
				: assetView === 'all'
				? homeAllAssets(market.collections, loadedAssetLimit, displayHomeListings)
				: homeDiscoveryAssets(market.collections, verifiedHomeListings, listingAssetLimit, displayHomeListings),
		[
			assetView,
			loadedAssetLimit,
			homeSearchMatches,
			market.collections,
			normalizedQuery,
			displayHomeListings,
			verifiedHomeListings,
		]
	);
	const [assetPrices, setAssetPrices] = React.useState<Record<string, HomeMarketSummary>>({});
	const [assetImages, setAssetImages] = React.useState<Record<string, string>>({});
	const displayAssetPrices = React.useMemo(() => {
		const prices: Record<string, HomeMarketSummary> = Object.fromEntries(
			homeListingShells.map((listing) => [
				listing.asset.id,
				{ status: 'resolved', value: listing.price } satisfies HomeMarketSummary,
			])
		);
		for (const [assetId, summary] of Object.entries(assetPrices)) {
			if (summary.status === 'resolved') prices[assetId] = summary;
			else if (!prices[assetId]) prices[assetId] = summary;
		}
		return prices;
	}, [assetPrices, homeListingShells]);
	const homeListingActivityByAsset = React.useMemo(() => {
		const indexed = new Map<string, HomeListingActivity>(Object.entries(verifiedHomeListingActivity));
		for (const result of displayHomeListings) {
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
	}, [displayHomeListings, verifiedHomeListingActivity]);
	const displayedAssets = React.useMemo(
		() =>
			[...assetCandidates]
				.filter(({ asset }) => homeAssetVisibleForView(displayAssetPrices[asset.id], assetView))
				.filter(({ collection }) => homeAssetTypeMatches(collection, assetType))
				.sort((left, right) => {
					if (assetView === 'all') return 0;
					if (assetView === 'listed') {
						return compareHomeListingRecency(left.asset.id, right.asset.id, homeListingActivityByAsset);
					}
					const price = (assetId: string) => {
						const summary = displayAssetPrices[assetId];
						if (!summary || summary.status !== 'resolved' || !summary.value)
							return Number.POSITIVE_INFINITY;
						return homeMarketPriceValue(summary.value);
					};
					const leftPrice = price(left.asset.id);
					const rightPrice = price(right.asset.id);
					if (Number.isFinite(leftPrice) !== Number.isFinite(rightPrice)) {
						return Number.isFinite(leftPrice) ? -1 : 1;
					}
					return assetView === 'price-low' ? leftPrice - rightPrice : rightPrice - leftPrice;
				}),
		[assetCandidates, assetType, assetView, displayAssetPrices, homeListingActivityByAsset]
	);
	const discoverTokens = displayedAssets.filter(({ collection }) => collection.kind === 'tokens');
	const discoverCollectibles = displayedAssets.filter(({ collection }) => collection.kind !== 'tokens');
	const discoverTokenPagination = homeAssetPage(discoverTokens, discoverTokenPage, HOME_DISCOVER_TOKEN_PAGE_SIZE);
	const discoverOverviewAssets = [...discoverTokenPagination.items, ...discoverCollectibles.slice(0, 12)];
	const assetPagination = homeAssetPage(displayedAssets, assetPage);
	const visibleDiscoverTokens =
		assetType === 'all'
			? discoverTokenPagination.items
			: assetType === 'tokens'
			? assetPagination.items.filter(({ collection }) => collection.kind === 'tokens')
			: [];
	const visibleDiscoverTokenKey = visibleDiscoverTokens.map(({ asset }) => asset.id).join(',');
	const [tokenPriceChanges, setTokenPriceChanges] = React.useState<Record<string, number | null | 'unavailable'>>({});
	const assets =
		assetView === 'all' ? (assetType === 'all' ? discoverOverviewAssets : assetPagination.items) : assetCandidates;
	const assetKey = assets.map(({ asset }) => asset.id).join(',');
	const portableHomeListingById = React.useMemo(
		() => new Map(portableHomeListings.map((result) => [result.asset.id, result])),
		[portableHomeListings]
	);
	const portableHomeStateKey = React.useMemo(
		() =>
			portableHomeListings
				.map((result) => `${result.asset.id}:${String(result.state.raw['at-slot'] ?? result.state.swapHeight)}`)
				.join(','),
		[portableHomeListings]
	);
	const collectionKey = React.useMemo(
		() =>
			collections
				.map((collection) => `${collection.id}:${collection.assets.map((asset) => asset.id).join('.')}`)
				.sort()
				.concat(aoRoutingScope)
				.join(','),
		[aoRoutingScope, collections]
	);
	const [collectionFloors, setCollectionFloors] = React.useState<Record<string, HomeMarketSummary>>({});
	const [summaryRetry, setSummaryRetry] = React.useState(0);
	const [summaryRetrying, setSummaryRetrying] = React.useState(false);
	const assetSummaryControllers = React.useRef(new Map<string, AbortController>());
	const collectionSummaryControllers = React.useRef(
		new Map<
			string,
			{
				version: string;
				controller: AbortController;
			}
		>()
	);
	const collectionSummaryVersions = React.useRef(new Map<string, string>());
	const collectionActivityScans = React.useRef(new Map<string, HomeActivityScan>());
	const collectionFloorScans = React.useRef(new Map<string, HomeFloorScan>());
	const retryAssetSummaries = React.useRef(new Set<string>());
	const retryCollectionSummaries = React.useRef(new Set<string>());
	const summaryRetryRun = React.useRef<HomeSummaryRetryRun>({ token: 0, pending: new Set() });
	const shouldLoadAssetSummaries = shouldLoadHomeAssetSummaries(homeTab);
	const finishSummaryRetry = React.useCallback((token: number, group: 'assets' | 'collections') => {
		const activeRequests =
			group === 'assets' ? assetSummaryControllers.current.size : collectionSummaryControllers.current.size;
		if (completeHomeSummaryRetryGroup(summaryRetryRun.current, token, group, activeRequests)) {
			setSummaryRetrying(false);
		}
	}, []);
	React.useEffect(
		() => () => {
			for (const controller of assetSummaryControllers.current.values()) controller.abort();
			for (const { controller } of collectionSummaryControllers.current.values()) controller.abort();
			assetSummaryControllers.current.clear();
			collectionSummaryControllers.current.clear();
		},
		[]
	);
	React.useEffect(() => {
		if (!shouldLoadAssetSummaries || !visibleDiscoverTokenKey) {
			setTokenPriceChanges({});
			return;
		}
		const controller = new AbortController();
		const tokenIds = visibleDiscoverTokenKey.split(',');
		const eventLimit = 200;
		setTokenPriceChanges({});
		void discoverCollectionActivity({
			actions: ['make-offer'],
			limit: eventLimit,
			recipients: tokenIds,
			signal: controller.signal,
		}).then(
			(events) => {
				if (controller.signal.aborted) return;
				const now = Date.now();
				const windowComplete = events.length < eventLimit;
				setTokenPriceChanges(
					Object.fromEntries(
						tokenIds.map((tokenId) => [
							tokenId,
							homeTokenPriceChangePercent(
								events.filter((event) => event.processId === tokenId),
								now,
								windowComplete
							),
						])
					)
				);
			},
			() => {
				if (!controller.signal.aborted) {
					setTokenPriceChanges(Object.fromEntries(tokenIds.map((tokenId) => [tokenId, 'unavailable'])));
				}
			}
		);
		return () => controller.abort();
	}, [homeListingSnapshotScope, shouldLoadAssetSummaries, visibleDiscoverTokenKey]);
	React.useEffect(() => {
		if (!marketShellReady || !shouldLoadAssetSummaries) {
			setPortableHomeListingsLoading(false);
			return;
		}
		if (market.error) {
			setPortableHomeListingsLoading(false);
			return;
		}
		const computeCircuitScope = `${aoRoutingScope}|${portableHomeRetry}`;
		const computeCircuit = portableHomeComputeCircuit.current;
		recordHomeListingComputeResult(computeCircuit, computeCircuitScope);
		if (computeCircuit.failure !== undefined) {
			setPortableHomeListingsLoading(false);
			setPortableHomeListingsFailure({
				status: 'unavailable',
				source: 'compute',
				kind: marketplaceFailureKind(computeCircuit.failure),
			});
			return;
		}
		const controller = new AbortController();
		let disposed = false;
		setPortableHomeListingsLoading(true);
		setPortableHomeListingsComplete(false);
		setPortableHomeListingsFailure(undefined);
		const publications = createAnimationFrameBatch<
			ListingResolutionOutcome | { processId: string; state: AssetState; provider: string; refresh: true }
		>((batch) => {
			const settledIds = new Set(batch.map((publication) => publication.processId));
			setCachedHomeListings((current) => current.filter((listing) => !settledIds.has(listing.asset.id)));
			setPortableHomeListings((current) => {
				const results = new Map(current.map((result) => [result.asset.id, result]));
				for (const publication of batch) {
					if ('refresh' in publication) {
						const previous = results.get(publication.processId);
						if (previous) {
							const updated = {
								...previous,
								state: publication.state,
								provider: publication.provider,
							};
							if (isLiveListing(updated)) results.set(publication.processId, updated);
							else results.delete(publication.processId);
						}
					} else {
						results.delete(publication.processId);
						if (publication.result && isLiveListing(publication.result)) {
							results.set(publication.processId, publication.result);
						}
					}
				}
				return [...results.values()];
			});
		});
		void (async () => {
			let indexFailure: unknown;
			let computeFailure: unknown;
			let computeAttempts = 0;
			let computeFailures = 0;
			let computeCircuitFailure: unknown;
			let discoveryFailure: unknown;
			const collections = marketCollectionsRef.current;
			const resolver = createAssetCandidateResolver(collections, {
				signal: controller.signal,
				concurrency: 8,
				read: (processId, signal) =>
					readAssetStateCached(processId, {
						signal,
						maxAge: HOME_STATE_MAX_AGE,
						maxAttempts: 1,
						staleWhileRevalidate: HOME_STATE_STALE_WHILE_REVALIDATE,
						onRevalidated: (fresh) => {
							if (controller.signal.aborted) return;
							publications.push({
								processId,
								state: fresh.state,
								provider: fresh.provider,
								refresh: true,
							});
						},
					}),
				onSettled: (result, candidate, cause) => {
					if (controller.signal.aborted) return;
					computeAttempts += 1;
					if (cause) {
						computeFailures += 1;
						computeFailure ??= cause;
						computeCircuitFailure ??= recordHomeListingComputeResult(
							computeCircuit,
							computeCircuitScope,
							cause
						);
						if (computeCircuitFailure !== undefined) controller.abort(computeCircuitFailure);
						return;
					}
					recordHomeListingComputeResult(computeCircuit, computeCircuitScope);
					publications.push({ processId: candidate.processId, result });
				},
			});
			let supportTail = Promise.resolve();
			const publishCandidates = (candidates: AssetCandidate[]) => {
				const { supported, unverified } = partitionAssetCandidateSupport(candidates, collections);
				resolver.enqueue(supported);
				if (unverified.length) {
					supportTail = supportTail.then(async () => {
						try {
							const verification = await verifyAssetCandidateSupport(unverified, collections, {
								signal: controller.signal,
								onVerified: (verified) => resolver.enqueue(verified),
							});
							indexFailure ??= verification.unavailable[0]?.error;
						} catch (cause) {
							if (controller.signal.aborted) throw cause;
							indexFailure ??= cause;
						}
					});
				}
			};
			try {
				await discoverMarketActivity({
					listingsOnly: true,
					signal: controller.signal,
					onPage: publishCandidates,
				});
			} catch (cause) {
				if (computeCircuitFailure === undefined) discoveryFailure = cause;
			}
			try {
				await supportTail;
				await resolver.finish();
				controller.signal.throwIfAborted();
				const failure =
					discoveryFailure ??
					indexFailure ??
					homeListingComputeFailure(computeFailure, computeAttempts, computeFailures);
				setPortableHomeListingsComplete(!failure);
				setPortableHomeListingsFailure(
					failure
						? {
								status: 'unavailable',
								source: discoveryFailure || indexFailure ? 'index' : 'compute',
								kind: marketplaceFailureKind(failure),
						  }
						: undefined
				);
			} catch (cause) {
				if (!disposed) {
					setPortableHomeListingsFailure({
						status: 'unavailable',
						source:
							computeCircuitFailure === undefined && (discoveryFailure || indexFailure)
								? 'index'
								: 'compute',
						kind: marketplaceFailureKind(computeCircuitFailure ?? cause),
					});
				}
			} finally {
				if (!disposed) {
					publications.flush();
					setPortableHomeListingsLoading(false);
				}
			}
		})();
		return () => {
			disposed = true;
			controller.abort();
			publications.cancel();
		};
	}, [
		aoRoutingScope,
		listingSupportVersion,
		market.error,
		marketShellReady,
		portableHomeRetry,
		shouldLoadAssetSummaries,
	]);
	React.useEffect(() => {
		if (
			!liveHomeListingShells.length ||
			(!portableHomeListingsComplete && liveHomeListingShells.length < HOME_ASSET_PAGE_SIZE)
		)
			return;
		return scheduleIdleTask(
			() => storeHomeListingSnapshot(window.sessionStorage, homeListingSnapshotScope, liveHomeListingShells),
			250
		);
	}, [homeListingSnapshotScope, liveHomeListingShells, portableHomeListingsComplete]);
	React.useEffect(() => {
		if (!shouldLoadAssetSummaries) {
			for (const controller of assetSummaryControllers.current.values()) controller.abort();
			assetSummaryControllers.current.clear();
			return;
		}
		const visibleAssetIds = new Set(assets.map(({ asset }) => asset.id));
		for (const [assetId, controller] of assetSummaryControllers.current) {
			if (visibleAssetIds.has(assetId)) continue;
			controller.abort();
			assetSummaryControllers.current.delete(assetId);
		}
		setAssetPrices((current) =>
			Object.fromEntries(Object.entries(current).filter(([assetId]) => visibleAssetIds.has(assetId)))
		);
		setAssetImages((current) =>
			Object.fromEntries(Object.entries(current).filter(([assetId]) => visibleAssetIds.has(assetId)))
		);
		const requestedAssetIds = new Set(
			homeSummaryRequestKeys(
				assets.map(({ asset }) => asset.id),
				assetPrices,
				assetSummaryControllers.current.keys(),
				retryAssetSummaries.current
			)
		);
		const requestedAssets = assets.filter(({ asset }) => requestedAssetIds.has(asset.id));
		const retryToken = summaryRetryRun.current.pending.has('assets') ? summaryRetryRun.current.token : null;
		let retryFinished = false;
		const finishRetry = () => {
			if (retryToken === null || retryFinished) return;
			retryFinished = true;
			finishSummaryRetry(retryToken, 'assets');
		};
		retryAssetSummaries.current.clear();
		void mapConcurrent(requestedAssets, 8, async ({ asset, collection }) => {
			const previous = assetSummaryControllers.current.get(asset.id);
			if (previous) previous.abort();
			const controller = new AbortController();
			assetSummaryControllers.current.set(asset.id, controller);
			let trackingRevalidation = false;
			try {
				const publishPrice = (state: AssetState) => {
					const order = bestAskOfAsset(state);
					if (!controller.signal.aborted) {
						const image = collectionAsset(collection, asset.id, state)?.image;
						setAssetPrices((current) => ({
							...current,
							[asset.id]: { status: 'resolved', value: order ? orderPriceLabel(order, state) : null },
						}));
						if (image) {
							setAssetImages((current) =>
								current[asset.id] === image ? current : { ...current, [asset.id]: image }
							);
						}
					}
				};
				const portable = portableHomeListingById.get(asset.id);
				let state = portable?.state;
				if (!state) {
					const computed = await readAssetStateCached(asset.id, {
						signal: controller.signal,
						maxAge: HOME_STATE_MAX_AGE,
						maxAttempts: 1,
						staleWhileRevalidate: HOME_STATE_STALE_WHILE_REVALIDATE,
						onRevalidated: (fresh) => publishPrice(fresh.state),
					});
					state = computed.state;
					if (computed.revalidation) {
						trackingRevalidation = true;
						const finishRevalidation = () => {
							if (assetSummaryControllers.current.get(asset.id) === controller) {
								assetSummaryControllers.current.delete(asset.id);
							}
						};
						void computed.revalidation.then(finishRevalidation, finishRevalidation);
					}
				}
				publishPrice(state);
			} catch (cause) {
				if (!controller.signal.aborted) {
					setAssetPrices((current) => ({
						...current,
						[asset.id]: { status: 'unavailable', source: 'compute', kind: marketplaceFailureKind(cause) },
					}));
				}
			} finally {
				if (!trackingRevalidation && assetSummaryControllers.current.get(asset.id) === controller) {
					assetSummaryControllers.current.delete(asset.id);
				}
			}
		}).then(finishRetry);
	}, [assetKey, finishSummaryRetry, portableHomeStateKey, shouldLoadAssetSummaries, summaryRetry]);
	const marketShellLoading = homeMarketShellLoading(market.loading, market.collections.length);
	const shouldLoadCollectionSummaries = shouldLoadHomeCollectionSummaries(homeTab);
	React.useEffect(() => {
		if (!shouldLoadCollectionSummaries) {
			for (const { controller } of collectionSummaryControllers.current.values()) controller.abort();
			collectionSummaryControllers.current.clear();
			return;
		}
		const visibleCollections = new Map(
			collections.map((collection) => [
				collection.id,
				`${aoRoutingScope}:${collection.id}:${collection.assets
					.map((asset) => asset.id)
					.sort()
					.join('.')}`,
			])
		);
		const changedCollections = new Set<string>();
		for (const [collectionId, request] of collectionSummaryControllers.current) {
			if (visibleCollections.get(collectionId) === request.version) continue;
			request.controller.abort();
			collectionSummaryControllers.current.delete(collectionId);
		}
		for (const [collectionId, version] of collectionSummaryVersions.current) {
			if (visibleCollections.get(collectionId) === version) continue;
			changedCollections.add(collectionId);
			collectionSummaryVersions.current.delete(collectionId);
		}
		for (const collectionId of collectionActivityScans.current.keys()) {
			if (!visibleCollections.has(collectionId)) collectionActivityScans.current.delete(collectionId);
		}
		for (const collectionId of collectionFloorScans.current.keys()) {
			if (!visibleCollections.has(collectionId)) collectionFloorScans.current.delete(collectionId);
		}
		setCollectionFloors((current) =>
			Object.fromEntries(
				Object.entries(current).filter(
					([collectionId]) => visibleCollections.has(collectionId) && !changedCollections.has(collectionId)
				)
			)
		);
		const requestedCollections = collections.filter((collection) => {
			const version = visibleCollections.get(collection.id)!;
			return (
				retryCollectionSummaries.current.has(collection.id) ||
				collectionSummaryVersions.current.get(collection.id) !== version ||
				(!collectionFloors[collection.id] && !collectionSummaryControllers.current.has(collection.id))
			);
		});
		const retryToken = summaryRetryRun.current.pending.has('collections') ? summaryRetryRun.current.token : null;
		let retryFinished = false;
		const finishRetry = () => {
			if (retryToken === null || retryFinished) return;
			retryFinished = true;
			finishSummaryRetry(retryToken, 'collections');
		};
		retryCollectionSummaries.current.clear();
		const requests = requestedCollections.map((collection) =>
			(async () => {
				const version = visibleCollections.get(collection.id)!;
				const previous = collectionSummaryControllers.current.get(collection.id);
				if (previous) previous.controller.abort();
				const controller = new AbortController();
				collectionSummaryControllers.current.set(collection.id, { version, controller });
				collectionSummaryVersions.current.set(collection.id, version);
				try {
					const previousFloorScan = collectionFloorScans.current.get(collection.id);
					const scheduled = new Set<string>();
					const outcomes = new Map<
						string,
						{ candidate: AssetCandidate; asking: bigint | null; failure?: MarketplaceFailureKind }
					>();
					let floorScan: HomeFloorScan | undefined;
					const resolver = createAssetCandidateResolver([collection], {
						concurrency: 4,
						signal: controller.signal,
						read: (processId, signal) =>
							readAssetStateCached(processId, {
								signal,
								maxAge: HOME_STATE_MAX_AGE,
								maxAttempts: 1,
								staleWhileRevalidate: HOME_STATE_STALE_WHILE_REVALIDATE,
							}),
						onSettled: (result, candidate, cause) => {
							if (
								controller.signal.aborted ||
								collectionSummaryControllers.current.get(collection.id)?.controller !== controller ||
								collectionSummaryControllers.current.get(collection.id)?.version !== version
							)
								return;
							const order = !cause && result ? bestAskOfAsset(result.state) : null;
							const outcome = {
								candidate,
								asking: order && result ? unitPriceWinston(order, result.state.denomination) : null,
								...(cause ? { failure: marketplaceFailureKind(cause) } : {}),
							};
							if (
								floorScan?.candidates.get(candidate.processId) ===
								`${candidate.height}:${candidate.timestamp}`
							) {
								commitHomeFloorResult(floorScan, candidate.processId, outcome.asking, outcome.failure);
							} else if (!floorScan) outcomes.set(candidate.processId, outcome);
							if (cause) return;
							const asset = result?.asset ?? collectionAsset(collection, candidate.processId);
							if (!asset) return;
							setVerifiedHomeListings((current) =>
								publishHomeListingResult(current, collection.id, asset, Boolean(order))
							);
							if (!order || !result) return;
							setAssetPrices((current) => ({
								...current,
								[asset.id]: { status: 'resolved', value: orderPriceLabel(order, result.state) },
							}));
							setVerifiedHomeListingActivity((current) => ({
								...current,
								[asset.id]: candidate,
							}));
						},
					});
					const enqueueCandidates = (candidates: AssetCandidate[]) => {
						resolver.enqueue(
							candidates.filter((candidate) => {
								if (
									scheduled.has(candidate.processId) ||
									!homeFloorCandidateNeedsResolution(previousFloorScan, version, candidate)
								)
									return false;
								scheduled.add(candidate.processId);
								return true;
							})
						);
					};
					let candidates: AssetCandidate[];
					if (collection.kind === 'names') {
						const includesCollectionAsset = collectionCandidateMembership(collection);
						candidates = await discoverMarketActivity({
							listingsOnly: true,
							signal: controller.signal,
							acceptProcessId: includesCollectionAsset,
							onPage: enqueueCandidates,
						});
					} else {
						const recipients = [...new Set(collection.assets.map((asset) => asset.id))];
						const scan = reconcileHomeActivityScan(
							collectionActivityScans.current.get(collection.id),
							recipients
						);
						collectionActivityScans.current.set(collection.id, scan);
						const pending = pendingHomeActivityRecipients(scan, recipients);
						if (pending.length) {
							await discoverMarketActivityBatched({
								listingsOnly: true,
								recipients: pending,
								signal: controller.signal,
								onBatch: (batchCandidates, batchRecipients) => {
									if (
										controller.signal.aborted ||
										collectionSummaryControllers.current.get(collection.id)?.controller !==
											controller ||
										collectionSummaryControllers.current.get(collection.id)?.version !== version ||
										collectionActivityScans.current.get(collection.id) !== scan
									)
										return;
									commitHomeActivityBatch(scan, batchCandidates, batchRecipients);
									enqueueCandidates(batchCandidates);
								},
							});
						}
						controller.signal.throwIfAborted();
						if (
							collectionActivityScans.current.get(collection.id) !== scan ||
							recipients.some((recipient) => !scan.completed.has(recipient))
						) {
							controller.abort(new DOMException('Home activity scan replaced.', 'AbortError'));
							controller.signal.throwIfAborted();
						}
						completeHomeActivityScan(scan, recipients);
						candidates = [...scan.candidates.values()];
					}
					enqueueCandidates(candidates);
					floorScan = reconcileHomeFloorScan(previousFloorScan, version, candidates);
					collectionFloorScans.current.set(collection.id, floorScan);
					for (const outcome of outcomes.values()) {
						if (
							floorScan.candidates.get(outcome.candidate.processId) ===
							`${outcome.candidate.height}:${outcome.candidate.timestamp}`
						) {
							commitHomeFloorResult(
								floorScan,
								outcome.candidate.processId,
								outcome.asking,
								outcome.failure
							);
						}
					}
					await resolver.finish();
					controller.signal.throwIfAborted();
					if (collectionFloorScans.current.get(collection.id) !== floorScan) {
						controller.abort(new DOMException('Home floor scan replaced.', 'AbortError'));
						controller.signal.throwIfAborted();
					}
					if (!controller.signal.aborted) {
						const verifiedListingIds = [...floorScan.settled].flatMap(([processId, asking]) =>
							asking === null ? [] : [processId]
						);
						const activityScan = collectionActivityScans.current.get(collection.id);
						setVerifiedHomeListingActivity((current) => {
							const next = { ...current };
							for (const assetId of verifiedListingIds) {
								const candidate = activityScan?.candidates.get(assetId);
								if (candidate) next[assetId] = candidate;
							}
							return next;
						});
						setVerifiedHomeListings((current) => {
							const previous = current[collection.id] ?? [];
							const verifiedListings = reconcileHomeListingAssets(
								previous,
								verifiedListingIds,
								collection
							);
							if (
								previous.length === verifiedListings.length &&
								previous.every((asset, index) => asset === verifiedListings[index])
							)
								return current;
							return { ...current, [collection.id]: verifiedListings };
						});
						setCollectionFloors((current) => ({
							...current,
							[collection.id]: homeFloorScanSummary(floorScan),
						}));
					}
				} catch (cause) {
					if (!controller.signal.aborted) {
						setCollectionFloors((current) => ({
							...current,
							[collection.id]: {
								status: 'unavailable',
								source: 'index',
								kind: marketplaceFailureKind(cause),
							},
						}));
						controller.abort(cause);
					}
				} finally {
					if (collectionSummaryControllers.current.get(collection.id)?.controller === controller) {
						collectionSummaryControllers.current.delete(collection.id);
					}
				}
			})()
		);
		void Promise.all(requests).then(finishRetry);
	}, [aoRoutingScope, collectionKey, finishSummaryRetry, shouldLoadCollectionSummaries, summaryRetry]);
	const collectionActivityKey = React.useMemo(
		() =>
			collections
				.map((collection) => `${collection.id}:${collectionActivityVersion(collection)}`)
				.sort()
				.join('|'),
		[collections]
	);
	React.useEffect(() => {
		if (!shouldLoadCollectionSummaries || collectionSort !== 'recent') return;
		const controller = new AbortController();
		void mapConcurrent(collections, 2, async (collection) => {
			try {
				const events = await discoverCollectionActivityBatched({
					limit: 1,
					recipients: collection.assets.map((asset) => asset.id),
					signal: controller.signal,
				});
				const latest = events[0];
				if (!latest || controller.signal.aborted) return;
				setCollectionActivity((current) => {
					const previous = current[collection.id];
					if (
						previous &&
						(previous.height > latest.height ||
							(previous.height === latest.height && previous.timestamp >= latest.timestamp))
					)
						return current;
					return { ...current, [collection.id]: latest };
				});
			} catch {
				controller.signal.throwIfAborted();
				// Creation time remains a truthful fallback when activity indexing is unavailable.
			}
		});
		return () => controller.abort();
	}, [collectionActivityKey, collectionSort, shouldLoadCollectionSummaries]);
	const summaryFailures = [...Object.values(assetPrices), ...Object.values(collectionFloors)].filter(
		(summary): summary is Extract<HomeMarketSummary, { status: 'unavailable' }> => summary.status === 'unavailable'
	);
	const failedAssetIds = assets
		.map(({ asset }) => asset.id)
		.filter((assetId) => assetPrices[assetId]?.status === 'unavailable');
	const failedCollectionIds = collections
		.map((collection) => collection.id)
		.filter((collectionId) => collectionFloors[collectionId]?.status === 'unavailable');
	const summaryFailureKey = `${failedAssetIds.join(',')}|${failedCollectionIds.join(',')}`;
	const retryMarketSummaries = () => {
		if (summaryRetrying) return;
		retryAssetSummaries.current = new Set(
			assets.map(({ asset }) => asset.id).filter((assetId) => assetPrices[assetId]?.status === 'unavailable')
		);
		retryCollectionSummaries.current = new Set(
			collections
				.map((collection) => collection.id)
				.filter((collectionId) => collectionFloors[collectionId]?.status === 'unavailable')
		);
		const retryGroups = new Set<'assets' | 'collections'>();
		if (retryAssetSummaries.current.size) retryGroups.add('assets');
		if (retryCollectionSummaries.current.size) retryGroups.add('collections');
		if (!retryGroups.size) return;
		summaryRetryRun.current = {
			token: summaryRetryRun.current.token + 1,
			pending: retryGroups,
		};
		setSummaryRetrying(true);
		setSummaryRetry((current) => current + 1);
	};
	React.useEffect(() => {
		if (
			!summaryFailureKey ||
			summaryFailureKey === '|' ||
			summaryRetrying ||
			portableHomeListingsFailure?.source === 'compute'
		)
			return;
		const timer = window.setTimeout(retryMarketSummaries, 15_000);
		return () => window.clearTimeout(timer);
	}, [portableHomeListingsFailure, summaryFailureKey, summaryRetrying]);
	React.useEffect(() => setAssetPage(1), [assetType, assetView, normalizedQuery]);
	React.useEffect(() => setDiscoverTokenPage(1), [assetType, assetView, normalizedQuery]);
	React.useEffect(() => {
		if (assetPage !== assetPagination.page) setAssetPage(assetPagination.page);
	}, [assetPage, assetPagination.page]);
	React.useEffect(() => {
		if (discoverTokenPage !== discoverTokenPagination.page) {
			setDiscoverTokenPage(discoverTokenPagination.page);
		}
	}, [discoverTokenPage, discoverTokenPagination.page]);
	const collectionResultsReady = homeMarketSummariesReady(
		marketShellLoading,
		collections.map((collection) => collection.id),
		collectionFloors
	);
	const assetSummariesRetrying = summaryRetrying && summaryRetryRun.current.pending.has('assets');
	const collectionSummariesRetrying = summaryRetrying && summaryRetryRun.current.pending.has('collections');
	const collectionResultsPending = homeMarketHasPending(
		market.loading || collectionSummariesRetrying || failedCollectionIds.length > 0,
		collections.map((collection) => collection.id),
		collectionFloors
	);
	const discoverResultsPending = homeMarketHasPending(
		market.loading || assetSummariesRetrying || portableHomeListingsLoading || failedAssetIds.length > 0,
		assets.map(({ asset }) => asset.id),
		assetPrices
	);
	const discoverResultsFailed = Boolean(portableHomeListingsFailure) || summaryFailures.length > 0;
	const discoverInitialLoading = homeMarketShowsInitialLoader(discoverResultsPending, displayedAssets.length);
	const pageRefreshing =
		homeTab === 'discover' ? discoverResultsPending : homeTab === 'collections' ? collectionResultsPending : false;
	React.useEffect(() => {
		market.setPageRefreshing(pageRefreshing);
		return () => market.setPageRefreshing(false);
	}, [market.setPageRefreshing, pageRefreshing]);
	const selectHomeTab = (tab: HomeTab) => {
		navigate({ pathname: homeTabPath(tab), search: homeRouteSearch(search) });
		if (marketPaneRef.current) marketPaneRef.current.scrollTop = 0;
	};
	const selectAssetPage = (page: number) => {
		setAssetPage(page);
		marketPaneRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
	};
	const renderTokenList = (items: typeof displayedAssets) => (
		<div className="token-market-list" role="list">
			{items.map(({ asset, collection }, index) => {
				const price = displayAssetPrices[asset.id];
				const change = tokenPriceChanges[asset.id];
				return (
					<TokenMarketRow
						asset={{ ...asset, image: assetImages[asset.id] ?? asset.image }}
						collection={collection}
						context={`Fungible token · ${short(asset.id)}`}
						key={`${collection.id}-${asset.id}`}
						metric={{
							label: 'Unit price',
							value: price ? homeMarketSummaryLabel(price, 'Not listed') : <HomePendingMarketValue />,
							tone: homeMarketSummaryListed(price) ? 'positive' : 'default',
						}}
						secondaryMetric={{
							label: '24h change',
							value:
								change === undefined ? <HomePendingMarketValue /> : homeTokenPriceChangeLabel(change),
							tone:
								typeof change !== 'number'
									? 'muted'
									: change > 0
									? 'positive'
									: change < 0
									? 'negative'
									: 'muted',
						}}
						onWarm={() => prefetchAssetPage(asset.id, true)}
						priority={index < 2}
					/>
				);
			})}
		</div>
	);
	const renderCollectibleGrid = (items: typeof displayedAssets) => (
		<div className="home-asset-grid">
			{items.map(({ asset, collection }, index) => {
				const price = displayAssetPrices[asset.id];
				const pricePending = !price;
				return (
					<Link
						key={`${collection.id}-${asset.id}`}
						to={`/asset/${collection.id}/${asset.id}`}
						onFocus={() => prefetchAssetPage(asset.id, false)}
						onMouseEnter={() => prefetchAssetPage(asset.id, false)}
						onTouchStart={() => prefetchAssetPage(asset.id, false)}
					>
						<DiscoveryAssetArtwork asset={asset} collection={collection} priority={index < 2} />
						<div className="home-asset-details">
							<div>
								<strong>{asset.name}</strong>
								<span>{collection.name}</span>
							</div>
							<b className={`home-asset-price${homeMarketSummaryListed(price) ? ' listed' : ''}`}>
								{!pricePending && price ? (
									homeMarketSummaryLabel(price, 'Not listed')
								) : (
									<HomePendingMarketValue />
								)}
							</b>
						</div>
					</Link>
				);
			})}
		</div>
	);
	return (
		<div className="home-shell">
			<div className="home-main">
				<div className="home-content">
					<div className="home-market-layout" ref={marketPaneRef}>
						<section className="home-section home-assets" id="market">
							<VisuallyHidden as="h1">Marketplace</VisuallyHidden>
							<div className="home-section-heading">
								<div>
									<div aria-label="Marketplace view" className="home-market-tabs" role="tablist">
										<Button
											aria-controls="home-discover-panel"
											aria-selected={homeTab === 'discover'}
											className="home-market-tab"
											id="home-discover-tab"
											onClick={() => selectHomeTab('discover')}
											role="tab"
											size="small"
										>
											<Icon icon={Compass} />
											Discover
										</Button>
										<Button
											aria-controls="home-collections-panel"
											aria-selected={homeTab === 'collections'}
											className="home-market-tab"
											id="home-collections-tab"
											onClick={() => selectHomeTab('collections')}
											role="tab"
											size="small"
										>
											<Icon icon={LayoutGrid} />
											Collections
										</Button>
										<Button
											aria-controls="home-activity-panel"
											aria-selected={homeTab === 'activity'}
											className="home-market-tab"
											id="home-activity-tab"
											onClick={() => selectHomeTab('activity')}
											role="tab"
											size="small"
										>
											<Icon icon={History} />
											Activity
										</Button>
									</div>
									<p>
										{homeTab === 'discover'
											? normalizedQuery
												? `Results for “${query}” across the current Arweave collection indexes.`
												: 'Browse fungible tokens and Uniques on the permaweb.'
											: homeTab === 'collections'
											? 'Browse NFT and name collections.'
											: 'Latest indexed purchases, listings, and transfers across every marketplace collection.'}
									</p>
								</div>
								{homeTab === 'discover' ? (
									<div aria-busy={discoverResultsPending} className="home-asset-filters">
										<Select<HomeAssetType>
											label="Asset type"
											onChange={setAssetType}
											options={[
												{ value: 'all', label: 'All' },
												{ value: 'tokens', label: 'Tokens' },
												{ value: 'atomic', label: 'Uniques (NFTs)' },
											]}
											value={assetType}
										/>
										<Select<HomeAssetView>
											label="View"
											onChange={setAssetView}
											options={[
												{ value: 'all', label: 'All records' },
												{ value: 'listed', label: 'Listed for sale' },
												{ value: 'price-low', label: 'Price: low to high' },
												{ value: 'price-high', label: 'Price: high to low' },
											]}
											value={assetView}
										/>
									</div>
								) : homeTab === 'collections' ? (
									<div aria-busy={collectionResultsPending} className="home-asset-filters">
										<Select<HomeCollectionSort>
											label="Sort collections"
											onChange={setCollectionSort}
											options={[
												{ value: 'recent', label: 'Recent Activity' },
												{ value: 'newest', label: 'Newest' },
												{ value: 'oldest', label: 'Oldest' },
											]}
											value={collectionSort}
										/>
									</div>
								) : null}
							</div>
							{market.error ? <ErrorPanel message={market.error} onRetry={market.retry} /> : null}
							{homeTab === 'discover' && portableHomeListingsFailure ? (
								<ErrorPanel
									message={marketplaceRequestFailureMessage(
										portableHomeListingsFailure.source,
										portableHomeListingsFailure.kind
									)}
									onRetry={() => setPortableHomeRetry((current) => current + 1)}
								/>
							) : null}
							{homeTab === 'discover' && partialTokenCollection ? (
								<div className="collection-source-notice">
									<span role="status">
										Search covers {partialTokenCollection.assets.length.toLocaleString()} of{' '}
										{(
											partialTokenCollection.total ?? partialTokenCollection.assets.length
										).toLocaleString()}{' '}
										discovered token records currently loaded.
									</span>
									<Link
										className="with-icon"
										to={`/collection/${partialTokenCollection.id}?q=${encodeURIComponent(
											query.trim()
										)}`}
									>
										Continue token search
										<Icon icon={ArrowRight} size="xs" />
									</Link>
								</div>
							) : null}
							{homeTab === 'collections' ? (
								<div
									aria-busy={collectionResultsPending}
									aria-labelledby="home-collections-tab"
									id="home-collections-panel"
									role="tabpanel"
								>
									{collections.length || collectionResultsPending ? (
										<div className="home-feature-grid">
											{collections.map((collection, index) => {
												const image = collection.assets.find((asset) => asset.image)?.image;
												const tokenPreview =
													collection.assets.find((asset) => asset.image) ??
													collection.assets[0];
												const floor = collectionFloors[collection.id];
												const floorPending =
													!floor ||
													(collectionSummariesRetrying && floor.status === 'unavailable');
												return (
													<Link
														className={`home-feature-card feature-${index}`}
														key={collection.id}
														to={`/collection/${collection.id}`}
													>
														<div className="home-feature-art">
															{collection.kind === 'tokens' ? (
																<TokenAvatar
																	className="home-token-collection-art"
																	fetchPriority={index === 0 ? 'high' : 'auto'}
																	image={tokenPreview?.image}
																	loading={index === 0 ? 'eager' : 'lazy'}
																	ticker={tokenPreview?.ticker ?? 'Token'}
																/>
															) : image ? (
																<ArtworkImage
																	src={image}
																	alt=""
																	fetchPriority={index === 0 ? 'high' : 'auto'}
																	loading={index === 0 ? 'eager' : 'lazy'}
																	fallback={
																		<span
																			className="home-image-collection-fallback"
																			aria-hidden="true"
																		>
																			<BazarMark />
																			<strong>
																				{collection.name.replace(
																					/^\[TEST\]\s*/,
																					''
																				)}
																			</strong>
																			<small>Permanent image collection</small>
																		</span>
																	}
																/>
															) : collection.kind === 'names' ? (
																<NamesCubePreview />
															) : (
																<div className="home-name-art">
																	<BazarMark />
																	<span>$AR</span>
																</div>
															)}
															<div className="home-feature-glow" />
														</div>
														<div className="home-feature-copy">
															<h2>{collection.name}</h2>
															<span>{collection.description}</span>
														</div>
														<div className="home-feature-stats">
															<div>
																<span>
																	{collection.kind === 'names' && collection.hasMore
																		? 'Loaded'
																		: 'Assets'}
																</span>
																<strong>
																	{homeCollectionAssetCountLabel(collection)}
																</strong>
															</div>
															<div>
																<span>
																	{collection.hasMore ? 'Loaded floor' : 'Floor'}
																</span>
																<strong
																	className={
																		homeMarketSummaryListed(floor)
																			? 'listed'
																			: undefined
																	}
																>
																	{!floorPending && floor ? (
																		<ArCurrencyText>
																			{homeMarketSummaryLabel(
																				floor,
																				collection.hasMore
																					? 'No loaded listings'
																					: 'No live listings',
																				'N/A'
																			)}
																		</ArCurrencyText>
																	) : (
																		<HomePendingMarketValue />
																	)}
																</strong>
															</div>
														</div>
														<strong className="home-card-action">
															Open collection
															<span>
																<Icon icon={ArrowUpRight} size="xs" />
															</span>
														</strong>
													</Link>
												);
											})}
											{collectionResultsPending ? (
												<HomeMarketGhostCard kind="collection" />
											) : null}
										</div>
									) : null}
									{collectionResultsReady && !market.error && collections.length === 0 ? (
										<div className="home-no-results">No collections match “{query}”.</div>
									) : null}
								</div>
							) : homeTab === 'activity' ? (
								<HomeActivityPanel collections={market.collections} marketLoading={market.loading} />
							) : (
								<div
									aria-busy={discoverResultsPending}
									aria-labelledby="home-discover-tab"
									id="home-discover-panel"
									role="tabpanel"
								>
									{discoverInitialLoading ? (
										<div className="home-market-loading">
											<Loading label="Loading marketplace assets…" />
										</div>
									) : displayedAssets.length ? (
										assetType === 'all' ? (
											<div className="discover-market-sections">
												<section className="discover-market-section token-section">
													<div className="discover-market-heading">
														<div>
															<Eyebrow>Fungible assets</Eyebrow>
															<h2>Tokens</h2>
														</div>
														<Button size="custom" onClick={() => setAssetType('tokens')}>
															View all tokens
															<Icon icon={ArrowRight} size="xs" />
														</Button>
													</div>
													{discoverTokens.length ? (
														<>
															{renderTokenList(discoverTokenPagination.items)}
															<Pagination
																ariaLabel="Token overview pages"
																className="discover-token-pagination"
																onPageChange={setDiscoverTokenPage}
																page={discoverTokenPagination.page}
																pageCount={discoverTokenPagination.pageCount}
															/>
														</>
													) : (
														<p className="discover-section-empty">
															No tokens match this view.
														</p>
													)}
												</section>
												<section className="discover-market-section collectible-section">
													<div className="discover-market-heading">
														<div>
															<Eyebrow>1/1 assets</Eyebrow>
															<h2>Uniques</h2>
														</div>
														<Button size="custom" onClick={() => setAssetType('atomic')}>
															View all Uniques
															<Icon icon={ArrowRight} size="xs" />
														</Button>
													</div>
													{discoverCollectibles.length ? (
														renderCollectibleGrid(discoverCollectibles.slice(0, 12))
													) : (
														<p className="discover-section-empty">
															No Uniques match this view.
														</p>
													)}
												</section>
											</div>
										) : (
											<>
												{assetType === 'tokens'
													? renderTokenList(assetPagination.items)
													: renderCollectibleGrid(assetPagination.items)}
												<Pagination
													ariaLabel={assetType === 'tokens' ? 'Token pages' : 'Unique pages'}
													className="home-asset-pagination"
													onPageChange={selectAssetPage}
													page={assetPagination.page}
													pageCount={assetPagination.pageCount}
												/>
											</>
										)
									) : discoverResultsFailed ? null : (
										<div className="home-assets-empty">
											{assetView === 'all'
												? 'No records match this type.'
												: 'No live listings match this type.'}
										</div>
									)}
								</div>
							)}
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}
