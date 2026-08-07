import { describe, expect, it } from 'vitest';

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

describe('assetObserverNetworkOptions', () => {
  it('relays observer requests through the selected HyperBEAM gateway', () => {
    const options = assetObserverNetworkOptions(location({ search: '?node=http%3A%2F%2F127.0.0.1%3A3101' }));

    expect(options.node).toBe('https://arweave.net');
    expect(options['relay-with']).toBe('http://127.0.0.1:3101');
    expect(options.minObservers).toBe(3);
    expect(options.maxObservers).toBe(7);
  });

  it('reads a selected HyperBEAM gateway from a hash route', () => {
    const options = assetObserverNetworkOptions(
      location({
        hash: '#/asset/collection/process?node=http%3A%2F%2F127.0.0.1%3A3101',
      }),
    );

    expect(options['relay-with']).toBe('http://127.0.0.1:3101');
  });

  it('uses the default compute gateway when no relay is selected', () => {
    const options = assetObserverNetworkOptions(
      location({
        protocol: 'https:',
        hostname: 'lcno4nkkk4gsb5krqpa6irlzbuurmnzk4entikswauifsbryldfa.arweave.net',
        port: '',
      }),
    );

    expect(options['relay-with']).toBe('https://alpha.neo.zephyrdev.xyz');
  });
});
