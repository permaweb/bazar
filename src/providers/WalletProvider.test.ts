import { describe, expect, it, vi } from 'vitest';

import { PERMAWEB_OS_WALLET_PERMISSIONS } from 'api/wallet';

import { dialogRestoreTarget } from '../app/useDialogFocus';

import {
	addressCopyFeedback,
	browserWalletConnectLabel,
	browserWalletSelection,
	completePrivateJwk,
	connectBrowserWalletFlow,
	connectDialogRestoreFallback,
	connectWallet,
	copyText,
	createLatestAddressCommitter,
	disconnectBrowserWallet,
	generatedKeyfileBackupStep,
	IDLE_WALLET_BALANCES,
	InvalidLocalWalletError,
	isValidWalletJwk,
	LOCAL_WALLET_UNLOCK_FAILED_MESSAGE,
	type LocalWalletActivation,
	localWalletExportJson,
	localWalletReplacementNeedsConfirm,
	localWalletSigningJwk,
	restoreBrowserWalletAddress,
	restoreBrowserWalletAfterDisconnect,
	storedLocalWalletFailureAction,
	subscribeToWalletProviderEvents,
	subscribeWalletBalanceRefresh,
	unlockStoredLocalWallet,
	type WalletBalanceState,
	walletBalanceTransition,
	walletConnectionState,
	walletDialogClosesForAddress,
	walletDialogDismissible,
	walletDialogPhase,
	walletDisconnectPlan,
	walletKindOf,
	walletProviderLoadedAction,
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

	it('focuses Download keyfile when the generated panel opens, then I saved the keyfile once downloaded', () => {
		expect(generatedKeyfileBackupStep(false).initialFocus).toBe('download');
		expect(generatedKeyfileBackupStep(true).initialFocus).toBe('finish');
	});
});

