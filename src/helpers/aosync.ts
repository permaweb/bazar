import { getBestGatewayEndpoint } from './wayfinder';

/**
 * Gets the best gateway configuration for AOSyncProvider using Wayfinder
 * @returns Promise<{host: string, port: number, protocol: string}> - Gateway configuration
 */
export async function getAOSyncGatewayConfig(): Promise<{
	host: string;
	port: number;
	protocol: string;
}> {
	// For now, use a known working gateway configuration
	// TODO: Implement proper Wayfinder integration once gateway testing is stable
	return {
		host: 'arweave.net',
		port: 443,
		protocol: 'https',
	};
}

/**
 * Gets the best gateway host for AOSync operations
 * @returns Promise<string> - Gateway host
 */
export async function getAOSyncGatewayHost(): Promise<string> {
	// For now, use a known working gateway host
	// TODO: Implement proper Wayfinder integration once gateway testing is stable
	return 'arweave.net';
}
