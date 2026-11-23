import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	graphqlEndpointList,
	graphqlIdBatchSize,
	graphqlSupportsCount,
	postGraphql,
	retryTransientGraphql,
	usableGraphqlPayload,
} from './graphql';

vi.hoisted(() => vi.stubEnv('VITE_GRAPHQL_ENDPOINTS', 'https://arweave.net/graphql,https://index.example/graphql'));

const primary = 'https://arweave.net/graphql';
const secondary = 'https://index.example/graphql';
const data = (id: string) => ({ data: { transactions: { pageInfo: { hasNextPage: false }, edges: [], id } } });

type Planned = { delayMs?: number; respond: () => Response | Promise<Response> };

function plannedFetch(plans: Record<string, Planned>) {
	const aborted: string[] = [];
	const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
		const endpoint = String(input);
		const plan = plans[endpoint];
		if (!plan) return Promise.reject(new Error(`unexpected-${endpoint}`));
		return new Promise<Response>((resolve, reject) => {
			const timer = setTimeout(() => Promise.resolve(plan.respond()).then(resolve, reject), plan.delayMs ?? 0);
			init?.signal?.addEventListener('abort', () => {
				clearTimeout(timer);
				aborted.push(endpoint);
				reject(init.signal?.reason);
			});
		});
	});
	return { fetcher: fetcher as unknown as typeof fetch & typeof fetcher, aborted };
}

const request = { method: 'POST', body: '{}' };
const options = { timeoutMs: 10_000, timeoutError: 'graphql-timeout' };

afterEach(() => {
	vi.useRealTimers();
});

describe('GraphQL endpoint capabilities', () => {
	it('pins an explicit endpoint and otherwise uses the configured ordered list', () => {
		expect(graphqlEndpointList(secondary)).toEqual([secondary]);
		expect(graphqlEndpointList([secondary, primary, secondary])).toEqual([secondary, primary]);
		expect(graphqlEndpointList()).toEqual([primary, secondary]);
	});

	it('sends the count extension only to arweave.net indexes', () => {
		expect(graphqlSupportsCount(primary)).toBe(true);
		expect(graphqlSupportsCount('https://bazar.arweave.net/graphql')).toBe(true);
		expect(graphqlSupportsCount(secondary)).toBe(false);
		expect(graphqlSupportsCount('not a url')).toBe(false);
	});

	it('sizes id batches that may fall back for the most restrictive endpoint', () => {
		expect(graphqlIdBatchSize([secondary])).toBe(100);
		expect(graphqlIdBatchSize([secondary, primary])).toBe(9);
	});

	it('accepts only 2xx JSON payloads with data and no errors', () => {
		const ok = new Response(null, { status: 200 });
		expect(usableGraphqlPayload({ response: ok, body: data('x') })).toBe(true);
		expect(usableGraphqlPayload({ response: ok, body: { data: { transaction: null } } })).toBe(true);
		expect(usableGraphqlPayload({ response: ok, body: { data: null } })).toBe(false);
		expect(usableGraphqlPayload({ response: ok, body: { data: {}, errors: [{ message: 'bad' }] } })).toBe(false);
		expect(usableGraphqlPayload({ response: ok, body: undefined })).toBe(false);
		expect(usableGraphqlPayload({ response: new Response(null, { status: 400 }), body: undefined })).toBe(false);
	});
});

