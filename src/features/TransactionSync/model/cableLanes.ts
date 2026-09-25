import type { Observer, ObserverView } from 'api/transactions';

import type { TransactionSyncMessages } from '../messages';
import type { ArweaveSyncStep, Infinity3DLane, ObserverTooltipStage } from '../types';

import {
	type LaneEvent,
	type LaneHistory,
	type LaneProof,
	latestLaneEvent,
	previousLaneEvent,
	type RaceLane,
} from './observerTimeline';
import { confirmationProgress } from './progressColors';
import {
	elapsedLabel,
	MAX_VISIBLE_MINOR_EVENT_MARKERS,
	minorEventMarkerPositions,
	phaseIsComplete,
	timelineLayout,
} from './raceTimeline';
import { sequencePhaseBounds } from './sequence';

const RECENT_PROOF_CANDIDATE_MULTIPLIER = 2;

/** Builds the renderer's view of one observer lane: per-phase progress, markers, tooltip stages, and labels. */
export function infinity3DLane(
	lane: RaceLane,
	steps: ArweaveSyncStep[],
	liveAt: number,
	includeProofs: boolean,
	language: TransactionSyncMessages
): Infinity3DLane {
	const phases = steps.map((step, index) => {
		const bounds = sequencePhaseBounds(index, steps.length);
		const history = lane.phases.get(step.key);
		const event = latestLaneEvent(history);
		const complete = phaseIsComplete(event, step.target);
		const rendered = infinity3DPhase(
			history,
			bounds.start,
			bounds.end,
			step.target,
			complete,
			liveAt,
			step.label,
			includeProofs,
			language
		);
		return {
			step,
			history,
			event,
			complete,
			confirmations: cappedConfirmations(event, step.target),
			...rendered,
		};
	});
	const activePhase = [...phases].reverse().find((phase) => phase.history?.events.length) ?? phases[0];
	const latestEvent = activePhase?.event;
	const previousEvent = previousLaneEvent(activePhase?.history);
	const statusLabel = latestEvent
		? observerStatusLabel(
				timelineEventLabel(latestEvent, previousEvent, language),
				latestLaneLatency(activePhase?.history),
				language
		  )
		: language.transactionSyncLaneConnecting;
	const stages: ObserverTooltipStage[] = phases.map((phase) => ({
		label: phase.step.label,
		count: phase.confirmations,
		target: phase.step.target,
		state: phase.event?.state ?? 'unknown',
		hasError: Boolean(phase.event?.error),
	}));
	const phaseDetail = phases
		.map((phase) => `${phase.step.label} ${phase.confirmations}/${phase.step.target}`)
		.join(' · ');
	const detail = `${lane.observer.label} · ${phaseDetail} · ${statusLabel} · ${observerProtocolDetail(
		lane.observer,
		language
	)}`;

	return {
		observerUrl: lane.observer.url,
		label: lane.observer.label,
		detail,
		statusLabel,
		stages,
		progress: activePhase?.progress ?? 0,
		phases: phases.map((phase) => ({
			progress: phase.progress,
			started: Boolean(phase.history?.events.length),
			complete: phase.complete,
		})),
		state: latestEvent?.state ?? 'unknown',
		confirmations: latestEvent?.confirmations ?? 0,
		error: Boolean(latestEvent?.error),
		markers: phases.flatMap((phase) => phase.markers),
	};
}

/** The median lane's progress through the active phase, as a percentage, or undefined before any lane exists. */
export function medianActivePhaseProgress(
	lanes: Infinity3DLane[],
	steps: ArweaveSyncStep[],
	activeStep: string | undefined
): number | undefined {
	const activeIndex = steps.findIndex((step) => step.key === activeStep);
	if (activeIndex < 0 || !lanes.length) return undefined;
	const bounds = sequencePhaseBounds(activeIndex, steps.length);
	const phaseSize = bounds.end - bounds.start;
	const values = lanes
		.map((lane) => (((lane.phases[activeIndex]?.progress ?? bounds.start) - bounds.start) / phaseSize) * 100)
		.map((progress) => Math.min(100, Math.max(0, progress)))
		.sort((left, right) => left - right);
	const middle = Math.floor(values.length / 2);
	return values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
}

