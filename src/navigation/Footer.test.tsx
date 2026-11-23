import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { Footer } from './Footer';

const sourceRoot = join(process.cwd(), 'src');
const appSource = readFileSync(join(sourceRoot, 'app/App.tsx'), 'utf8');
const chartSource = readFileSync(join(sourceRoot, 'components/TokenPriceChart.tsx'), 'utf8');

function shellJsx(source: string) {
	const start = source.indexOf('export function App()');
	expect(start).toBeGreaterThanOrEqual(0);
	const end = source.indexOf('</MarketContext.Provider>', start);
	expect(end).toBeGreaterThan(start);
	return source.slice(start, end);
}

describe('site footer', () => {
	it('links the TradingView attribution', () => {
		const markup = renderToStaticMarkup(<Footer />);

		expect(markup).toContain('class="site-footer"');
		expect(markup).toContain('href="https://www.tradingview.com/"');
		expect(markup).toContain('TradingView');
	});

	it('is mounted by the app shell after the main content', () => {
		const shell = shellJsx(appSource);
		const main = shell.indexOf('</main>');
		const footer = shell.indexOf('<Footer />');
		const provider = shell.indexOf('</OperationActivityProvider>');

		expect(appSource).toMatch(/^import \{ Footer \} from 'navigation\/Footer';$/m);
		expect(main).toBeGreaterThan(0);
		expect(footer).toBeGreaterThan(main);
		expect(provider).toBeGreaterThan(footer);
	});

	it('carries the attribution the price chart omits by disabling its logo', () => {
		// Lightweight Charts asks apps that hide the chart logo to link TradingView on a visible page.
		if (!/attributionLogo:\s*false/.test(chartSource)) return;

		expect(shellJsx(appSource)).toContain('<Footer />');
	});
});
