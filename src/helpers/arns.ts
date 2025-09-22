import { ANT, ARIO } from '@ar.io/sdk'; // The SDK should auto-detect web environment

import { ARNS } from 'helpers/config';
import { checkValidAddress } from 'helpers/utils';

const debug = (..._args: any[]) => {};

// Initialize ARIO client for mainnet
const ario = ARIO.mainnet();

// Cache for ArNS data to minimize API calls
const arnsCache = new Map<
	string,
	{
		primaryName?: string;
		logo?: string;
		timestamp: number;
	}
>();

export interface ArNSData {
	primaryName: string | null;
	logo: string | null;
}

/**
 * Get primary ArNS name for a wallet address
 */
export async function getPrimaryNameForAddress(address: string): Promise<string | null> {
	try {
		// Check cache first
		const cached = arnsCache.get(address);
		if (cached && Date.now() - cached.timestamp < ARNS.CACHE_DURATION && cached.primaryName !== undefined) {
			return cached.primaryName || null;
		}

		// Fetch primary name from ARIO
		const primaryName = await ario.getPrimaryName({ address });

		if (primaryName && primaryName.name) {
			// Update cache
			arnsCache.set(address, {
				...cached,
				primaryName: primaryName.name,
				timestamp: Date.now(),
			});
			return primaryName.name;
		}

		// Cache negative result
		arnsCache.set(address, {
			...cached,
			primaryName: '',
			timestamp: Date.now(),
		});
		return null;
	} catch (error) {
		// Log error only in development
		if (process.env.NODE_ENV === 'development') {
			console.error('Error fetching primary ArNS name:', error);
		}
		return null;
	}
}

/**
 * Get ArNS record details including logo
 */
export async function getArNSRecord(name: string): Promise<{ processId: string | null; logo: string | null }> {
	try {
		// Get the ArNS record
		const record = await ario.getArNSRecord({ name });

		debug('ArNS Debug - Record for', name, record);

		if (record && record.processId) {
			// Initialize ANT client for this record
			const ant = ANT.init({ processId: record.processId });

			debug('ArNS Debug - ANT initialized for processId', record.processId);

			// Get the logo transaction ID
			const logoTxId = await ant.getLogo();

			debug('ArNS Debug - Logo TxId for', name, logoTxId);

			if (logoTxId && checkValidAddress(logoTxId)) {
				debug('ArNS Debug - Valid logo found', logoTxId);
				return {
					processId: record.processId,
					logo: logoTxId,
				};
			}

			debug('ArNS Debug - No valid logo found for', name);
			return {
				processId: record.processId,
				logo: null,
			};
		}

		debug('ArNS Debug - No record or processId found for', name);
		return { processId: null, logo: null };
	} catch (error) {
		console.error('Error fetching ArNS record for', name, ':', error);
		return { processId: null, logo: null };
	}
}

/**
 * Get complete ArNS data for a wallet address
 */
export async function getArNSDataForAddress(address: string): Promise<ArNSData> {
	try {
		// First get the primary name
		const primaryName = await getPrimaryNameForAddress(address);

		debug('ArNS Debug - Primary name for', address, primaryName);

		if (!primaryName) {
			return { primaryName: null, logo: null };
		}

		// Check cache for logo
		const cached = arnsCache.get(address);
		if (cached && cached.logo !== undefined && Date.now() - cached.timestamp < ARNS.CACHE_DURATION) {
			debug('ArNS Debug - Using cached logo for', primaryName, cached.logo);
			return { primaryName, logo: cached.logo };
		}

		// Get the ArNS record details including logo
		const { logo } = await getArNSRecord(primaryName);

		debug('ArNS Debug - Fetched logo for', primaryName, logo);

		// Update cache with logo
		arnsCache.set(address, {
			primaryName,
			logo: logo || '',
			timestamp: Date.now(),
		});

		return { primaryName, logo };
	} catch (error) {
		console.error('Error fetching ArNS data:', error);
		return { primaryName: null, logo: null };
	}
}

/**
 * Clear ArNS cache for a specific address
 */
export function clearArNSCache(address?: string): void {
	if (address) {
		arnsCache.delete(address);
	} else {
		arnsCache.clear();
	}
}

/**
 * Format ArNS name for display (with truncation if needed)
 */
export function formatArNSName(name: string, maxLength: number = ARNS.DEFAULT_DISPLAY_LENGTH): string {
	if (name.length <= maxLength) {
		return name;
	}

	// Truncate the name with ellipsis
	return name.substring(0, maxLength - 3) + '...';
}
