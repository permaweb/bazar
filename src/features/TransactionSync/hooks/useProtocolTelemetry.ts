import React from 'react';

import {
	collectProtocolResponses,
	createProtocolTelemetryTracker,
	INITIAL_PROTOCOL_TELEMETRY_COUNTERS,
	type ProtocolTelemetry,
	protocolTelemetryCountersReducer,
	protocolTelemetrySnapshot,
	type ProtocolTelemetryTracker,
} from '../model/protocolTelemetry';
import type { ArweaveSyncStep } from '../types';

/** Counts observer responses, state changes, and confirmations for one telemetry session. */
export function useProtocolTelemetry(
	steps: ArweaveSyncStep[],
	activeStep: string | undefined,
	now: number,
	sessionKey: string,
	sessionStartedAt: number
): ProtocolTelemetry {
	const trackerRef = React.useRef<ProtocolTelemetryTracker>(
		createProtocolTelemetryTracker(sessionKey, sessionStartedAt)
	);
	const [counters, dispatch] = React.useReducer(
		protocolTelemetryCountersReducer,
		INITIAL_PROTOCOL_TELEMETRY_COUNTERS
	);

	React.useEffect(() => {
		let tracker = trackerRef.current;
		const reset = tracker.key !== sessionKey;
		if (reset) {
			tracker = createProtocolTelemetryTracker(sessionKey, sessionStartedAt);
			trackerRef.current = tracker;
		}
		const batch = collectProtocolResponses(tracker, steps, reset);
		dispatch({ type: reset ? 'session-started' : 'responses-observed', batch });
	}, [sessionKey, sessionStartedAt, steps]);

	return protocolTelemetrySnapshot(
		counters,
		trackerRef.current,
		steps,
		activeStep,
		now,
		sessionKey,
		sessionStartedAt
	);
}
