import type { ArweaveAcceptedProof } from 'api/mining-telemetry';
import type { ObserverView } from 'api/transactions';

import type { TransactionSyncMessages } from '../messages';
import type { CableMiningActivity, CableTelemetry } from '../types';

import type { ArweaveMiningTelemetry } from './miningTelemetry';
import type { ProtocolActivity, ProtocolTelemetry } from './protocolTelemetry';

/** The telemetry panel's protocol and mining figures, formatted for display. */
export function cableTelemetry(
	protocol: ProtocolTelemetry,
	mining: ArweaveMiningTelemetry,
	language: TransactionSyncMessages
): CableTelemetry {
	const acceptedProofs = mining.acceptedProofs;
	return {
		heading: language.transactionSyncProtocolTelemetry,
		liveLabel: language.transactionSyncProtocolLive,
		metrics: protocolMetrics(protocol, language),
		activityLabel: language.transactionSyncProtocolRecent,
		activity: [
			...acceptedProofs.map((proof) => ({
				key: proof.key,
				label: language.transactionSyncMiningBlockLabel.replace('{height}', proof.height.toLocaleString()),
				detail: miningProofDetail(proof, language),
				kind: 'proof' as const,
				typeLabel: language.transactionSyncActivityProof,
				observedAt: proof.observedAt,
			})),
			...protocol.recent.map((event) => ({
				key: event.key,
				label: event.observer,
				detail: protocolActivityDetail(event, language),
				kind: event.kind,
				typeLabel:
					event.kind === 'confirmation'
						? language.transactionSyncActivityConfirmation
						: event.kind === 'error'
						? language.transactionSyncActivityError
						: language.transactionSyncActivityStatus,
				observedAt: event.observedAt,
			})),
		]
			.sort((left, right) => right.observedAt - left.observedAt)
			.map(({ observedAt: _observedAt, ...event }) => event),
		mining: {
			heading: language.transactionSyncMiningTelemetry,
			status: miningStatus(mining, language),
			metrics: [
				{
					label: language.transactionSyncMiningAverage,
					value: formatCandidateRate(mining.averageCandidateRate, language),
				},
				{
					label: language.transactionSyncMiningDiskRate,
					value: formatBytes(mining.averageDiskReadRate, language, true),
				},
				{
					label: language.transactionSyncMiningCandidateTotal,
					value: formatCandidateRate(mining.candidatesSinceStart, language),
				},
				{
					label: language.transactionSyncMiningDiskTotal,
					value: formatBytes(mining.bytesReadSinceStart, language),
				},
				{ label: language.transactionSyncMiningAccepted, value: String(acceptedProofs.length) },
			],
		},
	};
}

/** Accepted block proofs and their recall samples, labelled for the 3D renderer's proof pins. */
export function cableMiningActivity(
	mining: ArweaveMiningTelemetry,
	language: TransactionSyncMessages
): CableMiningActivity {
	return {
		candidateRate: mining.candidateRate,
		acceptedProofs: mining.acceptedProofs.map((proof) => ({
			key: proof.key,
			height: proof.height,
			observedAt: proof.observedAt,
			label: language.transactionSyncMiningBlockLabel.replace('{height}', proof.height.toLocaleString()),
			meta: miningProofPinMeta(proof, language),
			recalls: proof.recallSamples.map((sample) => ({
				key: `${proof.key}:${sample.index}`,
				content: sample.content,
				fallback: language.transactionSyncMiningPinOffset.replace('{offset}', sample.offset.toLocaleString()),
				contentLabel: recallContentLabel(sample.content, language),
				meta: miningRecallPinMeta(proof, sample, language),
			})),
		})),
	};
}

export function localizedRisk(depth: number, language: TransactionSyncMessages): string {
	if (depth === 2) return language.transactionSyncForkDaily;
	if (depth === 3) return language.transactionSyncForkMonthly;
	return language.transactionSyncForkTwoYears;
}

