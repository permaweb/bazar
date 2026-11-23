import { formatTokenAmount, parseTokenAmount } from 'api/order-matching';

/** AR is denominated in winston: 1 AR = 10^12 winston. */
const AR_DENOMINATION = 12;
export const AR_AMOUNT_ERROR = 'Enter a positive AR amount.';

export function formatTickerLabel(ticker: string | null | undefined, fallback = 'Token') {
	const value = ticker?.trim() || fallback;
	return value.startsWith('$') ? value : `$${value}`;
}

export function formatTokenDescription(description: string) {
	return description.replace(/\\r\\n|\\n|\\r/g, '\n').trim();
}

/** Group the whole part of an exact decimal string with fixed commas. This is
 * deliberately locale-independent: the decimal separator is always '.', so a
 * locale grouping separator must never be mixed in ('1.234.5' in de-DE). */
export function groupDecimalAmount(value: string) {
	const [whole, fraction] = value.split('.');
	const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

/** Format winston as an exact, comma-grouped AR amount ('1,234.5'). */
export function formatArAmount(winston: string | bigint) {
	return groupDecimalAmount(formatTokenAmount(BigInt(winston).toString(), AR_DENOMINATION));
}

/** Parse a typed or pasted AR amount into exact winston. Surrounding whitespace
 * is ignored; zero, malformed values and more than 12 decimals throw the
 * user-facing AR_AMOUNT_ERROR. */
export function parseArAmount(value: string) {
	let winston: string;
	try {
		winston = parseTokenAmount(value, AR_DENOMINATION);
	} catch {
		throw new Error(AR_AMOUNT_ERROR);
	}
	if (winston === '0') throw new Error(AR_AMOUNT_ERROR);
	return winston;
}
