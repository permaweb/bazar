import { describe, expect, it } from 'vitest';

import { accumulateMiningEstimate, createMiningNetworkTracker, recordMiningSample } from './useArweaveMiningTelemetry';
import { type ArweaveSyncStep, protocolActivityDetail, transactionSyncSessionKey } from '.';

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
