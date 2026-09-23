import React from 'react';

import { enrichAcceptedBlockContent, enrichAcceptedBlockProof, fetchCurrentBlockProof } from 'api/mining-telemetry';

import { arweaveGatewayFromLocation } from 'helpers/config';

import { insertAcceptedProof, upsertAcceptedProof } from '../model/acceptedProofs';
import {
	accumulateMiningEstimate,
	type ArweaveMiningTelemetry,
	type MiningNetworkTracker,
	type MiningTelemetrySession,
	miningTelemetrySession,
	recordMiningSample,
	telemetryFromTracker,
	writeMiningTelemetrySession,
} from '../model/miningTelemetry';
import { browserSessionStorage } from '../model/sessionStorage';

const MINING_TELEMETRY_POLL_MS = 5_000;

/**
 * Polls the current Arweave block every five seconds while enabled, estimating network mining rates and collecting
 * accepted proofs. The session's figures persist in session storage so a reload continues the same totals.
 */
export function useArweaveMiningTelemetry(
	enabled: boolean,
	sessionKey: string,
	sessionStartedAt: number
): ArweaveMiningTelemetry {
	const blockOrigin = import.meta.env.VITE_ARWEAVE_BLOCK_SOURCE_URL || arweaveGatewayFromLocation();
	const initialSessionRef = React.useRef<MiningTelemetrySession>();
	if (!initialSessionRef.current) {
		initialSessionRef.current = miningTelemetrySession(
			browserSessionStorage(),
			blockOrigin,
			sessionKey,
			sessionStartedAt
		);
	}
	const [telemetry, setTelemetry] = React.useState<ArweaveMiningTelemetry>(initialSessionRef.current.telemetry);
	const trackerRef = React.useRef<MiningNetworkTracker>(initialSessionRef.current.tracker);
	const telemetryRef = React.useRef(telemetry);
	telemetryRef.current = telemetry;

	React.useEffect(() => {
		const restored = miningTelemetrySession(browserSessionStorage(), blockOrigin, sessionKey, sessionStartedAt);
		trackerRef.current = restored.tracker;
		telemetryRef.current = restored.telemetry;
		setTelemetry(restored.telemetry);
	}, [blockOrigin, sessionKey, sessionStartedAt]);

	React.useEffect(() => {
		writeMiningTelemetrySession(
			browserSessionStorage(),
			blockOrigin,
			sessionKey,
			sessionStartedAt,
			telemetryRef.current,
			trackerRef.current
		);
	}, [blockOrigin, sessionKey, sessionStartedAt, telemetry]);

	React.useEffect(() => {
		if (!enabled || !blockOrigin) return undefined;
		const controller = new AbortController();
		const enrichingProofs = new Set<string>();
		let timer: number | undefined;
		const poll = async () => {
			try {
				const proof = await fetchCurrentBlockProof(blockOrigin, controller.signal);
				const now = Date.now();
				const tracker = trackerRef.current;
				recordMiningSample(tracker, now, proof.estimatedCandidateRate, proof.estimatedDiskReadRate);
				setTelemetry((current) => {
					const next = telemetryFromTracker(
						current,
						tracker,
						insertAcceptedProof(current.acceptedProofs, proof),
						true
					);
					telemetryRef.current = next;
					return next;
				});

				if (!enrichingProofs.has(proof.key)) {
					enrichingProofs.add(proof.key);
					void enrichAcceptedBlockContent(proof, controller.signal)
						.then((contentEntry) => {
							if (controller.signal.aborted) return contentEntry;
							setTelemetry((current) => {
								const next = {
									...current,
									acceptedProofs: upsertAcceptedProof(current.acceptedProofs, contentEntry),
								};
								telemetryRef.current = next;
								return next;
							});
							return contentEntry;
						})
						.then((contentEntry) => enrichAcceptedBlockProof(blockOrigin, contentEntry, controller.signal))
						.then((currentEntry) => {
							if (controller.signal.aborted) return;
							setTelemetry((current) => {
								const next = {
									...current,
									acceptedProofs: upsertAcceptedProof(current.acceptedProofs, currentEntry),
								};
								telemetryRef.current = next;
								return next;
							});
						})
						.catch(() => {
							// Keep the block annotation visible and retry its recall metadata on the next poll.
							enrichingProofs.delete(proof.key);
						});
				}
			} catch {
				if (!controller.signal.aborted) {
					const tracker = trackerRef.current;
					accumulateMiningEstimate(tracker, Date.now());
					setTelemetry((current) => {
						const next = telemetryFromTracker(
							current,
							tracker,
							current.acceptedProofs,
							current.acceptedProofs.length > 0
						);
						telemetryRef.current = next;
						return next;
					});
				}
			}
			if (!controller.signal.aborted) timer = window.setTimeout(poll, MINING_TELEMETRY_POLL_MS);
		};
		void poll();
		return () => {
			controller.abort();
			if (timer !== undefined) window.clearTimeout(timer);
			const tracker = trackerRef.current;
			accumulateMiningEstimate(tracker, Date.now());
			const current = telemetryRef.current;
			const next = telemetryFromTracker(current, tracker, current.acceptedProofs, current.available);
			telemetryRef.current = next;
			writeMiningTelemetrySession(
				browserSessionStorage(),
				blockOrigin,
				sessionKey,
				sessionStartedAt,
				next,
				tracker
			);
		};
	}, [blockOrigin, enabled, sessionKey, sessionStartedAt]);

	return telemetry;
}