function protocolMetrics(
	telemetry: ProtocolTelemetry,
	language: TransactionSyncMessages
): Array<{ label: string; value: string }> {
	return [
		{ label: language.transactionSyncProtocolResponseRate, value: telemetry.responsesPerSecond.toFixed(2) },
		{ label: language.transactionSyncProtocolResponses, value: telemetry.responses.toLocaleString() },
		{ label: language.transactionSyncProtocolObservers, value: `${telemetry.answering}/${telemetry.observers}` },
		{
			label: language.transactionSyncProtocolAgreement,
			value: telemetry.eligible
				? `${telemetry.agreeing}/${telemetry.eligible}`
				: language.transactionSyncProtocolUnknown,
		},
		{ label: language.transactionSyncProtocolStateChanges, value: telemetry.stateChanges.toLocaleString() },
		{
			label: language.transactionSyncProtocolConfirmationEvents,
			value: telemetry.confirmationEvents.toLocaleString(),
		},
		{
			label: language.transactionSyncProtocolPhase,
			value: telemetry.phaseLabel,
		},
		{
			label: language.transactionSyncProtocolLatestResponse,
			value: language.transactionSyncProtocolSecondsAgo.replace(
				'{seconds}',
				telemetry.latestResponseAge.toFixed(1)
			),
		},
	];
}

function formatCandidateRate(value: number | undefined, language: TransactionSyncMessages): string {
	if (value === undefined) return language.transactionSyncProtocolUnknown;
	return value.toLocaleString(undefined, {
		notation: value >= 1_000_000 ? 'compact' : 'standard',
		maximumFractionDigits: value >= 1_000_000 ? 2 : value >= 100 ? 0 : 1,
	});
}

function formatBytes(value: number | undefined, language: TransactionSyncMessages, perSecond = false): string {
	if (value === undefined) return language.transactionSyncProtocolUnknown;
	const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
	let formatted = Math.max(0, value);
	let unit = 0;
	while (formatted >= 1024 && unit < units.length - 1) {
		formatted /= 1024;
		unit += 1;
	}
	return `${formatted.toLocaleString(undefined, {
		maximumFractionDigits: formatted >= 100 ? 0 : formatted >= 10 ? 1 : 2,
	})} ${units[unit]}${perSecond ? '/s' : ''}`;
}

function recallContentLabel(
	content: ArweaveAcceptedProof['recallSamples'][number]['content'],
	language: TransactionSyncMessages
): string {
	const type = content?.contentType?.split(';', 1)[0] ?? language.transactionSyncMiningContentData;
	return content?.contentLength === undefined ? type : `${type} · ${formatBytes(content.contentLength, language)}`;
}

function miningStatus(telemetry: ArweaveMiningTelemetry, language: TransactionSyncMessages): string {
	if (!telemetry.checked) return language.transactionSyncMiningChecking;
	if (!telemetry.available) return language.transactionSyncMiningUnavailable;
	return language.transactionSyncMiningSource.replace('{source}', telemetry.sourceLabel);
}

function miningProofDetail(proof: ArweaveAcceptedProof, language: TransactionSyncMessages): string {
	const acceptedProofBytes = proof.recallSamples.reduce((total, sample) => total + (sample.packedBytes ?? 0), 0);
	const summary = language.transactionSyncMiningProofDetail
		.replace('{height}', proof.height.toLocaleString())
		.replace('{proofs}', String(proof.proofCount))
		.replace(
			'{proofBytes}',
			acceptedProofBytes ? formatBytes(acceptedProofBytes, language) : language.transactionSyncProtocolUnknown
		)
		.replace(
			'{step}',
			proof.vdfStep === undefined ? language.transactionSyncProtocolUnknown : proof.vdfStep.toLocaleString()
		)
		.replace('{transactions}', proof.transactionCount.toLocaleString());
	const recalls = proof.recallSamples.flatMap((sample) => {
		const age =
			proof.timestamp === undefined || sample.sourceTimestamp === undefined
				? language.transactionSyncMiningDataUnknown
				: durationLabel(Math.max(0, proof.timestamp - sample.sourceTimestamp), language);
		const detail = language.transactionSyncMiningRecallDetail
			.replace('{index}', String(sample.index))
			.replace('{offset}', sample.offset.toLocaleString())
			.replace('{age}', age)
			.replace(
				'{sourceHeight}',
				sample.sourceHeight === undefined
					? language.transactionSyncProtocolUnknown
					: sample.sourceHeight.toLocaleString()
			)
			.replace(
				'{dataBytes}',
				sample.unpackedBytes === undefined
					? language.transactionSyncProtocolUnknown
					: formatBytes(sample.unpackedBytes, language)
			);
		return [detail];
	});
	return [summary, ...recalls].join('\n');
}

