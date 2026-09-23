import { defineMessages } from 'helpers/i18n';

export const CREATE_VIEW_MESSAGES = defineMessages({
	en: {
		createViewLoading: 'Loading creator…',
	},
});

export type CreateViewMessages = (typeof CREATE_VIEW_MESSAGES)['en'];
