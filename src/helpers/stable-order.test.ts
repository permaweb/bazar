import { describe, expect, it } from 'vitest';

import { applyStableOrder, nextStableOrder, stableOrderDiffers } from './stable-order';

describe('nextStableOrder', () => {
	it('keeps the order stable until loading settles or the viewer re-sorts', () => {
		const loading = nextStableOrder(undefined, ['b', 'a'], 'recent', false);
		expect(loading.ids).toEqual(['b', 'a']);

		// Activity and late collections arrive: existing cards keep their slots, newcomers are appended.
		const streamed = nextStableOrder(loading, ['c', 'a', 'b'], 'recent', false);
		expect(streamed.ids).toEqual(['b', 'a', 'c']);
		expect(nextStableOrder(streamed, ['a', 'c', 'b'], 'recent', false)).toBe(streamed);

		// A collection that no longer matches drops out without moving the others.
		expect(nextStableOrder(streamed, ['c', 'b'], 'recent', false).ids).toEqual(['b', 'c']);

		const settled = nextStableOrder(streamed, ['c', 'a', 'b'], 'recent', true);
		expect(settled.ids).toEqual(['c', 'a', 'b']);
		expect(nextStableOrder(settled, ['a', 'b', 'c'], 'recent', true)).toBe(settled);

		// A later refresh streams in place again and re-ranks once it settles.
		const refreshing = nextStableOrder(settled, ['d', 'a', 'b', 'c'], 'recent', false);
		expect(refreshing.ids).toEqual(['c', 'a', 'b', 'd']);
		expect(nextStableOrder(refreshing, ['d', 'a', 'b', 'c'], 'recent', true).ids).toEqual(['d', 'a', 'b', 'c']);

		// Discovery keeps streaming after loading settles: a late collection takes its ranked place instead of
		// landing last, and the settled cards keep their relative order.
		const newest = nextStableOrder(undefined, ['a', 'b'], 'newest', true);
		const late = nextStableOrder(newest, ['c', 'a', 'b'], 'newest', true);
		expect(late.ids).toEqual(['c', 'a', 'b']);
		expect(nextStableOrder(late, ['c', 'a', 'b'], 'newest', true)).toBe(late);
		expect(nextStableOrder(late, ['c', 'a', 'e', 'b', 'f'], 'newest', true).ids).toEqual(['c', 'a', 'e', 'b', 'f']);
		// A stats update that would reorder settled cards still waits for the next settle or sort change.
		expect(nextStableOrder(late, ['d', 'b', 'a', 'c'], 'newest', true).ids).toEqual(['d', 'c', 'a', 'b']);

		// An explicit sort change re-ranks immediately, even while loading.
		expect(nextStableOrder(refreshing, ['b', 'c', 'a', 'd'], 'oldest', false).ids).toEqual(['b', 'c', 'a', 'd']);
	});
});

describe('applyStableOrder', () => {
	it('returns current items in the stored order and skips ids without an item', () => {
		const items = [
			{ id: 'a', value: 1 },
			{ id: 'b', value: 2 },
			{ id: 'c', value: 3 },
		];
		expect(applyStableOrder(items, ['c', 'x', 'a'], (item) => item.id)).toEqual([items[2], items[0]]);
	});
});

describe('stableOrderDiffers', () => {
	it('reports a newer order only when it would change the slots on show', () => {
		expect(stableOrderDiffers(['a', 'b', 'c'], ['a', 'b', 'c'], 3)).toBe(false);
		expect(stableOrderDiffers(['a', 'b', 'c'], ['b', 'a', 'c'], 3)).toBe(true);
		// Only slots beyond the revealed cards differ.
		expect(stableOrderDiffers(['a', 'b', 'c'], ['a', 'c', 'b'], 1)).toBe(false);
		expect(stableOrderDiffers([], [], 12)).toBe(false);
	});
});
