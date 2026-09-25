import { describe, expect, it } from 'vitest';

import type { Observer, ObserverView } from 'api/transactions';

import type { ArweaveSyncStep } from 'features/TransactionSync';
import {
	mergeRaceLanes,
	nextObserverTimelines,
	raceIsActive,
	type Timeline,
	updateObserverTimeline,
} from 'features/TransactionSync/model/observerTimeline';

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

function syncStep(key: string, id: string | undefined, views: ObserverView[], target = 2): ArweaveSyncStep {
	return { key, label: key, target, ...(id ? { transaction: { id, views } } : {}) };
}

describe('nextObserverTimelines', () => {
	it('returns the same map when no step received new observer data', () => {
		const steps = [syncStep('pay', 'P'.repeat(43), [view(observer('a'), 100)])];
		const first = nextObserverTimelines(new Map(), steps);

		expect(first).not.toBe(nextObserverTimelines(new Map(), steps));
		expect(nextObserverTimelines(first, steps)).toBe(first);
	});

	it('starts a fresh timeline when a step’s transaction changes', () => {
		const source = observer('a');
		const first = nextObserverTimelines(new Map(), [syncStep('pay', 'P'.repeat(43), [view(source, 100)])]);
		const replaced = nextObserverTimelines(first, [syncStep('pay', 'Q'.repeat(43), [view(source, 200, 1)])]);

		expect(replaced.get('pay')?.transactionId).toBe('Q'.repeat(43));
		expect(replaced.get('pay')?.lanes[0].events).toHaveLength(1);
	});

	it('tracks steps without a transaction and drops removed steps', () => {
		const first = nextObserverTimelines(new Map(), [
			syncStep('register', undefined, []),
			syncStep('pay', undefined, []),
		]);
		expect(first.get('register')).toEqual({ transactionId: 'register:empty', lanes: [] });

		const fewer = nextObserverTimelines(first, [syncStep('register', undefined, [])]);
		expect(fewer).not.toBe(first);
		expect([...fewer.keys()]).toEqual(['register']);
	});
});

describe('race lanes', () => {
	it('groups each observer’s step timelines into one lane in first-seen order', () => {
		const a = observer('a');
		const b = observer('b');
		const steps = [
			syncStep('register', 'R'.repeat(43), [view(a, 100, 2)]),
			syncStep('pay', 'P'.repeat(43), [view(b, 150), view(a, 160)]),
		];
		const lanes = mergeRaceLanes(steps, nextObserverTimelines(new Map(), steps));

		expect(lanes.map((lane) => lane.observer.label)).toEqual(['Observer a', 'Observer b']);
		expect([...lanes[0].phases.keys()]).toEqual(['register', 'pay']);
		expect(raceIsActive(lanes, steps)).toBe(true);
	});

	it('stops the race once every observed step reached its target', () => {
		const a = observer('a');
		const steps = [syncStep('pay', 'P'.repeat(43), [view(a, 100, 2)]), syncStep('receipt', undefined, [])];
		const lanes = mergeRaceLanes(steps, nextObserverTimelines(new Map(), steps));

		expect(raceIsActive(lanes, steps)).toBe(false);
		expect(raceIsActive([], steps)).toBe(false);
	});
});
