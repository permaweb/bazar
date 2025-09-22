import { ARIO } from '@ar.io/sdk';

const debug = (..._args: any[]) => {};

// Global gateway management
let globalGateways: string[] = []; // Start empty, will be populated by Wayfinder
let currentGatewayIndex = 0;
let isInitializing = false;
let initializationPromise: Promise<void> | null = null;
let workingGatewayCache: string | null = null; // Cache for working gateway
let lastGatewayTest = 0; // Timestamp of last gateway test
const GATEWAY_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Initialize gateway list using ARIO
export async function initializeWayfinder(): Promise<string[]> {
	if (globalGateways.length > 0) {
		return globalGateways;
	}

	if (isInitializing && initializationPromise) {
		await initializationPromise;
		return globalGateways;
	}

	isInitializing = true;
	initializationPromise = (async () => {
		try {
			debug('Wayfinder: Starting initialization...');
			// Initialize ARIO client for mainnet
			const ario = ARIO.mainnet();
			debug('Wayfinder: ARIO client initialized');

			// Get gateways from ARIO network
			debug('Wayfinder: Fetching gateways from ARIO...');
			const gatewaysResponse = await ario.getGateways({
				limit: 10,
				sortBy: 'totalDelegatedStake',
				sortOrder: 'desc',
			});
			debug('Wayfinder: ARIO response', gatewaysResponse);

			// Extract gateway URLs from the response
			const gatewayUrls = gatewaysResponse.items
				.filter((gateway) => gateway.settings?.fqdn && gateway.status === 'joined')
				.map((gateway) => `https://${gateway.settings.fqdn}`)
				.slice(0, 5); // Take top 5 gateways
			debug('Wayfinder: Extracted gateway URLs', gatewayUrls);

			// Add fallback gateways
			const fallbackGateways = ['https://arweave.net', 'https://ar-io.net'];

			// Replace fallback gateways with real ones, but keep fallbacks at the end
			globalGateways = [...gatewayUrls, ...fallbackGateways];

			// Make resolveGateway available globally for endpoints.ts
			if (typeof window !== 'undefined') {
				(window as any).__WAYFINDER_RESOLVE__ = async (url: string) => {
					if (url.startsWith('ar://')) {
						const gateway = getNextGateway();
						return url.replace('ar://', `${gateway}/`);
					}
					return url;
				};
			}

			debug('Wayfinder: Global gateways initialized successfully', globalGateways);
			debug('Wayfinder: Top gateway is', globalGateways[0]);

			// Immediately test and cache a working gateway
			debug('Wayfinder: Testing gateways for immediate use...');
			const workingGateway = await getWorkingGateway();
			debug('Wayfinder: Initial working gateway cached', workingGateway);
		} catch (error) {
			console.error('Failed to initialize global gateways:', error);
			// Fallback to basic gateways
			globalGateways = ['https://arweave.net', 'https://ar-io.net'];
		} finally {
			isInitializing = false;
		}
	})();

	await initializationPromise;
	return globalGateways;
}

// Get the next gateway in round-robin fashion
function getNextGateway(): string {
	if (globalGateways.length === 0) {
		return 'https://arweave.net';
	}

	const gateway = globalGateways[currentGatewayIndex];
	currentGatewayIndex = (currentGatewayIndex + 1) % globalGateways.length;
	return gateway;
}

// Test if a gateway is working
async function testGateway(gateway: string): Promise<boolean> {
	try {
		debug('Wayfinder: Testing gateway', gateway);
		const response = await fetch(`${gateway}/info`, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
			},
			// Add a timeout to prevent hanging
			signal: AbortSignal.timeout(5000),
		});
		const isWorking = response.ok;
		debug('Wayfinder: Gateway test result', gateway, response.status);
		return isWorking;
	} catch (error) {
		debug('Wayfinder: Gateway failed test', gateway, error);
		return false;
	}
}

// Get a working gateway with fallback
export async function getWorkingGateway(): Promise<string> {
	// Check cache first
	const now = Date.now();
	if (workingGatewayCache && now - lastGatewayTest < GATEWAY_CACHE_DURATION) {
		debug('Wayfinder: Using cached working gateway', workingGatewayCache);
		return workingGatewayCache;
	}

	// Start with the first gateway
	let currentIndex = 0;
	const maxAttempts = Math.min(globalGateways.length, 5); // Try up to 5 gateways

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const gateway = globalGateways[currentIndex];
		debug('Wayfinder: Testing gateway', attempt + 1, '/', maxAttempts, gateway);

		if (await testGateway(gateway)) {
			debug('Wayfinder: Found working gateway', gateway);
			// Cache the working gateway
			workingGatewayCache = gateway;
			lastGatewayTest = now;
			return gateway;
		}

		// Move to next gateway
		currentIndex = (currentIndex + 1) % globalGateways.length;
	}

	// If all gateways fail, fall back to arweave.net
	debug('Wayfinder: All gateways failed, using fallback https://arweave.net');
	workingGatewayCache = 'https://arweave.net';
	lastGatewayTest = now;
	return 'https://arweave.net';
}

// Get the global gateways list
export function getGateways(): string[] {
	// If gateways aren't initialized yet, return fallback gateways
	if (globalGateways.length === 0) {
		debug('Wayfinder: getGateways - no gateways available, using fallbacks');
		return ['https://arweave.net', 'https://ar-io.net'];
	}
	debug('Wayfinder: getGateways - returning gateways', globalGateways.length);
	return globalGateways;
}

// Get the cached working gateway
export function getCachedWorkingGateway(): string | null {
	return workingGatewayCache;
}

// Resolve gateway URL using round-robin selection
export async function resolveGatewayUrl(url: string): Promise<string> {
	try {
		if (globalGateways.length === 0) {
			await initializeWayfinder();
		}

		if (url.startsWith('ar://')) {
			const gateway = getNextGateway();
			return url.replace('ar://', `${gateway}/`);
		}

		return url;
	} catch (error) {
		console.error('❌ Failed to resolve gateway URL:', url, error);
		// Fallback to arweave.net
		return url.replace('ar://', 'https://arweave.net/');
	}
}

// Get the best gateway endpoint
export async function getBestGatewayEndpoint(): Promise<string> {
	try {
		if (globalGateways.length === 0) {
			await initializeWayfinder();
		}
		return getNextGateway();
	} catch (error) {
		console.warn('Gateways not available, using fallback gateway:', error);
		return 'https://arweave.net';
	}
}

// Test gateway performance
export async function testGatewayPerformance(): Promise<Record<string, number>> {
	const results: Record<string, number> = {};

	for (const gateway of globalGateways) {
		try {
			const start = performance.now();
			const response = await fetch(`${gateway}/info`);
			const duration = performance.now() - start;

			if (response.ok) {
				results[gateway] = duration;
			} else {
				results[gateway] = Infinity;
			}
		} catch (error) {
			results[gateway] = Infinity;
		}
	}

	return results;
}
