import { describe, expect, it } from 'vitest';

import { SIGNED_TRANSACTION_PREFIX } from './asset-transactions';
import {
	createDispatchPlan,
	discardDispatchPlan,
	dispatchDiscardConfirmation,
	dispatchPlanProgress,
	type DispatchRow,
	dispatchRowInFlight,
	dispatchRowPending,
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
			]),
			3
		);
		expect(parsed.errors).toEqual([]);
		expect(parsed.rows).toEqual([
			{ address: addressA, quantity: '10000' },
			{ address: addressB, quantity: '250000000' },
		]);
	});

	it('parses JSON pair arrays and object maps', () => {
		expect(parseHolderList(JSON.stringify([[addressA, '7']]), 3).rows).toEqual([
			{ address: addressA, quantity: '7000' },
		]);
		expect(parseHolderList(JSON.stringify({ [addressA]: '3', [addressB]: '4' }), 3).rows).toEqual([
			{ address: addressA, quantity: '3000' },
			{ address: addressB, quantity: '4000' },
		]);
	});

	it('converts human CSV quantities to atomic units without floating point', () => {
		const parsed = parseHolderList(`# holders\n\n${addressA}, 5.125\n${addressB},1\n`, 3);
		expect(parsed.errors).toEqual([]);
		expect(parsed.rows).toEqual([
			{ address: addressA, quantity: '5125' },
			{ address: addressB, quantity: '1000' },
		]);
	});

	it('rejects invalid addresses, non-positive quantities, and empty input', () => {
		expect(parseHolderList('not-an-address,5', 3).errors).toHaveLength(1);
		expect(parseHolderList(`${addressA},0`, 3).errors).toHaveLength(1);
		expect(parseHolderList(`${addressA},1.0001`, 3).errors).toHaveLength(1);
		expect(parseHolderList(JSON.stringify([{ address: addressA, quantity: 1.5 }]), 3).errors).toHaveLength(1);
		expect(parseHolderList(`${addressA},-2`, 3).errors).toHaveLength(1);
		expect(parseHolderList('   ', 3).errors).toHaveLength(1);
		expect(parseHolderList('{broken', 3).errors).toHaveLength(1);
		expect(parseHolderList(`${addressA},1.5`, 0).errors).toHaveLength(1);
	});

	it('rejects duplicate addresses and names them', () => {
		const parsed = parseHolderList(`${addressA},1\n${addressB},2\n${addressA},3`, 3);
		expect(parsed.rows).toEqual([]);
		expect(parsed.errors).toHaveLength(1);
		expect(parsed.errors[0]).toContain(addressA);
		expect(parsed.errors[0]).not.toContain(addressB);
	});

	it('keeps quantities bigint-safe beyond Number precision', () => {
		const parsed = parseHolderList(`${addressA},123456789012345678901234567890.123`, 3);
		expect(parsed.errors).toEqual([]);
		expect(parsed.rows[0].quantity).toBe('123456789012345678901234567890123');
		expect(planTotals(parsed.rows).totalQuantity).toBe(123456789012345678901234567890123n);
	});
});

