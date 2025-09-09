import { TOKEN_REGISTRY } from './config';

// Token validation and fallback utilities
export interface TokenValidationResult {
	isValid: boolean;
	isSupported: boolean;
	hasBalance: boolean;
	hasMetadata: boolean;
	fallbackBalance: string;
	fallbackMetadata: any;
	error?: string;
}

// Token contract status cache
const tokenStatusCache: { [tokenId: string]: TokenValidationResult } = {};

// Default fallback values for tokens
const DEFAULT_FALLBACKS = {
	balance: '0',
	metadata: {
		name: 'Unknown Token',
		symbol: 'UNKNOWN',
		denomination: 12,
		description: 'Token information unavailable',
	},
};

/**
 * Validates if a token is supported and accessible
 */
export function validateToken(tokenId: string): TokenValidationResult {
	// Check if token exists in registry
	if (!TOKEN_REGISTRY[tokenId]) {
		return {
			isValid: false,
			isSupported: false,
			hasBalance: false,
			hasMetadata: false,
			fallbackBalance: DEFAULT_FALLBACKS.balance,
			fallbackMetadata: DEFAULT_FALLBACKS.metadata,
			error: `Token ${tokenId} not found in registry`,
		};
	}

	// Return cached result if available
	if (tokenStatusCache[tokenId]) {
		return tokenStatusCache[tokenId];
	}

	// Default validation for known tokens
	const token = TOKEN_REGISTRY[tokenId];
	const result: TokenValidationResult = {
		isValid: true,
		isSupported: true,
		hasBalance: true,
		hasMetadata: true,
		fallbackBalance: DEFAULT_FALLBACKS.balance,
		fallbackMetadata: {
			name: token.name,
			symbol: token.symbol,
			denomination: token.denomination,
			description: token.description,
		},
	};

	// Cache the result
	tokenStatusCache[tokenId] = result;
	return result;
}

/**
 * Handles null balance responses gracefully
 */
export function handleBalanceResponse(tokenId: string, response: any, address: string): string {
	const validation = validateToken(tokenId);

	// If response is null or undefined, return fallback
	if (response === null || response === undefined) {
		console.warn(`Token ${tokenId} returned null balance for ${address}, using fallback`);
		return validation.fallbackBalance;
	}

	// If response is a number or string, return it
	if (typeof response === 'number' || typeof response === 'string') {
		return response.toString();
	}

	// If response is an object with data, try to extract balance
	if (typeof response === 'object') {
		if (response.data !== undefined) {
			return response.data.toString();
		}
		if (response.balance !== undefined) {
			return response.balance.toString();
		}
	}

	// Default fallback
	console.warn(`Token ${tokenId} returned unexpected balance format for ${address}, using fallback`);
	return validation.fallbackBalance;
}

/**
 * Handles null metadata responses gracefully
 */
export function handleMetadataResponse(tokenId: string, response: any): any {
	const validation = validateToken(tokenId);

	// If response is null or undefined, return fallback
	if (response === null || response === undefined) {
		console.warn(`Token ${tokenId} returned null metadata, using fallback`);
		return validation.fallbackMetadata;
	}

	// If response is an object with data, try to extract metadata
	if (typeof response === 'object') {
		if (response.data !== undefined) {
			return response.data;
		}
		if (response.metadata !== undefined) {
			return response.metadata;
		}
		// If the response itself looks like metadata, return it
		if (response.name || response.symbol) {
			return response;
		}
	}

	// Default fallback
	console.warn(`Token ${tokenId} returned unexpected metadata format, using fallback`);
	return validation.fallbackMetadata;
}

/**
 * Checks if a token supports specific operations
 */
export function isTokenSupported(tokenId: string, operation: 'balance' | 'metadata' | 'transfer' | 'orders'): boolean {
	const validation = validateToken(tokenId);

	if (!validation.isValid) {
		return false;
	}

	// Based on our network analysis, we know which tokens support what
	switch (operation) {
		case 'balance':
			// All tokens in registry should support balance operations
			// Let the network calls determine if they actually work
			return true;

		case 'metadata':
			// Only wAR and PIXL return responses (but with null data)
			return ['xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10', 'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo'].includes(
				tokenId
			);

		case 'transfer':
			// All tokens should support transfer, but some may fail
			return true;

		case 'orders':
			// Only wAR works reliably for orders
			return tokenId === 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10';

		default:
			return false;
	}
}

/**
 * Gets user-friendly error messages for token operations
 */
export function getTokenErrorMessage(tokenId: string, operation: string): string {
	const token = TOKEN_REGISTRY[tokenId];
	const tokenName = token ? token.name : 'Unknown Token';

	switch (operation) {
		case 'balance':
			return `${tokenName} balance is currently unavailable. Please try again later.`;

		case 'metadata':
			return `${tokenName} information is currently unavailable.`;

		case 'transfer':
			return `${tokenName} transfers are currently not supported.`;

		case 'orders':
			return `${tokenName} orders are currently not supported. Please use wAR for trading.`;

		default:
			return `${tokenName} operation failed. Please try again later.`;
	}
}

/**
 * Updates token status cache with network analysis results
 */
export function updateTokenStatus(tokenId: string, status: Partial<TokenValidationResult>): void {
	if (tokenStatusCache[tokenId]) {
		tokenStatusCache[tokenId] = { ...tokenStatusCache[tokenId], ...status };
	} else {
		tokenStatusCache[tokenId] = {
			isValid: true,
			isSupported: true,
			hasBalance: true,
			hasMetadata: true,
			fallbackBalance: '0',
			fallbackMetadata: DEFAULT_FALLBACKS.metadata,
			...status,
		};
	}
}

/**
 * Clears token status cache
 */
export function clearTokenStatusCache(): void {
	Object.keys(tokenStatusCache).forEach((key) => delete tokenStatusCache[key]);
}
