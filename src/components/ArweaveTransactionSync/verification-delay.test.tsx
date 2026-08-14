import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it } from 'vitest';
import type { ObserverView } from 'weave-wrangler';

import { theme } from 'helpers/theme';
import { LanguageProvider } from 'providers/LanguageProvider';

import { type ArweaveSyncStep, ArweaveTransactionSync } from '.';

const observed = {
	observer: { url: 'https://limited.example', label: 'Limited', source: 'peer', failures: 1 },
	state: 'pending',
	confirmations: 0,
	httpStatus: 429,
	lastSeenAt: 2,
	updatedAt: 2,
	changedAt: 2,
} as ObserverView;

function renderLoader(answering: number, eligible: number, views: ObserverView[] = [observed]) {
	const steps: ArweaveSyncStep[] = [
		{
			key: 'register',
			label: 'Reserve listing',
			target: 5,
			transaction: {
				id: 'R'.repeat(43),
				views,
				consensus: {
					state: 'unknown',
					confirmations: 0,
					answering,
					eligible,
					agreeing: 0,
					quorum: 0,
					best: 0,
					seen: 0,
					propagated: false,
					settled: false,
					updatedAt: 2,
				},
			},
		},
	];

	return renderToStaticMarkup(
		<ThemeProvider theme={theme}>
			<LanguageProvider>
				<ArweaveTransactionSync subject="Asset" steps={steps} />
			</LanguageProvider>
		</ThemeProvider>
	);
}

describe('observer verification delay', () => {
	it('renders the required denominator while a terminal transaction is still confirming', () => {
		const markup = renderToStaticMarkup(
			<ThemeProvider theme={theme}>
				<LanguageProvider>
					<ArweaveTransactionSync
						subject="Asset"
						steps={[
							{
								key: 'list',
								label: 'List for sale',
								target: 5,
								terminal: true,
								confirmations: 1,
								transaction: { id: 'L'.repeat(43), views: [] },
							},
						]}
					/>
				</LanguageProvider>
			</ThemeProvider>
		);

		expect(markup).toContain('aria-label="1 of 5"');
		expect(markup).toContain('>1</strong><span> / 5</span>');
	});

	it('renders terminal confirmation depth without a denominator or cap', () => {
		const markup = renderToStaticMarkup(
			<ThemeProvider theme={theme}>
				<LanguageProvider>
					<ArweaveTransactionSync
						subject="Asset"
						pendingAfterConfirmation="Checking receipt"
						steps={[
							{
								key: 'pay',
								label: 'Pay seller',
								target: 1,
								terminal: true,
								confirmations: 7,
								transaction: { id: 'P'.repeat(43), views: [] },
							},
						]}
					/>
				</LanguageProvider>
			</ThemeProvider>
		);

		expect(markup).toContain('aria-label="7 confirmations"');
		expect(markup).toContain('>7</strong>');
		expect(markup).not.toContain(' / 1');
		expect(markup).toContain('Checking receipt');
	});

	it('replaces a misleading zero count when no observer quorum is available', () => {
		const markup = renderLoader(0, 0);
		expect(markup).toContain('Observers delayed');
		expect(markup).toContain(
			'Observers are currently delayed. Your transaction may still be progressing. Come back soon to see progress.'
		);
		expect(markup).not.toContain('aria-label="0 of 5"');
	});

	it('keeps the real zero count while healthy observers are checking', () => {
		const markup = renderLoader(2, 5);
		expect(markup).toContain('aria-label="0 of 5"');
		expect(markup).not.toContain('Observers delayed');
	});

	it('does not call an untouched transaction delayed before observer responses arrive', () => {
		const markup = renderLoader(0, 0, []);
		expect(markup).toContain('aria-label="0 of 5"');
		expect(markup).not.toContain('Observers delayed');
	});
});
