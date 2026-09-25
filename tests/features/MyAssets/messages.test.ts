import { describe, expect, it } from 'vitest';

import { MY_ASSETS_MESSAGES } from 'features/MyAssets/messages';
import { DEFAULT_LANGUAGE, resolveMessages } from 'helpers/i18n';

import { catalogSourceText, unsuppliedPlaceholders, unusedCatalogKeys } from '../../test-utils/messages';

const source = catalogSourceText('src/features/MyAssets');

describe('My assets message catalog', () => {
	it('resolves every key for the active language', () => {
		const resolved = resolveMessages(MY_ASSETS_MESSAGES, DEFAULT_LANGUAGE);
		expect(Object.keys(resolved)).toEqual(Object.keys(MY_ASSETS_MESSAGES.en));
		for (const [key, message] of Object.entries(resolved)) {
			if (typeof message === 'string') expect(message, key).not.toBe('');
			else expect([message.one, message.other], key).not.toContain('');
		}
	});

	it('is used in full by the feature', () => {
		expect(unusedCatalogKeys(MY_ASSETS_MESSAGES, source)).toEqual([]);
	});

	it('names only placeholders the feature supplies', () => {
		expect(unsuppliedPlaceholders(MY_ASSETS_MESSAGES, source)).toEqual([]);
	});
});