describe('dispatch cost estimate', () => {
	it('keeps token units separate from native transfer cost and rewards', () => {
		const rows = [
			{ address: addressA, quantity: '250000' },
			{ address: addressB, quantity: '750000' },
		];
		const estimate = estimateDispatchCost(rows, 1000n);
		expect(estimate.totalQuantity).toBe(1_000_000n);
		expect(estimate.totalReward).toBe(2000n);
		expect(estimate.totalWinston).toBe(2000n);
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

	it('accepts a rejected row only while it keeps the rejected transaction id', () => {
		const txA = 'T'.repeat(43);
		const rejected = { ...plan.rows[0], status: 'rejected' as const, transactionId: txA };
		expect(isDispatchPlan({ ...plan, rows: [rejected] })).toBe(true);
		expect(isDispatchPlan({ ...plan, rows: [{ ...plan.rows[0], status: 'rejected' }] })).toBe(false);
		const storage = memoryStorage();
		saveDispatchPlan({ ...plan, rows: [rejected] }, storage);
		expect(loadDispatchPlan(processId, storage)?.rows[0]).toEqual(rejected);
	});
});

describe('dispatch row lifecycle', () => {
	const txA = 'T'.repeat(43);

	it('treats settled and rejected rows as terminal for a run', () => {
		expect(dispatchRowPending({ status: 'unsent' })).toBe(true);
		expect(dispatchRowPending({ status: 'posted' })).toBe(true);
		expect(dispatchRowPending({ status: 'settled' })).toBe(false);
		expect(dispatchRowPending({ status: 'rejected' })).toBe(false);
	});

	it('counts rejected rows apart from settled ones and never calls a plan with rejected rows complete', () => {
		const rows: DispatchRow[] = [
			{ address: addressA, quantity: '1', status: 'settled', transactionId: txA },
			{ address: addressB, quantity: '1', status: 'rejected', transactionId: txA },
		];
		expect(dispatchPlanProgress({ rows })).toEqual({
			settled: 1,
			posted: 0,
			rejected: 1,
			pending: 0,
			complete: false,
		});
		expect(dispatchPlanProgress({ rows: [rows[0]] }).complete).toBe(true);
	});

	it('accepts an optional non-negative integer startingSlot and process rejections only on rejected rows', () => {
		const plan = {
			processId,
			sender,
			createdAt: 1,
			baseline: { [addressA]: '0' },
			rows: [{ address: addressA, quantity: '1', status: 'unsent' as const }],
		};
		expect(isDispatchPlan(plan)).toBe(true);
		expect(isDispatchPlan({ ...plan, startingSlot: 0 })).toBe(true);
		expect(isDispatchPlan({ ...plan, startingSlot: 41 })).toBe(true);
		for (const startingSlot of [-1, 1.5, '41', null]) expect(isDispatchPlan({ ...plan, startingSlot })).toBe(false);
		const notApplied = {
			...plan.rows[0],
			status: 'rejected' as const,
			transactionId: txA,
			rejectedBy: 'process' as const,
		};
		expect(isDispatchPlan({ ...plan, rows: [notApplied] })).toBe(true);
		expect(isDispatchPlan({ ...plan, rows: [{ ...notApplied, status: 'posted' }] })).toBe(false);
		expect(isDispatchPlan({ ...plan, rows: [{ ...notApplied, rejectedBy: 'gateway' }] })).toBe(false);
	});

	it('does not count a process-proven rejection as in flight: it can never apply', () => {
		expect(dispatchRowInFlight({ status: 'rejected', transactionId: txA, rejectedBy: 'process' })).toBe(false);
	});

	it('keeps a rejected row in the discard confirmation: its signature may have been posted', () => {
		expect(dispatchRowInFlight({ status: 'rejected', transactionId: txA })).toBe(true);
	});
});

describe('dispatch discard confirmation', () => {
	const txA = 'T'.repeat(43);
	const txB = 'U'.repeat(43);
	const addressC = 'C'.repeat(43);
	const rowsPlan = (rows: DispatchRow[]) => ({
		processId,
		sender,
		createdAt: 1,
		baseline: Object.fromEntries(rows.map((row) => [row.address, '0'])),
		rows,
	});

	it('marks a row in flight from signing until settlement', () => {
		expect(dispatchRowInFlight({ status: 'unsent' })).toBe(false);
		expect(dispatchRowInFlight({ status: 'unsent', transactionId: txA })).toBe(true);
		expect(dispatchRowInFlight({ status: 'posted', transactionId: txA })).toBe(true);
		expect(dispatchRowInFlight({ status: 'posted' })).toBe(true);
		expect(dispatchRowInFlight({ status: 'settled', transactionId: txA })).toBe(false);
		expect(dispatchRowInFlight({ status: 'settled' })).toBe(false);
	});

	it('needs no confirmation without a plan, for an untouched plan, or for a complete plan', () => {
		expect(dispatchDiscardConfirmation(null)).toBeNull();
		expect(
			dispatchDiscardConfirmation(
				rowsPlan([
					{ address: addressA, quantity: '1', status: 'unsent' },
					{ address: addressB, quantity: '1', status: 'unsent' },
				])
			)
		).toBeNull();
		expect(
			dispatchDiscardConfirmation(
				rowsPlan([
					{ address: addressA, quantity: '1', status: 'settled', transactionId: txA },
					{ address: addressB, quantity: '1', status: 'settled', transactionId: txB },
				])
			)
		).toBeNull();
	});

	it('counts posted rows and warns that re-dispatching the list sends again', () => {
		const message = dispatchDiscardConfirmation(
			rowsPlan([
				{ address: addressA, quantity: '1', status: 'posted', transactionId: txA },
				{ address: addressB, quantity: '1', status: 'posted', transactionId: txB },
				{ address: addressC, quantity: '1', status: 'unsent' },
			])
		);
		expect(message).toMatch(/^2 transfers are posted or signed but not settled yet/);
		expect(message).toContain('deletes the saved signed transactions needed for manual review');
		expect(message).toContain('send to those recipients a second time');
		expect(message).toContain('Resume');
	});

	it('counts a signed unsent row, which may have been posted before a crash', () => {
		const message = dispatchDiscardConfirmation(
			rowsPlan([
				{ address: addressA, quantity: '1', status: 'settled', transactionId: txA },
				{ address: addressB, quantity: '1', status: 'unsent', transactionId: txB },
				{ address: addressC, quantity: '1', status: 'unsent' },
			])
		);
		expect(message).toMatch(/^1 transfer is posted or signed but not settled yet/);
	});

	it('stays consistent with the rows discardDispatchPlan would delete signed records for', () => {
		const storage = memoryStorage();
		const plan = rowsPlan([
			{ address: addressA, quantity: '1', status: 'unsent', transactionId: txA },
			{ address: addressB, quantity: '1', status: 'posted', transactionId: txB },
		]);
		saveDispatchPlan(plan, storage);
		storage.setItem(`${SIGNED_TRANSACTION_PREFIX}${txA}`, '{}');
		storage.setItem(`${SIGNED_TRANSACTION_PREFIX}${txB}`, '{}');
		expect(dispatchDiscardConfirmation(loadDispatchPlan(processId, storage))).toMatch(/^2 transfers are/);
		discardDispatchPlan(processId, storage);
		expect(loadDispatchPlan(processId, storage)).toBeNull();
		expect(storage.getItem(`${SIGNED_TRANSACTION_PREFIX}${txA}`)).toBeNull();
		expect(storage.getItem(`${SIGNED_TRANSACTION_PREFIX}${txB}`)).toBeNull();
	});
});

describe('dispatch plan preflight', () => {
	it('rejects incomplete holder balance state before creating a resumable plan', async () => {
		const balancesLink = 'L'.repeat(43);
		const requests: string[] = [];
		const fetcher = async (input: RequestInfo | URL) => {
			const url = String(input);
			requests.push(url);
			if (url.endsWith(`${balancesLink}~message@1.0/serialize~json@1.0`)) {
				return new Response(JSON.stringify({ device: 'trie@1.0' }));
			}
			return new Response(null, {
				headers: {
					balances: `ao:${balancesLink}`,
					'execution-device': 'token@1.0',
					'total-supply': '100',
				},
			});
		};

		await expect(
			createDispatchPlan(processId, sender, [{ address: addressA, quantity: '10' }], {
				fetch: fetcher as typeof fetch,
			})
		).rejects.toThrow('asset-balance-state-unavailable');
		expect(requests).toHaveLength(2);
		expect(requests[1]).toBe(`/${balancesLink}~message@1.0/serialize~json@1.0`);
	});
});
