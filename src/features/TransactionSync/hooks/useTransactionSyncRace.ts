import React from 'react';

import type { TransactionSyncMessages } from '../messages';
import { infinity3DLane, medianActivePhaseProgress } from '../model/cableLanes';
import type { ArweaveMiningTelemetry } from '../model/miningTelemetry';
import { mergeRaceLanes, raceIsActive } from '../model/observerTimeline';
import { type ProtocolTelemetry, transactionSyncSessionKey } from '../model/protocolTelemetry';
import type { ArweaveSyncStep, Infinity3DLane } from '../types';

import { useArweaveMiningTelemetry } from './useArweaveMiningTelemetry';
import { useLiveObserverResponses } from './useLiveObserverResponses';
import { useObserverTimelines } from './useObserverTimelines';
import { useProtocolTelemetry } from './useProtocolTelemetry';
import { useRaceClock } from './useRaceClock';

export type TransactionSyncRace = {
	/** The steps with live observer responses merged in. */
	observedSteps: ArweaveSyncStep[];
	lanes: Infinity3DLane[];
	protocolTelemetry: ProtocolTelemetry;
	miningTelemetry: ArweaveMiningTelemetry;
	/** The median lane's progress through the active phase, once any observer has answered. */
	activePhaseProgress: number | undefined;
};

/**
 * Observes a transaction sequence across the observer network: live responses, per-observer timelines, a live clock
 * while any lane is still confirming, protocol telemetry, and mining telemetry for one session.
 */
export function useTransactionSyncRace(options: {
	steps: ArweaveSyncStep[];
	activeStep: string | undefined;
	startedAt: number | undefined;
	active: boolean;
	miningTelemetryEnabled: boolean;
	language: TransactionSyncMessages;
}): TransactionSyncRace {
	const observedSteps = useLiveObserverResponses(options.steps);
	const sessionKey = transactionSyncSessionKey(observedSteps);
	const sessionRef = React.useRef({ key: sessionKey, startedAt: options.startedAt ?? Date.now() });
	if (
		sessionRef.current.key !== sessionKey ||
		(options.startedAt !== undefined && sessionRef.current.startedAt !== options.startedAt)
	) {
		sessionRef.current = { key: sessionKey, startedAt: options.startedAt ?? Date.now() };
	}
	const timelines = useObserverTimelines(observedSteps);
	const raceLanes = React.useMemo(() => mergeRaceLanes(observedSteps, timelines), [observedSteps, timelines]);
	const liveAt = useRaceClock(options.active && raceIsActive(raceLanes, observedSteps));
	const protocolTelemetry = useProtocolTelemetry(
		observedSteps,
		options.activeStep,
		liveAt,
		sessionKey,
		sessionRef.current.startedAt
	);
	const miningTelemetry = useArweaveMiningTelemetry(
		options.miningTelemetryEnabled && options.active && raceLanes.length > 0,
		sessionKey,
		sessionRef.current.startedAt
	);
	const lanes = React.useMemo(
		() => raceLanes.map((lane) => infinity3DLane(lane, observedSteps, liveAt, true, options.language)),
		[liveAt, observedSteps, options.language, raceLanes]
	);
	const activePhaseProgress = React.useMemo(
		() => medianActivePhaseProgress(lanes, observedSteps, options.activeStep),
		[lanes, observedSteps, options.activeStep]
	);

	return { observedSteps, lanes, protocolTelemetry, miningTelemetry, activePhaseProgress };
}
