import type { Consensus, PurchaseSnapshot, PurchaseStage, PurchaseState, PurchaseTransaction } from 'weave-wrangler';

import { purchaseFailureCode } from './purchase-lifecycle';

export type PurchaseObservationRetryKind = 'registration' | 'payment';

const PURCHASE_OBSERVATION_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000, 60_000] as const;

export function purchaseObservationRetryKind(
	state: Pick<PurchaseState, 'error'> | null | undefined
): PurchaseObservationRetryKind | null {
	const code = purchaseFailureCode(state);
	if (code === 'registration-not-found') return 'registration';
	if (code === 'payment-not-found') return 'payment';
	return null;
}

export function purchaseObservationRetryDelay(attempt: number): number {
	const index = Math.min(Math.max(0, Math.floor(attempt)), PURCHASE_OBSERVATION_RETRY_DELAYS_MS.length - 1);
	return PURCHASE_OBSERVATION_RETRY_DELAYS_MS[index];
}

export function purchaseObservationPendingState(state: PurchaseState): PurchaseState {
	const kind = purchaseObservationRetryKind(state);
	if (!kind) return state;
	const { error: _error, ...pending } = state;
	return {
		...pending,
		stage: kind === 'registration' ? 'registration-propagating' : 'payment-propagating',
		code: `${kind}-observation-retrying`,
		canSkip: false,
		canDismiss: kind === 'payment' && state.success,
		success: kind === 'payment' && state.success,
		updatedAt: Date.now(),
	};
}

export function purchaseObservationResumeState(
	snapshot: PurchaseSnapshot | null | undefined,
	previous?: PurchaseState | null
): PurchaseState | null {
	if (!snapshot?.registration?.id) return null;
	const registration = resumedTransaction(snapshot.registration, previous?.registration);
	const payment = snapshot.payment ? resumedTransaction(snapshot.payment, previous?.payment) : undefined;
	const watchingPayment = payment?.dispatched === true;
	const stage = watchingPayment
		? 'payment-propagating'
		: registration.dispatched
		? 'registration-propagating'
		: 'dispatching-registration';
	return {
		stage,
		txId: watchingPayment ? payment.id : registration.id,
		code: watchingPayment ? 'resume-payment-observation' : 'resume-registration-observation',
		canSkip: false,
		canDismiss: false,
		success: false,
		backgroundable: Boolean(payment),
		dismissed: snapshot.dismissed ?? false,
		registration,
		...(payment ? { payment } : {}),
		updatedAt: Date.now(),
	};
}

export function purchaseObservationRetryMessage(state: PurchaseState, delayMs: number): string {
	const seconds = Math.max(1, Math.round(delayMs / 1_000));
	if (purchaseObservationRetryKind(state) === 'payment') {
		return `The exact seller payment was submitted, but Bazar could not verify it across the required Arweave observers and live asset state during this check. Bazar will check it again automatically in ${seconds} seconds. No replacement payment or wallet approval is being created, and it is safe to hide this activity.`;
	}
	return `The exact reservation is already signed and submitted, but Bazar could not verify it across the required Arweave observers and live asset state during this check. Bazar will check it again automatically in ${seconds} seconds. The signed seller payment remains held, no new wallet approval is needed, and it is safe to hide this activity.`;
}

export function purchaseObservationCheckingMessage(kind: PurchaseObservationRetryKind): string {
	return kind === 'payment'
		? 'Checking the exact submitted seller payment again. No replacement payment or wallet approval is being created.'
		: 'Checking the exact submitted reservation again. The signed seller payment remains held and no new wallet approval is needed.';
}

/** Position of each live purchase stage; the exhaustive record makes a new upstream stage a type error. */
const PURCHASE_STAGE_ORDER: Record<PurchaseStage, number> = {
	idle: 0,
	signing: 1,
	'dispatching-registration': 2,
	'registration-propagating': 3,
	'registration-confirming': 4,
	'registration-accepting': 5,
	'signing-payment': 6,
	'dispatching-payment': 7,
	'payment-propagating': 8,
	'payment-confirming': 9,
	'ownership-verifying': 10,
	complete: 11,
	failed: 12,
};

/** The last stage at which the "checking again" copy still describes what the retried run is doing. */
const RETRY_CHECKING_LAST_STAGE: Record<PurchaseObservationRetryKind, PurchaseStage> = {
	registration: 'registration-confirming',
	payment: 'payment-confirming',
};

/**
 * Whether a retried run has moved past the step the "checking again" message describes, so the
 * message should give way to the live stage status. A new SwapPurchase run first emits `idle`, so
 * the message is kept until the stage actually advances beyond the retried observation.
 */
export function shouldClearRetryMessage(
	kind: PurchaseObservationRetryKind,
	state: Pick<PurchaseState, 'stage'> | null | undefined
): boolean {
	if (!state) return false;
	if (state.stage === 'complete' || state.stage === 'failed') return true;
	return PURCHASE_STAGE_ORDER[state.stage] > PURCHASE_STAGE_ORDER[RETRY_CHECKING_LAST_STAGE[kind]];
}

export function waitForPurchaseObservationRetry(delayMs: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(signal.reason);
			return;
		}
		const timer = globalThis.setTimeout(finish, delayMs);
		signal.addEventListener('abort', abort, { once: true });
		function finish() {
			signal.removeEventListener('abort', abort);
			resolve();
		}
		function abort() {
			globalThis.clearTimeout(timer);
			reject(signal.reason);
		}
	});
}

function resumedTransaction(
	snapshot: { id: string; dispatched: boolean },
	previous?: PurchaseTransaction
): PurchaseTransaction {
	if (previous?.id === snapshot.id) {
		return { ...previous, dispatched: Boolean(previous.dispatched || snapshot.dispatched) };
	}
	return { id: snapshot.id, dispatched: snapshot.dispatched, consensus: emptyConsensus(), views: [] };
}

function emptyConsensus(): Consensus {
	return {
		state: 'unknown',
		confirmations: 0,
		answering: 0,
		eligible: 0,
		agreeing: 0,
		quorum: 0,
		best: 0,
		seen: 0,
		propagated: false,
		settled: false,
		updatedAt: Date.now(),
	};
}
