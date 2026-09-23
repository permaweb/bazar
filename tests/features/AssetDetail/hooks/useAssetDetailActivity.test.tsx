// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CollectionActivityEvent } from 'api/discovery';
import type { AssetState, SwapOrder } from 'api/marketplace';

import { useAssetDetailActivity } from 'features/AssetDetail/hooks/useAssetDetailActivity';

import { renderHook, settle } from './render-hook';

const assetId = 'A'.repeat(43);
const otherAssetId = 'B'.repeat(43);
const wallet = 'W'.repeat(43);
const orderId = 'O'.repeat(43);

const discoverCollectionActivityPage = vi.fn();
const loadMarketActivity = vi.fn();
const saveMarketActivity = vi.fn();

vi.mock('api/discovery', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/discovery')>()),
	discoverCollectionActivityPage: (options: unknown) => discoverCollectionActivityPage(options),
	loadMarketActivity: (storage: unknown, scope: string) => loadMarketActivity(storage, scope),
	saveMarketActivity: (storage: unknown, scope: string, events: unknown) =>
		saveMarketActivity(storage, scope, events),
}));

function event(id: string, height: number): CollectionActivityEvent {
	return { id, processId: assetId, action: 'transfer', actor: wallet, height, timestamp: height * 10 };
}

function page(events: CollectionActivityEvent[], cursor: string | null = null) {
	return { events, cursor, hasNextPage: Boolean(cursor), totalCount: events.length };
}

function reservedState(): AssetState {
	const order = {
		orderId,
		creator: 'S'.repeat(43),
		recipient: 'C'.repeat(43),
		asking: '10',
		deposit: '0',
		minimumFee: '0',
		deadline: 100,
		createdAt: 1,
		quantity: '1',
		status: 'reserved',
		buyer: wallet,
	} as SwapOrder;
	return {
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
	};
}

type ActivityInput = Parameters<typeof useAssetDetailActivity>[0];

const idle: ActivityInput = { assetId, resolvedAssetKey: null, state: null, walletAddress: wallet };
const resolved: ActivityInput = { ...idle, resolvedAssetKey: assetId };

