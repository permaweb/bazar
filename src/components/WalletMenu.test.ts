import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
	arBalanceLabel,
	tokenBalanceLabel,
	walletBalancesNeedRetry,
	walletMenuDangerAction,
	walletMenuLabel,
	WalletMenuPanel,
	type WalletMenuPanelProps,
	walletTriggerAria,
	walletTriggerName,
} from './WalletMenu';

function withGermanBigIntGrouping(run: () => void) {
	const original = BigInt.prototype.toLocaleString;
	// de-DE groups with '.', which must never meet the fixed '.' decimal.
	BigInt.prototype.toLocaleString = function (this: bigint) {
		return this.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	};
	try {
		run();
	} finally {
		BigInt.prototype.toLocaleString = original;
	}
}

describe('wallet menu balance retry', () => {
	it('retries on open only when a balance reads as Unavailable', () => {
		expect(walletBalancesNeedRetry('error', 'idle')).toBe(true);
		expect(walletBalancesNeedRetry('ready', 'error')).toBe(true);
		expect(walletBalancesNeedRetry('ready', 'ready')).toBe(false);
		expect(walletBalancesNeedRetry('loading', 'idle')).toBe(false);
	});
});

describe('wallet menu identity', () => {
	it('shows only a known profile name and preserves the address fallback', () => {
		const address = `${'a'.repeat(38)}12345`;
		expect(walletMenuLabel(address, 'Agent Smith')).toBe('Agent Smith');
		expect(walletMenuLabel(address)).toBe(`${'a'.repeat(6)}…12345`);
		expect(walletMenuLabel()).toBe('Connect');
	});

	it('does not offer Connect while the saved wallet session is still being restored', () => {
		const address = `${'a'.repeat(38)}12345`;
		expect(walletMenuLabel(null, null, 'restoring')).toBe('Wallet…');
		expect(walletMenuLabel(null, null, 'disconnected')).toBe('Connect');
		expect(walletMenuLabel(address, 'Agent Smith', 'connected')).toBe('Agent Smith');
	});
});

describe('wallet menu danger action', () => {
	it('offers a keyfile download and a confirmed removal for a local keyfile wallet', () => {
		expect(walletMenuDangerAction('local')).toEqual({
			heading: 'Keyfile wallet, stored only in this browser',
			label: 'Remove keyfile…',
			busyLabel: 'Removing…',
			needsConfirm: true,
			showsExport: true,
		});
	});

	it('keeps one-click Disconnect for browser wallets', () => {
		for (const kind of ['browser', null] as const) {
			expect(walletMenuDangerAction(kind)).toEqual({
				heading: 'Connected wallet',
				label: 'Disconnect',
				busyLabel: 'Disconnecting…',
				needsConfirm: false,
				showsExport: false,
			});
		}
	});
});

describe('wallet AR balance', () => {
	it('groups large balances with fixed commas in every locale', () => {
		withGermanBigIntGrouping(() => {
			expect(arBalanceLabel(1_234_500_000_000_000n, 'ready')).toBe('1,234.5000 AR');
			expect(tokenBalanceLabel(1_234_567_000n, 'ready', 'AO', 3)).toBe('1,234,567.0000 AO');
		});
	});

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

	it('formats extension balances using the denomination supplied with each token', () => {
		expect(tokenBalanceLabel(12_345n, 'ready', 'AO', 3)).toBe('12.3450 AO');
		expect(tokenBalanceLabel(999_950n, 'ready', 'AO', 6)).toBe('1.0000 AO');
	});
});

const address = `${'a'.repeat(38)}12345`;

function renderPanel(overrides: Partial<WalletMenuPanelProps> = {}) {
	const noop = () => undefined;
	return renderToStaticMarkup(
		React.createElement(WalletMenuPanel, {
			aoBalance: '1.0000 AO',
			arBalance: '2.0000 AR',
			copied: false,
			dangerAction: walletMenuDangerAction('local'),
			disconnecting: false,
			error: '',
			id: 'wallet-panel',
			label: 'Agent Smith',
			onCopyAddress: noop,
			onDisconnect: noop,
			onDownloadKeyfile: noop,
			onOpenProfile: noop,
			onSelectTheme: noop,
			themePreference: 'dimmed',
			...overrides,
		})
	);
}

