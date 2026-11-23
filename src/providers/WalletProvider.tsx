import React from 'react';
import { Check, CircleAlert, Copy, Download, FileUp, KeyRound, Wallet, X } from 'lucide-react';

import type { JWKInterface } from 'arweave/web/lib/wallet';

import {
	BROWSER_WALLET_PERMISSIONS,
	type BrowserWalletId,
	PERMAWEB_OS_WALLET_PERMISSIONS,
	readVisibleWalletBalances,
	resolveBrowserWallet,
	restoreBrowserWalletConnection,
} from 'api/wallet';

import { Button } from 'components/Button';
import { createArweaveClient } from 'helpers/arweave';
import { setAoWalletConnection } from 'helpers/config';

import { useDialogFocus } from '../app/useDialogFocus';

type WalletJwk = JWKInterface;

type GeneratedWallet = {
	address: string;
	jwk: WalletJwk;
};

/** `unlock` retries the keyfile saved in this browser; like a browser connect it adds no key. */
type WalletDialogAction = BrowserWalletId | 'generate' | 'import' | 'unlock' | null;

/**
 * The connect dialog's phase, derived from its pending action and generated key. `backup` holds a
 * freshly generated key that has not been confirmed as saved. Exposed as `data-phase` on the dialog.
 */
export type WalletDialogPhase = 'choosing' | 'connecting' | 'generating' | 'importing' | 'backup';

/** Result of the generated-address Copy button. `copied` and `failed` fall back to `idle` after a moment. */
export type AddressCopyState = 'idle' | 'copied' | 'failed';

const COPY_FEEDBACK_MS = 2000;

/**
 * Where the connected wallet's key lives. `local` means Bazar holds the only stored copy of the
 * private key in this browser's localStorage, so disconnecting it erases the key. `browser` means an
 * extension (Wander, PermawebOS) holds the key and disconnecting only ends the session.
 */
export type WalletKind = 'local' | 'browser';

/** Unlock state of the local keyfile saved in this browser. */
export type LocalWalletUnlockState =
	| { status: 'idle' }
	| { status: 'unlocking' }
	| { status: 'failed'; message: string };

export const LOCAL_WALLET_UNLOCK_FAILED_MESSAGE =
	'Saved browser wallet could not be unlocked. Its keyfile is still saved in this browser. Check your connection and retry.';

/**
 * Whether Bazar knows the wallet session yet. `restoring` lasts from mount until the first address
 * commit (a restore, connect, import or generate) or WALLET_RESTORE_GRACE_MS, whichever comes first,
 * so a returning user is never shown "Connect" while their wallet is still being read.
 */
export type WalletConnectionStatus = 'restoring' | 'disconnected' | 'connected';

/** Upper bound on `restoring`, so a locked or slow extension cannot leave the wallet button busy. */
export const WALLET_RESTORE_GRACE_MS = 4_000;

/** How disconnect ended: the user kept a local keyfile, Bazar disconnected, or Bazar disconnected but the extension failed. */
export type WalletDisconnectResult = 'kept' | 'disconnected' | 'unconfirmed';

export const WALLET_DISCONNECT_UNCONFIRMED_MESSAGE =
	'Bazar disconnected; the wallet extension did not confirm — you may also disconnect in the extension.';

type WalletContextValue = {
	address: string | null;
	connectionStatus: WalletConnectionStatus;
	walletKind: WalletKind | null;
	localWalletUnlock: LocalWalletUnlockState;
	/** Retries unlocking the saved browser keyfile; resolves true once it is connected. */
	retryLocalWalletUnlock(): Promise<boolean>;
	arBalance: bigint | null;
	arBalanceDenomination: number;
	arBalanceStatus: 'idle' | 'loading' | 'ready' | 'error';
	aoBalance: bigint | null;
	aoBalanceDenomination: number;
	aoBalanceStatus: 'idle' | 'loading' | 'ready' | 'error';
	connect(walletId: BrowserWalletId): Promise<void>;
	/** Always ends Bazar's session unless the user chose to keep a local keyfile wallet ('kept'). */
	disconnect(): Promise<WalletDisconnectResult>;
	/** Downloads the stored local keyfile. Returns false when no keyfile is stored in this browser. */
	exportLocalWallet(): boolean;
	generateLocalWallet(): Promise<GeneratedWallet>;
	importLocalWallet(file: File): Promise<void>;
	openConnectDialog(trigger?: HTMLElement | null): void;
	loadDevelopmentWallet?(file: File): Promise<void>;
};

const ARWEAVE_ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const LOCAL_WALLET_KEY = 'bazar:local-wallet';
const BROWSER_WALLET_KEY = 'bazar:browser-wallet';
const LEGACY_PERMAWEB_OS_WALLET_ID = 'the-fold';
const LOCAL_WALLET_ADAPTER = Symbol('bazar-local-wallet-adapter');

const WalletContext = React.createContext<WalletContextValue | null>(null);
let rememberedBrowserWallet: Window['arweaveWallet'];

