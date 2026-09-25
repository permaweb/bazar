import type { Observer, ObserverView } from 'api/transactions';

import type { ArweaveSyncStep } from '../types';

const RECENT_PROTOCOL_ACTIVITY_LIMIT = 10;

export type ProtocolActivity = {
	key: string;
	observedAt: number;
	kind: 'status' | 'confirmation' | 'error';
	phase: string;
	phaseLabel: string;
	observer: string;
	state: ObserverView['state'];
	confirmations: number;
	httpStatus?: number;
	latency?: number;
	nodeHeight?: number;
	blockHeight?: number;
};

export type ProtocolTelemetry = {
	responses: number;
	responsesPerSecond: number;
	observers: number;
	answering: number;
	agreeing: number;
	eligible: number;
	stateChanges: number;
	confirmationEvents: number;
	phaseLabel: string;
	latestResponseAge: number;
	recent: ProtocolActivity[];
};

/** Per-session record of the latest response each observer gave for each step; mutated as responses arrive. */
export type ProtocolTelemetryTracker = {
	key: string;
	startedAt: number;
	latestResponseAt: Map<string, number>;
	latestState: Map<string, ObserverView['state']>;
	latestConfirmations: Map<string, number>;
};

export type ProtocolTelemetryCounters = {
	responses: number;
	stateChanges: number;
	confirmationEvents: number;
	recent: ProtocolActivity[];
};

export type ProtocolResponseBatch = {
	responses: number;
	stateChanges: number;
	confirmationEvents: number;
	/** New notable responses, oldest first. */
	additions: ProtocolActivity[];
};

export type ProtocolTelemetryEvent =
	| { type: 'session-started'; batch: ProtocolResponseBatch }
	| { type: 'responses-observed'; batch: ProtocolResponseBatch };

export const INITIAL_PROTOCOL_TELEMETRY_COUNTERS: ProtocolTelemetryCounters = {
	responses: 0,
	stateChanges: 0,
	confirmationEvents: 0,
	recent: [],
};

/** One telemetry session per transaction sequence; it spans every step so counts accumulate across phases. */
export function transactionSyncSessionKey(steps: ArweaveSyncStep[]): string {
	return (
		steps.find((step) => step.transaction?.id)?.transaction?.id ??
		`pending:${steps.map((step) => step.key).join(':')}`
	);
}

export function createProtocolTelemetryTracker(key: string, startedAt: number): ProtocolTelemetryTracker {
	return {
		key,
		startedAt,
		latestResponseAt: new Map(),
		latestState: new Map(),
		latestConfirmations: new Map(),
	};
}

/**
 * Records every observer response newer than the tracker's last one and returns what changed. A new session
 * (`reset`) records its baseline without counting state changes against the previous session.
 */
export function collectProtocolResponses(
	tracker: ProtocolTelemetryTracker,
	steps: ArweaveSyncStep[],
	reset: boolean
): ProtocolResponseBatch {
	const additions: ProtocolActivity[] = [];
	let responses = 0;
	let stateChanges = 0;
	let confirmationEvents = 0;
	for (const step of steps) {
		for (const view of step.transaction?.views ?? []) {
			if (view.lastSeenAt === undefined) continue;
			const observerKey = `${step.key}:${view.observer.url}`;
			const previousResponseAt = tracker.latestResponseAt.get(observerKey) ?? 0;
			if (view.lastSeenAt <= previousResponseAt) continue;
			responses += 1;
			const previousState = tracker.latestState.get(observerKey);
			const previousConfirmations = tracker.latestConfirmations.get(observerKey) ?? 0;
			const stateChanged = previousState !== undefined && previousState !== view.state;
			const confirmationsAdded = Math.max(0, view.confirmations - previousConfirmations);
			if (!reset && stateChanged) stateChanges += 1;
			confirmationEvents += confirmationsAdded;
			tracker.latestResponseAt.set(observerKey, view.lastSeenAt);
			tracker.latestState.set(observerKey, view.state);
			tracker.latestConfirmations.set(observerKey, view.confirmations);
			if (previousState !== undefined && !stateChanged && confirmationsAdded === 0 && !view.error) continue;
			additions.push({
				key: `${observerKey}:${view.lastSeenAt}`,
				observedAt: view.lastSeenAt,
				kind: view.error ? 'error' : confirmationsAdded > 0 ? 'confirmation' : 'status',
				phase: step.key,
				phaseLabel: step.label,
				observer: view.observer.label,
				state: view.state,
				confirmations: view.confirmations,
				...(view.httpStatus === undefined ? {} : { httpStatus: view.httpStatus }),
				...(view.latency === undefined ? {} : { latency: view.latency }),
				...(view.nodeHeight === undefined ? {} : { nodeHeight: view.nodeHeight }),
				...(view.blockHeight === undefined ? {} : { blockHeight: view.blockHeight }),
			});
		}
	}
	return { responses, stateChanges, confirmationEvents, additions };
}

export function protocolTelemetryCountersReducer(
	counters: ProtocolTelemetryCounters,
	event: ProtocolTelemetryEvent
): ProtocolTelemetryCounters {
	const batch = event.batch;
	switch (event.type) {
		case 'session-started':
			return {
				responses: batch.responses,
				stateChanges: 0,
				confirmationEvents: batch.confirmationEvents,
				recent: batch.additions.slice(-RECENT_PROTOCOL_ACTIVITY_LIMIT).reverse(),
			};
		case 'responses-observed':
			if (batch.responses <= 0) return counters;
			return {
				responses: counters.responses + batch.responses,
				stateChanges: counters.stateChanges + batch.stateChanges,
				confirmationEvents: counters.confirmationEvents + batch.confirmationEvents,
				recent: batch.additions.length
					? [...[...batch.additions].reverse(), ...counters.recent].slice(0, RECENT_PROTOCOL_ACTIVITY_LIMIT)
					: counters.recent,
			};
	}
}

/** Derives the live telemetry panel figures at `now` from the session counters and observed steps. */
export function protocolTelemetrySnapshot(
	counters: ProtocolTelemetryCounters,
	tracker: ProtocolTelemetryTracker,
	steps: ArweaveSyncStep[],
	activeStep: string | undefined,
	now: number,
	sessionKey: string,
	sessionStartedAt: number
): ProtocolTelemetry {
	const startedAt = tracker.key === sessionKey ? tracker.startedAt : sessionStartedAt;
	const elapsedSeconds = Math.max(1, (now - startedAt) / 1_000);
	const active =
		steps.find((step) => step.key === activeStep) ??
		[...steps].reverse().find((step) => step.transaction?.views.length) ??
		steps[0];
	const views = active?.transaction?.views ?? [];
	const consensus = active?.transaction?.consensus;
	const observers = new Map<string, Observer>();
	for (const step of steps) {
		for (const view of step.transaction?.views ?? []) observers.set(view.observer.url, view.observer);
	}
	const latestResponseAt = Math.max(0, ...tracker.latestResponseAt.values());

	return {
		responses: counters.responses,
		responsesPerSecond: counters.responses / elapsedSeconds,
		observers: observers.size,
		answering: consensus?.answering ?? views.filter((view) => view.lastSeenAt !== undefined).length,
		agreeing: consensus?.agreeing ?? 0,
		eligible: consensus?.eligible ?? 0,
		stateChanges: counters.stateChanges,
		confirmationEvents: counters.confirmationEvents,
		phaseLabel: active?.label ?? '',
		latestResponseAge: latestResponseAt ? Math.max(0, (now - latestResponseAt) / 1_000) : 0,
		recent: counters.recent,
	};
}
