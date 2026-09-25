import type { Collection } from 'api/collections';
import type { AssetCandidate, ResolvedAsset } from 'api/discovery';

import { collectionActivityWindowDelta } from 'features/Activity';
import type { AppError, RequestFailureKind } from 'helpers/app-error';
import { asyncData, type AsyncState, failLoad, IDLE, LOADING } from 'helpers/async-state';

import { replaceAsyncData, settleAsyncData } from './async-data';
import {
	type CollectionCardPrice,
	type CollectionCardPrices,
	collectionListingPrice,
	type CollectionListingPublication,
	collectionRecipientsWithoutListingCandidates,
	type FailedListingCandidate,
	type ListingResolutionOutcome,
	mergeResolvedListingBatch,
} from './collection-market';

export type CollectionListingProgress = {
	pages: number;
	resolved: number;
	total: number;
	failures: number;
	rateLimited: number;
};

/** Indexed offer candidates in one collection window, the ones live state confirms, and the pass's progress. */
export type CollectionListingData = {
	candidates: AssetCandidate[];
	listed: ResolvedAsset[];
	progress: CollectionListingProgress;
};

export type CollectionListingState = {
	/** The listing pass: Arweave index discovery followed by a live-state check of every candidate. */
	listings: AsyncState<CollectionListingData>;
	/** Card prices known so far: pending while visible cards are checked, stale when a check failed. */
	prices: AsyncState<CollectionCardPrices>;
	/** Only the unavailable listing candidates are being checked again. */
	rechecking: boolean;
};

export type CollectionListingEvent =
	/** The collection is gone: forget the listing pass. */
	| { type: 'cleared' }
	/** A pass starts. A continuing pass keeps earlier results; `requested` is false when no asset needs checking. */
	| { type: 'scan-started'; continuing: boolean; requested: boolean }
	/** An index page arrived: every candidate so far, how many are new, and checked assets that have no offer. */
	| { type: 'scan-page'; candidates: AssetCandidate[]; added: number; unindexed: string[] }
	/** One animation frame of live-state results. */
	| { type: 'scan-published'; batch: CollectionListingPublication[] }
	| { type: 'scan-completed'; candidates: AssetCandidate[] }
	| { type: 'scan-failed'; error: AppError }
	/** The listing scope changed, so earlier prices no longer apply. */
	| { type: 'prices-reset' }
	| { type: 'price-check-started'; pending: boolean }
	| { type: 'prices-unindexed'; processIds: string[] }
	| { type: 'listing-resolved'; outcome: ListingResolutionOutcome; price: CollectionCardPrice }
	| { type: 'price-check-failed'; error: AppError }
	| { type: 'price-check-settled' }
	/** Forget these unavailable prices so the next check reads them again. */
	| { type: 'prices-retried'; processIds: string[] }
	| { type: 'recheck-started' }
	| {
			type: 'listing-rechecked';
			outcome: ListingResolutionOutcome;
			price: CollectionCardPrice;
			failures: number;
			rateLimited: number;
	  }
	| { type: 'recheck-finished' };

export type CollectionListingScanPlan = {
	continuing: boolean;
	requestedAssetIds: string[];
	requested: boolean;
};

export type CollectionListingPage = {
	candidates: AssetCandidate[];
	added: AssetCandidate[];
	unindexed: string[];
};

export const EMPTY_COLLECTION_LISTINGS: CollectionListingData = {
	candidates: [],
	listed: [],
	progress: { pages: 0, resolved: 0, total: 0, failures: 0, rateLimited: 0 },
};

const NO_PRICES: CollectionCardPrices = {};
const UNINDEXED: CollectionCardPrice = { status: 'unindexed' };

export function initialCollectionListingState(hasCollection: boolean): CollectionListingState {
	return {
		listings: hasCollection ? LOADING : IDLE,
		prices: { status: 'success', data: NO_PRICES },
		rechecking: false,
	};
}

export function collectionListingData(listings: AsyncState<CollectionListingData>): CollectionListingData {
	return asyncData(listings) ?? EMPTY_COLLECTION_LISTINGS;
}

export function collectionCardPrices(prices: AsyncState<CollectionCardPrices>): CollectionCardPrices {
	return asyncData(prices) ?? NO_PRICES;
}

function updateListings(
	listings: AsyncState<CollectionListingData>,
	update: (data: CollectionListingData) => CollectionListingData
): AsyncState<CollectionListingData> {
	return replaceAsyncData(listings, update(collectionListingData(listings)));
}

