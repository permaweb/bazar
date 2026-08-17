import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
	tokenPriceAreaSeries,
	tokenPriceCandlestickSeries,
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
			{ id: 'hour', timestamp: (now - 45 * 60 * 1_000) / 1_000, value: '40' },
			{ id: 'minute', timestamp: (now - 4 * 60 * 1_000) / 1_000, value: '50' },
		];
		expect(tokenPricePointsForRange(points, '5m', now).map((point) => point.id)).toEqual(['minute']);
		expect(tokenPricePointsForRange(points, '1h', now).map((point) => point.id)).toEqual(['hour', 'minute']);
		expect(tokenPricePointsForRange(points, '24h', now).map((point) => point.id)).toEqual([
			'day',
			'hour',
			'minute',
		]);
		expect(tokenPricePointsForRange(points, '7d', now).map((point) => point.id)).toEqual([
			'week',
			'day',
			'hour',
			'minute',
		]);
		expect(tokenPricePointsForRange(points, 'all', now).map((point) => point.id)).toEqual([
			'old',
			'week',
			'day',
			'hour',
			'minute',
		]);
	});

	it('reports range movement without converting the underlying prices to floating point', () => {
		expect(
			tokenPriceChangePercent([
				{ id: 'a', timestamp: 1, value: '900719925474099300000000000' },
				{ id: 'b', timestamp: 2, value: '945755921747804265000000000' },
			])
		).toBe(5);
	});

	it('builds honest OHLC candles from asks inside each range bucket', () => {
		const base = Date.UTC(2026, 7, 12, 12) / 1_000;
		const series = tokenPriceCandlestickSeries(
			[
				{ id: 'open', timestamp: base, value: '1000000000000' },
				{ id: 'high', timestamp: base + 10 * 60, value: '2000000000000' },
				{ id: 'low', timestamp: base + 20 * 60, value: '750000000000' },
				{ id: 'close', timestamp: base + 30 * 60, value: '1250000000000' },
				{ id: 'next', timestamp: base + 60 * 60, value: '1500000000000' },
			],
			'24h'
		);
		expect(
			series.map(({ time, open, high, low, close, closePoint }) => ({
				time,
				open,
				high,
				low,
				close,
				closeId: closePoint.id,
			}))
		).toEqual([
			{ time: base, open: 1, high: 2, low: 0.75, close: 1.25, closeId: 'close' },
			{ time: base + 60 * 60, open: 1.5, high: 1.5, low: 1.5, close: 1.5, closeId: 'next' },
		]);
	});

	it('uses each bucket close for the simplified area trend', () => {
		const base = Date.UTC(2026, 7, 12, 12) / 1_000;
		expect(
			tokenPriceAreaSeries(
				[
					{ id: 'open', timestamp: base, value: '1000000000000' },
					{ id: 'close', timestamp: base + 30 * 60, value: '1250000000000' },
					{ id: 'next', timestamp: base + 60 * 60, value: '1500000000000' },
				],
				'24h'
			).map(({ time, value, sourcePoint }) => ({ time, value, sourceId: sourcePoint.id }))
		).toEqual([
			{ time: base, value: 1.25, sourceId: 'close' },
			{ time: base + 60 * 60, value: 1.5, sourceId: 'next' },
		]);
	});

	it('renders interactive range controls without an indexed-history footer', () => {
		const markup = renderToStaticMarkup(
			React.createElement(TokenPriceChart, {
				points: [{ id: 'a', timestamp: 1, value: '1000000000000' }],
				floorValue: '750000000000',
				ticker: 'TOK',
				loading: false,
				error: null,
				formatValue: (value: string) => `${value} winston`,
			})
		);
		expect(markup).toContain('Ask history');
		expect(markup).toContain('Ask history range');
		expect(markup).toContain('Floor price');
		expect(markup).toContain('750000000000 winston');
		expect(markup).not.toContain('Current price');
		expect(markup).not.toContain('Selected ask');
		expect(markup).toContain('indexed ask');
		expect(markup).not.toContain('token-price-summary');
		expect(markup).toContain('>5M<');
		expect(markup).toContain('>1H<');
		expect(markup).toContain('aria-pressed="true"');
		expect(markup).not.toContain('Move across the chart to inspect');
		expect(markup).not.toContain('Listing submissions only');
		expect(markup).not.toContain('indexed listing submissions loaded');
		expect(markup).not.toContain('>Indexed ask<');
	});
});
