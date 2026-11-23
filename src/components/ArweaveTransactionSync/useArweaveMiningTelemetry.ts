import React from 'react';

import {
	type ArweaveAcceptedProof,
	enrichAcceptedBlockContent,
	enrichAcceptedBlockProof,
	fetchCurrentBlockProof,
} from 'api/arweave-mining-telemetry';

import { arweaveGatewayFromLocation } from 'helpers/config';

import { insertAcceptedProof, upsertAcceptedProof } from './acceptedProofs';

/**
 * - checking: no block poll has finished yet.
 * - live: the last poll reached the block source.
 * - stale: the last poll failed after earlier blocks were seen; the numbers stay frozen at the last success.
 * - unavailable: polls failed and no block has been seen.
 */
export type ArweaveMiningTelemetryStatus = 'checking' | 'live' | 'stale' | 'unavailable';

const MINING_TELEMETRY_STATUSES: readonly ArweaveMiningTelemetryStatus[] = ['checking', 'live', 'stale', 'unavailable'];

/** One finished poll of the block source. */
export type MiningPollResult = { ok: true; proof: ArweaveAcceptedProof } | { ok: false };

export type ArweaveMiningTelemetry = {
	status: ArweaveMiningTelemetryStatus;
	candidateRate?: number;
	averageCandidateRate?: number;
	diskReadRate?: number;
	averageDiskReadRate?: number;
	candidatesSinceStart: number;
	bytesReadSinceStart: number;
	/** Every distinct accepted block height seen this session; acceptedProofs is only the bounded display list. */
	acceptedBlocksSinceStart: number;
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
	acceptedBlocksSinceStart: number;
	/** Highest block height already counted, so a re-polled tip or a same-height fork is not counted twice. */
	lastCountedHeight?: number;
};

/**
 * Caches written before the accepted-block counter existed lack it, and caches written before `status` existed
 * carry the older `checked`/`available` pair instead; both restore instead of resetting.
 */
type CachedMiningTelemetry = Omit<ArweaveMiningTelemetry, 'acceptedBlocksSinceStart' | 'status'> &
	Partial<Pick<ArweaveMiningTelemetry, 'acceptedBlocksSinceStart' | 'status'>> & {
		available?: boolean;
		checked?: boolean;
	};
type CachedMiningNetworkTracker = Omit<MiningNetworkTracker, 'acceptedBlocksSinceStart'> &
	Partial<Pick<MiningNetworkTracker, 'acceptedBlocksSinceStart'>>;

type MiningTelemetryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type MiningTelemetrySession = {
	telemetry: ArweaveMiningTelemetry;
	tracker: MiningNetworkTracker;
};

