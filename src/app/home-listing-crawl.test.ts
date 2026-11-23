import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type AssetCandidate, discoverMarketActivity, type ResolvedAsset } from 'api/asset-discovery';
import { parseAssetState } from 'api/asset-marketplace';
import { type Collection, HIDDEN_COLLECTION_IDS, replaceHiddenCollectionAssetIndex } from 'api/collections';

import { createHomeListingCrawl, type HomeListingDemand } from './home-listing-crawl';

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

	it('stops paging make-offer activity once the visible pages plus one ahead are listed', async () => {
		const ids = Array.from({ length: 15 }, (_, index) => String.fromCharCode(65 + index).repeat(43));
		const pageSize = 3;
		const pages = Array.from({ length: ids.length / pageSize }, (_, page) =>
			ids.slice(page * pageSize, (page + 1) * pageSize)
		);
		const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
			const { variables } = JSON.parse(String(init?.body));
			const page = variables.cursor ? Number(variables.cursor) + 1 : 0;
			return Response.json({
				data: {
					transactions: {
						pageInfo: { hasNextPage: page < pages.length - 1 },
						edges: pages[page].map((processId, index) => ({
							cursor: index === pageSize - 1 ? String(page) : `${page}-${index}`,
							node: {
								id: `${page}${index}`.padEnd(43, 'X'),
								recipient: processId,
								tags: [{ name: 'action', value: 'make-offer' }],
								block: { height: 1_000 - page * pageSize - index, timestamp: 0 },
							},
						})),
					},
				},
			});
		});
		const test = harness([images(ids)]);
		let demand: HomeListingDemand[] | undefined = [{ count: 4 }];
		const idle: boolean[] = [];
		const crawl = createHomeListingCrawl({
			...test.options,
			signal: new AbortController().signal,
			discover: (onPage, signal) =>
				discoverMarketActivity({
					fetch: fetcher as typeof fetch,
					graphql: 'https://graphql.example/graphql',
					listingsOnly: true,
					signal,
					onPage,
				}),
			demand: () => demand,
			onIdle: (value) => idle.push(value),
		});
		let finished = false;
		void crawl.finished.then(() => (finished = true));

		// Page one leaves the demand one listing short, so exactly one more page is
		// fetched, and only one of its candidates is read.
		await vi.waitFor(() => expect(idle).toEqual([true]));
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(test.reads).toEqual(ids.slice(0, 4));
		expect(finished).toBe(false);

		// Paging forward reads the fetched backlog first, then resumes the same
		// crawl only as far as the new demand.
		demand = [{ count: 10 }];
		crawl.demandChanged();
		await vi.waitFor(() => expect(idle).toEqual([true, false, true]));
		expect(fetcher).toHaveBeenCalledTimes(4);
		expect(test.reads).toEqual(ids.slice(0, 10));

		// Unbounded views (price order, search) drain the remaining history.
		demand = undefined;
		crawl.demandChanged();
		await crawl.finished;
		expect(fetcher).toHaveBeenCalledTimes(5);
		expect(test.reads).toEqual(ids);
	});

	it('reads a discovered page only as far as the demand needs and keeps the rest for later', async () => {
		const ids = Array.from({ length: 8 }, (_, index) => String.fromCharCode(65 + index).repeat(43));
		const test = harness([images(ids)]);
		let demand: HomeListingDemand[] = [{ count: 3 }];
		const idle: boolean[] = [];
		let pagesRead = 0;
		const crawl = createHomeListingCrawl({
			...test.options,
			signal: new AbortController().signal,
			discover: async (onPage) => {
				pagesRead += 1;
				await onPage(ids.map((id, index) => candidate(id, 100 - index)));
			},
			demand: () => demand,
			onIdle: (value) => idle.push(value),
		});
		// Demand is met, so the crawl pauses inside its only page instead of finishing.
		await vi.waitFor(() => expect(idle).toEqual([true]));
		expect(pagesRead).toBe(1);
		expect(test.reads).toEqual(ids.slice(0, 3));

		demand = [{ count: 5 }];
		crawl.demandChanged();
		await vi.waitFor(() => expect(test.settled.map((result) => result.asset.id)).toEqual(ids.slice(0, 5)));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(test.reads).toEqual(ids.slice(0, 5));
		expect(pagesRead).toBe(1);
		expect(idle.at(-1)).toBe(true);
	});

	it('still reads a newer candidate whose support arrives after older listings met the demand', async () => {
		const ids = Array.from({ length: 4 }, (_, index) => String.fromCharCode(68 + index).repeat(43));
		const test = harness([images(ids)]);
		const crawl = createHomeListingCrawl({
			...test.options,
			signal: new AbortController().signal,
			discover: async (onPage) =>
				onPage([
					candidate(assetA, 90),
					candidate(assetB, 5),
					...ids.map((id, index) => candidate(id, 50 - index)),
				]),
			demand: () => [{ count: 3 }],
		});
		await vi.waitFor(() => expect(test.reads).toEqual(ids.slice(0, 3)));

		// A and B were waiting for their collection. A is newer than the listings
		// shown, so it is read; B is older than all of them and stays unread.
		test.setCollections([images([assetA, assetB, ...ids])]);
		crawl.supportChanged();
		await vi.waitFor(() => expect(test.reads).toEqual([...ids.slice(0, 3), assetA]));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(test.reads).toEqual([...ids.slice(0, 3), assetA]);
	});

	it('stops counting a hung read as a listing after the slow-read allowance', async () => {
		const test = harness([images([assetA, assetB, assetC])]);
		const hung = deferred();
		const reads: string[] = [];
		createHomeListingCrawl({
			...test.options,
			signal: new AbortController().signal,
			slowReadMs: 30,
			read: async (processId) => {
				reads.push(processId);
				if (processId === assetA) await hung.promise;
				return { provider: 'https://compute.example', state: liveState() };
			},
			discover: async (onPage) => onPage([candidate(assetA, 30), candidate(assetB, 20), candidate(assetC, 10)]),
			demand: () => [{ count: 1 }],
		});
		await vi.waitFor(() => expect(reads).toEqual([assetA]));
		// A stays pending; once it is slow, B is read to fill the demand, and C is not.
		await vi.waitFor(() => expect(reads).toEqual([assetA, assetB]));
		await new Promise((resolve) => setTimeout(resolve, 60));
		expect(reads).toEqual([assetA, assetB]);
		hung.resolve();
	});

	it('reads only candidates a short demand admits', async () => {
		const tokensCollection: Collection = {
			id: 'tokens',
			name: 'Tokens',
			description: '',
			kind: 'tokens',
			assets: [{ id: assetC, name: 'Token C' }],
		};
		const test = harness([tokensCollection, images([assetA, assetB])]);
		const isToken = (processId: string) => processId === assetC;
		const crawl = createHomeListingCrawl({
			...test.options,
			signal: new AbortController().signal,
			discover: async (onPage) => onPage([candidate(assetA, 30), candidate(assetB, 20), candidate(assetC, 10)]),
			demand: () => [
				{
					count: 1,
					matches: (result) => result.collection.kind !== 'tokens',
					admits: (next) => !isToken(next.processId),
				},
				{
					count: 1,
					matches: (result) => result.collection.kind === 'tokens',
					admits: (next) => isToken(next.processId),
				},
			],
		});
		// One unique and one token fill both demands; the second unique is never read.
		await vi.waitFor(() => expect(test.reads).toEqual([assetA, assetC]));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(test.reads).toEqual([assetA, assetC]);
	});

	it('counts only listings that match the visible asset type', async () => {
		const tokensCollection: Collection = {
			id: 'tokens',
			name: 'Tokens',
			description: '',
			kind: 'tokens',
			assets: [{ id: assetA, name: 'Token A' }],
		};
		const test = harness([tokensCollection, images([assetB, assetC])]);
		const pages = [[candidate(assetA, 30)], [candidate(assetB, 20)], [candidate(assetC, 10)]];
		let pagesRead = 0;
		const crawl = createHomeListingCrawl({
			...test.options,
			signal: new AbortController().signal,
			discover: async (onPage) => {
				for (const page of pages) {
					pagesRead += 1;
					await onPage(page);
				}
			},
			demand: () => [{ count: 1, matches: (result) => result.collection.kind !== 'tokens' }],
		});
		await vi.waitFor(() => expect(test.reads).toEqual([assetA, assetB]));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(pagesRead).toBe(2);
		crawl.demandChanged();
		expect(pagesRead).toBe(2);
	});
});