describe('postGraphql', () => {
	const edges = (...ids: string[]) => ({
		data: {
			transactions: {
				pageInfo: { hasNextPage: false },
				edges: ids.map((id) => ({ cursor: id, node: { id } })),
			},
		},
	});

	it('keeps a slow but usable preferred answer over a faster, smaller fallback index', async () => {
		vi.useFakeTimers();
		const { fetcher } = plannedFetch({
			[primary]: { delayMs: 4_400, respond: () => Response.json(edges('a', 'b', 'c')) },
			[secondary]: { delayMs: 150, respond: () => Response.json(edges('a')) },
		});
		const result = postGraphql(fetcher, [primary, secondary], request, options);
		await vi.advanceTimersByTimeAsync(4_400);

		await expect(result).resolves.toMatchObject({ endpoint: primary, body: edges('a', 'b', 'c') });
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('keeps a preferred answer with edges over a fallback that would answer with none', async () => {
		vi.useFakeTimers();
		const { fetcher } = plannedFetch({
			[primary]: { delayMs: 3_000, respond: () => Response.json(edges('profile')) },
			[secondary]: { respond: () => Response.json(edges()) },
		});
		const result = postGraphql(fetcher, [primary, secondary], request, options);
		await vi.advanceTimersByTimeAsync(3_000);

		await expect(result).resolves.toMatchObject({ endpoint: primary, body: edges('profile') });
		expect(fetcher.mock.calls.map(([url]) => url)).toEqual([primary]);
	});

	it.each([
		['a rate limit', () => new Response('busy', { status: 429 })],
		['a server error', () => new Response('down', { status: 503 })],
		['a rejected query', () => new Response('bad', { status: 400 })],
		['a GraphQL error answer', () => Response.json({ errors: [{ message: 'unknown field' }] })],
		['a non-JSON 200 body', () => new Response('<html>', { status: 200 })],
		['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
	])('falls back only after the preferred endpoint fails with %s', async (_label, respond) => {
		vi.useFakeTimers();
		const { fetcher } = plannedFetch({
			[primary]: { delayMs: 50, respond },
			[secondary]: { delayMs: 50, respond: () => Response.json(data('secondary')) },
		});
		const result = postGraphql(fetcher, [primary, secondary], request, options);
		await vi.advanceTimersByTimeAsync(49);
		expect(fetcher).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(51);

		await expect(result).resolves.toMatchObject({ endpoint: secondary, body: data('secondary') });
		expect(fetcher.mock.calls.map(([url]) => url)).toEqual([primary, secondary]);
	});

	it('falls back when the preferred endpoint reaches its deadline', async () => {
		vi.useFakeTimers();
		const { fetcher, aborted } = plannedFetch({
			[primary]: { delayMs: 60_000, respond: () => Response.json(data('primary')) },
			[secondary]: { delayMs: 300, respond: () => Response.json(data('secondary')) },
		});
		const result = postGraphql(fetcher, [primary, secondary], request, { ...options, timeoutMs: 2_000 });
		await vi.advanceTimersByTimeAsync(1_999);
		expect(fetcher).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(301);

		await expect(result).resolves.toMatchObject({ endpoint: secondary, body: data('secondary') });
		expect(aborted).toEqual([primary]);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('returns the preferred endpoint outcome when no endpoint answers usably', async () => {
		vi.useFakeTimers();
		const { fetcher } = plannedFetch({
			[primary]: { delayMs: 20, respond: () => new Response('busy', { status: 429 }) },
			[secondary]: { delayMs: 5, respond: () => new Response('down', { status: 503 }) },
		});
		const result = postGraphql(fetcher, [primary, secondary], request, options);
		await vi.advanceTimersByTimeAsync(30);

		const settled = await result;
		expect(settled.endpoint).toBe(primary);
		expect(settled.response.status).toBe(429);
		expect(settled.body).toBeUndefined();
	});

	it('rethrows the preferred endpoint failure after every endpoint fails', async () => {
		vi.useFakeTimers();
		const { fetcher } = plannedFetch({
			[primary]: { respond: () => Promise.reject(new Error('primary-offline')) },
			[secondary]: { respond: () => new Response('<html>', { status: 200 }) },
		});
		const result = postGraphql(fetcher, [primary, secondary], request, options);
		const rejection = expect(result).rejects.toThrow('primary-offline');
		await vi.advanceTimersByTimeAsync(1);
		await rejection;
	});

	it('bounds the call by one deadline per endpoint attempted', async () => {
		vi.useFakeTimers();
		const hung = vi.fn(() => new Promise<Response>(() => undefined));
		const result = postGraphql(hung as typeof fetch, [primary, secondary], request, {
			timeoutMs: 2_000,
			timeoutError: 'graphql-timeout',
		});
		const rejection = expect(result).rejects.toThrow('graphql-timeout');

		await vi.advanceTimersByTimeAsync(2_000);
		expect(hung).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(2_000);
		await rejection;
		expect(vi.getTimerCount()).toBe(0);
	});

	it('builds each endpoint its own request body', async () => {
		vi.useFakeTimers();
		const { fetcher } = plannedFetch({
			[primary]: { respond: () => new Response('bad', { status: 400 }) },
			[secondary]: { respond: () => Response.json(data('secondary')) },
		});
		const result = postGraphql(
			fetcher,
			[primary, secondary],
			(endpoint) => ({ method: 'POST', body: endpoint }),
			options
		);
		await vi.advanceTimersByTimeAsync(1);

		await expect(result).resolves.toMatchObject({ endpoint: secondary });
		expect(fetcher.mock.calls.map(([, init]) => init?.body)).toEqual([primary, secondary]);
	});

	it('stops without trying the fallback when the caller aborts', async () => {
		vi.useFakeTimers();
		const caller = new AbortController();
		const reason = new Error('route-changed');
		const { fetcher, aborted } = plannedFetch({
			[primary]: { delayMs: 10_000, respond: () => Response.json(data('primary')) },
			[secondary]: { delayMs: 10_000, respond: () => Response.json(data('secondary')) },
		});
		const result = postGraphql(fetcher, [primary, secondary], { ...request, signal: caller.signal }, options);
		const rejection = expect(result).rejects.toBe(reason);
		await vi.advanceTimersByTimeAsync(1_500);

		caller.abort(reason);
		await rejection;
		expect(aborted).toEqual([primary]);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('retryTransientGraphql', () => {
	const answer = (status: number) => ({ response: new Response('', { status }) });

	it('retries network failures, 429 and 5xx, then returns the first lasting answer', async () => {
		const request = vi
			.fn()
			.mockRejectedValueOnce(new Error('asset-discovery-graphql-timeout'))
			.mockResolvedValueOnce(answer(429))
			.mockResolvedValueOnce(answer(503))
			.mockResolvedValueOnce(answer(200));

		const result = await retryTransientGraphql(request, [0, 0, 0]);

		expect(result.response.status).toBe(200);
		expect(request).toHaveBeenCalledTimes(4);
	});

	it('returns a non-transient answer without retrying', async () => {
		const request = vi.fn().mockResolvedValue(answer(400));

		await expect(retryTransientGraphql(request, [0, 0])).resolves.toMatchObject({ response: { status: 400 } });
		expect(request).toHaveBeenCalledTimes(1);
	});

	it('keeps the last outcome once the retries are spent', async () => {
		const failing = vi.fn().mockRejectedValue(new Error('asset-discovery-graphql-timeout'));
		await expect(retryTransientGraphql(failing, [0])).rejects.toThrow('asset-discovery-graphql-timeout');
		expect(failing).toHaveBeenCalledTimes(2);

		const unavailable = vi.fn().mockResolvedValue(answer(503));
		await expect(retryTransientGraphql(unavailable, [])).resolves.toMatchObject({ response: { status: 503 } });
		expect(unavailable).toHaveBeenCalledTimes(1);
	});

	it("waits for a fallback index's Retry-After when the preferred index failed without one", async () => {
		vi.useFakeTimers();
		let round = 0;
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			if (String(input) === primary) {
				round += 1;
				if (round === 1) throw new Error('graphql-timeout');
				if (round === 2) return new Response('busy', { status: 503 });
				return Response.json(data('answered'));
			}
			return new Response('slow down', { status: 429, headers: { 'retry-after': round === 1 ? '5' : '3' } });
		});
		const pending = retryTransientGraphql(
			() => postGraphql(fetcher as typeof fetch, [primary, secondary], request, options),
			[1_000, 1_000]
		);

		// Round 1: arweave.net timed out (thrown), the fallback index said 429 Retry-After 5.
		await vi.advanceTimersByTimeAsync(4_999);
		expect(fetcher).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1);
		// Round 2: arweave.net answered 503 without Retry-After, the fallback index 429 Retry-After 3.
		expect(fetcher).toHaveBeenCalledTimes(4);
		await vi.advanceTimersByTimeAsync(2_999);
		expect(fetcher).toHaveBeenCalledTimes(4);
		await vi.advanceTimersByTimeAsync(1);
		await expect(pending).resolves.toMatchObject({ endpoint: primary, response: { status: 200 } });
		expect(fetcher).toHaveBeenCalledTimes(5);
	});

	it('reports the longest Retry-After on a preferred outcome that no endpoint improved', async () => {
		const fetcher = vi.fn(async (input: RequestInfo | URL) =>
			String(input) === primary
				? new Response('busy', { status: 503, headers: { 'retry-after': '2' } })
				: new Response('slow down', { status: 429, headers: { 'retry-after': '60' } })
		);

		const result = await postGraphql(fetcher as typeof fetch, [primary, secondary], request, options);

		expect(result.response.status).toBe(503);
		// Capped at 10 s like any Retry-After.
		expect(result.retryAfterMs).toBe(10_000);
	});

	it('stops waiting for a retry when the caller aborts', async () => {
		vi.useFakeTimers();
		const controller = new AbortController();
		const request = vi.fn().mockResolvedValue(answer(503));
		const pending = retryTransientGraphql(request, [10_000], controller.signal);
		const rejection = expect(pending).rejects.toThrow('stopped');

		await vi.advanceTimersByTimeAsync(0);
		controller.abort(new Error('stopped'));
		await rejection;
		expect(request).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});
});
