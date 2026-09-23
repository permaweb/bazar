// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Collection } from 'api/collections';
import type { AssetCandidate, ResolvedAsset } from 'api/discovery';

import { appError } from 'helpers/app-error';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Settle = (result: ResolvedAsset | null, candidate: AssetCandidate, error?: unknown) => void;
type DiscoverOptions = { signal?: AbortSignal; onPage?: (page: AssetCandidate[]) => void };

const control = vi.hoisted(() => ({
	discover: undefined as undefined | ((address: string, options: DiscoverOptions) => Promise<AssetCandidate[]>),
	/** Outcome of each compute check, by process ID; missing entries resolve as owned. */
	failures: new Map<string, unknown>(),
	results: new Map<string, ResolvedAsset>(),
	retried: [] as string[][],
}));

vi.mock('api/discovery', async (importOriginal) => {
	const actual = await importOriginal<typeof import('api/discovery')>();
	return {
		...actual,
		createWalletCandidateScan: (address: string) => ({ address, found: new Map() }),
		resumeCompletedWalletCandidateScan: () => undefined,
		loadCompletedWalletCandidateScan: () => undefined,
		storeCompletedWalletCandidateScan: () => true,
		partitionAssetCandidateSupport: (candidates: AssetCandidate[]) => ({ supported: candidates, unverified: [] }),
		verifyAssetCandidateSupport: async () => ({ supported: [], unavailable: [] }),
		discoverWalletAssetCandidates: (address: string, options: DiscoverOptions) => {
			if (!control.discover) throw new Error('discover-not-configured');
			return control.discover(address, options);
		},
		createAssetCandidateResolver: (_collections: Collection[], options: { onSettled?: Settle }) => {
			const queue: AssetCandidate[] = [];
			return {
				enqueue: (candidates: AssetCandidate[]) => queue.push(...candidates),
				finish: async () => {
					for (const candidate of queue) settle(candidate, options.onSettled);
					return [];
				},
			};
		},
		resolveAssetCandidates: async (
			candidates: AssetCandidate[],
			_collections: Collection[],
			options: { onSettled?: Settle }
		) => {
			control.retried.push(candidates.map((candidate) => candidate.processId));
			for (const candidate of candidates) settle(candidate, options.onSettled);
			return [];
		},
	};
});

vi.mock('api/marketplace', async (importOriginal) => {
	const actual = await importOriginal<typeof import('api/marketplace')>();
	return { ...actual, servingNodeOrigin: () => 'https://gateway.example' };
});

const market = vi.hoisted(() => ({ collections: [] as Collection[], error: null as string | null }));

vi.mock('providers/MarketProvider', () => ({ useMarketProvider: () => market }));

import { useWalletAssetDiscovery, type WalletAssetDiscovery } from 'features/MyAssets/hooks/useWalletAssetDiscovery';

function settle(candidate: AssetCandidate, onSettled: Settle | undefined) {
	const failure = control.failures.get(candidate.processId);
	if (failure) onSettled?.(null, candidate, failure);
	else onSettled?.(control.results.get(candidate.processId) ?? null, candidate);
}

const walletA = 'A'.repeat(43);
const walletB = 'B'.repeat(43);
const tokens: Collection = {
	id: 'tokens',
	name: 'Tokens',
	description: '',
	kind: 'tokens',
	assets: [],
	manifestId: 'M'.repeat(43),
};

function candidate(processId: string, height: number): AssetCandidate {
	return { processId, height, timestamp: height, sources: ['transfer'] };
}

function owned(processId: string, owner: string, height: number): ResolvedAsset {
	return {
		asset: { id: processId, name: processId },
		collection: tokens,
		provider: 'https://gateway.example',
		activity: candidate(processId, height),
		state: {
			device: 'token@1.0',
			name: processId,
			ticker: 'TKN',
			denomination: 0,
			totalSupply: '10',
			balances: { [owner]: '1' },
			orders: {},
			swapHeight: 1,
			value: null,
			raw: {},
		},
	};
}

function deferred<T>() {
	let resolve: (value: T) => void = () => undefined;
	let reject: (reason: unknown) => void = () => undefined;
	const promise = new Promise<T>((onResolve, onReject) => {
		resolve = onResolve;
		reject = onReject;
	});
	return { promise, resolve, reject };
}

let root: Root;
let latest: WalletAssetDiscovery | undefined;

function Probe(props: { address: string }) {
	latest = useWalletAssetDiscovery(props.address);
	return null;
}

function render(address: string) {
	React.act(() => root.render(<Probe address={address} />));
}

