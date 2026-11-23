import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadPermawebOsNetworkPolicy } from 'helpers/config';

import { connectPermawebOsTestWallet } from '../test/permaweb-os';

import { assetObserverNetworkOptions, GatewayFirstObserverTransport } from './asset-observers';

function location(overrides: Partial<Location>): Location {
	return {
		protocol: 'http:',
		hostname: '127.0.0.1',
		port: '3000',
		search: '',
		hash: '',
		...overrides,
	} as Location;
}

let permawebOsFetch: PermawebOsAoFetch;

beforeEach(() => {
	permawebOsFetch = vi.fn(async () => new Response()) as unknown as PermawebOsAoFetch;
	Object.defineProperty(permawebOsFetch, 'peers', {
		value: ['https://primary.example', 'https://secondary.example'],
	});
	permawebOsFetch.invalidate = vi.fn(async () => undefined);
	permawebOsFetch.cacheMetadata = vi.fn(() => undefined);
	permawebOsFetch.ready = vi.fn(async () => permawebOsFetch.peers);
	vi.stubGlobal('window', { aoFetch: permawebOsFetch });
	connectPermawebOsTestWallet();
});

afterEach(() => vi.unstubAllGlobals());

describe('assetObserverNetworkOptions', () => {
	it('relays observer traffic through the PermawebOS singleton and primary peer', () => {
		const options = assetObserverNetworkOptions(
			location({
				search: `?node=${encodeURIComponent('https://ignored.example')}`,
			})
		);

		expect(options.node).toBe('https://arweave.net');
		expect(options['relay-with']).toBe('https://primary.example');
		expect(options.fetch).toBe(permawebOsFetch);
		expect(options).not.toHaveProperty('ao');
		expect(options.minObservers).toBe(3);
		expect(options.maxObservers).toBe(7);
	});

	it('keeps the independently selected Arweave gateway for observer discovery', () => {
		const options = assetObserverNetworkOptions(
			location({
				search: '?arweave-node=https%3A%2F%2Fgateway.example',
			})
		);

		expect(options.node).toBe('https://gateway.example');
		expect(options['relay-with']).toBe('https://primary.example');
	});

	it('uses the explicit observer relay instead of a personal process-read peer', async () => {
		permawebOsFetch.networkPolicy = vi.fn(
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
						observerRelay: { url: 'https://primary.example', ownership: 'default' },
						fallbackMode: 'personal-first',
					},
				} as const)
		);
		await loadPermawebOsNetworkPolicy();

		const options = assetObserverNetworkOptions(location({}));

		expect(options['relay-with']).toBe('https://primary.example');
		expect(options.fetch).toBe(permawebOsFetch);
	});

	it('fails closed when the PermawebOS policy does not assign an observer relay', async () => {
		permawebOsFetch.networkPolicy = vi.fn(
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
						fallbackMode: 'personal-only',
					},
				} as const)
		);
		await loadPermawebOsNetworkPolicy();

		expect(() => assetObserverNetworkOptions(location({}))).toThrow('No AO peer is configured.');
	});
});

