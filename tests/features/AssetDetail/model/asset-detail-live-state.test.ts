import { describe, expect, it } from 'vitest';

import type { AssetState } from 'api/marketplace';

import {
	type AssetLiveSnapshot,
	type AssetLiveState,
	assetLiveStateKey,
	assetLiveStateReducer,
	assetLiveView,
	cachedAssetLiveSnapshot,
	initialAssetLiveState,
	receivedAssetLiveSnapshot,
} from 'features/AssetDetail/model/asset-detail-live-state';
import { appError } from 'helpers/app-error';

const assetId = 'A'.repeat(43);
const key = assetLiveStateKey(assetId, 'bazar');
const otherKey = assetLiveStateKey('B'.repeat(43), 'bazar');

function state(name: string): AssetState {
	return {
		device: 'token@1.0',
		name,
		ticker: 'ASSET',
		denomination: 0,
		totalSupply: '1',
		balances: {},
		orders: {},
		swapHeight: 1,
		value: null,
		raw: {},
	};
}

function snapshot(name: string, provider = 'https://peer.example'): AssetLiveSnapshot {
	return { state: state(name), provider, verifiedAt: 10 };
}

describe('asset live state key', () => {
	it('separates assets and AO routing scopes', () => {
		expect(assetLiveStateKey(assetId, 'bazar')).not.toBe(assetLiveStateKey(assetId, 'permaweb-os'));
		expect(assetLiveStateKey(assetId, 'bazar')).toBe(key);
	});
});

describe('asset live state snapshots', () => {
	it('keeps a cached reading unverified and stamps a fresh reading with the read time', () => {
		expect(cachedAssetLiveSnapshot(undefined)).toBeUndefined();
		expect(cachedAssetLiveSnapshot({ state: state('cached'), provider: 'peer' })).toMatchObject({
			provider: 'peer',
			verifiedAt: null,
		});
		expect(receivedAssetLiveSnapshot({ state: state('fresh'), provider: 'peer' }, 1_700)).toMatchObject({
			verifiedAt: 1_700,
		});
		expect(
			receivedAssetLiveSnapshot({ state: state('fresh'), provider: 'peer', verifiedAt: 900 }, 1_700)
		).toMatchObject({ verifiedAt: 900 });
	});
});

describe('asset live state reducer', () => {
	it('starts from a cached reading as a refresh, or from nothing as a first load', () => {
		expect(initialAssetLiveState(key, snapshot('cached'))).toEqual({
			key,
			read: { status: 'refreshing', data: snapshot('cached') },
		});
		expect(initialAssetLiveState(key, undefined)).toEqual({ key, read: { status: 'loading' } });
	});

	it('keeps the current asset on screen while it reloads and adopts the cache for a new asset', () => {
		const current: AssetLiveState = { key, read: { status: 'success', data: snapshot('current') } };
		expect(assetLiveStateReducer(current, { type: 'requested', key, cached: undefined })).toEqual({
			key,
			read: { status: 'refreshing', data: snapshot('current') },
		});
		expect(assetLiveStateReducer(current, { type: 'requested', key: otherKey, cached: snapshot('other') })).toEqual(
			{ key: otherKey, read: { status: 'refreshing', data: snapshot('other') } }
		);
		expect(assetLiveStateReducer(current, { type: 'requested', key: otherKey, cached: undefined })).toEqual({
			key: otherKey,
			read: { status: 'loading' },
		});
	});

	it('stays loading through a revalidation and settles on the fresh reading', () => {
		const requested = assetLiveStateReducer(initialAssetLiveState(key, undefined), {
			type: 'requested',
			key,
			cached: undefined,
		});
		const received = assetLiveStateReducer(requested, {
			type: 'received',
			key,
			snapshot: snapshot('stale-while-revalidate'),
			revalidating: true,
		});
		expect(received.read.status).toBe('refreshing');
		const revalidated = assetLiveStateReducer(received, {
			type: 'revalidated',
			key,
			snapshot: snapshot('fresh'),
		});
		expect(revalidated.read).toEqual({ status: 'success', data: snapshot('fresh') });
	});

	it('settles immediately when a reading needs no revalidation', () => {
		expect(
			assetLiveStateReducer(initialAssetLiveState(key, undefined), {
				type: 'received',
				key,
				snapshot: snapshot('fresh'),
				revalidating: false,
			}).read
		).toEqual({ status: 'success', data: snapshot('fresh') });
	});

	it('keeps known-good state visible when a refresh fails, and reports a first failure alone', () => {
		const error = appError('compute-unavailable');
		const loaded: AssetLiveState = { key, read: { status: 'refreshing', data: snapshot('known') } };
		expect(assetLiveStateReducer(loaded, { type: 'failed', key, error })).toEqual({
			key,
			read: { status: 'stale', data: snapshot('known'), error },
		});
		expect(assetLiveStateReducer({ key, read: { status: 'loading' } }, { type: 'failed', key, error })).toEqual({
			key,
			read: { status: 'error', error },
		});
		expect(assetLiveStateReducer(loaded, { type: 'failed', key: otherKey, error })).toEqual({
			key: otherKey,
			read: { status: 'error', error },
		});
	});

	it('clears state for an asset the route cannot resolve', () => {
		expect(
			assetLiveStateReducer(
				{ key, read: { status: 'success', data: snapshot('known') } },
				{
					type: 'unresolvable',
					key,
				}
			).read
		).toEqual({ status: 'idle' });
	});
});

describe('asset live view', () => {
	it('shows the prefetched reading as loading until the reducer catches up with a new asset', () => {
		const current: AssetLiveState = { key: otherKey, read: { status: 'success', data: snapshot('previous') } };
		expect(assetLiveView(current, key, snapshot('prefetched'))).toEqual({
			snapshot: snapshot('prefetched'),
			loading: true,
			error: undefined,
		});
		expect(assetLiveView(current, key, undefined)).toEqual({
			snapshot: undefined,
			loading: true,
			error: undefined,
		});
	});

	it('reports data, progress, and failure for the current asset', () => {
		const error = appError('compute-unavailable');
		expect(
			assetLiveView({ key, read: { status: 'stale', data: snapshot('known'), error } }, key, undefined)
		).toEqual({ snapshot: snapshot('known'), loading: false, error });
		expect(assetLiveView({ key, read: { status: 'idle' } }, key, snapshot('ignored'))).toEqual({
			snapshot: undefined,
			loading: false,
			error: undefined,
		});
	});
});
