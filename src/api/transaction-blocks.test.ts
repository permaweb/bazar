import { describe, expect, it, vi } from 'vitest';

import {
	createWalletCandidateScan,
	discoverCollectionActivityPage,
	discoverMarketActivity,
	discoverPendingAssetOffers,
	discoverWalletAssetCandidates,
} from './asset-discovery';
import { type AssetState } from './asset-marketplace';
import { readTransactionBlocks } from './transaction-blocks';

vi.hoisted(() => vi.stubEnv('VITE_GRAPHQL_ENDPOINTS', 'https://arweave.net/graphql,https://index.example/graphql'));

const GATEWAY = 'https://arweave.net/graphql';
const FALLBACK = 'https://index.example/graphql';
const ASSET = 'A'.repeat(43);
const OTHER_ASSET = 'B'.repeat(43);
const ACTOR = 'W'.repeat(43);

function marketEdge(id: string, offset: number, recipient = ASSET) {
	return {
		cursor: `member=${String(offset).padStart(20, '0')}${id}tx@1.0`,
		node: {
			id,
			recipient,
			owner: { address: ACTOR },
			tags: [
				{ name: 'action', value: 'make-offer' },
				{ name: 'asking', value: '100' },
				{ name: 'offer-quantity', value: '1' },
			],
		},
	};
}

function blockEdge(id: string, offset: number, height: number) {
	return { cursor: `offset=${offset}`, node: { id, block: { height, timestamp: height * 10 } } };
}

function connection(edges: unknown[], hasNextPage = false) {
	return Response.json({ data: { transactions: { edges, pageInfo: { hasNextPage } } } });
}

function walletPage(edge: ReturnType<typeof marketEdge>) {
	const empty = { edges: [], pageInfo: { hasNextPage: false } };
	return Response.json({
		data: { initiallyHeld: empty, marketActions: { ...empty, edges: [edge] }, receivedTransfers: empty },
	});
}

function request(init?: RequestInit) {
	return JSON.parse(String(init?.body)) as {
		query: string;
		variables: { ids?: string[]; after?: string | null; cursor?: string; first: number } & Partial<
			Record<`ids${number}`, string[]>
		>;
	};
}

