import { describe, expect, it } from 'vitest';

import { formatTickerLabel, formatTokenDescription } from './token-display';

describe('formatTickerLabel', () => {
	it('prefixes tickers with a dollar sign', () => {
		expect(formatTickerLabel('MIST')).toBe('$MIST');
	});

	it('does not duplicate an existing prefix', () => {
		expect(formatTickerLabel('$MIST')).toBe('$MIST');
	});

	it('uses a prefixed fallback for missing tickers', () => {
		expect(formatTickerLabel('')).toBe('$Token');
		expect(formatTickerLabel(undefined, 'tokens')).toBe('$tokens');
	});
});

describe('formatTokenDescription', () => {
	it('turns escaped line breaks into actual newlines', () => {
		expect(formatTokenDescription('First line\\nSecond line\\r\\nThird line')).toBe(
			'First line\nSecond line\nThird line'
		);
	});

	it('preserves actual newlines and trims surrounding whitespace', () => {
		expect(formatTokenDescription('  First line\nSecond line  ')).toBe('First line\nSecond line');
	});
});
