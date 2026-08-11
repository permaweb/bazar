import { describe, expect, it } from 'vitest';

import type { SwapOrder } from './asset-marketplace';
import {
	filledOrder,
	formatTokenAmount,
	matchOrderFills,
	matchSortedOrderFills,
	parseTokenAmount,
} from './order-matching';

describe('token amount conversion', () => {
	it('parses and formats 12-decimal amounts exactly', () => {
		expect(parseTokenAmount('1.234567890123', 12)).toBe('1234567890123');
		expect(parseTokenAmount('9007199254740993.000000000001', 12)).toBe('9007199254740993000000000001');
		expect(formatTokenAmount('9007199254740993000000000001', 12)).toBe('9007199254740993.000000000001');
		expect(formatTokenAmount('1234000000000', 12)).toBe('1.234');
	});

	it('rejects precision loss rather than rounding', () => {
		expect(() => parseTokenAmount('1.0000000000001', 12)).toThrow('token-amount-exceeds-denomination');
		expect(() => parseTokenAmount('1e3', 12)).toThrow('invalid-token-amount');
	});
});

describe('partial order matching', () => {
	it('fills across cheapest orders and slices only the final order', () => {
		const two = swapOrder('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '2', '2', 2);
		const one = swapOrder('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', '1', '2', 3);
		const four = swapOrder('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC', '4', '4', 1);
		const result = matchOrderFills([one, four, two], '3');

		expect(
			result?.fills.map(({ order, partial }) => ({ id: order.orderId, quantity: order.quantity, partial }))
		).toEqual([{ id: four.orderId, quantity: '3', partial: true }]);
		expect(result).toMatchObject({ quantity: '3', totalAsking: '3' });
	});

	it('uses whole cheap orders before taking a partial dearer order', () => {
		const cheap = swapOrder('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '2', '2', 1);
		const dear = swapOrder('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', '5', '10', 2);
		const result = matchOrderFills([dear, cheap], '4');
		expect(result?.fills.map((fill) => [fill.order.quantity, fill.order.asking, fill.partial])).toEqual([
			['2', '2', false],
			['2', '4', true],
		]);
		expect(result?.totalAsking).toBe('6');
	});

	it('matches an already sorted book without changing its price order', () => {
		const cheap = swapOrder('A'.repeat(43), '2', '2', 1);
		const dear = swapOrder('B'.repeat(43), '5', '10', 2);
		expect(matchSortedOrderFills([cheap, dear], '4')?.fills.map((fill) => fill.sourceOrder.orderId)).toEqual([
			cheap.orderId,
			dear.orderId,
		]);
	});

	it('fills one unit from a larger order', () => {
		const order = swapOrder('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '5', '15', 1);
		expect(matchOrderFills([order], '1')?.fills[0].order).toMatchObject({ quantity: '1', asking: '3' });
	});

	it('ignores reserved orders when matching', () => {
		const reserved = swapOrder('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '1', '1', 1);
		reserved.status = 'reserved';
		expect(matchOrderFills([reserved], '1')).toBeNull();
	});

	it('rounds every economic term exactly as the device does', () => {
		const order = { ...swapOrder('A'.repeat(43), '5', '503', 1), minimumFee: '7', deposit: '11' };
		expect(filledOrder(order, '3')).toMatchObject({ quantity: '3', asking: '302', minimumFee: '5', deposit: '7' });
	});

	it('rejects an oversized live book before consuming or sorting its tail', () => {
		let consumed = 0;
		function* oversizedBook() {
			for (let index = 0; index < 100_000; index += 1) {
				consumed += 1;
				yield swapOrder(String(index).padStart(43, '0'), '1', `${100_000 - index}`, index);
			}
		}

		expect(() => matchOrderFills(oversizedBook(), '1')).toThrow('order-match-search-limit');
		expect(consumed).toBe(10_001);
	});
});

function swapOrder(orderId: string, quantity: string, asking: string, createdAt: number): SwapOrder {
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
