import { describe, expect, it } from 'vitest';

import type { ArweaveAcceptedProof } from 'api/mining-telemetry';

import { TRANSACTION_SYNC_MESSAGES } from 'features/TransactionSync/messages';
import type { ArweaveMiningTelemetry } from 'features/TransactionSync/model/miningTelemetry';
import type { ProtocolTelemetry } from 'features/TransactionSync/model/protocolTelemetry';
import { cableMiningActivity, cableTelemetry, localizedRisk } from 'features/TransactionSync/model/telemetryView';

const language = TRANSACTION_SYNC_MESSAGES.en;

const proof: ArweaveAcceptedProof = {
	key: '10:block',
	height: 1_000_000,
	blockId: 'block',
	proofCount: 1,
	recallBytes: [],
	recallSamples: [
		{
			index: 1,
			offset: 4_096,
			packedBytes: 2_048,
			content: {
				kind: 'image',
				contentType: 'image/png; charset=binary',
				contentLength: 1_024,
				contentUrl: 'https://x',
			},
		},
	],
	transactionCount: 3,
	observedAt: 50,
} as ArweaveAcceptedProof;

const mining: ArweaveMiningTelemetry = {
	available: true,
	checked: true,
	candidateRate: 12,
	averageCandidateRate: 1_500_000,
	averageDiskReadRate: 2_048,
	candidatesSinceStart: 12.5,
	bytesReadSinceStart: 3 * 1024 * 1024,
	sourceLabel: 'arweave.example',
	acceptedProofs: [proof],
};

const protocol: ProtocolTelemetry = {
	responses: 4,
	responsesPerSecond: 0.5,
	observers: 3,
	answering: 2,
	agreeing: 0,
	eligible: 0,
	stateChanges: 1,
	confirmationEvents: 2,
	phaseLabel: 'Pay seller',
	latestResponseAge: 1.25,
	recent: [
		{
			key: 'recent',
			observedAt: 100,
			kind: 'confirmation',
			phase: 'pay',
			phaseLabel: 'Pay seller',
			observer: 'node.example',
			state: 'confirmed',
			confirmations: 1,
		},
	],
};

describe('telemetry panel view', () => {
	it('merges proofs and protocol activity newest first without exposing timestamps', () => {
		const telemetry = cableTelemetry(protocol, mining, language);

		expect(telemetry.activity.map((entry) => entry.key)).toEqual(['recent', '10:block']);
		expect(telemetry.activity[0]).toEqual({
			key: 'recent',
			label: 'node.example',
			detail: expect.stringContaining('Pay seller'),
			kind: 'confirmation',
			typeLabel: language.transactionSyncActivityConfirmation,
		});
		expect(
			telemetry.metrics.find((metric) => metric.label === language.transactionSyncProtocolAgreement)?.value
		).toBe(language.transactionSyncProtocolUnknown);
		expect(telemetry.mining.status).toBe(
			language.transactionSyncMiningSource.replace('{source}', 'arweave.example')
		);
		expect(telemetry.mining.metrics.map((metric) => metric.value)).toEqual([
			'1.5M',
			'2 KiB/s',
			'12.5',
			'3 MiB',
			'1',
		]);
	});

	it('reports mining as checking until the first poll, then unavailable when it fails', () => {
		expect(cableTelemetry(protocol, { ...mining, checked: false }, language).mining.status).toBe(
			language.transactionSyncMiningChecking
		);
		expect(cableTelemetry(protocol, { ...mining, available: false }, language).mining.status).toBe(
			language.transactionSyncMiningUnavailable
		);
	});

	it('labels accepted proofs and their recall samples for the renderer', () => {
		const activity = cableMiningActivity(mining, language);

		expect(activity.candidateRate).toBe(12);
		expect(activity.acceptedProofs[0]).toMatchObject({
			key: '10:block',
			label: language.transactionSyncMiningBlockLabel.replace('{height}', (1_000_000).toLocaleString()),
		});
		expect(activity.acceptedProofs[0].recalls[0]).toMatchObject({
			key: '10:block:1',
			contentLabel: 'image/png · 1 KiB',
			meta: undefined,
		});
	});

	it('describes reorganization risk by confirmation depth', () => {
		expect(localizedRisk(2, language)).toBe(language.transactionSyncForkDaily);
		expect(localizedRisk(3, language)).toBe(language.transactionSyncForkMonthly);
		expect(localizedRisk(9, language)).toBe(language.transactionSyncForkTwoYears);
	});
});
