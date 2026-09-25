import { describe, expect, it } from 'vitest';

import type { Observer, ObserverView } from 'api/transactions';

import type { ArweaveSyncStep } from 'features/TransactionSync';
import { TRANSACTION_SYNC_MESSAGES } from 'features/TransactionSync/messages';
import { infinity3DLane, medianActivePhaseProgress } from 'features/TransactionSync/model/cableLanes';
import { mergeRaceLanes, nextObserverTimelines } from 'features/TransactionSync/model/observerTimeline';
import type { Infinity3DLane } from 'features/TransactionSync/types';

const language = TRANSACTION_SYNC_MESSAGES.en;
const observer: Observer = { url: 'https://a.example', label: 'a.example', source: 'seed', failures: 0 };

function view(updatedAt: number, confirmations: number, latency?: number): ObserverView {
	return {
		observer,
		state: confirmations ? 'confirmed' : 'pending',
		confirmations,
		updatedAt,
		lastSeenAt: updatedAt,
		changedAt: updatedAt,
		...(latency === undefined ? {} : { latency }),
	};
}

function lane(phases: number[]): Infinity3DLane {
	return {
		observerUrl: 'https://a.example',
		label: 'a',
		detail: '',
		statusLabel: '',
		stages: [],
		progress: 0,
		phases: phases.map((progress) => ({ progress, started: true, complete: false })),
		state: 'pending',
		confirmations: 0,
		error: false,
		markers: [],
	};
}

const steps: ArweaveSyncStep[] = [
	{ key: 'register', label: 'Reserve', target: 2 },
	{ key: 'pay', label: 'Pay', target: 2 },
];

describe('median active phase progress', () => {
	it('is undefined before any lane exists or for an unknown step', () => {
		expect(medianActivePhaseProgress([], steps, 'pay')).toBeUndefined();
		expect(medianActivePhaseProgress([lane([10, 50])], steps, 'missing')).toBeUndefined();
	});

	it('takes the median lane’s progress through the active phase', () => {
		expect(medianActivePhaseProgress([lane([25, 50]), lane([25, 75]), lane([25, 60])], steps, 'pay')).toBe(20);
		expect(medianActivePhaseProgress([lane([25, 50]), lane([25, 100])], steps, 'pay')).toBe(50);
	});

	it('clamps lanes outside the phase to its bounds', () => {
		expect(medianActivePhaseProgress([lane([80])], steps, 'register')).toBe(100);
		expect(medianActivePhaseProgress([lane([0, 10])], steps, 'pay')).toBe(0);
	});
});

describe('3D lane view', () => {
	it('labels an observer’s latest answer with its latency and per-phase depth', () => {
		const observed: ArweaveSyncStep[] = [
			{
				key: 'register',
				label: 'Reserve',
				target: 2,
				transaction: { id: 'R'.repeat(43), views: [view(100, 0)] },
			},
		];
		const timelines = nextObserverTimelines(new Map(), observed);
		const [raceLane] = mergeRaceLanes(observed, timelines);
		const built = infinity3DLane(raceLane, observed, 100, true, language);

		expect(built.statusLabel).toBe(language.transactionSyncLanePending);
		expect(built.stages).toEqual([{ label: 'Reserve', count: 0, target: 2, state: 'pending', hasError: false }]);
		expect(built.detail).toContain('a.example · Reserve 0/2');
		expect(built.markers).toHaveLength(1);

		const confirmed: ArweaveSyncStep[] = [
			{
				key: 'register',
				label: 'Reserve',
				target: 2,
				transaction: { id: 'R'.repeat(43), views: [view(200, 3, 87.4)] },
			},
		];
		const [confirmedLane] = mergeRaceLanes(confirmed, nextObserverTimelines(timelines, confirmed));
		const done = infinity3DLane(confirmedLane, confirmed, 200, true, language);
		expect(done.statusLabel).toContain(language.transactionSyncLaneConfirmed.replace('{count}', '3'));
		expect(done.statusLabel).toContain('87');
		expect(done.stages[0].count).toBe(2);
		expect(done.phases[0]).toMatchObject({ complete: true, started: true, progress: 100 });
	});
});
