import type { ArweaveAcceptedProof } from 'api/mining-telemetry';

import type { TransactionSyncSessionStorage } from './sessionStorage';

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

export type MiningNetworkTracker = {
	lastAt: number;
	candidateRate?: number;
	diskReadRate?: number;
	weightedCandidateTotal: number;
	weightedDiskTotal: number;
	duration: number;
	candidatesSinceStart: number;
	bytesReadSinceStart: number;
};

export type MiningTelemetrySession = {
	telemetry: ArweaveMiningTelemetry;
	tracker: MiningNetworkTracker;
};

const MINING_TELEMETRY_CACHE_VERSION = 1;
const MINING_TELEMETRY_CACHE_PREFIX = 'bazar-transaction-sync-mining:v1:';

export function miningTelemetrySession(
	storage: TransactionSyncSessionStorage | undefined,
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
		return { telemetry: value.telemetry, tracker: value.tracker };
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
	storage: TransactionSyncSessionStorage | undefined,
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

function isMiningTelemetry(value: unknown): value is ArweaveMiningTelemetry {
	if (!value || typeof value !== 'object') return false;
	const telemetry = value as Partial<ArweaveMiningTelemetry>;
	return Boolean(
		typeof telemetry.available === 'boolean' &&
			typeof telemetry.checked === 'boolean' &&
			isOptionalFiniteNumber(telemetry.candidateRate) &&
			isOptionalFiniteNumber(telemetry.averageCandidateRate) &&
			isOptionalFiniteNumber(telemetry.diskReadRate) &&
			isOptionalFiniteNumber(telemetry.averageDiskReadRate) &&
			isFiniteNonNegative(telemetry.candidatesSinceStart) &&
			isFiniteNonNegative(telemetry.bytesReadSinceStart) &&
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

function isMiningNetworkTracker(value: unknown): value is MiningNetworkTracker {
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
			isFiniteNonNegative(tracker.bytesReadSinceStart)
	);
}

function isOptionalFiniteNumber(value: unknown) {
	return value === undefined || Number.isFinite(value);
}

function isFiniteNonNegative(value: unknown) {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
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

export function telemetryFromTracker(
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

export function createMiningNetworkTracker(startedAt: number): MiningNetworkTracker {
	return {
		lastAt: startedAt,
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
