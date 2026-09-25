import type { ObserverView } from 'api/transactions';

import type { ArweaveSyncStep } from '../types';

import { phaseIsComplete, type RaceTimelineEvent, transitionKey } from './raceTimeline';

const MAX_PROOFS_PER_LANE = 320;

export type LaneEvent = RaceTimelineEvent & {
	nodeHeight?: number;
	latency?: number;
};

export type LaneProof = {
	observedAt: number;
	state: ObserverView['state'];
	confirmations: number;
	latency?: number;
	httpStatus?: number;
	blockId?: string;
	blockHeight?: number;
	nodeHeight?: number;
};

export type LaneHistory = {
	observer: ObserverView['observer'];
	events: LaneEvent[];
	proofs: LaneProof[];
	observedAt: number;
};

export type Timeline = {
	transactionId: string;
	lanes: LaneHistory[];
};

export type RaceLane = {
	observer: ObserverView['observer'];
	phases: Map<string, LaneHistory>;
};

/**
 * Advances every step's timeline with its latest observer views. A step whose transaction changed starts a new
 * timeline. Returns `current` itself when nothing changed so consumers can skip work.
 */
export function nextObserverTimelines(current: Map<string, Timeline>, steps: ArweaveSyncStep[]): Map<string, Timeline> {
	let changed = current.size !== steps.length;
	const next = new Map<string, Timeline>();
	for (const step of steps) {
		const transactionId = step.transaction?.id ?? `${step.key}:empty`;
		const existing = current.get(step.key);
		const reset = existing?.transactionId !== transactionId;
		const base: Timeline = reset || !existing ? { transactionId, lanes: [] } : existing;
		const updated = updateObserverTimeline(base, step.transaction?.views ?? []);
		next.set(step.key, updated);
		if (reset || updated !== existing) changed = true;
	}
	return changed ? next : current;
}

export function updateObserverTimeline(current: Timeline, views: ObserverView[]): Timeline {
	let changed = false;
	let lanes = current.lanes;
	const laneIndexes = new Map(lanes.map((lane, index) => [lane.observer.url, index]));
	const mutableLane = (index: number): LaneHistory => {
		if (lanes === current.lanes) lanes = [...lanes];
		if (lanes[index] === current.lanes[index]) {
			lanes[index] = { ...lanes[index], events: [...lanes[index].events], proofs: [...lanes[index].proofs] };
		}
		return lanes[index];
	};

	for (const view of views) {
		const event: LaneEvent = {
			state: view.state,
			confirmations: view.confirmations,
			updatedAt: view.updatedAt,
			...(view.blockId === undefined ? {} : { blockId: view.blockId }),
			...(view.blockHeight === undefined ? {} : { blockHeight: view.blockHeight }),
			...(view.nodeHeight === undefined ? {} : { nodeHeight: view.nodeHeight }),
			...(view.httpStatus === undefined ? {} : { httpStatus: view.httpStatus }),
			...(view.latency === undefined ? {} : { latency: view.latency }),
			...(view.error === undefined ? {} : { error: view.error }),
		};
		let laneIndex = laneIndexes.get(view.observer.url);
		if (laneIndex === undefined) {
			if (lanes === current.lanes) lanes = [...lanes];
			laneIndex = lanes.length;
			lanes.push({ observer: view.observer, events: [], proofs: [], observedAt: view.updatedAt });
			laneIndexes.set(view.observer.url, laneIndex);
			changed = true;
		}
		let lane = lanes[laneIndex];
		const previous = lane.events[lane.events.length - 1];
		const addEvent = !previous || transitionKey(previous) !== transitionKey(event);
		const previousProof = lane.proofs[lane.proofs.length - 1];
		const addProof =
			view.lastSeenAt !== undefined && (!previousProof || view.lastSeenAt > previousProof.observedAt);
		const updateObservedAt = view.updatedAt > lane.observedAt;
		if (!addEvent && !addProof && !updateObservedAt) continue;

		lane = mutableLane(laneIndex);
		if (addEvent) {
			lane.events.push(event);
			lane.events.sort((left, right) => left.updatedAt - right.updatedAt);
			changed = true;
		}
		if (addProof && view.lastSeenAt !== undefined) {
			lane.proofs.push({
				observedAt: view.lastSeenAt,
				state: view.state,
				confirmations: view.confirmations,
				...(view.latency === undefined ? {} : { latency: view.latency }),
				...(view.httpStatus === undefined ? {} : { httpStatus: view.httpStatus }),
				...(view.blockId === undefined ? {} : { blockId: view.blockId }),
				...(view.blockHeight === undefined ? {} : { blockHeight: view.blockHeight }),
				...(view.nodeHeight === undefined ? {} : { nodeHeight: view.nodeHeight }),
			});
			if (lane.proofs.length > MAX_PROOFS_PER_LANE) {
				lane.proofs.splice(0, lane.proofs.length - MAX_PROOFS_PER_LANE);
			}
			changed = true;
		}
		if (updateObservedAt) {
			lane.observedAt = view.updatedAt;
			changed = true;
		}
	}

	return changed ? { ...current, lanes } : current;
}

/** Groups each observer's per-step timelines into one race lane, in first-seen observer order. */
export function mergeRaceLanes(steps: ArweaveSyncStep[], timelines: Map<string, Timeline>): RaceLane[] {
	const lanes = new Map<string, RaceLane>();
	for (const step of steps) {
		for (const lane of timelines.get(step.key)?.lanes ?? []) {
			const current = lanes.get(lane.observer.url) ?? {
				observer: lane.observer,
				phases: new Map<string, LaneHistory>(),
			};
			current.observer = lane.observer;
			current.phases.set(step.key, lane);
			lanes.set(lane.observer.url, current);
		}
	}
	return [...lanes.values()];
}

export function latestLaneEvent(lane: LaneHistory | undefined): LaneEvent | undefined {
	return lane?.events[lane.events.length - 1];
}

export function previousLaneEvent(lane: LaneHistory | undefined): LaneEvent | undefined {
	return lane?.events[lane.events.length - 2];
}

/** True while any observer lane still has an observed step short of its confirmation target. */
export function raceIsActive(lanes: RaceLane[], steps: ArweaveSyncStep[]): boolean {
	return lanes.some((lane) =>
		steps.some(
			(step) => step.transaction && !phaseIsComplete(latestLaneEvent(lane.phases.get(step.key)), step.target)
		)
	);
}
