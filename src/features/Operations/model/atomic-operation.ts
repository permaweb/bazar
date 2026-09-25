import type { CollectionActivityEvent, PendingAssetOffer } from 'api/discovery';
import {
	ASSET_BALANCE_STATE_UNAVAILABLE,
	assetBalanceStateAvailable,
	type AssetState,
	liquidBalanceOf,
	liveOrderOfAsset,
	type SwapOrder,
} from 'api/marketplace';
import type { Operation } from 'api/operations';
import {
	purchaseLifecycleStatus,
	type PurchaseSnapshot,
	type PurchaseState,
	purchaseStateFailure,
} from 'api/transactions';

import {
	type AppError,
	appError,
	appErrorMessage,
	type AppErrorMessages,
	type AppErrorReason,
} from 'helpers/app-error';
import { arToWinston, winstonToAr } from 'helpers/ar-units';
import { isArweaveId } from 'helpers/arweave-id';
import { arweaveGatewayFromLocation, gatewayFromLocation } from 'helpers/config';
import { short } from 'helpers/format';
import { formatMessage } from 'helpers/i18n';

import type { OperationsMessages } from '../messages';

export type AtomicPurchaseSequenceStep = {
	key: 'sign' | 'reserve' | 'pay' | 'verify';
	state: 'done' | 'active' | 'next';
};

const ATOMIC_PAYMENT_STAGES = new Set([
	'signing-payment',
	'dispatching-payment',
	'payment-propagating',
	'payment-confirming',
	'ownership-verifying',
	'complete',
]);

export function atomicPurchaseSequence(state: PurchaseState | null): AtomicPurchaseSequenceStep[] {
	const progress = [
		Boolean(state && state.stage !== 'idle' && state.stage !== 'signing'),
		Boolean(state && ATOMIC_PAYMENT_STAGES.has(state.stage)),
		state?.stage === 'ownership-verifying' || state?.stage === 'complete',
		state?.stage === 'complete',
	];
	const activeIndex = progress.findIndex((complete) => !complete);
	const keys: Array<AtomicPurchaseSequenceStep['key']> = ['sign', 'reserve', 'pay', 'verify'];
	return keys.map((key, index) => ({
		key,
		state: progress[index] ? 'done' : index === activeIndex ? 'active' : 'next',
	}));
}

/** Whether new mutations are paused for this asset state because its holder balances cannot be verified. */
export function assetBalanceStateNoticeRequired(state: Pick<AssetState, 'holderBalancesAvailable'>): boolean {
	return !assetBalanceStateAvailable(state);
}

export function hasStoredSignedTransaction(storage: Pick<Storage, 'key' | 'length'>) {
	for (let index = 0; index < storage.length; index += 1) {
		if (storage.key(index)?.startsWith('bazar-signed-transaction:')) return true;
	}
	return false;
}

/** The `invalid-input` reason blocking this form, or `null` when it can be submitted. */
export function atomicOperationFormError(kind: Operation['kind'], value: string, owner = ''): AppErrorReason | null {
	if (kind === 'sell') {
		if (!value.trim()) return 'listing-price-required';
		if (/^0(?:\.0*)?$/.test(value)) return 'listing-price-too-low';
		try {
			if (BigInt(arToWinston(value)) < 1n) return 'listing-price-too-low';
		} catch {
			return 'listing-price-invalid';
		}
	}
	if (kind === 'transfer') {
		const recipient = value.trim();
		if (!recipient) return 'transfer-recipient-required';
		if (!isArweaveId(recipient)) return 'transfer-recipient-invalid';
		if (owner && recipient === owner) return 'transfer-recipient-is-owner';
	}
	return null;
}

export function atomicOperationValue(kind: Operation['kind'], value: string) {
	return kind === 'transfer' ? value.trim() : value;
}

export function atomicOrderCanBeBought(order: SwapOrder | null): order is SwapOrder {
	return order?.status === 'open';
}

export function externalReservationTransaction(
	order: SwapOrder | null,
	buyer: string | null | undefined,
	activity: CollectionActivityEvent[]
): CollectionActivityEvent | null {
	if (
		!buyer ||
		order?.status !== 'reserved' ||
		order.buyer !== buyer ||
		!Number.isSafeInteger(order.reservedUntil) ||
		order.reservedUntil! < order.deadline
	)
		return null;
	const reservationHeight = order.reservedUntil! - order.deadline;
	return (
		activity.find(
			(event) =>
				event.action === 'register-interest' &&
				event.actor === buyer &&
				event.orderId === order.orderId &&
				event.height === reservationHeight &&
				isArweaveId(event.id)
		) ?? null
	);
}

