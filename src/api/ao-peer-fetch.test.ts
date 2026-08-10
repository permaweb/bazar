import { createServer } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAoPeerFetch } from './ao-peer-fetch';

afterEach(() => {
	vi.useRealTimers();
});

describe('AO peer rate control', () => {
	it('honors Retry-After before retrying a 429', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const calledAt: number[] = [];
		const fetcher = vi.fn(async () => {
			calledAt.push(Date.now());
			return calledAt.length === 1
				? new Response('slow down', { status: 429, headers: { 'retry-after': '2' } })
				: new Response('ok');
		});
		const request = createAoPeerFetch(fetcher as typeof fetch)('https://peer.example/process');

		await vi.advanceTimersByTimeAsync(1_999);
		expect(fetcher).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		await expect(request).resolves.toMatchObject({ status: 200 });
		expect(calledAt).toEqual([0, 2_000]);
	});

	it('cuts one burst once and paces every retry for that peer', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const calledAt: number[] = [];
		const fetcher = vi.fn(async () => {
			calledAt.push(Date.now());
			return calledAt.length <= 3
				? new Response('slow down', { status: 429, headers: { 'retry-after': '1' } })
				: new Response('ok');
		});
		const peerFetch = createAoPeerFetch(fetcher as typeof fetch, { maxRetries: 1 });
		const requests = Promise.all(
			Array.from({ length: 3 }, (_, index) => peerFetch(`https://peer.example/process/${index}`))
		);

		await vi.advanceTimersByTimeAsync(1_000);
		expect(fetcher).toHaveBeenCalledTimes(4);
		await vi.advanceTimersByTimeAsync(499);
		expect(fetcher).toHaveBeenCalledTimes(4);
		await vi.advanceTimersByTimeAsync(1);
		expect(fetcher).toHaveBeenCalledTimes(5);
		await vi.advanceTimersByTimeAsync(500);
		await expect(requests).resolves.toHaveLength(3);
		expect(calledAt).toEqual([0, 0, 0, 1_000, 1_500, 2_000]);
	});

	it('keeps different peers independent', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const fetcher = vi.fn(async (input: RequestInfo | URL) =>
			String(input).includes('first.example')
				? new Response('slow down', { status: 429, headers: { 'retry-after': '60' } })
				: new Response('ok')
		);
		const peerFetch = createAoPeerFetch(fetcher as typeof fetch, { maxRetries: 0 });

		await expect(peerFetch('https://first.example/process')).resolves.toMatchObject({ status: 429 });
		await expect(peerFetch('https://second.example/process')).resolves.toMatchObject({ status: 200 });
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('recovers rate gradually after a clean control window', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const calledAt: number[] = [];
		const fetcher = vi.fn(async () => {
			calledAt.push(Date.now());
			return calledAt.length <= 4
				? new Response('slow down', { status: 429, headers: { 'retry-after': '0' } })
				: new Response('ok');
		});
		const peerFetch = createAoPeerFetch(fetcher as typeof fetch, {
			controlWindowMs: 1_000,
			decreaseFactor: 0.5,
			recoveryFactor: 2,
			maxRetries: 0,
		});
		await Promise.all(Array.from({ length: 4 }, () => peerFetch('https://peer.example/process')));

		await vi.advanceTimersByTimeAsync(1_000);
		await peerFetch('https://peer.example/after-window');
		const next = peerFetch('https://peer.example/next');
		await vi.advanceTimersByTimeAsync(249);
		expect(fetcher).toHaveBeenCalledTimes(5);
		await vi.advanceTimersByTimeAsync(1);
		await next;
		expect(calledAt.slice(-2)).toEqual([1_000, 1_250]);
	});

	it('applies a per-peer ceiling and aborts a queued request cleanly', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const fetcher = vi.fn(async () => new Response('ok'));
		const peerFetch = createAoPeerFetch(fetcher as typeof fetch, {
			maxRequestsPerSecond: { 'https://peer.example': 1 },
		});
		await peerFetch('https://peer.example/first');
		const controller = new AbortController();
		const reason = new Error('route changed');
		const queued = peerFetch('https://peer.example/second', { signal: controller.signal });

		controller.abort(reason);
		await expect(queued).rejects.toBe(reason);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('smooths a real concurrent 429 burst before it reaches the peer again', async () => {
		const burst = 20;
		const calledAt: number[] = [];
		const server = createServer((_request, response) => {
			calledAt.push(Date.now());
			if (calledAt.length <= burst) {
				response.writeHead(429, { 'retry-after': '1' }).end('slow down');
			} else {
				response.writeHead(200).end('ok');
			}
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		try {
			const address = server.address();
			if (!address || typeof address === 'string') throw new Error('test-server-address-missing');
			const peerFetch = createAoPeerFetch(globalThis.fetch.bind(globalThis), { maxRetries: 1 });
			const responses = await Promise.all(
				Array.from({ length: burst }, (_, index) =>
					peerFetch(`http://127.0.0.1:${address.port}/process/${index}`)
				)
			);

			expect(responses.every((response) => response.ok)).toBe(true);
			expect(calledAt).toHaveLength(burst * 2);
			expect(calledAt[burst] - Math.max(...calledAt.slice(0, burst))).toBeGreaterThanOrEqual(900);
			for (let index = burst + 1; index < calledAt.length; index += 1) {
				expect(calledAt[index] - calledAt[index - 1]).toBeGreaterThanOrEqual(50);
			}
		} finally {
			await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
		}
	});
});
