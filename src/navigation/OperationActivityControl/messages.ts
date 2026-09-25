import { defineMessages } from 'helpers/i18n';

export const OPERATION_ACTIVITY_CONTROL_MESSAGES = defineMessages({
	en: {
		operationActivityTitle: 'Transaction activity',
		operationActivityTrigger: {
			one: 'Transaction activity, {count} item',
			other: 'Transaction activity, {count} items',
		},
		operationActivityClearConfirm: {
			one: 'Clear {count} upload item that need attention?\n\nThis removes local Activity tracking only. It does not delete anything from Arweave.',
			other: 'Clear {count} upload items that need attention?\n\nThis removes local Activity tracking only. It does not delete anything from Arweave.',
		},
		operationActivityAttention: {
			one: '{count} upload needs attention',
			other: '{count} uploads need attention',
		},
		operationActivityWorking: '{count} running in the background',
		operationActivityIdle: 'No transactions running',
		operationActivityClearIssues: 'Clear upload issues',
		operationActivityItemMeta: '{kind} · {phase}',
		operationKindSell: 'List for sale',
		operationKindBuy: 'Buy asset',
		operationKindCancel: 'Cancel listing',
		operationKindTransfer: 'Transfer asset',
		operationActivityCollectionUpload: 'Collection upload',
		operationActivityUpload: 'Upload',
		operationActivityUploadComplete: 'Complete',
		operationActivityUploadAttention: 'Needs attention',
		operationActivityUploadWorking: 'In progress',
		operationActivityConfirmations: '{confirmations} of {target} confirmations',
		operationActivityMintUnsettled: 'This upload has not reached live process state.',
		operationActivityMintPinnedGateway: '{status} Tracking is pinned to the original gateways.',
		operationPhaseForm: 'Awaiting signature',
		operationPhaseApproval: 'Awaiting approval',
		operationPhaseWorking: 'In progress',
		operationPhaseDone: 'Complete',
		operationPhaseError: 'Needs attention',
		mintPhaseAccepted: 'Accepted',
		mintPhaseMined: 'Mined',
		mintPhaseApplied: 'Applied',
		mintPhaseComplete: 'Complete',

		// The status line of a mint the browser is still tracking, by `MintActivityPhase`.
		mintStatusAccepted: 'Submitted; accepted by Arweave. Safe to leave this page.',
		mintStatusMined: 'Mined on Arweave. Waiting for live process state.',
		mintStatusApplied: 'Applied to live process state. Finishing Bazar indexing.',
		mintStatusComplete: 'Live on Bazar.',

		// The status line of an operation restored from a saved wallet record, by `OperationRecoveryStatus`.
		recoveryStatusResumeSavedPurchase: 'Resume saved purchase',
		recoveryStatusResumeSignedTransaction: 'Resume signed transaction',
		recoveryStatusResumingPurchase: 'Resuming purchase…',
		recoveryStatusResumingSignedTransaction: 'Resuming signed transaction…',
		operationActivityArtworkUnavailable: 'Artwork unavailable',
	},
});

export type OperationActivityControlMessages = (typeof OPERATION_ACTIVITY_CONTROL_MESSAGES)['en'];
