import { formatMessage } from 'helpers/i18n';

import { TRANSACTION_SYNC_MESSAGES, type TransactionSyncMessages } from '../messages';

export type SequencePhaseBounds = {
	start: number;
	end: number;
};

export function sequencePhaseBounds(index: number, count: number): SequencePhaseBounds {
	if (!Number.isSafeInteger(count) || count < 1) throw new TypeError('invalid-sequence-phase-count');
	if (!Number.isSafeInteger(index) || index < 0 || index >= count) {
		throw new TypeError('invalid-sequence-phase-index');
	}
	return {
		start: (index / count) * 100,
		end: ((index + 1) / count) * 100,
	};
}

export function confirmationProgressText(
	label: string,
	confirmations: number,
	target: number,
	language: TransactionSyncMessages
): string {
	const depth = Math.min(Math.max(0, confirmations), Math.max(0, target));
	return formatMessage(
		depth >= target
			? language.transactionSyncConfirmationProgressComplete
			: language.transactionSyncConfirmationProgress,
		{ label, depth, target }
	);
}

export function confirmationProgressWidth(confirmed: number, active: boolean, hasError: boolean): number {
	return Math.min(active ? 99 : 100, Math.max(active && !hasError ? 2 : 0, confirmed));
}

/**
 * `label` is the resolved copy shown once confirmation completes. Callers outside this feature have not adopted the
 * translation layer yet, so it defaults to the source catalog rather than a literal written here.
 */
export function postConfirmationPendingLabel(
	confirmations: number,
	target: number,
	status: string | undefined,
	label: string = TRANSACTION_SYNC_MESSAGES.en.transactionSyncSettlingLiveState
): string | undefined {
	const depth = Math.min(Math.max(0, confirmations), Math.max(0, target));
	return status && target > 0 && depth >= target ? label : undefined;
}

export function confirmationLifecycleState(
	confirmations: number,
	target: number,
	pendingAfterConfirmation: string | undefined,
	hasError: boolean
) {
	const depth = Math.min(Math.max(0, confirmations), Math.max(0, target));
	const pending = Boolean(pendingAfterConfirmation && depth >= target && !hasError);
	return {
		depth,
		pending,
		active: !hasError && (depth < target || pending),
		complete: !hasError && depth >= target && !pending,
	};
}