describe('transaction block enrichment', () => {
	it('groups up to three nine-ID filters per request and caches mined positions', async () => {
		const rows = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ01'].map((character, index) =>
			marketEdge(character.repeat(43), index + 100)
		);
		const lookup = new Map(rows.map((row, index) => [row.node.id, blockEdge(row.node.id, index + 100, 42)]));
		const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
			expect(url).toBe(GATEWAY);
			const { query, variables } = request(init);
			expect(variables.first).toBe(9);
			if (variables.ids) return connection(variables.ids.map((id) => lookup.get(id)!).reverse());
			const data = Object.fromEntries(
				[0, 1, 2].map((index) => {
					const ids = variables[`ids${index}` as const]!;
					expect(query).toContain(`batch${index}: transactions(ids: $ids${index}`);
					expect(ids).toHaveLength(9);
					return [`batch${index}`, { edges: ids.map((id) => lookup.get(id)!).reverse() }];
				})
			);
			return Response.json({ data });
		});
		const blocks = await readTransactionBlocks(fetcher, GATEWAY, rows);
		expect(rows.map((row) => blocks.get(row))).toEqual(rows.map(() => ({ height: 42, timestamp: 420 })));
		expect(fetcher.mock.calls.map(([, init]) => request(init).variables.ids?.length)).toEqual([undefined, 1]);
		await expect(readTransactionBlocks(fetcher, GATEWAY, rows)).resolves.toEqual(blocks);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it.each([429, 503])('recovers from HTTP %i with a retry on the same index', async (status) => {
		const row = marketEdge('S'.repeat(43), 10);
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response(null, { status, headers: { 'Retry-After': '0' } }))
			.mockResolvedValueOnce(connection([blockEdge(row.node.id, 10, 20)]));
		const blocks = await readTransactionBlocks(fetcher, GATEWAY, [row]);
		expect(blocks.get(row)).toEqual({ height: 20, timestamp: 200 });
		expect(fetcher.mock.calls.map(([url]) => url)).toEqual([GATEWAY, GATEWAY]);
	});

	it('surfaces a rate limit that persists after one retry', async () => {
		const row = marketEdge('S'.repeat(43), 10);
		const fetcher = vi.fn(async () => new Response(null, { status: 429, headers: { 'Retry-After': '0' } }));
		await expect(readTransactionBlocks(fetcher, GATEWAY, [row])).rejects.toThrow('transaction-blocks-429');
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('uses a binding-safe default fetch and reuses its block cache across discovery reads', async () => {
		const row = marketEdge('G'.repeat(43), 50);
		const empty = { edges: [], pageInfo: { hasNextPage: false } };
		const blockReads = vi.fn();
		const fetcher = vi.fn(async function (this: unknown, url: RequestInfo | URL, init?: RequestInit) {
			if (this !== globalThis) throw new TypeError('Illegal invocation');
			expect(url).toBe(GATEWAY);
			const { query } = request(init);
			if (query.includes('TransactionBlocks')) {
				blockReads();
				return connection([blockEdge(row.node.id, 50, 20)]);
			}
			if (query.includes('WalletAssetCandidates')) {
				return Response.json({
					data: { initiallyHeld: empty, marketActions: { ...empty, edges: [row] }, receivedTransfers: empty },
				});
			}
			return connection([row]);
		});
		vi.stubGlobal('fetch', fetcher);
		try {
			const options = { graphql: GATEWAY };
			const candidate = expect.objectContaining({ processId: ASSET, height: 20 });
			const event = expect.objectContaining({ id: row.node.id, height: 20 });
			await expect(discoverWalletAssetCandidates(ACTOR, options)).resolves.toEqual([candidate]);
			await expect(discoverMarketActivity(options)).resolves.toEqual([candidate]);
			await expect(discoverCollectionActivityPage(options)).resolves.toMatchObject({ events: [event] });
			const state = { swapHeight: 19, orders: {} } as AssetState;
			await expect(discoverPendingAssetOffers(ASSET, state, options)).resolves.toEqual([event]);
			expect(blockReads).toHaveBeenCalledOnce();
			expect(fetcher).toHaveBeenCalledTimes(5);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('keeps a pending occurrence separate from a mined occurrence with the same ID', async () => {
		const id = 'P'.repeat(43);
		const mined = marketEdge(id, 50);
		const pending = { ...mined, cursor: `member=infinity${id}ans104@1.0` };
		const fetcher = vi.fn(async () => connection([blockEdge(id, 50, 20)]));
		const result = await readTransactionBlocks(fetcher, GATEWAY, [pending, mined]);
		expect(result.get(pending)).toBeNull();
		expect(result.get(mined)).toEqual({ height: 20, timestamp: 200 });
		expect(fetcher).toHaveBeenCalledOnce();
	});

	it('rejects block data for a different placement and retries on the next read', async () => {
		const id = 'M'.repeat(43);
		const row = marketEdge(id, 50);
		const fetcher = vi
			.fn<typeof fetch>()
			.mockImplementationOnce(async () => connection([blockEdge(id, 51, 21)]))
			.mockImplementationOnce(async () => connection([blockEdge(id, 50, 20)]));
		await expect(readTransactionBlocks(fetcher, GATEWAY, [row])).rejects.toThrow('transaction-blocks-incomplete');
		expect(fetcher).toHaveBeenCalledOnce();
		const blocks = await readTransactionBlocks(fetcher, GATEWAY, [row]);
		expect(blocks.get(row)?.height).toBe(20);
	});

	it('recovers a second mined occurrence by its original cursor and filter', async () => {
		const id = 'D'.repeat(43);
		const full = marketEdge(id, 200);
		const compact = { ...marketEdge(id, 100), cursor: `member=${'100'.padStart(20, '0')}` };
		const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
			expect(url).toBe(GATEWAY);
			expect(init?.priority).toBe('low');
			const { query, variables } = request(init);
			if (query.includes('TransactionBlockPlacements')) {
				expect(variables).toEqual({
					after: full.cursor,
					first: 1,
					recipients: [ASSET],
					tags: [{ name: 'action', values: ['make-offer'] }],
				});
				return connection([{ cursor: compact.cursor, node: blockEdge(id, 100, 19).node }]);
			}
			if (query.includes('TransactionBlocks')) {
				expect(variables.ids).toEqual([id]);
				return connection([blockEdge(id, 200, 21)]);
			}
			expect(query).not.toMatch(/\bblock\s*\{/);
			return connection([full, compact]);
		});
		const page = await discoverCollectionActivityPage({
			fetch: fetcher,
			graphql: GATEWAY,
			recipients: [ASSET],
			actions: ['make-offer'],
			priority: 'low',
		});
		expect(page.events.map(({ id, height, timestamp }) => [id, height, timestamp])).toEqual([
			[id, 21, 210],
			[id, 19, 190],
		]);
		expect(fetcher).toHaveBeenCalledTimes(3);
	});

	it('rejects opaque cursor changes even when the ID matches', async () => {
		const id = 'Q'.repeat(43);
		const edge = { ...marketEdge(id, 100), cursor: 'scan-position' };
		const fetcher = vi.fn(async () => connection([blockEdge(id, 200, 22)]));
		await expect(
			readTransactionBlocks(fetcher, FALLBACK, [edge], {
				indexPages: [
					{
						edges: [edge],
						after: null,
						filters: { tags: edge.node.tags.map(({ name, value }) => ({ name, values: [value] })) },
					},
				],
			})
		).rejects.toThrow('transaction-blocks-incomplete');
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('keeps the wallet preview active while the preferred page waits for block metadata', async () => {
		const primary = marketEdge('P'.repeat(43), 100);
		const preview = { ...marketEdge('V'.repeat(43), 200, OTHER_ASSET), cursor: 'fallback-placement' };
		let releasePrimary!: (response: Response) => void;
		const primaryBlock = new Promise<Response>((resolve) => (releasePrimary = resolve));
		const onPage = vi.fn();
		const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
			const { query } = request(init);
			if (String(url) === GATEWAY)
				return query.includes('TransactionBlocks') ? primaryBlock : walletPage(primary);
			return query.includes('TransactionBlocks')
				? connection([{ cursor: preview.cursor, node: blockEdge(preview.node.id, 200, 31).node }])
				: walletPage(preview);
		});
		const scan = createWalletCandidateScan(ACTOR);
		const result = discoverWalletAssetCandidates(ACTOR, { fetch: fetcher, scan, onPage, previewAfterMs: 1 });
		try {
			await vi.waitFor(() =>
				expect(onPage).toHaveBeenCalledWith([expect.objectContaining({ processId: OTHER_ASSET, height: 31 })])
			);
			expect(scan.answeringIndex).toBeUndefined();
		} finally {
			releasePrimary(connection([blockEdge(primary.node.id, 100, 20)]));
			await Promise.allSettled([result]);
		}
		await expect(result).resolves.toEqual([expect.objectContaining({ processId: ASSET, height: 20 })]);
		expect(scan.answeringIndex).toBe(GATEWAY);
	});

	it('falls back on first-page block failure before pinning the wallet scan', async () => {
		const primary = marketEdge('P'.repeat(43), 100);
		const fallback = { ...marketEdge('V'.repeat(43), 200, OTHER_ASSET), cursor: 'fallback-placement' };
		const fetcher = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
			const { query } = request(init);
			if (String(url) === GATEWAY) {
				return query.includes('WalletAssetCandidates') ? walletPage(primary) : connection([]);
			}
			return query.includes('TransactionBlocks')
				? connection([{ cursor: fallback.cursor, node: blockEdge(fallback.node.id, 200, 31).node }])
				: walletPage(fallback);
		});
		const scan = createWalletCandidateScan(ACTOR);
		await expect(discoverWalletAssetCandidates(ACTOR, { fetch: fetcher, scan })).resolves.toEqual([
			expect.objectContaining({ processId: OTHER_ASSET, height: 31 }),
		]);
		expect(scan.answeringIndex).toBe(FALLBACK);
	});

	it('skips older activity across pages and keeps equal offsets and equal-height ties', async () => {
		const newest = marketEdge('N'.repeat(43), 210);
		const boundary = marketEdge('F'.repeat(43), 210, OTHER_ASSET);
		const sameOffset = marketEdge('S'.repeat(43), 210);
		const tied = marketEdge('T'.repeat(43), 200, OTHER_ASSET);
		const older = marketEdge('O'.repeat(43), 100);
		const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
			const { query, variables } = request(init);
			if (query.includes('TransactionBlocks')) {
				if (variables.ids?.includes(tied.node.id)) {
					return connection([blockEdge(tied.node.id, 200, 20), blockEdge(sameOffset.node.id, 210, 31)]);
				}
				return connection([blockEdge(newest.node.id, 210, 30), blockEdge(boundary.node.id, 210, 20)]);
			}
			expect(query).not.toMatch(/\bblock\s*\{/);
			if (variables.cursor === boundary.cursor) return connection([sameOffset, tied, older]);
			return connection([newest, boundary], true);
		});
		const result = await discoverMarketActivity({ fetch: fetcher, graphql: GATEWAY });
		expect(
			result.map(({ processId, height, timestamp, activityIds }) => ({
				processId,
				height,
				timestamp,
				activityIds,
			}))
		).toEqual([
			{ processId: ASSET, height: 31, timestamp: 310, activityIds: [sameOffset.node.id] },
			{ processId: OTHER_ASSET, height: 20, timestamp: 200, activityIds: [boundary.node.id, tied.node.id] },
		]);
		expect(fetcher.mock.calls.map(([, init]) => request(init).variables.ids).filter(Boolean)).toEqual([
			[newest.node.id, boundary.node.id],
			[sameOffset.node.id, tied.node.id],
		]);
	});

	it('compares real offer heights to the scheduler and enriches only the returned window', async () => {
		const outstanding = marketEdge('N'.repeat(43), 300);
		const consumed = marketEdge('C'.repeat(43), 200);
		const beyondLimit = marketEdge('F'.repeat(43), 100);
		const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
			const { query, variables } = request(init);
			if (query.includes('TransactionBlocks')) {
				expect(variables.ids).toEqual([outstanding.node.id, consumed.node.id]);
				return connection([blockEdge(consumed.node.id, 200, 19), blockEdge(outstanding.node.id, 300, 21)]);
			}
			expect(query).not.toMatch(/\bblock\s*\{/);
			return connection([outstanding, consumed, beyondLimit], true);
		});
		const state = { swapHeight: 20, orders: {} } as AssetState;
		await expect(
			discoverPendingAssetOffers(ASSET, state, { fetch: fetcher, graphql: GATEWAY, limit: 2 })
		).resolves.toEqual([expect.objectContaining({ id: outstanding.node.id, height: 21, timestamp: 210 })]);
	});

	it('filters a history page before fetching metadata and preserves the index count and cursor', async () => {
		const matching = marketEdge('M'.repeat(43), 200);
		const filtered = marketEdge('R'.repeat(43), 100, OTHER_ASSET);
		const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
			const { query, variables } = request(init);
			if (query.includes('TransactionBlocks')) {
				expect(variables.ids).toEqual([matching.node.id]);
				return connection([blockEdge(matching.node.id, 200, 20)]);
			}
			expect(query).toContain('count');
			expect(query).not.toMatch(/\bblock\s*\{/);
			return Response.json({
				data: { transactions: { count: '42', pageInfo: { hasNextPage: true }, edges: [matching, filtered] } },
			});
		});
		await expect(
			discoverCollectionActivityPage({ fetch: fetcher, graphql: GATEWAY, acceptProcessId: (id) => id === ASSET })
		).resolves.toMatchObject({
			totalCount: 42,
			hasNextPage: true,
			cursor: filtered.cursor,
			events: [expect.objectContaining({ id: matching.node.id, height: 20, timestamp: 200 })],
		});
	});
});
