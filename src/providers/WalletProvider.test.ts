import { describe, expect, it, vi } from 'vitest';

import { PERMAWEB_OS_WALLET_PERMISSIONS } from 'api/wallet';

import {
	browserWalletSelection,
	completePrivateJwk,
	connectWallet,
	createLatestAddressCommitter,
	generatedKeyfileBackupStep,
	InvalidLocalWalletError,
	isValidWalletJwk,
	LOCAL_WALLET_UNLOCK_FAILED_MESSAGE,
	localWalletExportJson,
	localWalletReplacementNeedsConfirm,
	localWalletSigningJwk,
	restoreBrowserWalletAddress,
	restoreBrowserWalletAfterDisconnect,
	storedLocalWalletFailureAction,
	subscribeToWalletProviderEvents,
	unlockStoredLocalWallet,
	walletDisconnectPlan,
	walletKindOf,
	walletProviderLoadedAction,
} from './WalletProvider';

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

describe('saved browser wallet unlock', () => {
	const storedWallet = { kty: 'RSA', n: 'public-key', e: 'AQAB', d: 'private-key' } as any;
	const address = 'a'.repeat(43);
	const harness = () => {
		const committed: Array<string | null> = [];
		const requests = createLatestAddressCommitter((next) => committed.push(next));
		const clear = vi.fn();
		return { clear, committed, requests };
	};

	it('keeps the saved keyfile and reports a retryable failure when the Arweave chunk cannot load', async () => {
		const { clear, committed, requests } = harness();
		const result = await unlockStoredLocalWallet(storedWallet, {
			activate: async () => {
				throw new TypeError('Failed to fetch dynamically imported module');
			},
			commit: requests.begin(),
			clear,
		});

		expect(clear).not.toHaveBeenCalled();
		expect(committed).toEqual([null]);
		expect(result).toEqual({
			address: null,
			state: { status: 'failed', message: LOCAL_WALLET_UNLOCK_FAILED_MESSAGE },
		});
	});

	it('connects the saved keyfile on retry after a transient failure', async () => {
		const { clear, committed, requests } = harness();
		const activate = vi
			.fn<(jwk: unknown) => Promise<string>>()
			.mockRejectedValueOnce(new DOMException('crypto.subtle is unavailable', 'NotSupportedError'))
			.mockResolvedValueOnce(address);

		const failed = await unlockStoredLocalWallet(storedWallet, { activate, commit: requests.begin(), clear });
		const retried = await unlockStoredLocalWallet(storedWallet, { activate, commit: requests.begin(), clear });

		expect(failed?.state.status).toBe('failed');
		expect(retried).toEqual({ address, state: { status: 'idle' } });
		expect(committed).toEqual([null, address]);
		expect(clear).not.toHaveBeenCalled();
	});

	it('removes only a keyfile that is itself invalid', async () => {
		const { clear, committed, requests } = harness();
		const result = await unlockStoredLocalWallet(storedWallet, {
			activate: async () => {
				throw new InvalidLocalWalletError(new Error('Could not complete the private RSA keyfile.'));
			},
			commit: requests.begin(),
			clear,
		});

		expect(clear).toHaveBeenCalledTimes(1);
		expect(committed).toEqual([null]);
		expect(result).toEqual({ address: null, state: { status: 'idle' } });
	});

	it('neither clears the keyfile nor changes state when a newer wallet action superseded the unlock', async () => {
		const { clear, committed, requests } = harness();
		const unlock = unlockStoredLocalWallet(storedWallet, {
			activate: async () => {
				throw new InvalidLocalWalletError(new Error('invalid'));
			},
			commit: requests.begin(),
			clear,
		});
		requests.invalidate();

		await expect(unlock).resolves.toBeNull();
		expect(clear).not.toHaveBeenCalled();
		expect(committed).toEqual([]);
	});

	it('classifies a keyfile whose private fields cannot be decoded as invalid, and other errors as transient', () => {
		let thrown: unknown;
		try {
			localWalletSigningJwk({ kty: 'RSA', n: 'AQAB', e: 'AQAB', d: '***' } as any);
		} catch (cause) {
			thrown = cause;
		}
		expect(thrown).toBeInstanceOf(InvalidLocalWalletError);
		expect(storedLocalWalletFailureAction(thrown)).toBe('clear');
		expect(storedLocalWalletFailureAction(new TypeError('Failed to fetch dynamically imported module'))).toBe(
			'keep'
		);
		expect(storedLocalWalletFailureAction(new Error('offline'))).toBe('keep');
	});
});

