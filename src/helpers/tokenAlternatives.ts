import { TOKEN_REGISTRY } from './config';

// Alternative token process IDs based on common patterns and known alternatives
export const ALTERNATIVE_TOKEN_IDS = {
	// Wander token alternatives
	wander: [
		'7GoQfmSOct_aUOWKM4xbKGg6DzAmOgdKwg8Kf-CbHm4', // Original (not working)
		'wander-token-v2', // Hypothetical v2
		'wander-token-mainnet', // Hypothetical mainnet version
		'wander-protocol-token', // Alternative naming
	],

	// AO token alternatives
	ao: [
		// AO token removed due to incorrect process ID
		'ao-standard-token', // Alternative naming
		'ao-protocol-token', // Protocol version
		'ao-mainnet-token', // Mainnet version
	],

	// PIXL token alternatives (in case the current one has issues)
	pixl: [
		'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo', // Current (partially working)
		'pixl-token-v2', // Hypothetical v2
		'pixl-protocol-token', // Alternative naming
	],

	// wAR token alternatives (in case the current one has issues)
	war: [
		'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10', // Current (working)
		'wrapped-ar-token', // Alternative naming
		'war-token-mainnet', // Mainnet version
	],
};

// Known working token contracts for fallback
export const WORKING_TOKEN_FALLBACKS = {
	// If Wander doesn't work, suggest wAR
	wander: 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',

	// If AO doesn't work, suggest wAR
	ao: 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',

	// If PIXL doesn't work, suggest wAR
	pixl: 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
};

// Token contract patterns to try
export const TOKEN_CONTRACT_PATTERNS = [
	// Standard token contract patterns
	'{token}-token',
	'{token}-protocol',
	'{token}-mainnet',
	'{token}-v2',
	'{token}-v1',
	'{token}-standard',

	// Alternative naming patterns
	'{token}token',
	'{token}protocol',
	'{token}mainnet',
	'{token}standard',
];

/**
 * Get alternative process IDs for a token
 */
export function getAlternativeTokenIds(tokenId: string): string[] {
	const token = TOKEN_REGISTRY[tokenId];
	if (!token) return [];

	// Try to match token by symbol or name
	const symbol = token.symbol.toLowerCase();
	const name = token.name.toLowerCase();

	let alternatives: string[] = [];

	// Check if we have predefined alternatives
	if (symbol.includes('wander') || name.includes('wander')) {
		alternatives = ALTERNATIVE_TOKEN_IDS.wander;
	} else if (symbol.includes('ao') || name.includes('ao')) {
		alternatives = ALTERNATIVE_TOKEN_IDS.ao;
	} else if (symbol.includes('pixl') || name.includes('pixl')) {
		alternatives = ALTERNATIVE_TOKEN_IDS.pixl;
	} else if (symbol.includes('war') || name.includes('wrapped ar')) {
		alternatives = ALTERNATIVE_TOKEN_IDS.war;
	}

	// Generate pattern-based alternatives
	const patternAlternatives = TOKEN_CONTRACT_PATTERNS.map((pattern) => pattern.replace('{token}', symbol));

	return [...alternatives, ...patternAlternatives];
}

/**
 * Get fallback token for a non-working token
 */
export function getFallbackToken(tokenId: string): string | null {
	const token = TOKEN_REGISTRY[tokenId];
	if (!token) return null;

	const symbol = token.symbol.toLowerCase();
	const name = token.name.toLowerCase();

	// Check predefined fallbacks
	if (symbol.includes('wander') || name.includes('wander')) {
		return WORKING_TOKEN_FALLBACKS.wander;
	} else if (symbol.includes('ao') || name.includes('ao')) {
		return WORKING_TOKEN_FALLBACKS.ao;
	} else if (symbol.includes('pixl') || name.includes('pixl')) {
		return WORKING_TOKEN_FALLBACKS.pixl;
	}

	// Default fallback to wAR
	return 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10';
}

/**
 * Check if a token ID looks like a valid AO process ID
 */
export function isValidProcessId(tokenId: string): boolean {
	// AO process IDs are typically 43 characters long and contain alphanumeric characters and hyphens
	const processIdPattern = /^[a-zA-Z0-9_-]{40,45}$/;
	return processIdPattern.test(tokenId);
}

/**
 * Generate potential token IDs based on common patterns
 */
export function generatePotentialTokenIds(baseToken: string): string[] {
	const base = baseToken.toLowerCase().replace(/[^a-z0-9]/g, '');

	return [
		// Direct variations
		base,
		`${base}-token`,
		`${base}-protocol`,
		`${base}-mainnet`,
		`${base}-v2`,
		`${base}-v1`,
		`${base}-standard`,

		// Alternative formats
		`${base}token`,
		`${base}protocol`,
		`${base}mainnet`,
		`${base}standard`,

		// Common prefixes/suffixes
		`token-${base}`,
		`protocol-${base}`,
		`mainnet-${base}`,
		`standard-${base}`,
	];
}

/**
 * Get token suggestions for a failed token
 */
export function getTokenSuggestions(failedTokenId: string): {
	alternatives: string[];
	fallback: string;
	reason: string;
} {
	const alternatives = getAlternativeTokenIds(failedTokenId);
	const fallback = getFallbackToken(failedTokenId);
	const token = TOKEN_REGISTRY[failedTokenId];

	let reason = 'Token contract not responding';
	if (token) {
		reason = `${token.name} (${token.symbol}) contract is not responding. Try alternatives or use ${
			TOKEN_REGISTRY[fallback]?.name || 'wAR'
		} as fallback.`;
	}

	return {
		alternatives,
		fallback,
		reason,
	};
}

/**
 * Check if a token ID is in our registry
 */
export function isTokenInRegistry(tokenId: string): boolean {
	return !!TOKEN_REGISTRY[tokenId];
}

/**
 * Get all known working tokens
 */
export function getWorkingTokens(): string[] {
	// Based on our network analysis, only wAR is fully working
	return ['xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10'];
}

/**
 * Get tokens that need alternatives
 */
export function getTokensNeedingAlternatives(): string[] {
	// Based on our network analysis
	return [
		'7GoQfmSOct_aUOWKM4xbKGg6DzAmOgdKwg8Kf-CbHm4', // Wander
		// AO token removed due to incorrect process ID
	];
}
