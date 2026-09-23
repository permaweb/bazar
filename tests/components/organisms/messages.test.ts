import { describe, expect, it } from 'vitest';

import { CONNECT_WALLET_BUTTON_MESSAGES } from 'components/organisms/ConnectWalletButton/messages';
import { PROFILE_IDENTITY_FOR_ADDRESS_MESSAGES } from 'components/organisms/ProfileIdentityForAddress/messages';
import { WALLET_ADDRESS_MESSAGES } from 'components/organisms/WalletAddress/messages';
import { DEFAULT_LANGUAGE, formatMessage, type MessageCatalog, type Messages, resolveMessages } from 'helpers/i18n';

import { catalogSourceText, unsuppliedPlaceholders, unusedCatalogKeys } from '../../test-utils/messages';

// Shared organisms may read the language provider, so the copy their own markup renders lives beside them.
const CATALOGS: Array<[string, MessageCatalog<Messages>]> = [
	['ConnectWalletButton', CONNECT_WALLET_BUTTON_MESSAGES],
	['ProfileIdentityForAddress', PROFILE_IDENTITY_FOR_ADDRESS_MESSAGES],
	['WalletAddress', WALLET_ADDRESS_MESSAGES],
];

describe.each(CATALOGS)('%s message catalog', (organism, catalog) => {
	const source = catalogSourceText(`src/components/organisms/${organism}`);

	it('resolves every key for the active language', () => {
		const resolved = resolveMessages(catalog, DEFAULT_LANGUAGE);
		expect(Object.keys(resolved)).toEqual(Object.keys(catalog.en));
		for (const [key, message] of Object.entries(resolved)) expect(message, key).not.toBe('');
	});

	it('is used in full by its organism', () => {
		expect(unusedCatalogKeys(catalog, source)).toEqual([]);
	});

	it('names only placeholders its organism supplies', () => {
		expect(unsuppliedPlaceholders(catalog, source)).toEqual([]);
	});
});

describe('wallet address copy announcements', () => {
	it('names the role the caller supplied in every clipboard outcome', () => {
		const messages = WALLET_ADDRESS_MESSAGES.en;
		const address = '1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw';
		expect(formatMessage(messages.walletAddressCopy, { address, label: 'seller' })).toBe(
			`Copy seller address ${address}`
		);
		expect(formatMessage(messages.walletAddressCopied, { label: 'owner' })).toBe('owner address copied.');
		expect(formatMessage(messages.walletAddressCopyFailedAnnouncement, { label: 'holder' })).toBe(
			'Could not copy holder address.'
		);
	});
});
