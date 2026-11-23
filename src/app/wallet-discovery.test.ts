import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssetCandidate, WalletCandidateScan } from 'api/asset-discovery';
import { parseAssetState } from 'api/asset-marketplace';
import { type Collection, HIDDEN_COLLECTION_IDS, replaceHiddenCollectionAssetIndex } from 'api/collections';

import { initialWalletResolutionStatus, walletDiscoverySession, type WalletResolutionStatus } from './App';
import { runWalletDiscovery, type WalletDiscoveryOptions } from './wallet-discovery';

const wallet = 'W'.repeat(43);
const assetA = 'A'.repeat(43);
const assetB = 'B'.repeat(43);
const assetC = 'C'.repeat(43);

const ownedState = () =>
	parseAssetState({
		'execution-device': 'token@1.0',
		'total-supply': 1,
		balances: { [wallet]: 1 },
		orders: {},
	});

const candidate = (processId: string, height: number, device: string | undefined = 'token@1.0'): AssetCandidate => ({
	processId,
	height,
	timestamp: height,
	sources: ['transfer'],
	...(device ? { device } : {}),
});

const images = (ids: string[], names: Record<string, string> = {}): Collection => ({
	id: 'images',
	name: 'Images',
	description: '',
	kind: 'images',
	assets: ids.map((id) => ({ id, name: names[id] ?? `Asset ${id[0]}` })),
});

const tokens: Collection = { id: 'tokens', name: 'Tokens', description: '', kind: 'tokens', assets: [] };

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
}

function harness(initial: Collection[], discover: WalletDiscoveryOptions['discover']) {
	let collections = initial;
	let status: WalletResolutionStatus = initialWalletResolutionStatus();
	const reads: string[] = [];
	const controller = new AbortController();
	const session = walletDiscoverySession(undefined, `${wallet}|https://arweave.net|refresh:0`, wallet);
	const verify = vi.fn(async () => ({ supported: [], unavailable: [] }));
	const options: WalletDiscoveryOptions = {
		address: wallet,
		session,
		signal: controller.signal,
		collections: () => collections,
		failures: {
			compute: new Map(),
			support: new Map(),
			computeRateLimits: new Set(),
			indexRateLimits: new Set(),
		},
		discover,
		read: async (processId: string) => {
			reads.push(processId);
			return { provider: 'https://compute.example', state: ownedState() };
		},
		verify,
		active: () => !controller.signal.aborted,
		setStatus: (update) => {
			status = update(status);
		},
		onResultsChanged: () => undefined,
	};
	return {
		controller,
		options,
		reads,
		session,
		verify,
		status: () => status,
		resolvedIds: () => [...session.resolvedAssets.keys()].sort(),
		setCollections(next: Collection[]) {
			collections = next;
		},
	};
}

beforeEach(() => replaceHiddenCollectionAssetIndex(Object.fromEntries(HIDDEN_COLLECTION_IDS.map((id) => [id, []]))));

