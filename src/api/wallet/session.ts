import type { JWKInterface } from 'arweave/web/lib/wallet';

import { createArweaveClient } from 'api/arweave/client';

import { appError } from 'helpers/app-error';
import { isArweaveId } from 'helpers/arweave-id';

import {
	BROWSER_WALLET_PERMISSIONS,
	type BrowserWalletId,
	PERMAWEB_OS_WALLET_PERMISSIONS,
	resolveBrowserWallet,
	restoreBrowserWalletConnection,
} from './adapter';
import { walletFailure } from './errors';

export type WalletJwk = JWKInterface;

export type GeneratedWallet = {
	address: string;
	jwk: WalletJwk;
};

const LOCAL_WALLET_KEY = 'bazar:local-wallet';

const BROWSER_WALLET_KEY = 'bazar:browser-wallet';

const LEGACY_PERMAWEB_OS_WALLET_ID = 'the-fold';

const LOCAL_WALLET_ADAPTER = Symbol('bazar-local-wallet-adapter');

export let rememberedBrowserWallet: Window['arweaveWallet'];

export async function connectWallet(
	wallet: Window['arweaveWallet'],
	walletId: BrowserWalletId = 'wander',
	permissions: readonly string[] = BROWSER_WALLET_PERMISSIONS
) {
	if (!wallet) throw appError(walletId === 'permaweb-os' ? 'permaweb-os-wallet-missing' : 'wander-wallet-missing');
	try {
		await wallet.connect([...permissions]);
	} catch (cause) {
		throw walletFailure(cause, 'wallet-connection-failed', 'wallet-connection-rejected');
	}
	let address: string | undefined;
	try {
		address = await wallet.getActiveAddress?.();
	} catch (cause) {
		throw appError('wallet-address-unreadable', { cause });
	}
	if (!address || !isArweaveId(address)) throw appError('wallet-address-invalid');
	return address;
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

export function browserWallet(walletId: BrowserWalletId) {
	const selection = browserWalletSelection(window, walletId, rememberedBrowserWallet);
	rememberedBrowserWallet = selection.remembered;
	return selection.wallet;
}

export function isLocalWallet(wallet: Window['arweaveWallet']) {
	return Boolean(
		wallet && (wallet as Window['arweaveWallet'] & { [LOCAL_WALLET_ADAPTER]?: boolean })[LOCAL_WALLET_ADAPTER]
	);
}

export async function activateLocalWallet(jwk: WalletJwk) {
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
	throw appError('wallet-keyfile-incomplete');
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

export function restoreBrowserWallet() {
	if (rememberedBrowserWallet) {
		window.arweaveWallet = rememberedBrowserWallet;
	} else {
		delete window.arweaveWallet;
	}
}

export function readLocalWallet() {
	try {
		const stored = localStorage.getItem(LOCAL_WALLET_KEY);
		if (!stored) return null;
		const wallet: unknown = JSON.parse(stored);
		return isValidWalletJwk(wallet) ? wallet : null;
	} catch {
		return null;
	}
}

export function storeLocalWallet(wallet: WalletJwk) {
	localStorage.setItem(LOCAL_WALLET_KEY, JSON.stringify(wallet));
}

export function clearLocalWallet() {
	localStorage.removeItem(LOCAL_WALLET_KEY);
}

export function readBrowserWalletPreference(): BrowserWalletId | null {
	try {
		const walletId = localStorage.getItem(BROWSER_WALLET_KEY);
		if (walletId === LEGACY_PERMAWEB_OS_WALLET_ID) return 'permaweb-os';
		return walletId === 'permaweb-os' || walletId === 'wander' ? walletId : null;
	} catch {
		return null;
	}
}

export function storeBrowserWalletPreference(walletId: BrowserWalletId) {
	localStorage.setItem(BROWSER_WALLET_KEY, walletId);
}

export function clearBrowserWalletPreference() {
	localStorage.removeItem(BROWSER_WALLET_KEY);
}

export async function installDevelopmentWallet() {
	if (!import.meta.env.DEV || window.arweaveWallet) return;
	const stored = localStorage.getItem('bazar:e2e-wallet');
	if (!stored) return;
	try {
		const wallet = JSON.parse(stored);
		if (!isValidWalletJwk(wallet)) throw appError('wallet-keyfile-invalid', { message: 'invalid-wallet' });
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

// Session operations used by the wallet provider. They own every read and write of the injected
// `window.arweaveWallet` so UI layers never touch the browser wallet object directly.

export async function restoreBrowserWalletSession(): Promise<string | null> {
	const connection = await restoreBrowserWalletConnection(window, readBrowserWalletPreference());
	if (connection) window.arweaveWallet = connection.wallet;
	return connection?.address ?? null;
}

export async function connectBrowserWallet(walletId: BrowserWalletId): Promise<string> {
	const wallet = browserWallet(walletId);
	const address = await connectWallet(
		wallet,
		walletId,
		walletId === 'permaweb-os' ? PERMAWEB_OS_WALLET_PERMISSIONS : BROWSER_WALLET_PERMISSIONS
	);
	clearLocalWallet();
	window.arweaveWallet = wallet;
	storeBrowserWalletPreference(walletId);
	return address;
}

export async function disconnectWalletSession(): Promise<void> {
	const disconnectedWallet = window.arweaveWallet;
	const permawebOs = resolveBrowserWallet(window, 'permaweb-os');
	if (isLocalWallet(disconnectedWallet)) {
		clearLocalWallet();
		restoreBrowserWallet();
	} else {
		try {
			await disconnectedWallet?.disconnect?.();
		} catch (cause) {
			throw walletFailure(cause, 'wallet-disconnect-failed');
		}
		restoreBrowserWalletAfterDisconnect(window, disconnectedWallet, permawebOs, rememberedBrowserWallet);
	}
	clearBrowserWalletPreference();
}

export async function generateLocalWalletKey(): Promise<WalletJwk> {
	const arweave = await createArweaveClient();
	const jwk = (await arweave.wallets.generate()) as unknown as WalletJwk;
	if (!isValidWalletJwk(jwk)) throw appError('wallet-keyfile-generation-failed');
	storeLocalWallet(jwk);
	return jwk;
}

export async function readWalletKeyfile(file: File): Promise<WalletJwk> {
	let jwk: unknown;
	try {
		jwk = JSON.parse(await file.text());
	} catch (cause) {
		throw appError('wallet-keyfile-invalid', { cause });
	}
	if (!isValidWalletJwk(jwk)) throw appError('wallet-keyfile-invalid');
	return jwk;
}

export async function stageDevelopmentWallet(file: File): Promise<void> {
	let wallet: unknown;
	try {
		wallet = JSON.parse(await file.text());
	} catch (cause) {
		throw appError('wallet-keyfile-invalid', { cause });
	}
	if (!isValidWalletJwk(wallet)) throw appError('wallet-keyfile-invalid');
	localStorage.setItem('bazar:e2e-wallet', JSON.stringify(wallet));
}
