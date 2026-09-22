import { describe, expect, it, vi } from 'vitest';

import { PERMAWEB_OS_WALLET_PERMISSIONS } from 'api/wallet';
import {
	browserWalletSelection,
	completePrivateJwk,
	connectWallet,
	isValidWalletJwk,
	restoreBrowserWalletAfterDisconnect,
} from 'api/wallet/session';

import { appErrorMessage, toAppError } from 'helpers/app-error';
import { createLatestAddressCommitter } from 'providers/WalletProvider/WalletProvider';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((next) => {
		resolve = next;
	});
	return { promise, resolve };
}

describe('explicit wallet connection', () => {
	it('reports the selected wallet when its provider is unavailable', async () => {
		const failure = await connectWallet(undefined, 'permaweb-os').catch((cause: unknown) =>
			toAppError(cause, 'unknown')
		);
		expect(failure).toMatchObject({ reason: 'permaweb-os-wallet-missing', code: 'unavailable' });
		expect(appErrorMessage(toAppError(failure, 'unknown'))).toBe(
			'Install the PermawebOS wallet extension to continue.'
		);
		await expect(connectWallet(undefined)).rejects.toMatchObject({ reason: 'wander-wallet-missing' });
	});

	it('reports a declined connection neutrally instead of the extension text', async () => {
		const failure = await connectWallet({
			connect: async () => {
				throw new Error('User cancelled the AuthRequest');
			},
			sign: async (transaction) => transaction,
		}).catch((cause: unknown) => toAppError(cause, 'unknown'));
		expect(failure).toMatchObject({ reason: 'wallet-connection-rejected', code: 'rejected' });
		expect(appErrorMessage(toAppError(failure, 'unknown'))).not.toContain('AuthRequest');
	});

	it('returns the active address only after the requested permissions are granted', async () => {
		const connect = vi.fn(async () => undefined);
		const address = 'a'.repeat(43);
		await expect(
			connectWallet({
				connect,
				getActiveAddress: async () => address,
				sign: async (transaction) => transaction,
			})
		).resolves.toBe(address);
		expect(connect).toHaveBeenCalledWith(['ACCESS_ADDRESS', 'ACCESS_PUBLIC_KEY', 'SIGN_TRANSACTION']);
	});

	it('can request token access for PermawebOS without widening every wallet connection', async () => {
		const connect = vi.fn(async () => undefined);
		const address = 'a'.repeat(43);
		await connectWallet(
			{
				connect,
				getActiveAddress: async () => address,
				sign: async (transaction) => transaction,
			},
			'permaweb-os',
			PERMAWEB_OS_WALLET_PERMISSIONS
		);

		expect(connect).toHaveBeenCalledWith([
			'ACCESS_ADDRESS',
			'ACCESS_PUBLIC_KEY',
			'SIGN_TRANSACTION',
			'ACCESS_TOKENS',
		]);
	});

	it('rejects a connection whose active address cannot be read', async () => {
		await expect(
			connectWallet({
				connect: async () => undefined,
				getActiveAddress: async () => {
					throw new Error('locked');
				},
				sign: async (transaction) => transaction,
			})
		).rejects.toMatchObject({ reason: 'wallet-address-unreadable' });
	});

	it('rejects a connection that returns no active address', async () => {
		await expect(
			connectWallet({
				connect: async () => undefined,
				sign: async (transaction) => transaction,
			})
		).rejects.toMatchObject({ reason: 'wallet-address-invalid' });
	});
});

