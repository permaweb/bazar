import { type AssetState, filledOrder, liquidBalanceOf, type SwapOrder } from 'api/marketplace';
import { hasRecoverablePurchase, purchaseRecoveryApprovalCount, storeWalletRecordOrThrow } from 'api/operations';
import {
	type PreparedPurchase,
	type PurchaseBatchPreparationEvent,
	type PurchaseSnapshot,
	type PurchaseState,
	purchaseStateFailure,
} from 'api/transactions';

import { appError, type AppErrorReason, toAppError } from 'helpers/app-error';
import { isArweaveId } from 'helpers/arweave-id';
import { formatMessage } from 'helpers/i18n';

import type { AssetDetailMessages, AssetDetailPlural } from '../messages';

import { BatchEntry, BatchResume } from './fungible-operation';

export function preparedEntry(prepared: PreparedPurchase): BatchEntry {
	return {
		order: prepared.order,
		fillQuantity: prepared.fillQuantity,
		snapshot: prepared.snapshot,
		paymentCost: prepared.paymentCost,
	};
}

export function checkpointBatchPreparation(entries: BatchEntry[], event: PurchaseBatchPreparationEvent): BatchEntry[] {
	if (event.type === 'quoted') {
		return event.entries.map((entry) => ({ ...entry, snapshot: {} }));
	}
	let matched = false;
	const next = entries.map((entry) => {
		if (entry.order.orderId !== event.orderId) return entry;
		matched = true;
		return {
			...entry,
			...(event.kind === 'payment' ? { paymentCost: event.cost } : {}),
			snapshot: {
				...entry.snapshot,
				[event.kind]: { id: event.transactionId, dispatched: false },
			},
		};
	});
	if (!matched) throw appError('invalid-input', { message: 'purchase-preparation-checkpoint-missing' });
	return next;
}

export function batchPaymentBarrierState(entries: Array<Pick<BatchEntry, 'snapshot' | 'paymentCost'>>) {
	return entries.reduce(
		(state, entry) =>
			entry.snapshot.payment?.dispatched
				? { ...state, registrationsReady: state.registrationsReady + 1 }
				: { ...state, pendingPaymentCost: state.pendingPaymentCost + BigInt(entry.paymentCost) },
		{ registrationsReady: 0, pendingPaymentCost: 0n }
	);
}

export function batchRecoveryIdentity(entries: Array<Pick<BatchEntry, 'order' | 'fillQuantity' | 'snapshot'>>) {
	return entries
		.map(
			({ order, fillQuantity, snapshot }) =>
				`${order.orderId}:${fillQuantity}:${snapshot.registration?.id ?? ''}:${snapshot.payment?.id ?? ''}`
		)
		.join('|');
}

export function purchaseQuoteIdentity(orders: SwapOrder[]) {
	return orders
		.map((order) => `${order.orderId}:${order.quantity}:${order.asking}:${order.minimumFee}:${order.recipient}`)
		.join('|');
}

export function batchPurchaseStartingBalance(
	resume: Pick<BatchResume, 'startingBalance'> | undefined,
	freshState: AssetState | undefined,
	buyer: string,
	renderedBalance: string
) {
	if (resume) return resume.startingBalance;
	return freshState ? liquidBalanceOf(freshState, buyer) : renderedBalance;
}

export function fungibleBatchRecoveryStatus(
	resume: Pick<BatchResume, 'entries'>,
	state: AssetState,
	buyer: string
): 'resumable' | 'blocked' {
	return resume.entries.every((entry) => {
		// A payment leg must resume its exact historical proof even if the buyer
		// later transfers the purchased units and current balance returns to zero.
		if (entry.snapshot.payment?.id) return true;
		const order = state.orders[entry.order.orderId];
		const fill = filledOrder(entry.order, entry.fillQuantity);
		const expected = order?.status === 'reserved' ? fill : entry.order;
		return Boolean(
			order &&
				order.creator === expected.creator &&
				order.recipient === expected.recipient &&
				order.asking === expected.asking &&
				order.deposit === expected.deposit &&
				order.minimumFee === expected.minimumFee &&
				order.deadline === expected.deadline &&
				order.createdAt === expected.createdAt &&
				order.quantity === expected.quantity &&
				(order.status === 'open' || (order.status === 'reserved' && order.buyer === buyer))
		);
	})
		? 'resumable'
		: 'blocked';
}

