import { describe, expect, it } from 'vitest';

import { DEFAULT_LANGUAGE, type MessageCatalog, type Messages, resolveMessages } from 'helpers/i18n';
import { MARKET_PROVIDER_MESSAGES } from 'providers/MarketProvider/messages';
import { OPERATION_ACTIVITY_MESSAGES } from 'providers/OperationActivityProvider/messages';

import { catalogSourceText, unsuppliedPlaceholders, unusedCatalogKeys } from '../test-utils/messages';

const CATALOGS: Array<[string, MessageCatalog<Messages>]> = [
	['MarketProvider', MARKET_PROVIDER_MESSAGES],
	['OperationActivityProvider', OPERATION_ACTIVITY_MESSAGES],
];

describe.each(CATALOGS)('%s message catalog', (provider, catalog) => {
	const source = catalogSourceText(`src/providers/${provider}`);

	it('resolves every key for the active language', () => {
		const resolved = resolveMessages(catalog, DEFAULT_LANGUAGE);
		expect(Object.keys(resolved)).toEqual(Object.keys(catalog.en));
		for (const [key, message] of Object.entries(resolved)) {
			if (typeof message === 'string') expect(message, key).not.toBe('');
			else expect([message.one, message.other], key).not.toContain('');
		}
	});

	it('is used in full by its provider', () => {
		expect(unusedCatalogKeys(catalog, source)).toEqual([]);
	});

	it('names only placeholders its provider supplies', () => {
		expect(unsuppliedPlaceholders(catalog, source)).toEqual([]);
	});
});
