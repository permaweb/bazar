import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DefaultTheme, ServerStyleSheet, ThemeProvider } from 'styled-components';
import { describe, expect, it } from 'vitest';

import { darkTheme, dimmedTheme, lightTheme } from 'helpers/theme';
import { LanguageProvider } from 'providers/LanguageProvider';

import { ArweaveTransactionSync } from '.';

const FORK_DAILY = 'At depth 2, forks occur approximately once per day.';

function riskNoteColor(theme: DefaultTheme): string | null {
	const sheet = new ServerStyleSheet();
	try {
		const markup = renderToStaticMarkup(
			sheet.collectStyles(
				<ThemeProvider theme={theme}>
					<LanguageProvider>
						<ArweaveTransactionSync
							subject="Asset"
							steps={[
								{
									key: 'list',
									label: 'List for sale',
									target: 5,
									confirmations: 2,
									transaction: { id: 'L'.repeat(43), views: [] },
								},
							]}
						/>
					</LanguageProvider>
				</ThemeProvider>
			)
		);
		const note = markup.match(new RegExp(`<p class="([^"]+)">${FORK_DAILY.replace(/\./g, '\\.')}</p>`));
		expect(note, 'the depth-2 fork-risk note renders').not.toBeNull();
		const css = sheet.getStyleTags();
		const classes = note![1].split(/\s+/);
		let color: string | null = null;
		for (const name of classes) {
			const rule = css.match(new RegExp(`\\.${name}\\{([^}]*)\\}`));
			const declared = rule?.[1].match(/(?:^|;)color:([^;]+)/);
			if (declared) color = declared[1].trim();
		}
		return color;
	} finally {
		sheet.seal();
	}
}

describe('fork-risk note contrast', () => {
	it.each([
		['light', lightTheme],
		['dimmed', dimmedTheme],
		['dark', darkTheme],
	])('uses the %s theme secondary font colour', (_name, theme) => {
		expect(riskNoteColor(theme)).toBe(theme.colors.font.alt1);
	});
});
