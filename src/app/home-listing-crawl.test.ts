import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssetCandidate, ResolvedAsset } from 'api/asset-discovery';
import { parseAssetState } from 'api/asset-marketplace';
import { type Collection, HIDDEN_COLLECTION_IDS, replaceHiddenCollectionAssetIndex } from 'api/collections';

import { createHomeListingCrawl } from './home-listing-crawl';

const wallet = 'W'.repeat(43);
const orderId = 'O'.repeat(43);
const assetA = 'A'.repeat(43);
const assetB = 'B'.repeat(43);
const assetC = 'C'.repeat(43);

const liveState = () =>
	parseAssetState({
		'execution-device': 'token@1.0',
		'total-supply': 1,
		balances: {},
		orders: {
			[orderId]: {
				'order-id': orderId,
				creator: wallet,
				recipient: wallet,
				asking: '100000000',
				deposit: '0',
				'minimum-fee': '100000000',
				deadline: 20,
				'created-at': 1,
				quantity: 1,
				status: 'open',
			},
		},
	});

const candidate = (processId: string, height: number): AssetCandidate => ({
	processId,
	height,
	timestamp: height,
	sources: ['market-action'],
	device: 'token@1.0',
});

const images = (ids: string[], names: Record<string, string> = {}): Collection => ({
	id: 'images',
	name: 'Images',
	description: '',
	kind: 'images',
	assets: ids.map((id) => ({ id, name: names[id] ?? `Asset ${id[0]}` })),
});

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
}

beforeEach(() => replaceHiddenCollectionAssetIndex(Object.fromEntries(HIDDEN_COLLECTION_IDS.map((id) => [id, []]))));
afterEach(() => replaceHiddenCollectionAssetIndex({}));

function harness(initial: Collection[]) {
	let collections = initial;
	const reads: string[] = [];
	const settled: ResolvedAsset[] = [];
	const reclassified: Array<ResolvedAsset | null> = [];
	const verify = vi.fn(async () => ({ supported: [], unavailable: [] }));
	return {
		reads,
		settled,
		reclassified,
		verify,
		setCollections(next: Collection[]) {
			collections = next;
		},
		options: {
			collections: () => collections,
			verify,
			read: async (processId: string) => {
				reads.push(processId);
				return { provider: 'https://compute.example', state: liveState() };
			},
			onSettled: (result: ResolvedAsset | null) => {
				if (result) settled.push(result);
			},
			onReclassified: (result: ResolvedAsset | null) => {
				reclassified.push(result);
			},
		},
	};
}

describe('home listing crawl', () => {
	it('keeps one discovery crawl while collections stream in and resolves held candidates in place', async () => {
		const controller = new AbortController();
		const test = harness([images([assetA])]);
		const secondPage = deferred();
		let discoverCalls = 0;
		const crawl = createHomeListingCrawl({
			...test.options,
			signal: controller.signal,
			discover: async (onPage) => {
				discoverCalls += 1;
				await onPage([candidate(assetA, 30), candidate(assetB, 20)]);
				await secondPage.promise;
				await onPage([candidate(assetC, 10)]);
			},
		});

		await vi.waitFor(() => expect(test.reads).toEqual([assetA]));
		// B is outside every loaded collection until the next collection streams in.
		test.setCollections([images([assetA, assetB])]);
		crawl.supportChanged();
		crawl.supportChanged();
		await vi.waitFor(() => expect(test.reads).toEqual([assetA, assetB]));
		test.setCollections([images([assetA, assetB, assetC])]);
		crawl.supportChanged();
		secondPage.resolve();
		await crawl.finished;

		expect(discoverCalls).toBe(1);
		expect(controller.signal.aborted).toBe(false);
		expect(test.reads).toEqual([assetA, assetB, assetC]);
		expect(test.settled.map((result) => [result.asset.id, result.collection.id])).toEqual([
			[assetA, 'images'],
			[assetB, 'images'],
			[assetC, 'images'],
		]);
		expect(test.verify).not.toHaveBeenCalled();
	});

	it('re-filters live listings against new collection metadata without another compute read', async () => {
		const test = harness([images([assetA])]);
		const crawl = createHomeListingCrawl({
			...test.options,
			signal: new AbortController().signal,
			discover: async (onPage) => onPage([candidate(assetA, 30)]),
		});
		await crawl.finished;

		crawl.supportChanged();
		await Promise.resolve();
		expect(test.reclassified).toEqual([]);
		test.setCollections([images([assetA], { [assetA]: 'Renamed' })]);
		crawl.supportChanged();

		await vi.waitFor(() => expect(test.reclassified.map((result) => result?.asset.name)).toEqual(['Renamed']));
		expect(test.reads).toEqual([assetA]);
	});

	it('resolves a candidate whose collection arrives after the crawl finished', async () => {
		const test = harness([images([assetA])]);
		const crawl = createHomeListingCrawl({
			...test.options,
			signal: new AbortController().signal,
			discover: async (onPage) => onPage([candidate(assetA, 30), candidate(assetB, 20)]),
		});
		await crawl.finished;
		expect(test.reads).toEqual([assetA]);

		test.setCollections([images([assetA, assetB])]);
		crawl.supportChanged();

		await vi.waitFor(() => expect(test.settled.map((result) => result.asset.id)).toEqual([assetA, assetB]));
		expect(test.reads).toEqual([assetA, assetB]);
	});
});
