import { defineMessages } from 'helpers/i18n';

export const MARKET_PROVIDER_MESSAGES = defineMessages({
	en: {
		marketCollectionIndexUnavailable: '{label} is unavailable. Loaded gateway-backed collections remain usable.',
		marketBundledIndexesNotice:
			'The latest Arweave references for {collections} could not be checked. Showing their bundled immutable indexes; ownership, listings, and prices are still read from live state.',
		marketCollectionIndexRefreshFailed:
			'Collection indexes could not be refreshed: {error}. Previously loaded collections remain available.',
		marketCollectionListSeparator: ', ',
		/** Display copy for the local collection of assets minted in this browser. */
		marketCreatedCollectionName: 'Created on Bazar',
		marketCreatedCollectionDescription: 'One-of-one media minted permanently through Bazar.',
	},
});

export type MarketProviderMessages = (typeof MARKET_PROVIDER_MESSAGES)['en'];