export function WalletProvider({ children }: React.PropsWithChildren) {
	const [address, setAddress] = React.useState<string | null>(null);
	const [restored, setRestored] = React.useState(false);
	const [walletKind, setWalletKind] = React.useState<WalletKind | null>(null);
	const [arBalance, setArBalance] = React.useState<bigint | null>(null);
	const [arBalanceDenomination, setArBalanceDenomination] = React.useState(12);
	const [arBalanceStatus, setArBalanceStatus] = React.useState<WalletContextValue['arBalanceStatus']>('idle');
	const [aoBalance, setAoBalance] = React.useState<bigint | null>(null);
	const [aoBalanceDenomination, setAoBalanceDenomination] = React.useState(12);
	const [aoBalanceStatus, setAoBalanceStatus] = React.useState<WalletContextValue['aoBalanceStatus']>('idle');
	const [balanceRevision, setBalanceRevision] = React.useState(0);
	const [connectDialogOpen, setConnectDialogOpen] = React.useState(false);
	const [localWalletUnlock, setLocalWalletUnlock] = React.useState<LocalWalletUnlockState>({ status: 'idle' });
	const connectDialogTrigger = React.useRef<HTMLElement | null>(null);
	const addressRequests = React.useRef(
		createLatestAddressCommitter((nextAddress) => {
			setAoWalletConnection(nextAddress);
			setAddress(nextAddress);
			setRestored(true);
			// A current commit runs its install (window.arweaveWallet) just before this callback, so
			// this reads the adapter that produced nextAddress.
			setWalletKind(walletKindOf(nextAddress, window.arweaveWallet));
		})
	);
	const closeConnectDialog = React.useCallback(() => setConnectDialogOpen(false), []);
	const restoreConnectDialogFocus = React.useCallback(() => connectDialogTrigger.current, []);

	const refresh = React.useCallback(
		() => restoreBrowserWalletAddress(window, readBrowserWalletPreference(), addressRequests.current.begin()),
		[]
	);

	const unlockLocalWallet = React.useCallback(async (storedWallet: WalletJwk) => {
		const unlocking: LocalWalletUnlockState = { status: 'unlocking' };
		setLocalWalletUnlock(unlocking);
		const next = await unlockStoredLocalWallet(storedWallet, {
			activate: prepareLocalWallet,
			commit: addressRequests.current.begin(),
			clear: clearLocalWallet,
		});
		if (!next) {
			// Superseded by a newer wallet action: settle only if no newer unlock replaced this one.
			setLocalWalletUnlock((current) => (current === unlocking ? { status: 'idle' } : current));
			return false;
		}
		setLocalWalletUnlock(next.state);
		return next.address !== null;
	}, []);

	React.useEffect(() => {
		const restoreGrace = window.setTimeout(() => setRestored(true), WALLET_RESTORE_GRACE_MS);
		return () => window.clearTimeout(restoreGrace);
	}, []);

	React.useEffect(() => {
		let cancelled = false;
		void installDevelopmentWallet().then(() => {
			if (cancelled) return;
			const storedWallet = readLocalWallet();
			if (storedWallet) {
				void unlockLocalWallet(storedWallet);
			} else {
				void refresh();
			}
		});
		const refreshWallet = () => {
			setBalanceRevision((revision) => revision + 1);
			void refresh();
		};
		const unsubscribe = subscribeToWalletProviderEvents(window, {
			readLocalWallet,
			reactivateLocalWallet: (storedWallet) => void unlockLocalWallet(storedWallet),
			refreshNetworkBalances: () => setBalanceRevision((revision) => revision + 1),
			refreshWallet,
		});
		return () => {
			cancelled = true;
			unsubscribe();
			addressRequests.current.invalidate();
		};
	}, [refresh, unlockLocalWallet]);

	React.useEffect(() => {
		setArBalance(null);
		setAoBalance(null);
		if (!address) {
			setArBalanceStatus('idle');
			setAoBalanceStatus('idle');
			return;
		}

		const controller = new AbortController();
		setArBalanceStatus('loading');
		setAoBalanceStatus('idle');
		void readVisibleWalletBalances(address, { signal: controller.signal }).then((balances) => {
			if (controller.signal.aborted) return;
			setArBalance(balances.ar.atomicBalance);
			setArBalanceDenomination(balances.ar.denomination);
			setArBalanceStatus(balances.ar.atomicBalance === null ? 'error' : 'ready');
			setAoBalance(balances.ao?.atomicBalance ?? null);
			setAoBalanceDenomination(balances.ao?.denomination ?? 12);
			setAoBalanceStatus(balances.ao ? (balances.ao.atomicBalance === null ? 'error' : 'ready') : 'idle');
		});
		return () => controller.abort();
	}, [address, balanceRevision]);

	const value = React.useMemo<WalletContextValue>(
		() => ({
			address,
			connectionStatus: walletConnectionState(restored, address),
			walletKind,
			localWalletUnlock,
			retryLocalWalletUnlock: async () => {
				const storedWallet = readLocalWallet();
				if (!storedWallet) {
					setLocalWalletUnlock({ status: 'idle' });
					return false;
				}
				return unlockLocalWallet(storedWallet);
			},
			arBalance,
			arBalanceDenomination,
			arBalanceStatus,
			aoBalance,
			aoBalanceDenomination,
			aoBalanceStatus,
			connect: async (walletId) => {
				confirmLocalWalletReplacement();
				const wallet = browserWallet(walletId);
				const committed = await connectBrowserWalletFlow(
					addressRequests.current,
					() =>
						connectWallet(
							wallet,
							walletId === 'permaweb-os' ? 'PermawebOS' : 'Wander',
							walletId === 'permaweb-os' ? PERMAWEB_OS_WALLET_PERMISSIONS : BROWSER_WALLET_PERMISSIONS
						),
					() => {
						clearLocalWallet();
						window.arweaveWallet = wallet;
						storeBrowserWalletPreference(walletId);
					}
				);
				if (committed) setLocalWalletUnlock({ status: 'idle' });
				setBalanceRevision((revision) => revision + 1);
			},
			disconnect: async () => {
				const disconnectedWallet = window.arweaveWallet;
				const plan = walletDisconnectPlan(isLocalWallet(disconnectedWallet) ? 'local' : 'browser', address);
				if (plan.confirm && !window.confirm(plan.copy)) return 'kept';
				const commit = addressRequests.current.begin();
				if (plan.clearsKey) {
					clearLocalWallet();
					setLocalWalletUnlock({ status: 'idle' });
					restoreBrowserWallet();
					clearBrowserWalletPreference();
					commit(null);
					return 'disconnected';
				}
				return disconnectBrowserWallet(window, {
					commit,
					clearPreference: clearBrowserWalletPreference,
					remembered: () => rememberedBrowserWallet,
				});
			},
			exportLocalWallet: () => {
				const keyfile = localWalletExportJson(readLocalWallet());
				if (!keyfile) return false;
				downloadKeyfile(keyfile, `${address ?? 'arweave-keyfile'}.json`);
				return true;
			},
			generateLocalWallet: async () => {
				confirmLocalWalletReplacement();
				const arweave = await createArweaveClient();
				const jwk = (await arweave.wallets.generate()) as unknown as WalletJwk;
				if (!isValidWalletJwk(jwk)) throw new Error('The generated Arweave keyfile was invalid.');
				storeLocalWallet(jwk);
				const commit = addressRequests.current.begin();
				const activation = await prepareLocalWallet(jwk);
				if (commit(activation.address, activation.install)) setLocalWalletUnlock({ status: 'idle' });
				return { address: activation.address, jwk };
			},
			importLocalWallet: async (file: File) => {
				let jwk: unknown;
				try {
					jwk = JSON.parse(await file.text());
				} catch {
					throw new Error('Choose a valid Arweave JSON keyfile.');
				}
				if (!isValidWalletJwk(jwk)) throw new Error('Choose a valid Arweave JSON keyfile.');
				confirmLocalWalletReplacement(jwk);
				storeLocalWallet(jwk);
				const commit = addressRequests.current.begin();
				const activation = await prepareLocalWallet(jwk);
				if (commit(activation.address, activation.install)) setLocalWalletUnlock({ status: 'idle' });
			},
			openConnectDialog: (trigger) => {
				connectDialogTrigger.current =
					trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
				setConnectDialogOpen(true);
			},
			...(import.meta.env.DEV
				? {
						loadDevelopmentWallet: async (file: File) => {
							const wallet = JSON.parse(await file.text());
							if (!isValidWalletJwk(wallet)) throw new Error('Invalid Arweave JWK.');
							localStorage.setItem('bazar:e2e-wallet', JSON.stringify(wallet));
							window.location.reload();
						},
				  }
				: {}),
		}),
		[
			address,
			aoBalance,
			aoBalanceDenomination,
			aoBalanceStatus,
			arBalance,
			arBalanceDenomination,
			arBalanceStatus,
			localWalletUnlock,
			restored,
			unlockLocalWallet,
			walletKind,
		]
	);

	return (
		<WalletContext.Provider value={value}>
			{children}
			<WalletConnectionDialog
				onClose={closeConnectDialog}
				open={connectDialogOpen}
				restoreTarget={restoreConnectDialogFocus}
			/>
		</WalletContext.Provider>
	);
}

