import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
	tokenPriceChangePercent,
	TokenPriceChart,
	tokenPricePointsForRange,
	tokenPricePolyline,
} from './TokenPriceChart';

describe('TokenPriceChart', () => {
	it('normalizes very large integer prices without losing precision', () => {
		const points = [
			{ id: 'a', timestamp: 1, value: '900719925474099300000000000' },
			{ id: 'b', timestamp: 2, value: '900719925474099400000000000' },
			{ id: 'c', timestamp: 3, value: '900719925474099500000000000' },
		];
		expect(tokenPricePolyline(points)).toBe('0.00,180.00 320.00,90.00 640.00,0.00');
	});

	it('filters second-based Arweave timestamps into interactive ranges', () => {
		const now = Date.UTC(2026, 7, 12, 16);
		const points = [
			{ id: 'old', timestamp: (now - 8 * 24 * 60 * 60 * 1_000) / 1_000, value: '10' },
			{ id: 'week', timestamp: (now - 6 * 24 * 60 * 60 * 1_000) / 1_000, value: '20' },
			{ id: 'day', timestamp: (now - 12 * 60 * 60 * 1_000) / 1_000, value: '30' },
		];
		expect(tokenPricePointsForRange(points, '24h', now).map((point) => point.id)).toEqual(['day']);
		expect(tokenPricePointsForRange(points, '7d', now).map((point) => point.id)).toEqual(['week', 'day']);
		expect(tokenPricePointsForRange(points, 'all', now).map((point) => point.id)).toEqual(['old', 'week', 'day']);
	});

	it('reports range movement without converting the underlying prices to floating point', () => {
		expect(
			tokenPriceChangePercent([
				{ id: 'a', timestamp: 1, value: '900719925474099300000000000' },
				{ id: 'b', timestamp: 2, value: '945755921747804265000000000' },
			])
		).toBe(5);
	});

	it('renders interactive range controls without instructional footer copy', () => {
		const markup = renderToStaticMarkup(
			React.createElement(TokenPriceChart, {
				points: [{ id: 'a', timestamp: 1, value: '1000000000000' }],
				ticker: 'TOK',
				loading: false,
				error: null,
				formatValue: (value: string) => `${value} winston`,
			})
		);
		expect(markup).toContain('Ask history');
		expect(markup).toContain('Ask history range');
		expect(markup).toContain('aria-pressed="true"');
		expect(markup).not.toContain('Move across the chart to inspect');
		expect(markup).not.toContain('Listing submissions only');
		expect(markup).not.toContain('submissions');
		expect(markup).not.toContain('>Indexed ask<');
	});
});
