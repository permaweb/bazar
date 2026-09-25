import { type AppError, appError, type AppErrorReason, toAppError } from 'helpers/app-error';

/** Failures the seller must fix by relisting: retrying the cost check cannot change them. */
const LISTING_FEE_REASONS: readonly AppErrorReason[] = [
	'asset-purchase-registration-fee-too-high',
	'asset-purchase-invalid-registration-fee',
];

/** Which part of the cost check failed, so the buyer is told what is unavailable instead of a generic outage. */
export type PurchaseQuoteSource = 'balance' | 'network-fee';

/**
 * The cost check's user-facing failure. A rejected listing keeps the seller's own reason and stays non-retryable; an
 * unreachable network reports the connection; anything else names the check that could not complete.
 */
export function purchaseQuoteFailure(cause: unknown, source: PurchaseQuoteSource): AppError {
	const error = toAppError(cause, 'purchase-quote-unavailable');
	if (error.code === 'cancelled' || LISTING_FEE_REASONS.includes(error.reason)) return error;
	if (error.code === 'offline')
		return appError('purchase-quote-unavailable', { cause: error, message: error.message });
	return appError(
		source === 'balance' ? 'purchase-quote-balance-unavailable' : 'purchase-quote-network-fee-unavailable',
		{ cause: error, message: error.message }
	);
}
