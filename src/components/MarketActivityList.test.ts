import { describe, expect, it } from 'vitest';

import { formatMarketActivityTimestamp, marketActivityLabel } from './MarketActivityList';

describe('market activity labels', () => {
	it('presents a purchase reservation as a submitted purchase', () => {
		expect(marketActivityLabel('register-interest')).toBe('Purchase submitted');
		expect(marketActivityLabel('register-interest', true)).toBe('Purchase confirmed');
	});

	it('formats activity timestamps as live relative time', () => {
		const now = Date.UTC(2026, 7, 7, 16, 35, 12);

		expect(formatMarketActivityTimestamp((now - 1_000) / 1_000, now)).toBe('1 second ago');
		expect(formatMarketActivityTimestamp((now - 59_000) / 1_000, now)).toBe('59 seconds ago');
		expect(formatMarketActivityTimestamp((now - 60_000) / 1_000, now)).toBe('1 minute ago');
		expect(formatMarketActivityTimestamp((now - 3_600_000) / 1_000, now)).toBe('1 hour ago');
		expect(formatMarketActivityTimestamp((now - 86_400_000) / 1_000, now)).toBe('1 day ago');
		expect(formatMarketActivityTimestamp((now - 7 * 86_400_000) / 1_000, now)).toBe('1 week ago');
		expect(formatMarketActivityTimestamp((now - 30 * 86_400_000) / 1_000, now)).toBe('1 month ago');
		expect(formatMarketActivityTimestamp((now - 365 * 86_400_000) / 1_000, now)).toBe('1 year ago');
	});
});
