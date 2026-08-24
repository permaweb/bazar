import { describe, expect, it, vi } from 'vitest';

import {
	BROWSER_WALLET_PERMISSIONS,
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
