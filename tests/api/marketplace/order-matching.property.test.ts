import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { formatTokenAmount, parseTokenAmount } from 'api/marketplace/order-matching';

describe('token amount parsing', () => {
	it('round-trips atomic quantities through the human form for any denomination', () => {
		fc.assert(
			fc.property(
				fc.bigInt({ min: 0n, max: 10n ** 40n }),
				fc.integer({ min: 0, max: 24 }),
				(atomic, denomination) => {
					const value = atomic.toString();
					expect(parseTokenAmount(formatTokenAmount(value, denomination), denomination)).toBe(value);
				}
			)
		);
	});

	it('rejects more fractional digits than the denomination allows', () => {
		fc.assert(
			fc.property(fc.integer({ min: 0, max: 18 }), (denomination) => {
				expect(() => parseTokenAmount(`1.${'1'.repeat(denomination + 1)}`, denomination)).toThrow();
			})
		);
	});
});