beforeEach(() => {
	discoverCollectionActivityPage.mockReset().mockResolvedValue(page([]));
	loadMarketActivity.mockReset().mockReturnValue([]);
	saveMarketActivity.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe('asset detail activity', () => {
	it('renders cached events without reading the index until the page needs it', async () => {
		loadMarketActivity.mockReturnValue([event('cached', 1)]);
		const harness = renderHook(useAssetDetailActivity, resolved);
		await settle(2);
		expect(loadMarketActivity).toHaveBeenCalledWith(window.localStorage, `asset:${assetId}`);
		expect(harness.current().activity).toMatchObject({ events: [event('cached', 1)], loading: false, error: null });
		expect(discoverCollectionActivityPage).not.toHaveBeenCalled();
		harness.unmount();
	});

	it('survives unreadable activity storage', async () => {
		loadMarketActivity.mockImplementation(() => {
			throw new Error('storage disabled');
		});
		const harness = renderHook(useAssetDetailActivity, resolved);
		await settle(2);
		expect(harness.current().activity.events).toEqual([]);
		harness.unmount();
	});

	it('loads both feeds once requested and caches the indexed history', async () => {
		discoverCollectionActivityPage.mockImplementation((options: { actions?: string[] }) =>
			Promise.resolve(options.actions ? page([event('ask', 3)]) : page([event('history', 2)]))
		);
		const harness = renderHook(useAssetDetailActivity, resolved);
		await settle(2);
		await React.act(async () => {
			harness.current().requestActivity();
			await Promise.resolve();
		});
		await settle(3);
		expect(harness.current().activity.events).toEqual([event('history', 2)]);
		expect(harness.current().asks.events).toEqual([event('ask', 3)]);
		expect(harness.current().activity.loading).toBe(false);
		expect(harness.current().asks.loading).toBe(false);
		expect(saveMarketActivity).toHaveBeenCalledWith(window.localStorage, `asset:${assetId}`, [event('history', 2)]);
		// Registrations stay submissions: neither feed runs a historical purchase verification pass.
		expect(discoverCollectionActivityPage).toHaveBeenCalledTimes(2);
		harness.unmount();
	});

	it('requests activity on its own once live state shows a reservation this wallet holds', async () => {
		const harness = renderHook(useAssetDetailActivity, resolved);
		await settle(2);
		expect(discoverCollectionActivityPage).not.toHaveBeenCalled();
		harness.rerender({ ...resolved, state: reservedState() });
		await settle(3);
		expect(discoverCollectionActivityPage).toHaveBeenCalled();
		harness.unmount();
	});

	it('keeps loaded events when the index read fails', async () => {
		loadMarketActivity.mockReturnValue([event('cached', 1)]);
		discoverCollectionActivityPage.mockRejectedValue(new Error('index unavailable'));
		const harness = renderHook(useAssetDetailActivity, resolved);
		await React.act(async () => {
			harness.current().requestActivity();
			await Promise.resolve();
		});
		await settle(3);
		expect(harness.current().activity).toMatchObject({ events: [event('cached', 1)], loading: false });
		expect(harness.current().activity.error).toContain('Arweave');
		harness.unmount();
	});

	it('merges an older page and stops offering pagination at the end of the index', async () => {
		discoverCollectionActivityPage.mockImplementation((options: { actions?: string[]; cursor?: string }) => {
			if (options.actions) return Promise.resolve(page([]));
			return Promise.resolve(options.cursor ? page([event('older', 1)]) : page([event('newest', 5)], 'cursor-1'));
		});
		const harness = renderHook(useAssetDetailActivity, resolved);
		await React.act(async () => {
			harness.current().requestActivity();
			await Promise.resolve();
		});
		await settle(3);
		expect(harness.current().activity.hasNextPage).toBe(true);
		await React.act(async () => {
			await harness.current().loadOlderActivity();
		});
		expect(harness.current().activity).toMatchObject({
			events: [event('newest', 5), event('older', 1)],
			hasNextPage: false,
			loadingMore: false,
		});
		harness.unmount();
	});

	it('drops a previous asset’s page and starts the new asset from its own cache', async () => {
		const first: { resolve(value: unknown): void } = { resolve: () => undefined };
		const pending = new Promise((resolve) => {
			first.resolve = resolve;
		});
		discoverCollectionActivityPage.mockReturnValueOnce(pending).mockResolvedValue(page([event('second', 4)]));
		const harness = renderHook(useAssetDetailActivity, resolved);
		await React.act(async () => {
			harness.current().requestActivity();
			await Promise.resolve();
		});
		loadMarketActivity.mockReturnValue([event('other-cached', 9)]);
		harness.rerender({ ...resolved, assetId: otherAssetId, resolvedAssetKey: otherAssetId });
		await settle(2);
		expect(harness.current().activity.events).toEqual([event('other-cached', 9)]);
		first.resolve(page([event('first', 1)]));
		await settle(2);
		expect(harness.current().activity.events.map((item) => item.id)).not.toContain('first');
		harness.unmount();
	});

	it('aborts the indexed reads it started when the page unmounts', async () => {
		const signals: AbortSignal[] = [];
		discoverCollectionActivityPage.mockImplementation((options: { signal: AbortSignal }) => {
			signals.push(options.signal);
			return new Promise(() => undefined);
		});
		const harness = renderHook(useAssetDetailActivity, resolved);
		await React.act(async () => {
			harness.current().requestActivity();
			await Promise.resolve();
		});
		expect(signals.length).toBeGreaterThan(0);
		expect(signals.every((signal) => !signal.aborted)).toBe(true);
		harness.unmount();
		expect(signals.every((signal) => signal.aborted)).toBe(true);
	});
});
