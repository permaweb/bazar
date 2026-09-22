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
import { purchaseLifecycleStatus, type PurchaseSnapshot, type PurchaseState } from 'api/transactions';

import { arToWinston, winstonToAr } from 'helpers/ar-units';
import { isArweaveId } from 'helpers/arweave-id';
import { arweaveGatewayFromLocation, gatewayFromLocation } from 'helpers/config';
import { short } from 'helpers/format';

export type AtomicPurchaseSequenceStep = {
	key: 'sign' | 'reserve' | 'pay' | 'verify';
	label: string;
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
	const steps: Array<Omit<AtomicPurchaseSequenceStep, 'state'>> = [
		{ key: 'sign', label: 'Sign reservation' },
		{ key: 'reserve', label: 'Reserve asset' },
		{ key: 'pay', label: 'Pay seller' },
		{ key: 'verify', label: 'Verify ownership' },
	];
	return steps.map((step, index) => ({
		...step,
		state: progress[index] ? 'done' : index === activeIndex ? 'active' : 'next',
	}));
}

export function hasStoredSignedTransaction(storage: Pick<Storage, 'key' | 'length'>) {
	for (let index = 0; index < storage.length; index += 1) {
		if (storage.key(index)?.startsWith('bazar-signed-transaction:')) return true;
	}
	return false;
}

export function atomicOperationFormError(kind: Operation['kind'], value: string, owner = '') {
	if (kind === 'sell') {
		if (!value.trim()) return 'Enter the AR price for this asset.';
		if (/^0(?:\.0*)?$/.test(value)) return 'Enter a price of at least 0.000000000001 AR.';
		try {
			if (BigInt(arToWinston(value)) < 1n) return 'Enter a price of at least 0.000000000001 AR.';
		} catch {
			return 'Enter a valid AR amount with no more than 12 decimal places.';
		}
	}
	if (kind === 'transfer') {
		const recipient = value.trim();
		if (!recipient) return 'Enter the recipient’s 43-character Arweave address.';
		if (!isArweaveId(recipient)) return 'Enter a valid 43-character Arweave address.';
		if (owner && recipient === owner)
			return 'Choose a different wallet. An asset cannot be transferred to its current owner.';
	}
	return '';
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
) {
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

export function pendingListingMessage(offer: PendingAssetOffer, signer: string): string {
	const transaction = short(offer.id);
	if (offer.actor === signer) {
		return `You already submitted listing transaction ${transaction}; waiting for live asset state. No new wallet approval was requested.`;
	}
	return `Another wallet ${short(
		offer.actor
	)} submitted pending listing transaction ${transaction}, but it has not been accepted by live asset state. No new wallet approval was requested.`;
}

export function atomicOperationActionLabel(operation: Operation, value: string) {
	if (operation.kind === 'buy') return `Buy for ${winstonToAr(operation.order.asking)} AR`;
	if (operation.kind === 'sell') return value ? `List for ${value} AR` : 'Enter a listing price';
	if (operation.kind === 'cancel') return 'Cancel listing and return asset';
	return isArweaveId(value.trim()) ? `Send to ${short(value.trim())}` : 'Enter a recipient';
}

export function atomicOperationResult(kind: Operation['kind'], assetName = '', value = '', owner = '') {
	if (kind === 'buy') return { title: 'Purchase complete', detail: `${assetName} is now owned by ${short(owner)}.` };
	if (kind === 'sell') return { title: 'Listing is live', detail: `${assetName} is offered for ${value} AR.` };
	if (kind === 'cancel')
		return {
			title: 'Listing cancelled',
			detail: 'The asset is back in your liquid balance and is no longer for sale.',
		};
	return { title: 'Transfer complete', detail: `${assetName} now belongs to ${short(value)}.` };
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

export function purchaseGatewayForRecovery(key: string) {
	try {
		const gateway = JSON.parse(localStorage.getItem(key) ?? 'null')?.gateway;
		if (typeof gateway?.arweave === 'string' && typeof gateway?.compute === 'string') return gateway;
	} catch {
		// The recovery owner will discard malformed records before resuming them.
	}
	return currentPurchaseGatewayContext();
}

export function purchaseStatusMessage(state: PurchaseState | null) {
	return purchaseLifecycleStatus(state);
}

export function atomicPurchaseFailureStage(state: PurchaseState | null) {
	if (state?.payment?.id) {
		return state.payment.dispatched ? 'Payment confirmation or ownership' : 'Payment release';
	}
	if (state?.registration?.id) {
		return state.registration.dispatched ? 'Reservation confirmation or acceptance' : 'Reservation dispatch';
	}
	return 'Before reservation';
}

export function atomicPurchaseFailureCode(state: PurchaseState | null) {
	if (!state?.error?.code) return null;
	return state.error.code === 'unexpected' ? state.error.message || state.error.code : state.error.code;
}

export function atomicPurchaseHasTerminalReservationFailure(state: PurchaseState | null) {
	return [
		'registration-dispatch-rejected',
		'asset-order-reservation-rejected',
		'asset-order-reservation-expired',
	].includes(atomicPurchaseFailureCode(state) ?? '');
}

// The order an atomic buy or cancel operation acts on. Purchase callbacks run after the operation kind
// was checked; this keeps that invariant explicit where TypeScript cannot carry the narrowing.
export function purchaseOrderOf(operation: Operation): SwapOrder {
	if (operation.kind !== 'buy' && operation.kind !== 'cancel') throw new Error('operation-order-unavailable');
	return operation.order;
}
