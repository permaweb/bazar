import {
	type ArweaveAcceptedProof,
	enrichAcceptedBlockContent,
	enrichAcceptedBlockProof,
	fetchCurrentBlockProof,
} from 'api/arweave-mining-telemetry';
import React from 'react';

import { DEFAULT_GATEWAY } from 'helpers/config';

export type ArweaveMiningTelemetry = {
	available: boolean;
	checked: boolean;
	candidateRate?: number;
	averageCandidateRate?: number;
	diskReadRate?: number;
	averageDiskReadRate?: number;
	candidatesSinceStart: number;
	bytesReadSinceStart: number;
	sourceLabel: string;
	acceptedProofs: ArweaveAcceptedProof[];
};

type MiningNetworkTracker = {
	lastAt: number;
	candidateRate?: number;
	diskReadRate?: number;
	weightedCandidateTotal: number;
	weightedDiskTotal: number;
	duration: number;
	candidatesSinceStart: number;
	bytesReadSinceStart: number;
};

const MAX_ACCEPTED_PROOFS = 10;

export function useArweaveMiningTelemetry(enabled: boolean, sessionKey: string): ArweaveMiningTelemetry {
	const blockOrigin = import.meta.env.VITE_ARWEAVE_BLOCK_SOURCE_URL || DEFAULT_GATEWAY;
	const [telemetry, setTelemetry] = React.useState<ArweaveMiningTelemetry>(() => initialTelemetry(blockOrigin));
	const trackerRef = React.useRef<MiningNetworkTracker>(initialTracker());

	React.useEffect(() => {
		trackerRef.current = initialTracker();
		setTelemetry(initialTelemetry(blockOrigin));
	}, [blockOrigin, sessionKey]);

	React.useEffect(() => {
		if (!enabled || !blockOrigin) return undefined;
		const controller = new AbortController();
		const enrichingProofs = new Set<string>();
		let highestObservedHeight: number | undefined;
		let timer: number | undefined;
		const poll = async () => {
			try {
				const proof = await fetchCurrentBlockProof(blockOrigin, controller.signal);
				const isNewBlock = highestObservedHeight !== undefined && proof.height > highestObservedHeight;
				highestObservedHeight =
					highestObservedHeight === undefined ? proof.height : Math.max(highestObservedHeight, proof.height);
				const now = Date.now();
				const tracker = trackerRef.current;
				accumulateTracker(tracker, now);
				tracker.candidateRate = proof.estimatedCandidateRate;
				tracker.diskReadRate = proof.estimatedDiskReadRate;
				setTelemetry((current) => telemetryFromTracker(current, tracker, current.acceptedProofs, true));

				if (isNewBlock && !enrichingProofs.has(proof.key)) {
					enrichingProofs.add(proof.key);
					void enrichAcceptedBlockContent(proof, controller.signal)
						.then((contentEntry) => {
							if (controller.signal.aborted) return contentEntry;
							setTelemetry((current) => ({
								...current,
								acceptedProofs: upsertAcceptedProof(current.acceptedProofs, contentEntry),
							}));
							return contentEntry;
						})
						.then((contentEntry) => enrichAcceptedBlockProof(blockOrigin, contentEntry, controller.signal))
						.then((currentEntry) => {
							if (controller.signal.aborted) return;
							setTelemetry((current) => ({
								...current,
								acceptedProofs: upsertAcceptedProof(current.acceptedProofs, currentEntry),
							}));
						})
						.catch(() => {
							// Withhold the card when its exact recall-offset links could not be resolved.
						});
				}
			} catch {
				if (!controller.signal.aborted) {
					const tracker = trackerRef.current;
					accumulateTracker(tracker, Date.now());
					setTelemetry((current) =>
						telemetryFromTracker(
							current,
							tracker,
							current.acceptedProofs,
							current.acceptedProofs.length > 0
						)
					);
				}
			}
			if (!controller.signal.aborted) timer = window.setTimeout(poll, 5_000);
		};
		void poll();
		return () => {
			controller.abort();
			if (timer !== undefined) window.clearTimeout(timer);
		};
	}, [blockOrigin, enabled, sessionKey]);

	return telemetry;
}

function upsertAcceptedProof(current: ArweaveAcceptedProof[], proof: ArweaveAcceptedProof): ArweaveAcceptedProof[] {
	return [...current.filter((entry) => entry.key !== proof.key), proof]
		.sort((left, right) => left.height - right.height)
		.slice(-MAX_ACCEPTED_PROOFS);
}

function accumulateTracker(tracker: MiningNetworkTracker, now: number): void {
	const duration = Math.max(0, now - tracker.lastAt) / 1_000;
	if (tracker.candidateRate !== undefined) {
		tracker.weightedCandidateTotal += tracker.candidateRate * duration;
		tracker.candidatesSinceStart += tracker.candidateRate * duration;
	}
	if (tracker.diskReadRate !== undefined) {
		tracker.weightedDiskTotal += tracker.diskReadRate * duration;
		tracker.bytesReadSinceStart += tracker.diskReadRate * duration;
	}
	if (tracker.candidateRate !== undefined || tracker.diskReadRate !== undefined) tracker.duration += duration;
	tracker.lastAt = now;
}

function telemetryFromTracker(
	current: ArweaveMiningTelemetry,
	tracker: MiningNetworkTracker,
	acceptedProofs: ArweaveAcceptedProof[],
	available: boolean
): ArweaveMiningTelemetry {
	return {
		...current,
		available,
		checked: true,
		candidateRate: tracker.candidateRate,
		averageCandidateRate: tracker.duration
			? tracker.weightedCandidateTotal / tracker.duration
			: tracker.candidateRate,
		diskReadRate: tracker.diskReadRate,
		averageDiskReadRate: tracker.duration ? tracker.weightedDiskTotal / tracker.duration : tracker.diskReadRate,
		candidatesSinceStart: tracker.candidatesSinceStart,
		bytesReadSinceStart: tracker.bytesReadSinceStart,
		acceptedProofs,
	};
}

function initialTracker(): MiningNetworkTracker {
	return {
		lastAt: Date.now(),
		weightedCandidateTotal: 0,
		weightedDiskTotal: 0,
		duration: 0,
		candidatesSinceStart: 0,
		bytesReadSinceStart: 0,
	};
}

function initialTelemetry(blockOrigin: string): ArweaveMiningTelemetry {
	return {
		available: false,
		checked: false,
		candidatesSinceStart: 0,
		bytesReadSinceStart: 0,
		sourceLabel: sourceLabel(blockOrigin),
		acceptedProofs: [],
	};
}

function sourceLabel(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return url;
	}
}
