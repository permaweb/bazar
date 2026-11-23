import { describe, expect, it } from 'vitest';

import type { ArweaveAcceptedProof } from 'api/arweave-mining-telemetry';

import { insertAcceptedProof } from './acceptedProofs';
import {
	accumulateMiningEstimate,
	createMiningNetworkTracker,
	miningTelemetrySession,
	nextMiningTelemetry,
	recordAcceptedBlock,
	recordMiningSample,
	writeMiningTelemetrySession,
} from './useArweaveMiningTelemetry';
import {
	type ArweaveSyncStep,
	miningStatus,
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

function acceptedProof(height: number, blockId = `block-${height}`): ArweaveAcceptedProof {
	return {
		key: `${height}:${blockId}`,
		height,
		blockId,
		proofCount: 1,
		recallBytes: [],
		recallSamples: [],
		transactionCount: 0,
		observedAt: height * 1_000,
	};
}

function memoryStorage() {
	const values = new Map<string, string>();
	return {
		values,
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
	};
}

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
		recordAcceptedBlock(tracker, 10);
		const telemetry = {
			status: 'live' as const,
			candidateRate: 10,
			averageCandidateRate: 10,
			diskReadRate: 100,
			averageDiskReadRate: 100,
			candidatesSinceStart: 30,
			bytesReadSinceStart: 300,
			acceptedBlocksSinceStart: 1,
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

	it('keeps counting accepted blocks after the display list reaches its cap', () => {
		const tracker = createMiningNetworkTracker(0);
		let proofs: ArweaveAcceptedProof[] = [];
		for (let height = 100; height < 112; height += 1) {
			const proof = acceptedProof(height);
			recordAcceptedBlock(tracker, proof.height);
			proofs = insertAcceptedProof(proofs, proof);
		}

		// The first tip seen counts as well, like the list itself: the label is not "since submission".
		expect(tracker.acceptedBlocksSinceStart).toBe(12);
		expect(proofs).toHaveLength(10);
		expect(tracker.lastCountedHeight).toBe(111);
	});

	it('counts a re-polled tip, a same-height fork and an older height once', () => {
		const tracker = createMiningNetworkTracker(0);
		recordAcceptedBlock(tracker, acceptedProof(200, 'a').height);
		recordAcceptedBlock(tracker, acceptedProof(200, 'a').height);
		recordAcceptedBlock(tracker, acceptedProof(200, 'fork').height);
		recordAcceptedBlock(tracker, acceptedProof(199).height);
		expect(tracker.acceptedBlocksSinceStart).toBe(1);

		recordAcceptedBlock(tracker, acceptedProof(201).height);
		expect(tracker.acceptedBlocksSinceStart).toBe(2);
	});

	it('restores a cache written before the accepted-block counter without resetting other totals', () => {
		const storage = memoryStorage();
		const cachedProofs = [acceptedProof(10), acceptedProof(11)];
		const cachedTracker = {
			lastAt: 4_000,
			candidateRate: 10,
			diskReadRate: 100,
			weightedCandidateTotal: 30,
			weightedDiskTotal: 300,
			duration: 3,
			candidatesSinceStart: 30,
			bytesReadSinceStart: 300,
		};
		const cachedTelemetry = {
			available: true,
			checked: true,
			candidatesSinceStart: 30,
			bytesReadSinceStart: 300,
			sourceLabel: 'arweave.example',
			acceptedProofs: cachedProofs,
		};
		const write = (acceptedProofs: ArweaveAcceptedProof[]) =>
			storage.setItem(
				'bazar-transaction-sync-mining:v1:session',
				JSON.stringify({
					version: 1,
					blockOrigin: 'https://arweave.example',
					sessionKey: 'session',
					sessionStartedAt: 1_000,
					telemetry: { ...cachedTelemetry, acceptedProofs },
					tracker: cachedTracker,
				})
			);

		write([]);
		const empty = miningTelemetrySession(storage, 'https://arweave.example', 'session', 1_000);
		expect(empty.tracker).toEqual({ ...cachedTracker, acceptedBlocksSinceStart: 0 });
		expect(empty.telemetry.acceptedBlocksSinceStart).toBe(0);

		write(cachedProofs);
		const restored = miningTelemetrySession(storage, 'https://arweave.example', 'session', 1_000);
		expect(restored.tracker).toEqual({ ...cachedTracker, acceptedBlocksSinceStart: 2, lastCountedHeight: 11 });
		const { available: _available, checked: _checked, ...cachedFigures } = cachedTelemetry;
		expect(restored.telemetry).toEqual({ ...cachedFigures, status: 'live', acceptedBlocksSinceStart: 2 });

		// The tip that was already in the cached list is not counted again on the next poll.
		recordAcceptedBlock(restored.tracker, 11);
		expect(restored.tracker.acceptedBlocksSinceStart).toBe(2);
		recordAcceptedBlock(restored.tracker, 12);
		expect(restored.tracker.acceptedBlocksSinceStart).toBe(3);
	});

	it('restores the older checked/available pair as an explicit status', () => {
		const storage = memoryStorage();
		const write = (checked: boolean, available: boolean) =>
			storage.setItem(
				'bazar-transaction-sync-mining:v1:session',
				JSON.stringify({
					version: 1,
					blockOrigin: 'https://arweave.example',
					sessionKey: 'session',
					sessionStartedAt: 1_000,
					telemetry: {
						available,
						checked,
						candidatesSinceStart: 0,
						bytesReadSinceStart: 0,
						acceptedBlocksSinceStart: 0,
						sourceLabel: 'arweave.example',
						acceptedProofs: [],
					},
					tracker: createMiningNetworkTracker(1_000),
				})
			);
		const restoredStatus = () =>
			miningTelemetrySession(storage, 'https://arweave.example', 'session', 1_000).telemetry.status;

		write(false, false);
		expect(restoredStatus()).toBe('checking');
		write(true, false);
		expect(restoredStatus()).toBe('unavailable');
		write(true, true);
		expect(restoredStatus()).toBe('live');
	});

	it('moves mining telemetry through checking, live, stale and back to live with frozen stale totals', () => {
		const tracker = createMiningNetworkTracker(1_000);
		const checking = miningTelemetrySession(undefined, 'https://arweave.example', 'session', 1_000).telemetry;
		expect(checking.status).toBe('checking');

		expect(nextMiningTelemetry(checking, tracker, { ok: false }).status).toBe('unavailable');

		recordMiningSample(tracker, 4_000, 10, 100);
		recordAcceptedBlock(tracker, 10);
		const live = nextMiningTelemetry(checking, tracker, { ok: true, proof: acceptedProof(10) });
		expect(live).toMatchObject({ status: 'live', candidatesSinceStart: 30, acceptedBlocksSinceStart: 1 });

		const trackerBeforeFailure = { ...tracker };
		const stale = nextMiningTelemetry(live, tracker, { ok: false });
		expect(stale).toEqual({ ...live, status: 'stale' });
		// A failed poll leaves the tracker alone, so old rates are not extrapolated into the totals.
		expect(tracker).toEqual(trackerBeforeFailure);
		expect(nextMiningTelemetry(stale, tracker, { ok: false })).toEqual(stale);

		recordMiningSample(tracker, 9_000, 10, 100);
		recordAcceptedBlock(tracker, 11);
		const recovered = nextMiningTelemetry(stale, tracker, { ok: true, proof: acceptedProof(11) });
		expect(recovered).toMatchObject({ status: 'live', candidatesSinceStart: 80, acceptedBlocksSinceStart: 2 });
		expect(recovered.acceptedProofs.map((proof) => proof.height)).toEqual([10, 11]);
	});

	it('states the mining source status in words for every state', () => {
		const strings = {
			transactionSyncMiningChecking: 'Sampling live mining activity',
			transactionSyncMiningSource: 'Live from {source}',
			transactionSyncMiningStale: 'Source unreachable · last block {seconds}s ago',
			transactionSyncMiningUnavailable: 'Mining activity unavailable',
		};
		const base = { sourceLabel: 'arweave.example', acceptedProofs: [acceptedProof(10), acceptedProof(12)] };

		expect(miningStatus({ ...base, status: 'checking', acceptedProofs: [] }, strings)).toBe(
			'Sampling live mining activity'
		);
		expect(miningStatus({ ...base, status: 'live' }, strings)).toBe('Live from arweave.example');
		expect(miningStatus({ ...base, status: 'stale' }, strings, 54_400)).toBe(
			'Source unreachable · last block 42s ago'
		);
		expect(miningStatus({ ...base, status: 'unavailable', acceptedProofs: [] }, strings)).toBe(
			'Mining activity unavailable'
		);
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
