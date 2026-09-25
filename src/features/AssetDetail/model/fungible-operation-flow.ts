import {
	type Consensus,
	type ObserverView,
	type PreparedTransaction,
	type PurchaseState,
	withContinuingPaymentObservation,
} from 'api/transactions';

import type { TransactionDialogPhase } from 'components/molecules/TransactionDialogControl';
import type { AppError } from 'helpers/app-error';

import { batchPurchaseRecoveryApprovalCount } from './fungible-batch';
import type { FungibleOperation } from './fungible-operation';

export type ContinuingPaymentObservation = Parameters<typeof withContinuingPaymentObservation>[2];

/** Everything one fungible operation dialog tracks between the wallet form and its final receipt. */
export type FungibleOperationFlowState = {
	phase: TransactionDialogPhase;
	message: string;
	failure: AppError | null;
	transaction: PreparedTransaction | null;
	views: ObserverView[];
	confirmations: number;
	consensus: Consensus | null;
	purchaseStates: Record<string, PurchaseState>;
};

export type FungibleOperationFlowEvent =
	/** A submission (fresh, resumed, or retried) starts working. */
	| { type: 'submitted' }
	/** The single signed transaction is known; it stays available for resume and receipts. */
	| { type: 'transaction-prepared'; transaction: PreparedTransaction }
	/** The signed transaction was discarded locally and can no longer be resumed. */
	| { type: 'transaction-discarded' }
	/** Dispatch starts watching observers from an empty view. */
	| { type: 'dispatch-started' }
	| { type: 'observer-views'; views: ObserverView[] }
	| { type: 'consensus'; consensus: Consensus }
	| { type: 'confirmations'; confirmations: number }
	/** A progress message for the working phase, or a note shown beside a failure. */
	| { type: 'status'; message: string }
	/** An observer retry replaces any earlier failure with its concrete wait message. */
	| { type: 'observation-retry'; message: string }
	| { type: 'completed' }
	| { type: 'failed'; failure: AppError; message: string; discardTransaction: boolean }
	/** After a failure that signed nothing, the user edits the form again. */
	| { type: 'form-reopened' }
	| { type: 'purchase-states'; updates: Record<string, PurchaseState> }
	| {
			type: 'payment-observed';
			orderId: string;
			paymentId: string;
			observation: ContinuingPaymentObservation;
	  };

/** The phase a dialog opens in: saved purchase approvals ask first, and saved signed work resumes immediately. */
export function initialFungibleOperationPhase(operation: FungibleOperation): TransactionDialogPhase {
	if (operation.kind === 'buy' && operation.resume) {
		return batchPurchaseRecoveryApprovalCount(operation.resume.entries) ? 'approval' : 'working';
	}
	return operation.kind !== 'buy' && operation.resumeId ? 'working' : 'form';
}

export function createFungibleOperationFlowState(operation: FungibleOperation): FungibleOperationFlowState {
	return {
		phase: initialFungibleOperationPhase(operation),
		message: '',
		failure: null,
		transaction: null,
		views: [],
		confirmations: 0,
		consensus: null,
		purchaseStates: {},
	};
}

export function fungibleOperationFlowReducer(
	state: FungibleOperationFlowState,
	event: FungibleOperationFlowEvent
): FungibleOperationFlowState {
	switch (event.type) {
		case 'submitted':
			// A finished operation never restarts; a new operation opens a new dialog instance.
			if (state.phase === 'done') return state;
			return { ...state, phase: 'working', message: '', failure: null };
		case 'transaction-prepared':
			return { ...state, transaction: event.transaction };
		case 'transaction-discarded':
			return state.transaction ? { ...state, transaction: null } : state;
		case 'dispatch-started':
			return { ...state, views: [], confirmations: 0, consensus: null };
		case 'observer-views':
			return { ...state, views: event.views };
		case 'consensus':
			return { ...state, consensus: event.consensus };
		case 'confirmations':
			return { ...state, confirmations: event.confirmations };
		case 'status':
			return { ...state, message: event.message };
		case 'observation-retry':
			return { ...state, failure: null, message: event.message };
		case 'completed':
			// Only running work can complete; a late completion cannot overwrite a reported outcome.
			if (state.phase !== 'working') return state;
			return { ...state, phase: 'done' };
		case 'failed':
			if (state.phase !== 'working') return state;
			return {
				...state,
				phase: 'error',
				failure: event.failure,
				message: event.message,
				...(event.discardTransaction ? { transaction: null } : {}),
			};
		case 'form-reopened':
			if (state.phase !== 'error') return state;
			return { ...state, phase: 'form', message: '', failure: null };
		case 'purchase-states':
			return { ...state, purchaseStates: { ...state.purchaseStates, ...event.updates } };
		case 'payment-observed': {
			const next = withContinuingPaymentObservation(
				state.purchaseStates[event.orderId] ?? null,
				event.paymentId,
				event.observation
			);
			return next ? { ...state, purchaseStates: { ...state.purchaseStates, [event.orderId]: next } } : state;
		}
	}
}
