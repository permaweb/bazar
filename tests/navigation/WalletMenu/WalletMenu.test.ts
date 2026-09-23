import { describe, expect, it } from 'vitest';

import { WALLET_MENU_MESSAGES } from 'navigation/WalletMenu/messages';
import { arBalanceLabel, tokenBalanceLabel, walletMenuLabel } from 'navigation/WalletMenu/WalletMenu';

const language = WALLET_MENU_MESSAGES.en;

describe('wallet menu identity', () => {
	it('shows only a known profile name and preserves the address fallback', () => {
		const address = `${'a'.repeat(38)}12345`;
		expect(walletMenuLabel(address, 'Agent Smith', language.walletMenuConnectShort)).toBe('Agent Smith');
		expect(walletMenuLabel(address, undefined, language.walletMenuConnectShort)).toBe(`${'a'.repeat(6)}…12345`);
		expect(walletMenuLabel(undefined, undefined, language.walletMenuConnectShort)).toBe('Connect');
	});
});

describe('wallet AR balance', () => {
	it('formats winston as AR fixed to four decimal places', () => {
		expect(arBalanceLabel(0n, 'ready', language)).toBe('0.0000 AR');
		expect(arBalanceLabel(1_234_567_890_123n, 'ready', language)).toBe('1.2346 AR');
		expect(arBalanceLabel(12_000_000_000_000n, 'ready', language)).toBe('12.0000 AR');
		expect(arBalanceLabel(999_950_000_000n, 'ready', language)).toBe('1.0000 AR');
	});

	it('labels pending and unavailable balances', () => {
		expect(arBalanceLabel(null, 'loading', language)).toBe(language.walletMenuBalanceLoading);
		expect(arBalanceLabel(null, 'error', language)).toBe(language.walletMenuBalanceUnavailable);
	});

	it('formats extension balances using the denomination supplied with each token', () => {
		expect(tokenBalanceLabel(12_345n, 'ready', 'AO', 3, language)).toBe('12.3450 AO');
		expect(tokenBalanceLabel(999_950n, 'ready', 'AO', 6, language)).toBe('1.0000 AO');
	});
});