export function useWallet() {
	const value = React.useContext(WalletContext);
	if (!value) throw new Error('wallet-provider-missing');
	return value;
}

function WalletConnectionDialog({
	onClose,
	open,
	restoreTarget,
}: {
	onClose(): void;
	open: boolean;
	restoreTarget(): HTMLElement | null;
}) {
	const wallet = useWallet();
	const fileInput = React.useRef<HTMLInputElement>(null);
	const [action, setAction] = React.useState<WalletDialogAction>(null);
	const [error, setError] = React.useState('');
	const [generatedWallet, setGeneratedWallet] = React.useState<GeneratedWallet | null>(null);
	const [copyState, setCopyState] = React.useState<AddressCopyState>('idle');
	const copyResetTimer = React.useRef<number | null>(null);
	const [generatedWalletDownloaded, setGeneratedWalletDownloaded] = React.useState(false);
	// Each open or close starts a new session. A browser connect stays dismissible because an
	// extension prompt can wait forever, so its late result must not close or mark up a later session.
	const session = React.useRef(0);
	const addressAtOpen = React.useRef<string | null>(null);
	const phase = walletDialogPhase(action, generatedWallet);
	const dismissible = walletDialogDismissible(action, generatedWallet);
	const close = React.useCallback(() => {
		if (!dismissible) return;
		setError('');
		setAction(null);
		onClose();
	}, [dismissible, onClose]);
	const dialogRef = useDialogFocus<HTMLDivElement>(
		open,
		close,
		restoreTarget,
		generatedWallet?.address,
		connectDialogRestoreFallback
	);
	const clearCopyResetTimer = React.useCallback(() => {
		if (copyResetTimer.current === null) return;
		window.clearTimeout(copyResetTimer.current);
		copyResetTimer.current = null;
	}, []);
	React.useEffect(() => clearCopyResetTimer, [clearCopyResetTimer]);

	React.useEffect(() => {
		session.current += 1;
		addressAtOpen.current = open ? wallet.address : null;
		setAction(null);
		setError('');
		clearCopyResetTimer();
		setCopyState('idle');
		setGeneratedWallet(null);
		setGeneratedWalletDownloaded(false);
	}, [open]);

	React.useEffect(() => {
		if (open && walletDialogClosesForAddress(phase, addressAtOpen.current, wallet.address)) onClose();
	}, [open, phase, wallet.address]);

	if (!open) return null;

	const connectBrowserWallet = async (walletId: BrowserWalletId) => {
		const started = session.current;
		setAction(walletId);
		setError('');
		try {
			await wallet.connect(walletId);
			if (started === session.current) onClose();
		} catch (cause) {
			if (started === session.current) setError(walletErrorMessage(cause));
		} finally {
			if (started === session.current) setAction(null);
		}
	};
	const generate = async () => {
		setAction('generate');
		setError('');
		try {
			setGeneratedWallet(await wallet.generateLocalWallet());
		} catch (cause) {
			setError(walletErrorMessage(cause));
		} finally {
			setAction(null);
		}
	};
	const importWallet = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const input = event.currentTarget;
		const file = input.files?.[0];
		if (!file) return;
		setAction('import');
		setError('');
		try {
			await wallet.importLocalWallet(file);
			onClose();
		} catch (cause) {
			setError(walletErrorMessage(cause));
			input.value = '';
		} finally {
			setAction(null);
		}
	};
	// The retry stays dismissible like a browser connect, so it is scoped to the session that started it.
	const retryLocalWalletUnlock = async () => {
		const started = session.current;
		setAction('unlock');
		setError('');
		try {
			if ((await wallet.retryLocalWalletUnlock()) && started === session.current) onClose();
		} finally {
			if (started === session.current) setAction(null);
		}
	};
	const unlockFailure = wallet.localWalletUnlock.status === 'failed' ? wallet.localWalletUnlock.message : null;
	// A browser cannot report whether a download was saved or cancelled, so starting the download
	// only moves the panel to its "downloaded" step; the user closes it with an explicit confirmation.
	const downloadGeneratedWallet = () => {
		if (!generatedWallet) return;
		const keyfile = localWalletExportJson(generatedWallet.jwk);
		if (!keyfile) return;
		downloadKeyfile(keyfile, `${generatedWallet.address}.json`);
		setGeneratedWalletDownloaded(true);
	};
	const finishGeneratedWallet = () => {
		setGeneratedWallet(null);
		setGeneratedWalletDownloaded(false);
		onClose();
	};
	const copyGeneratedAddress = async () => {
		if (!generatedWallet) return;
		const started = session.current;
		const result = await copyText(generatedWallet.address);
		if (started !== session.current) return;
		clearCopyResetTimer();
		setCopyState(result);
		copyResetTimer.current = window.setTimeout(() => {
			copyResetTimer.current = null;
			setCopyState('idle');
		}, COPY_FEEDBACK_MS);
	};
	const backup = generatedKeyfileBackupStep(generatedWalletDownloaded);
	const copyFeedback = addressCopyFeedback(copyState);
	const permawebOsLabel = browserWalletConnectLabel('permaweb-os', action);
	const wanderLabel = browserWalletConnectLabel('wander', action);

	return (
		<div
			className="dialog-backdrop wallet-connect-backdrop"
			onMouseDown={(event) => event.target === event.currentTarget && close()}
			role="presentation"
		>
			<div
				aria-labelledby="wallet-connect-title"
				aria-modal="true"
				className="dialog dialog-compact wallet-connect-dialog"
				data-phase={phase}
				ref={dialogRef}
				role="dialog"
				tabIndex={-1}
			>
				<div className="dialog-heading wallet-connect-heading">
					<div>
						<h2 id="wallet-connect-title">Connect wallet</h2>
					</div>
					<Button
						aria-label="Close wallet options"
						className="close"
						disabled={!dismissible}
						onClick={close}
						size="icon"
						type="button"
						variant="ghost"
					>
						<X aria-hidden="true" />
					</Button>
				</div>
				{generatedWallet ? (
					<div className="generated-wallet-panel">
						<div>
							<KeyRound className="ui-icon" aria-hidden="true" />
							<div>
								<strong>Keyfile generated</strong>
								<span aria-live="polite">{backup.hint}</span>
							</div>
						</div>
						<div className="generated-wallet-address">
							<div>
								<span>Address</span>
								<code>{generatedWallet.address}</code>
							</div>
							<Button
								aria-label="Copy address"
								className="with-icon"
								onClick={() => void copyGeneratedAddress()}
								type="button"
								size="custom"
							>
								{copyState === 'copied' ? (
									<Check className="ui-icon ui-icon--sm" aria-hidden="true" />
								) : copyState === 'failed' ? (
									<CircleAlert className="ui-icon ui-icon--sm" aria-hidden="true" />
								) : (
									<Copy className="ui-icon ui-icon--sm" aria-hidden="true" />
								)}
								<span>{copyFeedback.label}</span>
							</Button>
							<span className="sr-only" aria-live="polite" role="status">
								{copyFeedback.status}
							</span>
						</div>
						<Button
							aria-describedby="wallet-keyfile-warning"
							className="wide with-icon"
							data-dialog-initial={backup.initialFocus === 'download' || undefined}
							onClick={downloadGeneratedWallet}
							type="button"
							size="custom"
							variant={backup.canFinish ? undefined : 'primary'}
						>
							<Download className="ui-icon ui-icon--sm" aria-hidden="true" />
							{backup.downloadLabel}
						</Button>
						{backup.canFinish ? (
							<Button
								className="wide with-icon"
								data-dialog-initial={backup.initialFocus === 'finish' || undefined}
								onClick={finishGeneratedWallet}
								type="button"
								size="custom"
								variant="primary"
							>
								<Check className="ui-icon ui-icon--sm" aria-hidden="true" />
								{backup.finishLabel}
							</Button>
						) : null}
						<p className="wallet-keyfile-warning" id="wallet-keyfile-warning">
							<strong>Keep this file safe.</strong> Anyone with it controls the wallet, and it cannot be
							recovered if lost.
						</p>
					</div>
				) : (
					<>
						<div className="wallet-option-list">
							{unlockFailure || action === 'unlock' ? (
								<div
									className="wallet-option"
									data-local-wallet-unlock={wallet.localWalletUnlock.status}
								>
									<div className="wallet-option-copy">
										<KeyRound className="ui-icon" aria-hidden="true" />
										<div>
											<strong>Saved browser wallet</strong>
											<span role="alert">{unlockFailure ?? 'Unlocking the saved keyfile…'}</span>
										</div>
									</div>
									<Button
										onClick={() => void retryLocalWalletUnlock()}
										disabled={action !== null}
										type="button"
										size="custom"
										variant="primary"
									>
										{action === 'unlock' ? 'Retrying…' : 'Retry'}
									</Button>
								</div>
							) : null}
							<div className="wallet-option">
								<div className="wallet-option-copy">
									<Wallet className="ui-icon" aria-hidden="true" />
									<div>
										<strong>PermawebOS</strong>
										<span>Permaweb wallet extension</span>
									</div>
								</div>
								<Button
									aria-label={permawebOsLabel.name}
									data-dialog-initial
									onClick={() => void connectBrowserWallet('permaweb-os')}
									disabled={action !== null}
									type="button"
									size="custom"
									variant="primary"
								>
									{permawebOsLabel.text}
								</Button>
							</div>
							<div className="wallet-option">
								<div className="wallet-option-copy">
									<Wallet className="ui-icon" aria-hidden="true" />
									<div>
										<strong>Wander</strong>
										<span>Browser extension wallet</span>
									</div>
								</div>
								<Button
									aria-label={wanderLabel.name}
									onClick={() => void connectBrowserWallet('wander')}
									disabled={action !== null}
									type="button"
									size="custom"
									variant="primary"
								>
									{wanderLabel.text}
								</Button>
							</div>
							<div className="wallet-option">
								<div className="wallet-option-copy">
									<KeyRound className="ui-icon" aria-hidden="true" />
									<div>
										<strong>Generate keyfile</strong>
										<span>Create a new local wallet</span>
									</div>
								</div>
								<Button
									onClick={() => void generate()}
									disabled={action !== null}
									type="button"
									size="custom"
								>
									{action === 'generate' ? 'Generating…' : 'Generate'}
								</Button>
							</div>
							<div className="wallet-option">
								<div className="wallet-option-copy">
									<FileUp className="ui-icon" aria-hidden="true" />
									<div>
										<strong>Import keyfile</strong>
										<span>Load an existing Arweave keyfile</span>
									</div>
								</div>
								<Button
									onClick={() => fileInput.current?.click()}
									disabled={action !== null}
									type="button"
									size="custom"
								>
									{action === 'import' ? 'Importing…' : 'Import'}
								</Button>
								<input
									ref={fileInput}
									hidden
									type="file"
									accept=".json,application/json"
									onChange={importWallet}
								/>
							</div>
						</div>
						{error ? (
							<p className="wallet-connect-error" role="alert">
								{error}
							</p>
						) : null}
					</>
				)}
			</div>
		</div>
	);
}