describe('assetObserverNetworkOptions outside PermawebOS', () => {
	const txId = 'mmCw1cw9Y94I7V4VUwB9_BMhYw7tEy0D8rpJIaJ_V4I';
	const standalone = (search = '') =>
		location({
			protocol: 'https:',
			hostname: 'bazar.mystical.computer',
			port: '',
			search: `?arweave-node=${encodeURIComponent('https://arweave.net')}&node=${encodeURIComponent(
				'https://mystical.computer'
			)}${search}`,
		});

	beforeEach(() => {
		vi.unstubAllGlobals();
		vi.stubGlobal('window', { dispatchEvent: vi.fn() });
	});

	it('asks gateways directly and relays only clear-http nodes through the AO peer', () => {
		const options = assetObserverNetworkOptions(standalone());

		expect(options).not.toHaveProperty('relay-with');
		expect(options.node).toBe('https://arweave.net');
		expect(options.spider).toBe(false);
		expect(options.seeds).toEqual([
			'https://ardrive.net',
			'https://ar-io.dev',
			'https://vilenarios.com',
			'https://frostor.xyz',
			'http://tip-1.arweave.xyz:1984',
			'http://tip-2.arweave.xyz:1984',
			'http://tip-3.arweave.xyz:1984',
			'http://tip-4.arweave.xyz:1984',
			'http://chain-1.arweave.xyz:1984',
			'http://chain-2.arweave.xyz:1984',
			'http://chain-3.arweave.xyz:1984',
		]);
		expect(options.transport).toBeInstanceOf(GatewayFirstObserverTransport);
	});

	it('keeps the PermawebOS relay on a PermawebOS host before a wallet connects', () => {
		vi.stubGlobal('window', { aoFetch: permawebOsFetch, dispatchEvent: vi.fn() });

		const options = assetObserverNetworkOptions(location({}));

		expect(options['relay-with']).toBeTruthy();
		expect(options).not.toHaveProperty('transport');
	});

	it('sends https observers direct and http nodes through the relay with a single Accept type', async () => {
		const fetchMock = vi.fn(async () => Response.json({ network: 'arweave.N.1', height: 1 }));
		const transport = new GatewayFirstObserverTransport({
			fetch: fetchMock as unknown as typeof fetch,
			relay: 'https://mystical.computer',
			pageProtocol: 'https:',
		});

		await transport.get('https://ardrive.net', '/info');
		await transport.get('http://tip-1.arweave.xyz:1984', '/info');

		const [directUrl] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		const [relayedUrl, relayedInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
		expect(directUrl).toBe('https://ardrive.net/info');
		expect(relayedUrl).toBe(
			`https://mystical.computer/~relay@1.0/call?relay-path=${encodeURIComponent(
				'http://tip-1.arweave.xyz:1984/info'
			)}`
		);
		expect((relayedInit.headers as Record<string, string>).accept).toBe('application/json');
	});

	it('cannot reach clear-http nodes from an https page without a relay', () => {
		const transport = new GatewayFirstObserverTransport({ fetch: vi.fn(), pageProtocol: 'https:' });

		expect(transport.canRequest('https://ardrive.net')).toBe(true);
		expect(transport.canRequest('http://tip-1.arweave.xyz:1984')).toBe(false);
	});

	it.each([
		['refuses to relay', 403],
		['does not serve the relay device', 404],
	])(
		'sees a pending transaction when the AO peer %s',
		async (_label, relayStatus) => {
			const requested: string[] = [];
			vi.stubGlobal(
				'fetch',
				vi.fn(async (input: RequestInfo | URL) => {
					const url = String(input);
					requested.push(url);
					if (url.includes('/~relay@1.0/')) return new Response('refused', { status: relayStatus });
					if (url.endsWith('/info'))
						return Response.json({
							network: 'arweave.N.1',
							height: 2048188,
							current: 'h',
							blocks: 2048189,
							peers: 1,
						});
					if (url.endsWith(`/tx/${txId}/status`)) return new Response('Pending', { status: 202 });
					return new Response('', { status: 404 });
				})
			);
			const { ArweaveObserverNetwork } = await import('./arweave-observers');
			const network = new ArweaveObserverNetwork({
				...assetObserverNetworkOptions(standalone()),
				pageProtocol: 'https:',
			} as ConstructorParameters<typeof ArweaveObserverNetwork>[0]);
			try {
				await network.ready();
				const watcher = network.watch(txId, {
					target: 1,
					minObservers: 2,
					propagation: 'all',
					notFoundTimeout: 180_000,
				});
				const seen = new Promise<number>((resolve) =>
					watcher.on('consensus', (consensus) => {
						if (consensus.seen >= 3) resolve(consensus.seen);
					})
				);
				watcher.start();
				await expect(seen).resolves.toBeGreaterThanOrEqual(3);
				watcher.stop();
			} finally {
				network.stop();
			}
			expect(requested.some((url) => url.startsWith(`https://ardrive.net/tx/${txId}/status`))).toBe(true);
			expect(requested.some((url) => /relay-path=http%3A%2F%2F\d/.test(url))).toBe(false);
		},
		20_000
	);
});
