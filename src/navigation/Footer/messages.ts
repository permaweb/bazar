import { defineMessages } from 'helpers/i18n';

export const FOOTER_MESSAGES = defineMessages({
	en: {
		footerProduct: 'Bazar 2.0',
		/** `{provider}` is replaced by the chart provider link, so the sentence keeps its own word order. */
		footerAttribution: 'Ownership, offers, and settlement live on Arweave. Charts by {provider}.',
		footerChartProvider: 'TradingView',
	},
});

export type FooterMessages = (typeof FOOTER_MESSAGES)['en'];
