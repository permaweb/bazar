import type { PurchaseState } from 'weave-wrangler';

import { type AppError, appError, type AppErrorReason, knownAppErrorReason } from 'helpers/app-error';

type PurchaseFailureState = Pick<PurchaseState, 'error'> & Partial<Pick<PurchaseState, 'registration' | 'payment'>>;

/** weave-wrangler lifecycle codes proving that no POST was attempted for the signed transaction. */
const NOT_SENT_LIFECYCLE_CODES = new Set([
	'registration-dispatch-not-sent',
	'payment-dispatch-not-sent',
	'transaction-dispatch-not-sent',
]);

/**
 * The application error behind a failed weave-wrangler purchase.
 *
 * weave-wrangler records failures as `{ code, message }`: lifecycle failures carry a stable code, and anything Bazar's
 * purchase adapter threw arrives as `code: 'unexpected'` with Bazar's own reason as the message. A not-sent dispatch
 * keeps the reason that stopped it (for example insufficient funds) and marks the stage. Unrecognized text never
 * becomes a reason.
 */
export function purchaseStateFailure(state: PurchaseFailureState | null | undefined): AppError | null {
	const failure = state?.error;
	if (!failure) return null;
	const transactionId = state.payment?.id ?? state.registration?.id;
	if (NOT_SENT_LIFECYCLE_CODES.has(failure.code)) {
		return appError(knownAppErrorReason(failure.message) ?? 'transaction-dispatch-not-sent', {
			message: failure.code,
			detail: { ...(transactionId ? { transactionId } : {}), stage: 'not-sent' },
		});
	}
	const reason: AppErrorReason =
		(failure.code === 'unexpected' ? null : knownAppErrorReason(failure.code)) ??
		knownAppErrorReason(failure.message) ??
		'unknown';
	return appError(reason, {
		message: reason === 'unknown' ? `purchase-${failure.code}` : reason,
		...(transactionId ? { detail: { transactionId } } : {}),
	});
}
