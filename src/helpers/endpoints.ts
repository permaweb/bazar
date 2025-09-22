import { checkValidAddress } from './utils';
import { getBestGatewayEndpoint, getCachedWorkingGateway, getGateways, getWorkingGateway } from './wayfinder';

// Default fallback endpoint
const DEFAULT_ARWEAVE_ENDPOINT = 'https://arweave.net';

const debug = (..._args: any[]) => {};

// Get the current best gateway endpoint (sync version)
function getCurrentGatewayEndpoint(): string {
	const gateways = getGateways();
	if (gateways.length > 0) {
		// Use the first gateway as default
		return gateways[0];
	}
	// If Wayfinder hasn't been initialized yet, use the default endpoint
	return DEFAULT_ARWEAVE_ENDPOINT;
}

// Legacy synchronous functions for backward compatibility (now the default exports)
export function getARBalanceEndpoint(walletAddress: string): string {
	const gatewayEndpoint = getCurrentGatewayEndpoint();
	return `${gatewayEndpoint}/wallet/${walletAddress}/balance`;
}

export function getTxEndpoint(txId: string): string {
	// Use the cached working gateway if available, otherwise fallback to arweave.net
	const gateway = getBestGatewayForAssets();
	const url = `${gateway}/${txId}`;
	debug('Wayfinder: getTxEndpoint using gateway', gateway, 'for txId', txId);
	return url;
}

// Async version that tests gateways before using them
export async function getTxEndpointAsync(txId: string): Promise<string> {
	// Try to use a working Wayfinder gateway, otherwise fallback to arweave.net
	const gateway = await getBestGatewayForAssetsAsync();
	const url = `${gateway}/${txId}`;
	debug('Wayfinder: getTxEndpointAsync using working gateway', gateway, 'for txId', txId);
	return url;
}

export function getRendererEndpoint(renderWith: string, tx: string): string {
	if (checkValidAddress(renderWith)) {
		// Use the cached working gateway if available, otherwise fallback to arweave.net
		const gateway = getBestGatewayForAssets();
		return `${gateway}/${renderWith}/?tx=${tx}`;
	} else {
		return `https://${renderWith}.arweave.net/?tx=${tx}`;
	}
}

// Async versions for advanced usage
export async function getARBalanceEndpointAsync(walletAddress: string): Promise<string> {
	const gatewayEndpoint = await getBestGatewayEndpoint();
	return `${gatewayEndpoint}/wallet/${walletAddress}/balance`;
}

// This function is now replaced by the one above that uses getBestGatewayForAssetsAsync

export async function getRendererEndpointAsync(renderWith: string, tx: string): Promise<string> {
	if (checkValidAddress(renderWith)) {
		const gatewayEndpoint = await getBestGatewayEndpoint();
		return `${gatewayEndpoint}/${renderWith}/?tx=${tx}`;
	} else {
		return `https://${renderWith}.arweave.net/?tx=${tx}`;
	}
}

// Helper function to get the best gateway for GraphQL operations
export function getBestGatewayForGraphQL(): string {
	// GraphQL is reliably available on the canonical gateway only.
	return 'arweave.net';
}

// Helper function to get the best gateway for asset loading (with fallback)
export async function getBestGatewayForAssetsAsync(): Promise<string> {
	const gateways = getGateways();
	debug('Wayfinder: getBestGatewayForAssetsAsync - available gateways', gateways);
	if (gateways.length > 0) {
		// Use a working gateway from Wayfinder
		const gateway = await getWorkingGateway();
		debug('Wayfinder: getBestGatewayForAssetsAsync - selected working gateway', gateway);
		return gateway;
	}
	// Fallback to arweave.net if Wayfinder isn't initialized
	return 'https://arweave.net';
}

// Synchronous version for backward compatibility (uses cached working gateway or first gateway)
export function getBestGatewayForAssets(): string {
	const gateways = getGateways();
	debug('Wayfinder: getBestGatewayForAssets - available gateways', gateways);

	// If we have a cached working gateway, use it
	const cachedGateway = getCachedWorkingGateway();
	if (cachedGateway) {
		debug('Wayfinder: getBestGatewayForAssets - using cached working gateway', cachedGateway);
		return cachedGateway;
	}

	if (gateways.length > 0) {
		// Use the first available gateway from Wayfinder
		const gateway = gateways[0];
		debug('Wayfinder: getBestGatewayForAssets - selected gateway', gateway);
		return gateway;
	}
	// Fallback to arweave.net if Wayfinder isn't initialized
	return 'https://arweave.net';
}

// Legacy aliases for backward compatibility
export const getARBalanceEndpointSync = getARBalanceEndpoint;
export const getTxEndpointSync = getTxEndpoint;
export const getRendererEndpointSync = getRendererEndpoint;