export function atomicPurchaseRecoveryStatus(
	state: AssetState,
	buyer: string,
	expectedOrder: SwapOrder,
	snapshot?: PurchaseSnapshot
): 'resumable' | 'blocked' {
	// Once an exact seller payment exists, only its immutable scheduler slot can
	// prove settlement. Current ownership may have changed again legitimately.
	if (snapshot?.payment?.id) return 'resumable';
	const currentOrder = state.orders[expectedOrder.orderId];
	const orderUnchanged = Boolean(
		currentOrder &&
			currentOrder.creator === expectedOrder.creator &&
			currentOrder.recipient === expectedOrder.recipient &&
			currentOrder.asking === expectedOrder.asking &&
			currentOrder.deposit === expectedOrder.deposit &&
			currentOrder.minimumFee === expectedOrder.minimumFee &&
			currentOrder.deadline === expectedOrder.deadline &&
			currentOrder.createdAt === expectedOrder.createdAt &&
			currentOrder.quantity === expectedOrder.quantity
	);
	if (
		orderUnchanged &&
		(currentOrder.status === 'open' || (currentOrder.status === 'reserved' && currentOrder.buyer === buyer))
	) {
		return 'resumable';
	}
	return 'blocked';
}

export function atomicOperationStateError(
	kind: Operation['kind'],
	state: AssetState,
	owner: string,
	expectedOrder: SwapOrder | null
): AppErrorReason | '' {
	if (!assetBalanceStateAvailable(state)) return ASSET_BALANCE_STATE_UNAVAILABLE;
	const currentOrder = expectedOrder ? state.orders[expectedOrder.orderId] : null;
	const orderUnchanged = Boolean(
		currentOrder &&
			currentOrder.creator === expectedOrder?.creator &&
			currentOrder.asking === expectedOrder.asking &&
			currentOrder.quantity === expectedOrder.quantity
	);
	if (kind === 'buy') {
		return !orderUnchanged || !atomicOrderCanBeBought(currentOrder) || currentOrder.creator === owner
			? 'market-state-changed'
			: '';
	}
	if (kind === 'cancel') {
		return !orderUnchanged || currentOrder?.status !== 'open' || currentOrder.creator !== owner
			? 'market-state-changed'
			: '';
	}
	return liquidBalanceOf(state, owner) !== '1' || liveOrderOfAsset(state) ? 'market-state-changed' : '';
}

export function pendingListingMessage(
	offer: Pick<PendingAssetOffer, 'id' | 'actor'>,
	signer: string,
	messages: OperationsMessages
): string {
	const transaction = short(offer.id);
	if (offer.actor === signer) return formatMessage(messages.pendingListingSelf, { transaction });
	return formatMessage(messages.pendingListingOther, { actor: short(offer.actor), transaction });
}

export type OperationFailureKind = 'market-state-changed' | 'transaction-not-sent' | 'transaction-rejected' | 'other';

/** Failures proving the signed action was refused, so its saved transaction must not be replayed. */
const TRANSACTION_REJECTIONS = new Set<AppErrorReason>([
	'fungible-transfer-rejected',
	'asset-cancel-rejected',
	'asset-purchase-rejected',
	'asset-order-reservation-rejected',
	'asset-order-reservation-expired',
	'transaction-dispatch-rejected',
	'registration-dispatch-rejected',
	'payment-dispatch-rejected',
]);

/** How an operation dialog recovers from a failure: refresh the market, discard, or retry. */
export function operationFailureKind(error: AppError): OperationFailureKind {
	if (error.reason === 'market-state-changed') return 'market-state-changed';
	if (error.detail?.stage === 'not-sent') return 'transaction-not-sent';
	return TRANSACTION_REJECTIONS.has(error.reason) ? 'transaction-rejected' : 'other';
}

/** A pending listing found before signing, as the refusal the operation dialog reports. */
export function pendingListingFailure(offer: PendingAssetOffer, signer: string): AppError {
	return appError(offer.actor === signer ? 'asset-listing-pending-self' : 'asset-listing-pending-other', {
		detail: { transactionId: offer.id, actor: offer.actor },
	});
}

