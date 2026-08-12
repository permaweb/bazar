import { describe, expect, it } from 'vitest';

import { formatTickerLabel } from './token-display';

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
