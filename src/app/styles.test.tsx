import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServerStyleSheet, ThemeProvider } from 'styled-components';
import { describe, expect, it } from 'vitest';

import { darkTheme } from 'helpers/theme';

import { GlobalStyle } from './styles';

describe('GlobalStyle', () => {
	it('publishes the active theme as global CSS variables', () => {
		const sheet = new ServerStyleSheet();

		try {
			renderToStaticMarkup(
				sheet.collectStyles(
					<ThemeProvider theme={darkTheme}>
						<GlobalStyle />
					</ThemeProvider>
				)
			);
			const css = sheet.getStyleTags();

			expect(css).toContain('--paper:#090a0b');
			expect(css).toContain('--surface:#1b1c20');
			expect(css).toContain('--focus-ring:#a0a1ad');
			expect(css).toContain('color-scheme:dark');
		} finally {
			sheet.seal();
		}
	});
});
