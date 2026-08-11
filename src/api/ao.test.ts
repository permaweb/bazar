import { describe, expect, it, vi } from 'vitest';

import { aoFetch, createAoFetch } from './ao';

describe('AO peer routing', () => {
	it('routes an application default URL through the full fallback peer list', async () => {
		const requested: string[] = [];
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			requested.push(url);
			if (url.includes('/~meta@1.0/info/format~hyperbuddy@1.0')) {
				return Response.json({ 'requests-per-minute': 600 });
			}
			return url.startsWith('https://alpha.example/')
				? new Response('slow down', { status: 429, headers: { 'retry-after': '0' } })
				: new Response('charlie');
		});
		const routed = aoFetch(['https://alpha.example', 'https://charlie.example'], fetcher as typeof fetch);

		const response = await routed('https://alpha.example/process~process@1.0/now');

		expect(await response.text()).toBe('charlie');
		expect(requested.filter((url) => url.endsWith('/process~process@1.0/now'))).toEqual([
			'https://alpha.example/process~process@1.0/now',
			'https://charlie.example/process~process@1.0/now',
		]);
	});

	it('leaves an explicitly different origin untouched', async () => {
		const requested: string[] = [];
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			requested.push(String(input));
			return new Response('ok');
		});
		const routed = aoFetch(['https://alpha.example', 'https://charlie.example'], fetcher as typeof fetch);

		await routed('https://arweave.net/graphql');

		expect(requested.at(-1)).toBe('https://arweave.net/graphql');
	});

	it('can create an isolated bounded client without rate discovery', async () => {
		const requested: string[] = [];
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			requested.push(String(input));
			return new Response('ok');
		});
		const routed = createAoFetch(['https://alpha.example'], { requests: 8, period: 1 }, fetcher as typeof fetch);

		await routed('https://alpha.example/process~process@1.0/compute');

		expect(requested).toEqual(['https://alpha.example/process~process@1.0/compute']);
	});
});
