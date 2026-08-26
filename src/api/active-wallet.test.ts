import { afterEach, describe, expect, it } from 'vitest';

import { clearActiveWallet, getActiveWallet, selectActiveWallet } from './active-wallet';

function wallet() {
	return {
		connect: async () => undefined,
		sign: async (transaction: unknown) => transaction,
	};
}

afterEach(() => clearActiveWallet());

describe('active wallet adapter', () => {
	it('retains Bazar selection without changing an injected browser provider', () => {
		const wander = wallet();
		const permawebOs = wallet();
		const scope = { arweaveWallet: wander };

		selectActiveWallet(permawebOs);

		expect(getActiveWallet()).toBe(permawebOs);
		expect(scope.arweaveWallet).toBe(wander);
	});

	it('does not let a stale provider clear a newer selection', () => {
		const oldWallet = wallet();
		const currentWallet = wallet();
		selectActiveWallet(currentWallet);

		expect(clearActiveWallet(oldWallet)).toBe(false);
		expect(getActiveWallet()).toBe(currentWallet);
	});
});
