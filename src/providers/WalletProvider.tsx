import type { JWKInterface } from 'arweave/web/lib/wallet';
import { Copy, Download, FileUp, KeyRound, Wallet, X } from 'lucide-react';
import React from 'react';

import { readWalletBalance } from 'api/wallet';
import { createArweaveClient } from 'helpers/arweave';

import { useDialogFocus } from '../app/useDialogFocus';

type WalletJwk = JWKInterface;

type GeneratedWallet = {
	address: string;
	jwk: WalletJwk;
};

type WalletContextValue = {
	address: string | null;
	arBalance: bigint | null;
	arBalanceStatus: 'idle' | 'loading' | 'ready' | 'error';
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	generateLocalWallet(): Promise<GeneratedWallet>;
	importLocalWallet(file: File): Promise<void>;
	openConnectDialog(trigger?: HTMLElement | null): void;
	loadDevelopmentWallet?(file: File): Promise<void>;
};

const WALLET_PERMISSIONS = ['ACCESS_ADDRESS', 'ACCESS_PUBLIC_KEY', 'SIGN_TRANSACTION'];
const ARWEAVE_ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const LOCAL_WALLET_KEY = 'bazar:local-wallet';
const LOCAL_WALLET_ADAPTER = Symbol('bazar-local-wallet-adapter');

const WalletContext = React.createContext<WalletContextValue | null>(null);
let rememberedBrowserWallet: Window['arweaveWallet'];

