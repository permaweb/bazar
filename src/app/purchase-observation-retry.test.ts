import { describe, expect, it, vi } from 'vitest';

import {
	purchaseObservationCheckingMessage,
	purchaseObservationPendingState,
	purchaseObservationResumeState,
	purchaseObservationRetryDelay,
	purchaseObservationRetryKind,
	purchaseObservationRetryMessage,
	shouldClearRetryMessage,
	waitForPurchaseObservationRetry,
} from './purchase-observation-retry';

describe('purchase observation retries', () => {
	it('only classifies observer not-found windows as retryable', () => {
		expect(
			purchaseObservationRetryKind({
				error: { code: 'registration-not-found', message: 'registration not found' },
			})
		).toBe('registration');
		expect(purchaseObservationRetryKind({ error: { code: 'unexpected', message: 'payment not found' } })).toBe(
			'payment'
		);
		expect(
			purchaseObservationRetryKind({ error: { code: 'registration-dispatch-rejected', message: 'rejected' } })
		).toBeNull();
		expect(
			purchaseObservationRetryKind({
				error: { code: 'registration-dispatch-rejected', message: 'registration not found' },
			})
		).toBeNull();
		expect(
			purchaseObservationRetryKind({ error: { code: 'asset-order-reservation-expired', message: 'expired' } })
		).toBeNull();
	});

	it('backs off quickly and caps automatic checks at one minute', () => {
		expect([0, 1, 2, 3, 4, 5, 20].map(purchaseObservationRetryDelay)).toEqual([
			2_000, 4_000, 8_000, 15_000, 30_000, 60_000, 60_000,
		]);
	});

	it('renders retry windows as pending without losing exact transaction evidence', () => {
		const failed = {
			stage: 'failed',
			code: 'registration-not-found',
			error: { code: 'registration-not-found', message: 'registration not found' },
			registration: { id: 'R'.repeat(43), dispatched: true, consensus: {}, views: [] },
			payment: { id: 'P'.repeat(43), dispatched: false, consensus: {}, views: [] },
			canSkip: false,
			canDismiss: false,
			success: false,
			backgroundable: true,
			dismissed: false,
			updatedAt: 1,
		} as any;
		const pending = purchaseObservationPendingState(failed);

		expect(pending.stage).toBe('registration-propagating');
		expect(pending.error).toBeUndefined();
		expect(pending.registration?.id).toBe('R'.repeat(43));
		expect(pending.payment?.id).toBe('P'.repeat(43));
		expect(purchaseObservationRetryMessage(failed, 4_000)).toContain('again automatically in 4 seconds');
		expect(purchaseObservationRetryMessage(failed, 4_000)).toContain('seller payment remains held');
		expect(purchaseObservationCheckingMessage('registration')).toContain('exact submitted reservation');
	});

	it('projects saved transactions into the real resume stage instead of returning to signing', () => {
		const registrationOnly = purchaseObservationResumeState({
			registration: { id: 'R'.repeat(43), dispatched: true },
			payment: { id: 'P'.repeat(43), dispatched: false },
		});
		const paymentSent = purchaseObservationResumeState({
			registration: { id: 'R'.repeat(43), dispatched: true },
			payment: { id: 'P'.repeat(43), dispatched: true },
		});

		expect(registrationOnly?.stage).toBe('registration-propagating');
		expect(registrationOnly?.txId).toBe('R'.repeat(43));
		expect(registrationOnly?.registration?.dispatched).toBe(true);
		expect(registrationOnly?.payment?.dispatched).toBe(false);
		expect(paymentSent?.stage).toBe('payment-propagating');
		expect(paymentSent?.txId).toBe('P'.repeat(43));
	});

	it('keeps the reservation "checking again" copy until the retried run moves past registration', () => {
		const keep = [
			'idle',
			'signing',
			'dispatching-registration',
			'registration-propagating',
			'registration-confirming',
		];
		const clear = [
			'registration-accepting',
			'signing-payment',
			'dispatching-payment',
			'payment-propagating',
			'payment-confirming',
			'ownership-verifying',
			'complete',
			'failed',
		];

		for (const stage of keep) expect(shouldClearRetryMessage('registration', { stage } as any), stage).toBe(false);
		for (const stage of clear) expect(shouldClearRetryMessage('registration', { stage } as any), stage).toBe(true);
	});

	it('keeps the payment "checking again" copy until the retried run moves past payment confirmation', () => {
		const keep = [
			'idle',
			'registration-propagating',
			'registration-accepting',
			'signing-payment',
			'payment-propagating',
			'payment-confirming',
		];
		const clear = ['ownership-verifying', 'complete', 'failed'];

		for (const stage of keep) expect(shouldClearRetryMessage('payment', { stage } as any), stage).toBe(false);
		for (const stage of clear) expect(shouldClearRetryMessage('payment', { stage } as any), stage).toBe(true);
		expect(shouldClearRetryMessage('payment', null)).toBe(false);
	});

	it('cancels a pending retry when the operation is abandoned', async () => {
		vi.useFakeTimers();
		const controller = new AbortController();
		const waiting = waitForPurchaseObservationRetry(60_000, controller.signal);
		controller.abort(new Error('closed'));

		await expect(waiting).rejects.toThrow('closed');
		expect(vi.getTimerCount()).toBe(0);
		vi.useRealTimers();
	});
});
