// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type HomeSummaryRetry, useHomeSummaryRetry } from 'features/Home/hooks/useHomeSummaryRetry';
import type { HomeListingFailure } from 'features/Home/model/home-listing-scan';

import { assetId } from '../../../fixtures/home-market';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const failedAsset = assetId('A');
const computeFailure: HomeListingFailure = { status: 'unavailable', source: 'compute', kind: 'unavailable' };
const indexFailure: HomeListingFailure = { status: 'unavailable', source: 'index', kind: 'rate-limited' };

let host: HTMLElement;
let root: Root;
let retry: HomeSummaryRetry;

function Retry(props: {
	failedAssetIds: string[];
	failedCollectionIds: string[];
	listingFailure: HomeListingFailure | undefined;
}) {
	retry = useHomeSummaryRetry({
		failedAssetIds: props.failedAssetIds,
		failedCollectionIds: props.failedCollectionIds,
		listingFailure: props.listingFailure,
	});
	return null;
}

function render(props: Partial<React.ComponentProps<typeof Retry>> = {}) {
	React.act(() =>
		root.render(
			<Retry
				failedAssetIds={props.failedAssetIds ?? []}
				failedCollectionIds={props.failedCollectionIds ?? []}
				listingFailure={props.listingFailure}
			/>
		)
	);
}

function advance(ms: number) {
	React.act(() => {
		vi.advanceTimersByTime(ms);
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	host = document.createElement('div');
	document.body.append(host);
	root = createRoot(host);
});

afterEach(() => {
	React.act(() => root.unmount());
	host.remove();
	vi.useRealTimers();
});

describe('useHomeSummaryRetry', () => {
	it('does nothing without failures', () => {
		render();
		advance(20_000);
		expect(retry).toMatchObject({ attempt: 0, assetsRetrying: false, collectionsRetrying: false });
	});

	it('retries the failed groups 15 seconds after the failures settle', () => {
		render({ failedAssetIds: [failedAsset] });
		advance(14_999);
		expect(retry.attempt).toBe(0);

		advance(1);
		expect(retry).toMatchObject({ attempt: 1, assetsRetrying: true, collectionsRetrying: false });
		expect(retry.claim('assets')).toEqual({ keys: new Set([failedAsset]), token: 1 });
		expect(retry.claim('collections')).toEqual({ keys: new Set(), token: null });
		expect(retry.claim('assets').keys).toEqual(new Set());
	});

	it('ends the run when the claimed group settles with no requests left', () => {
		render({ failedAssetIds: [failedAsset] });
		advance(15_000);
		const claimed = retry.claim('assets');
		if (claimed.token === null) throw new Error('expected a claimed retry token');

		React.act(() => retry.finish(claimed.token as number, 'assets', 1));
		expect(retry.assetsRetrying).toBe(true);

		React.act(() => retry.finish(claimed.token as number, 'assets', 0));
		expect(retry).toMatchObject({ attempt: 1, assetsRetrying: false });
	});

	it('restarts the delay whenever the visible failures change', () => {
		render({ failedAssetIds: [failedAsset] });
		advance(14_000);
		render({ failedAssetIds: [failedAsset, assetId('B')] });
		advance(14_000);
		expect(retry.attempt).toBe(0);

		advance(1_000);
		expect(retry.attempt).toBe(1);
	});

	it('pauses while the listing scan reports an open compute circuit', () => {
		render({ failedAssetIds: [failedAsset], listingFailure: computeFailure });
		advance(20_000);
		expect(retry.attempt).toBe(0);

		render({ failedAssetIds: [failedAsset], listingFailure: indexFailure });
		advance(15_000);
		expect(retry.attempt).toBe(1);
	});

	it('clears its pending retry on unmount', () => {
		render({ failedCollectionIds: ['art'] });
		React.act(() => root.unmount());
		expect(vi.getTimerCount()).toBe(0);
		root = createRoot(host);
	});
});
