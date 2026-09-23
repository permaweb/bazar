import { defineMessages } from 'helpers/i18n';

export const WALLET_ADDRESS_MESSAGES = defineMessages({
	en: {
		walletAddressCopy: 'Copy {label} address {address}',
		walletAddressCopyFailed: 'Copy failed',
		walletAddressCopied: '{label} address copied.',
		walletAddressCopyFailedAnnouncement: 'Could not copy {label} address.',
	},
});

export type WalletAddressMessages = (typeof WALLET_ADDRESS_MESSAGES)['en'];
