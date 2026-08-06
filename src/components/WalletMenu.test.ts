import { describe, expect, it } from 'vitest';

import { arBalanceLabel } from './WalletMenu';

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
