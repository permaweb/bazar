import type { SwapOrder } from 'api/marketplace';
import {
	hasRecoverablePurchase,
	type Operation,
	operationLabel,
	purchaseRecoveryApprovalCopy,
	purchaseRecoveryApprovalCount,
} from 'api/operations';
import {
	PURCHASE_PAYMENT_TARGET,
	PURCHASE_REGISTRATION_TARGET,
	type PurchaseCostEstimate,
	purchaseSkipKind,
	type PurchaseState,
	purchaseStateFailure,
} from 'api/transactions';

import { type ArweaveSyncStep, postConfirmationPendingLabel, quorumConfirmationDepth } from 'features/TransactionSync';
import { type AppError, appErrorMessage, type AppErrorReason } from 'helpers/app-error';
import { winstonToAr } from 'helpers/ar-units';
import type { AsyncState } from 'helpers/async-state';

import {
	atomicOperationActionLabel,
	atomicOperationFormError,
	atomicOperationResult,
	atomicOperationValue,
	atomicPurchaseFailureStage,
	atomicPurchaseHasTerminalReservationFailure,
	purchaseOrderOf,
	purchaseStatusMessage,
} from './atomic-operation';
import { ATOMIC_ACTION_CONFIRMATION_TARGET, type OperationFlowPhase, type OperationFlowState } from './operation-flow';

/** The exact purchase cost and the buyer's balance, checked together before the purchase can be signed. */
export type PurchaseQuote = { estimate: PurchaseCostEstimate; balance: bigint };

export type PurchaseQuoteView =
	| { status: 'checking'; affordable: null }
	| { status: 'unavailable'; affordable: null }
	| {
			status: 'ready';
			affordable: boolean;
			networkFees: string;
			maximumTotal: string;
			/** The balance left after the maximum total, or `null` when the wallet cannot afford it. */
			walletAfterPurchase: string | null;
	  };

/** Everything the operation dialog renders for its current stage, derived from the operation and flow state. */
export type AtomicOperationView = {
	/** The stage to show: a finished buy whose purchase did not complete is presented as a failure. */
	phase: OperationFlowPhase;
	label: string;
	/** The order a buy or cancellation acts on. */
	order: SwapOrder | null;
	/** Whether the dialog opened to resume saved signed work. */
	recovering: boolean;
	/** The value the operation acts on: the listing price, or the trimmed transfer recipient. */
	value: string;
	formError: AppErrorReason | null;
	actionLabel: string;
	result: { title: string; detail: string };
	sellerPrice: string;
	recoveryApprovalCount: number;
	recoveryApprovalCopy: { title: string; detail: string; action: string } | null;
	steps: ArweaveSyncStep[];
	purchaseSteps: ArweaveSyncStep[];
	activeStep: string;
	confirmationTarget: number;
	activityConfirmations: number;
	paymentConfirmations: number;
	message: string;
	workingStatus: string;
	pendingAfterConfirmation: string | undefined;
	reportedStatus: string;
	purchaseFailure: AppError | null;
	failureStage: string;
	recoverable: boolean;
	terminalReservationFailure: boolean;
	/** Whether dismissing the dialog keeps the saved signed work for later. */
	resumable: boolean;
	canSkip: boolean;
	skipKind: ReturnType<typeof purchaseSkipKind>;
};

/** The listing price or transfer recipient a dialog opens with, restored from a saved operation. */
export function initialOperationValue(operation: Operation) {
	return operation.kind === 'sell' || operation.kind === 'transfer' ? operation.value ?? '' : '';
}

/** The reservation and seller payment lanes of a purchase whose signed work can be observed. */
export function atomicPurchaseSyncSteps(purchaseState: PurchaseState | null): ArweaveSyncStep[] {
	return purchaseState && hasRecoverablePurchase(purchaseState)
		? [
				{
					key: 'register',
					label: 'Reserve asset',
					target: PURCHASE_REGISTRATION_TARGET,
					transaction: purchaseState.registration,
				},
				{
					key: 'pay',
					label: 'Pay seller',
					target: PURCHASE_PAYMENT_TARGET,
					terminal: true,
					transaction: purchaseState.payment,
				},
		  ]
		: [];
}

function reportedOperationStatus(
	phase: OperationFlowPhase,
	workingStatus: string,
	resultTitle: string,
	message: string
) {
	if (phase === 'form') return 'Waiting for details';
	if (phase === 'approval') return 'Waiting for wallet approval';
	if (phase === 'working') return workingStatus || 'Watching Arweave confirmations…';
	if (phase === 'done') return resultTitle;
	return message || 'This transaction needs attention';
}

