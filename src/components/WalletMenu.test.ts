import { describe, expect, it } from 'vitest';

import { arBalanceLabel, walletMenuLabel } from './WalletMenu';

describe('wallet menu identity', () => {
	it('shows only a known profile name and preserves the address fallback', () => {
		const address = `${'a'.repeat(38)}12345`;
		expect(walletMenuLabel(address, 'Agent Smith')).toBe('Agent Smith');
		expect(walletMenuLabel(address)).toBe(`${'a'.repeat(6)}…12345`);
		expect(walletMenuLabel()).toBe('Connect');
	});
});

describe('wallet AR balance', () => {
	it('formats winston as AR fixed to four decimal places', () => {
		expect(arBalanceLabel(0n, 'ready')).toBe('0.0000 AR');
		expect(arBalanceLabel(1_234_567_890_123n, 'ready')).toBe('1.2346 AR');
		expect(arBalanceLabel(12_000_000_000_000n, 'ready')).toBe('12.0000 AR');
		expect(arBalanceLabel(999_950_000_000n, 'ready')).toBe('1.0000 AR');
	});

	it('labels pending and unavailable balances', () => {
		expect(arBalanceLabel(null, 'loading')).toBe('Loading…');
		expect(arBalanceLabel(null, 'error')).toBe('Unavailable');
	});
});
