import { describe, expect, it } from 'vitest';

import { accountAddress, displayAccount, fromHostAccount, sameAccount, toHostAccount } from './host-account';
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
});
