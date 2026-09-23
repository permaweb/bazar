import { defineMessages } from 'helpers/i18n';

export const BAZAR_APP_MESSAGES = defineMessages({
	en: {
		appSkipToContent: 'Skip to marketplace content',
		appMainContent: 'Marketplace content',
		appDocumentTitle: 'Bazar — Arweave-native assets',
		appRouteDocumentTitle: '{heading} — Bazar',
	},
});

export type BazarAppMessages = (typeof BAZAR_APP_MESSAGES)['en'];
