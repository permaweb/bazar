import { describe, expect, it } from 'vitest';

import type { CollectionActivityEvent } from 'api/discovery';
import type { AssetState, SwapOrder } from 'api/marketplace';

import {
	assetActivityCanLoadOlder,
	assetActivityError,
	type AssetActivityFeed,
	type AssetActivityFeedEvent,
	assetActivityFeedReducer,
	assetActivityFeedView,
	assetReservedForWallet,
	INITIAL_ASSET_ACTIVITY_FEED,
} from 'features/AssetDetail/model/asset-detail-activity';
import { appError, appErrorMessage } from 'helpers/app-error';

const assetId = 'A'.repeat(43);
const wallet = 'W'.repeat(43);

function event(id: string, height: number): CollectionActivityEvent {
	return { id, processId: assetId, action: 'transfer', actor: wallet, height, timestamp: height * 10 };
}

function page(events: CollectionActivityEvent[], cursor: string | null, hasNextPage = Boolean(cursor)) {
	return { events, cursor, hasNextPage, totalCount: 42 };
}

function reduce(feed: AssetActivityFeed, ...events: AssetActivityFeedEvent[]): AssetActivityFeed {
	return events.reduce(assetActivityFeedReducer, feed);
}

const scoped = reduce(INITIAL_ASSET_ACTIVITY_FEED, { type: 'reset', assetId, events: [event('cached', 1)] });

