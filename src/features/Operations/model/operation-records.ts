import type { AssetSummary } from 'api/collections';
import type { SwapOrder } from 'api/marketplace';
import type { Operation } from 'api/operations';
import type { PurchaseGatewayContext, PurchaseSnapshot } from 'api/transactions';

import { type AppError, appError } from 'helpers/app-error';

import { currentPurchaseGatewayContext } from './atomic-operation';

/*
 * Recovery records the operation dialog saves in browser storage. Their shapes and key order are persisted formats:
 * the operation activity provider and later sessions restore dialogs from them, so change them only with a migration.
 */

export type BuyOperation = Extract<Operation, { kind: 'buy' }>;
export type AtomicActionOperation = Exclude<Operation, BuyOperation>;

/** The live asset slot a cancellation or transfer started from, proving which later state reflects it. */
export type ExactActionBaseline = { startingSlot: number };

export type AtomicPurchaseRecord = {
	asset: { id: string; name: string };
	activityKind: 'atomic';
	buyer: string;
	collectionId: string;
	gateway: PurchaseGatewayContext;
	order: SwapOrder;
	snapshot: PurchaseSnapshot;
	createdAt: number;
};

export type AtomicActionRecord = {
	txId: string;
	kind: AtomicActionOperation['kind'];
	assetId: string;
	asset: { id: string; name: string; image?: string };
	activityKind: 'atomic';
	collectionId: string;
	signer: string;
	order?: SwapOrder;
	value?: string;
	startingSlot?: number;
	createdAt: number;
};

function field(record: unknown, key: string): unknown {
	return record !== null && typeof record === 'object' ? (record as Record<string, unknown>)[key] : undefined;
}

export function atomicPurchaseRecord(input: {
	asset: Pick<AssetSummary, 'id' | 'name'>;
	buyer: string;
	collectionId: string;
	gateway: PurchaseGatewayContext;
	order: SwapOrder;
	snapshot: PurchaseSnapshot;
	createdAt: number;
}): AtomicPurchaseRecord {
	return {
		asset: { id: input.asset.id, name: input.asset.name },
		activityKind: 'atomic',
		buyer: input.buyer,
		collectionId: input.collectionId,
		gateway: input.gateway,
		order: input.order,
		snapshot: input.snapshot,
		createdAt: input.createdAt,
	};
}

/** Matches the saved purchase of this buyer, order, and exact signed reservation, and nothing else. */
export function atomicPurchaseRecordMatcher(
	buyer: string,
	orderId: string,
	registrationId: string | undefined
): (record: unknown) => boolean {
	return (record) =>
		field(record, 'buyer') === buyer &&
		field(field(record, 'order'), 'orderId') === orderId &&
		field(field(field(record, 'snapshot'), 'registration'), 'id') === registrationId;
}

/** Matches the saved listing, cancellation, or transfer that holds exactly this signed transaction. */
export function atomicActionRecordMatcher(transactionId: string | undefined): (record: unknown) => boolean {
	return (record) => field(record, 'txId') === transactionId;
}

/** A cancellation or transfer cannot be recovered without the slot its exact outcome is measured from. */
export function requiredActionBaseline(baseline: ExactActionBaseline | null): ExactActionBaseline {
	if (!baseline) throw appError('asset-action-recovery-baseline-missing');
	return baseline;
}

export function atomicActionRecord(input: {
	transactionId: string;
	operation: AtomicActionOperation;
	asset: Pick<AssetSummary, 'id' | 'name' | 'image'>;
	collectionId: string;
	signer: string;
	value: string;
	baseline: ExactActionBaseline | null;
	createdAt: number;
}): AtomicActionRecord {
	return {
		txId: input.transactionId,
		kind: input.operation.kind,
		assetId: input.asset.id,
		asset: {
			id: input.asset.id,
			name: input.asset.name,
			...(input.asset.image ? { image: input.asset.image } : {}),
		},
		activityKind: 'atomic',
		collectionId: input.collectionId,
		signer: input.signer,
		...(input.operation.kind === 'cancel'
			? { order: input.operation.order, startingSlot: requiredActionBaseline(input.baseline).startingSlot }
			: input.operation.kind === 'transfer'
			? { value: input.value, startingSlot: requiredActionBaseline(input.baseline).startingSlot }
			: { value: input.value }),
		createdAt: input.createdAt,
	};
}

/** The operation to resume after its exact transaction was signed and saved. */
export function preparedAtomicOperation(
	operation: AtomicActionOperation,
	transactionId: string,
	value: string,
	baseline: ExactActionBaseline | null
): Operation {
	if (operation.kind === 'cancel') {
		return {
			kind: 'cancel',
			order: operation.order,
			resumeId: transactionId,
			startingSlot: requiredActionBaseline(baseline).startingSlot,
		};
	}
	if (operation.kind === 'transfer') {
		return {
			kind: 'transfer',
			resumeId: transactionId,
			startingSlot: requiredActionBaseline(baseline).startingSlot,
			value,
		};
	}
	return { kind: 'sell', resumeId: transactionId, value };
}

/** The saved starting slot a resumed cancellation or transfer measures its outcome from. */
export function initialExactActionBaseline(operation: Operation): ExactActionBaseline | null {
	if (operation.kind !== 'cancel' && operation.kind !== 'transfer') return null;
	if (typeof operation.startingSlot === 'number' && Number.isSafeInteger(operation.startingSlot)) {
		return { startingSlot: operation.startingSlot };
	}
	return operation.resumeId ? { startingSlot: 0 } : null;
}

/** The starting slot read from fresh asset state before a new cancellation or transfer is signed. */
export function exactActionBaselineFromSlot(slot: unknown): ExactActionBaseline {
	const startingSlot = Number(slot);
	if (!Number.isSafeInteger(startingSlot) || startingSlot < 0) {
		throw appError('asset-action-starting-slot-unavailable');
	}
	return { startingSlot };
}

function isPurchaseGatewayContext(value: unknown): value is PurchaseGatewayContext {
	return typeof field(value, 'arweave') === 'string' && typeof field(value, 'compute') === 'string';
}

/** The gateways a saved purchase was signed against, so recovery keeps observing through the same routes. */
export function purchaseGatewayForRecovery(serializedRecord: string | null): PurchaseGatewayContext {
	try {
		const gateway = field(JSON.parse(serializedRecord ?? 'null'), 'gateway');
		if (isPurchaseGatewayContext(gateway)) return gateway;
	} catch {
		// The recovery owner will discard malformed records before resuming them.
	}
	return currentPurchaseGatewayContext();
}

/** The signed transaction to forget after its cancellation or transfer was refused, if any. */
export function rejectedActionTransactionId(error: AppError, attemptedTransactionId: string | undefined) {
	return (error.reason === 'asset-cancel-rejected' || error.reason === 'fungible-transfer-rejected') &&
		attemptedTransactionId
		? attemptedTransactionId
		: null;
}