function miningProofPinMeta(proof: ArweaveAcceptedProof, language: TransactionSyncMessages): string {
	const acceptedProofBytes = proof.recallSamples.reduce((total, sample) => total + (sample.packedBytes ?? 0), 0);
	return language.transactionSyncMiningPinProofMeta
		.replace('{proofs}', String(proof.proofCount))
		.replace(
			'{proofBytes}',
			acceptedProofBytes ? formatBytes(acceptedProofBytes, language) : language.transactionSyncProtocolUnknown
		)
		.replace(
			'{step}',
			proof.vdfStep === undefined ? language.transactionSyncProtocolUnknown : proof.vdfStep.toLocaleString()
		);
}

function miningRecallPinMeta(
	proof: ArweaveAcceptedProof,
	sample: ArweaveAcceptedProof['recallSamples'][number],
	language: TransactionSyncMessages
): string | undefined {
	if (sample.sourceHeight === undefined) return undefined;
	const age =
		proof.timestamp === undefined || sample.sourceTimestamp === undefined
			? language.transactionSyncMiningDataUnknown
			: durationLabel(Math.max(0, proof.timestamp - sample.sourceTimestamp), language);
	return language.transactionSyncMiningPinRecallMeta
		.replace('{age}', age)
		.replace('{height}', sample.sourceHeight.toLocaleString());
}

function durationLabel(seconds: number, language: TransactionSyncMessages): string {
	const day = 24 * 60 * 60;
	const year = 365.25 * day;
	if (seconds >= year) {
		return language.transactionSyncMiningAgeYears.replace('{value}', (seconds / year).toFixed(1));
	}
	if (seconds >= day) {
		return language.transactionSyncMiningAgeDays.replace('{value}', Math.round(seconds / day).toLocaleString());
	}
	return language.transactionSyncMiningAgeHours.replace(
		'{value}',
		Math.max(1, Math.round(seconds / 3600)).toLocaleString()
	);
}

export function protocolActivityDetail(event: ProtocolActivity, language: TransactionSyncMessages): string {
	const unknown = language.transactionSyncProtocolUnknown;
	const status = event.httpStatus ?? protocolStatusForState(event.state) ?? unknown;
	const latency = event.latency === undefined ? unknown : String(Math.max(0, Math.round(event.latency)));
	const height = event.nodeHeight ?? event.blockHeight;
	return language.transactionSyncProtocolActivity
		.replace('{phase}', event.phaseLabel)
		.replace('{state}', protocolActivityState(event, language))
		.replace('{status}', String(status))
		.replace('{latency}', latency)
		.replace('{height}', height === undefined ? unknown : height.toLocaleString())
		.replace('{depth}', String(event.confirmations));
}

function protocolActivityState(event: ProtocolActivity, language: TransactionSyncMessages): string {
	if (event.kind === 'error') return language.transactionSyncProtocolStateError;
	if (event.state === 'not-found') return language.transactionSyncProtocolStateNotFound;
	if (event.state === 'pending') return language.transactionSyncProtocolStatePending;
	if (event.state === 'confirmed') return language.transactionSyncProtocolStateConfirmed;
	if (event.state === 'gone') return language.transactionSyncProtocolStateGone;
	return language.transactionSyncProtocolUnknown;
}

function protocolStatusForState(state: ObserverView['state']): number | undefined {
	if (state === 'not-found' || state === 'gone') return 404;
	if (state === 'pending') return 202;
	if (state === 'confirmed') return 200;
	return undefined;
}
