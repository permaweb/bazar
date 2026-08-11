import { describe, expect, it } from 'vitest';

import { purchaseGatewaySwitchNotice, purchaseLifecycleStatus } from './purchase-lifecycle';

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
