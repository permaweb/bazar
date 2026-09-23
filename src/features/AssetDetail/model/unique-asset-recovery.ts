import { type AssetState, liveOrderOfAsset, type SwapOrder } from 'api/marketplace';
import {
	hasRecoverablePurchase,
	type Operation,
	type OperationActivity,
	operationRecoveryCanStillApply,
	type walletOperationStorageChange,
} from 'api/operations';
import { type PurchaseGatewayContext, purchaseGatewaySwitchNotice, type PurchaseSnapshot } from 'api/transactions';

import { atomicPurchaseRecoveryStatus, type UnavailableOperationRecovery } from 'features/Operations';
import { isArweaveId } from 'helpers/arweave-id';

type WalletOperationStorageChange = ReturnType<typeof walletOperationStorageChange>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/**
 * A purchase recovery saved in this browser for `buyer`. Only the buyer is checked when the record is read; its
 * order and snapshot are the same trusted local shape the purchase dialog stored and are re-validated against live
 * state before anything resumes.
 */
export type StoredAtomicPurchase = {
	buyer: string;
	order?: SwapOrder;
	snapshot?: PurchaseSnapshot;
	gateway?: PurchaseGatewayContext;
};

export function isStoredAtomicPurchase(record: unknown, buyer: string): record is StoredAtomicPurchase {
	return isRecord(record) && record.buyer === buyer;
}

/** A purchase record that belongs to `buyer`, targets `orderId`, and holds nothing recoverable. */
export function storedPurchaseDiscardable(record: unknown, buyer: string, orderId: string): boolean {
	return (
		isStoredAtomicPurchase(record, buyer) &&
		record.order?.orderId === orderId &&
		!hasRecoverablePurchase(record.snapshot)
	);
}

/** A signed listing, cancellation, or transfer saved in this browser for `signer`. */
export type SavedAtomicOperation = {
	kind: 'sell' | 'cancel' | 'transfer';
	signer: string;
	txId: string;
	assetId?: string;
	order?: SwapOrder;
	startingSlot?: number;
	value?: string;
};

export function isSavedAtomicOperation(record: unknown, signer: string): record is SavedAtomicOperation {
	return (
		isRecord(record) &&
		record.signer === signer &&
		isArweaveId(record.txId ?? '') &&
		(record.kind === 'sell' || record.kind === 'cancel' || record.kind === 'transfer')
	);
}

export function savedOperationRecordMatches(record: unknown, assetId: string, signer: string, txId: string): boolean {
	return isRecord(record) && record.assetId === assetId && record.signer === signer && record.txId === txId;
}

export function unavailableRecoveryRecordMatches(record: unknown, recovery: UnavailableOperationRecovery): boolean {
	return isRecord(record) && record.signer === recovery.signer && record.txId === recovery.txId;
}

export type SavedPurchaseRecoveryPlan =
	| { kind: 'none' }
	/** The record holds no signed transaction to continue; remove it. */
	| { kind: 'discard'; orderId: string }
	| { kind: 'resume'; operation: Operation; gatewayNotice: string }
	/** The order changed, so the signed purchase cannot continue; keep it saved and explain why. */
	| { kind: 'paused' };

export function savedPurchaseRecoveryPlan(
	state: AssetState,
	buyer: string,
	saved: StoredAtomicPurchase | null,
	gateway: PurchaseGatewayContext
): SavedPurchaseRecoveryPlan {
	if (!saved?.order) return { kind: 'none' };
	if (!hasRecoverablePurchase(saved.snapshot)) return { kind: 'discard', orderId: saved.order.orderId };
	if (atomicPurchaseRecoveryStatus(state, buyer, saved.order, saved.snapshot) !== 'resumable') {
		return { kind: 'paused' };
	}
	return {
		kind: 'resume',
		operation: { kind: 'buy', order: saved.order, resume: saved.snapshot },
		gatewayNotice: purchaseGatewaySwitchNotice(saved.gateway, gateway, saved.snapshot),
	};
}

/** The live order another wallet may hold a signed reservation for, when this wallet did not create it. */
export function registrationRecoveryOrder(state: AssetState, walletAddress: string): SwapOrder | null {
	const order = liveOrderOfAsset(state);
	return order && order.creator !== walletAddress ? order : null;
}

export function resumedRegistrationOperation(order: SwapOrder, registrationId: string): Operation {
	return { kind: 'buy', order, resume: { registration: { id: registrationId, dispatched: false } } };
}

/** The operation that continues a saved signed action, or null when a cancellation lost the order it cancels. */
export function resumedSavedOperation(saved: SavedAtomicOperation): Operation | null {
	if (saved.kind === 'cancel') {
		return saved.order
			? { kind: 'cancel', order: saved.order, startingSlot: saved.startingSlot, resumeId: saved.txId }
			: null;
	}
	if (saved.kind === 'transfer') {
		return { kind: 'transfer', resumeId: saved.txId, startingSlot: saved.startingSlot, value: saved.value };
	}
	return { kind: 'sell', resumeId: saved.txId, value: saved.value };
}

