import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';

import type { Collection } from 'api/collections';

import { TokenMarketRow } from './TokenMarketRow';

const collection: Collection = {
	id: 'fungible-tokens',
	name: 'Tokens',
	description: '',
	kind: 'tokens',
	assets: [],
};

describe('TokenMarketRow', () => {
	it('renders token identity and market data as a compact row with a permanent logo', () => {
		const logo = `https://arweave.net/${'L'.repeat(43)}`;
		const markup = renderToStaticMarkup(
			React.createElement(
				StaticRouter,
				{ location: '/' },
				React.createElement(TokenMarketRow, {
					asset: {
						id: 'T'.repeat(43),
						name: 'Trunky',
						ticker: 'TRUNKY',
						contentType: 'application/x.arweave-token',
						image: logo,
					},
					collection,
					context: 'Fungible token',
					metric: { label: 'Unit price', value: '0.1 AR / TRUNKY', tone: 'positive' },
				})
			)
		);

		expect(markup).toContain('token-market-row');
		expect(markup).toContain(`src="${logo}"`);
		expect(markup).toContain('TRUNKY');
		expect(markup).toContain('Unit price');
		expect(markup).not.toContain('home-asset-media');
	});
});
