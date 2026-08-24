import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assetObserverNetworkOptions } from './asset-observers';

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
});