function cappedConfirmations(event: LaneEvent | undefined, target: number): number {
	return Math.min(target, Math.max(0, event?.confirmations ?? 0));
}

function infinity3DPhase(
	lane: LaneHistory | undefined,
	phaseStart: number,
	phaseEnd: number,
	target: number,
	complete: boolean,
	liveAt: number,
	phaseLabel: string,
	includeProofs: boolean,
	language: TransactionSyncMessages
): Pick<Infinity3DLane, 'progress' | 'markers'> {
	if (!lane?.events.length) return { progress: phaseStart, markers: [] };
	const observedAt = complete ? lane.observedAt : Math.max(lane.observedAt, liveAt);
	const layout = timelineLayout(lane.events, observedAt, phaseStart, phaseEnd, target, complete);
	const startedAt = lane.events[0].updatedAt;
	const eventTimestamps = new Set(lane.events.map((event) => event.updatedAt));
	const rawProofMarkers = includeProofs
		? lane.proofs.slice(-MAX_VISIBLE_MINOR_EVENT_MARKERS * RECENT_PROOF_CANDIDATE_MULTIPLIER).flatMap((proof) => {
				if (eventTimestamps.has(proof.observedAt)) return [];
				const proofEvents = lane.events.filter((event) => event.updatedAt <= proof.observedAt);
				if (!proofEvents.length) return [];
				const proofLayout = timelineLayout(proofEvents, proof.observedAt, phaseStart, phaseEnd, target, false);
				return [
					{
						kind: 'proof' as const,
						confirmation: false,
						progress: proofLayout.progressEnd,
						colorProgress: confirmationProgress(proof.confirmations, target),
						state: proof.state,
						confirmations: proof.confirmations,
						error: false,
						observedAt: proof.observedAt,
						detail: `${phaseLabel} · ${proofEventLabel(proof, language)} · ${elapsedLabel(
							proof.observedAt - startedAt
						)}`,
					},
				];
		  })
		: [];
	const minorMarkerPositions = minorEventMarkerPositions(
		rawProofMarkers.map((marker) => marker.progress),
		phaseStart
	);
	const proofMarkers = rawProofMarkers
		.slice(-MAX_VISIBLE_MINOR_EVENT_MARKERS)
		.slice(-minorMarkerPositions.length)
		.map((marker, index) => ({ ...marker, progress: minorMarkerPositions[index] }));
	return {
		progress: layout.progressEnd,
		markers: [
			...lane.events.map((event, index) => ({
				kind: 'event' as const,
				confirmation: event.confirmations > (lane.events[index - 1]?.confirmations ?? 0),
				progress: layout.positions[index] ?? phaseStart,
				colorProgress: confirmationProgress(event.confirmations, target),
				state: event.state,
				confirmations: event.confirmations,
				error: Boolean(event.error),
				observedAt: event.updatedAt,
				detail: `${phaseLabel} · ${observerStatusLabel(
					timelineEventLabel(event, lane.events[index - 1], language),
					event.latency,
					language
				)}${
					protocolEventContext(event, language) ? ` · ${protocolEventContext(event, language)}` : ''
				} · ${elapsedLabel(event.updatedAt - startedAt)}`,
			})),
			...proofMarkers,
		],
	};
}

function proofEventLabel(proof: LaneProof, language: TransactionSyncMessages): string {
	const parts: string[] = [];
	if (proof.httpStatus !== undefined) {
		parts.push(language.transactionSyncProofHttpStatus.replace('{status}', String(proof.httpStatus)));
	}
	if (proof.blockHeight !== undefined) {
		parts.push(language.transactionSyncProofMinedAtHeight.replace('{height}', proof.blockHeight.toLocaleString()));
	}
	if (proof.blockId) {
		parts.push(language.transactionSyncProofBlockId.replace('{id}', shortBlockId(proof.blockId)));
	}
	if (proof.nodeHeight !== undefined) {
		parts.push(language.transactionSyncProofCheckedHeight.replace('{height}', proof.nodeHeight.toLocaleString()));
	}
	if (proof.latency !== undefined) parts.push(observerLatencyLabel(proof.latency, language));
	return parts.length ? parts.join(' · ') : language.transactionSyncProofObserved;
}

