import { describe, expect, it } from 'vitest';

import { createConcurrencyLimit, mapConcurrent } from './concurrency';

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

describe('createConcurrencyLimit', () => {
	it('bounds nested work discovered while earlier tasks run and keeps failures isolated', async () => {
		const limit = createConcurrencyLimit(2);
		let active = 0;
		let maximum = 0;
		const task = async (value: number) => {
			active += 1;
			maximum = Math.max(maximum, active);
			await new Promise((resolve) => setTimeout(resolve, 1));
			active -= 1;
			if (value === 13) throw new Error('child-failed');
			return value;
		};
		const parent = async (value: number) => {
			const own = await limit(() => task(value));
			const children = await Promise.allSettled([1, 2, 3].map((child) => limit(() => task(own * 10 + child))));
			return children.map((child) => (child.status === 'fulfilled' ? child.value : 'failed'));
		};

		const results = await Promise.all([1, 2, 3, 4].map(parent));

		expect(maximum).toBe(2);
		expect(active).toBe(0);
		expect(results[0]).toEqual([11, 12, 'failed']);
		expect(results[3]).toEqual([41, 42, 43]);
		await expect(limit(() => task(13))).rejects.toThrow('child-failed');
		await expect(limit(async () => 'after-failure')).resolves.toBe('after-failure');
	});
});
