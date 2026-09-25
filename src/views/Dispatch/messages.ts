import { defineMessages } from 'helpers/i18n';

export const DISPATCH_VIEW_MESSAGES = defineMessages({
	en: {
		dispatchViewLoading: 'Loading dispatch…',
	},
});

export type DispatchViewMessages = (typeof DISPATCH_VIEW_MESSAGES)['en'];
