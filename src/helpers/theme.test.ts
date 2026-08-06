import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { darkTheme, dimmedTheme, lightTheme, resolveTheme, themes } from './theme';

describe('appearance themes', () => {
	it('keeps every theme on the current branch theme shape', () => {
		expect(Object.keys(darkTheme.colors)).toEqual(Object.keys(lightTheme.colors));
		expect(Object.keys(dimmedTheme.colors)).toEqual(Object.keys(lightTheme.colors));
		expect(darkTheme.typography).toEqual(lightTheme.typography);
		expect(dimmedTheme.typography).toEqual(lightTheme.typography);
		expect(Object.keys(darkTheme.colors.global)).toEqual(Object.keys(lightTheme.colors.global));
		expect(Object.keys(dimmedTheme.colors.global)).toEqual(Object.keys(lightTheme.colors.global));
	});

	it('shares common color objects across every theme', () => {
		expect(darkTheme.colors.indicator).toBe(lightTheme.colors.indicator);
		expect(dimmedTheme.colors.nasaGraphic).toBe(lightTheme.colors.nasaGraphic);
		expect(darkTheme.colors.stats).toBe(dimmedTheme.colors.stats);
	});

	it('uses the dark and dimmed surfaces from main', () => {
		expect(themes.dark.colors.container.primary.background).toBe('#090a0b');
		expect(themes.dimmed.colors.container.primary.background).toBe('#1a1a1a');
	});

	it('resolves the system option to dark in dark mode', () => {
		expect(resolveTheme('system', true)).toBe('dark');
		expect(resolveTheme('system', false)).toBe('light');
		expect(resolveTheme('dimmed', true)).toBe('dimmed');
	});

	it('keeps color literals in the theme layer instead of the CSS file', () => {
		const css = readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
		const colorLiteral = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|(?:^|[\s:(,])(white|black|transparent)(?=[\s;,)])/im;

		expect(css).not.toMatch(colorLiteral);
	});
});
