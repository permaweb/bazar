import { describe, expect, it } from 'vitest';

import {
	accumulateMiningEstimate,
	createMiningNetworkTracker,
	miningTelemetrySession,
	recordMiningSample,
	writeMiningTelemetrySession,
} from './useArweaveMiningTelemetry';
import {
	type ArweaveSyncStep,
	protocolActivityDetail,
	readCachedObserverViews,
	transactionSyncSessionKey,
	writeCachedObserverViews,
} from '.';

const language = {
	transactionSyncProtocolActivity:
		'{phase} · {state} · HTTP {status} · {latency} ms · node {height} · observer depth {depth}',
	transactionSyncProtocolStateConfirmed: 'confirmed',
	transactionSyncProtocolStateError: 'request failed',
	transactionSyncProtocolStateGone: 'confirmation reorganized',
	transactionSyncProtocolStateNotFound: 'not yet seen',
	transactionSyncProtocolStatePending: 'waiting to be mined',
	transactionSyncProtocolUnknown: 'Unknown',
};

function step(key: string, id?: string): ArweaveSyncStep {
	return {
		key,
		label: key,
		target: 5,
		...(id ? { transaction: { id, views: [] } } : {}),
	};
}

describe('transaction synchronization telemetry', () => {
	it('restores the latest observer view for a transaction after a page reload', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
			removeItem: (key: string) => values.delete(key),
		};
		const transactionId = 'R'.repeat(43);
		const views = [
			{
				observer: {
					url: 'https://observer.example',
					label: 'observer.example',
					source: 'peer' as const,
					failures: 0,
				},
				state: 'confirmed' as const,
				confirmations: 5,
				updatedAt: 10,
				lastSeenAt: 11,
				changedAt: 10,
			},
		];

		writeCachedObserverViews(storage, transactionId, views);
		expect(readCachedObserverViews(storage, transactionId)).toEqual(views);
	});

	it('ignores and clears malformed observer view cache entries', () => {
		const transactionId = 'R'.repeat(43);
		const key = `bazar-transaction-sync-views:v1:${transactionId}`;
		const values = new Map([[key, JSON.stringify({ version: 1, transactionId, views: [{ state: 'confirmed' }] })]]);
		const storage = {
			getItem: (storageKey: string) => values.get(storageKey) ?? null,
			setItem: (storageKey: string, value: string) => values.set(storageKey, value),
			removeItem: (storageKey: string) => values.delete(storageKey),
		};

		expect(readCachedObserverViews(storage, transactionId)).toEqual([]);
		expect(values.has(key)).toBe(false);
	});

	it('keeps one cumulative session when a later transaction joins the sequence', () => {
		const registration = 'R'.repeat(43);
		expect(transactionSyncSessionKey([step('register', registration), step('pay')])).toBe(registration);
		expect(transactionSyncSessionKey([step('register', registration), step('pay', 'P'.repeat(43))])).toBe(
			registration
		);
		expect(transactionSyncSessionKey([step('register', 'N'.repeat(43)), step('pay')])).not.toBe(registration);
	});

	it('projects the first genuine mining sample back to transaction submission', () => {
		const tracker = createMiningNetworkTracker(1_000);
		accumulateMiningEstimate(tracker, 3_000);
		recordMiningSample(tracker, 4_000, 10, 100);
		expect(tracker.candidatesSinceStart).toBe(30);
		expect(tracker.bytesReadSinceStart).toBe(300);

		recordMiningSample(tracker, 6_000, 20, 200);
		expect(tracker.candidatesSinceStart).toBe(50);
		expect(tracker.bytesReadSinceStart).toBe(500);
	});

	it('restores cumulative mining telemetry and accepted proofs after a page reload', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
			removeItem: (key: string) => values.delete(key),
		};
		const tracker = createMiningNetworkTracker(1_000);
		recordMiningSample(tracker, 4_000, 10, 100);
		const telemetry = {
			available: true,
			checked: true,
			candidateRate: 10,
			averageCandidateRate: 10,
			diskReadRate: 100,
			averageDiskReadRate: 100,
			candidatesSinceStart: 30,
			bytesReadSinceStart: 300,
			sourceLabel: 'arweave.example',
			acceptedProofs: [
				{
					key: '10:block',
					height: 10,
					blockId: 'block',
					proofCount: 1,
					recallBytes: [],
					recallSamples: [],
					transactionCount: 0,
					observedAt: 3_000,
				},
			],
		};

		writeMiningTelemetrySession(storage, 'https://arweave.example', 'session', 1_000, telemetry, tracker);
		expect(miningTelemetrySession(storage, 'https://arweave.example', 'session', 1_000)).toEqual({
			telemetry,
			tracker,
		});
	});

	it('describes observer depth without implying that network quorum advanced', () => {
		expect(
			protocolActivityDetail(
				{
					key: 'observer:1',
					observedAt: 1,
					kind: 'confirmation',
					phase: 'pay',
					phaseLabel: 'Pay seller',
					observer: 'node.example',
					state: 'confirmed',
					confirmations: 3,
					httpStatus: 200,
					latency: 87.4,
					nodeHeight: 1_973_667,
				},
				language
			)
		).toBe('Pay seller · confirmed · HTTP 200 · 87 ms · node 1,973,667 · observer depth 3');
	});
});
