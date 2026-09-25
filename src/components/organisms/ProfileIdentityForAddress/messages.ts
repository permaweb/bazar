import { defineMessages } from 'helpers/i18n';

export const PROFILE_IDENTITY_FOR_ADDRESS_MESSAGES = defineMessages({
	en: {
		profileIdentityLabel: 'View profile for {name}',
	},
});

export type ProfileIdentityForAddressMessages = (typeof PROFILE_IDENTITY_FOR_ADDRESS_MESSAGES)['en'];
