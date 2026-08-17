import { describe, expect, it, vi } from 'vitest';

import { aoFetch } from './ao';

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

		const response = await routed('https://alpha.example/process-0~process@1.0/now');

		expect(await response.text()).toBe('charlie');
		expect(new Set(requested.filter((url) => url.endsWith('/process-0~process@1.0/now')))).toEqual(
			new Set([
				'https://alpha.example/process-0~process@1.0/now',
				'https://charlie.example/process-0~process@1.0/now',
			])
		);
	});

	it('fails over a compute read when its preferred peer returns a server error', async () => {
		const computeRequests: string[] = [];
		const routed = aoFetch(
			['https://alpha.example', 'https://charlie.example'],
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes('/~meta@1.0/info/format~hyperbuddy@1.0')) return Response.json({});
				computeRequests.push(url);
				return computeRequests.length === 1
					? new Response('hydrating', { status: 502 })
					: new Response('ready');
			}) as typeof fetch
		);

		const response = await routed('https://alpha.example/process~process@1.0/now');

		expect(await response.text()).toBe('ready');
		expect(computeRequests).toHaveLength(2);
		expect(new Set(computeRequests.map((url) => new URL(url).origin))).toEqual(
			new Set(['https://alpha.example', 'https://charlie.example'])
		);
	});

	it('distributes hashpaths across stable primary peers', async () => {
		const requested: string[] = [];
		const routed = aoFetch(
			['https://alpha.example', 'https://charlie.example'],
			vi.fn(async (input: RequestInfo | URL) => {
				requested.push(String(input));
				return new Response('ok');
			}) as typeof fetch
		);

		for (let index = 0; index < 8; index += 1) {
			expect(await (await routed(`https://alpha.example/process-${index}~process@1.0/now`)).text()).toBe('ok');
		}
		expect(new Set(requested.map((url) => new URL(url).origin))).toEqual(
			new Set(['https://alpha.example', 'https://charlie.example'])
		);
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
});