const MINING_TELEMETRY_CACHE_VERSION = 1;
const MINING_TELEMETRY_CACHE_PREFIX = 'bazar-transaction-sync-mining:v1:';

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
				recordAcceptedBlock(tracker, proof.height);
				setTelemetry((current) => {
					const next = nextMiningTelemetry(current, tracker, { ok: true, proof });
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
					// The tracker is not advanced here: old rates are not extrapolated while the source is unreachable.
					// The next success estimates the gap, as the first sample does back to submission.
					const tracker = trackerRef.current;
					setTelemetry((current) => {
						const next = nextMiningTelemetry(current, tracker, { ok: false });
						telemetryRef.current = next;
						return next;
					});
				}
			}
			if (!controller.signal.aborted) timer = window.setTimeout(poll, 5_000);
		};
		void poll();
		return () => {
			controller.abort();
			if (timer !== undefined) window.clearTimeout(timer);
			const tracker = trackerRef.current;
			const current = telemetryRef.current;
			// Only a live source has rates worth carrying forward to the moment of unmount.
			if (current.status === 'live') accumulateMiningEstimate(tracker, Date.now());
			const next = telemetryFromTracker(current, tracker, current.acceptedProofs, current.status);
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

function browserSessionStorage(): MiningTelemetryStorage | undefined {
	try {
		return typeof window === 'undefined' ? undefined : window.sessionStorage;
	} catch {
		return undefined;
	}
}

export function miningTelemetrySession(
	storage: MiningTelemetryStorage | undefined,
	blockOrigin: string,
	sessionKey: string,
	sessionStartedAt: number
): MiningTelemetrySession {
	const fresh = {
		telemetry: initialTelemetry(blockOrigin),
		tracker: createMiningNetworkTracker(sessionStartedAt),
	};
	if (!storage) return fresh;
	const key = `${MINING_TELEMETRY_CACHE_PREFIX}${sessionKey}`;
	try {
		const value = JSON.parse(storage.getItem(key) ?? 'null');
		if (
			!value ||
			value.version !== MINING_TELEMETRY_CACHE_VERSION ||
			value.blockOrigin !== blockOrigin ||
			value.sessionKey !== sessionKey ||
			value.sessionStartedAt !== sessionStartedAt ||
			!isMiningTelemetry(value.telemetry) ||
			!isMiningNetworkTracker(value.tracker)
		) {
			if (value !== null) storage.removeItem(key);
			return fresh;
		}
		return restoredMiningTelemetrySession(value.telemetry, value.tracker);
	} catch {
		try {
			storage.removeItem(key);
		} catch {
			// A blocked session store should not affect mining telemetry.
		}
		return fresh;
	}
}

export function writeMiningTelemetrySession(
	storage: MiningTelemetryStorage | undefined,
	blockOrigin: string,
	sessionKey: string,
	sessionStartedAt: number,
	telemetry: ArweaveMiningTelemetry,
	tracker: MiningNetworkTracker
) {
	if (!storage) return;
	try {
		storage.setItem(
			`${MINING_TELEMETRY_CACHE_PREFIX}${sessionKey}`,
			JSON.stringify({
				version: MINING_TELEMETRY_CACHE_VERSION,
				blockOrigin,
				sessionKey,
				sessionStartedAt,
				telemetry,
				tracker,
			})
		);
	} catch {
		// The transaction remains recoverable even when optional visual telemetry cannot be cached.
	}
}

function restoredMiningTelemetrySession(
	cachedTelemetry: CachedMiningTelemetry,
	cachedTracker: CachedMiningNetworkTracker
): MiningTelemetrySession {
	const { available, checked, status, ...telemetry } = cachedTelemetry;
	let tracker: MiningNetworkTracker;
	if (cachedTracker.acceptedBlocksSinceStart === undefined) {
		// A cache written before the session counter existed: its proof list is everything it can tell us.
		const heights = telemetry.acceptedProofs.map((proof) => proof.height);
		tracker = { ...cachedTracker, acceptedBlocksSinceStart: new Set(heights).size };
		if (heights.length) tracker.lastCountedHeight = Math.max(...heights);
	} else {
		tracker = { ...cachedTracker, acceptedBlocksSinceStart: cachedTracker.acceptedBlocksSinceStart };
	}
	return {
		telemetry: {
			...telemetry,
			status: status ?? legacyMiningTelemetryStatus(checked, available),
			acceptedBlocksSinceStart: tracker.acceptedBlocksSinceStart,
		},
		tracker,
	};
}

/** The pre-`status` pair could not tell a stale source from a live one, so `available` restores as live. */
function legacyMiningTelemetryStatus(checked?: boolean, available?: boolean): ArweaveMiningTelemetryStatus {
	if (!checked) return 'checking';
	return available ? 'live' : 'unavailable';
}

function isMiningTelemetryStatus(value: unknown): value is ArweaveMiningTelemetryStatus {
	return MINING_TELEMETRY_STATUSES.includes(value as ArweaveMiningTelemetryStatus);
}

function isMiningTelemetry(value: unknown): value is CachedMiningTelemetry {
	if (!value || typeof value !== 'object') return false;
	const telemetry = value as Partial<CachedMiningTelemetry>;
	return Boolean(
		(telemetry.status === undefined
			? typeof telemetry.available === 'boolean' && typeof telemetry.checked === 'boolean'
			: isMiningTelemetryStatus(telemetry.status)) &&
			isOptionalFiniteNumber(telemetry.candidateRate) &&
			isOptionalFiniteNumber(telemetry.averageCandidateRate) &&
			isOptionalFiniteNumber(telemetry.diskReadRate) &&
			isOptionalFiniteNumber(telemetry.averageDiskReadRate) &&
			isFiniteNonNegative(telemetry.candidatesSinceStart) &&
			isFiniteNonNegative(telemetry.bytesReadSinceStart) &&
			isOptionalFiniteNonNegative(telemetry.acceptedBlocksSinceStart) &&
			typeof telemetry.sourceLabel === 'string' &&
			Array.isArray(telemetry.acceptedProofs) &&
			telemetry.acceptedProofs.every(
				(proof) =>
					proof &&
					typeof proof.key === 'string' &&
					isFiniteNonNegative(proof.height) &&
					isFiniteNonNegative(proof.observedAt)
			)
	);
}

function isMiningNetworkTracker(value: unknown): value is CachedMiningNetworkTracker {
	if (!value || typeof value !== 'object') return false;
	const tracker = value as Partial<MiningNetworkTracker>;
	return Boolean(
		isFiniteNonNegative(tracker.lastAt) &&
			isOptionalFiniteNumber(tracker.candidateRate) &&
			isOptionalFiniteNumber(tracker.diskReadRate) &&
			isFiniteNonNegative(tracker.weightedCandidateTotal) &&
			isFiniteNonNegative(tracker.weightedDiskTotal) &&
			isFiniteNonNegative(tracker.duration) &&
			isFiniteNonNegative(tracker.candidatesSinceStart) &&
			isFiniteNonNegative(tracker.bytesReadSinceStart) &&
			isOptionalFiniteNonNegative(tracker.acceptedBlocksSinceStart) &&
			isOptionalFiniteNonNegative(tracker.lastCountedHeight)
	);
}

function isOptionalFiniteNumber(value: unknown) {
	return value === undefined || Number.isFinite(value);
}

function isFiniteNonNegative(value: unknown) {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isOptionalFiniteNonNegative(value: unknown) {
	return value === undefined || isFiniteNonNegative(value);
}

/**
 * Counts an accepted block the first time its height is seen. The first tip observed counts too, matching
 * the accepted-proof list, so the total equals the list length until the list reaches its display cap.
 */
export function recordAcceptedBlock(tracker: MiningNetworkTracker, height: number): void {
	if (tracker.lastCountedHeight !== undefined && height <= tracker.lastCountedHeight) return;
	tracker.acceptedBlocksSinceStart += 1;
	tracker.lastCountedHeight = height;
}

export function recordMiningSample(
	tracker: MiningNetworkTracker,
	now: number,
	candidateRate: number | undefined,
	diskReadRate: number | undefined
): void {
	const firstSample = tracker.candidateRate === undefined && tracker.diskReadRate === undefined;
	if (!firstSample) accumulateMiningEstimate(tracker, now);
	tracker.candidateRate = candidateRate;
	tracker.diskReadRate = diskReadRate;
	if (firstSample) accumulateMiningEstimate(tracker, now);
}

export function accumulateMiningEstimate(tracker: MiningNetworkTracker, now: number): void {
	if (tracker.candidateRate === undefined && tracker.diskReadRate === undefined) return;
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

/**
 * The one transition for a finished poll. A success goes live with the tracker's numbers. A failure keeps
 * every number as it was, so stale data is never presented as advancing; it is stale once a block was seen.
 */
export function nextMiningTelemetry(
	current: ArweaveMiningTelemetry,
	tracker: MiningNetworkTracker,
	result: MiningPollResult
): ArweaveMiningTelemetry {
	if (result.ok) {
		return telemetryFromTracker(
			current,
			tracker,
			insertAcceptedProof(current.acceptedProofs, result.proof),
			'live'
		);
	}
	return { ...current, status: current.acceptedProofs.length > 0 ? 'stale' : 'unavailable' };
}

function telemetryFromTracker(
	current: ArweaveMiningTelemetry,
	tracker: MiningNetworkTracker,
	acceptedProofs: ArweaveAcceptedProof[],
	status: ArweaveMiningTelemetryStatus
): ArweaveMiningTelemetry {
	return {
		...current,
		status,
		candidateRate: tracker.candidateRate,
		averageCandidateRate: tracker.duration
			? tracker.weightedCandidateTotal / tracker.duration
			: tracker.candidateRate,
		diskReadRate: tracker.diskReadRate,
		averageDiskReadRate: tracker.duration ? tracker.weightedDiskTotal / tracker.duration : tracker.diskReadRate,
		candidatesSinceStart: tracker.candidatesSinceStart,
		bytesReadSinceStart: tracker.bytesReadSinceStart,
		acceptedBlocksSinceStart: tracker.acceptedBlocksSinceStart,
		acceptedProofs,
	};
}

export function createMiningNetworkTracker(startedAt: number): MiningNetworkTracker {
	return {
		lastAt: startedAt,
		weightedCandidateTotal: 0,
		weightedDiskTotal: 0,
		duration: 0,
		candidatesSinceStart: 0,
		bytesReadSinceStart: 0,
		acceptedBlocksSinceStart: 0,
	};
}

function initialTelemetry(blockOrigin: string): ArweaveMiningTelemetry {
	return {
		status: 'checking',
		candidatesSinceStart: 0,
		bytesReadSinceStart: 0,
		acceptedBlocksSinceStart: 0,
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