describe('wallet discovery run', () => {
	it('keeps one wallet scan while collections stream in and resolves held candidates in place', async () => {
		const secondPage = deferred();
		const scans: WalletCandidateScan[] = [];
		const test = harness([images([assetA])], async (scan, onPage) => {
			scans.push(scan);
			onPage([candidate(assetA, 30), candidate(assetB, 20)]);
			await secondPage.promise;
			onPage([candidate(assetC, 10)]);
			return [candidate(assetA, 30), candidate(assetB, 20), candidate(assetC, 10)];
		});
		const discovery = runWalletDiscovery(test.options);

		await vi.waitFor(() => expect(test.reads).toEqual([assetA]));
		// B is outside every loaded collection until the next collection streams in.
		test.setCollections([images([assetA, assetB])]);
		discovery.supportChanged();
		discovery.supportChanged();
		await vi.waitFor(() => expect(test.reads).toEqual([assetA, assetB]));
		test.setCollections([images([assetA, assetB, assetC])]);
		discovery.supportChanged();
		secondPage.resolve();
		await discovery.finished;

		expect(scans).toEqual([test.session.scan]);
		expect(test.controller.signal.aborted).toBe(false);
		expect(test.reads).toEqual([assetA, assetB, assetC]);
		expect(test.resolvedIds()).toEqual([assetA, assetB, assetC]);
		expect(test.status()).toMatchObject({ phase: 'done', total: 3, resolved: 3, failures: 0 });
		expect(test.verify).not.toHaveBeenCalled();
	});

	it('resolves a candidate whose collection arrives after the run finished', async () => {
		const test = harness([images([assetA])], async (_scan, onPage) => {
			onPage([candidate(assetA, 30), candidate(assetB, 20)]);
			return [candidate(assetA, 30), candidate(assetB, 20)];
		});
		const discovery = runWalletDiscovery(test.options);
		await discovery.finished;
		expect(test.reads).toEqual([assetA]);
		expect(test.status()).toMatchObject({ phase: 'done', total: 1, resolved: 1 });

		test.setCollections([images([assetA, assetB])]);
		discovery.supportChanged();

		await vi.waitFor(() => expect(test.resolvedIds()).toEqual([assetA, assetB]));
		expect(test.reads).toEqual([assetA, assetB]);
		expect(test.status()).toMatchObject({ phase: 'done', total: 2, resolved: 2 });
	});

	it('re-includes a candidate the support check excluded once its collection index loads', async () => {
		const test = harness([tokens, images([assetA])], async (_scan, onPage) => {
			onPage([candidate(assetA, 30, ''), candidate(assetB, 20, '')]);
			return [];
		});
		const discovery = runWalletDiscovery(test.options);
		await discovery.finished;
		expect(test.verify).toHaveBeenCalledTimes(1);
		expect(test.reads).toEqual([assetA]);
		expect(test.status()).toMatchObject({ total: 2, resolved: 2, failures: 0 });

		test.setCollections([tokens, images([assetA, assetB])]);
		discovery.supportChanged();

		await vi.waitFor(() => expect(test.resolvedIds()).toEqual([assetA, assetB]));
		expect(test.verify).toHaveBeenCalledTimes(1);
		expect(test.status()).toMatchObject({ total: 2, resolved: 2, failures: 0 });
	});

	it('classifies a settled read once its collection streams in, without another compute read', async () => {
		const test = harness([tokens], async (_scan, onPage) => {
			onPage([candidate(assetB, 20, '')]);
			return [];
		});
		test.options.verify = vi.fn(async (candidates, _collections, options) => {
			await options?.onVerified?.(candidates);
			return { supported: candidates, unavailable: [] };
		});
		const discovery = runWalletDiscovery(test.options);
		await discovery.finished;
		expect(test.reads).toEqual([assetB]);
		expect(test.resolvedIds()).toEqual([]);

		test.setCollections([tokens, images([assetB])]);
		discovery.supportChanged();

		await vi.waitFor(() => expect(test.resolvedIds()).toEqual([assetB]));
		expect(test.reads).toEqual([assetB]);
		expect(test.status()).toMatchObject({ phase: 'done', total: 1, resolved: 1, failures: 0 });
	});

	it('re-filters resolved assets against new collection metadata without another compute read', async () => {
		const test = harness([images([assetA])], async (_scan, onPage) => {
			onPage([candidate(assetA, 30)]);
			return [];
		});
		const discovery = runWalletDiscovery(test.options);
		await discovery.finished;

		test.setCollections([images([assetA], { [assetA]: 'Renamed' })]);
		discovery.supportChanged();

		await vi.waitFor(() => expect(test.session.resolvedAssets.get(assetA)?.asset.name).toBe('Renamed'));
		expect(test.reads).toEqual([assetA]);
	});

	it('ignores support changes after the run was aborted', async () => {
		const test = harness([images([assetA])], async (_scan, onPage) => {
			onPage([candidate(assetA, 30), candidate(assetB, 20)]);
			return [];
		});
		const discovery = runWalletDiscovery(test.options);
		await discovery.finished;
		test.controller.abort();
		test.setCollections([images([assetA, assetB])]);
		discovery.supportChanged();
		await Promise.resolve();

		expect(test.reads).toEqual([assetA]);
	});
});