describe('wallet menu trigger', () => {
	it('starts its accessible name with the visible label and then names the full address', () => {
		for (const displayName of ['Agent Smith', null]) {
			const name = walletTriggerName(address, displayName);
			expect(name.startsWith(walletMenuLabel(address, displayName))).toBe(true);
			expect(name).toContain(address);
		}
		expect(walletTriggerName(address, 'Agent Smith')).toBe(`Agent Smith, wallet ${address}`);
		expect(walletTriggerName(null).startsWith(walletMenuLabel(null))).toBe(true);
		expect(walletTriggerName(null)).toBe('Connect wallet');
	});

	it('names a restoring trigger with its visible label and never as Connect wallet', () => {
		const name = walletTriggerName(null, null, 'restoring');
		expect(name.startsWith(walletMenuLabel(null, null, 'restoring'))).toBe(true);
		expect(name).toContain('checking wallet connection');
		expect(name).not.toContain('Connect');
		expect(walletTriggerAria({ address: null, connectionStatus: 'restoring', open: false, panelId: 'p' })).toEqual({
			'aria-label': name,
		});
		expect(walletTriggerName(null, null, 'disconnected')).toBe('Connect wallet');
	});

	it('is a disclosure: aria-expanded always, aria-controls only while the panel is open, never a popup menu', () => {
		const closed = walletTriggerAria({ address, open: false, panelId: 'wallet-panel' });
		expect(closed).toEqual({
			'aria-controls': undefined,
			'aria-expanded': false,
			'aria-label': walletTriggerName(address),
		});
		const opened = walletTriggerAria({ address, displayName: 'Agent Smith', open: true, panelId: 'wallet-panel' });
		expect(opened['aria-expanded']).toBe(true);
		expect(opened['aria-controls']).toBe('wallet-panel');
		expect(renderPanel()).toContain('id="wallet-panel"');
		expect(opened).not.toHaveProperty('aria-haspopup');
		expect(walletTriggerAria({ address: null, open: false, panelId: 'wallet-panel' })).toEqual({
			'aria-label': 'Connect wallet',
		});
	});
});

describe('wallet menu panel', () => {
	it('renders a labelled section of plain buttons with no menu roles', () => {
		const markup = renderPanel();
		expect(markup).toMatch(/^<section aria-label="Wallet options" class="wallet-dropdown" id="wallet-panel">/);
		expect(markup).not.toContain('role="menu');
		expect(markup).not.toContain('aria-checked');
		expect(markup).not.toContain('aria-haspopup');
		const buttons = markup.match(/<button[^>]*>/g) ?? [];
		// My profile, Copy address, Download keyfile, four themes, Remove keyfile.
		expect(buttons).toHaveLength(8);
		for (const button of buttons) expect(button).toContain('wallet-dropdown-item');
	});

	it('marks only the active theme as pressed', () => {
		const markup = renderPanel({ themePreference: 'dimmed' });
		expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
		expect(markup.match(/aria-pressed="false"/g)).toHaveLength(3);
		expect(markup).toMatch(/<button aria-pressed="true" class="[^"]*\bis-active\b[^"]*"[^>]*>.*?Dimmed/);
	});

	it('announces a successful copy in a polite status region', () => {
		expect(renderPanel()).toContain('role="status"></span>');
		expect(renderPanel({ copied: true })).toContain('role="status">Address copied.</span>');
	});

	it('styles the dropdown rows by class, not by menu roles', () => {
		const css = readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
		expect(css).not.toMatch(/menuitem/);
		expect(css).toContain('.wallet-dropdown button.wallet-dropdown-item {');
		expect(css).toContain('.wallet-dropdown button.wallet-dropdown-item.is-active {');
	});
});
