import { describe, expect, it } from 'vitest';

import { sequencePhaseBounds } from './sequence';

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
