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

	// Check for denomination in currencies reducer
	if (currenciesReducer?.[currency]?.Denomination) {
		const denomination = currenciesReducer[currency].Denomination;
		return formatCount((numericAmount / Math.pow(10, denomination)).toString());
	}

	// Check for denomination in asset state
	if (assetState?.denomination) {
		const denomination = assetState.denomination;
		return formatCount((numericAmount / Math.pow(10, denomination)).toString());
	}

	// If no denomination found, just format the number
	return formatCount(numericAmount.toString());
}