describe('asset activity feed', () => {
	it('renders cached events for a newly selected asset and forgets the previous pagination', () => {
		const paginated = reduce(
			scoped,
			{ type: 'page-requested' },
			{
				type: 'page-received',
				assetId,
				page: page([event('live', 4)], 'cursor-1'),
				pending: false,
			}
		);
		expect(assetActivityFeedView(paginated)).toMatchObject({ hasNextPage: true, totalCount: 42 });

		const next = reduce(paginated, { type: 'reset', assetId: 'B'.repeat(43), events: [] });
		expect(assetActivityFeedView(next)).toEqual({
			events: [],
			loading: false,
			loadingMore: false,
			error: null,
			hasNextPage: false,
			totalCount: null,
		});
	});

	it('keeps cached events visible while the first indexed page loads', () => {
		const loading = reduce(scoped, { type: 'page-requested' });
		expect(assetActivityFeedView(loading)).toMatchObject({ events: [event('cached', 1)], loading: true });
	});

	it('stops loading without an error when the feed is no longer needed', () => {
		const paused = reduce(
			scoped,
			{ type: 'page-requested' },
			{ type: 'page-failed', assetId, error: appError('index-unavailable') },
			{ type: 'paused' }
		);
		expect(assetActivityFeedView(paused)).toMatchObject({ loading: false, error: null });
	});

	it('keeps loaded events as stale data when the indexed read fails', () => {
		const failed = reduce(
			scoped,
			{ type: 'page-requested' },
			{ type: 'page-failed', assetId, error: assetActivityError(new Error('gateway down')) }
		);
		expect(assetActivityFeedView(failed)).toMatchObject({
			events: [event('cached', 1)],
			loading: false,
			error: appErrorMessage(appError('index-unavailable')),
		});
	});

	it('stays loading through purchase confirmation and settles on confirmed events', () => {
		const received = reduce(
			scoped,
			{ type: 'page-requested' },
			{
				type: 'page-received',
				assetId,
				page: page([event('offer', 5)], null),
				pending: true,
			}
		);
		expect(assetActivityFeedView(received)).toMatchObject({ loading: true, events: [event('offer', 5)] });
		const confirmed = reduce(received, { type: 'page-confirmed', assetId, events: [event('confirmed', 5)] });
		expect(assetActivityFeedView(confirmed)).toMatchObject({ loading: false, events: [event('confirmed', 5)] });
	});

	it('ignores responses for a previously selected asset', () => {
		const loading = reduce(scoped, { type: 'page-requested' });
		expect(
			reduce(loading, {
				type: 'page-received',
				assetId: 'B'.repeat(43),
				page: page([event('other', 9)], null),
				pending: false,
			})
		).toBe(loading);
		expect(
			reduce(loading, { type: 'older-failed', assetId: 'B'.repeat(43), error: appError('index-unavailable') })
		).toBe(loading);
	});

	it('merges an older page and only offers pagination when a cursor remains', () => {
		const loaded = reduce(
			scoped,
			{ type: 'page-requested' },
			{
				type: 'page-received',
				assetId,
				page: page([event('newest', 9)], 'cursor-1'),
				pending: false,
			}
		);
		expect(assetActivityCanLoadOlder(loaded)).toBe(true);
		const loadingMore = reduce(loaded, { type: 'older-requested' });
		expect(assetActivityCanLoadOlder(loadingMore)).toBe(false);
		expect(assetActivityFeedView(loadingMore).loadingMore).toBe(true);

		const merged = reduce(loadingMore, {
			type: 'older-received',
			assetId,
			page: page([event('older', 2)], null, false),
			pending: false,
		});
		expect(assetActivityFeedView(merged)).toMatchObject({
			events: [event('newest', 9), event('older', 2)],
			loadingMore: false,
			hasNextPage: false,
			totalCount: 42,
		});
		expect(assetActivityCanLoadOlder(merged)).toBe(false);
	});

	it('confirms an older ask page before it stops loading', () => {
		const loaded = reduce(
			scoped,
			{ type: 'page-requested' },
			{
				type: 'page-received',
				assetId,
				page: page([event('newest', 9)], 'cursor-1'),
				pending: false,
			}
		);
		const older = reduce(
			loaded,
			{ type: 'older-requested' },
			{
				type: 'older-received',
				assetId,
				page: page([event('older', 2)], null, false),
				pending: true,
			}
		);
		expect(assetActivityFeedView(older).loadingMore).toBe(true);
		const confirmed = reduce(older, { type: 'older-confirmed', assetId, events: [event('older', 2)] });
		expect(assetActivityFeedView(confirmed).loadingMore).toBe(false);
	});

	it('keeps loaded events when an older page fails and clears that failure on the next attempt', () => {
		const loaded = reduce(
			scoped,
			{ type: 'page-requested' },
			{
				type: 'page-received',
				assetId,
				page: page([event('newest', 9)], 'cursor-1'),
				pending: false,
			}
		);
		const failed = reduce(
			loaded,
			{ type: 'older-requested' },
			{
				type: 'older-failed',
				assetId,
				error: appError('index-rate-limited'),
			}
		);
		expect(assetActivityFeedView(failed)).toMatchObject({
			events: [event('newest', 9)],
			loadingMore: false,
			error: appErrorMessage(appError('index-rate-limited')),
		});
		expect(assetActivityFeedView(reduce(failed, { type: 'older-requested' })).error).toBeNull();
	});

	it('classifies indexed read failures for retry guidance', () => {
		expect(assetActivityError(appError('rate-limited')).reason).toBe('index-rate-limited');
		expect(assetActivityError(new Error('socket hang up')).reason).toBe('index-unavailable');
	});
});

describe('reserved order activity', () => {
	const order = {
		orderId: 'O'.repeat(43),
		creator: 'C'.repeat(43),
		recipient: 'R'.repeat(43),
		asking: '10',
		deposit: '0',
		minimumFee: '0',
		deadline: 100,
		createdAt: 1,
		quantity: '1',
		status: 'reserved',
		buyer: wallet,
	} as SwapOrder;
	const state = {
		device: 'token@1.0',
		name: 'Asset',
		ticker: 'ASSET',
		denomination: 0,
		totalSupply: '1',
		balances: {},
		orders: { [order.orderId]: order },
		swapHeight: 90,
		value: null,
		raw: {},
	} as AssetState;

	it('requests activity for a reservation this wallet holds', () => {
		expect(assetReservedForWallet(state, wallet)).toBe(true);
		expect(assetReservedForWallet(state, 'X'.repeat(43))).toBe(false);
		expect(assetReservedForWallet(state, null)).toBe(false);
		expect(assetReservedForWallet(null, wallet)).toBe(false);
		expect(assetReservedForWallet({ ...state, orders: {} }, wallet)).toBe(false);
	});
});
