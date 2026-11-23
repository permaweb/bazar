import { describe, expect, it, vi } from 'vitest';

import { PERMAWEB_OS_WALLET_PERMISSIONS } from 'api/wallet';

import {
	browserWalletSelection,
	completePrivateJwk,
	connectWallet,
	createLatestAddressCommitter,
	IDLE_WALLET_BALANCES,
	isValidWalletJwk,
	restoreBrowserWalletAfterDisconnect,
	subscribeWalletBalanceRefresh,
	type WalletBalanceState,
	walletBalanceTransition,
} from './WalletProvider';

describe('wallet balance state machine', () => {
	const address = 'a'.repeat(43);
	const other = 'b'.repeat(43);
	const AR = 1_000_000_000_000n;
	const ready = (ar: bigint, ao?: bigint): WalletBalanceState => ({
		ar: { balance: ar, denomination: 12, status: 'ready' },
		ao: ao === undefined ? IDLE_WALLET_BALANCES.ao : { balance: ao, denomination: 12, status: 'ready' },
	});

	it('starts loading with no value when a wallet connects', () => {
		const loading = walletBalanceTransition(IDLE_WALLET_BALANCES, { address, previousAddress: null });
		expect(loading.ar).toEqual({ balance: null, denomination: 12, status: 'loading' });
		expect(loading.ao.status).toBe('idle');
		expect(
			walletBalanceTransition(loading, {
				address,
				previousAddress: null,
				result: { ar: { atomicBalance: 5n * AR, denomination: 12 } },
			})
		).toEqual(ready(5n * AR));
	});

	it('keeps the last balance visible while a same-address refresh is pending, then shows the new one', () => {
		const pending = walletBalanceTransition(ready(5n * AR, 3n), { address, previousAddress: address });
		expect(pending).toEqual(ready(5n * AR, 3n));
		expect(
			walletBalanceTransition(pending, {
				address,
				previousAddress: address,
				result: {
					ar: { atomicBalance: 4n * AR, denomination: 12 },
					ao: { atomicBalance: 2n, denomination: 12 },
				},
			})
		).toEqual(ready(4n * AR, 2n));
	});

	it('does not replace a known balance with an error from a background refresh', () => {
		expect(
			walletBalanceTransition(ready(5n * AR, 3n), {
				address,
				previousAddress: address,
				result: { ar: { atomicBalance: null, denomination: 12, error: 'timeout' } },
			})
		).toEqual(ready(5n * AR, 3n));
	});

	it('clears balances and starts loading when the address changes', () => {
		const switched = walletBalanceTransition(ready(5n * AR, 3n), { address: other, previousAddress: address });
		expect(switched.ar).toEqual({ balance: null, denomination: 12, status: 'loading' });
		expect(switched.ao).toEqual(IDLE_WALLET_BALANCES.ao);
		expect(
			walletBalanceTransition(switched, {
				address: other,
				previousAddress: address,
				result: { ar: { atomicBalance: null, denomination: 12 } },
			}).ar.status
		).toBe('error');
	});

	it('lets an Unavailable balance recover through a refresh', () => {
		const failed: WalletBalanceState = {
			ar: { balance: null, denomination: 12, status: 'error' },
			ao: { balance: null, denomination: 12, status: 'error' },
		};
		const retrying = walletBalanceTransition(failed, { address, previousAddress: address });
		expect(retrying.ar.status).toBe('loading');
		expect(retrying.ao.status).toBe('loading');
		expect(
			walletBalanceTransition(retrying, {
				address,
				previousAddress: address,
				result: {
					ar: { atomicBalance: 5n * AR, denomination: 12 },
					ao: { atomicBalance: 7n, denomination: 12 },
				},
			})
		).toEqual(ready(5n * AR, 7n));
	});

	it('returns to idle when the wallet disconnects', () => {
		expect(walletBalanceTransition(ready(5n * AR), { address: null, previousAddress: address })).toEqual(
			IDLE_WALLET_BALANCES
		);
	});
});

describe('wallet balance refresh events', () => {
	it('re-reads balances when an App-tracked operation finishes or AO fetch loads, until unsubscribed', () => {
		const target = new EventTarget();
		const refresh = vi.fn();
		const unsubscribe = subscribeWalletBalanceRefresh(target, refresh);

		target.dispatchEvent(new CustomEvent('bazar:asset-operation-finished', { detail: 'asset-id' }));
		target.dispatchEvent(new Event('aoFetchLoaded'));
		expect(refresh).toHaveBeenCalledTimes(2);

		unsubscribe();
		target.dispatchEvent(new CustomEvent('bazar:asset-operation-finished', { detail: 'asset-id' }));
		expect(refresh).toHaveBeenCalledTimes(2);
	});
});

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((next) => {
		resolve = next;
	});
	return { promise, resolve };
}

describe('explicit wallet connection', () => {
	it('reports the selected wallet when its provider is unavailable', async () => {
		await expect(connectWallet(undefined, 'PermawebOS')).rejects.toThrow(
			'Install the PermawebOS wallet extension to continue.'
		);
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
			'PermawebOS',
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
		).rejects.toThrow('active address could not be read');
	});

	it('rejects a connection that returns no active address', async () => {
		await expect(
			connectWallet({
				connect: async () => undefined,
				sign: async (transaction) => transaction,
			})
		).rejects.toThrow('no valid active address');
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
