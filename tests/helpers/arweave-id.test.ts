import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { ARWEAVE_ID_PATTERN, isArweaveId } from 'helpers/arweave-id';

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const base64urlChar = fc.constantFrom(...BASE64URL.split(''));

describe('isArweaveId', () => {
	it('accepts every 43-character base64url string', () => {
		fc.assert(
			fc.property(fc.array(base64urlChar, { minLength: 43, maxLength: 43 }), (chars) => {
				expect(isArweaveId(chars.join(''))).toBe(true);
			})
		);
	});

	it('rejects other lengths', () => {
		fc.assert(
			fc.property(
				fc.array(base64urlChar, { maxLength: 80 }).filter((chars) => chars.length !== 43),
				(chars) => {
					expect(isArweaveId(chars.join(''))).toBe(false);
				}
			)
		);
	});

	it('rejects 43-character strings containing characters outside base64url', () => {
		fc.assert(
			fc.property(
				fc.array(base64urlChar, { minLength: 42, maxLength: 42 }),
				fc.nat({ max: 42 }),
				fc.constantFrom('+', '/', '=', ' ', '.', 'é', '\n'),
				(chars, index, invalid) => {
					const candidate = [...chars.slice(0, index), invalid, ...chars.slice(index)].join('');
					expect(isArweaveId(candidate)).toBe(false);
				}
			)
		);
	});

	it('rejects non-string values', () => {
		for (const value of [undefined, null, 43, {}, ['A'.repeat(43)]]) expect(isArweaveId(value)).toBe(false);
		expect(ARWEAVE_ID_PATTERN.test('A'.repeat(43))).toBe(true);
	});
});
