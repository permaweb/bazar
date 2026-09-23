import type { CollectionActivityEvent } from 'api/discovery';
import { type AssetState, liveOrderOfAsset } from 'api/marketplace';

import { type AppError, appError, appErrorMessage, requestFailureKind } from 'helpers/app-error';
import { asyncData, asyncError, type AsyncState, beginLoad, failLoad, IDLE, isAsyncPending } from 'helpers/async-state';

import { mergeAssetActivityPages } from './asset-detail';

/** One page of indexed asset activity from the transaction index. */
export type AssetActivityPage = {
	events: CollectionActivityEvent[];
	cursor: string | null;
	hasNextPage: boolean;
	totalCount: number | null;
};

/**
 * A paginated, indexed activity feed for one asset. `events` always carries the events on screen: cached events
 * while the first page loads, then indexed pages. Older pages load separately (`loadingMore`); a failure of either
 * request keeps the loaded events visible as stale data.
 */
export type AssetActivityFeed = {
	assetId: string;
	events: AsyncState<CollectionActivityEvent[]>;
	cursor: string | null;
	hasNextPage: boolean;
	totalCount: number | null;
	loadingMore: boolean;
};

export type AssetActivityFeedEvent =
	/** A different asset was selected: show its cached events and forget the previous asset's pagination. */
	| { type: 'reset'; assetId: string; events: CollectionActivityEvent[] }
	/** The feed is not needed yet: stop showing progress or errors. */
	| { type: 'paused' }
	| { type: 'page-requested' }
	/** `pending` keeps the feed loading while the page's purchases are still being confirmed. */
	| { type: 'page-received'; assetId: string; page: AssetActivityPage; pending: boolean }
	| { type: 'page-confirmed'; assetId: string; events: CollectionActivityEvent[] }
	| { type: 'page-failed'; assetId: string; error: AppError }
	| { type: 'older-requested' }
	| { type: 'older-received'; assetId: string; page: AssetActivityPage; pending: boolean }
	| { type: 'older-confirmed'; assetId: string; events: CollectionActivityEvent[] }
	| { type: 'older-failed'; assetId: string; error: AppError };

const NO_EVENTS: CollectionActivityEvent[] = [];

export const INITIAL_ASSET_ACTIVITY_FEED: AssetActivityFeed = {
	assetId: '',
	events: { status: 'success', data: NO_EVENTS },
	cursor: null,
	hasNextPage: false,
	totalCount: null,
	loadingMore: false,
};

/** Replace the events on screen without changing whether the feed is loading or failed. */
function withEvents(
	state: AsyncState<CollectionActivityEvent[]>,
	events: CollectionActivityEvent[]
): AsyncState<CollectionActivityEvent[]> {
	if (isAsyncPending(state)) return { status: 'refreshing', data: events };
	const error = asyncError(state);
	return error ? { status: 'stale', data: events, error } : { status: 'success', data: events };
}

/** Stop loading and clear any failure, keeping the events on screen. */
function settle(state: AsyncState<CollectionActivityEvent[]>): AsyncState<CollectionActivityEvent[]> {
	return 'data' in state ? { status: 'success', data: state.data } : IDLE;
}

/** Clear a failure without changing whether the first page is still loading. */
function clearError(state: AsyncState<CollectionActivityEvent[]>): AsyncState<CollectionActivityEvent[]> {
	if (state.status === 'stale') return { status: 'success', data: state.data };
	if (state.status === 'error') return IDLE;
	return state;
}

export function assetActivityFeedReducer(feed: AssetActivityFeed, event: AssetActivityFeedEvent): AssetActivityFeed {
	if ('assetId' in event && event.type !== 'reset' && event.assetId !== feed.assetId) {
		// A response for a previously selected asset.
		return feed;
	}
	const current = asyncData(feed.events) ?? NO_EVENTS;
	switch (event.type) {
		case 'reset':
			return {
				...INITIAL_ASSET_ACTIVITY_FEED,
				assetId: event.assetId,
				events: { status: 'success', data: event.events },
			};
		case 'paused':
			return { ...feed, events: settle(feed.events) };
		case 'page-requested':
			return { ...feed, events: beginLoad(feed.events) };
		case 'page-received':
			return {
				...feed,
				events: event.pending
					? { status: 'refreshing', data: event.page.events }
					: { status: 'success', data: event.page.events },
				cursor: event.page.cursor,
				hasNextPage: event.page.hasNextPage,
				totalCount: event.page.totalCount,
			};
		case 'page-confirmed':
			return { ...feed, events: { status: 'success', data: event.events } };
		case 'page-failed':
			return { ...feed, events: failLoad(feed.events, event.error) };
		case 'older-requested':
			return { ...feed, events: clearError(feed.events), loadingMore: true };
		case 'older-received':
			return {
				...feed,
				events: withEvents(feed.events, mergeAssetActivityPages(current, event.page.events)),
				cursor: event.page.cursor,
				hasNextPage: event.page.hasNextPage,
				loadingMore: event.pending,
			};
		case 'older-confirmed':
			return {
				...feed,
				events: withEvents(feed.events, mergeAssetActivityPages(current, event.events)),
				loadingMore: false,
			};
		case 'older-failed':
			return { ...feed, events: failLoad(feed.events, event.error), loadingMore: false };
	}
}

/** Whether an older page can be requested now. */
export function assetActivityCanLoadOlder(feed: AssetActivityFeed): feed is AssetActivityFeed & { cursor: string } {
	return Boolean(feed.cursor) && feed.hasNextPage && !feed.loadingMore;
}

export type AssetActivityFeedView = {
	events: CollectionActivityEvent[];
	loading: boolean;
	loadingMore: boolean;
	error: string | null;
	hasNextPage: boolean;
	totalCount: number | null;
};

export function assetActivityFeedView(feed: AssetActivityFeed): AssetActivityFeedView {
	const error = asyncError(feed.events);
	return {
		events: asyncData(feed.events) ?? NO_EVENTS,
		loading: isAsyncPending(feed.events),
		loadingMore: feed.loadingMore,
		error: error ? appErrorMessage(error) : null,
		hasNextPage: feed.hasNextPage,
		totalCount: feed.totalCount,
	};
}

/** A failed transaction-index read, classified for retry guidance. */
export function assetActivityError(cause: unknown): AppError {
	return appError(requestFailureKind(cause) === 'rate-limited' ? 'index-rate-limited' : 'index-unavailable', {
		cause,
	});
}

/** A live order reserved by this wallet needs the indexed reservation to continue, so activity loads at once. */
export function assetReservedForWallet(state: AssetState | null, walletAddress: string | null): boolean {
	if (!walletAddress || !state) return false;
	const order = liveOrderOfAsset(state);
	return order?.status === 'reserved' && order.buyer === walletAddress;
}
