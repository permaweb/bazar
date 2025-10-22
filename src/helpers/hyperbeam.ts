import { HB } from './config';

/**
 * Fetch process state from HyperBEAM node
 * This replaces dryrun operations with direct HyperBEAM state fetches
 */
export async function fetchProcessState(args: {
	processId: string;
	path?: string; // e.g., 'zone', 'orderbook', 'info'
}): Promise<any> {
	const path = args.path || '';
	// HyperBEAM URL format: {node}/{pid}~process@1.0/now/{path}
	const url = `${HB.defaultNode}/${args.processId}~process@1.0/now/${path}`;

	try {
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`HyperBEAM fetch failed: ${response.status} ${response.statusText}`);
		}

		// Try to parse as JSON
		const contentType = response.headers.get('content-type');
		if (contentType && contentType.includes('application/json')) {
			return await response.json();
		}

		// If not JSON, return text
		return await response.text();
	} catch (error) {
		console.error('Error fetching from HyperBEAM:', error);
		throw error;
	}
}

/**
 * Fetch profile zone data from HyperBEAM
 */
export async function fetchProfileZone(profileId: string): Promise<any> {
	return fetchProcessState({
		processId: profileId,
		path: 'zone',
	});
}

/**
 * Fetch asset info from HyperBEAM
 */
export async function fetchAssetInfo(assetId: string): Promise<any> {
	return fetchProcessState({
		processId: assetId,
		path: 'info',
	});
}

/**
 * Fetch orderbook data from HyperBEAM
 */
export async function fetchOrderbook(orderbookId: string, path?: string): Promise<any> {
	return fetchProcessState({
		processId: orderbookId,
		path: path || 'orderbook',
	});
}

/**
 * Fetch activity data from HyperBEAM
 */
export async function fetchActivity(activityId: string, path?: string): Promise<any> {
	return fetchProcessState({
		processId: activityId,
		path: path || 'activity',
	});
}
