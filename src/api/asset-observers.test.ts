import { describe, expect, it } from 'vitest';

import { AO_MAINNET } from 'helpers/config';

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
  it('contacts observers directly during local development', () => {
    const options = assetObserverNetworkOptions(location({}));

    expect(options.node).toBe('https://arweave.net');
    expect(options['relay-with']).toBeUndefined();
    expect(options.pageProtocol).toBe('http:');
    expect(options.minObservers).toBe(3);
    expect(options.maxObservers).toBe(12);
  });

  it('relays observer requests through the selected HyperBEAM gateway', () => {
    const options = assetObserverNetworkOptions(location({ search: '?node=http%3A%2F%2F127.0.0.1%3A3101' }));

    expect(options.node).toBe('https://arweave.net');
    expect(options['relay-with']).toBe('http://127.0.0.1:3101');
    expect(options.minObservers).toBe(3);
    expect(options.maxObservers).toBe(12);
  });

  it('keeps Arweave as the observer seed while using the production HyperBEAM relay', () => {
    const options = assetObserverNetworkOptions(
      location({
        protocol: 'https:',
        hostname: 'lcno4nkkk4gsb5krqpa6irlzbuurmnzk4entikswauifsbryldfa.arweave.net',
        port: '',
      }),
    );

    expect(options.node).toBe('https://arweave.net');
    expect(options['relay-with']).toBe(AO_MAINNET.app1);
  });
});
