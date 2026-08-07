import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ARWEAVE_GATEWAY,
  arweaveClientConfig,
  arweaveGatewayFromLocation,
  arweaveGatewayOverrideFromLocation,
  arweaveGraphqlEndpoint,
  gatewayFromLocation,
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

describe('Arweave gateway routing', () => {
  it('uses the gateway serving a deployed app', () => {
    expect(arweaveGatewayFromLocation(location())).toBe('https://bazar.arweave.net');
    expect(
      arweaveGatewayFromLocation(location({ hostname: 'rQZa7VeUc8oUCXOr6v941bwyio7zMrB3znC3yY_BHU4.arweave.net' })),
    ).toBe('https://rQZa7VeUc8oUCXOr6v941bwyio7zMrB3znC3yY_BHU4.arweave.net');
  });

  it('uses the fallback gateway during local development', () => {
    expect(arweaveGatewayFromLocation(location({ protocol: 'http:', hostname: '127.0.0.1', port: '3000' }))).toBe(
      DEFAULT_ARWEAVE_GATEWAY,
    );
  });

  it('honors an independent Arweave override in search or hash parameters', () => {
    const search = location({ search: '?arweave-node=https%3A%2F%2Fgateway.example' });
    const hash = location({ hash: '#/asset/one?arweave-node=http%3A%2F%2Flocalhost%3A1984' });

    expect(arweaveGatewayOverrideFromLocation(search)).toBe('https://gateway.example');
    expect(arweaveGatewayFromLocation(search)).toBe('https://gateway.example');
    expect(arweaveGatewayFromLocation(hash)).toBe('http://localhost:1984');
  });

  it('keeps the compute and Arweave selections independent', () => {
    const selected = location({
      search: '?node=https%3A%2F%2Fcompute.example&arweave-node=https%3A%2F%2Fgateway.example',
    });

    expect(gatewayFromLocation(selected)).toBe('https://compute.example');
    expect(arweaveGatewayFromLocation(selected)).toBe('https://gateway.example');
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
      'https://gateway.example/graphql',
    );
  });
});
