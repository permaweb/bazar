import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';

import { theme } from 'helpers/theme';
import { LanguageProvider } from 'providers/LanguageProvider';

import { type ArweaveSyncStep, ArweaveTransactionSync } from '.';

function renderControl(skipKind?: 'yolo' | 'skip', confirmations = 2) {
	const steps: ArweaveSyncStep[] = [
		{
			key: 'register',
			label: 'Reserve listing',
			target: 5,
			confirmations,
			transaction: { id: 'R'.repeat(43), views: [] },
		},
	];
	return renderToStaticMarkup(
		React.createElement(
			ThemeProvider,
			{ theme },
			React.createElement(
				LanguageProvider,
				null,
				React.createElement(ArweaveTransactionSync, {
					subject: 'Asset',
					steps,
					skipKind,
					onSkip: skipKind ? vi.fn() : undefined,
				})
			)
		)
	);
}

describe('purchase skip control', () => {
	it('restores the explicit YOLO action at the early threshold', () => {
		const markup = renderControl('yolo');
		expect(markup).toContain('Continue early?');
		expect(markup).toContain('>YOLO</button>');
		expect(markup).toContain('higher reorganization risk');
		expect(markup).toContain('aria-describedby=');
		expect(markup).toContain('Registration protects you from sending a payment while another user is purchasing');
	});

	it('shows the safer Skip action only when the purchase is eligible', () => {
		expect(renderControl('skip', 4)).toContain('Continue at 4 confirmations');
		expect(renderControl('skip', 4)).toContain('>Skip</button>');
		expect(renderControl()).not.toContain('>YOLO</button>');
		expect(renderControl()).not.toContain('>Skip</button>');
	});
});
