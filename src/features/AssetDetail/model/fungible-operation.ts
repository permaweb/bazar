import type { AssetSummary } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';
import {
	ASSET_BALANCE_STATE_UNAVAILABLE,
	assetBalanceStateAvailable,
	type AssetState,
	liquidBalanceOf,
	type SwapOrder,
} from 'api/marketplace';
import type { FungibleOperationActivitySummary, OperationSession } from 'api/operations';
import {
	type PurchaseGatewayContext,
	purchaseLifecycleStatus,
	type PurchaseSnapshot,
	type PurchaseState,
	purchaseStateFailure,
} from 'api/transactions';

import { formatArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import type { TransactionDialogPhase } from 'components/molecules/TransactionDialogControl';
import { type ArweaveSyncStep, quorumConfirmationDepth } from 'features/TransactionSync';
import {
	type AppError,
	appErrorMessage,
	type AppErrorMessages,
	type AppErrorReason,
	appErrorReasonMessage,
} from 'helpers/app-error';
import { winstonToArDecimal } from 'helpers/ar-units';
import { isArweaveId } from 'helpers/arweave-id';
import { short } from 'helpers/format';
import { formatMessage } from 'helpers/i18n';

import type { AssetDetailMessages, AssetDetailPlural } from '../messages';

import { orderPriceLabel, tokenLabel } from './fungible-market';

export type BatchEntry = {
	order: SwapOrder;
	fillQuantity: string;
	snapshot: PurchaseSnapshot;
	paymentCost: string;
};

export type BatchResume = {
	version: 3;
	asset?: AssetSummary;
	activityKind?: 'fungible';
	buyer: string;
	collectionId?: string;
	startingBalance: string;
	entries: BatchEntry[];
	attemptId?: string;
	createdAt?: number;
	gateway?: PurchaseGatewayContext;
};

export type FungibleOperation =
	| { kind: 'sell'; quantity?: string; unitPrice?: string; resumeId?: string }
	| {
			kind: 'transfer';
			quantity?: string;
			recipient?: string;
			startingSlot?: number;
			resumeId?: string;
	  }
	| { kind: 'cancel'; order: SwapOrder; startingSlot?: number; resumeId?: string }
	| {
			kind: 'buy';
			availableOrders: SwapOrder[];
			quantity?: string;
			startingBalance: string;
			resume?: BatchResume;
	  };

export type FungibleOperationActivity = OperationSession<FungibleOperation> & {
	id: string;
	createdAt?: number;
	phase: TransactionDialogPhase | null;
	visible: boolean;
};

export function appendFungibleOperationActivity(
	current: FungibleOperationActivity[],
	activity: FungibleOperationActivity
) {
	return [...current.map((item) => ({ ...item, visible: false })), activity];
}

export function restartFungibleOperationActivity(activity: FungibleOperationActivity, now = Date.now()) {
	return {
		...activity,
		phase: null,
		visible: true,
		createdAt: Math.max(now, (activity.createdAt ?? 0) + 1),
	};
}

export const SETTLEMENT_ERROR_PANEL_ID = 'fungible-settlement-error-panel';

const TERMINAL_PURCHASE_FAILURES = new Set<AppErrorReason>([
	'asset-purchase-rejected',
	'asset-purchase-proof-mismatch',
]);

export function purchaseSettlementNeedsManualReview(state?: PurchaseState) {
	if (state?.stage !== 'failed') return false;
	const reason = purchaseStateFailure(state)?.reason;
	return reason !== undefined && TERMINAL_PURCHASE_FAILURES.has(reason);
}

/** Whether an operation failure, or any lot of a settlement batch, proves only manual review can resolve it. */
export function operationFailureNeedsManualReview(error: AppError | null) {
	if (!error) return false;
	return [error.reason, ...(error.detail?.failureReasons ?? [])].some((reason) =>
		TERMINAL_PURCHASE_FAILURES.has(reason)
	);
}

/** Operation copy for an application error; a settlement batch lists each lot's distinct failure. */
export function fungibleOperationFailureMessage(
	error: AppError,
	messages: AssetDetailMessages,
	errorMessages: AppErrorMessages
): string {
	const { failedCount, totalCount, failureReasons = [] } = error.detail ?? {};
	if (error.reason !== 'purchase-settlement-incomplete' || failedCount === undefined || totalCount === undefined) {
		return appErrorMessage(errorMessages, error);
	}
	return [
		formatMessage(messages.failureSettlementsNeedAttention, { failed: failedCount, total: totalCount }),
		...failureReasons.map((reason) => appErrorReasonMessage(errorMessages, reason)),
	].join(' ');
}

export function fungibleActivityPhaseStatus(phase: TransactionDialogPhase, messages: AssetDetailMessages) {
	return {
		form: messages.phaseStatusForm,
		approval: messages.phaseStatusApproval,
		working: messages.phaseStatusWorking,
		done: messages.phaseStatusDone,
		error: messages.phaseStatusError,
	}[phase];
}

export function fungibleOperationActivityProgress(
	phase: TransactionDialogPhase,
	messages: AssetDetailMessages,
	activeStep?: ArweaveSyncStep
): Pick<FungibleOperationActivitySummary, 'phase' | 'status' | 'confirmations' | 'confirmationTarget'> {
	if (phase === 'working' && activeStep?.transaction) {
		const confirmationTarget = Math.max(1, activeStep.target);
		return {
			phase,
			status: { text: messages.phaseStatusConfirming },
			confirmations: Math.min(confirmationTarget, quorumConfirmationDepth(activeStep)),
			confirmationTarget,
		};
	}
	return { phase, status: { text: fungibleActivityPhaseStatus(phase, messages) } };
}

export function fungibleOperationWorkingStatus(
	operationKind: FungibleOperation['kind'],
	message: string,
	errorMessages: AppErrorMessages,
	purchase?: PurchaseState
): string {
	return operationKind === 'buy' ? message || purchaseLifecycleStatus(purchase ?? null, errorMessages) : message;
}

export type FungiblePurchaseSequenceStep = {
	key: 'sign' | 'reserve' | 'pay' | 'verify';
	label: string;
	detail: string;
	state: 'done' | 'active' | 'next';
};

const PAYMENT_PURCHASE_STAGES = new Set([
	'dispatching-payment',
	'payment-propagating',
	'payment-confirming',
	'ownership-verifying',
	'complete',
]);

export function fungiblePurchaseSequence(
	states: Array<PurchaseState | undefined>,
	listingCount: number,
	messages: AssetDetailMessages,
	plural: AssetDetailPlural
): FungiblePurchaseSequenceStep[] {
	const total = Math.max(1, listingCount);
	const known = states.filter((state): state is PurchaseState => Boolean(state));
	const signed = Math.min(total, known.length);
	const reserved = Math.min(total, known.filter((state) => PAYMENT_PURCHASE_STAGES.has(state.stage)).length);
	const paid = Math.min(
		total,
		known.filter((state) => state.stage === 'ownership-verifying' || state.stage === 'complete').length
	);
	const verified = Math.min(total, known.filter((state) => state.stage === 'complete').length);
	const activeIndex = signed < total ? 0 : reserved < total ? 1 : paid < total ? 2 : verified < total ? 3 : 4;
	const progress = [signed, reserved, paid, verified];
	const steps: Array<Omit<FungiblePurchaseSequenceStep, 'state'>> = [
		{
			key: 'sign',
			label: messages.sequenceSign,
			detail: plural(messages.sequenceApprovals, total * 2),
		},
		{
			key: 'reserve',
			label: messages.sequenceReserve,
			detail: formatMessage(messages.sequenceReserveDetail, { done: reserved, total }),
		},
		{
			key: 'pay',
			label: messages.sequencePay,
			detail: formatMessage(messages.sequencePayDetail, { done: paid, total }),
		},
		{
			key: 'verify',
			label: messages.sequenceVerify,
			detail: formatMessage(messages.sequenceVerifyDetail, { done: verified, total }),
		},
	];
	return steps.map((step, index) => ({
		...step,
		state: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'next',
		...(index === 0 && signed < total
			? { detail: formatMessage(messages.sequencePreparingApprovals, { count: total * 2 }) }
			: {}),
		...(index > 0 && progress[index] === total ? { state: 'done' as const } : {}),
	}));
}

export function fungibleOrderActionLabel(
	action: 'buy' | 'cancel',
	order: SwapOrder,
	state: AssetState,
	messages: AssetDetailMessages
) {
	const lot = formatArCurrencyText(
		formatMessage(messages.orderActionLot, {
			quantity: tokenLabel(order.quantity, state),
			asking: winstonToArDecimal(order.asking),
		})
	);
	return action === 'buy'
		? formatMessage(messages.orderActionBuy, { lot, seller: order.creator })
		: formatMessage(messages.orderActionCancel, { lot });
}

export function fungibleListingAccessibleLabel(order: SwapOrder, state: AssetState, messages: AssetDetailMessages) {
	return formatArCurrencyText(
		formatMessage(messages.listingAccessibleLabel, {
			quantity: tokenLabel(order.quantity, state),
			price: orderPriceLabel(order, state),
			total: winstonToArDecimal(order.asking),
			seller: order.creator,
		})
	);
}

export function fungibleOperationStateError(
	kind: FungibleOperation['kind'],
	state: AssetState,
	owner: string,
	expectedOrders: SwapOrder[],
	rawQuantity = '0',
	expectedDenomination = state.denomination
): AppErrorReason | '' {
	if (!assetBalanceStateAvailable(state)) return ASSET_BALANCE_STATE_UNAVAILABLE;
	if (state.denomination !== expectedDenomination) return 'market-state-changed';
	if (kind === 'buy' || kind === 'cancel') {
		if (!expectedOrders.length) return 'market-state-changed';
		const unchanged = expectedOrders.every((expected) => {
			const current = state.orders[expected.orderId];
			return Boolean(
				current &&
					current.status === 'open' &&
					current.creator === expected.creator &&
					current.asking === expected.asking &&
					current.quantity === expected.quantity &&
					(kind === 'buy' ? current.creator !== owner : current.creator === owner)
			);
		});
		return unchanged ? '' : 'market-state-changed';
	}
	try {
		const quantity = BigInt(rawQuantity);
		return quantity > 0n && quantity <= BigInt(liquidBalanceOf(state, owner)) ? '' : 'market-state-changed';
	} catch {
		return 'market-state-changed';
	}
}

/** The `invalid-input` reason blocking this transfer recipient, or `null` when it is usable. */
export function fungibleTransferRecipientError(recipient: string, owner: string): AppErrorReason | null {
	const normalized = recipient.trim();
	if (!isArweaveId(normalized)) return 'fungible-recipient-invalid';
	if (normalized === owner) return 'fungible-recipient-is-owner';
	return null;
}

export function fungibleTransferSubmitLabel(
	quantity: string,
	state: AssetState,
	recipient: string,
	messages: AssetDetailMessages,
	fullRecipient = false
) {
	return formatMessage(messages.submitTransfer, {
		quantity: tokenLabel(quantity, state),
		recipient: fullRecipient ? recipient : short(recipient),
	});
}

export function operationLabel(kind: FungibleOperation['kind'], messages: AssetDetailMessages) {
	return {
		sell: messages.operationLabelSell,
		buy: messages.operationLabelBuy,
		cancel: messages.operationLabelCancel,
		transfer: messages.operationLabelTransfer,
	}[kind];
}

export function batchStageLabel(messages: AssetDetailMessages, state?: PurchaseState) {
	if (!state) return messages.batchStagePreparing;
	if (state.stage === 'complete') return messages.batchStageSettled;
	if (state.stage === 'failed') return messages.batchStageNeedsAttention;
	if (state.stage === 'registration-accepting') return messages.batchStageCheckingReservation;
	if (state.stage === 'ownership-verifying') return messages.batchStageCheckingReceipt;
	if (state.stage.includes('payment')) {
		return formatMessage(messages.batchStagePaying, {
			confirmations: Math.min(state.payment?.consensus.confirmations ?? 0, 5),
		});
	}
	if (state.stage === 'signing' || state.stage === 'idle') return messages.batchStagePreparing;
	return formatMessage(messages.batchStageReserving, {
		confirmations: Math.min(state.registration?.consensus.confirmations ?? 0, 5),
	});
}

export function activityDetail(event: CollectionActivityEvent, messages: AssetDetailMessages) {
	if (event.action === 'make-offer') {
		return event.asking
			? formatMessage(messages.activityDetailOfferTotal, { amount: winstonToArDecimal(event.asking) })
			: '';
	}
	if (event.action === 'transfer') {
		return event.recipient
			? formatMessage(messages.activityDetailTransferTo, { recipient: short(event.recipient) })
			: '';
	}
	if (event.action === 'register-interest' && event.orderId) {
		return formatMessage(messages.activityDetailOrder, { id: short(event.orderId) });
	}
	if (event.action === 'cancel-order' && event.orderId) {
		return formatMessage(messages.activityDetailOrder, { id: short(event.orderId) });
	}
	return '';
}

export function fungibleActivityAmount(
	event: CollectionActivityEvent,
	state: AssetState,
	messages: AssetDetailMessages
) {
	if (!event.quantity) return '';
	const quantity = tokenLabel(event.quantity, state);
	return event.action === 'make-offer' && event.asking
		? formatMessage(messages.activityAmountForAr, { quantity, amount: winstonToArDecimal(event.asking) })
		: quantity;
}

export function fungiblePurchaseActivityAmount(
	event: CollectionActivityEvent,
	events: CollectionActivityEvent[],
	state: AssetState,
	messages: AssetDetailMessages
) {
	if (event.action !== 'register-interest' || !event.orderId || !event.quantity) {
		return fungibleActivityAmount(event, state, messages);
	}
	const indexedListing = events.find(
		(candidate) =>
			candidate.action === 'make-offer' &&
			candidate.id === event.orderId &&
			Boolean(candidate.asking) &&
			Boolean(candidate.quantity)
	);
	const liveListing = state.orders?.[event.orderId];
	const asking = indexedListing?.asking ?? liveListing?.asking;
	const listedQuantity = indexedListing?.quantity ?? liveListing?.quantity;
	if (!asking || !listedQuantity) return fungibleActivityAmount(event, state, messages);
	try {
		const fill = BigInt(event.quantity);
		const lot = BigInt(listedQuantity);
		if (fill <= 0n || lot <= 0n || fill > lot) return fungibleActivityAmount(event, state, messages);
		const paid = (BigInt(asking) * fill + lot - 1n) / lot;
		return formatMessage(messages.activityAmountForAr, {
			quantity: tokenLabel(event.quantity, state),
			amount: winstonToArDecimal(paid.toString()),
		});
	} catch {
		return fungibleActivityAmount(event, state, messages);
	}
}

// Saved batch purchase snapshot for a fungible buy, if this operation resumes one.
export function fungiblePurchaseResumeOf(operation: FungibleOperation) {
	return operation.kind === 'buy' ? operation.resume : undefined;
}
