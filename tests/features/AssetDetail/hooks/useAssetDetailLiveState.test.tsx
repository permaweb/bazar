// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssetState } from 'api/marketplace';

import { useAssetDetailLiveState } from 'features/AssetDetail/hooks/useAssetDetailLiveState';

import { renderHook, settle } from './render-hook';

const assetId = 'A'.repeat(43);
const otherAssetId = 'B'.repeat(43);

const cachedAssetState = vi.fn();
const invalidateAssetState = vi.fn();
const prioritizeAssetStatePrefetch = vi.fn();
const readAssetStateCached = vi.fn();

vi.mock('api/marketplace', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/marketplace')>()),
	cachedAssetState: (processId: string) => cachedAssetState(processId),
	invalidateAssetState: (processId: string) => invalidateAssetState(processId),
	prioritizeAssetStatePrefetch: (processId: string) => prioritizeAssetStatePrefetch(processId),
	readAssetStateCached: (processId: string, options: unknown) => readAssetStateCached(processId, options),
}));

vi.mock('api/collections', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/collections')>()),
	isVisibleAssetId: () => true,
}));

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

function deferred<T>() {
	let resolve: (value: T) => void = () => undefined;
	let reject: (cause: unknown) => void = () => undefined;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

beforeEach(() => {
	cachedAssetState.mockReset().mockReturnValue(undefined);
	invalidateAssetState.mockReset();
	prioritizeAssetStatePrefetch.mockReset();
	readAssetStateCached.mockReset().mockResolvedValue({ state: state('fresh'), provider: 'peer', verifiedAt: 7 });
});

afterEach(() => vi.restoreAllMocks());

describe('asset detail live state', () => {
	it('reads live state on mount and settles on the reading', async () => {
		const harness = renderHook(useAssetDetailLiveState, { assetId, canResolve: true, visibilityReady: true });
		expect(harness.current().loading).toBe(true);
		expect(prioritizeAssetStatePrefetch).toHaveBeenCalledWith(assetId);
		await settle(2);
		expect(harness.current()).toMatchObject({
			loading: false,
			error: null,
			provider: 'peer',
			verifiedAt: 7,
		});
		expect(harness.current().state?.name).toBe('fresh');
		expect(readAssetStateCached).toHaveBeenCalledTimes(1);
		harness.unmount();
	});

	it('renders a cached reading immediately and keeps it while the live read runs', async () => {
		cachedAssetState.mockReturnValue({ state: state('cached'), provider: 'cache' });
		const pending = deferred<{ state: AssetState; provider: string }>();
		readAssetStateCached.mockReturnValue(pending.promise);
		const harness = renderHook(useAssetDetailLiveState, { assetId, canResolve: true, visibilityReady: true });
		expect(harness.current()).toMatchObject({ loading: true, provider: 'cache', verifiedAt: null });
		expect(harness.current().state?.name).toBe('cached');
		pending.resolve({ state: state('fresh'), provider: 'peer' });
		await settle(2);
		expect(harness.current().state?.name).toBe('fresh');
		expect(harness.current().loading).toBe(false);
		harness.unmount();
	});

	it('stays loading through a background revalidation', async () => {
		const revalidation = deferred<{ state: AssetState; provider: string }>();
		readAssetStateCached.mockResolvedValue({
			state: state('stale'),
			provider: 'peer',
			revalidation: revalidation.promise,
		});
		const harness = renderHook(useAssetDetailLiveState, { assetId, canResolve: true, visibilityReady: true });
		await settle(2);
		expect(harness.current()).toMatchObject({ loading: true, error: null });
		expect(harness.current().state?.name).toBe('stale');
		revalidation.resolve({ state: state('revalidated'), provider: 'peer-2' });
		await settle(2);
		expect(harness.current()).toMatchObject({ loading: false, provider: 'peer-2' });
		expect(harness.current().state?.name).toBe('revalidated');
		harness.unmount();
	});

	it('keeps the last good reading visible when a refresh fails', async () => {
		const harness = renderHook(useAssetDetailLiveState, { assetId, canResolve: true, visibilityReady: true });
		await settle(2);
		readAssetStateCached.mockRejectedValue(new Error('compute unreachable'));
		await React.act(async () => {
			await harness.current().refresh();
		});
		expect(invalidateAssetState).toHaveBeenCalledWith(assetId);
		expect(harness.current().state?.name).toBe('fresh');
		expect(harness.current().loading).toBe(false);
		expect(harness.current().error).toContain('Retry');
		harness.unmount();
	});

	it('never reads state the route cannot resolve', async () => {
		const harness = renderHook(useAssetDetailLiveState, { assetId, canResolve: false, visibilityReady: true });
		await settle(2);
		expect(readAssetStateCached).not.toHaveBeenCalled();
		expect(harness.current()).toMatchObject({ state: null, loading: false, error: null, provider: '' });
		harness.unmount();
	});

	it('ignores a previous asset’s response after the route changes', async () => {
		const first = deferred<{ state: AssetState; provider: string }>();
		readAssetStateCached.mockReturnValueOnce(first.promise);
		const harness = renderHook(useAssetDetailLiveState, { assetId, canResolve: true, visibilityReady: true });
		readAssetStateCached.mockResolvedValue({ state: state('second-asset'), provider: 'peer' });
		harness.rerender({ assetId: otherAssetId, canResolve: true, visibilityReady: true });
		await settle(2);
		expect(harness.current().state?.name).toBe('second-asset');
		first.resolve({ state: state('first-asset'), provider: 'stale-peer' });
		await settle(2);
		expect(harness.current().state?.name).toBe('second-asset');
		harness.unmount();
	});

	it('aborts the live read when the page unmounts', async () => {
		let signal: AbortSignal | undefined;
		readAssetStateCached.mockImplementation((_processId: string, options: { signal?: AbortSignal }) => {
			signal = options.signal;
			return new Promise(() => undefined);
		});
		const harness = renderHook(useAssetDetailLiveState, { assetId, canResolve: true, visibilityReady: true });
		expect(signal?.aborted).toBe(false);
		harness.unmount();
		expect(signal?.aborted).toBe(true);
	});

	it('re-reads live state when the tab becomes visible again', async () => {
		const harness = renderHook(useAssetDetailLiveState, { assetId, canResolve: true, visibilityReady: true });
		await settle(2);
		expect(readAssetStateCached).toHaveBeenCalledTimes(1);
		await React.act(async () => {
			document.dispatchEvent(new Event('visibilitychange'));
			await Promise.resolve();
		});
		expect(readAssetStateCached).toHaveBeenCalledTimes(2);
		harness.unmount();
		await React.act(async () => {
			document.dispatchEvent(new Event('visibilitychange'));
			await Promise.resolve();
		});
		expect(readAssetStateCached).toHaveBeenCalledTimes(2);
	});
});
