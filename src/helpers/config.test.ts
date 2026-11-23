import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	aoPeerPlanFromLocation,
	aoPeerSelectionQuery,
	aoRoutingScopeFromLocation,
	arweaveClientConfig,
	arweaveDataFallbackUrls,
	arweaveDataUrl,
	arweaveGatewayFromLocation,
	arweaveGatewayOverrideFromLocation,
	arweaveGraphqlEndpoint,
	arweaveGraphqlEndpoints,
	bazarAoTransportUrl,
	currentPermawebOsNetworkPolicy,
	DEFAULT_ARWEAVE_GATEWAY,
	DEFAULT_COMPUTE_GATEWAYS,
	fallbackAoPeersFromLocation,
	gatewayFromLocation,
	gatewaysFromLocation,
	isArweaveNetGateway,
	loadPermawebOsNetworkPolicy,
	markServingOriginWithoutCompute,
	normalizeComputeGateways,
	observerRelayFromLocation,
	parseGraphqlEndpoints,
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

	it('tries the serving origin first, then the default compute peers, in hosted and local sessions', () => {
		expect(DEFAULT_COMPUTE_GATEWAYS).toEqual(['https://arweave.net']);
		expect(fallbackAoPeersFromLocation(location())).toEqual(['https://bazar.arweave.net', 'https://arweave.net']);
		expect(
			fallbackAoPeersFromLocation(location({ protocol: 'http:', hostname: '127.0.0.1', port: '3000' }))
		).toEqual(['http://127.0.0.1:3000', 'https://arweave.net']);
		expect(aoPeerPlanFromLocation(location())).toEqual({
			peers: ['https://bazar.arweave.net', 'https://arweave.net'],
			source: 'default',
			ordered: true,
			servingOrigin: 'https://bazar.arweave.net',
		});
		expect(fallbackAoPeersFromLocation(location({ hostname: 'arweave.net' }))).toEqual(['https://arweave.net']);
		expect(fallbackAoPeersFromLocation(location({ protocol: 'file:' }))).toEqual([]);
	});

	it('gives a URL peer selection precedence over the default compute peers, in the order given', () => {
		const selected = location({ search: `?node=${encodeURIComponent('https://compute.example, alpha.example')}` });
		expect(aoPeerPlanFromLocation(selected)).toEqual({
			peers: ['https://compute.example', 'https://alpha.example'],
			source: 'selected',
			ordered: true,
		});
		expect(aoPeerPlanFromLocation(location({ hash: '#/assets?node=https://only.example' }))).toEqual({
			peers: ['https://only.example'],
			source: 'selected',
			ordered: true,
		});
	});

	it('keeps default routing when the peer editor is submitted unchanged', () => {
		const served = location();
		const editor = fallbackAoPeersFromLocation(served);
		const node = aoPeerSelectionQuery(editor, served);
		const submitted = location({ search: node === null ? '' : `?node=${encodeURIComponent(node)}` });

		expect(node).toBeNull();
		expect(aoPeerPlanFromLocation(submitted)).toEqual(aoPeerPlanFromLocation(served));
		expect(aoPeerPlanFromLocation(submitted).ordered).toBe(true);
	});

	it('writes a peer selection only when it differs from the default plan', () => {
		const selected = location({ search: '?node=https://compute.example' });
		expect(aoPeerSelectionQuery(['https://bazar.arweave.net', 'https://arweave.net'], selected)).toBeNull();
		expect(aoPeerSelectionQuery(['https://compute.example'], selected)).toBe('https://compute.example');
		expect(aoPeerSelectionQuery(['https://arweave.net', 'https://bazar.arweave.net'], location())).toBe(
			'https://arweave.net,https://bazar.arweave.net'
		);
		expect(
			aoPeerSelectionQuery(
				['https://bazar.arweave.net', 'https://arweave.net'],
				location({ hash: '#/assets?node=https://compute.example' })
			)
		).toBe('https://bazar.arweave.net,https://arweave.net');
	});

	it('honors a configured AO peer and gives the URL override precedence', async () => {
		vi.stubEnv('VITE_COMPUTE_GATEWAY', 'http://127.0.0.1:3101/path');
		const {
			aoPeerPlanFromLocation: configuredPlan,
			aoPeerSelectionQuery: configuredSelection,
			fallbackAoPeersFromLocation: configuredPeers,
		} = await import('./config');
		expect(configuredPeers(location())).toEqual(['http://127.0.0.1:3101']);
		expect(configuredPlan(location())).toEqual({
			peers: ['http://127.0.0.1:3101'],
			source: 'configured',
			ordered: true,
		});
		expect(configuredSelection(['http://127.0.0.1:3101'], location())).toBeNull();
		expect(configuredPeers(location({ search: '?node=https://compute.example' }))).toEqual([
			'https://compute.example',
		]);
	});

	it('keeps a configured AO peer list in its given priority order', async () => {
		vi.stubEnv('VITE_COMPUTE_GATEWAY', 'https://primary.example, https://fallback.example');
		const { aoPeerPlanFromLocation: configuredPlan } = await import('./config');
		expect(configuredPlan(location())).toEqual({
			peers: ['https://primary.example', 'https://fallback.example'],
			source: 'configured',
			ordered: true,
		});
	});

	it('keeps a configured AO peer list as the routing scope and lets the editor select the serving origin', async () => {
		vi.stubEnv('VITE_COMPUTE_GATEWAY', 'https://mystical.computer,https://arweave.net');
		vi.resetModules();
		const configured = await import('./config');
		const served = location({ hostname: 'bazar.mystical.computer' });
		const withOrigin = ['https://bazar.mystical.computer', 'https://mystical.computer', 'https://arweave.net'];

		expect(configured.aoRoutingScopeFromLocation(served)).toBe('https://mystical.computer,https://arweave.net');
		expect(
			configured.aoPeerSelectionQuery(['https://mystical.computer', 'https://arweave.net'], served)
		).toBeNull();
		expect(configured.aoPeerSelectionQuery(withOrigin, served)).toBe(withOrigin.join(','));
	});

	it('scopes AO routing to a URL peer selection without the serving origin', () => {
		const served = location({ hostname: 'bazar.mystical.computer' });
		const selected = location({ hostname: 'bazar.mystical.computer', search: '?node=https://mystical.computer' });

		expect(aoRoutingScopeFromLocation(selected)).toBe('https://mystical.computer');
		expect(
			aoRoutingScopeFromLocation(
				location({
					hostname: 'bazar.mystical.computer',
					hash: '#/assets?node=https://mystical.computer,https://arweave.net',
				})
			)
		).toBe('https://mystical.computer,https://arweave.net');
		expect(aoRoutingScopeFromLocation(served)).toBe('https://bazar.mystical.computer,https://arweave.net');
	});

	it('drops a serving origin without process compute from the default peers only', () => {
		const served = location({ hostname: 'static-host.example' });
		const selected = location({ hostname: 'static-host.example', search: '?node=https://static-host.example' });
		markServingOriginWithoutCompute('https://static-host.example');

		expect(aoPeerPlanFromLocation(served)).toEqual({
			peers: ['https://arweave.net'],
			source: 'default',
			ordered: true,
		});
		expect(fallbackAoPeersFromLocation(selected)).toEqual(['https://static-host.example']);
		expect(fallbackAoPeersFromLocation(location({ hostname: 'other-host.example' }))).toEqual([
			'https://other-host.example',
			'https://arweave.net',
		]);
	});

	it('keeps the AO routing scope across a serving-origin drop and the next page load', async () => {
		const items = new Map<string, string>();
		const sessionStorage = {
			getItem: (key: string) => items.get(key) ?? null,
			setItem: (key: string, value: string) => void items.set(key, value),
		};
		const served = location({ hostname: 'arns-host.example' });
		vi.stubGlobal('window', { location: served, sessionStorage });
		const before = aoRoutingScopeFromLocation(served);

		markServingOriginWithoutCompute('https://arns-host.example');
		expect(aoPeerPlanFromLocation(served).peers).toEqual(['https://arweave.net']);
		expect(aoRoutingScopeFromLocation(served)).toBe(before);

		vi.resetModules();
		const reloaded = await import('./config');
		expect(reloaded.aoPeerPlanFromLocation(served)).toEqual({
			peers: ['https://arweave.net'],
			source: 'default',
			ordered: true,
		});
		expect(reloaded.aoRoutingScopeFromLocation(served)).toBe(before);
		expect(reloaded.aoPeerSelectionQuery(['https://arweave.net'], served)).toBeNull();
		expect(reloaded.aoPeerSelectionQuery(['https://arns-host.example', 'https://arweave.net'], served)).toBeNull();
	});

	it('keeps a serving-origin drop in memory when session storage is unavailable', async () => {
		const served = location({ hostname: 'private-host.example' });
		vi.stubGlobal('window', {
			location: served,
			get sessionStorage(): Storage {
				throw new DOMException('blocked', 'SecurityError');
			},
		});

		markServingOriginWithoutCompute('https://private-host.example');
		expect(aoPeerPlanFromLocation(served).peers).toEqual(['https://arweave.net']);

		vi.resetModules();
		const reloaded = await import('./config');
		expect(reloaded.aoPeerPlanFromLocation(served).servingOrigin).toBe('https://private-host.example');
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

	it('relays observers through VITE_ARWEAVE_OBSERVER_RELAY instead of the first AO peer', async () => {
		vi.stubEnv('VITE_ARWEAVE_OBSERVER_RELAY', 'https://relay.example/some/path');
		vi.resetModules();
		const config = await import('./config');

		expect(config.observerRelayFromLocation(location({ search: '?node=https%3A%2F%2Fpeer.example' }), {})).toBe(
			'https://relay.example'
		);
	});

	it('ignores a VITE_ARWEAVE_OBSERVER_RELAY that is not an http(s) origin', async () => {
		vi.stubEnv('VITE_ARWEAVE_OBSERVER_RELAY', 'ftp://relay.example');
		vi.resetModules();
		const config = await import('./config');

		expect(config.observerRelayFromLocation(location({ search: '?node=https%3A%2F%2Fpeer.example' }), {})).toBe(
			'https://peer.example'
		);
	});

	it('relays observers through the first AO peer when no relay is configured', async () => {
		vi.stubEnv('VITE_ARWEAVE_OBSERVER_RELAY', '');
		vi.resetModules();
		const config = await import('./config');

		expect(config.observerRelayFromLocation(location({ search: '?node=https%3A%2F%2Fpeer.example' }), {})).toBe(
			'https://peer.example'
		);
	});

	it('defaults to arweave.net GraphQL only', async () => {
		vi.stubEnv('VITE_GRAPHQL_ENDPOINTS', '');
		vi.resetModules();
		const config = await import('./config');

		expect(config.arweaveGraphqlEndpoints()).toEqual(['https://arweave.net/graphql']);
		expect(config.DEFAULT_GRAPHQL_ENDPOINTS).toEqual(['https://arweave.net/graphql']);
	});

	it('parses an ordered GraphQL endpoint list and skips unusable entries', () => {
		expect(
			parseGraphqlEndpoints(
				' https://index.example/graphql ,ftp://bad.example/graphql,,not a url,https://user:pw@x.example/graphql,https://index.example/graphql,http://localhost:4000/graphql'
			)
		).toEqual(['https://index.example/graphql', 'http://localhost:4000/graphql']);
		expect(parseGraphqlEndpoints(undefined)).toEqual(['https://arweave.net/graphql']);
		expect(parseGraphqlEndpoints(' , nope ')).toEqual(['https://arweave.net/graphql']);
	});

	it('reads the GraphQL endpoint order from VITE_GRAPHQL_ENDPOINTS', async () => {
		vi.stubEnv('VITE_GRAPHQL_ENDPOINTS', 'https://index.example/graphql,https://arweave.net/graphql');
		vi.resetModules();
		const config = await import('./config');

		expect(config.arweaveGraphqlEndpoints()).toEqual([
			'https://index.example/graphql',
			'https://arweave.net/graphql',
		]);
		expect(config.arweaveGraphqlEndpoint()).toBe('https://index.example/graphql');
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

	it('reads item bytes from the raw route on arweave.net and its subdomains only', () => {
		for (const gateway of ['https://arweave.net', 'https://bazar.arweave.net', 'https://ARWEAVE.NET/']) {
			expect(arweaveDataUrl('asset-id', gateway)).toBe(`${gateway.replace(/\/$/, '')}/raw/asset-id`);
		}
		for (const gateway of ['https://gateway.example', 'https://notarweave.net', 'https://arweave.net.example']) {
			expect(isArweaveNetGateway(gateway)).toBe(false);
			expect(arweaveDataUrl('asset-id', gateway)).toBe(`${gateway}/asset-id`);
		}
		expect(isArweaveNetGateway('not a url')).toBe(false);
	});

	it('orders same-origin arweave.net raw content before the arweave.net fallback', () => {
		const id = 'A'.repeat(43);
		const chain = [`https://bazar.arweave.net/raw/${id}`, `https://arweave.net/raw/${id}`];
		expect(arweaveDataFallbackUrls(`https://bazar.arweave.net/${id}`, location())).toEqual(chain);
		expect(arweaveDataFallbackUrls(`https://bazar.arweave.net/raw/${id}`, location())).toEqual(chain);
		expect(arweaveDataFallbackUrls(`https://arweave.net/${id}`, location())).toEqual(chain);
		expect(arweaveDataFallbackUrls(`https://mystical.computer/${id}`, location())).toEqual([
			chain[0],
			`https://mystical.computer/${id}`,
			chain[1],
		]);
	});

	it('starts with the requested Arweave node and keeps its gateway kind', () => {
		const id = 'A'.repeat(43);
		const hyperbeam = location({ search: '?arweave-node=mystical.computer' });
		expect(arweaveDataFallbackUrls(arweaveDataUrl(id, arweaveGatewayFromLocation(hyperbeam)), hyperbeam)).toEqual([
			`https://mystical.computer/${id}`,
			`https://bazar.arweave.net/raw/${id}`,
			`https://arweave.net/raw/${id}`,
		]);
		const other = location({
			hostname: 'localhost',
			protocol: 'http:',
			port: '3000',
			search: '?arweave-node=gateway.example',
		});
		expect(arweaveDataFallbackUrls(`/${id}`, other)).toEqual([
			`https://gateway.example/${id}`,
			`/${id}`,
			`https://arweave.net/raw/${id}`,
		]);
	});

	it('starts with the configured Arweave gateway', async () => {
		vi.stubEnv('VITE_ARWEAVE_GATEWAY', 'https://mystical.computer');
		vi.resetModules();
		const config = await import('./config');
		const id = 'A'.repeat(43);

		// The configured gateway is also the last fallback: no gateway is added that config did not name.
		expect(config.arweaveDataFallbackUrls(`https://bazar.arweave.net/${id}`, location())).toEqual([
			`https://mystical.computer/${id}`,
			`https://bazar.arweave.net/raw/${id}`,
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
			/\/\/arweave\.net/
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
