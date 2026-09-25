import { defineMessages } from 'helpers/i18n';

export const WALLET_CONNECTION_DIALOG_MESSAGES = defineMessages({
	en: {
		walletConnectTitle: 'Connect wallet',
		walletConnectClose: 'Close wallet options',
		walletConnectGeneratedTitle: 'Keyfile generated',
		walletConnectGeneratedDetail: 'Download this keyfile before closing.',
		walletConnectAddress: 'Address',
		walletConnectCopied: 'Copied',
		walletConnectCopy: 'Copy',
		walletConnectDownload: 'Download keyfile',
		walletConnectKeepSafeTitle: 'Keep this file safe.',
		walletConnectKeepSafeDetail: 'Anyone with it controls the wallet, and it cannot be recovered if lost.',
		walletConnectPermawebOs: 'PermawebOS',
		walletConnectPermawebOsDetail: 'Permaweb wallet extension',
		walletConnectWander: 'Wander',
		walletConnectWanderDetail: 'Browser extension wallet',
		walletConnectGenerateTitle: 'Generate keyfile',
		walletConnectGenerateDetail: 'Create a new local wallet',
		walletConnectImportTitle: 'Import keyfile',
		walletConnectImportDetail: 'Load an existing Arweave keyfile',
		walletConnectConnecting: 'Connecting…',
		walletConnectConnect: 'Connect',
		walletConnectGenerating: 'Generating…',
		walletConnectGenerate: 'Generate',
		walletConnectImporting: 'Importing…',
		walletConnectImport: 'Import',
	},
});

export type WalletConnectionDialogMessages = (typeof WALLET_CONNECTION_DIALOG_MESSAGES)['en'];
