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
} from 'api/transactions';

import { formatArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import type { TransactionDialogPhase } from 'components/molecules/TransactionDialogControl';
import { type ArweaveSyncStep, quorumConfirmationDepth } from 'features/TransactionSync';
import { winstonToArDecimal } from 'helpers/ar-units';
import { isArweaveId } from 'helpers/arweave-id';
import { short } from 'helpers/format';

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

const TERMINAL_PURCHASE_FAILURES = new Set(['asset-purchase-rejected', 'asset-purchase-proof-mismatch']);

const TERMINAL_PURCHASE_FAILURE_MESSAGES = new Set(['asset purchase rejected', 'asset purchase proof mismatch']);

export function purchaseSettlementNeedsManualReview(state?: PurchaseState) {
	if (state?.stage !== 'failed' || !state.error) return false;
	if (TERMINAL_PURCHASE_FAILURES.has(state.error.code)) return true;
	return TERMINAL_PURCHASE_FAILURE_MESSAGES.has(state.error.message.trim().toLowerCase());
}

export function purchaseFailureMessageNeedsManualReview(message?: string) {
	if (!message) return false;
	const normalized = message.trim().toLowerCase();
	if (TERMINAL_PURCHASE_FAILURE_MESSAGES.has(normalized)) return true;
	return [...TERMINAL_PURCHASE_FAILURE_MESSAGES].some((failure) => normalized.endsWith(`. ${failure}`));
}

export function fungibleActivityPhaseStatus(phase: TransactionDialogPhase) {
	return {
		form: 'Waiting for details',
		approval: 'Waiting for wallet approval',
		working: 'Transaction in progress',
		done: 'Complete',
		error: 'Needs attention',
	}[phase];
}

export function fungibleOperationActivityProgress(
	phase: TransactionDialogPhase,
	activeStep?: ArweaveSyncStep
): Pick<FungibleOperationActivitySummary, 'phase' | 'status' | 'confirmations' | 'confirmationTarget'> {
	if (phase === 'working' && activeStep?.transaction) {
		const confirmationTarget = Math.max(1, activeStep.target);
		return {
			phase,
			status: 'Watching Arweave confirmations…',
			confirmations: Math.min(confirmationTarget, quorumConfirmationDepth(activeStep)),
			confirmationTarget,
		};
	}
	return { phase, status: fungibleActivityPhaseStatus(phase) };
}

export function fungibleOperationWorkingStatus(
	operationKind: FungibleOperation['kind'],
	message: string,
	purchase?: PurchaseState
): string {
	return operationKind === 'buy' ? message || purchaseLifecycleStatus(purchase ?? null) : message;
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
	listingCount: number
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
			label: 'Sign',
			detail: `${total * 2} wallet ${total * 2 === 1 ? 'approval' : 'approvals'}`,
		},
		{ key: 'reserve', label: 'Reserve', detail: `${reserved}/${total} accepted` },
		{ key: 'pay', label: 'Pay', detail: `${paid}/${total} confirmed` },
		{ key: 'verify', label: 'Verify', detail: `${verified}/${total} verified` },
	];
	return steps.map((step, index) => ({
		...step,
		state: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'next',
		...(index === 0 && signed < total ? { detail: `Preparing ${total * 2} wallet approvals` } : {}),
		...(index > 0 && progress[index] === total ? { state: 'done' as const } : {}),
	}));
}

export function fungibleOrderActionLabel(action: 'buy' | 'cancel', order: SwapOrder, state: AssetState) {
	const lot = formatArCurrencyText(`${tokenLabel(order.quantity, state)} for ${winstonToArDecimal(order.asking)} AR`);
	return action === 'buy' ? `Buy ${lot} from ${order.creator}` : `Cancel listing of ${lot}`;
}

