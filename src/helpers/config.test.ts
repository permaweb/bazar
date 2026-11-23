import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	aoRoutingScopeFromLocation,
	arweaveClientConfig,
	arweaveDataFallbackUrls,
	arweaveDataUrl,
	arweaveGatewayFromLocation,
	arweaveGatewayOverrideFromLocation,
	arweaveGraphqlEndpoint,
	bazarAoTransportUrl,
	currentPermawebOsNetworkPolicy,
	DEFAULT_ARWEAVE_GATEWAY,
	fallbackAoPeersFromLocation,
	gatewayFromLocation,
	gatewaysFromLocation,
	isArIoContentGateway,
	loadPermawebOsNetworkPolicy,
	normalizeComputeGateways,
	observerRelayFromLocation,
	permanentContentGatewayFromLocation,
	permawebOsAoAvailable,
	refreshPermawebOsNetworkPolicy,
	setAoWalletConnection,
	usesPermawebOsAo,
} from './config';

function location(overrides: Partial<Location> = {}): Location {
	return {
		protocol: 'https:',
		hostname: 'bazar.arweave.net',
		port: '',
		search: '',
		hash: '',
		...overrides,
	} as Location;
}

function injectedAoFetch(peers: readonly string[]): PermawebOsAoFetch {
	return Object.assign(vi.fn(), { peers }) as unknown as PermawebOsAoFetch;
}

function connectedScope(aoFetch: PermawebOsAoFetch) {
	const wallet = { connect: vi.fn(), sign: vi.fn() };
	const scope = { aoFetch, arweaveWallet: wallet, permawebConnect: wallet };
	setAoWalletConnection('a'.repeat(43), scope);
	return scope;
}

