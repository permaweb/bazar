import { arweaveGatewayFromLocation } from 'helpers/config';

const ARWEAVE_ADDRESS = /^[A-Za-z0-9_-]{43}$/;

export const BROWSER_WALLET_PERMISSIONS = ['ACCESS_ADDRESS', 'ACCESS_PUBLIC_KEY', 'SIGN_TRANSACTION'];

export type BrowserWalletId = 'permaweb-os' | 'wander';

type BrowserWalletScope = {
	arweaveWallet?: unknown;
	permawebConnect?: unknown;
};

function isBrowserWallet(value: unknown): value is ArweaveWalletProvider {
	return Boolean(
		value &&
			typeof value === 'object' &&
			typeof (value as ArweaveWalletProvider).connect === 'function' &&
			typeof (value as ArweaveWalletProvider).sign === 'function'
	);
}

export function resolveBrowserWallet(scope: BrowserWalletScope, walletId: BrowserWalletId) {
	const provider = walletId === 'permaweb-os' ? scope.permawebConnect : scope.arweaveWallet;
	if (walletId === 'wander' && provider === scope.permawebConnect) return undefined;
	return isBrowserWallet(provider) ? provider : undefined;
}

export function getBrowserWallet(walletId: BrowserWalletId) {
	return resolveBrowserWallet(typeof window === 'undefined' ? {} : window, walletId);
}

export async function restoreBrowserWalletConnection(
	scope: BrowserWalletScope,
	preferredWalletId?: BrowserWalletId | null
) {
	const permawebOs = resolveBrowserWallet(scope, 'permaweb-os');
	const preferred = preferredWalletId ? resolveBrowserWallet(scope, preferredWalletId) : undefined;
	const current = isBrowserWallet(scope.arweaveWallet) ? scope.arweaveWallet : undefined;
	const candidates = [preferred, current, permawebOs].filter(
		(wallet, index, wallets): wallet is ArweaveWalletProvider =>
			Boolean(wallet) && wallets.indexOf(wallet) === index
	);

	for (const wallet of candidates) {
		if (wallet === permawebOs && !(await hasPermawebOsPermissions(wallet))) continue;
		try {
			const address = await wallet.getActiveAddress?.();
			if (address && ARWEAVE_ADDRESS.test(address)) return { address, wallet };
		} catch {
			// A locked, disconnected, or not-yet-ready provider is not an active connection.
		}
	}
	return undefined;
}

async function hasPermawebOsPermissions(wallet: ArweaveWalletProvider) {
	if (!wallet.getPermissions) return true;
	try {
		const permissions = await wallet.getPermissions();
		return (
			Array.isArray(permissions) &&
			BROWSER_WALLET_PERMISSIONS.every((permission) => permissions.includes(permission))
		);
	} catch {
		return false;
	}
}

export async function readWalletBalance(
	address: string,
	options: { fetch?: typeof fetch; gateway?: string; signal?: AbortSignal } = {}
) {
	if (!ARWEAVE_ADDRESS.test(address)) throw new TypeError('invalid-wallet-address');
	const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
	const response = await fetcher(`${options.gateway ?? arweaveGatewayFromLocation()}/wallet/${address}/balance`, {
		signal: options.signal,
	});
	if (!response.ok) throw new Error(`wallet-balance-${response.status}`);
	const value = (await response.text()).trim();
	if (!/^\d+$/.test(value)) throw new Error('wallet-balance-invalid');
	return BigInt(value);
}