describe('wallet provider injected after page load', () => {
	const address = 'w'.repeat(43);
	const storedWallet = { kty: 'RSA', n: 'public-key', e: 'AQAB', d: 'private-key' } as any;
	const wander = () => ({
		connect: vi.fn(async () => undefined),
		getActiveAddress: vi.fn(async () => address),
		sign: vi.fn(async (transaction: unknown) => transaction),
	});
	const fakeWindow = () =>
		Object.assign(new EventTarget(), {
			arweaveWallet: undefined as Window['arweaveWallet'],
			permawebConnect: undefined as Window['permawebConnect'],
		});

	it('connects a returning Wander user when the extension announces itself after the mount refresh', async () => {
		const scope = fakeWindow();
		const committed: Array<string | null> = [];
		const requests = createLatestAddressCommitter((next) => committed.push(next));
		const refreshes: Promise<void>[] = [];
		const refreshWallet = vi.fn(() => {
			refreshes.push(restoreBrowserWalletAddress(scope, 'wander', requests.begin()));
		});
		const unsubscribe = subscribeToWalletProviderEvents(scope, {
			readLocalWallet: () => null,
			reactivateLocalWallet: vi.fn(),
			refreshNetworkBalances: vi.fn(),
			refreshWallet,
		});

		await restoreBrowserWalletAddress(scope, 'wander', requests.begin());
		expect(committed).toEqual([null]);

		const injected = wander();
		scope.arweaveWallet = injected;
		scope.dispatchEvent(new Event('arweaveWalletLoaded'));
		await Promise.all(refreshes);

		expect(refreshWallet).toHaveBeenCalledTimes(1);
		expect(committed).toEqual([null, address]);
		expect(scope.arweaveWallet).toBe(injected);
		unsubscribe();
	});

	it('re-activates a saved keyfile instead of switching to Wander when Wander replaces its adapter', () => {
		const scope = fakeWindow();
		const handlers = {
			readLocalWallet: () => storedWallet,
			reactivateLocalWallet: vi.fn(),
			refreshNetworkBalances: vi.fn(),
			refreshWallet: vi.fn(),
		};
		const unsubscribe = subscribeToWalletProviderEvents(scope, handlers);

		scope.arweaveWallet = wander();
		scope.dispatchEvent(new Event('arweaveWalletLoaded'));

		expect(handlers.refreshWallet).not.toHaveBeenCalled();
		expect(handlers.reactivateLocalWallet).toHaveBeenCalledWith(storedWallet);
		unsubscribe();
	});

	it('only refreshes the browser wallet when no saved keyfile is the session', () => {
		expect(walletProviderLoadedAction(null, wander())).toBe('refresh');
		expect(walletProviderLoadedAction(null, undefined)).toBe('refresh');
		expect(walletProviderLoadedAction(storedWallet, wander())).toBe('reactivate-local');
		expect(walletProviderLoadedAction(storedWallet, undefined)).toBe('keep-local');
	});

	it('keeps AO bridge readiness on the balance-only handler and removes every listener on unsubscribe', () => {
		const scope = fakeWindow();
		const handlers = {
			readLocalWallet: () => null,
			reactivateLocalWallet: vi.fn(),
			refreshNetworkBalances: vi.fn(),
			refreshWallet: vi.fn(),
		};
		const unsubscribe = subscribeToWalletProviderEvents(scope, handlers);

		scope.dispatchEvent(new Event('aoFetchLoaded'));
		expect(handlers.refreshNetworkBalances).toHaveBeenCalledTimes(1);
		expect(handlers.refreshWallet).not.toHaveBeenCalled();

		scope.dispatchEvent(new Event('walletSwitch'));
		scope.dispatchEvent(new Event('permawebConnectLoaded'));
		expect(handlers.refreshWallet).toHaveBeenCalledTimes(2);

		unsubscribe();
		for (const event of ['walletSwitch', 'permawebConnectLoaded', 'arweaveWalletLoaded', 'aoFetchLoaded']) {
			scope.dispatchEvent(new Event(event));
		}
		expect(handlers.refreshWallet).toHaveBeenCalledTimes(2);
		expect(handlers.refreshNetworkBalances).toHaveBeenCalledTimes(1);
	});
});

