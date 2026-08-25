import { describe, expect, it, vi } from 'vitest';

import {
	BROWSER_WALLET_PERMISSIONS,
	PERMAWEB_OS_WALLET_PERMISSIONS,
	readPermawebOsBalances,
	readVisibleWalletBalances,
	readWalletBalance,
	resolveBrowserWallet,
	restoreBrowserWalletConnection,
} from './wallet';

function injectedWallet() {
	return {
		connect: vi.fn(async () => undefined),
		getActiveAddress: vi.fn(async () => 'A'.repeat(43)),
		sign: vi.fn(async (transaction: unknown) => transaction),
	};
}

describe('readWalletBalance', () => {
	it('reads and validates a winston balance without loading transaction tooling', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response('1234', { status: 200 }));
		await expect(
			readWalletBalance('A'.repeat(43), { fetch: fetcher, gateway: 'https://node.example' })
		).resolves.toBe(1234n);
		expect(fetcher).toHaveBeenCalledWith(
			`https://node.example/wallet/${'A'.repeat(43)}/balance`,
			expect.objectContaining({ signal: undefined })
		);
	});
});

describe('PermawebOS visible balances', () => {
	const address = 'A'.repeat(43);
	const extension = (balances: unknown, permissions = PERMAWEB_OS_WALLET_PERMISSIONS) => ({
		...injectedWallet(),
		getActiveAddress: vi.fn(async () => address),
		getPermissions: vi.fn(async () => [...permissions]),
		getBalances: vi.fn(async () => ({ version: 1, address, balances })),
	});

	it('accepts canonical atomic AR and AO balances only from the selected PermawebOS account', async () => {
		const provider = extension([
			{
				asset: 'AR',
				network: 'arweave-mainnet',
				denomination: 12,
				atomicBalance: '1234',
			},
			{
				asset: 'AO',
				network: 'ao-mainnet',
				denomination: 12,
				atomicBalance: '5678',
			},
		]);

		await expect(
			readPermawebOsBalances(address, { scope: { arweaveWallet: provider, permawebConnect: provider } })
		).resolves.toEqual({
			ar: { atomicBalance: 1234n, denomination: 12 },
			ao: { atomicBalance: 5678n, denomination: 12 },
		});
	});

	it('does not read a separately installed PermawebOS account during a Wander session', async () => {
		const provider = extension([]);
		const wander = injectedWallet();

		await expect(
			readPermawebOsBalances(address, { scope: { arweaveWallet: wander, permawebConnect: provider } })
		).resolves.toBeUndefined();
		expect(provider.getBalances).not.toHaveBeenCalled();
	});

	it('preserves an old PermawebOS grant by declining the optional capability until ACCESS_TOKENS is granted', async () => {
		const provider = extension([], BROWSER_WALLET_PERMISSIONS);

		await expect(
			readPermawebOsBalances(address, { scope: { arweaveWallet: provider, permawebConnect: provider } })
		).resolves.toBeUndefined();
		expect(provider.getBalances).not.toHaveBeenCalled();
	});

	it('uses a valid extension snapshot without repeating its AR gateway request', async () => {
		const provider = extension([
			{
				asset: 'AR',
				network: 'arweave-mainnet',
				denomination: 12,
				atomicBalance: '42',
			},
		]);
		const fetcher = vi.fn();

		await expect(
			readVisibleWalletBalances(address, {
				fetch: fetcher,
				scope: { arweaveWallet: provider, permawebConnect: provider },
			})
		).resolves.toEqual({ ar: { atomicBalance: 42n, denomination: 12 } });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('retains direct gateway AR fallback while preserving a partial AO result', async () => {
		const provider = extension([
			{
				asset: 'AR',
				network: 'arweave-mainnet',
				denomination: 12,
				atomicBalance: null,
				error: 'AR unavailable',
			},
			{
				asset: 'AO',
				network: 'ao-legacynet',
				denomination: 12,
				atomicBalance: '5678',
			},
		]);
		const fetcher = vi.fn(async () => new Response('1234')) as typeof fetch;

		await expect(
			readVisibleWalletBalances(address, {
				fetch: fetcher,
				gateway: 'https://gateway.example',
				scope: { arweaveWallet: provider, permawebConnect: provider },
			})
		).resolves.toEqual({
			ar: { atomicBalance: 1234n, denomination: 12 },
			ao: { atomicBalance: 5678n, denomination: 12 },
		});
	});

	it('keeps an unavailable AO balance visible while falling back for AR', async () => {
		const provider = extension([
			{
				asset: 'AO',
				network: 'ao-legacynet',
				denomination: 12,
				atomicBalance: null,
				error: 'AO unavailable',
			},
		]);
		const fetcher = vi.fn(async () => new Response('5')) as typeof fetch;

		await expect(
			readVisibleWalletBalances(address, {
				fetch: fetcher,
				gateway: 'https://gateway.example',
				scope: { arweaveWallet: provider, permawebConnect: provider },
			})
		).resolves.toEqual({
			ar: { atomicBalance: 5n, denomination: 12 },
			ao: { atomicBalance: null, denomination: 12, error: 'AO unavailable' },
		});
	});

	it('declines malformed permission state without calling the balance capability', async () => {
		const provider = {
			...extension([]),
			getPermissions: vi.fn(async () => ({ ACCESS_TOKENS: true })),
		};

		await expect(
			readPermawebOsBalances(address, {
				scope: { arweaveWallet: provider, permawebConnect: provider },
			})
		).resolves.toBeUndefined();
		expect(provider.getBalances).not.toHaveBeenCalled();
	});

	it('discards a snapshot when another wallet becomes selected during the read', async () => {
		let resolveBalances!: (value: unknown) => void;
		const pendingBalances = new Promise((resolve) => {
			resolveBalances = resolve;
		});
		const provider = {
			...extension([]),
			getBalances: vi.fn(() => pendingBalances),
		};
		const scope = { arweaveWallet: provider as unknown, permawebConnect: provider as unknown };
		const pending = readPermawebOsBalances(address, { scope });
		await vi.waitFor(() => expect(provider.getBalances).toHaveBeenCalled());
		scope.arweaveWallet = injectedWallet();
		resolveBalances({ version: 1, address, balances: [] });

		await expect(pending).resolves.toBeUndefined();
	});

	it('falls back to the current AR gateway when the extension capability rejects', async () => {
		const provider = {
			...extension([]),
			getBalances: vi.fn(async () => {
				throw new Error('extension-unavailable');
			}),
		};
		const fetcher = vi.fn(async () => new Response('6')) as typeof fetch;

		await expect(
			readVisibleWalletBalances(address, {
				fetch: fetcher,
				gateway: 'https://gateway.example',
				scope: { arweaveWallet: provider, permawebConnect: provider },
			})
		).resolves.toEqual({ ar: { atomicBalance: 6n, denomination: 12 } });
	});

	it('rejects a malformed extension envelope and falls back without trusting display strings', async () => {
		const provider = {
			...extension([]),
			getBalances: vi.fn(async () => ({ version: 1, address, balances: { balance: '999999999' } })),
		};
		const fetcher = vi.fn(async () => new Response('7')) as typeof fetch;

		await expect(
			readVisibleWalletBalances(address, {
				fetch: fetcher,
				gateway: 'https://gateway.example',
				scope: { arweaveWallet: provider, permawebConnect: provider },
			})
		).resolves.toEqual({ ar: { atomicBalance: 7n, denomination: 12 } });
	});

	it('rejects a balance snapshot captured for an account that switched during the read', async () => {
		const provider = {
			...extension([]),
			getBalances: vi.fn(async () => ({ version: 1, address: 'C'.repeat(43), balances: [] })),
		};
		const fetcher = vi.fn(async () => new Response('9')) as typeof fetch;

		await expect(
			readVisibleWalletBalances(address, {
				fetch: fetcher,
				gateway: 'https://gateway.example',
				scope: { arweaveWallet: provider, permawebConnect: provider },
			})
		).resolves.toEqual({ ar: { atomicBalance: 9n, denomination: 12 } });
	});
});

describe('browser wallet selection', () => {
	it('selects PermawebOS through its stable provider without replacing Wander', () => {
		const permawebOs = injectedWallet();
		const wander = injectedWallet();
		const scope = { arweaveWallet: wander, permawebConnect: permawebOs };

		expect(resolveBrowserWallet(scope, 'permaweb-os')).toBe(permawebOs);
		expect(resolveBrowserWallet(scope, 'wander')).toBe(wander);
	});

	it("does not present PermawebOS's compatibility alias as Wander", () => {
		const permawebOs = injectedWallet();

		expect(
			resolveBrowserWallet({ arweaveWallet: permawebOs, permawebConnect: permawebOs }, 'wander')
		).toBeUndefined();
		expect(resolveBrowserWallet({ arweaveWallet: permawebOs, permawebConnect: permawebOs }, 'permaweb-os')).toBe(
			permawebOs
		);
	});

	it('rejects malformed injected providers at the browser boundary', () => {
		expect(
			resolveBrowserWallet({ permawebConnect: { connect: async () => undefined } }, 'permaweb-os')
		).toBeUndefined();
	});

	it('restores an authorized PermawebOS connection when no compatibility alias is available', async () => {
		const permawebOs = {
			...injectedWallet(),
			getPermissions: vi.fn(async () => BROWSER_WALLET_PERMISSIONS),
		};

		await expect(restoreBrowserWalletConnection({ permawebConnect: permawebOs })).resolves.toEqual({
			address: 'A'.repeat(43),
			wallet: permawebOs,
		});
	});

	it('restores the explicitly selected PermawebOS provider ahead of an injected Wander provider', async () => {
		const permawebOs = {
			...injectedWallet(),
			getPermissions: vi.fn(async () => BROWSER_WALLET_PERMISSIONS),
		};
		const wander = { ...injectedWallet(), getActiveAddress: vi.fn(async () => 'B'.repeat(43)) };

		await expect(
			restoreBrowserWalletConnection({ arweaveWallet: wander, permawebConnect: permawebOs }, 'permaweb-os')
		).resolves.toEqual({ address: 'A'.repeat(43), wallet: permawebOs });
	});

	it('does not silently restore PermawebOS when Bazar permissions are incomplete', async () => {
		const permawebOs = {
			...injectedWallet(),
			getPermissions: vi.fn(async () => ['ACCESS_ADDRESS']),
		};

		await expect(restoreBrowserWalletConnection({ permawebConnect: permawebOs })).resolves.toBeUndefined();
		expect(permawebOs.getActiveAddress).not.toHaveBeenCalled();
	});

	it('keeps an active Wander connection when PermawebOS was not explicitly selected', async () => {
		const permawebOs = {
			...injectedWallet(),
			getPermissions: vi.fn(async () => BROWSER_WALLET_PERMISSIONS),
		};
		const wander = { ...injectedWallet(), getActiveAddress: vi.fn(async () => 'B'.repeat(43)) };

		await expect(
			restoreBrowserWalletConnection({ arweaveWallet: wander, permawebConnect: permawebOs })
		).resolves.toEqual({ address: 'B'.repeat(43), wallet: wander });
		expect(permawebOs.getPermissions).not.toHaveBeenCalled();
	});
});
