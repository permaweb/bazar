import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { appErrorMessage, toAppError } from 'helpers/app-error';
import { arToWinston, winstonToArDecimal } from 'helpers/ar-units';

const winston = fc.bigInt({ min: 1n, max: 10n ** 30n }).map((value) => value.toString());

describe('AR unit conversion', () => {
	it('round-trips positive winston amounts through the plain decimal form', () => {
		fc.assert(
			fc.property(winston, (value) => {
				expect(arToWinston(winstonToArDecimal(value))).toBe(value);
			})
		);
	});

	it('preserves precision above Number.MAX_SAFE_INTEGER', () => {
		const value = (BigInt(Number.MAX_SAFE_INTEGER) * 1_000_000_000_000n + 1n).toString();
		expect(winstonToArDecimal(value)).toBe(`${Number.MAX_SAFE_INTEGER}.000000000001`);
		expect(arToWinston(winstonToArDecimal(value))).toBe(value);
	});

	it('rejects zero, negative, exponential, and over-precise AR input', () => {
		for (const input of ['0', '0.0', '-1', '1e3', '1.0000000000001', 'NaN', 'Infinity', '']) {
			expect(() => arToWinston(input)).toThrow(expect.objectContaining({ reason: 'ar-amount-invalid' }));
		}
		expect(appErrorMessage(toAppError('ar-amount-invalid', 'unknown'))).toBe('Enter a positive AR amount.');
	});
});
