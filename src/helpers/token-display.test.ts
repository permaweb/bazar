import { describe, expect, it } from 'vitest';

import {
	AR_AMOUNT_ERROR,
	formatArAmount,
	formatTickerLabel,
	formatTokenDescription,
	groupDecimalAmount,
	parseArAmount,
} from './token-display';

describe('AR amounts', () => {
	it('formats winston exactly with fixed comma grouping', () => {
		expect(formatArAmount('1234500000000000')).toBe('1,234.5');
		expect(formatArAmount('10000000000000001')).toBe('10,000.000000000001');
		expect(formatArAmount('12345678901234567890')).toBe('12,345,678.90123456789');
		expect(formatArAmount(1_000_000_000_000n)).toBe('1');
		expect(formatArAmount('0')).toBe('0');
	});

	it('parses trimmed AR amounts into exact winston', () => {
		expect(parseArAmount(' 0.25 ')).toBe('250000000000');
		expect(parseArAmount('0.000000000001')).toBe('1');
		expect(parseArAmount('1234.5')).toBe('1234500000000000');
	});

	it('rejects zero, malformed and over-precise AR amounts with the user-facing message', () => {
		for (const value of ['0', '0.0', '', ' ', '1.', '.5', '01', '-1', '1,000', '0.0000000000001']) {
			expect(() => parseArAmount(value)).toThrow(AR_AMOUNT_ERROR);
		}
	});

	it('groups exact decimal strings without touching the fraction', () => {
		expect(groupDecimalAmount('1234567.1234567')).toBe('1,234,567.1234567');
		expect(groupDecimalAmount('999')).toBe('999');
	});
});

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