/** The pending listing that blocks a new one, preferring the signer's own submission, as its refusal. */
export function pendingListingsFailure(offers: PendingAssetOffer[], signer: string): AppError | null {
	const offer = offers.find((candidate) => candidate.actor === signer) ?? offers[0];
	return offer ? pendingListingFailure(offer, signer) : null;
}

/** Operation copy for an application error, naming the exact pending listing when one blocked signing. */
export function atomicOperationFailureMessage(
	error: AppError,
	signer: string,
	messages: OperationsMessages,
	errorMessages: AppErrorMessages
): string {
	const pendingListing =
		(error.reason === 'asset-listing-pending-self' || error.reason === 'asset-listing-pending-other') &&
		error.detail?.transactionId &&
		error.detail.actor
			? { id: error.detail.transactionId, actor: error.detail.actor }
			: null;
	return pendingListing
		? pendingListingMessage(pendingListing, signer, messages)
		: appErrorMessage(errorMessages, error);
}

export function atomicOperationActionLabel(operation: Operation, value: string, messages: OperationsMessages) {
	if (operation.kind === 'buy') {
		return formatMessage(messages.actionLabelBuy, { price: winstonToAr(operation.order.asking) });
	}
	if (operation.kind === 'sell') {
		return value
			? formatMessage(messages.actionLabelList, { price: value })
			: messages.actionLabelListingPriceRequired;
	}
	if (operation.kind === 'cancel') return messages.actionLabelCancel;
	return isArweaveId(value.trim())
		? formatMessage(messages.actionLabelTransfer, { recipient: short(value.trim()) })
		: messages.actionLabelRecipientRequired;
}

export function atomicOperationResult(
	kind: Operation['kind'],
	messages: OperationsMessages,
	assetName = '',
	value = '',
	owner = ''
) {
	if (kind === 'buy') {
		return {
			title: messages.resultBuyTitle,
			detail: formatMessage(messages.resultBuyDetail, { asset: assetName, owner: short(owner) }),
		};
	}
	if (kind === 'sell') {
		return {
			title: messages.resultSellTitle,
			detail: formatMessage(messages.resultSellDetail, { asset: assetName, price: value }),
		};
	}
	if (kind === 'cancel') return { title: messages.resultCancelTitle, detail: messages.resultCancelDetail };
	return {
		title: messages.resultTransferTitle,
		detail: formatMessage(messages.resultTransferDetail, { asset: assetName, recipient: short(value) }),
	};
}

export function purchaseSnapshot(state: PurchaseState): PurchaseSnapshot {
	return {
		...(state.registration
			? { registration: { id: state.registration.id, dispatched: state.registration.dispatched } }
			: {}),
		...(state.payment ? { payment: { id: state.payment.id, dispatched: state.payment.dispatched } } : {}),
		...(state.dismissed ? { dismissed: true } : {}),
	};
}

export function currentPurchaseGatewayContext() {
	return { arweave: arweaveGatewayFromLocation(), compute: gatewayFromLocation() };
}

export function purchaseStatusMessage(state: PurchaseState | null, errorMessages: AppErrorMessages) {
	return purchaseLifecycleStatus(state, errorMessages);
}

export function atomicPurchaseFailureStage(state: PurchaseState | null, messages: OperationsMessages) {
	if (state?.payment?.id) {
		return state.payment.dispatched
			? messages.failureStagePaymentConfirmation
			: messages.failureStagePaymentRelease;
	}
	if (state?.registration?.id) {
		return state.registration.dispatched
			? messages.failureStageReservationConfirmation
			: messages.failureStageReservationDispatch;
	}
	return messages.failureStageBeforeReservation;
}

const TERMINAL_RESERVATION_FAILURES = new Set<AppErrorReason>([
	'registration-dispatch-rejected',
	'asset-order-reservation-rejected',
	'asset-order-reservation-expired',
]);

export function atomicPurchaseHasTerminalReservationFailure(state: PurchaseState | null) {
	const reason = purchaseStateFailure(state)?.reason;
	return reason !== undefined && TERMINAL_RESERVATION_FAILURES.has(reason);
}

// The order an atomic buy or cancel operation acts on. Purchase callbacks run after the operation kind
// was checked; this keeps that invariant explicit where TypeScript cannot carry the narrowing.
export function purchaseOrderOf(operation: Operation): SwapOrder {
	if (operation.kind !== 'buy' && operation.kind !== 'cancel') {
		throw appError('invalid-input', { message: 'operation-order-unavailable' });
	}
	return operation.order;
}
