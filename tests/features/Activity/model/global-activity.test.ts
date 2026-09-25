import { describe, expect, it, vi } from 'vitest';

import { createGlobalActivityPager } from 'features/Activity/model/global-activity';

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
function setup(responses: Array<Response | Error>) {
	const requests: Array<{ url: string; query: string; variables: any }> = [];
	const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		requests.push({ url: String(input), ...JSON.parse(String(init?.body)) });
		const next = responses.shift();
		if (next instanceof Error) throw next;
		if (!next) throw new Error('unexpected-request');
		return next;
	});
	const pager = createGlobalActivityPager({ fetch: fetcher, acceptProcessId: (id) => id === asset });
	return { pager, fetcher, requests };
}

describe('global activity native pagination', () => {
	it('makes one bounded native GraphQL request and checks marketplace membership locally', async () => {
		const { pager, requests } = setup([response([edge('a'), edge('f', 'raw-tail', foreign)])]);
		const page = await pager.load('all');
		expect(page.events.map((event) => event.id)).toEqual(['a'.repeat(43)]);
		expect(page).toMatchObject({ cursor: 'raw-tail', hasNextPage: true, loaded: true });
		expect(requests).toHaveLength(1);
		expect(requests[0].url).toBe('https://arweave.net/graphql');
		expect(requests[0].query).toContain('sort: HEIGHT_DESC');
		expect(requests[0].query).toContain('after: $cursor');
		expect(requests[0].query).not.toContain('count');
		expect(requests[0].variables).toMatchObject({ first: 100, recipients: null });
		expect(requests[0].variables.tags).toEqual([
			{ name: 'action', values: ['make-offer', 'register-interest', 'transfer', 'cancel-order'] },
		]);
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
		await expect(pager.load('all')).rejects.toThrow('collection-activity-graphql-failed');
		expect(pager.get('all')).toBe(first);
		await pager.load('all');
		expect(requests.slice(1).map((request) => request.variables.cursor)).toEqual(['tail', 'tail']);
	});

	it('refreshes from the head and replaces old pages so a stale tail cannot skip history', async () => {
		const { pager, requests } = setup([
			response([edge('a', 'old-tail')]),
			new Error('offline'),
			response([edge('b', 'new-tail')]),
			response([edge('c')], false),
		]);
		const first = await pager.load('all');
		await expect(pager.load('all', { refresh: true })).rejects.toThrow('collection-activity-graphql-failed');
		expect(pager.get('all')).toBe(first);
		expect((await pager.load('all', { refresh: true })).events.map((event) => event.id)).toEqual(['b'.repeat(43)]);
		await pager.load('all');
		expect(requests[2].variables.cursor).toBeUndefined();
		expect(requests[3].variables.cursor).toBe('new-tail');
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

	it('returns registration submissions with one GraphQL request and no purchase verification', async () => {
		const registration = edge('r', 'registration', asset, 'register-interest');
		const { pager, requests, fetcher } = setup([response([registration], false)]);
		const page = await pager.load('all');
		expect(page.events).toMatchObject([{ id: 'r'.repeat(43), action: 'register-interest' }]);
		expect(page.events[0].purchaseProof).toBeUndefined();
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(requests[0].url).toBe('https://arweave.net/graphql');
	});
});