export async function connectWallet(
	wallet: Window['arweaveWallet'],
	walletName = 'Wander',
	permissions: readonly string[] = BROWSER_WALLET_PERMISSIONS
) {
	if (!wallet) {
		const installationName = `the ${walletName}`;
		throw new Error(`Install ${installationName} wallet extension to continue.`);
	}
	await wallet.connect([...permissions]);
	let address: string | undefined;
	try {
		address = await wallet.getActiveAddress?.();
	} catch {
		throw new Error(
			'The wallet connected, but its active address could not be read. Unlock or reconnect the wallet and try again.'
		);
	}
	if (!address || !ARWEAVE_ADDRESS.test(address)) {
		throw new Error(
			'The wallet connected, but no valid active address was returned. Unlock or reconnect the wallet and try again.'
		);
	}
	return address;
}

/**
 * Commits one wallet request's address only while it is still the latest one. `install` carries the
 * request's side effects (such as assigning window.arweaveWallet) and runs only for a current commit,
 * right before it, so a request that lost the race changes nothing.
 */
export type AddressCommit = (address: string | null, install?: () => void) => boolean;

export function createLatestAddressCommitter(commit: (address: string | null) => void) {
	let latest = 0;
	return {
		begin(): AddressCommit {
			const request = ++latest;
			return (address, install) => {
				if (request !== latest) return false;
				install?.();
				commit(address);
				return true;
			};
		},
		invalidate() {
			latest += 1;
		},
	};
}

