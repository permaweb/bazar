import { describe, expect, it } from 'vitest';

import {
	arweaveClientConfig,
	arweaveGatewayFromLocation,
	arweaveGatewayOverrideFromLocation,
	arweaveGraphqlEndpoint,
	computeGatewayForEnvironment,
	computeGatewaysForEnvironment,
	DEFAULT_ARWEAVE_GATEWAY,
	gatewayFromLocation,
	gatewaysFromLocation,
	normalizeComputeGateways,
	PRODUCTION_COMPUTE_GATEWAY,
	PRODUCTION_COMPUTE_GATEWAYS,
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
	it('keeps local development off the production compute gateway by default', () => {
		expect(computeGatewayForEnvironment(true)).toBe(DEFAULT_ARWEAVE_GATEWAY);
		expect(computeGatewayForEnvironment(false)).toBe(PRODUCTION_COMPUTE_GATEWAY);
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

	it('keeps the compute and Arweave selections independent', () => {
		const selected = location({
			search: '?node=https%3A%2F%2Fcompute.example&arweave-node=https%3A%2F%2Fgateway.example',
		});

		expect(gatewayFromLocation(selected)).toBe('https://compute.example');
		expect(arweaveGatewayFromLocation(selected)).toBe('https://gateway.example');
	});

	it('treats the node parameter as an ordered catch-all peer list', () => {
		const selected = location({
			search: `?node=${encodeURIComponent('https://alpha.example, https://charlie.example')}`,
		});

		expect(gatewaysFromLocation(selected)).toEqual(['https://alpha.example', 'https://charlie.example']);
		expect(gatewayFromLocation(selected)).toBe('https://alpha.example');
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
});
