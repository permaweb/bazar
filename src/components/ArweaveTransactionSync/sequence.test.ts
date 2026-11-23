import { describe, expect, it } from 'vitest';

import {
	confirmationLifecycleState,
	confirmationProgressText,
	confirmationProgressValue,
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
			expected
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

const ENGLISH = {
	progress: '{label}: {depth} of {target} confirmations.',
	complete: '{label}: {depth} of {target} confirmations complete.',
	beyondTarget: '{label}: {depth} confirmations.',
};

describe('confirmationProgressText', () => {
	it('describes bounded confirmation depth and completion', () => {
		expect(confirmationProgressText('Reserve listing', 0, 5, ENGLISH)).toBe(
			'Reserve listing: 0 of 5 confirmations.'
		);
		expect(confirmationProgressText('Pay seller', 3, 5, ENGLISH)).toBe('Pay seller: 3 of 5 confirmations.');
		expect(confirmationProgressText('Pay seller', 8, 5, ENGLISH)).toBe(
			'Pay seller: 5 of 5 confirmations complete.'
		);
	});

	it('reports uncapped terminal depth past the target', () => {
		expect(confirmationProgressText('Pay seller', 7, 1, ENGLISH, true)).toBe('Pay seller: 7 confirmations.');
		expect(confirmationProgressText('Pay seller', 1, 1, ENGLISH, true)).toBe(
			'Pay seller: 1 of 1 confirmations complete.'
		);
	});

	it('renders from the supplied localized templates', () => {
		const copy = {
			progress: '{depth}/{target} · {label}',
			complete: '{label} ✓',
			beyondTarget: '{label} +{depth}',
		};
		expect(confirmationProgressText('Pay', 1, 5, copy)).toBe('1/5 · Pay');
		expect(confirmationProgressText('Pay', 5, 5, copy)).toBe('Pay ✓');
		expect(confirmationProgressText('Pay', 9, 5, copy, true)).toBe('Pay +9');
	});
});

describe('confirmationProgressValue', () => {
	const base = {
		label: 'List for sale',
		target: 5,
		terminal: false,
		delayedLabel: 'Observers delayed',
		verificationDelayed: false,
		copy: ENGLISH,
	};

	it('reports bounded depth while confirming', () => {
		expect(confirmationProgressValue({ ...base, confirmations: 1 })).toEqual({
			min: 0,
			max: 5,
			now: 1,
			text: 'List for sale: 1 of 5 confirmations.',
		});
		expect(confirmationProgressValue({ ...base, confirmations: 9 })).toEqual({
			min: 0,
			max: 5,
			now: 5,
			text: 'List for sale: 5 of 5 confirmations complete.',
		});
	});

	it('widens the range instead of exceeding it for terminal depth beyond the target', () => {
		const value = confirmationProgressValue({ ...base, terminal: true, target: 1, confirmations: 7 });
		expect(value).toEqual({ min: 0, max: 7, now: 7, text: 'List for sale: 7 confirmations.' });
		expect(value.now).toBeLessThanOrEqual(value.max);
	});

	it('names post-confirmation settlement on non-terminal steps only', () => {
		expect(confirmationProgressValue({ ...base, confirmations: 5, pendingLabel: 'Settling live state' })).toEqual({
			min: 0,
			max: 5,
			now: 5,
			text: 'Settling live state',
		});
		expect(
			confirmationProgressValue({ ...base, terminal: true, confirmations: 5, pendingLabel: 'Checking receipt' })
				.text
		).toBe('List for sale: 5 of 5 confirmations complete.');
	});

	it('is indeterminate while observers are delayed', () => {
		expect(confirmationProgressValue({ ...base, confirmations: 0, verificationDelayed: true })).toEqual({
			min: 0,
			max: 5,
			text: 'Observers delayed',
		});
	});

	it('keeps the branch order: beyond target and pending settlement outrank delay', () => {
		expect(
			confirmationProgressValue({
				...base,
				terminal: true,
				target: 1,
				confirmations: 3,
				verificationDelayed: true,
			}).text
		).toBe('List for sale: 3 confirmations.');
		expect(
			confirmationProgressValue({
				...base,
				confirmations: 5,
				pendingLabel: 'Settling live state',
				verificationDelayed: true,
			}).text
		).toBe('Settling live state');
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
		expect(postConfirmationPendingLabel(8, 5, 'Waiting for live state…', 'Checking receipt')).toBe(
			'Checking receipt'
		);
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
