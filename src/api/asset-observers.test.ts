import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_COMPUTE_GATEWAY, DEFAULT_COMPUTE_GATEWAYS } from 'helpers/config';

import { aoClient } from './ao';
import { assetObserverNetworkOptions, observerRelayFetch } from './asset-observers';

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

describe('assetObserverNetworkOptions', () => {
	it('relays observer requests through the selected HyperBEAM gateway', () => {
		const options = assetObserverNetworkOptions(location({ search: '?node=http%3A%2F%2F127.0.0.1%3A3101' }));

		expect(options.node).toBe('https://arweave.net');
		expect(options['relay-with']).toBe('http://127.0.0.1:3101');
		expect(options.ao).toBe(aoClient('http://127.0.0.1:3101'));
		expect(options.minObservers).toBe(3);
		expect(options.maxObservers).toBe(7);
	});

	it('reads a selected HyperBEAM gateway from a hash route', () => {
		const options = assetObserverNetworkOptions(
			location({
				hash: '#/asset/collection/process?node=http%3A%2F%2F127.0.0.1%3A3101',
			})
		);

		expect(options['relay-with']).toBe('http://127.0.0.1:3101');
	});

	it('routes observer relays through every selected peer', () => {
		const options = assetObserverNetworkOptions(
			location({
				search: `?node=${encodeURIComponent('https://alpha.example,https://charlie.example')}`,
			})
		);

		expect(options['relay-with']).toBe('https://alpha.example');
		expect(options.fetch).toBeTypeOf('function');
		expect(options.ao).toBe(aoClient(['https://alpha.example', 'https://charlie.example']));
	});

	it('fails an observer relay request over without combining relay-specific commitments', async () => {
		const fetcher = vi.fn(async (input: RequestInfo | URL) =>
			String(input).startsWith('https://alpha.example/')
				? new Response('relay unavailable', { status: 502 })
				: Response.json({ network: 'arweave.N.1', height: 1 })
		);
		const relayFetch = observerRelayFetch(
			['https://alpha.example', 'https://charlie.example'],
			fetcher as typeof fetch
		);

		await expect(
			relayFetch('https://alpha.example/~relay@1.0/call?relay-path=https%3A%2F%2Farweave.net%2Finfo')
		).resolves.toMatchObject({ status: 200 });
		expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
			'https://alpha.example/~relay@1.0/call?relay-path=https%3A%2F%2Farweave.net%2Finfo',
			'https://charlie.example/~relay@1.0/call?relay-path=https%3A%2F%2Farweave.net%2Finfo',
		]);
	});

	it('uses the default compute gateway when no relay is selected', () => {
		const options = assetObserverNetworkOptions(
			location({
				protocol: 'https:',
				hostname: 'lcno4nkkk4gsb5krqpa6irlzbuurmnzk4entikswauifsbryldfa.arweave.net',
				port: '',
			})
		);

		expect(options.node).toBe('https://lcno4nkkk4gsb5krqpa6irlzbuurmnzk4entikswauifsbryldfa.arweave.net');
		expect(options['relay-with']).toBe(DEFAULT_COMPUTE_GATEWAY);
		expect(options.ao).toBe(aoClient(DEFAULT_COMPUTE_GATEWAYS));
	});

	it('uses an independently selected Arweave gateway for observer discovery', () => {
		const options = assetObserverNetworkOptions(
			location({
				search: '?node=https%3A%2F%2Fcompute.example&arweave-node=https%3A%2F%2Fgateway.example',
			})
		);

		expect(options.node).toBe('https://gateway.example');
		expect(options['relay-with']).toBe('https://compute.example');
	});
});
