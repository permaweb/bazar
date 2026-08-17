import { describe, expect, it, vi } from 'vitest';

import { readWalletBalance, resolveBrowserWallet } from './wallet';

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
	it('selects The Fold through its stable provider without replacing Wander', () => {
		const theFold = injectedWallet();
		const wander = injectedWallet();
		const scope = { arweaveWallet: wander, permawebConnect: theFold };

		expect(resolveBrowserWallet(scope, 'the-fold')).toBe(theFold);
		expect(resolveBrowserWallet(scope, 'wander')).toBe(wander);
	});

	it("does not present The Fold's compatibility alias as Wander", () => {
		const theFold = injectedWallet();

		expect(resolveBrowserWallet({ arweaveWallet: theFold, permawebConnect: theFold }, 'wander')).toBeUndefined();
		expect(resolveBrowserWallet({ arweaveWallet: theFold, permawebConnect: theFold }, 'the-fold')).toBe(theFold);
	});

	it('rejects malformed injected providers at the browser boundary', () => {
		expect(
			resolveBrowserWallet({ permawebConnect: { connect: async () => undefined } }, 'the-fold')
		).toBeUndefined();
	});
});
