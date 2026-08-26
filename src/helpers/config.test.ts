import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	aoRoutingScopeFromLocation,
	arweaveClientConfig,
	arweaveDataFallbackUrls,
	arweaveDataUrl,
	arweaveGatewayFromLocation,
	arweaveGatewayOverrideFromLocation,
	arweaveGraphqlEndpoint,
	computeGatewayForEnvironment,
	computeGatewaysForEnvironment,
	currentPermawebOsNetworkPolicy,
	DEFAULT_ARWEAVE_GATEWAY,
	fallbackAoPeersFromLocation,
	gatewayFromLocation,
	gatewaysFromLocation,
	loadPermawebOsNetworkPolicy,
	normalizeComputeGateways,
	observerRelayFromLocation,
	permanentContentGatewayFromLocation,
	permawebOsAoAvailable,
	PRODUCTION_COMPUTE_GATEWAY,
	PRODUCTION_COMPUTE_GATEWAYS,
	refreshPermawebOsNetworkPolicy,
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

describe('Arweave gateway routing', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('uses the production Bazar fallback peers during local development too', () => {
		expect(computeGatewayForEnvironment(true)).toBe(PRODUCTION_COMPUTE_GATEWAY);
		expect(computeGatewayForEnvironment(false)).toBe(PRODUCTION_COMPUTE_GATEWAY);
		expect(computeGatewaysForEnvironment(true)).toEqual(PRODUCTION_COMPUTE_GATEWAYS);
		expect(computeGatewaysForEnvironment(false)).toEqual(PRODUCTION_COMPUTE_GATEWAYS);
		expect(computeGatewayForEnvironment(true, 'http://127.0.0.1:3101/path')).toBe('http://127.0.0.1:3101');
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
		vi.stubGlobal('window', {
			aoFetch: injectedAoFetch(['https://permawebos-peer.example']),
		});
		const selected = location({
			search: '?node=https%3A%2F%2Fcompute.example&arweave-node=https%3A%2F%2Fgateway.example',
		});

		expect(gatewayFromLocation(selected)).toBe('https://permawebos-peer.example');
		expect(arweaveGatewayFromLocation(selected)).toBe('https://gateway.example');
	});

	it('prefers the ordered PermawebOS peer list while retaining the Bazar fallbacks', () => {
		vi.stubGlobal('window', {
			aoFetch: injectedAoFetch(['https://primary.example', 'https://secondary.example']),
		});
		const selected = location({
			search: `?node=${encodeURIComponent('https://ignored.example')}`,
		});

		expect(gatewaysFromLocation(selected)).toEqual(['https://primary.example', 'https://secondary.example']);
		expect(gatewayFromLocation(selected)).toBe('https://primary.example');
		expect(fallbackAoPeersFromLocation(selected)).toEqual(['https://ignored.example']);
		expect(usesPermawebOsAo(selected)).toBe(true);
	});

	it('uses the URL fallback list when the user disables the PermawebOS transport', () => {
		vi.stubGlobal('window', {
			aoFetch: injectedAoFetch(['https://permawebos.example']),
		});
		const selected = location({
			search: `?ao-transport=bazar&node=${encodeURIComponent('https://alpha.example, https://charlie.example')}`,
		});

		expect(usesPermawebOsAo(selected)).toBe(false);
		expect(gatewaysFromLocation(selected)).toEqual(['https://alpha.example', 'https://charlie.example']);
		expect(gatewayFromLocation(selected)).toBe('https://alpha.example');
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

	it('posts GraphQL queries through the selected Arweave gateway', () => {
		expect(arweaveGraphqlEndpoint(location())).toBe('https://bazar.arweave.net/graphql');
		expect(arweaveGraphqlEndpoint(location({ search: '?arweave-node=https%3A%2F%2Fgateway.example' }))).toBe(
			'https://gateway.example/graphql'
		);
	});

	it('builds an ordinary Arweave resource URL', () => {
		expect(arweaveDataUrl('asset-id', 'https://gateway.example')).toBe('https://gateway.example/asset-id');
	});

	it('keeps ordinary item fallback on permanent-content gateways, not compute peers', () => {
		vi.stubGlobal('window', {
			aoFetch: injectedAoFetch(['https://alpha.example', 'https://charlie.example']),
		});
		const id = 'A'.repeat(43);
		expect(
			arweaveDataFallbackUrls(
				`https://alpha.example/${id}`,
				location({
					search: `?node=${encodeURIComponent('https://alpha.example,https://charlie.example')}`,
				})
			)
		).toEqual([`https://alpha.example/${id}`, `https://bazar.arweave.net/${id}`]);
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
		const scope = { aoFetch };
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
			`https://bazar.arweave.net/${id}`,
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
		const scope = { aoFetch };
		const selected = location();

		await expect(loadPermawebOsNetworkPolicy(scope)).resolves.toEqual(policy);

		expect(gatewaysFromLocation(selected, scope)).toEqual(['https://andee.example']);
		expect(observerRelayFromLocation(selected, scope)).toBe('');
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
		const scope = { aoFetch };
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
		const scope = { aoFetch };
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
		const scope = { aoFetch };

		const loading = loadPermawebOsNetworkPolicy(scope);
		await expect(refreshPermawebOsNetworkPolicy(scope)).resolves.toEqual(secondPolicy);
		resolveFirst(firstPolicy);
		await expect(loading).resolves.toEqual(secondPolicy);

		expect(currentPermawebOsNetworkPolicy(scope)).toEqual(secondPolicy);
		expect(permanentContentGatewayFromLocation(location(), scope)).toBe('https://content-two.example');
		expect(observerRelayFromLocation(location(), scope)).toBe('https://relay-two.example');
	});
});
