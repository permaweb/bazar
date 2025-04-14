import { formatCount } from './utils';

/**
 * Helper functions for token-related operations
 */

interface CurrencyReducer {
	[key: string]: {
		Denomination?: number;
		Ticker?: string;
		Logo?: string;
	};
}

// Known token denominations for common tokens in the Arweave ecosystem
const KNOWN_TOKEN_DENOMINATIONS: { [key: string]: number } = {
	'PIXL Token': 12,
	artoken: 12,
	AR: 12,
	wAR: 12,
	U: 6,
	ETH: 18,
	DAI: 18,
	USDC: 6,
	USDT: 6,
};

/**
 * Formats a token value with the appropriate denomination based on the currency
 * @param amount The amount to format
 * @param currency The currency/token identifier
 * @param currenciesReducer Optional currencies reducer for denomination info
 * @param assetState Optional asset state for denomination info
 * @returns Formatted token value as a string
 */
export function getDenominatedTokenValue(
	amount: number | string,
	currency: string,
	currenciesReducer?: CurrencyReducer,
	assetState?: { denomination?: number }
): string {
	if (!amount || !currency) return '0';

	const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

	// Special case for extremely large numbers - they're likely using incorrect denomination
	// If the value is very large (over 1 million) and denomination would make it tiny
	// just format it directly
	if (numericAmount > 1000000 && isLikelyAtomic(numericAmount, currency)) {
		return formatCount('1');
	}

	// Check for denomination in currencies reducer first (highest priority)
	if (currenciesReducer?.[currency]?.Denomination) {
		const denomination = currenciesReducer[currency].Denomination;
		return formatCount((numericAmount / Math.pow(10, denomination)).toString());
	}

	// Check for denomination in asset state
	if (assetState?.denomination) {
		const denomination = assetState.denomination;
		return formatCount((numericAmount / Math.pow(10, denomination)).toString());
	}

	// Check for known token denominations
	if (currency in KNOWN_TOKEN_DENOMINATIONS) {
		const denomination = KNOWN_TOKEN_DENOMINATIONS[currency];
		return formatCount((numericAmount / Math.pow(10, denomination)).toString());
	}

	// If no denomination found, just format the number
	return formatCount(numericAmount.toString());
}

/**
 * Checks if the amount seems to be using atomic units inappropriately
 * This helps detect cases where we should be showing a smaller number
 *
 * @param amount The numeric amount to check
 * @param currency The currency/token identifier
 * @returns True if the amount is likely an atomic unit that should be displayed as 1
 */
function isLikelyAtomic(amount: number, currency: string): boolean {
	// For NFTs with common patterns like 1,000,000,000 or 1,000,000,000,000
	// they're often represented as 1 token with many decimal places
	const commonAtomicValues = [
		1000000000, // 10^9
		1000000000000, // 10^12
		1000000000000000000, // 10^18
	];

	// If the amount is very close to a common atomic value
	// (within 0.1% tolerance to account for small variance)
	return commonAtomicValues.some((value) => {
		const ratio = amount / value;
		return ratio > 0.999 && ratio < 1.001;
	});
}
