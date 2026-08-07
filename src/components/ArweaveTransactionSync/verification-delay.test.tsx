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
