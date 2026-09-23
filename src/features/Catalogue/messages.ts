import { defineMessages } from 'helpers/i18n';

export const CATALOGUE_MESSAGES = defineMessages({
	en: {
		tokenTickerFallback: 'Token',
		catalogueArtworkUnavailable: 'Artwork unavailable',
		catalogueAudioArtworkLabel: '{name} {format} audio',
		catalogueAudioArtworkType: 'Audio',
		catalogueTokenArtworkSubtitle: 'Arweave-native',
	},
});

export type CatalogueMessages = (typeof CATALOGUE_MESSAGES)['en'];
