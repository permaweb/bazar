import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TokenPriceChart, tokenPricePolyline } from './TokenPriceChart';

describe('TokenPriceChart', () => {
	it('normalizes very large integer prices without losing precision', () => {
		const points = [
			{ id: 'a', timestamp: 1, value: '900719925474099300000000000' },
			{ id: 'b', timestamp: 2, value: '900719925474099400000000000' },
			{ id: 'c', timestamp: 3, value: '900719925474099500000000000' },
		];
		expect(tokenPricePolyline(points)).toBe('0.00,180.00 320.00,90.00 640.00,0.00');
	});

	it('states that indexed asks are not executed trades', () => {
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
		expect(markup).toContain('Listing submissions only');
		expect(markup).toContain('not executed trade-price history');
	});
});
