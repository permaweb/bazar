import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	aoRoutingScopeFromLocation,
	DEFAULT_COMPUTE_GATEWAYS,
	type EffectivePermawebNetworkPolicy,
	observerRelayFromLocation,
	permanentContentGatewayFromLocation,
} from 'helpers/config';

import { aoFetch, aoPeers, aoPrimaryPeer, createBazarAoFetch, readyAoFetch, warmAoFetch } from './ao';

function injectedAoFetch(peers: string[]): PermawebOsAoFetch {
	const fetcher = vi.fn(async () => new Response('from-permawebos')) as unknown as PermawebOsAoFetch;
	fetcher.invalidate = vi.fn(async () => undefined);
	fetcher.cacheMetadata = vi.fn(() => undefined);
	Object.defineProperty(fetcher, 'peers', { value: peers });
	fetcher.ready = vi.fn(async () => peers);
	return fetcher;
}

afterEach(() => vi.unstubAllGlobals());

function browserWindow(aoFetch?: PermawebOsAoFetch, search = '') {
	return Object.assign(new EventTarget(), {
		...(aoFetch ? { aoFetch } : {}),
		location: {
			protocol: 'https:',
			hostname: 'bazar.example',
			port: '',
			search,
			hash: '',
		},
	});
}

describe('PermawebOS AO transport boundary', () => {
	it('returns the exact injected singleton and reads its active peers', async () => {
		const permawebOs = injectedAoFetch(['https://primary.example', 'https://secondary.example']);
		vi.stubGlobal('window', browserWindow(permawebOs));

		expect(aoFetch()).toBe(permawebOs);
		expect(aoPeers()).toEqual(['https://primary.example', 'https://secondary.example']);
		expect(aoPrimaryPeer()).toBe('https://primary.example');
		await expect(readyAoFetch()).resolves.toEqual(['https://primary.example', 'https://secondary.example']);
	});

	it('starts injected readiness without waiting for it to settle', () => {
		const permawebOs = injectedAoFetch(['https://primary.example']);
		permawebOs.ready = vi.fn(() => new Promise<readonly string[]>(() => undefined));
		vi.stubGlobal('window', browserWindow(permawebOs));

		const stop = warmAoFetch();
		expect(stop).toEqual(expect.any(Function));
		expect(permawebOs.ready).toHaveBeenCalledOnce();
		stop();
	});

	it('warms the role-aware network descriptor without blocking transport readiness', async () => {
		const permawebOs = injectedAoFetch(['https://hosted.example']);
		permawebOs.networkPolicy = vi.fn(
			async () =>
				({
					version: 1,
					arweaveGateway: { url: 'https://arweave.net', ownership: 'default' },
					permanentContent: { url: 'https://arweave.net', ownership: 'default' },
					publishing: { url: 'https://up.arweave.net', ownership: 'default' },
					ao: {
						processReads: [{ url: 'https://andee.example', ownership: 'personal' }],
						scheduleReads: [{ url: 'https://andee.example', ownership: 'personal' }],
						linkedStateReads: [{ url: 'https://andee.example', ownership: 'personal' }],
						observerRelay: { url: 'https://hosted.example', ownership: 'default' },
						fallbackMode: 'personal-first',
					},
				} as const)
		);
		vi.stubGlobal('window', browserWindow(permawebOs));
		const loaded = vi.fn();

		const stop = warmAoFetch(loaded);
		await vi.waitFor(() => expect(loaded).toHaveBeenCalledOnce());
		expect(permawebOs.networkPolicy).toHaveBeenCalledOnce();
		stop();
	});

	it('refreshes every role derived from the same injected transport after aoFetchLoaded', async () => {
		const permawebOs = injectedAoFetch(['https://legacy.example']);
		let policy: EffectivePermawebNetworkPolicy = {
			version: 1 as const,
			fingerprint: 'opaque-policy-one',
			arweaveGateway: { url: 'https://gateway.example', ownership: 'default' as const },
			permanentContent: { url: 'https://content-one.example', ownership: 'community' as const },
			publishing: { url: 'https://upload.example', ownership: 'default' as const },
			ao: {
				processReads: [{ url: 'https://andee-one.example', ownership: 'personal' as const }],
				scheduleReads: [{ url: 'https://andee-one.example', ownership: 'personal' as const }],
				linkedStateReads: [{ url: 'https://andee-one.example', ownership: 'personal' as const }],
				observerRelay: { url: 'https://relay-one.example', ownership: 'community' as const },
				fallbackMode: 'personal-first' as const,
			},
		};
		permawebOs.networkPolicy = vi.fn(async () => policy);
		const scope = browserWindow(permawebOs);
		vi.stubGlobal('window', scope);
		const changed = vi.fn();
		const stop = warmAoFetch(changed);

		await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce());
		expect(aoPeers()).toEqual(['https://andee-one.example']);
		expect(permanentContentGatewayFromLocation()).toBe('https://content-one.example');
		expect(observerRelayFromLocation()).toBe('https://relay-one.example');
		expect(aoRoutingScopeFromLocation()).toBe('opaque-policy-one');

		policy = {
			...policy,
			fingerprint: 'opaque-policy-two',
			permanentContent: { url: 'https://content-two.example', ownership: 'community' },
			ao: {
				...policy.ao,
				processReads: [{ url: 'https://andee-two.example', ownership: 'personal' }],
				scheduleReads: [{ url: 'https://andee-two.example', ownership: 'personal' }],
				linkedStateReads: [{ url: 'https://andee-two.example', ownership: 'personal' }],
				observerRelay: { url: 'https://relay-two.example', ownership: 'community' },
				fallbackMode: 'personal-only',
			},
		};
		scope.dispatchEvent(new Event('aoFetchLoaded'));

		await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(2));
		expect(permawebOs.networkPolicy).toHaveBeenCalledTimes(2);
		expect(aoPeers()).toEqual(['https://andee-two.example']);
		expect(permanentContentGatewayFromLocation()).toBe('https://content-two.example');
		expect(observerRelayFromLocation()).toBe('https://relay-two.example');
		expect(aoRoutingScopeFromLocation()).toBe('opaque-policy-two');

		vi.mocked(permawebOs.networkPolicy).mockRejectedValueOnce(new Error('policy unavailable'));
		scope.dispatchEvent(new Event('aoFetchLoaded'));

		await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(3));
		expect(permawebOs.networkPolicy).toHaveBeenCalledTimes(3);
		expect(aoPeers()).toEqual([]);
		expect(observerRelayFromLocation()).toBe('');
		expect(aoRoutingScopeFromLocation()).toBe('permawebos-policy-unavailable:2');
		stop();
	});

	it('loads role policy when PermawebOS is injected after application startup', async () => {
		const scope = browserWindow();
		vi.stubGlobal('window', scope);
		const changed = vi.fn();
		const stop = warmAoFetch(changed);
		const permawebOs = injectedAoFetch(['https://legacy.example']);
		permawebOs.networkPolicy = vi.fn(
			async () =>
				({
					version: 1,
					arweaveGateway: { url: 'https://gateway.example', ownership: 'default' },
					permanentContent: { url: 'https://late-content.example', ownership: 'community' },
					publishing: { url: 'https://upload.example', ownership: 'default' },
					ao: {
						processReads: [{ url: 'https://late-andee.example', ownership: 'personal' }],
						scheduleReads: [{ url: 'https://late-andee.example', ownership: 'personal' }],
						linkedStateReads: [{ url: 'https://late-andee.example', ownership: 'personal' }],
						observerRelay: { url: 'https://late-relay.example', ownership: 'community' },
						fallbackMode: 'personal-first',
					},
				} as const)
		);
		Object.assign(scope, { aoFetch: permawebOs });
		scope.dispatchEvent(new Event('aoFetchLoaded'));

		await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce());
		expect(aoPeers()).toEqual(['https://late-andee.example']);
		expect(permanentContentGatewayFromLocation()).toBe('https://late-content.example');
		expect(observerRelayFromLocation()).toBe('https://late-relay.example');
		stop();
	});

	it('retains known peers when injected readiness is malformed or rejects', async () => {
		const permawebOs = injectedAoFetch(['https://primary.example']);
		permawebOs.ready = undefined as unknown as PermawebOsAoFetch['ready'];
		vi.stubGlobal('window', browserWindow(permawebOs));

		await expect(readyAoFetch()).resolves.toEqual(['https://primary.example']);

		permawebOs.ready = vi.fn(async () => {
			throw new Error('extension-unavailable');
		});
		await expect(readyAoFetch()).resolves.toEqual(['https://primary.example']);
	});

	it('passes test transports through without constructing a Wrangler client', () => {
		const override = vi.fn(async () => new Response('test')) as typeof fetch;
		expect(aoFetch(override)).toBe(override);
	});

	it('uses Bazar AO.js when PermawebOS has not injected a transport', () => {
		vi.stubGlobal('window', browserWindow());

		const direct = aoFetch() as ReturnType<typeof createBazarAoFetch>;
		expect(direct.peers).toEqual(DEFAULT_COMPUTE_GATEWAYS);
		expect(aoPeers()).toEqual(DEFAULT_COMPUTE_GATEWAYS);
	});

	it('uses Bazar AO.js with the fallback peers when the user disables PermawebOS', () => {
		const permawebOs = injectedAoFetch(['https://permawebos.example']);
		vi.stubGlobal(
			'window',
			browserWindow(
				permawebOs,
				`?ao-transport=bazar&node=${encodeURIComponent('https://alpha.example,https://charlie.example')}`
			)
		);

		const direct = aoFetch() as ReturnType<typeof createBazarAoFetch>;
		expect(direct).not.toBe(permawebOs);
		expect(direct.peers).toEqual(['https://alpha.example', 'https://charlie.example']);
		expect(aoPeers()).toEqual(['https://alpha.example', 'https://charlie.example']);
	});

	it('does not bypass PermawebOS when every configured peer request fails', async () => {
		const permawebOs = injectedAoFetch(['https://unavailable.example']);
		const failure = new Error('Every PermawebOS AO Peer failed.');
		vi.mocked(permawebOs).mockRejectedValue(failure);
		const nativeFetch = vi.fn(async () => new Response('unexpected fallback'));
		vi.stubGlobal('fetch', nativeFetch);
		vi.stubGlobal('window', browserWindow(permawebOs));

		await expect(aoFetch()('/process~process@1.0/now')).rejects.toBe(failure);
		expect(nativeFetch).not.toHaveBeenCalled();
	});
});

