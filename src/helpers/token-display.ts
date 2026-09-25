/** `fallback` is the caller's resolved copy for an unnamed token; this helper holds no copy of its own. */
export function formatTickerLabel(ticker: string | null | undefined, fallback: string) {
	const value = ticker?.trim() || fallback;
	return value.startsWith('$') ? value : `$${value}`;
}

export function formatTokenDescription(description: string) {
	return description.replace(/\\r\\n|\\n|\\r/g, '\n').trim();
}