describe('local keyfile forget semantics', () => {
	const address = 'a'.repeat(43);
	const storedKey = { kty: 'RSA', n: 'stored-public', e: 'AQAB', d: 'stored-private' };

	it('asks before removing a local keyfile and erases the stored key only after that', () => {
		const plan = walletDisconnectPlan('local', address);
		expect(plan.confirm).toBe(true);
		expect(plan.clearsKey).toBe(true);
		expect(plan.copy).toContain('Remove keyfile from this browser?');
		expect(plan.copy).toContain(address);
		expect(plan.copy).toContain('downloaded keyfile');
	});

	it('disconnects a browser wallet in one click without touching the stored keyfile', () => {
		for (const kind of ['browser', null] as const) {
			expect(walletDisconnectPlan(kind, address)).toEqual({ confirm: false, clearsKey: false, copy: '' });
		}
	});

	it('records the committed wallet kind, and no kind once disconnected', () => {
		const extension = { connect: async () => undefined, sign: async (transaction: unknown) => transaction };
		expect(walletKindOf(address, extension as Window['arweaveWallet'])).toBe('browser');
		expect(walletKindOf(null, extension as Window['arweaveWallet'])).toBeNull();
		expect(walletKindOf(null, undefined)).toBeNull();
	});

	it('exports the stored keyfile as JSON that round-trips into a valid key', () => {
		const exported = localWalletExportJson(storedKey);
		expect(exported).not.toBeNull();
		const parsed: unknown = JSON.parse(exported!);
		expect(isValidWalletJwk(parsed)).toBe(true);
		expect(parsed).toEqual(storedKey);
	});

	it('has nothing to export when no valid keyfile is stored', () => {
		expect(localWalletExportJson(null)).toBeNull();
		expect(localWalletExportJson({ kty: 'RSA', n: 'public-only', e: 'AQAB' })).toBeNull();
	});

	it('asks before a browser wallet, a new keyfile or a different import replaces a stored key', () => {
		expect(localWalletReplacementNeedsConfirm(storedKey)).toBe(true);
		expect(
			localWalletReplacementNeedsConfirm(storedKey, { ...storedKey, n: 'other-public', d: 'other-private' })
		).toBe(true);
		expect(localWalletReplacementNeedsConfirm(storedKey, { ...storedKey })).toBe(false);
		expect(localWalletReplacementNeedsConfirm(null)).toBe(false);
		expect(localWalletReplacementNeedsConfirm(null, storedKey)).toBe(false);
	});

	it('keeps the generated keyfile panel open after Download until the user confirms the save', () => {
		const beforeDownload = generatedKeyfileBackupStep(false);
		expect(beforeDownload.canFinish).toBe(false);
		expect(beforeDownload.downloadLabel).toBe('Download keyfile');

		const afterDownload = generatedKeyfileBackupStep(true);
		expect(afterDownload.canFinish).toBe(true);
		expect(afterDownload.downloadLabel).toBe('Download again');
		expect(afterDownload.finishLabel).toBe('I saved the keyfile');
		expect(afterDownload.hint).toContain('wallet menu');
	});
});
