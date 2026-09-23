import React from 'react';

import { isVisibleAssetId } from 'api/collections';
import {
	type AssetState,
	cachedAssetState,
	invalidateAssetState,
	prioritizeAssetStatePrefetch,
	readAssetStateCached,
} from 'api/marketplace';

import { toAppError } from 'helpers/app-error';
import { aoRoutingScopeFromLocation } from 'helpers/config';

import { assetStateErrorMessage } from '../model/asset-detail';
import {
	assetLiveStateKey,
	assetLiveStateReducer,
	assetLiveView,
	cachedAssetLiveSnapshot,
	initialAssetLiveState,
	receivedAssetLiveSnapshot,
} from '../model/asset-detail-live-state';

export type AssetDetailLiveState = {
	state: AssetState | null;
	provider: string;
	verifiedAt: number | null;
	loading: boolean;
	error: string | null;
	/** Re-read live state, keeping what is on screen until the new reading arrives. */
	load(): Promise<void>;
	/** Drop the cached reading, then re-read live state. */
	refresh(): Promise<void>;
};

/**
 * Cache-first live AO state for one asset. The latest request wins: each read aborts the previous one, and only the
 * newest request may update the page. Reads repeat when the tab becomes visible again.
 */
export function useAssetDetailLiveState(input: {
	assetId: string;
	canResolve: boolean;
	visibilityReady: boolean;
}): AssetDetailLiveState {
	const aoRoutingScope = aoRoutingScopeFromLocation();
	const prefetched = React.useMemo(
		() => (input.visibilityReady ? cachedAssetLiveSnapshot(cachedAssetState(input.assetId)) : undefined),
		// The routing scope selects the cache partition that cachedAssetState reads.
		[aoRoutingScope, input.assetId, input.visibilityReady]
	);
	const key = assetLiveStateKey(input.assetId, aoRoutingScope);
	const [live, dispatch] = React.useReducer(assetLiveStateReducer, undefined, () =>
		initialAssetLiveState(key, prefetched)
	);
	const requestRef = React.useRef<AbortController>();

	const load = React.useCallback(async () => {
		requestRef.current?.abort();
		if (!input.canResolve) {
			dispatch({ type: 'unresolvable', key });
			return;
		}
		const controller = new AbortController();
		requestRef.current = controller;
		const isLatest = () => requestRef.current === controller && !controller.signal.aborted;
		dispatch({ type: 'requested', key, cached: cachedAssetLiveSnapshot(cachedAssetState(input.assetId)) });
		try {
			const result = await readAssetStateCached(input.assetId, {
				maxAge: 0,
				cacheTtlMs: 20_000,
				force: true,
				signal: controller.signal,
			});
			if (isLatest()) {
				dispatch({
					type: 'received',
					key,
					snapshot: receivedAssetLiveSnapshot(result, Date.now()),
					revalidating: Boolean(result.revalidation),
				});
			}
			if (result.revalidation) {
				const fresh = await result.revalidation;
				if (isLatest()) {
					dispatch({ type: 'revalidated', key, snapshot: receivedAssetLiveSnapshot(fresh, Date.now()) });
				}
			}
		} catch (cause) {
			if (isLatest()) dispatch({ type: 'failed', key, error: toAppError(cause, 'compute-unavailable') });
		}
	}, [input.assetId, input.canResolve, key]);

	const refresh = React.useCallback(async () => {
		invalidateAssetState(input.assetId);
		await load();
	}, [input.assetId, load]);

	React.useEffect(() => {
		if (isVisibleAssetId(input.assetId)) void prioritizeAssetStatePrefetch(input.assetId);
		void load();
		return () => {
			requestRef.current?.abort();
		};
	}, [input.assetId, load]);

	React.useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') void load();
		};
		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
	}, [load]);

	const view = assetLiveView(live, key, prefetched);
	return {
		state: view.snapshot?.state ?? null,
		provider: view.snapshot?.provider ?? '',
		verifiedAt: view.snapshot?.verifiedAt ?? null,
		loading: view.loading,
		error: view.error ? assetStateErrorMessage(view.error) : null,
		load,
		refresh,
	};
}