describe('Bazar AO.js routing', () => {
	it('routes an application peer URL through the full fallback list', async () => {
		const requested: string[] = [];
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			requested.push(url);
			return url.startsWith('https://alpha.example/')
				? new Response('slow down', { status: 429, headers: { 'retry-after': '0' } })
				: new Response('charlie');
		});
		const routed = createBazarAoFetch(
			['https://alpha.example', 'https://charlie.example'],
			fetcher as typeof fetch
		);

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
		const routed = createBazarAoFetch(
			['https://alpha.example', 'https://charlie.example'],
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
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
		const routed = createBazarAoFetch(
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
		const routed = createBazarAoFetch(
			['https://alpha.example', 'https://charlie.example'],
			fetcher as typeof fetch
		);

		await routed('https://arweave.net/graphql');

		expect(requested.at(-1)).toBe('https://arweave.net/graphql');
	});

	it('can return a not-found response for an optional AO path', async () => {
		const routed = createBazarAoFetch(
			['https://alpha.example'],
			vi.fn(async () => new Response('not_found', { status: 404 })) as typeof fetch
		);

		const response = await routed.allowNotFound('https://alpha.example/message~message@1.0/device');

		expect(response.status).toBe(404);
		expect(await response.text()).toBe('not_found');
	});
});
