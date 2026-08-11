import { describe, expect, it } from 'vitest';

import { formatMarketActivityTimestamp, marketActivityLabel, marketActivityRefreshDelay } from './MarketActivityList';

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

	it('updates only at the next visible relative-time boundary', () => {
		const now = Date.UTC(2026, 7, 7, 16, 35, 12, 500);
		const event = (elapsed: number) => ({ timestamp: (now - elapsed) / 1_000 } as any);

		expect(marketActivityRefreshDelay([event(2_500)], now)).toBe(520);
		expect(marketActivityRefreshDelay([event(90_500)], now)).toBe(29_520);
		expect(marketActivityRefreshDelay([event(7_200_500)], now)).toBe(3_599_520);
		expect(marketActivityRefreshDelay([event(172_800_500)], now)).toBe(86_399_520);
		expect(marketActivityRefreshDelay([], now)).toBeNull();
	});
});