function shortBlockId(blockId: string): string {
	return blockId.length <= 14 ? blockId : `${blockId.slice(0, 7)}…${blockId.slice(-5)}`;
}

function latestLaneLatency(lane: LaneHistory | undefined): number | undefined {
	return lane?.proofs[lane.proofs.length - 1]?.latency ?? latestLaneEvent(lane)?.latency;
}

function observerStatusLabel(label: string, latency: number | undefined, language: TransactionSyncMessages): string {
	return latency === undefined ? label : `${label} · ${observerLatencyLabel(latency, language)}`;
}

function observerLatencyLabel(latency: number, language: TransactionSyncMessages): string {
	return language.transactionSyncObserverLatency.replace('{latency}', String(Math.max(0, Math.round(latency))));
}

function protocolEventContext(event: LaneEvent, language: TransactionSyncMessages): string {
	const parts: string[] = [];
	if (event.httpStatus !== undefined && ![404, 202].includes(event.httpStatus)) {
		parts.push(language.transactionSyncProofHttpStatus.replace('{status}', String(event.httpStatus)));
	}
	if (event.blockHeight !== undefined) {
		parts.push(language.transactionSyncProofMinedAtHeight.replace('{height}', event.blockHeight.toLocaleString()));
	}
	if (event.blockId) {
		parts.push(language.transactionSyncProofBlockId.replace('{id}', shortBlockId(event.blockId)));
	}
	if (event.nodeHeight !== undefined) {
		parts.push(language.transactionSyncProofCheckedHeight.replace('{height}', event.nodeHeight.toLocaleString()));
	}
	return parts.join(' · ');
}

function observerProtocolDetail(observer: Observer, language: TransactionSyncMessages): string {
	const unknown = language.transactionSyncProtocolUnknown;
	const sourceKey =
		observer.source === 'seed'
			? 'transactionSyncObserverSourceSeed'
			: observer.source === 'local'
			? 'transactionSyncObserverSourceLocal'
			: observer.source === 'hyperbeam'
			? 'transactionSyncObserverSourceHyperbeam'
			: 'transactionSyncObserverSourcePeer';
	const summary = language.transactionSyncProtocolObserver
		.replace('{source}', language[sourceKey])
		.replace('{height}', observer.height === undefined ? unknown : observer.height.toLocaleString())
		.replace('{release}', observer.release === undefined ? unknown : String(observer.release))
		.replace('{failures}', String(observer.failures));
	return observer.discoveredBy
		? `${summary} · ${language.transactionSyncProtocolDiscoveredBy.replace('{observer}', observer.discoveredBy)}`
		: summary;
}

function laneEventLabel(event: LaneEvent, language: TransactionSyncMessages): string {
	return event.state === 'confirmed'
		? language.transactionSyncLaneConfirmed.replace('{count}', String(event.confirmations))
		: laneLabel(event.state, language);
}

function timelineEventLabel(
	event: LaneEvent,
	previous: LaneEvent | undefined,
	language: TransactionSyncMessages
): string {
	if (event.error) return language.transactionSyncLaneUnavailable;
	const label = laneEventLabel(event, language);
	return previous?.error ? language.transactionSyncLaneRecovered.replace('{status}', label) : label;
}

function laneLabel(state: ObserverView['state'], language: TransactionSyncMessages): string {
	return {
		unknown: language.transactionSyncLaneConnecting,
		'not-found': language.transactionSyncLaneWaiting,
		pending: language.transactionSyncLanePending,
		confirmed: language.transactionSyncLaneConfirmed.replace('{count}', '0'),
		gone: language.transactionSyncLaneReorged,
	}[state];
}
