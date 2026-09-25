import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';

import type { Collection } from 'api/collections';

import TokenMarketRow from 'components/molecules/TokenMarketRow/TokenMarketRow';
import { HOME_MESSAGES } from 'features/Home/messages';

const language = HOME_MESSAGES.en;

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
						image: logo,
					},
					collection,
					context: 'Fungible token',
					metric: { label: 'Unit price', value: '0.1 AR / TRUNKY', tone: 'positive' },
					secondaryMetric: { label: '24h change', value: '-12.5%', tone: 'negative' },
					tickerFallback: language.homeTokenRowTickerFallback,
				})
			)
		);

		expect(markup).toContain('token-market-row');
		expect(markup).toContain(`src="${logo}"`);
		expect(markup).toContain('TRUNKY');
		expect(markup).toContain('Unit price');
		expect(markup).toContain('24h change');
		expect(markup).toContain('-12.5%');
		expect(markup).toContain('token-market-metric secondary negative');
		expect(markup).not.toContain('home-asset-media');
	});

	it('centers a ticker avatar when the token has no uploaded logo', () => {
		const markup = renderToStaticMarkup(
			React.createElement(
				StaticRouter,
				{ location: '/' },
				React.createElement(TokenMarketRow, {
					asset: {
						id: 'M'.repeat(43),
						name: 'Mint CLI Alpha',
						ticker: 'MINTA',
					},
					collection,
					tickerFallback: language.homeTokenRowTickerFallback,
				})
			)
		);

		expect(markup).toContain('token-market-logo');
		expect(markup).toContain('token-avatar ticker-5');
		expect(markup).toContain('<strong>MINTA</strong>');
		expect(markup).not.toContain('token-artwork');
	});
});