/** Reads the active browser-wallet address and commits it, or null when no provider is connected yet. */
export async function restoreBrowserWalletAddress(
	scope: Pick<Window, 'arweaveWallet' | 'permawebConnect'>,
	preferredWalletId: BrowserWalletId | null,
	commit: AddressCommit
) {
	try {
		const connection = await restoreBrowserWalletConnection(scope, preferredWalletId);
		commit(
			connection?.address ?? null,
			connection
				? () => {
						scope.arweaveWallet = connection.wallet;
				  }
				: undefined
		);
	} catch {
		commit(null);
	}
}

export function walletConnectionState(restored: boolean, address: string | null): WalletConnectionStatus {
	if (address) return 'connected';
	return restored ? 'disconnected' : 'restoring';
}

/**
 * Runs an explicit browser-wallet connect. The request starts only once the extension approved, so a
 * cancelled or failed popup leaves any in-flight restore free to commit; a successful connect supersedes
 * it, and the stale restore then neither commits nor reassigns window.arweaveWallet.
 */
export async function connectBrowserWalletFlow(
	requests: { begin(): AddressCommit },
	connect: () => Promise<string>,
	install: () => void
) {
	const address = await connect();
	return requests.begin()(address, install);
}

/**
 * Ends Bazar's side of a browser-wallet session. The extension's own disconnect is best effort: when it
 * rejects (a locked or erroring extension), Bazar still restores the provider, forgets the preference
 * and commits null, and reports 'unconfirmed' so the user can also disconnect in the extension.
 */
export async function disconnectBrowserWallet(
	scope: Pick<Window, 'arweaveWallet' | 'permawebConnect'>,
	{
		commit,
		clearPreference,
		remembered,
	}: {
		commit: AddressCommit;
		clearPreference(): void;
		/** Read after the extension call settles, like the provider's remembered browser wallet. */
		remembered?(): Window['arweaveWallet'];
	}
): Promise<Exclude<WalletDisconnectResult, 'kept'>> {
	const disconnectedWallet = scope.arweaveWallet;
	const permawebOs = resolveBrowserWallet(scope, 'permaweb-os');
	let confirmed = true;
	try {
		await disconnectedWallet?.disconnect?.();
	} catch {
		confirmed = false;
	}
	restoreBrowserWalletAfterDisconnect(scope, disconnectedWallet, permawebOs, remembered?.());
	clearPreference();
	commit(null);
	return confirmed ? 'disconnected' : 'unconfirmed';
}

/** Provider handshakes after which the active wallet address is read again. */
export const WALLET_REFRESH_EVENTS = ['walletSwitch', 'permawebConnectLoaded'] as const;
/** Fired by Wander/ArConnect once window.arweaveWallet is injected, which may be after page load. */
export const WALLET_PROVIDER_LOADED_EVENT = 'arweaveWalletLoaded';
/** Fired when the AO fetch bridge is ready; only balances depend on it. */
export const NETWORK_BALANCES_LOADED_EVENT = 'aoFetchLoaded';

/**
 * What a late Wander injection means for the current session:
 * - refresh: no keyfile is saved, so read the browser wallet's address again.
 * - reactivate-local: a saved keyfile is the session, but the injection replaced its adapter.
 * - keep-local: a saved keyfile is the session and nothing replaced it.
 */
export type WalletProviderLoadedAction = 'refresh' | 'reactivate-local' | 'keep-local';

export function walletProviderLoadedAction(
	storedLocalWallet: WalletJwk | null,
	currentWallet: Window['arweaveWallet']
): WalletProviderLoadedAction {
	if (!storedLocalWallet) return 'refresh';
	return currentWallet && !isLocalWallet(currentWallet) ? 'reactivate-local' : 'keep-local';
}

