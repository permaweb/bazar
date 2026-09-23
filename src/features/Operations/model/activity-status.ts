import type { MintActivityPhase } from 'api/mint';
import type { OperationActivityStatus, OperationRecoveryStatus } from 'api/operations';

import type { OperationsMessages } from '../messages';

const RECOVERY_STATUS_KEYS: Record<OperationRecoveryStatus, keyof OperationsMessages> = {
	'resume-saved-purchase': 'recoveryStatusResumeSavedPurchase',
	'resume-signed-transaction': 'recoveryStatusResumeSignedTransaction',
	'resuming-purchase': 'recoveryStatusResumingPurchase',
	'resuming-signed-transaction': 'recoveryStatusResumingSignedTransaction',
};

const MINT_STATUS_KEYS: Record<MintActivityPhase, keyof OperationsMessages> = {
	accepted: 'mintStatusAccepted',
	mined: 'mintStatusMined',
	applied: 'mintStatusApplied',
	complete: 'mintStatusComplete',
};

/** The status line of an operation activity: the adapter's recovery code as copy, or text the UI already resolved. */
export function operationActivityStatusText(status: OperationActivityStatus, messages: OperationsMessages): string {
	return 'code' in status ? (messages[RECOVERY_STATUS_KEYS[status.code]] as string) : status.text;
}

/** The status line of a mint the browser is still tracking, from its stable phase. */
export function mintActivityStatusText(phase: MintActivityPhase, messages: OperationsMessages): string {
	return messages[MINT_STATUS_KEYS[phase]] as string;
}