describe('generated address copy', () => {
	const address = 'a'.repeat(43);

	it('reports copied when the clipboard accepts the address', async () => {
		const writeText = vi.fn(async () => undefined);
		await expect(copyText(address, writeText)).resolves.toBe('copied');
		expect(writeText).toHaveBeenCalledWith(address);
	});

	it('reports failed instead of rejecting when the clipboard denies or throws', async () => {
		await expect(copyText(address, async () => Promise.reject(new Error('denied')))).resolves.toBe('failed');
		await expect(
			copyText(address, () => {
				throw new TypeError('no clipboard');
			})
		).resolves.toBe('failed');
	});

	it('reports failed when the browser exposes no clipboard, as in an insecure context', async () => {
		vi.stubGlobal('navigator', {});
		try {
			await expect(copyText(address)).resolves.toBe('failed');
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('shows Copy failed and announces how to recover, and announces nothing while idle', () => {
		expect(addressCopyFeedback('idle')).toEqual({ label: 'Copy', status: '' });
		expect(addressCopyFeedback('copied')).toEqual({ label: 'Copied', status: 'Address copied.' });
		const failed = addressCopyFeedback('failed');
		expect(failed.label).toBe('Copy failed');
		expect(failed.status).toContain('could not be copied');
	});
});

describe('browser wallet connect buttons', () => {
	it('gives each Connect button a wallet-specific name while keeping the short visible text', () => {
		expect(browserWalletConnectLabel('permaweb-os', null)).toEqual({ text: 'Connect', name: 'Connect PermawebOS' });
		expect(browserWalletConnectLabel('wander', null)).toEqual({ text: 'Connect', name: 'Connect Wander' });
	});

	it('names only the pending wallet as connecting', () => {
		expect(browserWalletConnectLabel('wander', 'wander')).toEqual({
			text: 'Connecting…',
			name: 'Connecting Wander…',
		});
		expect(browserWalletConnectLabel('permaweb-os', 'wander').name).toBe('Connect PermawebOS');
	});
});

describe('connect wallet dialog phases', () => {
	const generated = { address: 'a'.repeat(43), jwk: { kty: 'RSA', n: 'n', e: 'AQAB', d: 'd' } };

	it('derives one phase from the pending action and the generated key', () => {
		expect(walletDialogPhase(null, null)).toBe('choosing');
		expect(walletDialogPhase('wander', null)).toBe('connecting');
		expect(walletDialogPhase('permaweb-os', null)).toBe('connecting');
		expect(walletDialogPhase('generate', null)).toBe('generating');
		expect(walletDialogPhase('import', null)).toBe('importing');
		expect(walletDialogPhase(null, generated)).toBe('backup');
	});

	it('cannot be dismissed while a local key is generated, imported or waiting for backup', () => {
		expect(walletDialogDismissible('generate', null)).toBe(false);
		expect(walletDialogDismissible('import', null)).toBe(false);
		expect(walletDialogDismissible(null, generated)).toBe(false);
	});

	it('stays dismissible while choosing and while a browser extension prompt is pending', () => {
		expect(walletDialogDismissible(null, null)).toBe(true);
		expect(walletDialogDismissible('wander', null)).toBe(true);
		expect(walletDialogDismissible('permaweb-os', null)).toBe(true);
	});

	it('treats a saved-keyfile unlock retry as a dismissible connect', () => {
		expect(walletDialogPhase('unlock', null)).toBe('connecting');
		expect(walletDialogDismissible('unlock', null)).toBe(true);
	});

	it('closes itself when a restore commits an address while the user is still choosing', () => {
		const address = 'b'.repeat(43);
		expect(walletDialogClosesForAddress('choosing', null, address)).toBe(true);
		expect(walletDialogClosesForAddress('choosing', null, null)).toBe(false);
		expect(walletDialogClosesForAddress('choosing', address, address)).toBe(false);
		for (const phase of ['connecting', 'generating', 'importing', 'backup'] as const) {
			expect(walletDialogClosesForAddress(phase, null, address)).toBe(false);
		}
	});

	it('returns focus to the header wallet button when the in-page Connect button has unmounted', () => {
		const element = (connected: boolean) =>
			({
				isConnected: connected,
				hidden: false,
				disabled: false,
				inert: false,
				parentElement: null,
				getAttribute: () => null,
				getClientRects: () => (connected ? [{}] : []),
			} as unknown as HTMLElement);
		const detachedTrigger = element(false);
		const headerButton = element(true);
		const querySelector = vi.fn((selector: string) => (selector === '.wallet-menu .wallet' ? headerButton : null));

		const fallback = connectDialogRestoreFallback({ querySelector } as unknown as ParentNode);

		expect(fallback).toBe(headerButton);
		expect(dialogRestoreTarget(detachedTrigger, fallback)).toBe(headerButton);
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
		const install = vi.fn();
		const activate = vi
			.fn<(jwk: unknown) => Promise<LocalWalletActivation>>()
			.mockRejectedValueOnce(new DOMException('crypto.subtle is unavailable', 'NotSupportedError'))
			.mockResolvedValueOnce({ address, install });

		const failed = await unlockStoredLocalWallet(storedWallet, { activate, commit: requests.begin(), clear });
		const retried = await unlockStoredLocalWallet(storedWallet, { activate, commit: requests.begin(), clear });

		expect(failed?.state.status).toBe('failed');
		expect(retried).toEqual({ address, state: { status: 'idle' } });
		expect(committed).toEqual([null, address]);
		expect(install).toHaveBeenCalledTimes(1);
		expect(clear).not.toHaveBeenCalled();
	});

	it('does not install the keyfile signer when a newer wallet action superseded a successful unlock', async () => {
		const { clear, committed, requests } = harness();
		const install = vi.fn();
		const activation = deferred<LocalWalletActivation>();
		const unlock = unlockStoredLocalWallet(storedWallet, {
			activate: () => activation.promise,
			commit: requests.begin(),
			clear,
		});
		requests.begin()('b'.repeat(43));
		activation.resolve({ address, install });

		await expect(unlock).resolves.toBeNull();
		expect(install).not.toHaveBeenCalled();
		expect(committed).toEqual(['b'.repeat(43)]);
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

describe('wallet connection status', () => {
	const address = 'a'.repeat(43);
	const wallet = (activeAddress: () => Promise<string>) => ({
		connect: vi.fn(async () => undefined),
		disconnect: vi.fn(async () => undefined),
		getActiveAddress: vi.fn(activeAddress),
		sign: vi.fn(async (transaction: unknown) => transaction),
	});
	const harness = () => {
		const committed: Array<string | null> = [];
		const requests = createLatestAddressCommitter((next) => committed.push(next));
		return { committed, requests };
	};

	it('reads restoring until the first commit or the grace period, then connected or disconnected', () => {
		expect(walletConnectionState(false, null)).toBe('restoring');
		expect(walletConnectionState(true, null)).toBe('disconnected');
		expect(walletConnectionState(true, address)).toBe('connected');
		expect(walletConnectionState(false, address)).toBe('connected');
	});

	it('still commits an in-flight restore when an explicit connect is cancelled', async () => {
		const { committed, requests } = harness();
		const read = deferred<string>();
		const wander = wallet(() => read.promise);
		const scope: Pick<Window, 'arweaveWallet' | 'permawebConnect'> = { arweaveWallet: wander };
		const install = vi.fn();

		const restore = restoreBrowserWalletAddress(scope, 'wander', requests.begin());
		await expect(
			connectBrowserWalletFlow(
				requests,
				async () => {
					throw new Error('User cancelled the connection.');
				},
				install
			)
		).rejects.toThrow('User cancelled');
		read.resolve(address);
		await restore;

		expect(committed).toEqual([address]);
		expect(install).not.toHaveBeenCalled();
		expect(scope.arweaveWallet).toBe(wander);
	});

	it('neither commits nor reinstalls a restore that resolves after a successful connect', async () => {
		const { committed, requests } = harness();
		const read = deferred<string>();
		const restoring = wallet(() => read.promise);
		const chosen = wallet(async () => 'c'.repeat(43));
		const scope: Pick<Window, 'arweaveWallet' | 'permawebConnect'> = { arweaveWallet: restoring };

		const restore = restoreBrowserWalletAddress(scope, 'wander', requests.begin());
		await expect(
			connectBrowserWalletFlow(
				requests,
				async () => 'c'.repeat(43),
				() => {
					scope.arweaveWallet = chosen;
				}
			)
		).resolves.toBe(true);
		read.resolve(address);
		await restore;

		expect(committed).toEqual(['c'.repeat(43)]);
		expect(scope.arweaveWallet).toBe(chosen);
	});

	it('forgets the browser wallet even when the extension rejects disconnect', async () => {
		const { committed, requests } = harness();
		const locked = wallet(async () => address);
		locked.disconnect.mockRejectedValueOnce(new Error('Wallet is locked'));
		const scope: Pick<Window, 'arweaveWallet' | 'permawebConnect'> = { arweaveWallet: locked };
		const clearPreference = vi.fn();

		await expect(disconnectBrowserWallet(scope, { commit: requests.begin(), clearPreference })).resolves.toBe(
			'unconfirmed'
		);

		expect(locked.disconnect).toHaveBeenCalledTimes(1);
		expect(clearPreference).toHaveBeenCalledTimes(1);
		expect(committed).toEqual([null]);
	});

	it('hands back the remembered Wander after a rejected PermawebOS disconnect, and confirms a clean one', async () => {
		const { committed, requests } = harness();
		const wander = wallet(async () => address);
		const permawebOs = wallet(async () => 'p'.repeat(43));
		permawebOs.disconnect.mockRejectedValueOnce(new Error('bridge offline'));
		const scope: Pick<Window, 'arweaveWallet' | 'permawebConnect'> = {
			arweaveWallet: permawebOs,
			permawebConnect: permawebOs,
		};
		const clearPreference = vi.fn();

		await expect(
			disconnectBrowserWallet(scope, { commit: requests.begin(), clearPreference, remembered: () => wander })
		).resolves.toBe('unconfirmed');
		expect(scope.arweaveWallet).toBe(wander);

		await expect(disconnectBrowserWallet(scope, { commit: requests.begin(), clearPreference })).resolves.toBe(
			'disconnected'
		);
		expect(clearPreference).toHaveBeenCalledTimes(2);
		expect(committed).toEqual([null, null]);
	});
});
