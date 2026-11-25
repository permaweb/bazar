import { describe, expect, it, vi } from 'vitest';

import { withIndexedActivityBlocks } from '../test/indexed-activity';

import { createGlobalActivityPager } from './global-activity';

vi.hoisted(() => vi.stubEnv('VITE_GRAPHQL_ENDPOINTS', 'https://arweave.net/graphql,https://index.example/graphql'));

const asset = 'A'.repeat(43);
const foreign = 'F'.repeat(43);
function edge(id: string, cursor = id, processId = asset, action = 'make-offer', height = 10) {
	return {
		cursor,
		node: {
			id: id.repeat(43),
			recipient: processId,
			owner: { address: 'W'.repeat(43) },
			tags: [{ name: 'action', value: action }],
			block: height ? { height, timestamp: height * 100 } : null,
		},
	};
}
function response(edges: ReturnType<typeof edge>[], hasNextPage = true) {
	return Response.json({ data: { transactions: { pageInfo: { hasNextPage }, edges } } });
}
function setup(
	responses: Array<Response | Error>,
	options: Pick<Parameters<typeof createGlobalActivityPager>[0], 'graphql'> = {}
) {
	const requests: Array<{ url: string; query: string; variables: any }> = [];
	const fetcher = vi.fn(
		withIndexedActivityBlocks(async (input, init) => {
			requests.push({ url: String(input), ...JSON.parse(String(init?.body)) });
			const next = responses.shift();
			if (next instanceof Error) throw next;
			if (!next) throw new Error('unexpected-request');
			return next;
		})
	);
	const pager = createGlobalActivityPager({ ...options, fetch: fetcher, acceptProcessId: (id) => id === asset });
	return { pager, fetcher, requests };
}

