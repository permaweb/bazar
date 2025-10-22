import Arweave from 'arweave';

import { getBestGatewayEndpoint } from './wayfinder';

/**
 * Creates an Arweave instance using the best available gateway from Wayfinder
 * @returns Promise<Arweave> - Initialized Arweave instance
 */
export async function createArweaveInstance(): Promise<Arweave> {
	// For now, use a known working gateway
	// TODO: Implement proper Wayfinder integration once gateway testing is stable
	return Arweave.init({
		host: 'arweave.net',
		protocol: 'https',
		port: 443,
		timeout: 60000,
		logging: false,
	});
}

/**
 * Creates an Arweave instance with custom configuration
 * @param config - Custom Arweave configuration
 * @returns Promise<Arweave> - Initialized Arweave instance
 */
export async function createArweaveInstanceWithConfig(config: {
	timeout?: number;
	logging?: boolean;
	port?: number;
}): Promise<Arweave> {
	// For now, use a known working gateway
	// TODO: Implement proper Wayfinder integration once gateway testing is stable
	return Arweave.init({
		host: 'arweave.net',
		protocol: 'https',
		port: config.port || 443,
		timeout: config.timeout || 60000,
		logging: config.logging || false,
	});
}

/**
 * Gets the current best gateway host (without protocol)
 * @returns Promise<string> - Gateway host
 */
export async function getCurrentGatewayHost(): Promise<string> {
	// For now, use a known working gateway host
	// TODO: Implement proper Wayfinder integration once gateway testing is stable
	return 'arweave.net';
}