export function fungibleListingAccessibleLabel(order: SwapOrder, state: AssetState) {
	return formatArCurrencyText(
		`${tokenLabel(order.quantity, state)}, ${orderPriceLabel(order, state)}, ${winstonToArDecimal(
			order.asking
		)} AR total, seller ${order.creator}`
	);
}

export function fungibleOperationStateError(
	kind: FungibleOperation['kind'],
	state: AssetState,
	owner: string,
	expectedOrders: SwapOrder[],
	rawQuantity = '0',
	expectedDenomination = state.denomination
) {
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

export function fungibleTransferRecipientError(recipient: string, owner: string) {
	const normalized = recipient.trim();
	if (!isArweaveId(normalized)) return 'Enter a 43-character Arweave wallet address.';
	if (normalized === owner)
		return 'Choose a different wallet. Sending tokens to this wallet would not change its balance.';
	return '';
}

export function fungibleTransferSubmitLabel(
	quantity: string,
	state: AssetState,
	recipient: string,
	fullRecipient = false
) {
	return `Send ${tokenLabel(quantity, state)} to ${fullRecipient ? recipient : short(recipient)}`;
}

export function operationLabel(kind: FungibleOperation['kind']) {
	return { sell: 'List tokens', buy: 'Buy tokens', cancel: 'Cancel listing', transfer: 'Transfer tokens' }[kind];
}

export function batchStageLabel(state?: PurchaseState) {
	if (!state) return 'Preparing';
	if (state.stage === 'complete') return 'Settled ✓';
	if (state.stage === 'failed') return 'Needs attention';
	if (state.stage === 'registration-accepting') return 'Checking reservation';
	if (state.stage === 'ownership-verifying') return 'Checking receipt';
	if (state.stage.includes('payment')) {
		return `Pay ${Math.min(state.payment?.consensus.confirmations ?? 0, 5)}/5`;
	}
	if (state.stage === 'signing' || state.stage === 'idle') return 'Preparing';
	return `Reserve ${Math.min(state.registration?.consensus.confirmations ?? 0, 5)}/5`;
}

export function activityDetail(event: CollectionActivityEvent, state: AssetState) {
	if (event.action === 'make-offer') {
		return event.asking ? `${winstonToArDecimal(event.asking)} AR total` : '';
	}
	if (event.action === 'transfer') {
		return event.recipient ? `To ${short(event.recipient)}` : '';
	}
	if (event.action === 'register-interest' && event.orderId) return `Order ${short(event.orderId)}`;
	if (event.action === 'cancel-order' && event.orderId) return `Order ${short(event.orderId)}`;
	return '';
}

export function fungibleActivityAmount(event: CollectionActivityEvent, state: AssetState) {
	if (!event.quantity) return '';
	const quantity = tokenLabel(event.quantity, state);
	return event.action === 'make-offer' && event.asking
		? `${quantity} for ${winstonToArDecimal(event.asking)} AR`
		: quantity;
}

export function fungiblePurchaseActivityAmount(
	event: CollectionActivityEvent,
	events: CollectionActivityEvent[],
	state: AssetState
) {
	if (event.action !== 'register-interest' || !event.orderId || !event.quantity) {
		return fungibleActivityAmount(event, state);
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
	if (!asking || !listedQuantity) return fungibleActivityAmount(event, state);
	try {
		const fill = BigInt(event.quantity);
		const lot = BigInt(listedQuantity);
		if (fill <= 0n || lot <= 0n || fill > lot) return fungibleActivityAmount(event, state);
		const paid = (BigInt(asking) * fill + lot - 1n) / lot;
		return `${tokenLabel(event.quantity, state)} for ${winstonToArDecimal(paid.toString())} AR`;
	} catch {
		return fungibleActivityAmount(event, state);
	}
}

// Saved batch purchase snapshot for a fungible buy, if this operation resumes one.
export function fungiblePurchaseResumeOf(operation: FungibleOperation) {
	return operation.kind === 'buy' ? operation.resume : undefined;
}
