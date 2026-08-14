import { describe, expect, it, vi } from 'vitest';

import {
	continuePaymentConfirmations,
	PURCHASE_PAYMENT_TARGET,
	PURCHASE_REGISTRATION_TARGET,
	purchaseGatewaySwitchNotice,
	purchaseLifecycleMilestone,
	purchaseLifecycleStatus,
	purchaseSkipKind,
	withContinuingPaymentObservation,
} from './purchase-lifecycle';

const registrationId = 'R'.repeat(43);
const paymentId = 'P'.repeat(43);

function state(stage: string) {
	const registrationDispatched = !['idle', 'signing', 'dispatching-registration'].includes(stage);
	const paymentStarted = [
		'signing-payment',
		'dispatching-payment',
		'payment-propagating',
		'payment-confirming',
		'ownership-verifying',
		'complete',
	].includes(stage);
	const paymentDispatched = ['payment-propagating', 'payment-confirming', 'ownership-verifying', 'complete'].includes(
		stage
	);
	return {
		stage,
		registration: {
			id: registrationId,
			dispatched: registrationDispatched,
			consensus: { confirmations: stage === 'registration-confirming' ? 1 : 0 },
			views: [],
		},
		...(paymentStarted
			? {
					payment: {
						id: paymentId,
						dispatched: paymentDispatched,
						consensus: { confirmations: stage === 'payment-confirming' ? 1 : 0 },
						views: [],
					},
			  }
			: {}),
		canSkip: false,
		canDismiss: false,
		success: stage === 'complete',
		backgroundable: true,
		dismissed: false,
		updatedAt: 1,
	} as any;
}

describe('purchase lifecycle copy', () => {
	it('hands payment settlement to live-state verification at the first confirmation', () => {
		expect(PURCHASE_REGISTRATION_TARGET).toBe(5);
		expect(PURCHASE_PAYMENT_TARGET).toBe(1);
	});

	it('continues observing payment depth without adding another settlement threshold', () => {
		let publish: ((consensus: any) => void) | undefined;
		const views = [{ observer: { label: 'Observer' } }];
		const watcher = {
			on: vi.fn((event: string, callback: (consensus: any) => void) => {
				if (event === 'consensus') publish = callback;
				return watcher;
			}),
			views: vi.fn(() => views),
			start: vi.fn(() => watcher),
		};
		const network = { watch: vi.fn(() => watcher) };
		const onObservation = vi.fn();

		expect(continuePaymentConfirmations(network as any, paymentId, onObservation)).toBe(watcher);
		expect(network.watch).toHaveBeenCalledWith(
			paymentId,
			expect.objectContaining({ target: PURCHASE_PAYMENT_TARGET, stopWhenSettled: false })
		);
		expect(watcher.start).toHaveBeenCalledOnce();

		const consensus = { confirmations: 7 };
		publish?.(consensus);
		expect(onObservation).toHaveBeenCalledWith({ consensus, views });
	});

	it('updates only the matching payment leg with continued observations', () => {
		const current = state('complete');
		const observation = { consensus: { confirmations: 8 }, views: [{ observer: { label: 'Observer' } }] };
		const updated = withContinuingPaymentObservation(current, paymentId, observation as any);

		expect(updated?.payment).toMatchObject({ id: paymentId, ...observation });
		expect(updated?.stage).toBe('complete');
		expect(withContinuingPaymentObservation(current, 'X'.repeat(43), observation as any)).toBe(current);
	});

	it('does not briefly regress a settled payment while the continued watcher warms up', () => {
		const current = state('complete');
		current.payment.consensus = { state: 'confirmed', confirmations: 1 };
		const observation = {
			consensus: { state: 'unknown', confirmations: 0 },
			views: [{ observer: { label: 'Observer' } }],
		};
		const updated = withContinuingPaymentObservation(current, paymentId, observation as any);

		expect(updated?.payment?.consensus).toBe(current.payment.consensus);
		expect(updated?.payment?.views).toBe(observation.views);
	});
	it.each([
		['signing', 'signatures'],
		['dispatching-registration', 'submitted'],
		['registration-propagating', 'accepted by Arweave'],
		['registration-confirming', 'mined'],
		['registration-accepting', 'applied to live process state'],
		['signing-payment', 'applied to live process state'],
		['dispatching-payment', 'submitted'],
		['payment-propagating', 'accepted by Arweave'],
		['payment-confirming', 'mined'],
		['ownership-verifying', 'applied to live process state'],
		['complete', 'Purchase complete'],
	])('distinguishes the %s phase', (stage, expected) => {
		expect(purchaseLifecycleStatus(state(stage))).toContain(expected);
	});

	it.each([
		['registration-confirming', 'registration', 'Reservation'],
		['payment-confirming', 'payment', 'Payment'],
	] as const)('does not call a dispatched %s transaction mined at depth zero', (stage, transaction, label) => {
		const current = state(stage);
		current[transaction].consensus.confirmations = 0;
		expect(purchaseLifecycleStatus(current)).toBe(`${label} dispatched. Waiting for it to be mined.`);
		expect(purchaseLifecycleMilestone(current)).toBe('accepted');
	});

	it('offers YOLO at depth three and Skip at depth four', () => {
		const current = state('registration-confirming');
		current.canSkip = true;
		current.registration.consensus.confirmations = 3;
		expect(purchaseSkipKind(current)).toBe('yolo');
		current.registration.consensus.confirmations = 4;
		expect(purchaseSkipKind(current)).toBe('skip');
	});

	it.each([
		'signing',
		'dispatching-registration',
		'registration-propagating',
		'registration-confirming',
		'registration-accepting',
		'signing-payment',
		'dispatching-payment',
		'payment-propagating',
		'payment-confirming',
		'ownership-verifying',
	])('keeps exact saved IDs after a gateway switch during %s', (stage) => {
		const current = state(stage);
		const snapshot = {
			registration: { id: current.registration.id, dispatched: current.registration.dispatched },
			...(current.payment ? { payment: { id: current.payment.id, dispatched: current.payment.dispatched } } : {}),
		};
		const notice = purchaseGatewaySwitchNotice(
			{ arweave: 'https://gateway-a.example', compute: 'https://compute-a.example' },
			{ arweave: 'https://gateway-b.example', compute: 'https://compute-b.example' },
			snapshot
		);

		expect(notice).toContain('saved transaction ID');
		expect(notice).toContain('will not sign or submit replacements');
		expect(snapshot.registration.id).toBe(registrationId);
		if (snapshot.payment) expect(snapshot.payment.id).toBe(paymentId);
	});
});
