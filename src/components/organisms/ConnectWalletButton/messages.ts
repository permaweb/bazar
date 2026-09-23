import { defineMessages } from 'helpers/i18n';

export const CONNECT_WALLET_BUTTON_MESSAGES = defineMessages({
	en: {
		connectWallet: 'Connect wallet',
	},
});

export type ConnectWalletButtonMessages = (typeof CONNECT_WALLET_BUTTON_MESSAGES)['en'];
