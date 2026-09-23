// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	discoverCollectionActivity: vi.fn(),
	discoverCollectionActivityBatched: vi.fn(),
	loadMarketActivity: vi.fn(),
	saveMarketActivity: vi.fn(),
}));

vi.mock('api/discovery', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/discovery')>()),
	...mocks,
}));

import { type Collection, replaceHiddenCollectionAssetIndex } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';

import { useCollectionActivity } from 'features/Collection/hooks/useCollectionActivity';
import { appError } from 'helpers/app-error';

import {
	activityEventFixture,
	assetSummary,
	collectionFixture,
	processId,
	READY_HIDDEN_COLLECTION_INDEX,
} from '../../../fixtures/collection';
import { deferred, renderHook, settle } from '../../../test-utils/render-hook';

type BatchedOptions = {
	recipients: string[];
	onBatch(events: CollectionActivityEvent[], completedRecipients: string[]): void;
};

const oneAsset = collectionFixture([assetSummary(1)]);
const twoAssets = collectionFixture([assetSummary(1), assetSummary(2)]);

function stubDiscovery() {
	const request = deferred<CollectionActivityEvent[]>();
	void request.promise.catch(() => undefined);
	const calls: BatchedOptions[] = [];
	mocks.discoverCollectionActivityBatched.mockImplementation((options: BatchedOptions) => {
		calls.push(options);
		return request.promise;
	});
	return { request, calls, latest: () => calls[calls.length - 1] };
}

function render(collection: Collection) {
	return renderHook((props: { collection: Collection }) => useCollectionActivity(props.collection), { collection });
}

beforeEach(() => {
	replaceHiddenCollectionAssetIndex(READY_HIDDEN_COLLECTION_INDEX);
	mocks.discoverCollectionActivity.mockReset();
	mocks.discoverCollectionActivityBatched.mockReset();
	mocks.loadMarketActivity.mockReset();
	mocks.loadMarketActivity.mockReturnValue([]);
	mocks.saveMarketActivity.mockReset();
});

afterEach(() => {
	replaceHiddenCollectionAssetIndex({});
});

describe('useCollectionActivity', () => {
	it('shows cached events while it refreshes them, then stores the fresh result', async () => {
		const cached = activityEventFixture(1);
		mocks.loadMarketActivity.mockReturnValue([cached]);
		const discovery = stubDiscovery();
		const harness = render(oneAsset);

		expect(harness.current().loading).toBe(true);
		expect(harness.current().preserving).toBe(true);
		expect(harness.current().events).toEqual([cached]);
		expect(discovery.latest().recipients).toEqual([processId(1)]);

		const fresh = activityEventFixture(2);
		await settle(() => discovery.latest().onBatch([fresh], [processId(1)]));
		expect(harness.current().pages).toBe(1);
		expect(harness.current().events).toEqual([fresh, cached]);

		await settle(async () => {
			discovery.request.resolve([]);
			await discovery.request.promise;
		});
		expect(harness.current().loading).toBe(false);
		expect(harness.current().preserving).toBe(false);
		expect(mocks.saveMarketActivity).toHaveBeenCalledWith(window.localStorage, 'collection-a:manifest-a', [
			fresh,
			cached,
		]);
		harness.unmount();
	});

	it('keeps known events visible when the index fails and clears the failure on retry', async () => {
		mocks.loadMarketActivity.mockReturnValue([activityEventFixture(1)]);
		const discovery = stubDiscovery();
		const harness = render(oneAsset);

		await settle(() => discovery.request.reject(appError('rate-limited')));
		expect(harness.current().loading).toBe(false);
		expect(harness.current().error?.reason).toBe('index-rate-limited');
		expect(harness.current().events).toEqual([activityEventFixture(1)]);

		stubDiscovery();
		await settle(() => harness.current().retry());
		expect(harness.current().loading).toBe(true);
		expect(harness.current().error).toBeUndefined();
		harness.unmount();
	});

	it('reads only the assets a growing collection window added', async () => {
		const discovery = stubDiscovery();
		const harness = render(oneAsset);
		const first = activityEventFixture(1);
		await settle(() => discovery.latest().onBatch([first], [processId(1)]));
		await settle(async () => {
			discovery.request.resolve([]);
			await discovery.request.promise;
		});

		const next = stubDiscovery();
		harness.rerender({ collection: twoAssets });
		expect(next.latest().recipients).toEqual([processId(2)]);

		const second = activityEventFixture(2);
		await settle(() => next.latest().onBatch([second], [processId(2)]));
		expect(harness.current().events).toEqual([second, first]);
		harness.unmount();
	});

	it('ignores a batch that arrives after the collection scope changed', async () => {
		const discovery = stubDiscovery();
		const harness = render(oneAsset);
		const stale = discovery.latest();
		const next = stubDiscovery();
		harness.rerender({ collection: collectionFixture([assetSummary(1)], { manifestId: 'manifest-b' }) });
		expect(next.calls).toHaveLength(1);

		await settle(() => stale.onBatch([activityEventFixture(9)], [processId(9)]));
		expect(harness.current().events).toEqual([]);
		expect(harness.current().pages).toBe(0);
		harness.unmount();
	});

	it('resolves each event against the collection and aborts discovery on unmount', async () => {
		const discovery = stubDiscovery();
		const harness = render(oneAsset);
		expect(harness.current().resolveAsset(activityEventFixture(1))).toEqual(assetSummary(1));
		expect(harness.current().resolveAsset(activityEventFixture(9))).toBeUndefined();

		const signal = mocks.discoverCollectionActivityBatched.mock.calls[0][0].signal as AbortSignal;
		harness.unmount();
		expect(signal.aborted).toBe(true);
		await settle(async () => {
			discovery.request.resolve([]);
			await discovery.request.promise;
		});
	});
});
