// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type Collection, replaceHiddenCollectionAssetIndex } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';

import { type HomeActivityFeed, useHomeActivity } from 'features/Home/hooks/useHomeActivity';

import { assetId, imageCollection, READY_HIDDEN_COLLECTION_INDEX } from '../../../fixtures/home-market';

const confirmPurchaseActivity = vi.hoisted(() => vi.fn());
const discoverAllCollectionActivityBatched = vi.hoisted(() => vi.fn());
const loadMarketActivity = vi.hoisted(() => vi.fn());
const saveMarketActivity = vi.hoisted(() => vi.fn());

vi.mock('api/discovery', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/discovery')>()),
	confirmPurchaseActivity,
	discoverAllCollectionActivityBatched,
	loadMarketActivity,
	saveMarketActivity,
}));

vi.mock('api/network', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/network')>()),
	operationWithDeadline: (run: (signal: AbortSignal) => Promise<unknown>, signal: AbortSignal) => run(signal),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const asset = { id: assetId('A'), name: 'First' };
const collection = imageCollection('art', [asset]);

function event(id: string, action: CollectionActivityEvent['action'] = 'transfer'): CollectionActivityEvent {
	return { id, processId: asset.id, action, actor: assetId('W'), height: 1, timestamp: 1 };
}

let host: HTMLElement;
let root: Root;
let feed: HomeActivityFeed;

function Feed(props: { collections: Collection[]; marketLoading: boolean }) {
	feed = useHomeActivity(props.collections, props.marketLoading);
	return null;
}

function render(props: { collections?: Collection[]; marketLoading?: boolean } = {}) {
	React.act(() =>
		root.render(
			<Feed collections={props.collections ?? [collection]} marketLoading={props.marketLoading ?? false} />
		)
	);
}

async function settle() {
	await React.act(async () => {
		await Promise.resolve();
		await Promise.resolve();
		await new Promise((resolve) => window.requestAnimationFrame(resolve));
	});
}

beforeEach(() => {
	replaceHiddenCollectionAssetIndex(READY_HIDDEN_COLLECTION_INDEX);
	confirmPurchaseActivity.mockReset().mockResolvedValue([]);
	discoverAllCollectionActivityBatched.mockReset().mockResolvedValue([]);
	loadMarketActivity.mockReset().mockReturnValue([]);
	saveMarketActivity.mockReset();
	host = document.createElement('div');
	document.body.append(host);
	root = createRoot(host);
});

afterEach(() => {
	React.act(() => root.unmount());
	host.remove();
	replaceHiddenCollectionAssetIndex({});
});

describe('useHomeActivity', () => {
	it('waits for the market catalogue before scanning', async () => {
		render({ marketLoading: true });
		await settle();

		expect(discoverAllCollectionActivityBatched).not.toHaveBeenCalled();
		expect(feed.loading).toBe(true);
	});

	it('renders cached events immediately, then the complete indexed history', async () => {
		loadMarketActivity.mockReturnValue([event('cached')]);
		discoverAllCollectionActivityBatched.mockImplementation(
			async (options: { onPage(page: CollectionActivityEvent[]): void }) => {
				options.onPage([event('scanned')]);
				return [event('cached'), event('scanned')];
			}
		);

		render();
		expect(feed.events.map((item) => item.id)).toEqual(['cached']);
		expect(feed.loading).toBe(true);

		await settle();

		expect(discoverAllCollectionActivityBatched).toHaveBeenCalledWith(
			expect.objectContaining({ concurrency: 2, recipients: [asset.id] })
		);
		expect(feed.events.map((item) => item.id).sort()).toEqual(['cached', 'scanned']);
		expect(feed.loading).toBe(false);
		expect(saveMarketActivity).toHaveBeenCalledWith(window.localStorage, feed.scope, feed.events);
	});

	it('keeps loaded events beside an index failure and rescans on retry', async () => {
		loadMarketActivity.mockReturnValue([event('cached')]);
		discoverAllCollectionActivityBatched.mockRejectedValue(new Error('index down'));

		render();
		await settle();

		expect(feed.events.map((item) => item.id)).toEqual(['cached']);
		expect(feed.error?.reason).toBe('index-unavailable');

		discoverAllCollectionActivityBatched.mockResolvedValue([event('cached'), event('scanned')]);
		React.act(() => feed.retry());
		await settle();

		expect(feed.error).toBeUndefined();
		expect(feed.events).toHaveLength(2);
	});

	it('verifies unproven purchases without holding the history loader open', async () => {
		discoverAllCollectionActivityBatched.mockResolvedValue([event('purchase', 'register-interest')]);
		let failVerification: (cause: unknown) => void = () => undefined;
		confirmPurchaseActivity.mockImplementation(
			() =>
				new Promise((_resolve, reject) => {
					failVerification = reject;
				})
		);

		render();
		await settle();

		expect(confirmPurchaseActivity).toHaveBeenCalled();
		expect(feed.loading).toBe(false);
		expect(feed.verifyingPurchases).toBe(true);

		failVerification(new Error('verification unavailable'));
		await settle();

		expect(feed.verifyingPurchases).toBe(false);
		expect(feed.purchaseVerificationIncomplete).toBe(true);
		expect(feed.events).toHaveLength(1);
	});

	it('clears the feed when the catalogue has no collections', async () => {
		render({ collections: [] });
		await settle();

		expect(discoverAllCollectionActivityBatched).not.toHaveBeenCalled();
		expect(feed).toMatchObject({ events: [], loading: false, recipientCount: 0 });
	});

	it('aborts its scan on unmount', async () => {
		let scanSignal: AbortSignal | undefined;
		discoverAllCollectionActivityBatched.mockImplementation(async (options: { signal: AbortSignal }) => {
			scanSignal = options.signal;
			return [];
		});

		render();
		React.act(() => root.unmount());
		root = createRoot(host);

		expect(scanSignal?.aborted).toBe(true);
	});
});
