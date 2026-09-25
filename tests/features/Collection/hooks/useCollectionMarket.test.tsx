// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	discoverMarketActivity: vi.fn(),
	discoverMarketActivityBatched: vi.fn(),
	createAssetCandidateResolver: vi.fn(),
	resolveAssetCandidates: vi.fn(),
	prefetchAssetPage: vi.fn(),
}));

vi.mock('api/discovery', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/discovery')>()),
	...mocks,
}));
vi.mock('api/marketplace', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/marketplace')>()),
	prefetchAssetPage: mocks.prefetchAssetPage,
}));

import { type Collection, replaceHiddenCollectionAssetIndex } from 'api/collections';
import type { AssetCandidate, ResolvedAsset } from 'api/discovery';

import { useCollectionMarket } from 'features/Collection/hooks/useCollectionMarket';
import { appError } from 'helpers/app-error';

import {
	assetSummary,
	candidateFixture,
	collectionFixture,
	orderFixture,
	processId,
	READY_HIDDEN_COLLECTION_INDEX,
	resolvedFixture,
} from '../../../fixtures/collection';
import { deferred, renderHook, settle } from '../../../test-utils/render-hook';

type DiscoveryOptions = {
	recipients: string[];
	onBatch(candidates: AssetCandidate[], completedRecipients: string[]): void | Promise<void>;
};

type ResolutionOptions = {
	onSettled(result: ResolvedAsset | null, candidate: AssetCandidate, cause?: unknown): void;
	onRevalidated(result: ResolvedAsset | null, candidate: AssetCandidate, cause?: unknown): void;
};

const collection = collectionFixture([assetSummary(1), assetSummary(2)]);
const listing = resolvedFixture(assetSummary(1), collection);
const secondListing = resolvedFixture(assetSummary(2), collection, [orderFixture({ orderId: 'order-2' })]);

type MarketOptions = { collection: Collection; listedOnly: boolean; limit: number };

function render(options: Partial<MarketOptions> = {}) {
	const props: MarketOptions = { collection, listedOnly: true, limit: 12, ...options };
	return renderHook(
		(current: MarketOptions) =>
			useCollectionMarket({
				collection: current.collection,
				listedOnly: current.listedOnly,
				query: '',
				initial: 'all',
				sort: 'recent',
				limit: current.limit,
			}),
		props
	);
}

function discoveryCall(index: number): DiscoveryOptions {
	return mocks.discoverMarketActivityBatched.mock.calls[index][0] as DiscoveryOptions;
}

function resolverOptions(): ResolutionOptions {
	const calls = mocks.createAssetCandidateResolver.mock.calls;
	return calls[calls.length - 1][1] as ResolutionOptions;
}

let discoveries: Array<ReturnType<typeof deferred<AssetCandidate[]>>>;
let resolverFinish: ReturnType<typeof deferred<ResolvedAsset[]>>;
let enqueued: AssetCandidate[];
let frames: FrameRequestCallback[];

/** Run the animation frames the listing batch requested, publishing everything it collected. */
async function flushFrames() {
	const pending = frames;
	frames = [];
	await settle(() => {
		for (const callback of pending) callback(0);
	});
}

beforeEach(() => {
	replaceHiddenCollectionAssetIndex(READY_HIDDEN_COLLECTION_INDEX);
	for (const mock of Object.values(mocks)) mock.mockReset();
	// Frames run when a test asks for them, so each published batch is observed on purpose.
	frames = [];
	window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
		frames.push(callback)) as typeof window.requestAnimationFrame;
	window.cancelAnimationFrame = ((handle: number) => {
		frames[handle - 1] = () => undefined;
	}) as typeof window.cancelAnimationFrame;
	discoveries = [];
	resolverFinish = deferred<ResolvedAsset[]>();
	void resolverFinish.promise.catch(() => undefined);
	enqueued = [];
	mocks.discoverMarketActivityBatched.mockImplementation(() => {
		const request = deferred<AssetCandidate[]>();
		void request.promise.catch(() => undefined);
		discoveries.push(request);
		return request.promise;
	});
	mocks.createAssetCandidateResolver.mockImplementation(() => ({
		enqueue: (candidates: AssetCandidate[]) => enqueued.push(...candidates),
		finish: () => resolverFinish.promise,
	}));
	mocks.resolveAssetCandidates.mockResolvedValue([]);
});

