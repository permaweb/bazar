import React from 'react';

import {
	type CollectionActivityEvent,
	confirmPurchaseActivity,
	discoverCollectionActivityPage,
	loadMarketActivity,
	saveMarketActivity,
} from 'api/discovery';
import { type AssetState, readAssetStateCached } from 'api/marketplace';

import type { TokenPricePoint } from '../components/organisms/TokenPriceChart';
import { uniquePriceHistory } from '../model/asset-detail';
import {
	assetActivityCanLoadOlder,
	assetActivityError,
	assetActivityFeedReducer,
	type AssetActivityFeedView,
	assetActivityFeedView,
	assetReservedForWallet,
	INITIAL_ASSET_ACTIVITY_FEED,
} from '../model/asset-detail-activity';

const ASK_ACTIONS: CollectionActivityEvent['action'][] = ['make-offer', 'register-interest'];

export type AssetDetailActivity = {
	/** Indexed market history for the asset. */
	activity: AssetActivityFeedView;
	/** Indexed listings and purchases, with purchases confirmed against live state, for ask history. */
	asks: AssetActivityFeedView;
	askPricePoints: TokenPricePoint[];
	/** Start loading both feeds; they stay idle until a section or flow needs them. */
	requestActivity(): void;
	retryActivity(): void;
	retryAsks(): void;
	loadOlderActivity(): Promise<void>;
	loadOlderAsks(): Promise<void>;
};

function activityStorageScope(assetId: string) {
	return `asset:${assetId}`;
}

function readCachedActivity(assetId: string): CollectionActivityEvent[] {
	try {
		return loadMarketActivity(window.localStorage, activityStorageScope(assetId));
	} catch {
		return [];
	}
}

/** Returns whether the page was cached; the live result remains available when storage is unavailable. */
function storeCachedActivity(assetId: string, events: CollectionActivityEvent[]): boolean {
	try {
		saveMarketActivity(window.localStorage, activityStorageScope(assetId), events);
		return true;
	} catch {
		return false;
	}
}

function confirmAsks(events: CollectionActivityEvent[], signal: AbortSignal) {
	return confirmPurchaseActivity(events, {
		signal,
		verificationTimeoutMs: 15_000,
		readCurrent: (processId, readSignal) => readAssetStateCached(processId, { signal: readSignal, maxAttempts: 1 }),
	});
}

/**
 * The asset's indexed activity and ask history. Both feeds wait until `requestActivity` (or a live reservation held
 * by the connected wallet) asks for them, reset when the asset changes, and ignore responses for a previous asset.
 * Activity renders from the browser cache first; older pages load on demand, one request at a time per feed.
 */