describe('global activity native pagination', () => {
	it('scans one bounded index page and fetches blocks only for marketplace rows', async () => {
		const { pager, requests, fetcher } = setup([response([edge('a'), edge('f', 'raw-tail', foreign)])]);
		const page = await pager.load('all');
		expect(page.events.map((event) => event.id)).toEqual(['a'.repeat(43)]);
		expect(page).toMatchObject({ cursor: 'raw-tail', hasNextPage: true, loaded: true });
		expect(requests).toHaveLength(1);
		expect(requests[0].url).toBe('https://arweave.net/graphql');
		expect(requests[0].query).toContain('sort: HEIGHT_DESC');
		expect(requests[0].query).toContain('after: $cursor');
		expect(requests[0].query).not.toContain('count');
		expect(requests[0].query).not.toMatch(/\bblock\s*\{/);
		expect(requests[0].variables).toMatchObject({ first: 100, recipients: null });
		expect(requests[0].variables.tags).toEqual([
			{ name: 'action', values: ['make-offer', 'register-interest', 'transfer', 'cancel-order'] },
		]);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).variables.ids).toEqual(['a'.repeat(43)]);
	});

	it('keeps every indexed row when no membership filter is given, for a render-time catalogue filter', async () => {
		const requests: unknown[] = [];
		const pager = createGlobalActivityPager({
			fetch: withIndexedActivityBlocks(async (_input, init) => {
				requests.push(JSON.parse(String(init?.body)));
				return response([edge('a'), edge('f', 'raw-tail', foreign)]);
			}),
		});
		const page = await pager.load('all');
		expect(page.events.map((event) => event.processId)).toEqual([asset, foreign]);
		expect(requests).toHaveLength(1);
		// A later render with a larger catalogue reads the same page from memory.
		expect(pager.get('all').events).toBe(page.events);
	});

	it('advances past an empty accepted page only on the next explicit load', async () => {
		const { pager, requests } = setup([
			response([edge('f', 'foreign-tail', foreign)]),
			response([edge('a')], false),
		]);
		expect(await pager.load('all')).toMatchObject({ events: [], hasNextPage: true });
		expect(requests).toHaveLength(1);
		expect((await pager.load('all')).events).toHaveLength(1);
		expect(requests[1].variables.cursor).toBe('foreign-tail');
		await pager.load('all');
		expect(requests).toHaveLength(2);
	});

	it('keeps independent cursors and action predicates for each filter', async () => {
		const { pager, requests } = setup([
			response([edge('a', 'all-tail')]),
			response([edge('b', 'listing-tail')]),
			response([edge('c')], false),
		]);
		await pager.load('all');
		await pager.load('make-offer');
		await pager.load('all');
		expect(requests[1].variables.cursor).toBeUndefined();
		expect(requests[1].variables.tags).toEqual([{ name: 'action', values: ['make-offer'] }]);
		expect(requests[2].variables.cursor).toBe('all-tail');
		expect(pager.get('make-offer').cursor).toBe('listing-tail');
	});

	it('deduplicates overlaps without moving pending events below mined events', async () => {
		const { pager } = setup([
			response([edge('a', 'pending', asset, 'make-offer', 0), edge('b')]),
			response([edge('b'), edge('c')], false),
		]);
		await pager.load('all');
		const page = await pager.load('all');
		expect(page.events.map((event) => event.id)).toEqual(['a', 'b', 'c'].map((id) => id.repeat(43)));
	});

	it('preserves mined metadata when the gateway repeats an undated copy', async () => {
		const { pager } = setup([
			response([edge('a', 'mined', asset, 'make-offer', 10)]),
			response([edge('a', 'pending-copy', asset, 'make-offer', 0)], false),
		]);
		await pager.load('all');
		expect((await pager.load('all')).events).toMatchObject([{ height: 10, timestamp: 1000 }]);
	});

	it('keeps the last good page and retries its exact cursor after a network failure', async () => {
		const { pager, requests } = setup([
			response([edge('a', 'tail')]),
			new Error('offline'),
			response([edge('b')], false),
		]);
		const first = await pager.load('all');
		await expect(pager.load('all')).rejects.toThrow('offline');
		expect(pager.get('all')).toBe(first);
		await pager.load('all');
		expect(requests.slice(1).map((request) => request.variables.cursor)).toEqual(['tail', 'tail']);
	});

	it('refreshes from the head and replaces old pages so a stale tail cannot skip history', async () => {
		const { pager, requests } = setup(
			[
				response([edge('a', 'old-tail')]),
				new Error('offline'),
				response([edge('b', 'new-tail')]),
				response([edge('c')], false),
			],
			// One index: this covers refresh failure, not endpoint fallback.
			{ graphql: 'https://arweave.net/graphql' }
		);
		const first = await pager.load('all');
		await expect(pager.load('all', { refresh: true })).rejects.toThrow('offline');
		expect(pager.get('all')).toBe(first);
		expect((await pager.load('all', { refresh: true })).events.map((event) => event.id)).toEqual(['b'.repeat(43)]);
		await pager.load('all');
		expect(requests[2].variables.cursor).toBeUndefined();
		expect(requests[3].variables.cursor).toBe('new-tail');
	});

	it('returns to the index that issued a cursor for the next page', async () => {
		const { pager, requests } = setup([
			new Error('arweave.net offline'),
			response([edge('a', 'index-tail')]),
			response([edge('b')], false),
		]);
		await pager.load('all');
		await pager.load('all');
		expect(requests.map(({ url, variables }) => [url, variables.cursor])).toEqual([
			['https://arweave.net/graphql', undefined],
			['https://index.example/graphql', undefined],
			['https://index.example/graphql', 'index-tail'],
		]);
	});

	it('rejects repeated cursors and longer cycles without corrupting page state', async () => {
		const { pager } = setup([
			response([edge('a', 'first')]),
			response([edge('b', 'second')]),
			response([edge('c', 'first')]),
		]);
		await pager.load('all');
		const second = await pager.load('all');
		await expect(pager.load('all')).rejects.toThrow('pagination-stalled');
		expect(pager.get('all')).toBe(second);
		const repeated = setup([response([edge('a', 'same')]), response([edge('b', 'same')])]);
		await repeated.pager.load('all');
		await expect(repeated.pager.load('all')).rejects.toThrow('pagination-stalled');
	});

	it('does not publish an obsolete response after its filter or scope is aborted', async () => {
		let finish!: (response: Response) => void;
		const pager = createGlobalActivityPager({
			fetch: () =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		});
		const controller = new AbortController();
		const pending = pager.load('all', { signal: controller.signal });
		controller.abort();
		finish(response([edge('a')]));
		await expect(pending).rejects.toThrow();
		expect(pager.get('all')).toMatchObject({ loaded: false, events: [] });
	});

	it('returns registration submissions with no purchase verification', async () => {
		const registration = edge('r', 'registration', asset, 'register-interest');
		const { pager, requests, fetcher } = setup([response([registration], false)]);
		const page = await pager.load('all');
		expect(page.events).toMatchObject([{ id: 'r'.repeat(43), action: 'register-interest' }]);
		expect(page.events[0].purchaseProof).toBeUndefined();
		expect(requests).toHaveLength(1);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(requests[0].url).toBe('https://arweave.net/graphql');
	});
});
