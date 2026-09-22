import { describe, expect, it, vi } from 'vitest';

import { GLOBAL_ACTIVITY_STATS_STORAGE_KEY } from 'helpers/browser-storage';

import {
	createGlobalActivityStatsScan,
	GLOBAL_ACTIVITY_STATS_MAX_AGE,
	loadGlobalActivityStats,
	saveGlobalActivityStats,
} from './global-activity-stats';

const asset = 'A'.repeat(43);
const actor = 'W'.repeat(43);
function page(id: string, cursor: string, hasNextPage: boolean, processId = asset) {
	return Response.json({
		data: {
			transactions: {
				pageInfo: { hasNextPage },
				edges: [
					{
						cursor,
						node: {
							id: id.repeat(43),
							recipient: processId,
							owner: { address: actor },
							tags: [{ name: 'action', value: 'make-offer' }],
							block: { height: 10, timestamp: 100 },
						},
					},
				],
			},
		},
	});
}

describe('independent global stats scan', () => {
	it('reads every native cursor page, deduplicates events, and counts distinct signing wallets', async () => {
		const bodies: any[] = [];
		const pages = [page('a', 'first', true), page('a', 'second', true), page('b', 'third', false)];
		const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			expect(String(input)).toBe('https://arweave.net/graphql');
			bodies.push(JSON.parse(String(init?.body)));
			return pages.shift()!;
		});
		const scan = createGlobalActivityStatsScan([asset], { fetch: fetcher });
		const stats = await scan.run(new AbortController().signal);
		expect(stats).toMatchObject({ events: 2, listings: 2, participants: 1 });
		expect(bodies.map((body) => body.variables.cursor)).toEqual([undefined, 'first', 'second']);
		expect(bodies.every((body) => !body.query.includes('count') && body.variables.first === 100)).toBe(true);
	});

	it('does not lose dated chart events when the index repeats undated copies', async () => {
		const undated = await page('a', 'last', false).json();
		undated.data.transactions.edges[0].node.block = null;
		const pages = [page('a', 'first', true), Response.json(undated)];
		const stats = await createGlobalActivityStatsScan([asset], { fetch: async () => pages.shift()! }).run(
			new AbortController().signal
		);
		expect(stats.events).toBe(1);
		expect(stats.buckets.reduce((sum, bucket) => sum + bucket.events, 0)).toBe(1);
	});

	it('bounds the parallel recipient pool and gates every request behind foreground paging', async () => {
		const ids = Array.from({ length: 505 }, (_, index) => index.toString(36).padStart(43, 'X'));
		const batches: string[][] = [];
		let active = 0;
		let maxActive = 0;
		const gate = vi.fn(async () => {});
		const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			active += 1;
			maxActive = Math.max(maxActive, active);
			const batch = JSON.parse(String(init?.body)).variables.recipients;
			batches.push(batch);
			await Promise.resolve();
			active -= 1;
			return page(String(batches.length), 'tail', false, batch[0]);
		});
		await createGlobalActivityStatsScan(ids, { fetch: fetcher }).run(new AbortController().signal, gate);
		expect(batches.map((batch) => batch.length)).toEqual([100, 100, 100, 100, 100, 5]);
		expect(new Set(batches.flat()).size).toBe(505);
		expect(maxActive).toBe(4);
		expect(gate).toHaveBeenCalledTimes(6);
	});

	it('resumes the failed page on retry and only starts over on an explicit reset', async () => {
		const cursors: Array<string | undefined> = [];
		const responses = [
			page('a', 'first', true),
			new Error('offline'),
			page('b', 'last', false),
			page('c', 'new', false),
		];
		const scan = createGlobalActivityStatsScan([asset], {
			fetch: async (_input, init) => {
				cursors.push(JSON.parse(String(init?.body)).variables.cursor);
				const response = responses.shift()!;
				if (response instanceof Error) throw response;
				return response;
			},
		});
		await expect(scan.run(new AbortController().signal)).rejects.toThrow('offline');
		expect(await scan.run(new AbortController().signal)).toMatchObject({ events: 2 });
		expect(cursors).toEqual([undefined, 'first', 'first']);
		scan.reset();
		expect(await scan.run(new AbortController().signal)).toMatchObject({ events: 1 });
		expect(cursors.at(-1)).toBeUndefined();
	});

	it('does not start a background request until foreground paging yields', async () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const fetcher = vi.fn(async () => page('a', 'end', false));
		const scan = createGlobalActivityStatsScan([asset], { fetch: fetcher });
		const controller = new AbortController();
		const pending = scan.run(controller.signal, () => gate);
		expect(fetcher).not.toHaveBeenCalled();
		controller.abort();
		release();
		await expect(pending).rejects.toThrow();
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('rejects cursor cycles instead of publishing incomplete totals', async () => {
		const pages = [page('a', 'one', true), page('b', 'two', true), page('c', 'one', true)];
		const scan = createGlobalActivityStatsScan([asset], { fetch: async () => pages.shift()! });
		await expect(scan.run(new AbortController().signal)).rejects.toThrow('pagination-stalled');
	});
});

describe('completed global stats cache', () => {
	const snapshot = {
		scope: 'gateway|catalogue',
		savedAt: 1000,
		stats: { events: 2, listings: 1, participants: 1, buckets: [], period: 'Jan 1 – Jan 2' },
	};
	it('reuses only fresh summaries for the exact gateway and marketplace scope', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => {
				values.set(key, value);
			},
		};
		saveGlobalActivityStats(storage, snapshot);
		expect(values.has(GLOBAL_ACTIVITY_STATS_STORAGE_KEY)).toBe(true);
		expect(loadGlobalActivityStats(storage, snapshot.scope, 1001)).toEqual(snapshot);
		expect(loadGlobalActivityStats(storage, 'other-gateway|catalogue', 1001)).toBeNull();
		expect(loadGlobalActivityStats(storage, snapshot.scope, 1000 + GLOBAL_ACTIVITY_STATS_MAX_AGE)).toBeNull();
		expect(loadGlobalActivityStats(storage, snapshot.scope, 999)).toBeNull();
	});
	it('ignores corrupt caches and storage failures', () => {
		expect(loadGlobalActivityStats({ getItem: () => '{broken', setItem: () => {} }, snapshot.scope)).toBeNull();
		expect(
			loadGlobalActivityStats(
				{ getItem: () => JSON.stringify({ version: 1, ...snapshot, stats: { events: 2 } }), setItem: () => {} },
				snapshot.scope,
				1001
			)
		).toBeNull();
		expect(() =>
			saveGlobalActivityStats(
				{
					getItem: () => null,
					setItem: () => {
						throw new Error('quota');
					},
				},
				snapshot
			)
		).not.toThrow();
	});
});
