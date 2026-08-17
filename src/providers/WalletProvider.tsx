import React from 'react';
import { Copy, Download, FileUp, KeyRound, Wallet, X } from 'lucide-react';

import type { JWKInterface } from 'arweave/web/lib/wallet';

import { type BrowserWalletId, getBrowserWallet, readWalletBalance } from 'api/wallet';

import { Button } from 'components/Button';
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
	connect(walletId: BrowserWalletId): Promise<void>;
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
			}
		);
		return () => controller.abort();
	}, [address]);

	const value = React.useMemo<WalletContextValue>(
		() => ({
			address,
			arBalance,
			arBalanceStatus,
			connect: async (walletId) => {
				const wallet = browserWallet(walletId);
				const commit = addressRequests.current.begin();
				const nextAddress = await connectWallet(wallet, walletId === 'the-fold' ? 'The Fold' : 'Wander');
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
		[address, arBalance, arBalanceStatus]
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
	const [action, setAction] = React.useState<BrowserWalletId | 'generate' | 'import' | null>(null);
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

	const connectBrowserWallet = async (walletId: BrowserWalletId) => {
		setAction(walletId);
		setError('');
		try {
			await wallet.connect(walletId);
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
					<Button
						aria-label="Close wallet options"
						className="close"
						disabled={Boolean(generatedWallet)}
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
								<span>Download this keyfile before closing.</span>
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
									await navigator.clipboard.writeText(generatedWallet.address);
									setCopied(true);
								}}
								type="button"
								size="custom"
							>
								<Copy className="ui-icon ui-icon--sm" aria-hidden="true" />
								{copied ? 'Copied' : 'Copy'}
							</Button>
						</div>
						<Button
							className="wide with-icon"
							onClick={downloadGeneratedWallet}
							type="button"
							size="custom"
							variant="primary"
						>
							<Download className="ui-icon ui-icon--sm" aria-hidden="true" />
							Download keyfile
						</Button>
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
										<strong>The Fold</strong>
										<span>Permaweb wallet extension</span>
									</div>
								</div>
								<Button
									data-dialog-initial
									onClick={() => void connectBrowserWallet('the-fold')}
									disabled={action !== null}
									type="button"
									size="custom"
									variant="primary"
								>
									{action === 'the-fold' ? 'Connecting…' : 'Connect'}
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

export async function connectWallet(wallet: Window['arweaveWallet'], walletName = 'Wander') {
	if (!wallet) {
		const installationName = walletName === 'The Fold' ? walletName : `the ${walletName}`;
		throw new Error(`Install ${installationName} wallet extension to continue.`);
	}
	await wallet.connect(WALLET_PERMISSIONS);
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

function browserWallet(walletId: BrowserWalletId) {
	const current = window.arweaveWallet;
	const requested = getBrowserWallet(walletId);
	if (walletId === 'the-fold') {
		if (current && !isLocalWallet(current) && current !== requested) rememberedBrowserWallet = current;
		return requested;
	}
	if (requested && !isLocalWallet(requested)) {
		rememberedBrowserWallet = requested;
		return requested;
	}
	return rememberedBrowserWallet && rememberedBrowserWallet !== getBrowserWallet('the-fold')
		? rememberedBrowserWallet
		: undefined;
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
