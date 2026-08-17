import { arweaveGatewayFromLocation } from 'helpers/config';

const ARWEAVE_ADDRESS = /^[A-Za-z0-9_-]{43}$/;

export type BrowserWalletId = 'the-fold' | 'wander';

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
	const provider = walletId === 'the-fold' ? scope.permawebConnect : scope.arweaveWallet;
	if (walletId === 'wander' && provider === scope.permawebConnect) return undefined;
	return isBrowserWallet(provider) ? provider : undefined;
}

export function getBrowserWallet(walletId: BrowserWalletId) {
	return resolveBrowserWallet(typeof window === 'undefined' ? {} : window, walletId);
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
