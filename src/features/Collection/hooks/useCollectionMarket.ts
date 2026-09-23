import React from 'react';

import type { AssetSummary, Collection } from 'api/collections';
import {
	type AssetCandidate,
	createAssetCandidateResolver,
	discoverMarketActivity,
	discoverMarketActivityBatched,
	resolveAssetCandidates,
	type ResolvedAsset,
} from 'api/discovery';
import { DISPLAY_STATE_CACHE, prefetchAssetPage, readAssetStateCached, servingNodeOrigin } from 'api/marketplace';

import { collectionCandidateMembership, collectionListingScopeVersion } from 'features/Activity';
import { createAnimationFrameBatch } from 'helpers/animation-frame-batch';
import { requestFailureKind } from 'helpers/app-error';
import { asyncError, isAsyncPending } from 'helpers/async-state';

import {
	collectionCardPrices,
	collectionListingData,
	collectionListingPage,
	type CollectionListingProgress,
	collectionListingReducer,
	countListingFailures,
	initialCollectionListingState,
	planCollectionListingScan,
	revalidatedListingPublication,
	settledListingPublication,
	sortCollectionListingCandidates,
} from '../model/collection-listings';
import {
	collectionAssetWindowVersion,
	collectionCandidateIndex,
	type CollectionCardPrices,
	collectionDefaultOrder,
	collectionIndexFailure,
	collectionListingPrice,
	type CollectionListingPublication,
	type CollectionLiveListingRow,
	collectionLiveListingRows,
	collectionSearchScope,
	type CollectionSort,
	type FailedListingCandidate,
	filterCollectionAssets,
	type ListingAnnouncementProgress,
	nextListingAnnouncementProgress,
	pendingCollectionPriceAssets,
	unavailableCollectionPriceIds,
} from '../model/collection-market';

export type CollectionMarketView = {
	/** The serving node whose AO transport reads live state; part of every listing scope. */
	gateway: string;
	/** Assets matching the search, initial, and listing filters, in the chosen order. */
	assets: AssetSummary[];
	candidates: AssetCandidate[];
	listed: ResolvedAsset[];
	liveRows: CollectionLiveListingRow[];
	progress: CollectionListingProgress;
	/** Listing progress throttled to milestones for the live region. */
	announcedProgress: ListingAnnouncementProgress;
	loading: boolean;
	failed: boolean;
	rechecking: boolean;
	prices: CollectionCardPrices;
	pricesLoading: boolean;
	pricesFailed: boolean;
	retryListings(): void;
	recheckUnavailableListings(): void;
	retryPrices(): void;
	warmToken(processId: string): void;
};

function readDisplayState(processId: string, signal?: AbortSignal) {
	return readAssetStateCached(processId, { ...DISPLAY_STATE_CACHE, signal, maxAttempts: 1 });
}

/**
 * The collection market: a listing pass discovers indexed offers and checks each against live asset state, then
 * visible cards without a known price are checked in the background. Results arrive progressively, in animation-frame
 * batches, and survive a failed pass; a retry rechecks only what was unavailable.
 */