/** Subscribes the wallet session to provider events on `scope`; returns the unsubscribe. */
export function subscribeToWalletProviderEvents(
	scope: EventTarget & Pick<Window, 'arweaveWallet'>,
	handlers: {
		readLocalWallet(): WalletJwk | null;
		reactivateLocalWallet(storedWallet: WalletJwk): void;
		refreshNetworkBalances(): void;
		refreshWallet(): void;
	}
) {
	const refreshWallet = () => handlers.refreshWallet();
	const refreshNetworkBalances = () => handlers.refreshNetworkBalances();
	const providerLoaded = () => {
		const storedWallet = handlers.readLocalWallet();
		const action = walletProviderLoadedAction(storedWallet, scope.arweaveWallet);
		if (action === 'refresh') handlers.refreshWallet();
		else if (action === 'reactivate-local' && storedWallet) handlers.reactivateLocalWallet(storedWallet);
	};
	for (const event of WALLET_REFRESH_EVENTS) scope.addEventListener(event, refreshWallet);
	scope.addEventListener(WALLET_PROVIDER_LOADED_EVENT, providerLoaded);
	scope.addEventListener(NETWORK_BALANCES_LOADED_EVENT, refreshNetworkBalances);
	return () => {
		for (const event of WALLET_REFRESH_EVENTS) scope.removeEventListener(event, refreshWallet);
		scope.removeEventListener(WALLET_PROVIDER_LOADED_EVENT, providerLoaded);
		scope.removeEventListener(NETWORK_BALANCES_LOADED_EVENT, refreshNetworkBalances);
	};
}

export function isValidWalletJwk(value: unknown): value is WalletJwk {
	return Boolean(
		value &&
			typeof value === 'object' &&
			(value as WalletJwk).kty === 'RSA' &&
			typeof (value as WalletJwk).n === 'string' &&
			(value as WalletJwk).n &&
			typeof (value as WalletJwk).e === 'string' &&
			(value as WalletJwk).e &&
			typeof (value as WalletJwk).d === 'string' &&
			(value as WalletJwk).d
	);
}

export const LOCAL_WALLET_KEPT_MESSAGE = 'Kept the keyfile wallet stored in this browser.';

export function walletKindOf(address: string | null, wallet: Window['arweaveWallet']): WalletKind | null {
	if (!address) return null;
	return isLocalWallet(wallet) ? 'local' : 'browser';
}

/**
 * What disconnecting a wallet of this kind does. A local keyfile wallet is removed from this browser,
 * which erases the only stored copy of its key, so it asks first. A browser wallet only ends the session
 * and never touches the stored local keyfile.
 */
export function walletDisconnectPlan(kind: WalletKind | null, address?: string | null) {
	return kind === 'local'
		? { confirm: true, clearsKey: true, copy: localWalletForgetCopy('remove', address) }
		: { confirm: false, clearsKey: false, copy: '' };
}

export function localWalletForgetCopy(reason: 'remove' | 'replace', address?: string | null) {
	const wallet = address ? `the wallet ${address}` : 'that wallet';
	return reason === 'remove'
		? `Remove keyfile from this browser?\n\nThe private key for ${wallet} is stored only in this browser. After removal you can only restore it from a downloaded keyfile. Choose Cancel, then Download keyfile, if you have not saved it.`
		: `Replace the keyfile wallet stored in this browser?\n\nIts private key is stored only in this browser and will be erased. You can only restore ${wallet} from a downloaded keyfile. Choose Cancel to keep it.`;
}

/** True when storing `incoming` (or connecting a browser wallet, when omitted) would erase a different stored key. */
export function localWalletReplacementNeedsConfirm(stored: unknown, incoming?: WalletJwk | null) {
	return isValidWalletJwk(stored) && (!incoming || stored.n !== incoming.n);
}

/** The keyfile download for a stored local wallet, or null when nothing valid is stored. */
export function localWalletExportJson(wallet: unknown): string | null {
	return isValidWalletJwk(wallet) ? JSON.stringify(wallet, null, 2) : null;
}

/**
 * The backup panel's step. `initialFocus` names the control that takes focus when the panel opens:
 * Download keyfile, the only way out of the panel, rather than the first control (Copy).
 */
export function generatedKeyfileBackupStep(downloaded: boolean) {
	return downloaded
		? {
				hint: 'Check that the keyfile saved, then continue. You can download it again later from the wallet menu.',
				downloadLabel: 'Download again',
				finishLabel: 'I saved the keyfile',
				canFinish: true,
				initialFocus: 'finish' as const,
		  }
		: {
				hint: 'Download this keyfile before closing.',
				downloadLabel: 'Download keyfile',
				finishLabel: 'I saved the keyfile',
				canFinish: false,
				initialFocus: 'download' as const,
		  };
}

/**
 * Copies text to the clipboard and reports the outcome instead of rejecting. The clipboard is missing
 * in insecure contexts and writes can be denied by permissions, so both resolve to `failed`.
 */
export async function copyText(
	text: string,
	writeText: (text: string) => Promise<void> = (value) => navigator.clipboard.writeText(value)
): Promise<Exclude<AddressCopyState, 'idle'>> {
	try {
		await writeText(text);
		return 'copied';
	} catch {
		return 'failed';
	}
}

/** The generated-address Copy button's visible label and the status announced for each copy state. */
export function addressCopyFeedback(state: AddressCopyState) {
	switch (state) {
		case 'copied':
			return { label: 'Copied', status: 'Address copied.' };
		case 'failed':
			return { label: 'Copy failed', status: 'Address could not be copied. Select it and copy it manually.' };
		default:
			return { label: 'Copy', status: '' };
	}
}

/** Visible text and a wallet-specific accessible name for a browser wallet's Connect button. */
export function browserWalletConnectLabel(walletId: BrowserWalletId, action: WalletDialogAction) {
	const walletName = walletId === 'permaweb-os' ? 'PermawebOS' : 'Wander';
	return action === walletId
		? { text: 'Connecting…', name: `Connecting ${walletName}…` }
		: { text: 'Connect', name: `Connect ${walletName}` };
}

