import { checkValidAddress } from './utils';
import { getBestGatewayUrl, getGateways } from './wayfinder';

const DEFAULT_GATEWAY = 'https://arweave.net';

function pickGateway(): string {
	const gateways = getGateways();
	return gateways[0] ?? DEFAULT_GATEWAY;
}

export function getARBalanceEndpoint(walletAddress: string): string {
	const gateway = pickGateway();
	return `${gateway}/wallet/${walletAddress}/balance`;
}

export async function getARBalanceEndpointAsync(walletAddress: string): Promise<string> {
	const gateway = await getBestGatewayUrl();
	return `${gateway}/wallet/${walletAddress}/balance`;
}

export function getTxEndpoint(txId: string): string {
	const gateway = getBestGatewayForAssets();
	return `${gateway}/${txId}`;
}

export async function getTxEndpointAsync(txId: string): Promise<string> {
	const gateway = await getBestGatewayForAssetsAsync();
	return `${gateway}/${txId}`;
}

export function getRendererEndpoint(renderWith: string, tx: string): string {
	if (checkValidAddress(renderWith)) {
		const gateway = getBestGatewayForAssets();
		return `${gateway}/${renderWith}/?tx=${tx}`;
	}

	return `https://${renderWith}.arweave.net/?tx=${tx}`;
}

export async function getRendererEndpointAsync(renderWith: string, tx: string): Promise<string> {
	if (checkValidAddress(renderWith)) {
		const gateway = await getBestGatewayForAssetsAsync();
		return `${gateway}/${renderWith}/?tx=${tx}`;
	}

	return `https://${renderWith}.arweave.net/?tx=${tx}`;
}

export function getBestGatewayForGraphQL(): string {
	return 'arweave.net';
}

export async function getBestGatewayForAssetsAsync(): Promise<string> {
	return await getBestGatewayUrl();
}

export function getBestGatewayForAssets(): string {
	return pickGateway();
}

export const getARBalanceEndpointSync = getARBalanceEndpoint;
export const getTxEndpointSync = getTxEndpoint;
export const getRendererEndpointSync = getRendererEndpoint;
