import { describe, expect, it } from 'vitest';

import {
	confirmationLifecycleState,
	confirmationProgressText,
	confirmationProgressWidth,
	postConfirmationPendingLabel,
	sequencePhaseBounds,
} from './sequence';

describe('sequencePhaseBounds', () => {
	it.each([
		[1, [[0, 100]]],
		[
			2,
			[
				[0, 50],
				[50, 100],
			],
		],
		[
			4,
			[
				[0, 25],
				[25, 50],
				[50, 75],
				[75, 100],
			],
		],
	] as const)('partitions a %i-transaction sequence across the full cable', (count, expected) => {
		expect(Array.from({ length: count }, (_, index) => Object.values(sequencePhaseBounds(index, count)))).toEqual(
			expected,
		);
	});

	it('keeps arbitrary sequences contiguous without gaps', () => {
		const phases = Array.from({ length: 7 }, (_, index) => sequencePhaseBounds(index, 7));
		expect(phases[0].start).toBe(0);
		expect(phases.at(-1)?.end).toBe(100);
		for (let index = 1; index < phases.length; index += 1) {
			expect(phases[index].start).toBe(phases[index - 1].end);
		}
	});
});

describe('confirmationProgressText', () => {
	it('describes bounded confirmation depth and completion', () => {
		expect(confirmationProgressText('Reserve listing', 0, 5)).toBe('Reserve listing: 0 of 5 confirmations.');
		expect(confirmationProgressText('Pay seller', 3, 5)).toBe('Pay seller: 3 of 5 confirmations.');
		expect(confirmationProgressText('Pay seller', 8, 5)).toBe('Pay seller: 5 of 5 confirmations complete.');
	});
});

describe('confirmationProgressWidth', () => {
	it('keeps failed progress aligned with confirmed depth', () => {
		expect(confirmationProgressWidth(20, false, true)).toBe(20);
		expect(confirmationProgressWidth(0, false, true)).toBe(0);
	});

	it('uses only quorum-confirmed progress while keeping an active affordance', () => {
		expect(confirmationProgressWidth(0, true, false)).toBe(2);
		expect(confirmationProgressWidth(20, true, false)).toBe(20);
		expect(confirmationProgressWidth(100, false, false)).toBe(100);
	});
});

describe('postConfirmationPendingLabel', () => {
	it('starts an indeterminate live-state phase only after confirmation completes', () => {
		expect(postConfirmationPendingLabel(4, 5, 'Waiting for live state…')).toBeUndefined();
		expect(postConfirmationPendingLabel(5, 5, 'Waiting for live state…')).toBe('Settling live state');
		expect(postConfirmationPendingLabel(8, 5, 'Waiting for live state…', 'Checking receipt')).toBe('Checking receipt');
		expect(postConfirmationPendingLabel(5, 5, '')).toBeUndefined();
	});
});

describe('confirmationLifecycleState', () => {
	it('keeps post-confirmation settlement visibly active', () => {
		expect(confirmationLifecycleState(5, 5, 'Checking receipt', false)).toEqual({
			depth: 5,
			pending: true,
			active: true,
			complete: false,
		});
	});

	it('only marks the confirmation phase complete when no later verification is pending', () => {
		expect(confirmationLifecycleState(5, 5, undefined, false)).toEqual({
			depth: 5,
			pending: false,
			active: false,
			complete: true,
		});
	});
});