export function isRecoverableBatch(record: unknown, buyer: string): record is BatchResume {
	if (!record || typeof record !== 'object') return false;
	const candidate = record as Partial<BatchResume>;
	if (
		candidate.version !== 3 ||
		candidate.buyer !== buyer ||
		!/^\d+$/.test(candidate.startingBalance ?? '') ||
		!Array.isArray(candidate.entries) ||
		candidate.entries.length === 0
	) {
		return false;
	}
	return candidate.entries.every((entry) =>
		Boolean(
			entry &&
				isArweaveId(entry.order?.orderId ?? '') &&
				/^\d+$/.test(entry.order?.quantity ?? '') &&
				/^\d+$/.test(entry.order?.asking ?? '') &&
				/^[1-9]\d*$/.test(entry.fillQuantity ?? '') &&
				BigInt(entry.fillQuantity) <= BigInt(entry.order.quantity) &&
				/^\d+$/.test(entry.paymentCost ?? '') &&
				(hasRecoverablePurchase(entry.snapshot) || (!entry.snapshot.registration && !entry.snapshot.payment))
		)
	);
}

export function batchPurchaseRecoveryApprovalCount(entries: Array<Pick<BatchEntry, 'snapshot'>>) {
	return entries.reduce((total, entry) => total + purchaseRecoveryApprovalCount(entry.snapshot), 0);
}

export function batchPurchaseRecoveryApprovalCopy(
	entries: Array<Pick<BatchEntry, 'snapshot'>>,
	messages: AssetDetailMessages,
	plural: AssetDetailPlural
) {
	const approvals = batchPurchaseRecoveryApprovalCount(entries);
	const transactionCount = entries.length * 2;
	const recovered = transactionCount - approvals;
	const dispatchedPayments = entries.filter((entry) => entry.snapshot.payment?.dispatched === true).length;
	const paymentDetail = dispatchedPayments
		? plural(messages.recoveryApprovalPaymentsDispatched, dispatchedPayments)
		: messages.recoveryApprovalNoPayments;
	return {
		title: plural(messages.recoveryApprovalTitle, approvals),
		detail: formatMessage(messages.recoveryApprovalDetail, {
			recovered,
			total: transactionCount,
			approvals,
			approvalNoun: plural(messages.recoveryApprovalNoun, approvals),
			paymentDetail,
		}),
		action: plural(messages.recoveryApprovalAction, approvals),
	};
}

export function batchHasNoDispatchedSellerPayment(resume: Pick<BatchResume, 'entries'>) {
	return resume.entries.every((entry) => entry.snapshot.payment?.dispatched !== true);
}

export function latestRecoverableSnapshot(current: PurchaseSnapshot, next: PurchaseSnapshot) {
	if (!hasRecoverablePurchase(next)) return current;
	const candidate =
		current.registration?.id === next.registration?.id
			? {
					registration: {
						id: next.registration!.id,
						dispatched: Boolean(current.registration?.dispatched || next.registration?.dispatched),
					},
					...(next.payment
						? {
								payment:
									next.payment.id === current.payment?.id
										? {
												id: next.payment.id,
												dispatched: Boolean(
													current.payment.dispatched || next.payment.dispatched
												),
										  }
										: next.payment,
						  }
						: current.payment
						? { payment: current.payment }
						: {}),
					...(current.dismissed || next.dismissed ? { dismissed: true } : {}),
			  }
			: next;
	return equalPurchaseSnapshots(current, candidate) ? current : candidate;
}

export function purchaseStateFrameBuffer(
	commit: (updates: Record<string, PurchaseState>) => void,
	schedule: (callback: () => void) => number = (callback) => window.requestAnimationFrame(callback),
	cancel: (handle: number) => void = (handle) => window.cancelAnimationFrame(handle)
) {
	let scheduled: number | null = null;
	let pending: Record<string, PurchaseState> = {};
	const flush = () => {
		if (scheduled !== null) cancel(scheduled);
		scheduled = null;
		if (!Object.keys(pending).length) return;
		const updates = pending;
		pending = {};
		commit(updates);
	};
	return {
		push(orderId: string, state: PurchaseState) {
			pending[orderId] = state;
			if (scheduled !== null) return;
			scheduled = schedule(() => {
				scheduled = null;
				flush();
			});
		},
		flush,
		clear() {
			if (scheduled !== null) cancel(scheduled);
			scheduled = null;
			pending = {};
		},
	};
}

export function batchRecoveryFrameBuffer(
	persist: () => void,
	scheduleFrame: (callback: () => void) => number = (callback) => window.requestAnimationFrame(callback),
	cancelFrame: (handle: number) => void = (handle) => window.cancelAnimationFrame(handle)
) {
	let scheduled: number | null = null;
	let dirty = false;
	const persistDirty = () => {
		if (!dirty) return;
		dirty = false;
		persist();
	};
	return {
		schedule() {
			dirty = true;
			if (scheduled !== null) return;
			scheduled = scheduleFrame(() => {
				scheduled = null;
				persistDirty();
			});
		},
		flush(force = false) {
			if (scheduled !== null) cancelFrame(scheduled);
			scheduled = null;
			if (force && !dirty) persist();
			else persistDirty();
		},
		clear() {
			if (scheduled !== null) cancelFrame(scheduled);
			scheduled = null;
			dirty = false;
		},
	};
}

