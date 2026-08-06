import { describe, expect, it } from 'vitest';

import { mapConcurrent } from './concurrency';

describe('mapConcurrent', () => {
	it('preserves result order while bounding active work', async () => {
		let active = 0;
		let maximum = 0;
		const releases: Array<() => void> = [];

		const result = mapConcurrent([1, 2, 3, 4], 2, async (value) => {
			active += 1;
			maximum = Math.max(maximum, active);
			await new Promise<void>((resolve) => releases.push(resolve));
			active -= 1;
			return value * 2;
		});

		await Promise.resolve();
		expect(active).toBe(2);
		releases.splice(0).forEach((release) => release());
		await Promise.resolve();
		await Promise.resolve();
		releases.splice(0).forEach((release) => release());

		await expect(result).resolves.toEqual([2, 4, 6, 8]);
		expect(maximum).toBe(2);
	});
});
