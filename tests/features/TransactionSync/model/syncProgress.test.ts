import { describe, expect, it } from 'vitest';

import type { ArweaveSyncStep } from 'features/TransactionSync';
import {
	displayedSyncProgress,
	nextEstimatedProgress,
	transactionSyncHeader,
} from 'features/TransactionSync/model/syncProgress';

const register: ArweaveSyncStep = {
	key: 'register',
	label: 'Reserve',
	target: 4,
	confirmations: 1,
	transaction: { id: 'R'.repeat(43), views: [] },
};
const pay: ArweaveSyncStep = { key: 'pay', label: 'Pay', target: 2, terminal: true, confirmations: 3 };

describe('transaction sync header', () => {
	it('describes the requested step, falling back to the first step', () => {
		expect(transactionSyncHeader([register, pay], 'register', undefined)).toMatchObject({
			active: register,
			confirmationDepth: 1,
			target: 4,
			displayedConfirmationDepth: 1,
			terminalDepthBeyondTarget: false,
			progressKey: `${'R'.repeat(43)}:register`,
			confirmedProgress: 25,
			progressActive: true,
			transactionState: 'unknown',
		});
		expect(transactionSyncHeader([register, pay], 'missing', undefined).active).toBe(register);
	});

	it('shows a terminal step’s live depth beyond its target', () => {
		const header = transactionSyncHeader([register, pay], 'pay', 'Checking receipt');
		expect(header).toMatchObject({
			transaction: undefined,
			displayedConfirmationDepth: 3,
			terminalDepthBeyondTarget: true,
			progressKey: 'none:pay',
			progressActive: false,
		});
		expect(header.lifecycle.pending).toBe(true);
	});

	it('handles an empty sequence without a target', () => {
		expect(transactionSyncHeader([], undefined, undefined)).toMatchObject({
			active: undefined,
			target: 0,
			confirmedProgress: 0,
			progressKey: 'none:none',
			progressActive: false,
		});
	});
});

describe('estimated progress', () => {
	it('keeps the larger of confirmed and estimated progress and skips imperceptible updates', () => {
		const current = { key: 'tx:pay', value: 40 };
		expect(nextEstimatedProgress(current, 'tx:pay', 20, 40.01)).toBe(current);
		expect(nextEstimatedProgress(current, 'tx:pay', 60, 40)).toEqual({ key: 'tx:pay', value: 60 });
		expect(nextEstimatedProgress(current, 'tx:register', 0, 40)).toEqual({ key: 'tx:register', value: 40 });
	});

	it('ignores estimates for another step and leaves headroom while active', () => {
		const header = { progressKey: 'tx:pay', confirmedProgress: 30, progressActive: true };
		expect(displayedSyncProgress(header, { key: 'tx:pay', value: 55 })).toBe(55);
		expect(displayedSyncProgress(header, { key: 'tx:register', value: 55 })).toBe(30);
		expect(displayedSyncProgress(header, { key: 'tx:pay', value: 100 })).toBe(99);
		expect(displayedSyncProgress({ ...header, confirmedProgress: 0 }, { key: 'x', value: 0 })).toBe(2);
		expect(
			displayedSyncProgress({ ...header, progressActive: false, confirmedProgress: 120 }, { key: 'x', value: 0 })
		).toBe(100);
	});
});