function equalPurchaseSnapshots(left: PurchaseSnapshot, right: PurchaseSnapshot) {
	return (
		left.registration?.id === right.registration?.id &&
		left.registration?.dispatched === right.registration?.dispatched &&
		left.payment?.id === right.payment?.id &&
		left.payment?.dispatched === right.payment?.dispatched &&
		left.dismissed === right.dismissed
	);
}

export function storeBatchRecoveryBeforeDispatch(
	storage: Pick<Storage, 'getItem' | 'setItem'>,
	key: string,
	record: BatchResume,
	signal: AbortSignal
) {
	const attemptId = record.attemptId ?? batchRecoveryIdentity(record.entries);
	record.attemptId = attemptId;
	storeWalletRecordOrThrow(
		storage,
		key,
		record,
		(current: BatchResume) => (current.attemptId ?? batchRecoveryIdentity(current.entries)) === attemptId,
		true
	);
	if (signal.aborted) throw signal.reason;
}

export async function waitForSettlementBatch(running: Promise<PurchaseState>[]): Promise<PurchaseState[]> {
	const settled = await Promise.allSettled(running);
	const failed = settled.filter(
		(result) => result.status === 'rejected' || result.value.stage !== 'complete' || !result.value.success
	);
	if (failed.length) {
		const failureReasons = [
			...new Set(
				failed.flatMap((result): AppErrorReason[] => {
					if (result.status === 'rejected') return [toAppError(result.reason, 'unknown').reason];
					const failure = purchaseStateFailure(result.value);
					return failure ? [failure.reason] : [];
				})
			),
		];
		throw appError('purchase-settlement-incomplete', {
			detail: { failedCount: failed.length, totalCount: settled.length, failureReasons },
		});
	}
	return settled.map((result) => (result as PromiseFulfilledResult<PurchaseState>).value);
}

export function settlementTabIndex(key: string, current: number, count: number): number | null {
	if (count < 1) return null;
	if (key === 'Home') return 0;
	if (key === 'End') return count - 1;
	if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % count;
	if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + count) % count;
	return null;
}

export function batchSettlementSummary(states: Array<PurchaseState | undefined>, messages: AssetDetailMessages) {
	const settled = states.filter((state) => state?.stage === 'complete').length;
	const failed = states.filter((state) => state?.stage === 'failed').length;
	const paying = states.filter((state) => {
		const stage = state?.stage ?? '';
		return stage.includes('payment') || stage === 'ownership-verifying';
	}).length;
	const reserving = states.length - settled - failed - paying;
	return {
		settled,
		failed,
		paying,
		reserving,
		label: formatMessage(messages.settlementSummary, {
			count: states.length,
			settled,
			failed: failed ? formatMessage(messages.settlementSummaryFailed, { count: failed }) : '',
			paying,
			reserving,
		}),
	};
}

export function nextSettlementAnnouncement(
	previousKey: string,
	signedWork: boolean,
	total: number,
	summary: Pick<ReturnType<typeof batchSettlementSummary>, 'failed' | 'settled'>,
	messages: AssetDetailMessages,
	plural: AssetDetailPlural
): { key: string; message: string } | null {
	if (total < 1) return null;
	let next: { key: string; message: string };
	if (!signedWork) {
		next = {
			key: `preparing:${total}`,
			message: plural(messages.settlementPreparing, total),
		};
	} else if (summary.failed) {
		if (previousKey.startsWith('attention:')) return null;
		next = {
			key: `attention:${total}`,
			message: formatMessage(messages.settlementAttention, { settled: summary.settled, total }),
		};
	} else if (summary.settled >= total) {
		next = {
			key: `complete:${total}`,
			message:
				total === 1
					? messages.settlementCompleteOne
					: formatMessage(messages.settlementCompleteAll, { count: total }),
		};
	} else {
		const quarter = Math.floor((summary.settled * 4) / total);
		if (quarter > 0) {
			const threshold = Math.ceil((total * Math.min(quarter, 3)) / 4);
			next = {
				key: `progress:${Math.min(quarter, 3)}:${total}`,
				message: formatMessage(messages.settlementProgress, { done: threshold, total }),
			};
		} else {
			next = {
				key: `watching:${total}`,
				message: plural(messages.settlementWatching, total),
			};
		}
	}
	return next.key === previousKey ? null : next;
}
