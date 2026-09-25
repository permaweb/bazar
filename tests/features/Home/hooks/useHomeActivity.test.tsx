// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type Collection, replaceHiddenCollectionAssetIndex } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';

import { type HomeActivityFeed, useHomeActivity } from 'features/Home/hooks/useHomeActivity';

import { assetId, imageCollection, READY_HIDDEN_COLLECTION_INDEX } from '../../../fixtures/home-market';

const discoverCollectionActivityPage = vi.hoisted(() => vi.fn());

vi.mock('api/discovery', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/discovery')>()),
	discoverCollectionActivityPage,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const asset = { id: assetId('A'), name: 'First' };
const collection = imageCollection('art', [asset]);

function event(id: string, action: CollectionActivityEvent['action'] = 'transfer'): CollectionActivityEvent {
	return { id, processId: asset.id, action, actor: assetId('W'), height: 1, timestamp: 1 };
}

function page(events: CollectionActivityEvent[], cursor: string | null = null, hasNextPage = false) {
	return { events, cursor, hasNextPage, totalCount: null };
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
	});
}

beforeEach(() => {
	replaceHiddenCollectionAssetIndex(READY_HIDDEN_COLLECTION_INDEX);
	discoverCollectionActivityPage.mockReset().mockResolvedValue(page([]));
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
	it('waits for the market catalogue before requesting a page', async () => {
		render({ marketLoading: true });
		await settle();

		expect(discoverCollectionActivityPage).not.toHaveBeenCalled();
		expect(feed.loading).toBe(true);
	});

	it('requests one bounded native page without a count field or a recipient predicate', async () => {
		discoverCollectionActivityPage.mockResolvedValue(page([event('first')], 'tail', true));

		render();
		await settle();

		expect(discoverCollectionActivityPage).toHaveBeenCalledTimes(1);
		expect(discoverCollectionActivityPage).toHaveBeenCalledWith(
			expect.objectContaining({ includeCount: false, pageSize: 100, cursor: null, actions: undefined })
		);
		expect(feed.events.map((item) => item.id)).toEqual(['first']);
		expect(feed).toMatchObject({ loading: false, hasNextPage: true, limit: 20 });
		expect(feed.announcement).toBe('1 indexed events loaded.');
	});

	it('keeps marketplace membership local to the browser', async () => {
		discoverCollectionActivityPage.mockResolvedValue(
			page([event('mine'), { ...event('other'), processId: assetId('Z') }])
		);

		render();
		await settle();

		const accept = discoverCollectionActivityPage.mock.calls[0][0].acceptProcessId;
		expect(accept(asset.id)).toBe(true);
		expect(accept(assetId('Z'))).toBe(false);
	});

	it('keeps independent cursors per filter and never rereads another filter from its own cursor', async () => {
		discoverCollectionActivityPage.mockResolvedValue(page([event('all-one')], 'all-tail', true));
		render();
		await settle();

		discoverCollectionActivityPage.mockResolvedValue(page([event('listing', 'make-offer')], 'listing-tail', true));
		React.act(() => feed.setFilter('make-offer'));
		await settle();

		expect(discoverCollectionActivityPage.mock.calls[1][0]).toMatchObject({
			cursor: null,
			actions: ['make-offer'],
		});

		React.act(() => feed.setFilter('all'));
		await settle();

		// Returning to a loaded filter shows its own page again without another request.
		expect(discoverCollectionActivityPage).toHaveBeenCalledTimes(2);
		expect(feed.events.map((item) => item.id)).toEqual(['all-one']);

		discoverCollectionActivityPage.mockResolvedValue(page([event('all-two')], 'all-tail-2', true));
		React.act(() => feed.requestPage('more'));
		await settle();

		expect(discoverCollectionActivityPage.mock.calls[2][0]).toMatchObject({ cursor: 'all-tail' });
	});

	it('extends the revealed window only when an older page request succeeds', async () => {
		discoverCollectionActivityPage.mockResolvedValue(page([event('first')], 'tail', true));
		render();
		await settle();
		expect(feed.limit).toBe(20);

		discoverCollectionActivityPage.mockResolvedValue(page([event('second')], 'tail-2', true));
		React.act(() => feed.requestPage('more'));
		await settle();

		expect(discoverCollectionActivityPage.mock.calls[1][0]).toMatchObject({ cursor: 'tail' });
		expect(feed.limit).toBe(40);
		expect(feed.events.map((item) => item.id)).toEqual(['first', 'second']);
	});

	it('keeps the last good page beside a failure and retries its exact cursor', async () => {
		discoverCollectionActivityPage.mockResolvedValue(page([event('first')], 'tail', true));
		render();
		await settle();

		discoverCollectionActivityPage.mockRejectedValue(new Error('index down'));
		React.act(() => feed.requestPage('more'));
		await settle();

		expect(feed.events.map((item) => item.id)).toEqual(['first']);
		expect(feed.error?.reason).toBe('index-unavailable');

		discoverCollectionActivityPage.mockResolvedValue(page([event('second')]));
		React.act(() => feed.requestPage('more'));
		await settle();

		expect(discoverCollectionActivityPage.mock.calls.at(-1)?.[0]).toMatchObject({ cursor: 'tail' });
		expect(feed.error).toBeUndefined();
		expect(feed.events).toHaveLength(2);
	});

	it('reports no further pages when the catalogue has no marketplace assets', async () => {
		render({ collections: [] });
		await settle();

		expect(discoverCollectionActivityPage).not.toHaveBeenCalled();
		expect(feed).toMatchObject({ events: [], loading: false, hasNextPage: false });
	});

	it('aborts its request on unmount', async () => {
		let pageSignal: AbortSignal | undefined;
		discoverCollectionActivityPage.mockImplementation(async (options: { signal: AbortSignal }) => {
			pageSignal = options.signal;
			return page([]);
		});

		render();
		React.act(() => root.unmount());
		root = createRoot(host);

		expect(pageSignal?.aborted).toBe(true);
	});
});