export function walletDialogPhase(action: WalletDialogAction, generatedWallet: unknown): WalletDialogPhase {
	if (generatedWallet) return 'backup';
	if (action === 'generate') return 'generating';
	if (action === 'import') return 'importing';
	return action ? 'connecting' : 'choosing';
}

/**
 * Whether Escape, the backdrop and the close button may dismiss the dialog. Generating or importing
 * writes the only stored key and finishes in bounded time, and a generated key must be backed up, so
 * those phases stay open. A browser connect can wait on an extension prompt indefinitely, so it can
 * still be dismissed; its late result then only takes effect on the wallet, not on the dialog.
 */
export function walletDialogDismissible(action: WalletDialogAction, generatedWallet: unknown) {
	const phase = walletDialogPhase(action, generatedWallet);
	return phase === 'choosing' || phase === 'connecting';
}

/** True when another path (a stored-key restore, a wallet switch) committed an address while the user was choosing. */
export function walletDialogClosesForAddress(
	phase: WalletDialogPhase,
	addressAtOpen: string | null,
	address: string | null
) {
	return phase === 'choosing' && Boolean(address) && address !== addressAtOpen;
}

/**
 * Where focus goes when the connect dialog's trigger is gone, such as an in-page Connect button that
 * unmounts once a wallet connects: the header wallet button, which then names the account.
 */
export function connectDialogRestoreFallback(root: Pick<ParentNode, 'querySelector'> = document) {
	return root.querySelector<HTMLElement>('.wallet-menu .wallet');
}

export function browserWalletSelection(
	scope: Pick<Window, 'arweaveWallet' | 'permawebConnect'>,
	walletId: BrowserWalletId,
	remembered?: Window['arweaveWallet']
) {
	const current = scope.arweaveWallet;
	const requested = resolveBrowserWallet(scope, walletId);
	if (walletId === 'permaweb-os') {
		return {
			wallet: requested,
			remembered: current && !isLocalWallet(current) && current !== requested ? current : remembered,
		};
	}
	if (requested && !isLocalWallet(requested)) {
		return { wallet: requested, remembered: requested };
	}
	const permawebOs = resolveBrowserWallet(scope, 'permaweb-os');
	return {
		wallet: remembered && remembered !== permawebOs ? remembered : undefined,
		remembered,
	};
}

export function restoreBrowserWalletAfterDisconnect(
	scope: Pick<Window, 'arweaveWallet' | 'permawebConnect'>,
	disconnectedWallet: Window['arweaveWallet'],
	permawebOs: Window['arweaveWallet'],
	remembered?: Window['arweaveWallet']
) {
	if (!disconnectedWallet || disconnectedWallet !== permawebOs) return;
	if (scope.arweaveWallet && scope.arweaveWallet !== disconnectedWallet) return;
	if (remembered && remembered !== permawebOs) {
		scope.arweaveWallet = remembered;
	} else {
		delete scope.arweaveWallet;
	}
}

function browserWallet(walletId: BrowserWalletId) {
	const selection = browserWalletSelection(window, walletId, rememberedBrowserWallet);
	rememberedBrowserWallet = selection.remembered;
	return selection.wallet;
}

function isLocalWallet(wallet: Window['arweaveWallet']) {
	return Boolean(
		wallet && (wallet as Window['arweaveWallet'] & { [LOCAL_WALLET_ADAPTER]?: boolean })[LOCAL_WALLET_ADAPTER]
	);
}

/** The keyfile itself is unusable; retrying cannot help. Every other activation error is transient. */
export class InvalidLocalWalletError extends Error {
	constructor(cause: unknown) {
		super(cause instanceof Error && cause.message ? cause.message : 'The Arweave keyfile is invalid.');
		this.name = 'InvalidLocalWalletError';
	}
}

/** Only an invalid keyfile is removed; a failed chunk load, offline network or missing crypto keeps it. */
export function storedLocalWalletFailureAction(cause: unknown): 'clear' | 'keep' {
	return cause instanceof InvalidLocalWalletError ? 'clear' : 'keep';
}

/**
 * Unlocks the keyfile saved in this browser. Resolves null when a newer wallet action
 * superseded this one, so a stale failure never clears the key or the newer state.
 */
export async function unlockStoredLocalWallet(
	storedWallet: WalletJwk,
	{
		activate,
		commit,
		clear,
	}: {
		activate(jwk: WalletJwk): Promise<LocalWalletActivation>;
		commit: AddressCommit;
		clear(): void;
	}
): Promise<{ address: string | null; state: LocalWalletUnlockState } | null> {
	let activation: LocalWalletActivation;
	try {
		activation = await activate(storedWallet);
	} catch (cause) {
		if (!commit(null)) return null;
		if (storedLocalWalletFailureAction(cause) === 'clear') {
			clear();
			return { address: null, state: { status: 'idle' } };
		}
		return { address: null, state: { status: 'failed', message: LOCAL_WALLET_UNLOCK_FAILED_MESSAGE } };
	}
	const { address, install } = activation;
	return commit(address, install) ? { address, state: { status: 'idle' } } : null;
}

/** A local keyfile's address and the step that makes it the active signer, run only by a current commit. */
export type LocalWalletActivation = { address: string; install(): void };

async function prepareLocalWallet(jwk: WalletJwk): Promise<LocalWalletActivation> {
	const signingJwk = localWalletSigningJwk(jwk);
	const arweave = await createArweaveClient();
	const address = await arweave.wallets.jwkToAddress(signingJwk as any);
	const adapter = {
		[LOCAL_WALLET_ADAPTER]: true,
		connect: async () => undefined,
		disconnect: async () => undefined,
		getActiveAddress: async () => address,
		sign: async (transaction: any) => {
			await arweave.transactions.sign(transaction, signingJwk as any);
			return transaction;
		},
	} as Window['arweaveWallet'];
	return {
		address,
		install: () => {
			const current = window.arweaveWallet;
			if (current && !isLocalWallet(current)) rememberedBrowserWallet = current;
			window.arweaveWallet = adapter;
		},
	};
}

export function localWalletSigningJwk(jwk: WalletJwk): WalletJwk {
	try {
		return completePrivateJwk(jwk);
	} catch (cause) {
		throw new InvalidLocalWalletError(cause);
	}
}

