import { describe, expect, it } from 'vitest';

import type { SwapOrder } from './asset-marketplace';
import {
	formatTokenAmount,
	matchWholeOrders,
	parseTokenAmount,
} from './order-matching';

describe('token amount conversion', () => {
	it('parses and formats 12-decimal amounts exactly', () => {
		expect(parseTokenAmount('1.234567890123', 12)).toBe('1234567890123');
		expect(parseTokenAmount('9007199254740993.000000000001', 12))
			.toBe('9007199254740993000000000001');
		expect(formatTokenAmount('9007199254740993000000000001', 12))
			.toBe('9007199254740993.000000000001');
		expect(formatTokenAmount('1234000000000', 12)).toBe('1.234');
	});

	it('rejects precision loss rather than rounding', () => {
		expect(() => parseTokenAmount('1.0000000000001', 12))
			.toThrow('token-amount-exceeds-denomination');
		expect(() => parseTokenAmount('1e3', 12)).toThrow('invalid-token-amount');
	});
});

describe('whole-order matching', () => {
	it('matches several complete orders at exact quantity without overfill', () => {
		const two = swapOrder('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '2', '2', 2);
		const one = swapOrder('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', '1', '2', 3);
		const tooLarge = swapOrder('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC', '4', '1', 1);
		const result = matchWholeOrders([one, tooLarge, two], '3');

		expect(result).toEqual({
			orders: [two, one],
			quantity: '3',
			totalAsking: '4',
		});
	});

	it('chooses the least expensive exact whole-lot combination', () => {
		const entire = swapOrder('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '3', '5', 4);
		const two = swapOrder('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', '2', '2', 1);
		const one = swapOrder('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC', '1', '2', 2);
		const result = matchWholeOrders([one, entire, two], '3');
		expect(result?.orders.map((order) => order.orderId)).toEqual([two.orderId, one.orderId]);
		expect(result?.totalAsking).toBe('4');
	});

	it('returns no match when only an overfilling whole lot is available', () => {
		expect(matchWholeOrders([
			swapOrder('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '2', '1', 1),
		], '1')).toBeNull();
	});

	it('ignores reserved orders when matching', () => {
		const reserved = swapOrder('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '1', '1', 1);
		reserved.status = 'reserved';
		expect(matchWholeOrders([reserved], '1')).toBeNull();
	});

	it('bounds exact-search state growth on adversarial order books', () => {
		const orders = Array.from({ length: 14 }, (_, index) => {
			const quantity = (2n ** BigInt(index)).toString();
			return swapOrder(String(index).padStart(43, '0'), quantity, quantity, index);
		});
		expect(() => matchWholeOrders(orders, '16383')).toThrow('order-match-search-limit');
	});
});

function swapOrder(
	orderId: string,
	quantity: string,
	asking: string,
	createdAt: number
): SwapOrder {
	return {
		orderId,
		creator: '1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw',
		recipient: '1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw',
		asking,
		deposit: '0',
		minimumFee: '0',
		deadline: 100,
		createdAt,
		quantity,
		status: 'open',
	};
}
