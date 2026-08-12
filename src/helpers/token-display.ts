export function formatTickerLabel(ticker: string | null | undefined, fallback = 'Token') {
	const value = ticker?.trim() || fallback;
	return value.startsWith('$') ? value : `$${value}`;
}
