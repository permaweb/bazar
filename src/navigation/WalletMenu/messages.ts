import { defineMessages } from 'helpers/i18n';

export const WALLET_MENU_MESSAGES = defineMessages({
	en: {
		walletMenuConnect: 'Connect wallet',
		walletMenuConnectShort: 'Connect',
		walletMenuWallet: 'Wallet {address}',
		walletMenuOptions: 'Wallet options',
		walletMenuConnected: 'Connected wallet',
		walletMenuBalances: 'Balances',
		walletMenuArBalance: 'AR balance',
		walletMenuAoBalance: 'AO balance',
		walletMenuBalance: '{amount} {symbol}',
		walletMenuBalanceLoading: 'Loading…',
		walletMenuBalanceUnavailable: 'Unavailable',
		walletMenuProfile: 'My profile',
		walletMenuCopyAddress: 'Copy address',
		walletMenuCopied: 'Copied',
		walletMenuCopyFailed: 'Address could not be copied.',
		walletMenuAppearance: 'Appearance',
		walletMenuThemeSystem: 'System',
		walletMenuThemeLight: 'Light',
		walletMenuThemeDimmed: 'Dimmed',
		walletMenuThemeDark: 'Dark',
		walletMenuDisconnect: 'Disconnect',
		walletMenuDisconnecting: 'Disconnecting…',
	},
});

export type WalletMenuMessages = (typeof WALLET_MENU_MESSAGES)['en'];
