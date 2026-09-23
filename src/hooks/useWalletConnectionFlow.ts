import React from 'react';

import type { BrowserWalletId, GeneratedWallet } from 'api/wallet';

import { type AppError, toAppError } from 'helpers/app-error';
import { useWallet } from 'providers/WalletProvider';

const KEYFILE_URL_REVOKE_DELAY_MS = 1000;

export type WalletConnectionAction = BrowserWalletId | 'generate' | 'import';

/** Choosing a wallet (with at most one request pending), or holding a generated keyfile until it is downloaded. */
export type WalletConnectionState =
	| { step: 'choose'; pending: WalletConnectionAction | null; error: AppError | null }
	| { step: 'generated'; wallet: GeneratedWallet; copied: boolean };

export type WalletConnectionEvent =
	| { type: 'started'; action: WalletConnectionAction }
	| { type: 'failed'; error: AppError }
	/** The pending request finished, successfully or not. */
	| { type: 'settled' }
	| { type: 'generated'; wallet: GeneratedWallet }
	| { type: 'copied' }
	/** The user closed the dialog while choosing. */
	| { type: 'dismissed' }
	| { type: 'downloaded' }
	/** The dialog closed; an undownloaded generated keyfile is discarded from view. */
	| { type: 'dialog-closed' };

export const INITIAL_WALLET_CONNECTION_STATE: WalletConnectionState = { step: 'choose', pending: null, error: null };

export function walletConnectionReducer(
	state: WalletConnectionState,
	event: WalletConnectionEvent
): WalletConnectionState {
	switch (event.type) {
		case 'started':
			return state.step === 'choose' ? { step: 'choose', pending: event.action, error: null } : state;
		case 'failed':
			return state.step === 'choose' ? { ...state, error: event.error } : state;
		case 'settled':
			return state.step === 'choose' && state.pending !== null ? { ...state, pending: null } : state;
		case 'generated':
			return { step: 'generated', wallet: event.wallet, copied: false };
		case 'copied':
			return state.step === 'generated' ? { ...state, copied: true } : state;
		case 'dismissed':
			return state.step === 'choose' ? INITIAL_WALLET_CONNECTION_STATE : state;
		case 'downloaded':
		case 'dialog-closed':
			return state.step === 'generated' ? INITIAL_WALLET_CONNECTION_STATE : state;
	}
}

export type WalletConnectionFlow = {
	open: boolean;
	restoreTarget(): HTMLElement | null;
	state: WalletConnectionState;
	/** Closes the dialog unless a generated keyfile still has to be downloaded. */
	close(): void;
	connect(walletId: BrowserWalletId): Promise<void>;
	generate(): Promise<void>;
	/** Imports a keyfile; resolves false when it was rejected so the caller can reset its file input. */
	importKeyfile(file: File): Promise<boolean>;
	copyAddress(): Promise<void>;
	downloadKeyfile(): void;
};

/** Connects a browser wallet, generates a local keyfile, or imports one, from the wallet connection dialog. */
export function useWalletConnectionFlow(): WalletConnectionFlow {
	const wallet = useWallet();
	const [state, dispatch] = React.useReducer(walletConnectionReducer, INITIAL_WALLET_CONNECTION_STATE);
	const open = wallet.connectDialogOpen;
	const closeConnectDialog = wallet.closeConnectDialog;
	const keyfilePending = state.step === 'generated';

	const close = React.useCallback(() => {
		if (keyfilePending) return;
		dispatch({ type: 'dismissed' });
		closeConnectDialog();
	}, [closeConnectDialog, keyfilePending]);

	React.useEffect(() => {
		if (!open) dispatch({ type: 'dialog-closed' });
	}, [open]);

	const connect = async (walletId: BrowserWalletId) => {
		dispatch({ type: 'started', action: walletId });
		try {
			await wallet.connect(walletId);
			closeConnectDialog();
		} catch (cause) {
			dispatch({ type: 'failed', error: toAppError(cause, 'wallet-connection-failed') });
		} finally {
			dispatch({ type: 'settled' });
		}
	};
	const generate = async () => {
		dispatch({ type: 'started', action: 'generate' });
		try {
			dispatch({ type: 'generated', wallet: await wallet.generateLocalWallet() });
		} catch (cause) {
			dispatch({ type: 'failed', error: toAppError(cause, 'wallet-connection-failed') });
		} finally {
			dispatch({ type: 'settled' });
		}
	};
	const importKeyfile = async (file: File) => {
		dispatch({ type: 'started', action: 'import' });
		try {
			await wallet.importLocalWallet(file);
			closeConnectDialog();
			return true;
		} catch (cause) {
			dispatch({ type: 'failed', error: toAppError(cause, 'wallet-connection-failed') });
			return false;
		} finally {
			dispatch({ type: 'settled' });
		}
	};
	const copyAddress = async () => {
		if (state.step !== 'generated') return;
		await navigator.clipboard.writeText(state.wallet.address);
		dispatch({ type: 'copied' });
	};
	const downloadKeyfile = () => {
		if (state.step !== 'generated') return;
		const blob = new Blob([JSON.stringify(state.wallet.jwk, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${state.wallet.address}.json`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), KEYFILE_URL_REVOKE_DELAY_MS);
		dispatch({ type: 'downloaded' });
		closeConnectDialog();
	};

	return {
		open,
		restoreTarget: wallet.connectDialogRestoreTarget,
		state,
		close,
		connect,
		generate,
		importKeyfile,
		copyAddress,
		downloadKeyfile,
	};
}