export function useCollectionMarket(options: {
	collection: Collection | undefined;
	listedOnly: boolean;
	/** The deferred search text. */
	query: string;
	initial: string;
	sort: CollectionSort;
	/** How many filtered assets are revealed; their prices are checked. */
	limit: number;
}): CollectionMarketView {
	const [state, dispatch] = React.useReducer(
		collectionListingReducer,
		Boolean(options.collection),
		initialCollectionListingState
	);
	const [scanAttempt, setScanAttempt] = React.useState(0);
	const [recheckAttempt, setRecheckAttempt] = React.useState(0);
	const [priceAttempt, setPriceAttempt] = React.useState(0);
	// The listing pass is keyed by scope and asset window; catalogue updates within them must not restart it.
	const collectionRef = React.useRef(options.collection);
	collectionRef.current = options.collection;
	const resolvedPriceIds = React.useRef(new Set<string>());
	const priceScope = React.useRef('');
	const listingScopeRef = React.useRef('');
	const listingCandidates = React.useRef(new Map<string, AssetCandidate>());
	const listingLoadedAssetIds = React.useRef(new Set<string>());
	const failedListingCandidates = React.useRef(new Map<string, FailedListingCandidate>());
	const announcement = React.useRef<ListingAnnouncementProgress>({ scope: '', resolved: 0, failures: 0 });

	const gateway = servingNodeOrigin(window.location);
	const listings = collectionListingData(state.listings);
	const listingsPending = isAsyncPending(state.listings);
	const prices = collectionCardPrices(state.prices);
	const candidateIndex = React.useMemo(() => collectionCandidateIndex(listings.candidates), [listings.candidates]);
	const defaultOrder = React.useMemo(() => collectionDefaultOrder(options.collection), [options.collection]);
	const searchScope = React.useMemo(
		() => collectionSearchScope(options.collection, listings.listed, options.listedOnly, options.query),
		[options.collection, options.query, listings.listed, options.listedOnly]
	);
	const assets = React.useMemo(
		() =>
			filterCollectionAssets(searchScope, {
				query: options.query,
				initial: options.initial,
				sort: options.sort,
				kind: options.collection?.kind,
				prices,
				candidates: candidateIndex,
				defaultOrder,
			}),
		[
			candidateIndex,
			prices,
			options.collection?.kind,
			defaultOrder,
			options.query,
			options.initial,
			options.sort,
			searchScope,
		]
	);
	const liveRows = React.useMemo(() => collectionLiveListingRows(listings.listed), [listings.listed]);
	const visiblePriceAssets = assets.slice(0, options.limit);
	const visiblePriceKey = visiblePriceAssets.map((asset) => asset.id).join(',');
	// The price check is keyed by the visible asset IDs rather than by array identity.
	const visiblePriceAssetsRef = React.useRef(visiblePriceAssets);
	visiblePriceAssetsRef.current = visiblePriceAssets;
	const listingCollectionVersion = React.useMemo(
		() => (options.collection ? collectionListingScopeVersion(options.collection) : ''),
		[options.collection]
	);
	const listingWindowVersion = React.useMemo(
		() => collectionAssetWindowVersion(options.collection?.assets),
		[options.collection]
	);
	const listingScope = options.collection
		? `${gateway}:listed:${options.collection.id}:${listingCollectionVersion}`
		: '';
	if (options.collection) {
		announcement.current = nextListingAnnouncementProgress(announcement.current, {
			scope: listingScope,
			resolved: listings.progress.resolved,
			failures: listings.progress.failures,
			total: listings.progress.total,
			loading: listingsPending,
		});
	}

	// Check prices for visible cards the listing pass did not cover. Runs before the listing pass so a new scope
	// resets prices first.
	React.useEffect(() => {
		const collection = options.collection;
		if (!collection) return;
		const nextScope = listingScope;
		if (priceScope.current !== nextScope) {
			priceScope.current = nextScope;
			resolvedPriceIds.current.clear();
			dispatch({ type: 'prices-reset' });
		}
		if (options.listedOnly) return;
		const controller = new AbortController();
		const unresolvedAssets = pendingCollectionPriceAssets(
			visiblePriceAssetsRef.current,
			resolvedPriceIds.current,
			listingsPending || listingScopeRef.current !== listingScope
		);
		dispatch({ type: 'price-check-started', pending: unresolvedAssets.length > 0 });
		if (!unresolvedAssets.length) return () => controller.abort();
		void (async () => {
			try {
				await discoverMarketActivityBatched({
					recipients: unresolvedAssets.map((asset) => asset.id),
					listingsOnly: true,
					concurrency: 1,
					signal: controller.signal,
					onBatch: async (candidates, completedRecipients) => {
						if (controller.signal.aborted || priceScope.current !== nextScope) return;
						const completedIds = new Set(completedRecipients);
						const candidateIds = new Set(candidates.map((candidate) => candidate.processId));
						const withoutListingActivity = unresolvedAssets
							.filter((asset) => completedIds.has(asset.id) && !candidateIds.has(asset.id))
							.map((asset) => asset.id);
						for (const processId of withoutListingActivity) resolvedPriceIds.current.add(processId);
						dispatch({ type: 'prices-unindexed', processIds: withoutListingActivity });
						await resolveAssetCandidates(
							candidates.filter((candidate) => completedIds.has(candidate.processId)),
							[collection],
							{
								signal: controller.signal,
								concurrency: 2,
								read: readDisplayState,
								onSettled: (result, candidate, cause) => {
									if (controller.signal.aborted || priceScope.current !== nextScope) return;
									resolvedPriceIds.current.add(candidate.processId);
									dispatch({
										type: 'listing-resolved',
										outcome: { processId: candidate.processId, result: cause ? null : result },
										price: collectionListingPrice(
											result,
											cause ? requestFailureKind(cause) : undefined
										),
									});
								},
								onRevalidated: (result, candidate, cause) => {
									if (controller.signal.aborted || priceScope.current !== nextScope) return;
									if (cause) return;
									dispatch({
										type: 'listing-resolved',
										outcome: { processId: candidate.processId, result },
										price: collectionListingPrice(result),
									});
								},
							}
						);
					},
				});
			} catch (cause) {
				if (!controller.signal.aborted) {
					dispatch({ type: 'price-check-failed', error: collectionIndexFailure(cause) });
				}
			} finally {
				if (!controller.signal.aborted) dispatch({ type: 'price-check-settled' });
			}
		})();
		return () => controller.abort();
	}, [listingsPending, options.collection, options.listedOnly, listingScope, priceAttempt, visiblePriceKey]);

	// Discover indexed offers and check each against live state. A pass in the same scope continues from the
	// assets it already covered.
	React.useEffect(() => {
		const collection = collectionRef.current;
		if (!collection) {
			listingScopeRef.current = '';
			listingCandidates.current.clear();
			listingLoadedAssetIds.current.clear();
			failedListingCandidates.current.clear();
			dispatch({ type: 'cleared' });
			return;
		}
		const controller = new AbortController();
		const includesCollectionAsset = collectionCandidateMembership(collection);
		const plan = planCollectionListingScan(
			collection,
			listingScopeRef.current === listingScope,
			listingLoadedAssetIds.current
		);
		listingScopeRef.current = listingScope;
		if (!plan.continuing) {
			listingCandidates.current.clear();
			listingLoadedAssetIds.current.clear();
			failedListingCandidates.current.clear();
		}
		dispatch({ type: 'scan-started', continuing: plan.continuing, requested: plan.requested });
		if (!plan.requested) return () => controller.abort();
		const publications = createAnimationFrameBatch<CollectionListingPublication>((batch) =>
			dispatch({ type: 'scan-published', batch })
		);
		void (async () => {
			try {
				const resolver = createAssetCandidateResolver([collection], {
					concurrency: 2,
					signal: controller.signal,
					read: readDisplayState,
					onSettled: (result, candidate, cause) => {
						if (controller.signal.aborted || listingScopeRef.current !== listingScope) return;
						resolvedPriceIds.current.add(candidate.processId);
						const failureKind = cause ? requestFailureKind(cause) : undefined;
						if (failureKind) {
							failedListingCandidates.current.set(candidate.processId, { candidate, kind: failureKind });
						} else {
							failedListingCandidates.current.delete(candidate.processId);
						}
						publications.push(settledListingPublication(candidate.processId, result, failureKind));
					},
					onRevalidated: (result, candidate, cause) => {
						if (controller.signal.aborted || listingScopeRef.current !== listingScope || cause) return;
						resolvedPriceIds.current.add(candidate.processId);
						publications.push(revalidatedListingPublication(candidate.processId, result));
					},
				});
				const resolvePage = (page: AssetCandidate[], completedRecipients: string[] = []) => {
					if (controller.signal.aborted) return;
					const indexed = collectionListingPage(
						listingCandidates.current,
						page,
						completedRecipients,
						includesCollectionAsset
					);
					for (const processId of indexed.unindexed) resolvedPriceIds.current.add(processId);
					for (const candidate of indexed.candidates) {
						listingCandidates.current.set(candidate.processId, candidate);
					}
					dispatch({
						type: 'scan-page',
						candidates: sortCollectionListingCandidates(listingCandidates.current.values()),
						added: indexed.added.length,
						unindexed: indexed.unindexed,
					});
					resolver.enqueue(indexed.added);
				};
				let allActivity: AssetCandidate[] = [];
				let discoveryFailure: unknown;
				try {
					allActivity =
						collection.kind === 'names'
							? await discoverMarketActivity({
									signal: controller.signal,
									listingsOnly: true,
									acceptProcessId: includesCollectionAsset,
									onPage: resolvePage,
							  })
							: await discoverMarketActivityBatched({
									recipients: plan.requestedAssetIds,
									signal: controller.signal,
									listingsOnly: true,
									concurrency: 1,
									onBatch: (candidates, completedRecipients) => {
										resolvePage(candidates, completedRecipients);
										if (controller.signal.aborted || listingScopeRef.current !== listingScope)
											return;
										for (const assetId of completedRecipients) {
											listingLoadedAssetIds.current.add(assetId);
										}
									},
							  });
				} catch (cause) {
					discoveryFailure = cause;
				}
				await resolver.finish();
				publications.flush();
				if (controller.signal.aborted) return;
				if (discoveryFailure) throw discoveryFailure;
				for (const candidate of allActivity) {
					if (includesCollectionAsset(candidate.processId)) {
						listingCandidates.current.set(candidate.processId, candidate);
					}
				}
				if (collection.kind === 'names') {
					for (const assetId of plan.requestedAssetIds) listingLoadedAssetIds.current.add(assetId);
				}
				dispatch({
					type: 'scan-completed',
					candidates: sortCollectionListingCandidates(listingCandidates.current.values()),
				});
			} catch (cause) {
				if (!controller.signal.aborted) {
					publications.flush();
					dispatch({ type: 'scan-failed', error: collectionIndexFailure(cause) });
				}
			}
		})();
		return () => {
			controller.abort();
			publications.cancel();
		};
	}, [listingScope, listingWindowVersion, scanAttempt]);

	// Recheck only the listing candidates whose live state could not be read.
	React.useEffect(() => {
		const collection = collectionRef.current;
		if (!recheckAttempt || !collection || !options.listedOnly) return;
		const controller = new AbortController();
		const requestScope = listingScope;
		const candidates = [...failedListingCandidates.current.values()].map(({ candidate }) => candidate);
		if (!candidates.length) return;
		dispatch({ type: 'recheck-started' });
		void (async () => {
			try {
				await resolveAssetCandidates(candidates, [collection], {
					concurrency: 2,
					signal: controller.signal,
					read: readDisplayState,
					onSettled: (result, candidate, cause) => {
						if (controller.signal.aborted || listingScopeRef.current !== requestScope) return;
						const failureKind = cause ? requestFailureKind(cause) : undefined;
						if (failureKind) {
							failedListingCandidates.current.set(candidate.processId, { candidate, kind: failureKind });
						} else {
							failedListingCandidates.current.delete(candidate.processId);
						}
						dispatch({
							type: 'listing-rechecked',
							outcome: { processId: candidate.processId, result },
							price: collectionListingPrice(result, failureKind),
							...countListingFailures(failedListingCandidates.current.values()),
						});
					},
					onRevalidated: (result, candidate, cause) => {
						if (controller.signal.aborted || listingScopeRef.current !== requestScope) return;
						if (cause) return;
						dispatch({
							type: 'listing-resolved',
							outcome: { processId: candidate.processId, result },
							price: collectionListingPrice(result),
						});
					},
				});
			} catch {
				// Aborts leave retained listings and retry metadata unchanged.
			} finally {
				if (!controller.signal.aborted && listingScopeRef.current === requestScope) {
					dispatch({ type: 'recheck-finished' });
				}
			}
		})();
		return () => controller.abort();
	}, [options.listedOnly, recheckAttempt, listingScope]);

	return {
		gateway,
		assets,
		candidates: listings.candidates,
		listed: listings.listed,
		liveRows,
		progress: listings.progress,
		announcedProgress: announcement.current,
		loading: listingsPending,
		failed: Boolean(asyncError(state.listings)),
		rechecking: state.rechecking,
		prices,
		pricesLoading: isAsyncPending(state.prices),
		pricesFailed: Boolean(asyncError(state.prices)),
		retryListings: () => setScanAttempt((current) => current + 1),
		recheckUnavailableListings: () => setRecheckAttempt((current) => current + 1),
		retryPrices: () => {
			const unavailable = unavailableCollectionPriceIds(prices);
			for (const processId of unavailable) resolvedPriceIds.current.delete(processId);
			dispatch({ type: 'prices-retried', processIds: unavailable });
			setPriceAttempt((current) => current + 1);
		},
		warmToken: (processId) => prefetchAssetPage(processId, true),
	};
}
