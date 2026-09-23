import { defineMessages } from 'helpers/i18n';

export const PROFILE_VIEW_MESSAGES = defineMessages({
	en: {
		profileViewLoading: 'Loading profile…',
	},
});

export type ProfileViewMessages = (typeof PROFILE_VIEW_MESSAGES)['en'];
