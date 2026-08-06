import type { Consensus, PurchaseSnapshot, PurchaseState, PurchaseTransaction } from 'weave-wrangler';

export type PurchaseObservationRetryKind = 'registration' | 'payment';

const PURCHASE_OBSERVATION_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000, 60_000] as const;

export function purchaseObservationRetryKind(
	state: Pick<PurchaseState, 'error'> | null | undefined,
): PurchaseObservationRetryKind | null {
	const normalize = (value: string) => value.trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-');
	const code = normalize(state?.error?.code ?? '');
	if (code === 'registration-not-found') return 'registration';
	if (code === 'payment-not-found') return 'payment';
	if (code && code !== 'unexpected') return null;
	const message = normalize(state?.error?.message ?? '');
	if (message === 'registration-not-found') return 'registration';
	if (message === 'payment-not-found') return 'payment';
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
	previous?: PurchaseState | null,
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
	previous?: PurchaseTransaction,
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
