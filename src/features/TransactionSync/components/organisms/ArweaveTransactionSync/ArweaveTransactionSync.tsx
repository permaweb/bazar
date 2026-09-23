import React from 'react';

import { Button } from 'components/atoms/Button';
import { Tooltip } from 'components/atoms/Tooltip';
import { TxAddress } from 'components/atoms/TxAddress';
import { formatMessage } from 'helpers/i18n';
import { useMessages, usePlural } from 'providers/LanguageProvider';

import { useEstimatedSyncProgress } from '../../../hooks/useEstimatedSyncProgress';
import { useTransactionSyncRace } from '../../../hooks/useTransactionSyncRace';
import { TRANSACTION_SYNC_MESSAGES } from '../../../messages';
import { displayedSyncProgress, transactionSyncHeader } from '../../../model/syncProgress';
import { cableMiningActivity, cableTelemetry, localizedRisk } from '../../../model/telemetryView';
import type { ArweaveSyncStep } from '../../../types';

import * as S from './styles';
import { TransactionRendererFallback, TransactionVisualizerBoundary } from './TransactionVisualizerFallback';

const TransactionSequenceCable3D = React.lazy(async () => {
	const module = await import('../TransactionSequenceCable3D');
	return { default: module.TransactionSequenceCable3D };
});

const CableTelemetryPanel = React.lazy(async () => {
	const module = await import('../TransactionSequenceCable3D');
	return { default: module.CableTelemetryPanel };
});

export default function ArweaveTransactionSync(props: {
	subject: string;
	steps: ArweaveSyncStep[];
	startedAt?: number;
	skipKind?: 'yolo' | 'skip';
	onSkip?: () => void;
	activeStep?: string;
	active?: boolean;
	pendingAfterConfirmation?: string;
	onProgressChange?: (progress: number) => void;
	miningTelemetryEnabled?: boolean;
	telemetryPanelEnabled?: boolean;
}) {
	const language = useMessages(TRANSACTION_SYNC_MESSAGES);
	const plural = usePlural();
	const header = transactionSyncHeader(props.steps, props.activeStep, props.pendingAfterConfirmation);
	const race = useTransactionSyncRace({
		steps: props.steps,
		activeStep: header.active?.key,
		startedAt: props.startedAt,
		active: props.active ?? true,
		miningTelemetryEnabled: props.miningTelemetryEnabled ?? true,
		language,
	});
	const estimatedProgress = useEstimatedSyncProgress(
		header.progressKey,
		header.confirmedProgress,
		race.activePhaseProgress,
		props.onProgressChange
	);
	const displayedProgress = displayedSyncProgress(header, estimatedProgress);
	const telemetry = cableTelemetry(race.protocolTelemetry, race.miningTelemetry, language);

	return (
		<>
			{header.transaction && (
				<>
					<S.TransactionHeader>
						<div>
							<span>{language.transaction}</span>
							<TxAddress
								address={header.transaction.id}
								labels={{
									copy: language.transactionSyncCopyAddress,
									copiedTooltip: language.transactionSyncCopiedTooltip,
									copiedLabel: language.transactionSyncCopiedAddress,
									copiedAnnouncement: language.transactionSyncCopiedAddressAnnouncement,
								}}
								wrap={false}
								tooltipPosition={'right'}
							/>
						</div>
						<S.Depth
							aria-label={
								header.terminalDepthBeyondTarget
									? plural(
											language.transactionSyncConfirmationCount,
											header.displayedConfirmationDepth
									  )
									: header.lifecycle.pending && !header.active?.terminal
									? props.pendingAfterConfirmation
									: header.verificationDelayed
									? language.transactionSyncVerificationDelayed
									: formatMessage(language.transactionSyncConfirmationDepthOfTarget, {
											depth: header.displayedConfirmationDepth,
											target: header.target,
									  })
							}
							$success={header.lifecycle.complete}
						>
							{header.terminalDepthBeyondTarget ? (
								<>
									<strong>{header.displayedConfirmationDepth}</strong>
									<span> {language.transactionSyncConfirmations}</span>
								</>
							) : header.lifecycle.pending && !header.active?.terminal ? (
								<strong>{props.pendingAfterConfirmation}</strong>
							) : header.verificationDelayed ? (
								<strong>{language.transactionSyncVerificationDelayed}</strong>
							) : (
								<>
									<strong>{header.displayedConfirmationDepth}</strong>
									<span> / {header.target}</span>
								</>
							)}
						</S.Depth>
					</S.TransactionHeader>
					<S.ProgressTrack
						$active={header.progressActive}
						$state={header.transactionState}
						$confirmations={header.confirmationDepth}
						$hasError={Boolean(header.active?.hasError)}
					>
						<span
							style={{
								width: `${displayedProgress}%`,
								backgroundSize: `${10000 / Math.max(1, displayedProgress)}% 100%`,
							}}
						/>
					</S.ProgressTrack>
					{header.verificationDelayed ? (
						<S.VerificationNote role="status">
							{language.transactionSyncVerificationDelayedDetail}
						</S.VerificationNote>
					) : header.active?.terminal && header.lifecycle.pending ? (
						<S.VerificationNote role="status">{props.pendingAfterConfirmation}</S.VerificationNote>
					) : header.confirmationDepth >= 2 ? (
						<S.RiskNote>{localizedRisk(header.confirmationDepth, language)}</S.RiskNote>
					) : null}
					{props.skipKind && props.onSkip ? (
						<S.SkipAction $warning={props.skipKind === 'yolo'}>
							<span>
								<strong>
									{props.skipKind === 'yolo'
										? language.transactionSyncYoloTitle
										: formatMessage(language.transactionSyncSkipTitle, {
												depth: header.confirmationDepth,
										  })}
								</strong>
								<small>
									{props.skipKind === 'yolo'
										? language.transactionSyncYoloDetail
										: language.transactionSyncSkipDetail}
								</small>
							</span>
							<Tooltip className="transaction-skip-tooltip" content={language.transactionSyncSkipTooltip}>
								{(tooltipId) => (
									<Button aria-describedby={tooltipId} onClick={props.onSkip} size="custom">
										{props.skipKind === 'yolo'
											? language.transactionSyncYolo
											: language.transactionSyncSkip}
									</Button>
								)}
							</Tooltip>
						</S.SkipAction>
					) : null}
				</>
			)}
			{race.lanes.length > 0 && (
				<TransactionVisualizerBoundary
					fallback={
						<S.FallbackShell>
							<TransactionRendererFallback lanes={race.lanes} />
						</S.FallbackShell>
					}
					resetKey={header.transaction?.id ?? props.subject}
				>
					<>
						<S.RaceShell $height={420} $embedded={false}>
							<React.Suspense fallback={<TransactionRendererFallback lanes={race.lanes} />}>
								<TransactionSequenceCable3D
									lanes={race.lanes}
									ariaLabel={formatMessage(language.transactionSyncRacePrototypeInfinityCable, {
										subject: props.subject,
									})}
									active={props.active ?? true}
									layout={'bundle'}
									phaseLabels={race.observedSteps.map((step) => step.label)}
									miningActivity={cableMiningActivity(race.miningTelemetry, language)}
								/>
							</React.Suspense>
						</S.RaceShell>
						{props.telemetryPanelEnabled ?? true ? (
							<React.Suspense fallback={null}>
								<CableTelemetryPanel active={props.active ?? true} telemetry={telemetry} />
							</React.Suspense>
						) : null}
					</>
				</TransactionVisualizerBoundary>
			)}
		</>
	);
}