export type UnrestorableOperationPlan =
	| { kind: 'discard' }
	| { kind: 'unavailable'; recovery: UnavailableOperationRecovery };

/**
 * A saved action whose signed transaction is no longer in this browser: discard it when live state proves it can
 * no longer apply, otherwise keep tracking it for the user to review.
 */
export function unrestorableOperationPlan(
	state: AssetState,
	signer: string,
	saved: SavedAtomicOperation,
	key: string
): UnrestorableOperationPlan {
	return operationRecoveryCanStillApply(state, signer, saved, 'atomic')
		? { kind: 'unavailable', recovery: { key, kind: saved.kind, signer, txId: saved.txId } }
		: { kind: 'discard' };
}

/** Whether an operation is continuing a saved signed transaction rather than starting a new one. */
export function operationIsRecovering(operation: Operation): boolean {
	return operation.kind === 'buy' ? Boolean(operation.resume) : Boolean(operation.resumeId);
}

export type RecoveryStorageReaction = { removeActivity: boolean; refresh: boolean };

/**
 * How the page reacts when another tab changes this wallet's claim or recovery records for the asset. A fresh
 * operation in this tab yields to the other tab; a removed recovery means the other tab finished, so live state is
 * refreshed. `null` means the change is unrelated.
 */
export function recoveryStorageReaction(
	change: WalletOperationStorageChange,
	operation: Operation | null
): RecoveryStorageReaction | null {
	switch (change) {
		case 'ignore':
			return null;
		case 'claim-acquired':
		case 'recovery-updated':
			return { removeActivity: operation !== null && !operationIsRecovering(operation), refresh: false };
		case 'claim-released':
			return { removeActivity: false, refresh: false };
		case 'recovery-removed':
			return { removeActivity: true, refresh: true };
	}
}

/** The unfinished operation this wallet has on this asset, if any. */
export function activeAssetOperation<T extends Pick<OperationActivity, 'asset' | 'owner' | 'phase'>>(
	activities: T[],
	assetId: string,
	walletAddress: string | null
): T | undefined {
	return activities.find(
		(activity) => activity.asset.id === assetId && activity.owner === walletAddress && activity.phase !== 'done'
	);
}

export type UniqueAssetRecoveryNotice =
	| { kind: 'gateway-switch'; message: string }
	| { kind: 'purchase-paused' }
	| { kind: 'stale-action-removed' }
	| { kind: 'tracking-discarded' };

export type UniqueAssetRecovery = {
	notice: UniqueAssetRecoveryNotice | null;
	unavailable: UnavailableOperationRecovery | null;
	/** Bumped whenever this wallet's saved records may have changed, so recovery is re-evaluated. */
	storageVersion: number;
};

export type UniqueAssetRecoveryEvent =
	| { type: 'reset' }
	| { type: 'storage-changed' }
	| { type: 'notice'; notice: UniqueAssetRecoveryNotice }
	| { type: 'notice-dismissed' }
	| { type: 'recovery-unavailable'; recovery: UnavailableOperationRecovery }
	/** Stop tracking an unavailable recovery; with `key`, only when it is the recovery for that record. */
	| { type: 'recovery-cleared'; key?: string }
	| { type: 'stale-action-removed' }
	| { type: 'tracking-discarded' };

export const INITIAL_UNIQUE_ASSET_RECOVERY: UniqueAssetRecovery = {
	notice: null,
	unavailable: null,
	storageVersion: 0,
};

export function uniqueAssetRecoveryReducer(
	recovery: UniqueAssetRecovery,
	event: UniqueAssetRecoveryEvent
): UniqueAssetRecovery {
	switch (event.type) {
		case 'reset':
			return recovery.notice || recovery.unavailable
				? { ...recovery, notice: null, unavailable: null }
				: recovery;
		case 'storage-changed':
			return { ...recovery, storageVersion: recovery.storageVersion + 1 };
		case 'notice':
			return { ...recovery, notice: event.notice };
		case 'notice-dismissed':
			return recovery.notice ? { ...recovery, notice: null } : recovery;
		case 'recovery-unavailable':
			return { ...recovery, unavailable: event.recovery };
		case 'recovery-cleared':
			return recovery.unavailable && (event.key === undefined || recovery.unavailable.key === event.key)
				? { ...recovery, unavailable: null }
				: recovery;
		case 'stale-action-removed':
			return { ...recovery, unavailable: null, notice: { kind: 'stale-action-removed' } };
		case 'tracking-discarded':
			return { ...recovery, unavailable: null, notice: { kind: 'tracking-discarded' } };
	}
}
