import type { AssetSummary } from 'api/collections';
import type { SwapOrder } from 'api/marketplace';
import type { FungibleOperationActivitySummary } from 'api/operations';

import type { TransactionDialogPhase } from 'components/molecules/TransactionDialogControl';
import { isArweaveId } from 'helpers/arweave-id';

import {
	type BatchResume,
	fungibleActivityPhaseStatus,
	type FungibleOperation,
	type FungibleOperationActivity,
} from './fungible-operation';

/** A signed listing, cancellation, or transfer saved in this browser so it can resume after a reload. */
export type SavedFungibleOperationRecord = {
	txId: string;
	kind: 'sell' | 'cancel' | 'transfer';
	signer: string;
	order?: SwapOrder;
	startingSlot?: number;
	quantity?: string;
	unitPrice?: string;
	recipient?: string;
};

type UntrustedOperationRecord = { assetId?: unknown; signer?: unknown; txId?: unknown; kind?: unknown } | null;

const SAVED_OPERATION_KINDS: unknown[] = ['sell', 'cancel', 'transfer'];

/** Whether stored JSON is a saved single-transaction action signed by this wallet. */
export function isSavedFungibleOperationRecord(
	record: unknown,
	signer: string
): record is SavedFungibleOperationRecord {
	const candidate = record as UntrustedOperationRecord;
	return (
		candidate?.signer === signer &&
		isArweaveId(candidate?.txId ?? '') &&
		SAVED_OPERATION_KINDS.includes(candidate?.kind)
	);
}

/** Whether stored JSON is still the exact saved action for this asset, signer, and transaction. */
export function savedOperationRecordMatches(
	record: unknown,
	expected: { assetId: string; signer: string; txId: string }
): boolean {
	const candidate = record as UntrustedOperationRecord;
	return (
		candidate?.assetId === expected.assetId &&
		candidate?.signer === expected.signer &&
		candidate?.txId === expected.txId
	);
}

/** The dialog operation that resumes a saved signed action, or `null` when the record cannot resume one. */
export function savedFungibleOperation(saved: SavedFungibleOperationRecord): FungibleOperation | null {
	if (saved.kind === 'cancel' && saved.order) {
		return { kind: 'cancel', order: saved.order, startingSlot: saved.startingSlot, resumeId: saved.txId };
	}
	if (saved.kind === 'sell') {
		return { kind: 'sell', quantity: saved.quantity, unitPrice: saved.unitPrice, resumeId: saved.txId };
	}
	if (saved.kind === 'transfer') {
		return {
			kind: 'transfer',
			quantity: saved.quantity,
			recipient: saved.recipient,
			startingSlot: saved.startingSlot,
			resumeId: saved.txId,
		};
	}
	return null;
}

/** The purchase dialog operation that resumes a saved settlement batch. */
export function batchResumeOperation(resume: BatchResume): FungibleOperation {
	return {
		kind: 'buy',
		availableOrders: resume.entries.map((entry) => entry.order),
		startingBalance: resume.startingBalance,
		resume,
	};
}

/** The cross-page activity summary announced for one open operation dialog. */
export function fungibleOperationActivitySummary(
	activity: FungibleOperationActivity,
	asset: AssetSummary,
	collectionId: string,
	phase: TransactionDialogPhase,
	progress?: Pick<FungibleOperationActivitySummary, 'status' | 'confirmations' | 'confirmationTarget'>,
	now = Date.now()
): FungibleOperationActivitySummary {
	return {
		id: activity.id,
		asset,
		collectionId,
		owner: activity.signer,
		operationKind: activity.operation.kind,
		phase,
		status: progress?.status ?? fungibleActivityPhaseStatus(phase),
		...(progress?.confirmations !== undefined && progress.confirmationTarget !== undefined
			? {
					confirmations: progress.confirmations,
					confirmationTarget: progress.confirmationTarget,
			  }
			: {}),
		createdAt: activity.createdAt ?? now,
	};
}

/** Purchases and asset actions hold separate wallet claims and recovery records. */
export type FungibleOperationScope = 'purchase' | 'asset';

function inScope(activity: FungibleOperationActivity, scope: FungibleOperationScope) {
	return scope === 'purchase' ? activity.operation.kind === 'buy' : activity.operation.kind !== 'buy';
}

/** Drop this signer's fresh activities in a scope that another tab now owns; saved-work resumptions stay. */
export function retainResumingActivities(
	activities: FungibleOperationActivity[],
	signer: string,
	scope: FungibleOperationScope
): FungibleOperationActivity[] {
	return activities.filter((activity) => {
		if (activity.signer !== signer || !inScope(activity, scope)) return true;
		return activity.operation.kind === 'buy'
			? Boolean(activity.operation.resume)
			: Boolean(activity.operation.resumeId);
	});
}

/** Drop every activity of this signer in a scope whose recovery another tab removed. */
export function withoutScopedActivities(
	activities: FungibleOperationActivity[],
	signer: string,
	scope: FungibleOperationScope
): FungibleOperationActivity[] {
	return activities.filter((activity) => activity.signer !== signer || !inScope(activity, scope));
}

/** Show exactly one activity dialog, keeping the list identity when nothing changes. */
export function revealFungibleOperationActivity(
	activities: FungibleOperationActivity[],
	id: string
): FungibleOperationActivity[] {
	if (activities.every((activity) => activity.visible === (activity.id === id))) return activities;
	return activities.map((activity) => ({ ...activity, visible: activity.id === id }));
}
