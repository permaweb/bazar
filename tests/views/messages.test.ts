import { describe, expect, it } from 'vitest';

import { DEFAULT_LANGUAGE, type MessageCatalog, type Messages, resolveMessages } from 'helpers/i18n';
import { CREATE_VIEW_MESSAGES } from 'views/Create/messages';
import { DISPATCH_VIEW_MESSAGES } from 'views/Dispatch/messages';
import { PROFILE_VIEW_MESSAGES } from 'views/Profile/messages';

import { catalogSourceText, unsuppliedPlaceholders, unusedCatalogKeys } from '../test-utils/messages';

const CATALOGS: Array<[string, MessageCatalog<Messages>]> = [
	['Create', CREATE_VIEW_MESSAGES],
	['Dispatch', DISPATCH_VIEW_MESSAGES],
	['Profile', PROFILE_VIEW_MESSAGES],
];

describe.each(CATALOGS)('%s view message catalog', (view, catalog) => {
	const source = catalogSourceText(`src/views/${view}`);

	it('resolves every key for the active language', () => {
		const resolved = resolveMessages(catalog, DEFAULT_LANGUAGE);
		expect(Object.keys(resolved)).toEqual(Object.keys(catalog.en));
		for (const [key, message] of Object.entries(resolved)) expect(message, key).not.toBe('');
	});

	it('is used in full by its view', () => {
		expect(unusedCatalogKeys(catalog, source)).toEqual([]);
	});

	it('names only placeholders its view supplies', () => {
		expect(unsuppliedPlaceholders(catalog, source)).toEqual([]);
	});
});
