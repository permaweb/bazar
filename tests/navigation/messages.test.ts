import { describe, expect, it } from 'vitest';

import { DEFAULT_LANGUAGE, formatPlural, type MessageCatalog, type Messages, resolveMessages } from 'helpers/i18n';
import { FOOTER_MESSAGES } from 'navigation/Footer/messages';
import { GATEWAY_CONTROL_MESSAGES } from 'navigation/GatewayControl/messages';
import { HEADER_MESSAGES } from 'navigation/Header/messages';
import { OPERATION_ACTIVITY_CONTROL_MESSAGES } from 'navigation/OperationActivityControl/messages';
import { WALLET_CONNECTION_DIALOG_MESSAGES } from 'navigation/WalletConnectionDialog/messages';
import { WALLET_MENU_MESSAGES } from 'navigation/WalletMenu/messages';

import { catalogSourceText, unsuppliedPlaceholders, unusedCatalogKeys } from '../test-utils/messages';

const CATALOGS: Array<[string, MessageCatalog<Messages>]> = [
	['Footer', FOOTER_MESSAGES],
	['GatewayControl', GATEWAY_CONTROL_MESSAGES],
	['Header', HEADER_MESSAGES],
	['OperationActivityControl', OPERATION_ACTIVITY_CONTROL_MESSAGES],
	['WalletConnectionDialog', WALLET_CONNECTION_DIALOG_MESSAGES],
	['WalletMenu', WALLET_MENU_MESSAGES],
];

describe.each(CATALOGS)('%s message catalog', (component, catalog) => {
	const source = catalogSourceText(`src/navigation/${component}`);

	it('resolves every key for the active language', () => {
		const resolved = resolveMessages(catalog, DEFAULT_LANGUAGE);
		expect(Object.keys(resolved)).toEqual(Object.keys(catalog.en));
		for (const [key, message] of Object.entries(resolved)) {
			if (typeof message === 'string') expect(message, key).not.toBe('');
			else expect([message.one, message.other], key).not.toContain('');
		}
	});

	it('is used in full by its navigation component', () => {
		expect(unusedCatalogKeys(catalog, source)).toEqual([]);
	});

	it('names only placeholders its navigation component supplies', () => {
		expect(unsuppliedPlaceholders(catalog, source)).toEqual([]);
	});
});

describe('navigation plural copy', () => {
	it('counts search results and pending uploads', () => {
		expect(formatPlural(DEFAULT_LANGUAGE, HEADER_MESSAGES.en.headerSearchSummaryCollections, 1)).toBe(
			'1 collection'
		);
		expect(formatPlural(DEFAULT_LANGUAGE, HEADER_MESSAGES.en.headerSearchSummaryAssets, 0)).toBe('0 asset results');
		expect(
			formatPlural(DEFAULT_LANGUAGE, OPERATION_ACTIVITY_CONTROL_MESSAGES.en.operationActivityAttention, 1)
		).toBe('1 upload needs attention');
		expect(
			formatPlural(DEFAULT_LANGUAGE, OPERATION_ACTIVITY_CONTROL_MESSAGES.en.operationActivityAttention, 3)
		).toBe('3 uploads need attention');
	});
});
