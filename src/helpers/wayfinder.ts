import { ARIO } from '@ar.io/sdk';

const FALLBACK_GATEWAYS = ['https://arweave.net', 'https://ar-io.net'];
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ARIO client instance reused across calls
let arioClient: ReturnType<typeof ARIO.mainnet> | null = null;
let gatewayCache: string[] = [];
let lastGatewayFetch = 0;
let initializationPromise: Promise<string[]> | null = null;

async function fetchGateways(): Promise<string[]> {
	try {
		if (!arioClient) {
			arioClient = ARIO.mainnet();
		}

		const gatewaysResponse = await arioClient.getGateways({
			limit: 5,
			sortBy: 'totalDelegatedStake',
			sortOrder: 'desc',
		});

		const discoveredGateways = gatewaysResponse.items
			.filter((gateway) => gateway.settings?.fqdn && gateway.status === 'joined')
			.map((gateway) => `https://${gateway.settings.fqdn}`);

		// Ensure fallbacks are always available and avoid duplicates
		const dedupedGateways = Array.from(new Set([...discoveredGateways, ...FALLBACK_GATEWAYS]));
		return dedupedGateways;
	} catch (error) {
		console.error('❌ Failed to fetch gateways from ARIO:', error);
		return [...FALLBACK_GATEWAYS];
	}
}

async function ensureGateways(): Promise<string[]> {
	const now = Date.now();

	if (gatewayCache.length > 0 && now - lastGatewayFetch < CACHE_DURATION) {
		return gatewayCache;
	}

	if (initializationPromise) {
		return initializationPromise;
	}

	initializationPromise = (async () => {
		const gateways = await fetchGateways();
		gatewayCache = gateways;
		lastGatewayFetch = Date.now();
		return gatewayCache;
	})().finally(() => {
		initializationPromise = null;
	});

	return initializationPromise;
}

// Initializes the gateway cache and returns the current list for backward compatibility
export async function initializeWayfinder(): Promise<string[]> {
	return ensureGateways();
}

export function getGateways(): string[] {
	return gatewayCache.length > 0 ? gatewayCache : [...FALLBACK_GATEWAYS];
}

export function getCachedWorkingGateway(): string | null {
	return gatewayCache.length > 0 ? gatewayCache[0] : null;
}

export async function getWorkingGateway(): Promise<string> {
	return getBestGatewayUrl();
}

export async function getBestGatewayUrl(): Promise<string> {
	const gateways = await ensureGateways();
	return gateways[0] ?? FALLBACK_GATEWAYS[0];
}

export async function getBestGatewayEndpoint(): Promise<string> {
	return getBestGatewayUrl();
}

export async function resolveGatewayUrl(url: string): Promise<string> {
	if (!url.startsWith('ar://')) {
		return url;
	}

	try {
		const gateway = await getBestGatewayUrl();
		return url.replace('ar://', `${gateway}/`);
	} catch (error) {
		console.error('❌ Failed to resolve gateway URL:', url, error);
		return url.replace('ar://', `${FALLBACK_GATEWAYS[0]}/`);
	}
}

export async function testGatewayPerformance(): Promise<Record<string, number>> {
	const gateways = await ensureGateways();
	const results: Record<string, number> = {};

	for (const gateway of gateways) {
		try {
			const start = performance.now();
			const response = await fetch(`${gateway}/info`);
			const duration = performance.now() - start;
			results[gateway] = response.ok ? duration : Number.POSITIVE_INFINITY;
		} catch (error) {
			results[gateway] = Number.POSITIVE_INFINITY;
		}
	}

	return results;
}