export function useAssetDetailActivity(input: {
	assetId: string;
	/** The id of the resolved asset, or null while the route cannot present one. */
	resolvedAssetKey: string | null;
	state: AssetState | null;
	walletAddress: string | null;
}): AssetDetailActivity {
	const [requested, setRequested] = React.useState(false);
	const [activityRetry, setActivityRetry] = React.useState(0);
	const [askRetry, setAskRetry] = React.useState(0);
	const [activityFeed, dispatchActivity] = React.useReducer(assetActivityFeedReducer, INITIAL_ASSET_ACTIVITY_FEED);
	const [askFeed, dispatchAsks] = React.useReducer(assetActivityFeedReducer, INITIAL_ASSET_ACTIVITY_FEED);
	const activityAssetRef = React.useRef('');
	const askAssetRef = React.useRef('');
	const activityLoadMoreRef = React.useRef<AbortController | null>(null);
	const askLoadMoreRef = React.useRef<AbortController | null>(null);

	React.useEffect(() => {
		if (assetReservedForWallet(input.state, input.walletAddress)) setRequested(true);
	}, [input.state, input.walletAddress]);

	React.useEffect(() => {
		const controller = new AbortController();
		const assetId = input.assetId;
		if (activityAssetRef.current !== assetId) {
			activityLoadMoreRef.current?.abort();
			activityAssetRef.current = assetId;
			dispatchActivity({ type: 'reset', assetId, events: readCachedActivity(assetId) });
		}
		if (input.resolvedAssetKey === null || !requested) {
			dispatchActivity({ type: 'paused' });
			return () => controller.abort();
		}
		dispatchActivity({ type: 'page-requested' });
		void discoverCollectionActivityPage({ recipients: [assetId], signal: controller.signal, pageSize: 24 }).then(
			(page) => {
				if (controller.signal.aborted) return;
				dispatchActivity({ type: 'page-received', assetId, page, pending: false });
				storeCachedActivity(assetId, page.events);
			},
			(cause) => {
				if (!controller.signal.aborted) {
					dispatchActivity({ type: 'page-failed', assetId, error: assetActivityError(cause) });
				}
			}
		);
		return () => controller.abort();
	}, [activityRetry, input.assetId, input.resolvedAssetKey, requested]);

	React.useEffect(() => {
		const controller = new AbortController();
		const assetId = input.assetId;
		if (askAssetRef.current !== assetId) {
			askLoadMoreRef.current?.abort();
			askAssetRef.current = assetId;
			dispatchAsks({ type: 'reset', assetId, events: [] });
		}
		if (input.resolvedAssetKey === null || !requested) {
			dispatchAsks({ type: 'paused' });
			return () => controller.abort();
		}
		dispatchAsks({ type: 'page-requested' });
		void (async () => {
			try {
				const page = await discoverCollectionActivityPage({
					actions: ASK_ACTIONS,
					pageSize: 100,
					recipients: [assetId],
					signal: controller.signal,
				});
				if (controller.signal.aborted) return;
				dispatchAsks({ type: 'page-received', assetId, page, pending: true });
				const confirmed = await confirmAsks(page.events, controller.signal);
				if (!controller.signal.aborted && askAssetRef.current === assetId) {
					dispatchAsks({ type: 'page-confirmed', assetId, events: confirmed });
				}
			} catch (cause) {
				if (!controller.signal.aborted) {
					dispatchAsks({ type: 'page-failed', assetId, error: assetActivityError(cause) });
				}
			}
		})();
		return () => controller.abort();
	}, [askRetry, input.assetId, input.resolvedAssetKey, requested]);

	React.useEffect(() => {
		setRequested(false);
	}, [input.assetId]);

	React.useEffect(
		() => () => {
			activityLoadMoreRef.current?.abort();
			askLoadMoreRef.current?.abort();
		},
		[]
	);

	const loadOlderActivity = React.useCallback(async () => {
		if (!assetActivityCanLoadOlder(activityFeed)) return;
		const cursor = activityFeed.cursor;
		const assetId = input.assetId;
		activityLoadMoreRef.current?.abort();
		const controller = new AbortController();
		activityLoadMoreRef.current = controller;
		dispatchActivity({ type: 'older-requested' });
		try {
			const page = await discoverCollectionActivityPage({
				cursor,
				pageSize: 100,
				recipients: [assetId],
				signal: controller.signal,
			});
			if (controller.signal.aborted || activityAssetRef.current !== assetId) return;
			dispatchActivity({ type: 'older-received', assetId, page, pending: false });
		} catch (cause) {
			if (!controller.signal.aborted) {
				dispatchActivity({ type: 'older-failed', assetId, error: assetActivityError(cause) });
			}
		}
	}, [activityFeed, input.assetId]);

	const loadOlderAsks = React.useCallback(async () => {
		if (!assetActivityCanLoadOlder(askFeed)) return;
		const cursor = askFeed.cursor;
		const assetId = input.assetId;
		askLoadMoreRef.current?.abort();
		const controller = new AbortController();
		askLoadMoreRef.current = controller;
		dispatchAsks({ type: 'older-requested' });
		try {
			const page = await discoverCollectionActivityPage({
				actions: ASK_ACTIONS,
				cursor,
				pageSize: 100,
				recipients: [assetId],
				signal: controller.signal,
			});
			if (controller.signal.aborted || askAssetRef.current !== assetId) return;
			dispatchAsks({ type: 'older-received', assetId, page, pending: true });
			const confirmed = await confirmAsks(page.events, controller.signal);
			if (controller.signal.aborted || askAssetRef.current !== assetId) return;
			dispatchAsks({ type: 'older-confirmed', assetId, events: confirmed });
		} catch (cause) {
			if (!controller.signal.aborted) {
				dispatchAsks({ type: 'older-failed', assetId, error: assetActivityError(cause) });
			}
		}
	}, [askFeed, input.assetId]);

	const requestActivity = React.useCallback(() => setRequested(true), []);
	const retryActivity = React.useCallback(() => setActivityRetry((value) => value + 1), []);
	const retryAsks = React.useCallback(() => setAskRetry((value) => value + 1), []);

	const asks = assetActivityFeedView(askFeed);
	const askPricePoints = React.useMemo(() => uniquePriceHistory(asks.events), [asks.events]);

	return {
		activity: assetActivityFeedView(activityFeed),
		asks,
		askPricePoints,
		requestActivity,
		retryActivity,
		retryAsks,
		loadOlderActivity,
		loadOlderAsks,
	};
}
