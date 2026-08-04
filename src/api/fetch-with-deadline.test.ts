import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchJsonWithDeadline, fetchTextWithDeadline, fetchWithDeadline } from './fetch-with-deadline';

afterEach(() => {
	vi.useRealTimers();
});

describe('fetchWithDeadline', () => {
	it('ends a request even when its fetcher ignores abort', async () => {
		vi.useFakeTimers();
		const fetcher = vi.fn(() => new Promise<Response>(() => undefined));
		const request = fetchWithDeadline(fetcher as typeof fetch, '/graphql', {}, {
			timeoutMs: 50,
			timeoutError: 'graphql-timeout',
		});
		const rejection = expect(request).rejects.toThrow('graphql-timeout');

		await vi.advanceTimersByTimeAsync(50);
		await rejection;
		expect(vi.getTimerCount()).toBe(0);
	});

	it('preserves the caller abort reason and clears its deadline', async () => {
		vi.useFakeTimers();
		const caller = new AbortController();
		const reason = new Error('route-changed');
		const fetcher = vi.fn(() => new Promise<Response>(() => undefined));
		const request = fetchWithDeadline(fetcher as typeof fetch, '/graphql', { signal: caller.signal }, {
			timeoutMs: 500,
			timeoutError: 'graphql-timeout',
		});
		const rejection = expect(request).rejects.toBe(reason);

		caller.abort(reason);
		await rejection;
		expect(vi.getTimerCount()).toBe(0);
	});

	it('gives every request its own complete deadline', async () => {
		vi.useFakeTimers();
		const fetcher = vi.fn(
			() => new Promise<Response>((resolve) => setTimeout(() => resolve(new Response('ok')), 40))
		);
		const first = fetchWithDeadline(fetcher as typeof fetch, '/page-1', {}, {
			timeoutMs: 50,
			timeoutError: 'graphql-timeout',
		});
		await vi.advanceTimersByTimeAsync(40);
		await expect(first).resolves.toBeInstanceOf(Response);

		const second = fetchWithDeadline(fetcher as typeof fetch, '/page-2', {}, {
			timeoutMs: 50,
			timeoutError: 'graphql-timeout',
		});
		await vi.advanceTimersByTimeAsync(40);
		await expect(second).resolves.toBeInstanceOf(Response);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('keeps the deadline active while a JSON response body is streaming', async () => {
		vi.useFakeTimers();
		const fetcher = vi.fn(async () => new Response(new ReadableStream({ start() {} })));
		const request = fetchJsonWithDeadline(fetcher as typeof fetch, '/graphql', {}, {
			timeoutMs: 50,
			timeoutError: 'graphql-body-timeout',
		});
		const rejection = expect(request).rejects.toThrow('graphql-body-timeout');

		await vi.advanceTimersByTimeAsync(50);
		await rejection;
		expect(vi.getTimerCount()).toBe(0);
	});

	it('preserves a caller abort that arrives after response headers', async () => {
		const caller = new AbortController();
		const reason = new Error('route-changed-after-headers');
		const fetcher = vi.fn(async () => new Response(new ReadableStream({ start() {} })));
		const request = fetchTextWithDeadline(fetcher as typeof fetch, '/manifest', { signal: caller.signal }, {
			timeoutMs: 500,
			timeoutError: 'manifest-body-timeout',
		});
		await Promise.resolve();
		const rejection = expect(request).rejects.toBe(reason);

		caller.abort(reason);

		await rejection;
	});

	it('clears the deadline after a complete body read', async () => {
		vi.useFakeTimers();
		const result = await fetchJsonWithDeadline(async () => Response.json({ ok: true }), '/graphql', {}, {
			timeoutMs: 50,
			timeoutError: 'graphql-body-timeout',
		});

		expect(result.body).toEqual({ ok: true });
		expect(vi.getTimerCount()).toBe(0);
	});
});
