export function formatTickerLabel(ticker: string | null | undefined, fallback = 'Token') {
	const value = ticker?.trim() || fallback;
	return value.startsWith('$') ? value : `$${value}`;
}

export function formatTokenDescription(description: string) {
	return description.replace(/\\r\\n|\\n|\\r/g, '\n').trim();
}