export function atomicOperationView(input: {
	operation: Operation;
	flow: OperationFlowState;
	assetName: string;
	owner: string;
	value: string;
}): AtomicOperationView {
	const operation = input.operation;
	const flow = input.flow;
	const purchaseState = flow.purchaseState;
	const value = atomicOperationValue(operation.kind, input.value);
	const purchaseSteps = atomicPurchaseSyncSteps(purchaseState);
	const steps: ArweaveSyncStep[] = flow.transaction
		? [
				{
					key: operation.kind,
					label: operationLabel(operation.kind),
					target: ATOMIC_ACTION_CONFIRMATION_TARGET,
					terminal: true,
					confirmations: flow.confirmations,
					transaction: {
						id: flow.transaction.id,
						views: flow.views,
						...(flow.consensus ? { consensus: flow.consensus } : {}),
					},
				},
		  ]
		: purchaseSteps;
	const activeStep =
		purchaseState?.stage.includes('payment') || purchaseState?.stage === 'ownership-verifying'
			? 'pay'
			: operation.kind === 'buy'
			? 'register'
			: operation.kind;
	const activeSyncStep = steps.find((step) => step.key === activeStep) ?? steps[0];
	const confirmationTarget = activeSyncStep?.target ?? ATOMIC_ACTION_CONFIRMATION_TARGET;
	const activityConfirmations = Math.min(confirmationTarget, quorumConfirmationDepth(activeSyncStep));
	const phase =
		operation.kind === 'buy' && flow.phase === 'done' && purchaseState?.stage !== 'complete' ? 'error' : flow.phase;
	const purchaseFailure = purchaseStateFailure(purchaseState);
	const message = flow.message || (purchaseFailure ? appErrorMessage(purchaseFailure) : '');
	const workingStatus = flow.message || purchaseStatusMessage(purchaseState);
	const pendingAfterConfirmation =
		purchaseState?.stage === 'registration-accepting'
			? 'Checking live reservation'
			: purchaseState?.stage === 'ownership-verifying'
			? 'Checking ownership'
			: postConfirmationPendingLabel(activityConfirmations, confirmationTarget, workingStatus);
	const recoverable = Boolean(
		flow.transaction ||
			hasRecoverablePurchase(purchaseState) ||
			(operation.kind === 'buy' && hasRecoverablePurchase(operation.resume))
	);
	const terminalReservationFailure = atomicPurchaseHasTerminalReservationFailure(purchaseState);
	const result = atomicOperationResult(operation.kind, input.assetName, value, input.owner);
	const resumingPurchase = operation.kind === 'buy' && operation.resume ? operation.resume : null;
	return {
		phase,
		label: operationLabel(operation.kind),
		order: operation.kind === 'buy' || operation.kind === 'cancel' ? operation.order : null,
		recovering: Boolean(operation.kind === 'buy' ? operation.resume : operation.resumeId),
		value,
		formError: atomicOperationFormError(operation.kind, value, input.owner),
		actionLabel: atomicOperationActionLabel(operation, value),
		result,
		sellerPrice:
			operation.kind === 'buy' || operation.kind === 'cancel'
				? `${winstonToAr(purchaseOrderOf(operation).asking)} AR`
				: '',
		recoveryApprovalCount: resumingPurchase ? purchaseRecoveryApprovalCount(resumingPurchase) : 0,
		recoveryApprovalCopy:
			resumingPurchase && operation.kind === 'buy'
				? purchaseRecoveryApprovalCopy(resumingPurchase, { externalOrigin: operation.externalOrigin })
				: null,
		steps,
		purchaseSteps,
		activeStep,
		confirmationTarget,
		activityConfirmations,
		paymentConfirmations: quorumConfirmationDepth(purchaseSteps.find((step) => step.key === 'pay')),
		message,
		workingStatus,
		pendingAfterConfirmation,
		reportedStatus: reportedOperationStatus(phase, workingStatus, result.title, message),
		purchaseFailure,
		failureStage: atomicPurchaseFailureStage(purchaseState),
		recoverable,
		terminalReservationFailure,
		resumable: recoverable && !terminalReservationFailure,
		canSkip: Boolean(purchaseState?.canSkip),
		skipKind: purchaseSkipKind(purchaseState),
	};
}

/** What the purchase form shows while the exact cost and wallet balance are checked. */
export function purchaseQuoteView(state: AsyncState<PurchaseQuote>): PurchaseQuoteView {
	if (state.status === 'error' || state.status === 'stale') return { status: 'unavailable', affordable: null };
	if (state.status === 'idle' || state.status === 'loading') return { status: 'checking', affordable: null };
	const total = BigInt(state.data.estimate.total);
	const affordable = state.data.balance >= total;
	return {
		status: 'ready',
		affordable,
		networkFees: `${winstonToAr((total - BigInt(state.data.estimate.asking)).toString())} AR`,
		maximumTotal: `${winstonToAr(state.data.estimate.total)} AR`,
		walletAfterPurchase: affordable ? `${winstonToAr((state.data.balance - total).toString())} AR` : null,
	};
}