afterEach(() => {
	replaceHiddenCollectionAssetIndex({});
});

async function completeScan() {
	await settle(async () => {
		resolverFinish.resolve([]);
		discoveries[0].resolve([]);
		await discoveries[0].promise;
	});
}

describe('useCollectionMarket listing pass', () => {
	it('asks the index for every loaded asset and publishes results progressively', async () => {
		const harness = render();
		expect(harness.current().loading).toBe(true);
		expect(discoveryCall(0).recipients).toEqual([processId(1), processId(2)]);

		await settle(() =>
			discoveryCall(0).onBatch([candidateFixture(2, 20), candidateFixture(1, 10)], [processId(1)])
		);
		expect(harness.current().candidates.map((candidate) => candidate.processId)).toEqual([
			processId(2),
			processId(1),
		]);
		expect(harness.current().progress).toMatchObject({ pages: 1, total: 2 });
		expect(enqueued).toHaveLength(2);

		await settle(() => resolverOptions().onSettled(listing, candidateFixture(1, 10)));
		await flushFrames();
		expect(harness.current().listed).toEqual([listing]);
		expect(harness.current().assets).toEqual([assetSummary(1)]);
		expect(harness.current().prices[processId(1)]).toMatchObject({ status: 'resolved' });
		expect(harness.current().progress).toMatchObject({ resolved: 1, failures: 0 });
		expect(harness.current().liveRows).toHaveLength(1);

		await settle(() => resolverOptions().onSettled(null, candidateFixture(2, 20), appError('rate-limited')));
		await flushFrames();
		expect(harness.current().progress).toMatchObject({ resolved: 2, failures: 1, rateLimited: 1 });
		expect(harness.current().prices[processId(2)]).toEqual({ status: 'unavailable', kind: 'rate-limited' });

		await completeScan();
		expect(harness.current().loading).toBe(false);
		expect(harness.current().failed).toBe(false);
		expect(harness.current().progress).toMatchObject({ total: 2 });
		harness.unmount();
	});

	it('marks assets the index has no offer for as unlisted', async () => {
		const harness = render({ listedOnly: false });
		await settle(() => discoveryCall(0).onBatch([], [processId(1), processId(2)]));
		expect(harness.current().prices).toEqual({
			[processId(1)]: { status: 'unindexed' },
			[processId(2)]: { status: 'unindexed' },
		});
		harness.unmount();
	});

	it('keeps confirmed listings visible when the pass fails', async () => {
		const harness = render();
		await settle(() => discoveryCall(0).onBatch([candidateFixture(1, 10)], [processId(1)]));
		await settle(() => resolverOptions().onSettled(listing, candidateFixture(1, 10)));
		await settle(async () => {
			resolverFinish.resolve([]);
			discoveries[0].reject(appError('rate-limited'));
			await discoveries[0].promise.catch(() => undefined);
		});

		expect(harness.current().failed).toBe(true);
		expect(harness.current().loading).toBe(false);
		expect(harness.current().listed).toEqual([listing]);
		expect(harness.current().pricesFailed).toBe(true);
		harness.unmount();
	});

	it('rechecks only the candidates whose live state was unavailable', async () => {
		const harness = render();
		await settle(() => discoveryCall(0).onBatch([candidateFixture(2, 20)], [processId(2)]));
		await settle(() => resolverOptions().onSettled(null, candidateFixture(2, 20), appError('rate-limited')));
		await flushFrames();
		await completeScan();
		expect(harness.current().progress).toMatchObject({ failures: 1 });

		const recheck = deferred<ResolvedAsset[]>();
		void recheck.promise.catch(() => undefined);
		mocks.resolveAssetCandidates.mockImplementation(() => recheck.promise);
		await settle(() => harness.current().recheckUnavailableListings());
		expect(harness.current().rechecking).toBe(true);
		expect(mocks.resolveAssetCandidates.mock.calls[0][0]).toEqual([candidateFixture(2, 20)]);

		const options = mocks.resolveAssetCandidates.mock.calls[0][2] as ResolutionOptions;
		await settle(() => options.onSettled(secondListing, candidateFixture(2, 20)));
		expect(harness.current().listed).toEqual([secondListing]);
		expect(harness.current().progress).toMatchObject({ failures: 0, rateLimited: 0 });

		await settle(async () => {
			recheck.resolve([]);
			await recheck.promise;
		});
		expect(harness.current().rechecking).toBe(false);
		harness.unmount();
	});

	it('abandons the pass when the collection page unmounts', async () => {
		const harness = render();
		const signal = mocks.discoverMarketActivityBatched.mock.calls[0][0].signal as AbortSignal;
		harness.unmount();
		expect(signal.aborted).toBe(true);
	});
});

