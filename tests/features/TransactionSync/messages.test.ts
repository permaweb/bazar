import { describe, expect, it } from 'vitest';

import { TRANSACTION_SYNC_MESSAGES } from 'features/TransactionSync/messages';
import { DEFAULT_LANGUAGE, formatPlural, resolveMessages } from 'helpers/i18n';

import { catalogSourceText, unsuppliedPlaceholders, unusedCatalogKeys } from '../../test-utils/messages';

const source = catalogSourceText('src/features/TransactionSync');

describe('transaction sync message catalog', () => {
	it('resolves every key for the active language', () => {
		const resolved = resolveMessages(TRANSACTION_SYNC_MESSAGES, DEFAULT_LANGUAGE);
		expect(Object.keys(resolved)).toEqual(Object.keys(TRANSACTION_SYNC_MESSAGES.en));
		for (const [key, message] of Object.entries(resolved)) {
			if (typeof message === 'string') expect(message, key).not.toBe('');
			else expect([message.one, message.other], key).not.toContain('');
		}
	});

	it('is used in full by the feature', () => {
		expect(unusedCatalogKeys(TRANSACTION_SYNC_MESSAGES, source)).toEqual([]);
	});

	it('names only placeholders the feature supplies', () => {
		expect(unsuppliedPlaceholders(TRANSACTION_SYNC_MESSAGES, source)).toEqual([]);
	});

	it('counts confirmations in the depth announcement', () => {
		const message = TRANSACTION_SYNC_MESSAGES.en.transactionSyncConfirmationCount;
		expect(formatPlural(DEFAULT_LANGUAGE, message, 1)).toBe('1 confirmation');
		expect(formatPlural(DEFAULT_LANGUAGE, message, 6)).toBe('6 confirmations');
	});
});
