import { describe, expect, it } from 'vitest';

import {
	accountAddress,
	displayAccount,
	fromHostAccount,
	isWalletAddress,
	sameAccount,
	shortAccount,
	toHostAccount,
} from './host-account';
import vectors from './host-account.vectors.json';

describe('HyperBEAM host account encoding', () => {
	it.each(vectors.valid)('matches Erlang encode/decode for $raw', ({ raw, host }) => {
		expect(toHostAccount(raw)).toBe(host);
		expect(fromHostAccount(host)).toBe(raw);
		expect(sameAccount(raw, host)).toBe(true);
		expect(sameAccount(host, raw)).toBe(true);
	});

	it.each(vectors.invalidHostAccounts)('rejects invalid or non-000 account label %s', (host) => {
		expect(fromHostAccount(host)).toBeNull();
	});

	it.each([
		'',
		'a'.repeat(42),
		'A'.repeat(44),
		'a'.repeat(43),
		`${'A'.repeat(42)}=`,
		` ${'A'.repeat(43)}`,
		`${'A'.repeat(43)}\n`,
		'é'.repeat(43),
	])('rejects a noncanonical raw account %s', (raw) => expect(toHostAccount(raw)).toBeNull());

	it('distinguishes case and underscores without rewriting other identity forms', () => {
		const { raw, host } = vectors.valid[0];
		expect(sameAccount(raw.toLowerCase(), host)).toBe(false);
		const underscored = vectors.valid[5];
		expect(sameAccount(underscored.raw.replaceAll('_', '-'), underscored.host)).toBe(false);
		for (const other of [
			'0x1234567890123456789012345678901234567890',
			'S'.repeat(44),
			`did:pkh:solana:mainnet:${'S'.repeat(44)}`,
		]) {
			expect(toHostAccount(other)).toBeNull();
			expect(fromHostAccount(other)).toBeNull();
			expect(accountAddress(other)).toBe(other);
			expect(sameAccount(other, other)).toBe(true);
		}
		expect(sameAccount(undefined, undefined)).toBe(false);
		expect(sameAccount('', '')).toBe(false);
	});

	it('displays raw addresses for Arweave and Ethereum host accounts', () => {
		const { raw, host } = vectors.valid[0];
		const ethereum = '0xbd8ee4a54fa820421b272e0d51c48068aed08c4f';
		expect(displayAccount(host)).toBe(raw);
		expect(displayAccount(raw)).toBe(raw);
		expect(displayAccount(`uri-did-pkh-eip155-1-${ethereum}`)).toBe(ethereum);
		const nonCanonical = 'uri-did-pkh-eip155-1-0xBD8EE4A54FA820421B272E0D51C48068AED08C4F';
		expect(displayAccount(nonCanonical)).toBe(nonCanonical);
	});

	it.each(vectors.valid)('shortens the host form $host to the same label as its raw address', ({ raw, host }) => {
		expect(shortAccount(raw)).toBe(`${raw.slice(0, 7)}…${raw.slice(-5)}`);
		expect(shortAccount(host)).toBe(shortAccount(raw));
		expect(shortAccount(host)).not.toContain('uri-di');
	});

	it('shortens Ethereum host accounts to their address and keeps short values whole', () => {
		const ethereum = '0xbd8ee4a54fa820421b272e0d51c48068aed08c4f';
		expect(shortAccount(`uri-did-pkh-eip155-1-${ethereum}`)).toBe('0xbd8ee…08c4f');
		expect(shortAccount('actor')).toBe('actor');
		expect(shortAccount('a'.repeat(14))).toBe('a'.repeat(14));
	});
});

describe('wallet address check', () => {
	it.each(vectors.valid)('accepts the canonical address $raw', ({ raw }) => {
		expect(isWalletAddress(raw)).toBe(true);
	});

	it('accepts exactly the 16 canonical final characters', () => {
		const prefix = vectors.valid[2].raw.slice(0, 42);
		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
		const accepted = [...alphabet].filter((last) => isWalletAddress(`${prefix}${last}`));
		expect(accepted.join('')).toBe('AEIMQUYcgkosw048');
	});

	it.each([
		'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwB',
		'b'.repeat(43),
		'a'.repeat(42),
		`${'A'.repeat(43)}\n`,
		` ${'A'.repeat(43)}`,
		'0xbd8ee4a54fa820421b272e0d51c48068aed08c4f',
		vectors.valid[0].host,
	])('rejects %j', (value) => {
		expect(isWalletAddress(value)).toBe(false);
	});

	it('rejects non-strings', () => {
		expect(isWalletAddress(undefined)).toBe(false);
		expect(isWalletAddress(null)).toBe(false);
		expect(isWalletAddress(42)).toBe(false);
	});
});
