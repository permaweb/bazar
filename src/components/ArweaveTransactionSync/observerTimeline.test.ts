import { describe, expect, it } from 'vitest';
import type { Observer, ObserverView } from 'weave-wrangler';

import { type Timeline, updateObserverTimeline } from './index';

const observer = (suffix: string): Observer =>
	({
		url: `https://observer-${suffix}.example`,
		label: `Observer ${suffix}`,
		source: 'seed',
		failures: 0,
	} as Observer);

const view = (source: Observer, observedAt: number, confirmations = 0): ObserverView =>
	({
		observer: source,
		state: confirmations ? 'confirmed' : 'not-found',
		confirmations,
		updatedAt: observedAt,
		lastSeenAt: observedAt,
		changedAt: observedAt,
		httpStatus: confirmations ? 200 : 404,
	} as ObserverView);

describe('updateObserverTimeline', () => {
	it('keeps the existing timeline when no observer data changed', () => {
		const initial: Timeline = { transactionId: 'tx', lanes: [] };
		const first = updateObserverTimeline(initial, [view(observer('a'), 100)]);

		expect(updateObserverTimeline(first, [view(observer('a'), 100)])).toBe(first);
	});

	it('clones only the lane receiving a new minor response', () => {
		const initial: Timeline = { transactionId: 'tx', lanes: [] };
		const first = updateObserverTimeline(initial, [view(observer('a'), 100), view(observer('b'), 100)]);
		const second = updateObserverTimeline(first, [view(observer('a'), 150), view(observer('b'), 100)]);

		expect(second).not.toBe(first);
		expect(second.lanes[0]).not.toBe(first.lanes[0]);
		expect(second.lanes[1]).toBe(first.lanes[1]);
		expect(second.lanes[0].events).toHaveLength(1);
		expect(second.lanes[0].proofs).toHaveLength(2);
	});

	it('preserves confirmation transitions and their minor proofs', () => {
		const source = observer('a');
		const initial: Timeline = { transactionId: 'tx', lanes: [] };
		const pending = updateObserverTimeline(initial, [view(source, 100)]);
		const confirmed = updateObserverTimeline(pending, [view(source, 200, 1)]);

		expect(confirmed.lanes[0].events).toHaveLength(2);
		expect(confirmed.lanes[0].events[1]).toMatchObject({ state: 'confirmed', confirmations: 1 });
		expect(confirmed.lanes[0].proofs).toHaveLength(2);
	});
});
