import React from 'react';
import { Check, Copy, Download, FileUp, KeyRound, Wallet, X } from 'lucide-react';

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

type WalletDialogAction = BrowserWalletId | 'generate' | 'import' | null;

/**
 * The connect dialog's phase, derived from its pending action and generated key. `backup` holds a
 * freshly generated key that has not been confirmed as saved. Exposed as `data-phase` on the dialog.
 */
export type WalletDialogPhase = 'choosing' | 'connecting' | 'generating' | 'importing' | 'backup';

/**
 * Where the connected wallet's key lives. `local` means Bazar holds the only stored copy of the
 * private key in this browser's localStorage, so disconnecting it erases the key. `browser` means an
 * extension (Wander, PermawebOS) holds the key and disconnecting only ends the session.
 */
export type WalletKind = 'local' | 'browser';

type WalletContextValue = {
	address: string | null;
	walletKind: WalletKind | null;
	arBalance: bigint | null;
	arBalanceDenomination: number;
	arBalanceStatus: 'idle' | 'loading' | 'ready' | 'error';
	aoBalance: bigint | null;
	aoBalanceDenomination: number;
	aoBalanceStatus: 'idle' | 'loading' | 'ready' | 'error';
	connect(walletId: BrowserWalletId): Promise<void>;
	/** Resolves false when the user chose to keep a local keyfile wallet. */
	disconnect(): Promise<boolean>;
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
	const [walletKind, setWalletKind] = React.useState<WalletKind | null>(null);
	const [arBalance, setArBalance] = React.useState<bigint | null>(null);
	const [arBalanceDenomination, setArBalanceDenomination] = React.useState(12);
	const [arBalanceStatus, setArBalanceStatus] = React.useState<WalletContextValue['arBalanceStatus']>('idle');
	const [aoBalance, setAoBalance] = React.useState<bigint | null>(null);
	const [aoBalanceDenomination, setAoBalanceDenomination] = React.useState(12);
	const [aoBalanceStatus, setAoBalanceStatus] = React.useState<WalletContextValue['aoBalanceStatus']>('idle');
	const [balanceRevision, setBalanceRevision] = React.useState(0);
	const [connectDialogOpen, setConnectDialogOpen] = React.useState(false);
	const connectDialogTrigger = React.useRef<HTMLElement | null>(null);
	const addressRequests = React.useRef(
		createLatestAddressCommitter((nextAddress) => {
			setAoWalletConnection(nextAddress);
			setAddress(nextAddress);
			// Every committer installs window.arweaveWallet before it commits, so this reads the
			// adapter that produced nextAddress.
			setWalletKind(walletKindOf(nextAddress, window.arweaveWallet));
		})
	);
	const closeConnectDialog = React.useCallback(() => setConnectDialogOpen(false), []);
	const restoreConnectDialogFocus = React.useCallback(() => connectDialogTrigger.current, []);

	const refresh = React.useCallback(async () => {
		const commit = addressRequests.current.begin();
		try {
			const connection = await restoreBrowserWalletConnection(window, readBrowserWalletPreference());
			if (connection) window.arweaveWallet = connection.wallet;
			commit(connection?.address ?? null);
		} catch {
			commit(null);
		}
	}, []);

	React.useEffect(() => {
		let cancelled = false;
		void installDevelopmentWallet().then(() => {
			if (cancelled) return;
			const storedWallet = readLocalWallet();
			if (storedWallet) {
				const commit = addressRequests.current.begin();
				void activateLocalWallet(storedWallet).then(commit, () => {
					clearLocalWallet();
					commit(null);
				});
			} else {
				void refresh();
			}
		});
		const refreshWallet = () => {
			setBalanceRevision((revision) => revision + 1);
			void refresh();
		};
		const refreshNetworkBalances = () => setBalanceRevision((revision) => revision + 1);
		window.addEventListener('walletSwitch', refreshWallet);
		window.addEventListener('permawebConnectLoaded', refreshWallet);
		window.addEventListener('aoFetchLoaded', refreshNetworkBalances);
		return () => {
			cancelled = true;
			window.removeEventListener('walletSwitch', refreshWallet);
			window.removeEventListener('permawebConnectLoaded', refreshWallet);
			window.removeEventListener('aoFetchLoaded', refreshNetworkBalances);
			addressRequests.current.invalidate();
		};
	}, [refresh]);

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
			walletKind,
			arBalance,
			arBalanceDenomination,
			arBalanceStatus,
			aoBalance,
			aoBalanceDenomination,
			aoBalanceStatus,
			connect: async (walletId) => {
				confirmLocalWalletReplacement();
				const wallet = browserWallet(walletId);
				const commit = addressRequests.current.begin();
				const nextAddress = await connectWallet(
					wallet,
					walletId === 'permaweb-os' ? 'PermawebOS' : 'Wander',
					walletId === 'permaweb-os' ? PERMAWEB_OS_WALLET_PERMISSIONS : BROWSER_WALLET_PERMISSIONS
				);
				clearLocalWallet();
				window.arweaveWallet = wallet;
				storeBrowserWalletPreference(walletId);
				commit(nextAddress);
				setBalanceRevision((revision) => revision + 1);
			},
			disconnect: async () => {
				const disconnectedWallet = window.arweaveWallet;
				const plan = walletDisconnectPlan(isLocalWallet(disconnectedWallet) ? 'local' : 'browser', address);
				if (plan.confirm && !window.confirm(plan.copy)) return false;
				const commit = addressRequests.current.begin();
				const permawebOs = resolveBrowserWallet(window, 'permaweb-os');
				if (plan.clearsKey) {
					clearLocalWallet();
					restoreBrowserWallet();
				} else {
					await disconnectedWallet?.disconnect?.();
					restoreBrowserWalletAfterDisconnect(
						window,
						disconnectedWallet,
						permawebOs,
						rememberedBrowserWallet
					);
				}
				clearBrowserWalletPreference();
				commit(null);
				return true;
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
				const nextAddress = await activateLocalWallet(jwk);
				commit(nextAddress);
				return { address: nextAddress, jwk };
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
				commit(await activateLocalWallet(jwk));
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
	const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'failed'>('idle');
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

	React.useEffect(() => {
		session.current += 1;
		addressAtOpen.current = open ? wallet.address : null;
		setAction(null);
		setError('');
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
	const backup = generatedKeyfileBackupStep(generatedWalletDownloaded);

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
								className="with-icon"
								onClick={async () => {
									try {
										await navigator.clipboard.writeText(generatedWallet.address);
										setCopyState('copied');
									} catch {
										setCopyState('failed');
									}
								}}
								type="button"
								size="custom"
							>
								<Copy className="ui-icon ui-icon--sm" aria-hidden="true" />
								<span aria-live="polite">
									{copyState === 'copied'
										? 'Copied'
										: copyState === 'failed'
										? 'Copy failed'
										: 'Copy'}
								</span>
							</Button>
						</div>
						<Button
							className="wide with-icon"
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
								data-dialog-initial
								onClick={finishGeneratedWallet}
								type="button"
								size="custom"
								variant="primary"
							>
								<Check className="ui-icon ui-icon--sm" aria-hidden="true" />
								{backup.finishLabel}
							</Button>
						) : null}
						<p className="wallet-keyfile-warning">
							<strong>Keep this file safe.</strong> Anyone with it controls the wallet, and it cannot be
							recovered if lost.
						</p>
					</div>
				) : (
					<>
						<div className="wallet-option-list">
							<div className="wallet-option">
								<div className="wallet-option-copy">
									<Wallet className="ui-icon" aria-hidden="true" />
									<div>
										<strong>PermawebOS</strong>
										<span>Permaweb wallet extension</span>
									</div>
								</div>
								<Button
									data-dialog-initial
									onClick={() => void connectBrowserWallet('permaweb-os')}
									disabled={action !== null}
									type="button"
									size="custom"
									variant="primary"
								>
									{action === 'permaweb-os' ? 'Connecting…' : 'Connect'}
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
									onClick={() => void connectBrowserWallet('wander')}
									disabled={action !== null}
									type="button"
									size="custom"
									variant="primary"
								>
									{action === 'wander' ? 'Connecting…' : 'Connect'}
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

export function createLatestAddressCommitter(commit: (address: string | null) => void) {
	let latest = 0;
	return {
		begin() {
			const request = ++latest;
			return (address: string | null) => {
				if (request !== latest) return false;
				commit(address);
				return true;
			};
		},
		invalidate() {
			latest += 1;
		},
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

export function generatedKeyfileBackupStep(downloaded: boolean) {
	return downloaded
		? {
				hint: 'Check that the keyfile saved, then continue. You can download it again later from the wallet menu.',
				downloadLabel: 'Download again',
				finishLabel: 'I saved the keyfile',
				canFinish: true,
		  }
		: {
				hint: 'Download this keyfile before closing.',
				downloadLabel: 'Download keyfile',
				finishLabel: 'I saved the keyfile',
				canFinish: false,
		  };
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

async function activateLocalWallet(jwk: WalletJwk) {
	const current = window.arweaveWallet;
	if (current && !isLocalWallet(current)) rememberedBrowserWallet = current;
	const signingJwk = completePrivateJwk(jwk);
	const arweave = await createArweaveClient();
	const address = await arweave.wallets.jwkToAddress(signingJwk as any);
	window.arweaveWallet = {
		[LOCAL_WALLET_ADAPTER]: true,
		connect: async () => undefined,
		disconnect: async () => undefined,
		getActiveAddress: async () => address,
		sign: async (transaction: any) => {
			await arweave.transactions.sign(transaction, signingJwk as any);
			return transaction;
		},
	} as Window['arweaveWallet'];
	return address;
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
