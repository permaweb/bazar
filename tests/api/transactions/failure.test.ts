import { describe, expect, it } from 'vitest';
import { TransactionDispatchNotSentError, TransactionDispatchRejectedError } from 'weave-wrangler';

import { signedDispatchFailure } from 'api/transactions/adapter';
import { purchaseStateFailure } from 'api/transactions/failure';

import { appErrorMessage, toAppError } from 'helpers/app-error';

const REGISTRATION_ID = 'R'.repeat(43);
const PAYMENT_ID = 'P'.repeat(43);

describe('signed transaction dispatch failures', () => {
	it('treats a definitive gateway refusal as a rejection of the exact signed transaction', () => {
		expect(signedDispatchFailure(new TransactionDispatchRejectedError(422), PAYMENT_ID)).toMatchObject({
			reason: 'transaction-dispatch-rejected',
			code: 'rejected',
			retryable: false,
			detail: { transactionId: PAYMENT_ID },
		});
	});

	it('keeps the reason that stopped a dispatch before any POST, marking it not sent', () => {
		expect(
			signedDispatchFailure(new TransactionDispatchNotSentError('asset-purchase-insufficient-funds'), PAYMENT_ID)
		).toMatchObject({
			reason: 'asset-purchase-insufficient-funds',
			detail: { transactionId: PAYMENT_ID, stage: 'not-sent' },
		});
		expect(
			signedDispatchFailure(
				new TransactionDispatchNotSentError('Transaction dispatch did not start.'),
				PAYMENT_ID
			)
		).toMatchObject({ reason: 'transaction-dispatch-not-sent', detail: { stage: 'not-sent' } });
	});

	it('reports a lost response after submission as an unknown outcome that preserves the transaction ID', () => {
		const failure = signedDispatchFailure(new Error('socket hang up'), PAYMENT_ID);
		expect(failure).toMatchObject({
			reason: 'unknown-outcome',
			code: 'unknown-outcome',
			retryable: false,
			detail: { transactionId: PAYMENT_ID },
		});
		expect(appErrorMessage(toAppError(failure, 'unknown'))).not.toContain('socket');
	});

	it('returns a caller abort unchanged', () => {
		const controller = new AbortController();
		controller.abort();
		const reason = controller.signal.reason;
		expect(signedDispatchFailure(reason, PAYMENT_ID, controller.signal)).toBe(reason);
	});
});

describe('purchase state failures', () => {
	it('uses weave-wrangler lifecycle codes directly', () => {
		expect(
			purchaseStateFailure({
				error: { code: 'registration-dispatch-rejected', message: 'transaction-dispatch-400' },
				registration: { id: REGISTRATION_ID } as never,
			})
		).toMatchObject({ reason: 'registration-dispatch-rejected', detail: { transactionId: REGISTRATION_ID } });
		expect(
			purchaseStateFailure({ error: { code: 'payment-not-found', message: 'payment-not-found' } })?.reason
		).toBe('payment-not-found');
	});

	it("reads Bazar's own reason from an unexpected adapter failure", () => {
		expect(
			purchaseStateFailure({
				error: { code: 'unexpected', message: 'asset-order-reservation-rejected' },
				registration: { id: REGISTRATION_ID } as never,
				payment: { id: PAYMENT_ID } as never,
			})
		).toMatchObject({ reason: 'asset-order-reservation-rejected', detail: { transactionId: PAYMENT_ID } });
	});

	it('keeps the stopping reason of a not-sent dispatch', () => {
		expect(
			purchaseStateFailure({
				error: { code: 'payment-dispatch-not-sent', message: 'asset-purchase-insufficient-funds' },
				payment: { id: PAYMENT_ID } as never,
			})
		).toMatchObject({
			reason: 'asset-purchase-insufficient-funds',
			detail: { transactionId: PAYMENT_ID, stage: 'not-sent' },
		});
	});

	it('recognizes legacy spellings but never provider text', () => {
		expect(purchaseStateFailure({ error: { code: 'unexpected', message: 'registration not found' } })?.reason).toBe(
			'registration-not-found'
		);
		const failure = purchaseStateFailure({ error: { code: 'unexpected', message: 'fetch failed: ECONNRESET' } });
		expect(failure).toMatchObject({ reason: 'unknown', message: 'purchase-unexpected' });
		expect(purchaseStateFailure({})).toBeNull();
		expect(purchaseStateFailure(null)).toBeNull();
	});
});
