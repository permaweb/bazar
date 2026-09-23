import { describe, expect, it } from 'vitest';

import { BAZAR_APP_MESSAGES } from 'apps/bazar/messages';
import { DEFAULT_LANGUAGE, formatMessage, resolveMessages } from 'helpers/i18n';

import { catalogSourceText, unsuppliedPlaceholders, unusedCatalogKeys } from '../../test-utils/messages';

const source = catalogSourceText('src/apps/bazar');

describe('Bazar app message catalog', () => {
	it('resolves every key for the active language', () => {
		const resolved = resolveMessages(BAZAR_APP_MESSAGES, DEFAULT_LANGUAGE);
		expect(Object.keys(resolved)).toEqual(Object.keys(BAZAR_APP_MESSAGES.en));
		for (const [key, message] of Object.entries(resolved)) expect(message, key).not.toBe('');
	});

	it('is used in full by the application shell', () => {
		expect(unusedCatalogKeys(BAZAR_APP_MESSAGES, source)).toEqual([]);
	});

	it('names only placeholders the application shell supplies', () => {
		expect(unsuppliedPlaceholders(BAZAR_APP_MESSAGES, source)).toEqual([]);
	});

	it('titles a route from its heading', () => {
		expect(formatMessage(BAZAR_APP_MESSAGES.en.appRouteDocumentTitle, { heading: 'Collections' })).toBe(
			'Collections — Bazar'
		);
	});
});
