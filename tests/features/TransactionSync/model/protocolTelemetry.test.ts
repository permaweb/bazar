import { describe, expect, it } from 'vitest';

import type { Observer, ObserverView } from 'api/transactions';

import type { ArweaveSyncStep } from 'features/TransactionSync';
import {
	collectProtocolResponses,
	createProtocolTelemetryTracker,
	INITIAL_PROTOCOL_TELEMETRY_COUNTERS,
	type ProtocolActivity,
	type ProtocolResponseBatch,
	protocolTelemetryCountersReducer,
	protocolTelemetrySnapshot,
} from 'features/TransactionSync/model/protocolTelemetry';

const observer = (name: string): Observer => ({
	url: `https://${name}.example`,
	label: name,
	source: 'peer',
	failures: 0,
});

function view(source: Observer, lastSeenAt: number, confirmations = 0, error?: string): ObserverView {
	return {
		observer: source,
		state: confirmations ? 'confirmed' : 'pending',
		confirmations,
		updatedAt: lastSeenAt,
		lastSeenAt,
		changedAt: lastSeenAt,
		...(error ? { error } : {}),
	};
}

function step(views: ObserverView[], key = 'pay'): ArweaveSyncStep {
	return { key, label: 'Pay seller', target: 5, transaction: { id: 'P'.repeat(43), views } };
}

function activity(key: string, observedAt: number): ProtocolActivity {
	return {
		key,
		observedAt,
		kind: 'status',
		phase: 'pay',
		phaseLabel: 'Pay seller',
		observer: 'a',
		state: 'pending',
		confirmations: 0,
	};
}

function batch(responses: number, additions: ProtocolActivity[] = []): ProtocolResponseBatch {
	return { responses, stateChanges: 1, confirmationEvents: 2, additions };
}

describe('protocol response collection', () => {
	it('counts only responses newer than the last one seen per step and observer', () => {
		const tracker = createProtocolTelemetryTracker('session', 0);
		const a = observer('a');
		const first = collectProtocolResponses(tracker, [step([view(a, 10)])], true);
		expect(first).toMatchObject({ responses: 1, stateChanges: 0, confirmationEvents: 0 });
		expect(first.additions).toHaveLength(1);

		expect(collectProtocolResponses(tracker, [step([view(a, 10)])], false).responses).toBe(0);

		const repeat = collectProtocolResponses(tracker, [step([view(a, 12)])], false);
		expect(repeat).toMatchObject({ responses: 1, stateChanges: 0, confirmationEvents: 0, additions: [] });
	});

	it('records state changes, confirmation increments, and errors as notable activity', () => {
		const tracker = createProtocolTelemetryTracker('session', 0);
		const a = observer('a');
		collectProtocolResponses(tracker, [step([view(a, 10)])], true);

		const confirmed = collectProtocolResponses(tracker, [step([view(a, 20, 2)])], false);
		expect(confirmed).toMatchObject({ responses: 1, stateChanges: 1, confirmationEvents: 2 });
		expect(confirmed.additions[0]).toMatchObject({
			kind: 'confirmation',
			key: `pay:${a.url}:20`,
			confirmations: 2,
		});

		const failed = collectProtocolResponses(tracker, [step([view(a, 30, 2, 'timeout')])], false);
		expect(failed.additions[0]).toMatchObject({ kind: 'error' });
	});

	it('does not count a new session’s baseline as state changes', () => {
		const tracker = createProtocolTelemetryTracker('session', 0);
		const a = observer('a');
		tracker.latestState.set(`pay:${a.url}`, 'pending');
		expect(collectProtocolResponses(tracker, [step([view(a, 10, 1)])], true).stateChanges).toBe(0);
	});

	it('ignores views that were never answered', () => {
		const tracker = createProtocolTelemetryTracker('session', 0);
		const unanswered: ObserverView = { ...view(observer('a'), 10), lastSeenAt: undefined };
		expect(collectProtocolResponses(tracker, [step([unanswered])], true)).toEqual({
			responses: 0,
			stateChanges: 0,
			confirmationEvents: 0,
			additions: [],
		});
	});
});