export function completePrivateJwk(jwk: WalletJwk): WalletJwk {
	if (['p', 'q', 'dp', 'dq', 'qi'].every((field) => typeof (jwk as any)[field] === 'string')) return jwk;
	const n = decodeInteger(jwk.n);
	const e = decodeInteger(jwk.e);
	const d = decodeInteger(jwk.d!);
	const { p, q } = recoverPrimeFactors(n, e, d);
	return {
		...jwk,
		e: encodeInteger(e),
		d: encodeInteger(d),
		p: encodeInteger(p),
		q: encodeInteger(q),
		dp: encodeInteger(d % (p - 1n)),
		dq: encodeInteger(d % (q - 1n)),
		qi: encodeInteger(modInverse(q, p)),
	};
}

function recoverPrimeFactors(n: bigint, e: bigint, d: bigint) {
	let odd = d * e - 1n;
	let powersOfTwo = 0;
	while (odd % 2n === 0n) {
		odd /= 2n;
		powersOfTwo += 1;
	}
	for (let base = 2n; base < 128n; base += 1n) {
		let value = modPow(base, odd, n);
		if (value === 1n || value === n - 1n) continue;
		for (let exponent = 1; exponent <= powersOfTwo; exponent += 1) {
			const squared = (value * value) % n;
			if (squared === 1n) {
				const factor = greatestCommonDivisor(value - 1n, n);
				if (factor > 1n && factor < n) return { p: factor, q: n / factor };
				break;
			}
			if (squared === n - 1n) break;
			value = squared;
		}
	}
	throw new Error('Could not complete the private RSA keyfile.');
}

function modPow(base: bigint, exponent: bigint, modulus: bigint) {
	let result = 1n;
	let factor = base % modulus;
	for (let remaining = exponent; remaining > 0n; remaining /= 2n) {
		if (remaining % 2n === 1n) result = (result * factor) % modulus;
		factor = (factor * factor) % modulus;
	}
	return result;
}

function greatestCommonDivisor(left: bigint, right: bigint) {
	let a = left < 0n ? -left : left;
	let b = right < 0n ? -right : right;
	while (b !== 0n) [a, b] = [b, a % b];
	return a;
}

function modInverse(value: bigint, modulus: bigint) {
	let [oldRemainder, remainder] = [value, modulus];
	let [oldCoefficient, coefficient] = [1n, 0n];
	while (remainder !== 0n) {
		const quotient = oldRemainder / remainder;
		[oldRemainder, remainder] = [remainder, oldRemainder - quotient * remainder];
		[oldCoefficient, coefficient] = [coefficient, oldCoefficient - quotient * coefficient];
	}
	return ((oldCoefficient % modulus) + modulus) % modulus;
}

function decodeInteger(value: string) {
	const base64 = value
		.replace(/-/g, '+')
		.replace(/_/g, '/')
		.padEnd(Math.ceil(value.length / 4) * 4, '=');
	const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
	return BigInt(`0x${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`);
}

function encodeInteger(value: bigint) {
	let hex = value.toString(16);
	if (hex.length % 2) hex = `0${hex}`;
	const bytes = hex.match(/.{2}/g)?.map((byte) => String.fromCharCode(parseInt(byte, 16))) ?? [];
	return btoa(bytes.join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function restoreBrowserWallet() {
	if (rememberedBrowserWallet) {
		window.arweaveWallet = rememberedBrowserWallet;
	} else {
		delete window.arweaveWallet;
	}
}

function readLocalWallet() {
	try {
		const stored = localStorage.getItem(LOCAL_WALLET_KEY);
		if (!stored) return null;
		const wallet: unknown = JSON.parse(stored);
		return isValidWalletJwk(wallet) ? wallet : null;
	} catch {
		return null;
	}
}

function storeLocalWallet(wallet: WalletJwk) {
	localStorage.setItem(LOCAL_WALLET_KEY, JSON.stringify(wallet));
}

function clearLocalWallet() {
	localStorage.removeItem(LOCAL_WALLET_KEY);
}

function confirmLocalWalletReplacement(incoming?: WalletJwk) {
	if (!localWalletReplacementNeedsConfirm(readLocalWallet(), incoming)) return;
	if (!window.confirm(localWalletForgetCopy('replace'))) throw new Error(LOCAL_WALLET_KEPT_MESSAGE);
}

function downloadKeyfile(keyfile: string, filename: string) {
	const blob = new Blob([keyfile], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readBrowserWalletPreference(): BrowserWalletId | null {
	try {
		const walletId = localStorage.getItem(BROWSER_WALLET_KEY);
		if (walletId === LEGACY_PERMAWEB_OS_WALLET_ID) return 'permaweb-os';
		return walletId === 'permaweb-os' || walletId === 'wander' ? walletId : null;
	} catch {
		return null;
	}
}

function storeBrowserWalletPreference(walletId: BrowserWalletId) {
	localStorage.setItem(BROWSER_WALLET_KEY, walletId);
}

function clearBrowserWalletPreference() {
	localStorage.removeItem(BROWSER_WALLET_KEY);
}

function walletErrorMessage(cause: unknown) {
	return cause instanceof Error && cause.message ? cause.message : 'The wallet connection failed. Try again.';
}

async function installDevelopmentWallet() {
	if (!import.meta.env.DEV || window.arweaveWallet) return;
	const stored = localStorage.getItem('bazar:e2e-wallet');
	if (!stored) return;
	try {
		const wallet = JSON.parse(stored);
		if (!isValidWalletJwk(wallet)) throw new Error('invalid-wallet');
		const arweave = await createArweaveClient();
		let address: string | undefined;
		window.arweaveWallet = {
			connect: async () => undefined,
			disconnect: async () => undefined,
			getActiveAddress: async () => {
				address ??= await arweave.wallets.jwkToAddress(wallet);
				return address!;
			},
			sign: async (transaction: any) => {
				await arweave.transactions.sign(transaction, wallet);
				return transaction;
			},
		};
	} catch {
		localStorage.removeItem('bazar:e2e-wallet');
	}
}