function updatePrices(
	prices: AsyncState<CollectionCardPrices>,
	update: (current: CollectionCardPrices) => CollectionCardPrices
): AsyncState<CollectionCardPrices> {
	const current = collectionCardPrices(prices);
	const next = update(current);
	return next === current ? prices : replaceAsyncData(prices, next);
}

function withPriceStatus(
	prices: AsyncState<CollectionCardPrices>,
	status: 'refreshing' | 'success'
): AsyncState<CollectionCardPrices> {
	return prices.status === status ? prices : { status, data: collectionCardPrices(prices) };
}

function withoutPriceFailure(prices: AsyncState<CollectionCardPrices>): AsyncState<CollectionCardPrices> {
	return prices.status === 'stale' ? { status: 'success', data: prices.data } : prices;
}

function restartListings(listings: AsyncState<CollectionListingData>): AsyncState<CollectionListingData> {
	const data = asyncData(listings);
	return data ? { status: 'refreshing', data: { ...data, progress: { ...data.progress, pages: 0 } } } : LOADING;
}

function patch(state: CollectionListingState, next: Partial<CollectionListingState>): CollectionListingState {
	const changed = (Object.keys(next) as Array<keyof CollectionListingState>).some((key) => next[key] !== state[key]);
	return changed ? { ...state, ...next } : state;
}

export function collectionListingReducer(
	state: CollectionListingState,
	event: CollectionListingEvent
): CollectionListingState {
	switch (event.type) {
		case 'cleared':
			return patch(state, { listings: IDLE, rechecking: false });
		case 'scan-started': {
			const restarted = event.continuing ? restartListings(state.listings) : LOADING;
			return patch(state, {
				listings: event.requested ? restarted : settleAsyncData(restarted, EMPTY_COLLECTION_LISTINGS),
				prices: event.requested
					? {
							status: 'refreshing',
							data: event.continuing ? collectionCardPrices(state.prices) : NO_PRICES,
					  }
					: settleAsyncData(state.prices, NO_PRICES),
				rechecking: event.continuing ? state.rechecking : false,
			});
		}
		case 'scan-page':
			return patch(state, {
				listings: updateListings(state.listings, (data) => ({
					...data,
					candidates: event.candidates,
					progress: {
						...data.progress,
						pages: data.progress.pages + 1,
						total: data.progress.total + event.added,
					},
				})),
				prices: event.unindexed.length
					? updatePrices(state.prices, (current) => ({
							...current,
							...Object.fromEntries(event.unindexed.map((processId) => [processId, UNINDEXED])),
					  }))
					: state.prices,
			});
		case 'scan-published': {
			const resolved = event.batch.reduce((total, publication) => total + publication.resolved, 0);
			const failures = event.batch.reduce((total, publication) => total + publication.failures, 0);
			const rateLimited = event.batch.reduce((total, publication) => total + publication.rateLimited, 0);
			return patch(state, {
				listings: updateListings(state.listings, (data) => ({
					...data,
					listed: mergeResolvedListingBatch(
						data.listed,
						event.batch.map((publication) => publication.outcome)
					),
					progress:
						resolved || failures || rateLimited
							? {
									...data.progress,
									resolved: data.progress.resolved + resolved,
									failures: data.progress.failures + failures,
									rateLimited: data.progress.rateLimited + rateLimited,
							  }
							: data.progress,
				})),
				prices: updatePrices(state.prices, (current) => ({
					...current,
					...Object.fromEntries(
						event.batch.map((publication) => [publication.outcome.processId, publication.price])
					),
				})),
			});
		}
		case 'scan-completed': {
			const data = collectionListingData(state.listings);
			return patch(state, {
				listings: {
					status: 'success',
					data: {
						...data,
						candidates: event.candidates,
						progress: { ...data.progress, total: event.candidates.length },
					},
				},
				prices: settleAsyncData(state.prices, NO_PRICES),
			});
		}
		case 'scan-failed':
			return patch(state, {
				listings: failLoad(state.listings, event.error),
				prices: failLoad(settleAsyncData(state.prices, NO_PRICES), event.error),
			});
		case 'prices-reset':
			return patch(state, {
				prices: withoutPriceFailure(
					updatePrices(state.prices, (current) => (current === NO_PRICES ? current : NO_PRICES))
				),
			});
		case 'price-check-started':
			return patch(state, { prices: withPriceStatus(state.prices, event.pending ? 'refreshing' : 'success') });
		case 'prices-unindexed':
			return event.processIds.length
				? patch(state, {
						prices: updatePrices(state.prices, (current) => ({
							...current,
							...Object.fromEntries(event.processIds.map((processId) => [processId, UNINDEXED])),
						})),
				  })
				: state;
		case 'listing-resolved':
			return patch(state, {
				listings: updateListings(state.listings, (data) => ({
					...data,
					listed: mergeResolvedListingBatch(data.listed, [event.outcome]),
				})),
				prices: updatePrices(state.prices, (current) => ({
					...current,
					[event.outcome.processId]: event.price,
				})),
			});
		case 'price-check-failed':
			return patch(state, { prices: failLoad(state.prices, event.error) });
		case 'price-check-settled':
			return patch(state, { prices: settleAsyncData(state.prices, NO_PRICES) });
		case 'prices-retried': {
			const retried = new Set(event.processIds);
			return patch(state, {
				prices: withoutPriceFailure(
					updatePrices(state.prices, (current) =>
						Object.fromEntries(
							Object.entries(current).filter(
								([processId, price]) => !(retried.has(processId) && price.status === 'unavailable')
							)
						)
					)
				),
			});
		}
		case 'recheck-started':
			return patch(state, { rechecking: true });
		case 'listing-rechecked':
			return patch(state, {
				listings: updateListings(state.listings, (data) => ({
					...data,
					listed: mergeResolvedListingBatch(data.listed, [event.outcome]),
					progress: { ...data.progress, failures: event.failures, rateLimited: event.rateLimited },
				})),
				prices: updatePrices(state.prices, (current) => ({
					...current,
					[event.outcome.processId]: event.price,
				})),
			});
		case 'recheck-finished':
			return patch(state, { rechecking: false });
	}
}