describe('useCollectionMarket price checks', () => {
	async function completeScanWithoutPrices(harness: ReturnType<typeof render>) {
		await settle(() => void discoveryCall(0).onBatch([], [processId(1)]));
		await completeScan();
		expect(harness.current().loading).toBe(false);
	}

	it('checks visible cards the listing pass did not cover', async () => {
		const harness = render({ listedOnly: false });
		await completeScanWithoutPrices(harness);

		expect(mocks.discoverMarketActivityBatched).toHaveBeenCalledTimes(2);
		expect(discoveryCall(1).recipients).toEqual([processId(2)]);
		expect(harness.current().pricesLoading).toBe(true);

		const resolution = deferred<ResolvedAsset[]>();
		void resolution.promise.catch(() => undefined);
		mocks.resolveAssetCandidates.mockImplementation(() => resolution.promise);
		await settle(() => void discoveryCall(1).onBatch([candidateFixture(2, 20)], [processId(2)]));
		const options = mocks.resolveAssetCandidates.mock.calls[0][2] as ResolutionOptions;
		await settle(() => options.onSettled(secondListing, candidateFixture(2, 20)));
		expect(harness.current().prices[processId(2)]).toMatchObject({ status: 'resolved' });
		expect(harness.current().listed).toEqual([secondListing]);

		await settle(async () => {
			resolution.resolve([]);
			discoveries[1].resolve([]);
			await discoveries[1].promise;
		});
		expect(harness.current().pricesLoading).toBe(false);
		harness.unmount();
	});

	it('reports a failed price check and reads the unavailable cards again on retry', async () => {
		const harness = render({ listedOnly: false });
		await completeScanWithoutPrices(harness);

		await settle(() => void discoveryCall(1).onBatch([candidateFixture(2, 20)], [processId(2)]));
		const options = mocks.resolveAssetCandidates.mock.calls[0][2] as ResolutionOptions;
		await settle(() => options.onSettled(null, candidateFixture(2, 20), appError('compute-unavailable')));
		expect(harness.current().prices[processId(2)]).toEqual({ status: 'unavailable', kind: 'unavailable' });

		await settle(() => harness.current().retryPrices());
		expect(harness.current().prices[processId(2)]).toBeUndefined();
		expect(mocks.discoverMarketActivityBatched).toHaveBeenCalledTimes(3);
		expect(discoveryCall(2).recipients).toEqual([processId(2)]);
		harness.unmount();
	});

	it('ignores price results that belong to a superseded listing scope', async () => {
		const harness = render({ listedOnly: false });
		await completeScanWithoutPrices(harness);
		const stale = discoveryCall(1);
		const staleResolution = deferred<ResolvedAsset[]>();
		void staleResolution.promise.catch(() => undefined);
		mocks.resolveAssetCandidates.mockImplementation(() => staleResolution.promise);
		await settle(() => void stale.onBatch([candidateFixture(2, 20)], [processId(2)]));
		const staleOptions = mocks.resolveAssetCandidates.mock.calls[0][2] as ResolutionOptions;

		harness.rerender({
			collection: collectionFixture([assetSummary(1), assetSummary(2)], { manifestId: 'manifest-b' }),
			listedOnly: false,
			limit: 12,
		});
		await settle(() => staleOptions.onSettled(secondListing, candidateFixture(2, 20)));
		expect(harness.current().prices[processId(2)]).toBeUndefined();
		expect(harness.current().listed).toEqual([]);
		harness.unmount();
	});

	it('warms a token page from the cards it shows', () => {
		const harness = render({ listedOnly: false });
		harness.current().warmToken(processId(1));
		expect(mocks.prefetchAssetPage).toHaveBeenCalledWith(processId(1), true);
		harness.unmount();
	});
});
