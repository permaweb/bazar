import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { Footer } from './Footer';

const sourceRoot = join(process.cwd(), 'src');
const appSource = readFileSync(join(sourceRoot, 'app/App.tsx'), 'utf8');
const chartSource = readFileSync(join(sourceRoot, 'components/TokenPriceChart.tsx'), 'utf8');
const styleSource = readFileSync(join(sourceRoot, 'app/styles.css'), 'utf8');

function cssRule(source: string, selector: string) {
	const start = source.indexOf(`\n${selector} {`) + 1;
	expect(start).toBeGreaterThan(0);
	return source.slice(start, source.indexOf('}', start) + 1);
}

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

	it('waits below the fold while the route is loading and returns to view on a settled short page', () => {
		// Settled: header (61px) + main + footer (61px) fill the viewport, so a short page has no scroll.
		expect(cssRule(styleSource, 'main')).toContain('min-height: calc(100dvh - 122px);');
		// Loading: main alone fills the viewport below the header, so arriving cards cannot push a
		// footer that is already painted inside the viewport.
		expect(cssRule(styleSource, "main:has([aria-busy='true'], .loading)")).toContain(
			'min-height: calc(100dvh - 61px);'
		);
		// Desktop Home scrolls inside a fixed frame sized for the footer, so it keeps the settled budget.
		const desktopHome = styleSource.indexOf('\tmain:has(> .home-shell) {');
		expect(desktopHome).toBeGreaterThan(styleSource.indexOf("main:has([aria-busy='true'], .loading) {"));
		expect(styleSource.lastIndexOf('@media (min-width: 1051px) {', desktopHome)).toBeGreaterThan(0);
		expect(cssRule(styleSource, '\tmain:has(> .home-shell)')).toContain('min-height: calc(100dvh - 122px);');
	});

	it('carries the attribution the price chart omits by disabling its logo', () => {
		// Lightweight Charts asks apps that hide the chart logo to link TradingView on a visible page.
		if (!/attributionLogo:\s*false/.test(chartSource)) return;

		expect(shellJsx(appSource)).toContain('<Footer />');
	});
});