describe('browser wallet provider handoff', () => {
	const wallet = () => ({
		connect: vi.fn(async () => undefined),
		disconnect: vi.fn(async () => undefined),
		getActiveAddress: vi.fn(async () => 'a'.repeat(43)),
		sign: vi.fn(async (transaction: unknown) => transaction),
	});

	it('restores Wander after disconnecting PermawebOS without requiring a reload', () => {
		const wander = wallet();
		const permawebOs = wallet();
		const scope: Pick<Window, 'arweaveWallet' | 'permawebConnect'> = {
			arweaveWallet: wander,
			permawebConnect: permawebOs,
		};

		const permawebSelection = browserWalletSelection(scope, 'permaweb-os');
		expect(permawebSelection).toEqual({ wallet: permawebOs, remembered: wander });
		scope.arweaveWallet = permawebSelection.wallet;

		restoreBrowserWalletAfterDisconnect(scope, permawebOs, permawebOs, permawebSelection.remembered);
		expect(scope.arweaveWallet).toBe(wander);
		expect(browserWalletSelection(scope, 'wander', permawebSelection.remembered).wallet).toBe(wander);
	});

	it('does not overwrite a different provider injected while PermawebOS disconnects', () => {
		const remembered = wallet();
		const reinjected = wallet();
		const permawebOs = wallet();
		const scope: Pick<Window, 'arweaveWallet' | 'permawebConnect'> = {
			arweaveWallet: reinjected,
			permawebConnect: permawebOs,
		};

		restoreBrowserWalletAfterDisconnect(scope, permawebOs, permawebOs, remembered);

		expect(scope.arweaveWallet).toBe(reinjected);
	});
});

describe('wallet address request ordering', () => {
	it('ignores an older address read that resolves after a wallet switch', async () => {
		const addresses: Array<string | null> = [];
		const requests = createLatestAddressCommitter((address) => addresses.push(address));
		const first = deferred<string>();
		const second = deferred<string>();
		const read = async (promise: Promise<string>) => {
			const commit = requests.begin();
			commit(await promise);
		};

		const firstRead = read(first.promise);
		const secondRead = read(second.promise);
		second.resolve('b'.repeat(43));
		await secondRead;
		first.resolve('a'.repeat(43));
		await firstRead;

		expect(addresses).toEqual(['b'.repeat(43)]);
	});

	it('keeps a disconnect after a pending address read resolves', async () => {
		const addresses: Array<string | null> = [];
		const requests = createLatestAddressCommitter((address) => addresses.push(address));
		const pending = deferred<string>();
		const commitPending = requests.begin();
		const pendingRead = pending.promise.then(commitPending);
		const commitDisconnect = requests.begin();

		commitDisconnect(null);
		pending.resolve('a'.repeat(43));
		await pendingRead;

		expect(addresses).toEqual([null]);
	});
});

describe('local Arweave keyfiles', () => {
	it('accepts an RSA private key with the fields Bazar needs to derive and sign', () => {
		expect(isValidWalletJwk({ kty: 'RSA', n: 'public-key', e: 'AQAB', d: 'private-key' })).toBe(true);
	});

	it('rejects public-only and non-RSA wallet files', () => {
		expect(isValidWalletJwk({ kty: 'RSA', n: 'public-key', e: 'AQAB' })).toBe(false);
		expect(isValidWalletJwk({ kty: 'EC', n: 'public-key', e: 'AQAB', d: 'private-key' })).toBe(false);
	});

	it('completes a private RSA key that omits CRT parameters', () => {
		const encoded = (value: number) => {
			const hex = value.toString(16).padStart(Math.ceil(value.toString(16).length / 2) * 2, '0');
			return btoa(
				(hex.match(/.{2}/g) ?? []).map((byte) => String.fromCharCode(parseInt(byte, 16))).join('')
			).replace(/=+$/, '');
		};
		const completed = completePrivateJwk({
			kty: 'RSA',
			n: encoded(61 * 53),
			e: btoa(String.fromCharCode(0, 17)).replace(/=+$/, ''),
			d: encoded(2753),
		} as any);
		expect(['p', 'q', 'dp', 'dq', 'qi'].every((field) => typeof (completed as any)[field] === 'string')).toBe(true);
		expect(completed.e).toBe(encoded(17));
	});
});