/**
 * Decide how a listing pass starts. A pass in the same scope continues from the assets it already checked unless
 * assets left the window; a recipient-batched pass with nothing new to check requests nothing.
 */
export function planCollectionListingScan(
	collection: Collection,
	sameScope: boolean,
	loadedAssetIds: Iterable<string>
): CollectionListingScanPlan {
	const assetIds = collection.assets.map((asset) => asset.id);
	const window = collectionActivityWindowDelta(collection.kind, true, loadedAssetIds, assetIds);
	const continuing = sameScope && !window.reset;
	const requestedAssetIds = continuing ? window.added : assetIds;
	return { continuing, requestedAssetIds, requested: !window.recipientBatched || requestedAssetIds.length > 0 };
}

/** Split one index page into this collection's candidates, the ones not seen before, and assets without offers. */
export function collectionListingPage(
	known: ReadonlyMap<string, AssetCandidate>,
	page: AssetCandidate[],
	completedRecipients: string[],
	includes: (processId: string) => boolean
): CollectionListingPage {
	const candidates = page.filter((candidate) => includes(candidate.processId));
	return {
		candidates,
		added: candidates.filter((candidate) => !known.has(candidate.processId)),
		unindexed: collectionRecipientsWithoutListingCandidates(completedRecipients.filter(includes), candidates),
	};
}

/** Newest activity first, then by process ID for a stable order. */
export function sortCollectionListingCandidates(candidates: Iterable<AssetCandidate>): AssetCandidate[] {
	return [...candidates].sort(
		(a, b) => b.height - a.height || b.timestamp - a.timestamp || a.processId.localeCompare(b.processId)
	);
}

/** A first live-state result for a candidate: it counts as checked, and as unavailable when the read failed. */
export function settledListingPublication(
	processId: string,
	result: ResolvedAsset | null,
	failureKind?: RequestFailureKind
): CollectionListingPublication {
	return {
		outcome: { processId, result },
		price: collectionListingPrice(result, failureKind),
		resolved: 1,
		failures: failureKind ? 1 : 0,
		rateLimited: failureKind === 'rate-limited' ? 1 : 0,
	};
}

/** A background revalidation of a candidate already counted: it only refreshes the listing and price. */
export function revalidatedListingPublication(
	processId: string,
	result: ResolvedAsset | null
): CollectionListingPublication {
	return {
		outcome: { processId, result },
		price: collectionListingPrice(result),
		resolved: 0,
		failures: 0,
		rateLimited: 0,
	};
}

export function countListingFailures(failures: Iterable<FailedListingCandidate>): {
	failures: number;
	rateLimited: number;
} {
	const all = [...failures];
	return { failures: all.length, rateLimited: all.filter(({ kind }) => kind === 'rate-limited').length };
}
