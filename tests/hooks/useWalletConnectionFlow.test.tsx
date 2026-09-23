// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GeneratedWallet } from 'api/wallet';

import { appError } from 'helpers/app-error';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const generated: GeneratedWallet = {
	address: 'G'.repeat(43),
	jwk: { kty: 'RSA', n: 'n', e: 'AQAB' },
} as GeneratedWallet;

const wallet = vi.hoisted(() => ({
	connectDialogOpen: true,
	connect: vi.fn(async (_walletId: string) => undefined),
	generateLocalWallet: vi.fn(async () => generated),
	importLocalWallet: vi.fn(async (_file: File) => undefined),
	closeConnectDialog: vi.fn(),
	connectDialogRestoreTarget: () => null,
}));

vi.mock('providers/WalletProvider', () => ({ useWallet: () => wallet }));

import {
	INITIAL_WALLET_CONNECTION_STATE,
	useWalletConnectionFlow,
	type WalletConnectionFlow,
	walletConnectionReducer,
} from 'hooks/useWalletConnectionFlow';

describe('wallet connection state machine', () => {
	it('clears any error when a new request starts and restores it on failure', () => {
		const failed = walletConnectionReducer(
			walletConnectionReducer(INITIAL_WALLET_CONNECTION_STATE, { type: 'started', action: 'wander' }),
			{ type: 'failed', error: appError('wallet-connection-rejected') }
		);
		expect(failed).toMatchObject({ step: 'choose', pending: 'wander' });

		const settled = walletConnectionReducer(failed, { type: 'settled' });
		expect(settled).toMatchObject({ step: 'choose', pending: null });
		expect(settled.step === 'choose' && settled.error?.reason).toBe('wallet-connection-rejected');
		expect(walletConnectionReducer(settled, { type: 'started', action: 'generate' })).toMatchObject({
			pending: 'generate',
			error: null,
		});
	});

	it('holds a generated keyfile until it is downloaded or the dialog closes', () => {
		const held = walletConnectionReducer(INITIAL_WALLET_CONNECTION_STATE, { type: 'generated', wallet: generated });
		expect(held).toEqual({ step: 'generated', wallet: generated, copied: false });

		expect(walletConnectionReducer(held, { type: 'settled' })).toBe(held);
		expect(walletConnectionReducer(held, { type: 'started', action: 'wander' })).toBe(held);
		expect(walletConnectionReducer(held, { type: 'dismissed' })).toBe(held);
		expect(walletConnectionReducer(held, { type: 'copied' })).toMatchObject({ copied: true });
		expect(walletConnectionReducer(held, { type: 'downloaded' })).toEqual(INITIAL_WALLET_CONNECTION_STATE);
		expect(walletConnectionReducer(held, { type: 'dialog-closed' })).toEqual(INITIAL_WALLET_CONNECTION_STATE);
	});

	it('leaves the chooser untouched when the dialog closes on its own', () => {
		const pending = walletConnectionReducer(INITIAL_WALLET_CONNECTION_STATE, { type: 'started', action: 'import' });
		expect(walletConnectionReducer(pending, { type: 'dialog-closed' })).toBe(pending);
		expect(walletConnectionReducer(pending, { type: 'dismissed' })).toEqual(INITIAL_WALLET_CONNECTION_STATE);
		expect(walletConnectionReducer(INITIAL_WALLET_CONNECTION_STATE, { type: 'settled' })).toBe(
			INITIAL_WALLET_CONNECTION_STATE
		);
	});
});

let root: Root;
let flow: WalletConnectionFlow | undefined;

function Probe() {
	flow = useWalletConnectionFlow();
	return null;
}

function current(): WalletConnectionFlow {
	if (!flow) throw new Error('hook-not-rendered');
	return flow;
}

describe('useWalletConnectionFlow', () => {
	beforeEach(() => {
		root = createRoot(document.createElement('div'));
		flow = undefined;
		wallet.connectDialogOpen = true;
		wallet.connect.mockClear();
		wallet.generateLocalWallet.mockClear();
		wallet.importLocalWallet.mockClear();
		wallet.closeConnectDialog.mockClear();
		React.act(() => root.render(<Probe />));
	});

	afterEach(() => {
		React.act(() => root.unmount());
	});

	it('closes the dialog after a successful connection', async () => {
		await React.act(async () => {
			await current().connect('wander');
		});

		expect(wallet.connect).toHaveBeenCalledWith('wander');
		expect(wallet.closeConnectDialog).toHaveBeenCalledTimes(1);
		expect(current().state).toEqual(INITIAL_WALLET_CONNECTION_STATE);
	});

	it('keeps the dialog open with a safe message when the wallet declines', async () => {
		wallet.connect.mockRejectedValueOnce(appError('wallet-connection-rejected'));

		await React.act(async () => {
			await current().connect('permaweb-os');
		});

		expect(wallet.closeConnectDialog).not.toHaveBeenCalled();
		const state = current().state;
		expect(state).toMatchObject({ step: 'choose', pending: null });
		expect(state.step === 'choose' && state.error?.reason).toBe('wallet-connection-rejected');
	});

	it('reports a rejected keyfile import to the caller', async () => {
		wallet.importLocalWallet.mockRejectedValueOnce(appError('wallet-keyfile-invalid'));
		let imported: boolean | undefined;

		await React.act(async () => {
			imported = await current().importKeyfile(new File(['{}'], 'wallet.json'));
		});

		expect(imported).toBe(false);
		expect(wallet.closeConnectDialog).not.toHaveBeenCalled();

		await React.act(async () => {
			imported = await current().importKeyfile(new File(['{}'], 'wallet.json'));
		});
		expect(imported).toBe(true);
		expect(wallet.closeConnectDialog).toHaveBeenCalledTimes(1);
	});

	it('refuses to close while a generated keyfile has not been downloaded', async () => {
		await React.act(async () => {
			await current().generate();
		});
		expect(current().state).toMatchObject({ step: 'generated', copied: false });

		React.act(() => current().close());
		expect(wallet.closeConnectDialog).not.toHaveBeenCalled();
		expect(current().state.step).toBe('generated');
	});

	it('downloads the keyfile once and then closes the dialog', async () => {
		const createObjectURL = vi.fn(() => 'blob:keyfile');
		const revokeObjectURL = vi.fn();
		URL.createObjectURL = createObjectURL;
		URL.revokeObjectURL = revokeObjectURL;
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

		await React.act(async () => {
			await current().generate();
		});
		React.act(() => current().downloadKeyfile());

		expect(click).toHaveBeenCalledTimes(1);
		expect(createObjectURL).toHaveBeenCalledTimes(1);
		expect(wallet.closeConnectDialog).toHaveBeenCalledTimes(1);
		expect(current().state).toEqual(INITIAL_WALLET_CONNECTION_STATE);

		React.act(() => current().downloadKeyfile());
		expect(click).toHaveBeenCalledTimes(1);
		click.mockRestore();
	});

	it('discards an undownloaded keyfile once the dialog is closed', async () => {
		await React.act(async () => {
			await current().generate();
		});

		wallet.connectDialogOpen = false;
		React.act(() => root.render(<Probe />));

		expect(current().state).toEqual(INITIAL_WALLET_CONNECTION_STATE);
	});
});
