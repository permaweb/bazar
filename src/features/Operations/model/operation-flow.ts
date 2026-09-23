import { type Operation, purchaseRecoveryApprovalCount, shouldAutomaticallyResumePurchase } from 'api/operations';
import {
	type Consensus,
	type ObserverView,
	type PreparedTransaction,
	purchaseObservationCheckingMessage,
	purchaseObservationPendingState,
	purchaseObservationRetryMessage,
	type PurchaseState,
	withContinuingPaymentObservation,
} from 'api/transactions';

import { type AppError, type AppErrorReason, appErrorReasonMessage } from 'helpers/app-error';

import { atomicOperationFailureMessage, type OperationFailureKind, operationFailureKind } from './atomic-operation';

/** Arweave confirmations a listing, cancellation, or transfer waits for before checking live asset state. */
export const ATOMIC_ACTION_CONFIRMATION_TARGET = 5;

export type OperationFlowPhase = 'form' | 'approval' | 'working' | 'done' | 'error';

/** Everything the atomic operation dialog tracks for one signing attempt and its recovery. */
export type OperationFlowState = {
	phase: OperationFlowPhase;
	/** Status or failure copy owned by the flow; empty while the purchase lifecycle speaks for itself. */
	message: string;
	failureKind: OperationFailureKind | null;
	/** The exact signed listing, cancellation, or transfer being observed. */
	transaction: PreparedTransaction | null;
	/** The weave-wrangler purchase lifecycle for a buy. */
	purchaseState: PurchaseState | null;
	views: ObserverView[];
	confirmations: number;
	consensus: Consensus | null;
};

type PurchaseObservationRetryKind = Parameters<typeof purchaseObservationCheckingMessage>[0];

export type OperationFlowEvent =
	/** The entered details cannot be submitted; nothing was signed. */
	| { type: 'validation-failed'; reason: AppErrorReason }
	/** The user (or an automatic recovery) started an attempt. */
	| { type: 'submitted' }
	| { type: 'purchase-progressed'; purchaseState: PurchaseState }
	/** The exact submitted purchase transaction was not observed yet; the flow checks it again after a delay. */
	| { type: 'purchase-observation-retry-scheduled'; purchaseState: PurchaseState; delayMs: number }
	| { type: 'purchase-observation-retry-started'; kind: PurchaseObservationRetryKind }
	/** A rejected seller payment was discarded while the dispatched reservation stays recoverable. */
	| { type: 'purchase-payment-discarded'; purchaseState: PurchaseState }
	/** Confirmations observed for the seller payment after the purchase completed. */
	| { type: 'payment-observed'; paymentId: string; observation: { consensus: Consensus; views: ObserverView[] } }
	| { type: 'transaction-prepared'; transaction: PreparedTransaction }
	/** The signed transaction could not be saved for recovery and was discarded before submission. */
	| { type: 'transaction-discarded' }
	| { type: 'confirmation-started' }
	| { type: 'views-observed'; views: ObserverView[] }
	| { type: 'consensus-observed'; consensus: Consensus }
	| { type: 'confirmations-observed'; confirmations: number }
	| { type: 'confirmation-target-reached' }
	| { type: 'completed' }
	/** The attempt failed; `discardTransaction` drops a signed action the network refused. */
	| { type: 'failed'; error: AppError; signer: string; discardTransaction: boolean }
	/** Leave a failure and edit the details again. */
	| { type: 'returned-to-form' }
	/** Forget an unrecoverable purchase so a new one can be signed. */
	| { type: 'purchase-reset' };

/** The stage the dialog opens in: saved recoveries resume or ask for their remaining approvals. */
export function initialOperationPhase(operation: Operation): OperationFlowPhase {
	if (operation.kind === 'buy') {
		if (!operation.resume) return 'form';
		return purchaseRecoveryApprovalCount(operation.resume) ? 'approval' : 'working';
	}
	return operation.resumeId ? 'working' : 'form';
}

export function initialOperationFlowState(operation: Operation): OperationFlowState {
	return {
		phase: initialOperationPhase(operation),
		message: '',
		failureKind: null,
		transaction: null,
		purchaseState: null,
		views: [],
		confirmations: 0,
		consensus: null,
	};
}

/** Whether the dialog should resume its saved signed work without asking the user first. */
export function operationResumesAutomatically(operation: Operation): boolean {
	return operation.kind === 'buy' ? shouldAutomaticallyResumePurchase(operation.resume) : Boolean(operation.resumeId);
}

/**
 * The atomic operation state machine. An attempt only completes or fails while it is working, and the dialog only
 * leaves a finished attempt for the form; progress reports from the running attempt update its observations.
 */
export function operationFlowReducer(state: OperationFlowState, event: OperationFlowEvent): OperationFlowState {
	switch (event.type) {
		case 'validation-failed':
			return { ...state, message: appErrorReasonMessage(event.reason) };
		case 'submitted':
			return { ...state, message: '', failureKind: null, phase: 'working' };
		case 'purchase-progressed':
			return { ...state, purchaseState: event.purchaseState };
		case 'purchase-observation-retry-scheduled':
			return {
				...state,
				purchaseState: purchaseObservationPendingState(event.purchaseState),
				failureKind: null,
				message: purchaseObservationRetryMessage(event.purchaseState, event.delayMs),
			};
		case 'purchase-observation-retry-started':
			return { ...state, message: purchaseObservationCheckingMessage(event.kind) };
		case 'purchase-payment-discarded':
			return { ...state, purchaseState: { ...event.purchaseState, payment: undefined } };
		case 'payment-observed': {
			const purchaseState = withContinuingPaymentObservation(
				state.purchaseState,
				event.paymentId,
				event.observation
			);
			return purchaseState === state.purchaseState ? state : { ...state, purchaseState };
		}
		case 'transaction-prepared':
			return { ...state, transaction: event.transaction };
		case 'transaction-discarded':
			return { ...state, transaction: null };
		case 'confirmation-started':
			return { ...state, views: [], confirmations: 0, consensus: null };
		case 'views-observed':
			return { ...state, views: event.views };
		case 'consensus-observed':
			return { ...state, consensus: event.consensus };
		case 'confirmations-observed':
			return { ...state, confirmations: event.confirmations };
		case 'confirmation-target-reached':
			return {
				...state,
				confirmations: ATOMIC_ACTION_CONFIRMATION_TARGET,
				message: 'Five confirmations reached. Waiting for the scheduler safety depth and live asset state…',
			};
		case 'completed':
			return state.phase === 'working' ? { ...state, phase: 'done' } : state;
		case 'failed':
			if (state.phase !== 'working') return state;
			return {
				...state,
				...(event.discardTransaction ? { transaction: null } : {}),
				failureKind: operationFailureKind(event.error),
				message: atomicOperationFailureMessage(event.error, event.signer),
				phase: 'error',
			};
		case 'returned-to-form':
			if (state.phase === 'working') return state;
			return { ...state, message: '', failureKind: null, phase: 'form' };
		case 'purchase-reset':
			if (state.phase === 'working') return state;
			return { ...state, purchaseState: null, message: '', failureKind: null, phase: 'form' };
		default:
			return state;
	}
}
