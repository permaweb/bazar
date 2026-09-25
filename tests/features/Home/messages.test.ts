import { describe, expect, it } from 'vitest';

import { HOME_MESSAGES } from 'features/Home/messages';
import { DEFAULT_LANGUAGE, resolveMessages } from 'helpers/i18n';

import { catalogUsage, missingKeys, unsuppliedPlaceholders, unusedValues } from '../../test-utils/message-catalog';

const messages = resolveMessages(HOME_MESSAGES, DEFAULT_LANGUAGE);
const usage = catalogUsage('src/features/Home');

describe('Home messages', () => {
	it('defines every message the feature reads', () => {
		expect(usage.keys.length).toBeGreaterThan(0);
		expect(missingKeys(usage, messages)).toEqual([]);
	});

	it('names the same placeholders the feature passes', () => {
		expect(unsuppliedPlaceholders(usage, messages)).toEqual([]);
		expect(unusedValues(usage, messages)).toEqual([]);
	});

	it('keeps no entry the feature never renders', () => {
		expect(Object.keys(messages).filter((key) => !usage.keys.includes(key))).toEqual([]);
	});
});
