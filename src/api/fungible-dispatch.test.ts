import { describe, expect, it } from 'vitest';

import {
	estimateDispatchCost,
	isDispatchPlan,
	loadDispatchPlan,
	parseHolderList,
	planTotals,
	requiresCostConfirmation,
	saveDispatchPlan,
} from './fungible-dispatch';

const addressA = 'A'.repeat(43);
const addressB = 'B'.repeat(43);
const processId = 'P'.repeat(43);
const sender = 'S'.repeat(43);

function memoryStorage() {
	const held = new Map<string, string>();
	return {
		getItem: (key: string) => held.get(key) ?? null,
		setItem: (key: string, value: string) => void held.set(key, value),
		removeItem: (key: string) => void held.delete(key),
	};
}

describe('parseHolderList', () => {
	it('parses a JSON array of address/quantity records', () => {
		const parsed = parseHolderList(
			JSON.stringify([
				{ address: addressA, quantity: '10' },
				{ address: addressB, quantity: 250000 },
			])
		);
		expect(parsed.errors).toEqual([]);
		expect(parsed.rows).toEqual([
			{ address: addressA, quantity: '10' },
			{ address: addressB, quantity: '250000' },
		]);
	});

	it('parses JSON pair arrays and object maps', () => {
		expect(parseHolderList(JSON.stringify([[addressA, '7']])).rows).toEqual([{ address: addressA, quantity: '7' }]);
		expect(parseHolderList(JSON.stringify({ [addressA]: '3', [addressB]: '4' })).rows).toEqual([
			{ address: addressA, quantity: '3' },
			{ address: addressB, quantity: '4' },
		]);
	});

	it('parses CSV lines with comments and blank lines', () => {
		const parsed = parseHolderList(`# holders\n\n${addressA}, 5\n${addressB},1\n`);
		expect(parsed.errors).toEqual([]);
		expect(parsed.rows).toEqual([
			{ address: addressA, quantity: '5' },
			{ address: addressB, quantity: '1' },
		]);
	});

	it('rejects invalid addresses, non-positive quantities, and empty input', () => {
		expect(parseHolderList('not-an-address,5').errors).toHaveLength(1);
		expect(parseHolderList(`${addressA},0`).errors).toHaveLength(1);
		expect(parseHolderList(`${addressA},1.5`).errors).toHaveLength(1);
		expect(parseHolderList(`${addressA},-2`).errors).toHaveLength(1);
		expect(parseHolderList('   ').errors).toHaveLength(1);
		expect(parseHolderList('{broken').errors).toHaveLength(1);
	});

	it('rejects duplicate addresses and names them', () => {
		const parsed = parseHolderList(`${addressA},1\n${addressB},2\n${addressA},3`);
		expect(parsed.rows).toEqual([]);
		expect(parsed.errors).toHaveLength(1);
		expect(parsed.errors[0]).toContain(addressA);
		expect(parsed.errors[0]).not.toContain(addressB);
	});

	it('keeps quantities bigint-safe beyond Number precision', () => {
		const parsed = parseHolderList(`${addressA},123456789012345678901234567890`);
		expect(parsed.errors).toEqual([]);
		expect(parsed.rows[0].quantity).toBe('123456789012345678901234567890');
		expect(planTotals(parsed.rows).totalQuantity).toBe(123456789012345678901234567890n);
	});
});

describe('dispatch cost estimate', () => {
	it('adds token units (paid in winston) and per-transfer rewards', () => {
		const rows = [
			{ address: addressA, quantity: '250000' },
			{ address: addressB, quantity: '750000' },
		];
		const estimate = estimateDispatchCost(rows, 1000n);
		expect(estimate.totalQuantity).toBe(1_000_000n);
		expect(estimate.totalReward).toBe(2000n);
		expect(estimate.totalWinston).toBe(1_002_000n);
	});

	it('requires confirmation above 0.1 AR only', () => {
		expect(requiresCostConfirmation(100_000_000_000n)).toBe(false);
		expect(requiresCostConfirmation(100_000_000_001n)).toBe(true);
	});
});

describe('dispatch plan persistence', () => {
	const plan = {
		processId,
		sender,
		createdAt: 1,
		baseline: { [addressA]: '0' },
		rows: [{ address: addressA, quantity: '10', status: 'unsent' as const }],
	};

	it('round-trips a valid plan keyed by process id', () => {
		const storage = memoryStorage();
		saveDispatchPlan(plan, storage);
		expect(loadDispatchPlan(processId, storage)).toEqual(plan);
		expect(loadDispatchPlan(addressA, storage)).toBeNull();
	});

	it('rejects malformed plans', () => {
		expect(isDispatchPlan(plan)).toBe(true);
		expect(isDispatchPlan({ ...plan, rows: [] })).toBe(false);
		expect(isDispatchPlan({ ...plan, baseline: {} })).toBe(false);
		expect(isDispatchPlan({ ...plan, rows: [{ ...plan.rows[0], status: 'weird' }] })).toBe(false);
		expect(isDispatchPlan({ ...plan, sender: 'short' })).toBe(false);
	});
});