describe('protocol telemetry counters', () => {
	it('starts a session from its baseline, newest activity first and capped at ten', () => {
		const additions = Array.from({ length: 12 }, (_, index) => activity(`a${index}`, index));
		const counters = protocolTelemetryCountersReducer(INITIAL_PROTOCOL_TELEMETRY_COUNTERS, {
			type: 'session-started',
			batch: batch(12, additions),
		});

		expect(counters).toMatchObject({ responses: 12, stateChanges: 0, confirmationEvents: 2 });
		expect(counters.recent.map((entry) => entry.key)).toEqual([
			'a11',
			'a10',
			'a9',
			'a8',
			'a7',
			'a6',
			'a5',
			'a4',
			'a3',
			'a2',
		]);
	});

	it('accumulates later responses without mutating the batch', () => {
		const started = protocolTelemetryCountersReducer(INITIAL_PROTOCOL_TELEMETRY_COUNTERS, {
			type: 'session-started',
			batch: batch(1, [activity('first', 1)]),
		});
		const additions = [activity('second', 2), activity('third', 3)];
		const next = protocolTelemetryCountersReducer(started, {
			type: 'responses-observed',
			batch: batch(2, additions),
		});

		expect(next).toMatchObject({ responses: 3, stateChanges: 1, confirmationEvents: 4 });
		expect(next.recent.map((entry) => entry.key)).toEqual(['third', 'second', 'first']);
		expect(additions.map((entry) => entry.key)).toEqual(['second', 'third']);
	});

	it('keeps the same counters when no new response arrived', () => {
		const counters = protocolTelemetryCountersReducer(INITIAL_PROTOCOL_TELEMETRY_COUNTERS, {
			type: 'session-started',
			batch: batch(1, [activity('first', 1)]),
		});
		expect(protocolTelemetryCountersReducer(counters, { type: 'responses-observed', batch: batch(0) })).toBe(
			counters
		);

		const withoutActivity = protocolTelemetryCountersReducer(counters, {
			type: 'responses-observed',
			batch: batch(1),
		});
		expect(withoutActivity.recent).toBe(counters.recent);
	});
});

describe('protocol telemetry snapshot', () => {
	it('derives rates, agreement, and response age for the active step', () => {
		const tracker = createProtocolTelemetryTracker('session', 1_000);
		const a = observer('a');
		const b = observer('b');
		const steps = [step([view(a, 4_000), view(b, 5_000)])];
		collectProtocolResponses(tracker, steps, true);
		const snapshot = protocolTelemetrySnapshot(
			{ ...INITIAL_PROTOCOL_TELEMETRY_COUNTERS, responses: 8 },
			tracker,
			steps,
			'pay',
			5_000,
			'session',
			1_000
		);

		expect(snapshot).toMatchObject({
			responses: 8,
			responsesPerSecond: 2,
			observers: 2,
			answering: 2,
			agreeing: 0,
			eligible: 0,
			phaseLabel: 'Pay seller',
			latestResponseAge: 0,
		});
	});

	it('clamps elapsed time to one second and falls back to the latest observed step', () => {
		const tracker = createProtocolTelemetryTracker('previous', 0);
		const steps = [step([], 'register'), step([view(observer('a'), 100)], 'pay')];
		const snapshot = protocolTelemetrySnapshot(
			{ ...INITIAL_PROTOCOL_TELEMETRY_COUNTERS, responses: 3 },
			tracker,
			steps,
			'unknown-step',
			1_200,
			'session',
			1_000
		);

		expect(snapshot.responsesPerSecond).toBe(3);
		expect(snapshot.answering).toBe(1);
		expect(snapshot.latestResponseAge).toBe(0);
	});
});