describe('Arweave gateway routing', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it('uses the serving origin for AO in hosted and local sessions', () => {
		expect(fallbackAoPeersFromLocation(location())).toEqual(['https://bazar.arweave.net']);
		expect(
			fallbackAoPeersFromLocation(location({ protocol: 'http:', hostname: '127.0.0.1', port: '3000' }))
		).toEqual(['http://127.0.0.1:3000']);
	});

	it('honors a configured AO peer and gives the URL override precedence', async () => {
		vi.stubEnv('VITE_COMPUTE_GATEWAY', 'http://127.0.0.1:3101/path');
		const { fallbackAoPeersFromLocation: configuredPeers } = await import('./config');
		expect(configuredPeers(location())).toEqual(['http://127.0.0.1:3101']);
		expect(configuredPeers(location({ search: '?node=https://compute.example' }))).toEqual([
			'https://compute.example',
		]);
	});

	it('parses comma-separated, whitespace-separated, and JSON peer lists', () => {
		expect(normalizeComputeGateways('alpha.example, https://charlie.example')).toEqual([
			'https://alpha.example',
			'https://charlie.example',
		]);
		expect(normalizeComputeGateways('["https://alpha.example","http://localhost:3101"]')).toEqual([
			'https://alpha.example',
			'http://localhost:3101',
		]);
		expect(normalizeComputeGateways('alpha.example, localhost:3101', 'http:')).toEqual([
			'https://alpha.example',
			'http://localhost:3101',
		]);
		expect(normalizeComputeGateways('https://alpha.example, nope://charlie.example')).toBeNull();
	});

	it('uses the gateway serving a deployed app', () => {
		expect(arweaveGatewayFromLocation(location())).toBe('https://bazar.arweave.net');
		expect(
			arweaveGatewayFromLocation(
				location({ hostname: 'rQZa7VeUc8oUCXOr6v941bwyio7zMrB3znC3yY_BHU4.arweave.net' })
			)
		).toBe('https://rQZa7VeUc8oUCXOr6v941bwyio7zMrB3znC3yY_BHU4.arweave.net');
	});

	it('uses the fallback gateway during local development', () => {
		expect(arweaveGatewayFromLocation(location({ protocol: 'http:', hostname: '127.0.0.1', port: '3000' }))).toBe(
			DEFAULT_ARWEAVE_GATEWAY
		);
	});

	it('honors an independent Arweave override in search or hash parameters', () => {
		const search = location({ search: '?arweave-node=https%3A%2F%2Fgateway.example' });
		const hash = location({ hash: '#/asset/one?arweave-node=http%3A%2F%2Flocalhost%3A1984' });

		expect(arweaveGatewayOverrideFromLocation(search)).toBe('https://gateway.example');
		expect(arweaveGatewayFromLocation(search)).toBe('https://gateway.example');
		expect(arweaveGatewayFromLocation(hash)).toBe('http://localhost:1984');
	});

	it('keeps PermawebOS peers and the Arweave selection independent', () => {
		vi.stubGlobal('window', connectedScope(injectedAoFetch(['https://permawebos-peer.example'])));
		const selected = location({
			search: '?node=https%3A%2F%2Fcompute.example&arweave-node=https%3A%2F%2Fgateway.example',
		});

		expect(gatewayFromLocation(selected)).toBe('https://permawebos-peer.example');
		expect(arweaveGatewayFromLocation(selected)).toBe('https://gateway.example');
	});

	it('prefers the ordered PermawebOS peer list while retaining the Bazar fallbacks', () => {
		vi.stubGlobal(
			'window',
			connectedScope(injectedAoFetch(['https://primary.example', 'https://secondary.example']))
		);
		const selected = location({
			search: `?node=${encodeURIComponent('https://ignored.example')}`,
		});

		expect(gatewaysFromLocation(selected)).toEqual(['https://primary.example', 'https://secondary.example']);
		expect(gatewayFromLocation(selected)).toBe('https://primary.example');
		expect(fallbackAoPeersFromLocation(selected)).toEqual(['https://ignored.example']);
		expect(usesPermawebOsAo(selected)).toBe(true);
	});

	it('uses the URL fallback list when the user disables the PermawebOS transport', () => {
		vi.stubGlobal('window', connectedScope(injectedAoFetch(['https://permawebos.example'])));
		const selected = location({
			search: `?ao-transport=bazar&node=${encodeURIComponent('https://alpha.example, https://charlie.example')}`,
		});

		expect(usesPermawebOsAo(selected)).toBe(false);
		expect(gatewaysFromLocation(selected)).toEqual(['https://alpha.example', 'https://charlie.example']);
		expect(gatewayFromLocation(selected)).toBe('https://alpha.example');
	});

	it('switches only the AO transport while preserving the route, hash, and configured peer list', () => {
		const source =
			'https://bazar.arweave.net/?node=https%3A%2F%2Falpha.example%2Chttps%3A%2F%2Fcharlie.example#/asset/fungible-tokens/WEAVE?tab=holders';
		const switched = new URL(bazarAoTransportUrl(source));

		expect(switched.searchParams.get('ao-transport')).toBe('bazar');
		expect(switched.searchParams.get('node')).toBe('https://alpha.example,https://charlie.example');
		expect(switched.hash).toBe('#/asset/fungible-tokens/WEAVE?tab=holders');
	});

	it('automatically uses Bazar fallback peers when PermawebOS is unavailable', () => {
		vi.stubGlobal('window', {});
		const selected = location({ search: `?node=${encodeURIComponent('https://fallback.example')}` });

		expect(usesPermawebOsAo(selected)).toBe(false);
		expect(gatewaysFromLocation(selected)).toEqual(['https://fallback.example']);
	});

	it('ignores a non-callable aoFetch-shaped global', () => {
		vi.stubGlobal('window', {
			aoFetch: { peers: ['https://malformed.example'] },
		});
		const selected = location({ search: `?node=${encodeURIComponent('https://fallback.example')}` });

		expect(permawebOsAoAvailable()).toBe(false);
		expect(usesPermawebOsAo(selected)).toBe(false);
		expect(gatewaysFromLocation(selected)).toEqual(['https://fallback.example']);
	});

	it('creates an Arweave SDK configuration from the same selected origin', () => {
		expect(arweaveClientConfig('http://localhost:1984')).toEqual({
			host: 'localhost',
			port: 1984,
			protocol: 'http',
		});
	});

	it.each([
		['the deployed app', location()],
		['another serving gateway', location({ hostname: 'gateway.example' })],
		['local development', location({ protocol: 'http:', hostname: '127.0.0.1', port: '4174' })],
		['an Arweave query override', location({ search: '?arweave-node=https%3A%2F%2Fgateway.example' })],
		['an Arweave hash override', location({ hash: '#/discover?arweave-node=https%3A%2F%2Fgateway.example' })],
		['a compute override', location({ search: '?node=https%3A%2F%2Fcompute.example' })],
	])('uses arweave.net GraphQL for %s', (_name, selected) => {
		vi.stubGlobal('window', { location: selected });
		expect(arweaveGraphqlEndpoint()).toBe('https://arweave.net/graphql');
	});

	it('uses arweave.net GraphQL without a browser location', () => {
		vi.stubGlobal('window', undefined);
		expect(arweaveGraphqlEndpoint()).toBe('https://arweave.net/graphql');
	});

	it('keeps GraphQL independent of the configured Arweave gateway', async () => {
		vi.stubEnv('VITE_ARWEAVE_GATEWAY', 'https://gateway.example');
		vi.resetModules();
		const config = await import('./config');

		expect(config.arweaveGatewayFromLocation(location())).toBe('https://gateway.example');
		expect(config.arweaveGraphqlEndpoint()).toBe('https://arweave.net/graphql');
	});

	it('builds an ordinary Arweave resource URL on HyperBEAM and unknown gateways', () => {
		expect(arweaveDataUrl('asset-id', 'https://gateway.example')).toBe('https://gateway.example/asset-id');
		expect(arweaveDataUrl('asset-id', 'https://mystical.computer')).toBe('https://mystical.computer/asset-id');
		expect(arweaveDataUrl('asset-id', 'https://alpha.neo.zephyrdev.xyz')).toBe(
			'https://alpha.neo.zephyrdev.xyz/asset-id'
		);
		expect(arweaveDataUrl('asset-id', 'http://127.0.0.1:8734')).toBe('http://127.0.0.1:8734/asset-id');
		expect(arweaveDataUrl('asset-id', 'https://mystical.computer/')).toBe('https://mystical.computer/asset-id');
	});

	it('reads item bytes from the raw route on AR.IO gateways and their ArNS subdomains', () => {
		for (const gateway of [
			'https://arweave.net',
			'https://ardrive.net',
			'https://bazar.arweave.net',
			'https://bazar.ardrive.net',
			'https://bazar.ar.io',
			'https://ARWEAVE.NET/',
		]) {
			expect(arweaveDataUrl('asset-id', gateway)).toBe(`${gateway.replace(/\/$/, '')}/raw/asset-id`);
		}
		expect(isArIoContentGateway('https://ar.io')).toBe(false);
		expect(arweaveDataUrl('asset-id', 'https://ar.io')).toBe('https://ar.io/asset-id');
		expect(isArIoContentGateway('https://ar-io.dev')).toBe(false);
		expect(isArIoContentGateway('https://notarweave.net')).toBe(false);
		expect(isArIoContentGateway('https://arweave.net.example')).toBe(false);
		expect(isArIoContentGateway('not a url')).toBe(false);
	});

	it('orders same-origin AR.IO raw content before public AR.IO fallbacks', () => {
		const id = 'A'.repeat(43);
		const chain = [
			`https://bazar.arweave.net/raw/${id}`,
			`https://ardrive.net/raw/${id}`,
			`https://arweave.net/raw/${id}`,
		];
		expect(arweaveDataFallbackUrls(`https://bazar.arweave.net/${id}`, location())).toEqual(chain);
		expect(arweaveDataFallbackUrls(`https://bazar.arweave.net/raw/${id}`, location())).toEqual(chain);
		expect(arweaveDataFallbackUrls(`https://arweave.net/${id}`, location())).toEqual([
			chain[0],
			chain[2],
			chain[1],
		]);
		expect(arweaveDataFallbackUrls(`https://mystical.computer/${id}`, location())).toEqual([
			chain[0],
			`https://mystical.computer/${id}`,
			chain[1],
			chain[2],
		]);
		expect(arweaveDataFallbackUrls(`https://mystical.computer/${id}`, location()).join()).not.toContain(
			'ar-io.dev'
		);
	});

	it('starts with the requested Arweave node and keeps its gateway kind', () => {
		const id = 'A'.repeat(43);
		const hyperbeam = location({ search: '?arweave-node=mystical.computer' });
		expect(arweaveDataFallbackUrls(arweaveDataUrl(id, arweaveGatewayFromLocation(hyperbeam)), hyperbeam)).toEqual([
			`https://mystical.computer/${id}`,
			`https://bazar.arweave.net/raw/${id}`,
			`https://ardrive.net/raw/${id}`,
			`https://arweave.net/raw/${id}`,
		]);
		const ario = location({
			hostname: 'localhost',
			protocol: 'http:',
			port: '3000',
			search: '?arweave-node=ardrive.net',
		});
		expect(arweaveDataFallbackUrls(`/${id}`, ario)).toEqual([
			`https://ardrive.net/raw/${id}`,
			`/${id}`,
			`https://arweave.net/raw/${id}`,
		]);
	});

	it('starts with the configured Arweave gateway', async () => {
		vi.stubEnv('VITE_ARWEAVE_GATEWAY', 'https://mystical.computer');
		vi.resetModules();
		const config = await import('./config');
		const id = 'A'.repeat(43);

		expect(config.arweaveDataFallbackUrls(`https://bazar.arweave.net/${id}`, location())).toEqual([
			`https://mystical.computer/${id}`,
			`https://bazar.arweave.net/raw/${id}`,
			`https://ardrive.net/raw/${id}`,
			`https://arweave.net/raw/${id}`,
		]);
	});

	it('keeps ordinary item fallback on permanent-content gateways, not compute peers', () => {
		vi.stubGlobal('window', connectedScope(injectedAoFetch(['https://alpha.example', 'https://charlie.example'])));
		const id = 'A'.repeat(43);
		expect(
			arweaveDataFallbackUrls(
				`https://alpha.example/${id}`,
				location({
					search: `?node=${encodeURIComponent('https://alpha.example,https://charlie.example')}`,
				})
			)
		).toEqual([
			`https://bazar.arweave.net/raw/${id}`,
			`https://alpha.example/${id}`,
			`https://ardrive.net/raw/${id}`,
			`https://arweave.net/raw/${id}`,
		]);
	});

	it('uses the PermawebOS role descriptor instead of deriving every service from peers[0]', async () => {
		const policy = {
			version: 1 as const,
			arweaveGateway: { url: 'https://gateway.example', ownership: 'default' as const },
			permanentContent: { url: 'https://content.example', ownership: 'community' as const },
			publishing: { url: 'https://upload.example', ownership: 'default' as const },
			ao: {
				processReads: [
					{ url: 'https://andee.example', ownership: 'personal' as const },
					{ url: 'https://alpha.example', ownership: 'default' as const },
				],
				scheduleReads: [{ url: 'https://andee.example', ownership: 'personal' as const }],
				linkedStateReads: [{ url: 'https://andee.example', ownership: 'personal' as const }],
				observerRelay: { url: 'https://alpha.example', ownership: 'default' as const },
				fallbackMode: 'personal-first' as const,
			},
		};
		const aoFetch = Object.assign(vi.fn(), {
			peers: ['https://alpha.example', 'https://charlie.example'],
			networkPolicy: vi.fn(async () => policy),
		}) as unknown as PermawebOsAoFetch;
		const scope = connectedScope(aoFetch);
		const selected = location();

		expect(gatewaysFromLocation(selected, scope)).toEqual(['https://alpha.example', 'https://charlie.example']);
		await expect(loadPermawebOsNetworkPolicy(scope)).resolves.toEqual(policy);

		expect(currentPermawebOsNetworkPolicy(scope)).toEqual(policy);
		expect(gatewaysFromLocation(selected, scope)).toEqual(['https://andee.example', 'https://alpha.example']);
		expect(permanentContentGatewayFromLocation(selected, scope)).toBe('https://content.example');
		expect(observerRelayFromLocation(selected, scope)).toBe('https://alpha.example');
		expect(aoRoutingScopeFromLocation(selected, scope)).toContain('personal-first');
		const id = 'A'.repeat(43);
		expect(arweaveDataFallbackUrls(`https://andee.example/${id}`, selected, scope)).toEqual([
			`https://content.example/${id}`,
			`https://bazar.arweave.net/raw/${id}`,
		]);
	});

	it('treats an omitted observer relay in a valid PermawebOS policy as explicitly disabled', async () => {
		const policy = {
			version: 1 as const,
			arweaveGateway: { url: 'https://gateway.example', ownership: 'default' as const },
			permanentContent: { url: 'https://content.example', ownership: 'community' as const },
			publishing: { url: 'https://upload.example', ownership: 'default' as const },
			ao: {
				processReads: [{ url: 'https://andee.example', ownership: 'personal' as const }],
				scheduleReads: [{ url: 'https://andee.example', ownership: 'personal' as const }],
				linkedStateReads: [{ url: 'https://andee.example', ownership: 'personal' as const }],
				fallbackMode: 'personal-only' as const,
			},
		};
		const aoFetch = Object.assign(vi.fn(), {
			peers: ['https://legacy.example'],
			networkPolicy: vi.fn(async () => policy),
		}) as unknown as PermawebOsAoFetch;
		const scope = connectedScope(aoFetch);
		const selected = location();

		await expect(loadPermawebOsNetworkPolicy(scope)).resolves.toEqual(policy);

		expect(gatewaysFromLocation(selected, scope)).toEqual(['https://andee.example']);
		expect(observerRelayFromLocation(selected, scope)).toBe('');
		const id = 'A'.repeat(43);
		expect(arweaveDataFallbackUrls(`https://content.example/${id}`, selected, scope)).toEqual([
			`https://content.example/${id}`,
			`https://bazar.arweave.net/raw/${id}`,
		]);
		expect(arweaveDataFallbackUrls(`https://content.example/${id}`, selected, scope).join()).not.toMatch(
			/ardrive\.net|\/\/arweave\.net/
		);
	});

	it('treats an empty process-read role in a valid PermawebOS policy as explicitly disabled', async () => {
		const policy = {
			version: 1 as const,
			arweaveGateway: { url: 'https://gateway.example', ownership: 'default' as const },
			permanentContent: { url: 'https://content.example', ownership: 'community' as const },
			publishing: { url: 'https://upload.example', ownership: 'default' as const },
			ao: {
				processReads: [],
				scheduleReads: [],
				linkedStateReads: [],
				fallbackMode: 'personal-only' as const,
			},
		};
		const aoFetch = Object.assign(vi.fn(), {
			peers: ['https://legacy.example'],
			networkPolicy: vi.fn(async () => policy),
		}) as unknown as PermawebOsAoFetch;
		const scope = connectedScope(aoFetch);
		const selected = location();
		vi.stubGlobal('window', scope);

		await expect(loadPermawebOsNetworkPolicy(scope)).resolves.toEqual(policy);

		expect(gatewaysFromLocation(selected, scope)).toEqual([]);
		expect(gatewayFromLocation(selected)).toBe('');
	});

	it('rejects a malformed optional policy fingerprint and retains legacy scope fallback', async () => {
		const aoFetch = Object.assign(vi.fn(), {
			peers: ['https://legacy.example'],
			networkPolicy: vi.fn(async () => ({
				version: 1,
				fingerprint: 42,
				arweaveGateway: { url: 'https://gateway.example', ownership: 'default' },
				permanentContent: { url: 'https://content.example', ownership: 'community' },
				publishing: { url: 'https://upload.example', ownership: 'default' },
				ao: {
					processReads: [{ url: 'https://andee.example', ownership: 'personal' }],
					scheduleReads: [{ url: 'https://andee.example', ownership: 'personal' }],
					linkedStateReads: [{ url: 'https://andee.example', ownership: 'personal' }],
					fallbackMode: 'personal-only',
				},
			})),
		}) as unknown as PermawebOsAoFetch;
		const scope = connectedScope(aoFetch);
		const selected = location();

		await expect(loadPermawebOsNetworkPolicy(scope)).resolves.toBeUndefined();

		expect(currentPermawebOsNetworkPolicy(scope)).toBeUndefined();
		expect(aoRoutingScopeFromLocation(selected, scope)).toBe('https://legacy.example');
	});

	it('does not let a delayed policy load overwrite a newer refresh', async () => {
		const firstPolicy = {
			version: 1 as const,
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
		const secondPolicy = {
			...firstPolicy,
			permanentContent: { url: 'https://content-two.example', ownership: 'community' as const },
			ao: {
				...firstPolicy.ao,
				processReads: [{ url: 'https://andee-two.example', ownership: 'personal' as const }],
				observerRelay: { url: 'https://relay-two.example', ownership: 'community' as const },
			},
		};
		let resolveFirst!: (policy: typeof firstPolicy) => void;
		const firstLoad = new Promise<typeof firstPolicy>((resolve) => {
			resolveFirst = resolve;
		});
		const networkPolicy = vi
			.fn<() => Promise<typeof firstPolicy | typeof secondPolicy>>()
			.mockReturnValueOnce(firstLoad)
			.mockResolvedValue(secondPolicy);
		const aoFetch = Object.assign(vi.fn(), {
			peers: ['https://legacy.example'],
			networkPolicy,
		}) as unknown as PermawebOsAoFetch;
		const scope = connectedScope(aoFetch);

		const loading = loadPermawebOsNetworkPolicy(scope);
		await expect(refreshPermawebOsNetworkPolicy(scope)).resolves.toEqual(secondPolicy);
		resolveFirst(firstPolicy);
		await expect(loading).resolves.toEqual(secondPolicy);

		expect(currentPermawebOsNetworkPolicy(scope)).toEqual(secondPolicy);
		expect(permanentContentGatewayFromLocation(location(), scope)).toBe('https://content-two.example');
		expect(observerRelayFromLocation(location(), scope)).toBe('https://relay-two.example');
	});
});