async function settleAsyncWork() {
	await React.act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

function discovery(): WalletAssetDiscovery {
	if (!latest) throw new Error('hook-not-rendered');
	return latest;
}

describe('useWalletAssetDiscovery', () => {
	beforeEach(() => {
		root = createRoot(document.createElement('div'));
		latest = undefined;
		market.collections = [tokens];
		market.error = null;
		control.discover = undefined;
		control.failures.clear();
		control.results.clear();
		control.retried = [];
	});

	afterEach(() => {
		React.act(() => root.unmount());
	});

	it('resolves discovered candidates into newest-first owned results', async () => {
		const first = 'F'.repeat(43);
		const second = 'S'.repeat(43);
		control.results.set(first, owned(first, walletA, 10));
		control.results.set(second, owned(second, walletA, 20));
		control.discover = async (_address, options) => {
			options.onPage?.([candidate(first, 10), candidate(second, 20)]);
			return [candidate(first, 10), candidate(second, 20)];
		};

		render(walletA);
		expect(discovery().status).toMatchObject({ phase: 'resolving', discovered: 2, total: 2 });
		expect(discovery().gateway).toBe('https://gateway.example');
		await settleAsyncWork();

		expect(discovery().status).toMatchObject({ phase: 'done', discovered: 2, total: 2, resolved: 2, failures: 0 });
		expect(discovery().results.map((result) => result.asset.id)).toEqual([second, first]);
		expect(discovery().resolutionCopy.heading).toBe('Live state resolved');
	});

	it('ignores a superseded wallet’s late discovery and aborts its requests', async () => {
		const stale = 'X'.repeat(43);
		control.results.set(stale, owned(stale, walletA, 30));
		const pendingA = deferred<AssetCandidate[]>();
		const signals: AbortSignal[] = [];
		control.discover = (address, options) => {
			if (options.signal) signals.push(options.signal);
			if (address === walletA) {
				options.onPage?.([candidate(stale, 30)]);
				return pendingA.promise;
			}
			return Promise.resolve([]);
		};

		render(walletA);
		render(walletB);
		expect(signals[0]?.aborted).toBe(true);
		pendingA.resolve([candidate(stale, 30)]);
		await settleAsyncWork();

		expect(discovery().status).toMatchObject({ phase: 'done', total: 0, resolved: 0 });
		expect(discovery().results).toEqual([]);
	});

	it('reports an interrupted discovery as an index error and resumes it on retry', async () => {
		control.discover = () => Promise.reject(appError('index-rate-limited'));

		render(walletA);
		await settleAsyncWork();
		expect(discovery().status.phase).toBe('error');
		expect(discovery().status.error?.reason).toBe('index-rate-limited');
		expect(discovery().resolutionCopy.announcement).toBe('');

		control.discover = () => Promise.resolve([]);
		React.act(() => discovery().retryDiscovery());
		expect(discovery().status).toMatchObject({ phase: 'discovering', error: null });
		await settleAsyncWork();
		expect(discovery().status.phase).toBe('done');
	});

	it('retries only unavailable candidates and keeps resolved assets visible', async () => {
		const held = 'H'.repeat(43);
		const flaky = 'K'.repeat(43);
		control.results.set(held, owned(held, walletA, 5));
		control.results.set(flaky, owned(flaky, walletA, 8));
		control.failures.set(flaky, appError('compute-rate-limited'));
		control.discover = async () => [candidate(held, 5), candidate(flaky, 8)];

		render(walletA);
		await settleAsyncWork();
		expect(discovery().status).toMatchObject({ phase: 'done', failures: 1, rateLimited: 1, indexFailures: 0 });
		expect(discovery().results.map((result) => result.asset.id)).toEqual([held]);

		control.failures.clear();
		React.act(() => discovery().retryUnavailable());
		expect(discovery().status).toMatchObject({ phase: 'resolving', failures: 0, rateLimited: 0 });
		await settleAsyncWork();

		expect(control.retried).toEqual([[flaky]]);
		expect(discovery().status).toMatchObject({ phase: 'done', failures: 0, rateLimited: 0, resolved: 2 });
		expect(discovery().results.map((result) => result.asset.id)).toEqual([flaky, held]);
	});

	it('does not start discovery without a wallet, collections, or a healthy catalogue', () => {
		const discover = vi.fn(() => Promise.resolve([]));
		control.discover = discover;

		render('');
		market.collections = [];
		render(walletA);
		market.collections = [tokens];
		market.error = 'Collection indexes unavailable.';
		render(walletB);

		expect(discover).not.toHaveBeenCalled();
		expect(discovery().results).toEqual([]);
	});

	it('aborts in-flight discovery on unmount', () => {
		const signals: AbortSignal[] = [];
		control.discover = (_address, options) => {
			if (options.signal) signals.push(options.signal);
			return new Promise(() => undefined);
		};

		render(walletA);
		React.act(() => root.unmount());
		root = createRoot(document.createElement('div'));

		expect(signals).toHaveLength(1);
		expect(signals[0].aborted).toBe(true);
	});
});
