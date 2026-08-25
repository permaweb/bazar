import { arweaveGatewayFromLocation } from 'helpers/config';

import { operationWithDeadline } from './fetch-with-deadline';

const ARWEAVE_ADDRESS = /^[A-Za-z0-9_-]{43}$/;

export const BROWSER_WALLET_PERMISSIONS = ['ACCESS_ADDRESS', 'ACCESS_PUBLIC_KEY', 'SIGN_TRANSACTION'];
export const PERMAWEB_OS_WALLET_PERMISSIONS = [...BROWSER_WALLET_PERMISSIONS, 'ACCESS_TOKENS'];

// Browser settles its parallel AR/AO reads at the shared 15-second request
// bound. Leave bridge overhead without inheriting the generic 130-second cap.
const EXTENSION_BALANCE_TIMEOUT_MS = 20_000;

export type VisibleWalletBalance = {
	atomicBalance: bigint | null;
	denomination: number;
	error?: string;
};

export type VisibleWalletBalances = {
	ar: VisibleWalletBalance;
	ao?: VisibleWalletBalance;
};

export type BrowserWalletId = 'permaweb-os' | 'wander';

type BrowserWalletScope = {
	arweaveWallet?: unknown;
	permawebConnect?: unknown;
};

type InjectedWalletBalance = {
	asset: 'AR' | 'AO';
	network: 'arweave-mainnet' | 'ao-legacynet' | 'ao-mainnet';
	denomination: number;
	atomicBalance: string | null;
	error?: string;
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

function injectedWalletBalance(value: unknown): InjectedWalletBalance | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
	const candidate = value as Partial<InjectedWalletBalance>;
	if (
		!['AR', 'AO'].includes(String(candidate.asset)) ||
		!['arweave-mainnet', 'ao-legacynet', 'ao-mainnet'].includes(String(candidate.network)) ||
		(candidate.asset === 'AR' && candidate.network !== 'arweave-mainnet') ||
		(candidate.asset === 'AO' && !['ao-legacynet', 'ao-mainnet'].includes(String(candidate.network))) ||
		!Number.isSafeInteger(candidate.denomination) ||
		(candidate.denomination as number) < 0 ||
		(candidate.denomination as number) > 24 ||
		!(
			candidate.atomicBalance === null ||
			(typeof candidate.atomicBalance === 'string' && /^\d+$/.test(candidate.atomicBalance))
		) ||
		!(candidate.error === undefined || typeof candidate.error === 'string')
	) {
		return undefined;
	}
	return candidate as InjectedWalletBalance;
}

function isArBalance(balance: InjectedWalletBalance): boolean {
	return balance.asset === 'AR' && balance.network === 'arweave-mainnet' && balance.denomination === 12;
}

function isAoBalance(balance: InjectedWalletBalance): boolean {
	return balance.asset === 'AO' && (balance.network === 'ao-legacynet' || balance.network === 'ao-mainnet');
}

function visibleInjectedBalance(balance: InjectedWalletBalance): VisibleWalletBalance {
	return {
		atomicBalance: balance.atomicBalance === null ? null : BigInt(balance.atomicBalance),
		denomination: balance.denomination,
		...(balance.error ? { error: balance.error } : {}),
	};
}

/**
 * Read the extension-owned built-in balances only when PermawebOS is the wallet
 * Bazar actually selected. A separately installed PermawebOS account must not
 * leak into a Wander or local-keyfile session.
 */
export async function readPermawebOsBalances(
	address: string,
	options: {
		scope?: BrowserWalletScope;
		signal?: AbortSignal;
		timeoutMs?: number;
	} = {}
): Promise<{ ar?: VisibleWalletBalance; ao?: VisibleWalletBalance } | undefined> {
	if (!ARWEAVE_ADDRESS.test(address)) throw new TypeError('invalid-wallet-address');
	const scope = options.scope ?? (typeof window === 'undefined' ? {} : window);
	const provider = scope.permawebConnect;
	if (!isBrowserWallet(provider) || scope.arweaveWallet !== provider || typeof provider.getBalances !== 'function') {
		return undefined;
	}
	const getBalances = provider.getBalances.bind(provider);

	const balances = await operationWithDeadline(
		async () => {
			if (typeof provider.getPermissions === 'function') {
				const permissions = await provider.getPermissions();
				if (
					!Array.isArray(permissions) ||
					!permissions.includes('ACCESS_ADDRESS') ||
					!permissions.includes('ACCESS_TOKENS')
				) {
					return undefined;
				}
			}
			return getBalances();
		},
		options.signal,
		{
			timeoutMs: options.timeoutMs ?? EXTENSION_BALANCE_TIMEOUT_MS,
			timeoutError: 'wallet-balances-timeout',
		}
	);
	if (balances === undefined) return undefined;
	if (scope.permawebConnect !== provider || scope.arweaveWallet !== provider) return undefined;
	if (!balances || typeof balances !== 'object' || Array.isArray(balances)) {
		throw new Error('wallet-balances-invalid');
	}
	const snapshot = balances as { version?: unknown; address?: unknown; balances?: unknown };
	if (
		snapshot.version !== 1 ||
		snapshot.address !== address ||
		!Array.isArray(snapshot.balances) ||
		snapshot.balances.length > 100
	) {
		throw new Error('wallet-balances-invalid');
	}
	const recognized = snapshot.balances
		.map(injectedWalletBalance)
		.filter((balance): balance is InjectedWalletBalance => !!balance);
	const ar = recognized.find(isArBalance);
	const ao = recognized.find(isAoBalance);
	return {
		...(ar ? { ar: visibleInjectedBalance(ar) } : {}),
		...(ao ? { ao: visibleInjectedBalance(ao) } : {}),
	};
}

/**
 * Visible balances may use the extension's policy-scoped wallet snapshot. AR
 * retains Bazar's existing gateway read as a compatibility fallback; callers
 * performing transaction preflight must continue to use a fresh direct read.
 */
export async function readVisibleWalletBalances(
	address: string,
	options: {
		fetch?: typeof fetch;
		gateway?: string;
		scope?: BrowserWalletScope;
		signal?: AbortSignal;
		timeoutMs?: number;
	} = {}
): Promise<VisibleWalletBalances> {
	let injected: Awaited<ReturnType<typeof readPermawebOsBalances>>;
	try {
		injected = await readPermawebOsBalances(address, {
			scope: options.scope,
			signal: options.signal,
			timeoutMs: options.timeoutMs,
		});
	} catch {
		// An old grant, old extension, or failed extension read keeps the current AR path.
	}
	if (injected?.ar?.atomicBalance !== null && injected?.ar?.atomicBalance !== undefined) {
		return { ar: injected.ar, ...(injected.ao ? { ao: injected.ao } : {}) };
	}

	try {
		const arBalance = await readWalletBalance(address, {
			fetch: options.fetch,
			gateway: options.gateway,
			signal: options.signal,
		});
		return {
			ar: { atomicBalance: arBalance, denomination: 12 },
			...(injected?.ao ? { ao: injected.ao } : {}),
		};
	} catch (error) {
		return {
			ar: {
				atomicBalance: null,
				denomination: 12,
				error: error instanceof Error ? error.message : 'wallet-balance-unavailable',
			},
			...(injected?.ao ? { ao: injected.ao } : {}),
		};
	}
}
