import { readHandler } from 'api';

import { TOKEN_REGISTRY } from './config';

export interface TokenMetadata {
	name?: string;
	symbol?: string;
	ticker?: string;
	denomination?: number;
	logo?: string;
	description?: string;
	totalSupply?: string;
	transferable?: boolean;
	creator?: string;
}

// Cache for token metadata
const metadataCache = new Map<string, { metadata: TokenMetadata; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Fetches token metadata dynamically from the token contract
 */
export async function fetchTokenMetadata(tokenId: string): Promise<TokenMetadata> {
	// Check cache first
	const cached = metadataCache.get(tokenId);
	if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
		return cached.metadata;
	}

	try {
		console.log(`Fetching metadata for token ${tokenId}...`);

		const response = await readHandler({
			processId: tokenId,
			action: 'Info',
			data: null,
		});

		let metadata: TokenMetadata = {};

		if (response) {
			// Handle both direct response and nested data structure
			const data = response.Data ? JSON.parse(response.Data) : response;

			// Extract metadata fields (handle both uppercase and lowercase)
			metadata = {
				name: data.Name || data.name || response.Name || response.name,
				symbol: data.Ticker || data.ticker || data.Symbol || data.symbol || response.Ticker || response.ticker,
				ticker: data.Ticker || data.ticker || response.Ticker || response.ticker,
				denomination: parseInt(
					data.Denomination || data.denomination || response.Denomination || response.denomination || '12'
				),
				logo: data.Logo || data.logo || response.Logo || response.logo,
				description: data.Description || data.description || response.Description || response.description,
				totalSupply: data.TotalSupply || data.totalSupply || response.TotalSupply || response.totalSupply,
				transferable:
					data.Transferable !== undefined
						? data.Transferable
						: response.Transferable !== undefined
						? response.Transferable
						: true,
				creator: data.Creator || data.creator || response.Creator || response.creator,
			};

			console.log(`✅ Fetched metadata for ${tokenId}:`, metadata);
		} else {
			console.warn(`No metadata response for token ${tokenId}`);
		}

		// Cache the result
		metadataCache.set(tokenId, {
			metadata,
			timestamp: Date.now(),
		});

		return metadata;
	} catch (error) {
		console.error(`Failed to fetch metadata for token ${tokenId}:`, error);

		// Return fallback from registry if available
		const registryToken = TOKEN_REGISTRY[tokenId];
		if (registryToken) {
			return {
				name: registryToken.name,
				symbol: registryToken.symbol,
				denomination: registryToken.denomination,
				logo: registryToken.logo,
				description: registryToken.description,
			};
		}

		return {};
	}
}

/**
 * Gets the logo for a token, either from cache, metadata fetch, or registry fallback
 */
export async function getTokenLogo(tokenId: string): Promise<string | null> {
	try {
		const metadata = await fetchTokenMetadata(tokenId);

		// If we got a logo from metadata, return it
		if (metadata.logo) {
			console.log(`Using dynamic logo for ${tokenId}: ${metadata.logo}`);
			return metadata.logo;
		}

		// Fallback to registry logo (only if it's not a placeholder)
		const registryToken = TOKEN_REGISTRY[tokenId];
		if (
			registryToken &&
			registryToken.logo &&
			registryToken.logo !== 'defaultLogo' &&
			registryToken.logo !== 'dynamicLogo'
		) {
			console.log(`Using registry logo for ${tokenId}: ${registryToken.logo}`);
			return registryToken.logo;
		}

		console.warn(`No logo found for token ${tokenId}`);
		return null;
	} catch (error) {
		console.error(`Error getting logo for token ${tokenId}:`, error);

		// Final fallback to registry
		const registryToken = TOKEN_REGISTRY[tokenId];
		return registryToken?.logo && registryToken.logo !== 'defaultLogo' && registryToken.logo !== 'dynamicLogo'
			? registryToken.logo
			: null;
	}
}

/**
 * Enhanced token metadata that merges registry data with dynamic data
 */
export async function getEnhancedTokenMetadata(
	tokenId: string
): Promise<TokenMetadata & { id: string; priority: number }> {
	const registryToken = TOKEN_REGISTRY[tokenId];
	const dynamicMetadata = await fetchTokenMetadata(tokenId);

	return {
		id: tokenId,
		name: dynamicMetadata.name || registryToken?.name || 'Unknown Token',
		symbol: dynamicMetadata.symbol || registryToken?.symbol || 'UNKNOWN',
		ticker: dynamicMetadata.ticker || dynamicMetadata.symbol || registryToken?.symbol || 'UNKNOWN',
		denomination: dynamicMetadata.denomination || registryToken?.denomination || 12,
		logo:
			dynamicMetadata.logo ||
			(registryToken?.logo !== 'defaultLogo' && registryToken?.logo !== 'dynamicLogo'
				? registryToken?.logo
				: undefined),
		description: dynamicMetadata.description || registryToken?.description || 'Token information unavailable',
		totalSupply: dynamicMetadata.totalSupply,
		transferable: dynamicMetadata.transferable,
		creator: dynamicMetadata.creator,
		priority: registryToken?.priority || 999,
	};
}

/**
 * Clear metadata cache for a specific token or all tokens
 */
export function clearMetadataCache(tokenId?: string): void {
	if (tokenId) {
		metadataCache.delete(tokenId);
	} else {
		metadataCache.clear();
	}
}

/**
 * Preload metadata for all tokens in registry
 */
export async function preloadTokenMetadata(): Promise<void> {
	const tokenIds = Object.keys(TOKEN_REGISTRY);

	console.log('Preloading metadata for tokens:', tokenIds);

	// Fetch all metadata in parallel
	const promises = tokenIds.map(async (tokenId) => {
		try {
			await fetchTokenMetadata(tokenId);
		} catch (error) {
			console.warn(`Failed to preload metadata for ${tokenId}:`, error);
		}
	});

	await Promise.all(promises);
	console.log('Token metadata preloading complete');
}
