import type { ObserverView } from 'api/transactions';

import type { ArweaveSyncStep, ArweaveSyncTransaction } from '../types';

import { observerVerificationDelayed, quorumConfirmationDepth } from './confirmationDepth';
import { latestObserverState } from './observerViews';
import { confirmationLifecycleState } from './sequence';

export type TransactionSyncHeader = {
	active: ArweaveSyncStep | undefined;
	transaction: ArweaveSyncTransaction | undefined;
	confirmationDepth: number;
	verificationDelayed: boolean;
	target: number;
	lifecycle: ReturnType<typeof confirmationLifecycleState>;
	displayedConfirmationDepth: number;
	terminalDepthBeyondTarget: boolean;
	transactionState: ObserverView['state'];
	/** Identifies the displayed transaction and step; estimated progress resets when it changes. */
	progressKey: string;
	/** Quorum confirmations as a percentage of the step's target. */
	confirmedProgress: number;
	progressActive: boolean;
};

export type EstimatedProgress = { key: string; value: number };

/** The active step's confirmation depth, lifecycle, and progress figures shown above the network view. */
export function transactionSyncHeader(
	steps: ArweaveSyncStep[],
	activeStep: string | undefined,
	pendingAfterConfirmation: string | undefined
): TransactionSyncHeader {
	const active = steps.find((step) => step.key === activeStep) ?? steps[0];
	const transaction = active?.transaction;
	const confirmationDepth = quorumConfirmationDepth(active);
	const target = active?.target ?? 0;
	const lifecycle = confirmationLifecycleState(
		confirmationDepth,
		target,
		pendingAfterConfirmation,
		Boolean(active?.hasError)
	);
	return {
		active,
		transaction,
		confirmationDepth,
		verificationDelayed: observerVerificationDelayed(active),
		target,
		lifecycle,
		displayedConfirmationDepth: active?.terminal ? confirmationDepth : lifecycle.depth,
		terminalDepthBeyondTarget: Boolean(active?.terminal && target > 0 && confirmationDepth > target),
		transactionState: transaction?.consensus?.state ?? latestObserverState(transaction?.views ?? []),
		progressKey: `${transaction?.id ?? 'none'}:${active?.key ?? 'none'}`,
		confirmedProgress: target > 0 ? (confirmationDepth / target) * 100 : 0,
		progressActive: Boolean(transaction) && lifecycle.active,
	};
}

/**
 * Keeps the larger of confirmed and estimated progress for the current key. Returns `current` when the change is
 * imperceptible so the state update can be skipped.
 */
export function nextEstimatedProgress(
	current: EstimatedProgress,
	progressKey: string,
	confirmedProgress: number,
	phaseProgress: number
): EstimatedProgress {
	const next = Math.max(confirmedProgress, phaseProgress);
	if (current.key === progressKey && Math.abs(current.value - next) < 0.02) return current;
	return { key: progressKey, value: next };
}

/** Continuous progress for the bar, clamped to leave visible headroom while the step is still active. */
export function displayedSyncProgress(
	header: Pick<TransactionSyncHeader, 'progressKey' | 'confirmedProgress' | 'progressActive'>,
	estimated: EstimatedProgress
): number {
	const continuousProgress =
		estimated.key === header.progressKey
			? Math.max(header.confirmedProgress, estimated.value)
			: header.confirmedProgress;
	return Math.min(header.progressActive ? 99 : 100, Math.max(header.progressActive ? 2 : 0, continuousProgress));
}
