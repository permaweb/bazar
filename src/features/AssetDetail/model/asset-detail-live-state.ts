import type { AssetState } from 'api/marketplace';

import type { AppError } from 'helpers/app-error';
import {
	asyncData,
	asyncError,
	type AsyncState,
	beginLoad,
	failLoad,
	IDLE,
	isAsyncPending,
	LOADING,
} from 'helpers/async-state';

/** One live read of an asset process: its state, the AO peer that computed it, and when it was verified. */
export type AssetLiveSnapshot = { state: AssetState; provider: string; verifiedAt: number | null };

/** The shape the marketplace state store returns for cached and fresh reads. */
export type AssetStateReading = { state: AssetState; provider: string; verifiedAt?: number };

/**
 * Live state for one asset under one AO routing scope. `key` scopes the read so a result for a previous asset or
 * peer selection is never presented as current.
 */
export type AssetLiveState = { key: string; read: AsyncState<AssetLiveSnapshot> };

export type AssetLiveStateEvent =
	| { type: 'unresolvable'; key: string }
	| { type: 'requested'; key: string; cached: AssetLiveSnapshot | undefined }
	| { type: 'received'; key: string; snapshot: AssetLiveSnapshot; revalidating: boolean }
	| { type: 'revalidated'; key: string; snapshot: AssetLiveSnapshot }
	| { type: 'failed'; key: string; error: AppError };

export function assetLiveStateKey(assetId: string, routingScope: string): string {
	return `${assetId}\0${routingScope}`;
}

/** A cached reading shown before the live read finishes; it keeps its own verification time or none. */
export function cachedAssetLiveSnapshot(reading: AssetStateReading | undefined): AssetLiveSnapshot | undefined {
	return reading
		? { state: reading.state, provider: reading.provider, verifiedAt: reading.verifiedAt ?? null }
		: undefined;
}

/** A reading returned by a live request; a reading without a timestamp was verified now. */
export function receivedAssetLiveSnapshot(reading: AssetStateReading, now: number): AssetLiveSnapshot {
	return { state: reading.state, provider: reading.provider, verifiedAt: reading.verifiedAt ?? now };
}

export function initialAssetLiveState(key: string, prefetched: AssetLiveSnapshot | undefined): AssetLiveState {
	return { key, read: prefetched ? { status: 'refreshing', data: prefetched } : LOADING };
}

export function assetLiveStateReducer(current: AssetLiveState, event: AssetLiveStateEvent): AssetLiveState {
	const sameAsset = current.key === event.key;
	switch (event.type) {
		case 'unresolvable':
			return { key: event.key, read: IDLE };
		case 'requested':
			// Keep what this asset already shows; a newly selected asset starts from its cached reading, if any.
			return {
				key: event.key,
				read: sameAsset
					? beginLoad(current.read)
					: event.cached
					? { status: 'refreshing', data: event.cached }
					: LOADING,
			};
		case 'received':
			return {
				key: event.key,
				read: event.revalidating
					? { status: 'refreshing', data: event.snapshot }
					: { status: 'success', data: event.snapshot },
			};
		case 'revalidated':
			return { key: event.key, read: { status: 'success', data: event.snapshot } };
		case 'failed':
			return {
				key: event.key,
				read: sameAsset ? failLoad(current.read, event.error) : { status: 'error', error: event.error },
			};
	}
}

export type AssetLiveView = {
	snapshot: AssetLiveSnapshot | undefined;
	loading: boolean;
	error: AppError | undefined;
};

/**
 * What the page presents for `key`. Until the reducer has caught up with a newly selected asset, the prefetched
 * reading (if any) is shown as loading so a previous asset's state never flashes on the new route.
 */
export function assetLiveView(
	current: AssetLiveState,
	key: string,
	prefetched: AssetLiveSnapshot | undefined
): AssetLiveView {
	if (current.key !== key) return { snapshot: prefetched, loading: true, error: undefined };
	return {
		snapshot: asyncData(current.read),
		loading: isAsyncPending(current.read),
		error: asyncError(current.read),
	};
}