export function WalletProvider({ children }: React.PropsWithChildren) {
	const [address, setAddress] = React.useState<string | null>(null);
	const [arBalance, setArBalance] = React.useState<bigint | null>(null);
	const [arBalanceStatus, setArBalanceStatus] = React.useState<WalletContextValue['arBalanceStatus']>('idle');
	const [connectDialogOpen, setConnectDialogOpen] = React.useState(false);
	const connectDialogTrigger = React.useRef<HTMLElement | null>(null);
	const addressRequests = React.useRef(createLatestAddressCommitter(setAddress));
	const closeConnectDialog = React.useCallback(() => setConnectDialogOpen(false), []);
	const restoreConnectDialogFocus = React.useCallback(() => connectDialogTrigger.current, []);

	const refresh = React.useCallback(async () => {
		const commit = addressRequests.current.begin();
		try {
			commit((await window.arweaveWallet?.getActiveAddress?.()) ?? null);
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
		window.addEventListener('walletSwitch', refresh);
		return () => {
			cancelled = true;
			window.removeEventListener('walletSwitch', refresh);
			addressRequests.current.invalidate();
		};
	}, [refresh]);

	React.useEffect(() => {
		setArBalance(null);
		if (!address) {
			setArBalanceStatus('idle');
			return;
		}

		const controller = new AbortController();
		setArBalanceStatus('loading');
		void readWalletBalance(address, { signal: controller.signal }).then(
			(balance) => {
				if (controller.signal.aborted) return;
				setArBalance(balance);
				setArBalanceStatus('ready');
			},
			() => {
				if (controller.signal.aborted) return;
				setArBalanceStatus('error');
			},
		);
		return () => controller.abort();
	}, [address]);

	const value = React.useMemo<WalletContextValue>(
		() => ({
			address,
			arBalance,
			arBalanceStatus,
			connect: async () => {
				const wallet = browserWallet();
				const commit = addressRequests.current.begin();
				const nextAddress = await connectWallet(wallet);
				clearLocalWallet();
				window.arweaveWallet = wallet;
				commit(nextAddress);
			},
			disconnect: async () => {
				const commit = addressRequests.current.begin();
				if (isLocalWallet(window.arweaveWallet)) {
					clearLocalWallet();
					restoreBrowserWallet();
				} else {
					await window.arweaveWallet?.disconnect?.();
				}
				commit(null);
			},
			generateLocalWallet: async () => {
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
		[address, arBalance, arBalanceStatus],
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
	const [action, setAction] = React.useState<'wander' | 'generate' | 'import' | null>(null);
	const [error, setError] = React.useState('');
	const [generatedWallet, setGeneratedWallet] = React.useState<GeneratedWallet | null>(null);
	const [copied, setCopied] = React.useState(false);
	const close = React.useCallback(() => {
		if (generatedWallet) return;
		setError('');
		setAction(null);
		onClose();
	}, [generatedWallet, onClose]);
	const dialogRef = useDialogFocus<HTMLDivElement>(open, close, restoreTarget, generatedWallet?.address);

	React.useEffect(() => {
		if (!open) {
			setCopied(false);
			setGeneratedWallet(null);
		}
	}, [open]);

	if (!open) return null;

	const connectWander = async () => {
		setAction('wander');
		setError('');
		try {
			await wallet.connect();
			onClose();
		} catch (cause) {
			setError(walletErrorMessage(cause));
		} finally {
			setAction(null);
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
	const downloadGeneratedWallet = () => {
		if (!generatedWallet) return;
		const blob = new Blob([JSON.stringify(generatedWallet.jwk, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${generatedWallet.address}.json`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
		setGeneratedWallet(null);
		onClose();
	};

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
				ref={dialogRef}
				role="dialog"
				tabIndex={-1}
			>
				<div className="dialog-heading wallet-connect-heading">
					<div>
						<h2 id="wallet-connect-title">Connect wallet</h2>
					</div>
					<button
						aria-label="Close wallet options"
						className="close"
						disabled={Boolean(generatedWallet)}
						onClick={close}
						type="button"
					>
						<X aria-hidden="true" />
					</button>
				</div>
				{generatedWallet ? (
					<div className="generated-wallet-panel">
						<div>
							<KeyRound className="ui-icon" aria-hidden="true" />
							<div>
								<strong>Keyfile generated</strong>
								<span>Download this keyfile before closing.</span>
							</div>
						</div>
						<div className="generated-wallet-address">
							<div>
								<span>Address</span>
								<code>{generatedWallet.address}</code>
							</div>
							<button
								className="with-icon"
								onClick={async () => {
									await navigator.clipboard.writeText(generatedWallet.address);
									setCopied(true);
								}}
								type="button"
							>
								<Copy className="ui-icon ui-icon--sm" aria-hidden="true" />
								{copied ? 'Copied' : 'Copy'}
							</button>
						</div>
						<button className="primary wide with-icon" onClick={downloadGeneratedWallet} type="button">
							<Download className="ui-icon ui-icon--sm" aria-hidden="true" />
							Download keyfile
						</button>
						<p className="wallet-keyfile-warning">
							<strong>Keep this file safe.</strong> Anyone with it controls the wallet, and it cannot be recovered if
							lost.
						</p>
					</div>
				) : (
					<>
						<div className="wallet-option-list">
							<div className="wallet-option">
								<div className="wallet-option-copy">
									<Wallet className="ui-icon" aria-hidden="true" />
									<div>
										<strong>Wander</strong>
										<span>Browser extension wallet</span>
									</div>
								</div>
								<button
									className="primary"
									data-dialog-initial
									onClick={() => void connectWander()}
									disabled={action !== null}
									type="button"
								>
									{action === 'wander' ? 'Connecting…' : 'Connect'}
								</button>
							</div>
							<div className="wallet-option">
								<div className="wallet-option-copy">
									<KeyRound className="ui-icon" aria-hidden="true" />
									<div>
										<strong>Generate keyfile</strong>
										<span>Create a new local wallet</span>
									</div>
								</div>
								<button onClick={() => void generate()} disabled={action !== null} type="button">
									{action === 'generate' ? 'Generating…' : 'Generate'}
								</button>
							</div>
							<div className="wallet-option">
								<div className="wallet-option-copy">
									<FileUp className="ui-icon" aria-hidden="true" />
									<div>
										<strong>Import keyfile</strong>
										<span>Load an existing Arweave keyfile</span>
									</div>
								</div>
								<button onClick={() => fileInput.current?.click()} disabled={action !== null} type="button">
									{action === 'import' ? 'Importing…' : 'Import'}
								</button>
								<input ref={fileInput} hidden type="file" accept=".json,application/json" onChange={importWallet} />
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

export async function connectWallet(wallet: Window['arweaveWallet']) {
	if (!wallet) throw new Error('Install the Wander wallet extension to continue.');
	await wallet.connect(WALLET_PERMISSIONS);
	let address: string | undefined;
	try {
		address = await wallet.getActiveAddress?.();
	} catch {
		throw new Error(
			'The wallet connected, but its active address could not be read. Unlock or reconnect the wallet and try again.',
		);
	}
	if (!address || !ARWEAVE_ADDRESS.test(address)) {
		throw new Error(
			'The wallet connected, but no valid active address was returned. Unlock or reconnect the wallet and try again.',
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
		(value as WalletJwk).d,
	);
}

function browserWallet() {
	const current = window.arweaveWallet;
	if (current && !isLocalWallet(current)) {
		rememberedBrowserWallet = current;
		return current;
	}
	return rememberedBrowserWallet;
}

function isLocalWallet(wallet: Window['arweaveWallet']) {
	return Boolean(
		wallet && (wallet as Window['arweaveWallet'] & { [LOCAL_WALLET_ADAPTER]?: boolean })[LOCAL_WALLET_ADAPTER],
	);
}

async function activateLocalWallet(jwk: WalletJwk) {
	const current = window.arweaveWallet;
	if (current && !isLocalWallet(current)) rememberedBrowserWallet = current;
	const arweave = await createArweaveClient();
	const address = await arweave.wallets.jwkToAddress(jwk as any);
	window.arweaveWallet = {
		[LOCAL_WALLET_ADAPTER]: true,
		connect: async () => undefined,
		disconnect: async () => undefined,
		getActiveAddress: async () => address,
		sign: async (transaction: any) => {
			await arweave.transactions.sign(transaction, jwk as any);
			return transaction;
		},
	} as Window['arweaveWallet'];
	return address;
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
