import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { liveOrderOfAsset, parseAssetState } from 'api/asset-marketplace';

import {
	atomicOperationActionLabel,
	AtomicOperationErrorAlert,
	atomicOperationFormError,
	atomicOperationStateError,
	atomicOperationValue,
	atomicOrderCanBeBought,
	atomicPurchaseFailureCode,
	atomicPurchaseFailureStage,
	atomicPurchaseHasTerminalReservationFailure,
	atomicPurchaseRecoveryStatus,
	AtomicPurchaseSequence,
	atomicPurchaseSequence,
	externalReservationTransaction,
	pendingListingMessage,
	purchaseStatusMessage,
} from './App';
import { purchaseObservationResumeState } from './purchase-observation-retry';

describe('atomic operation error semantics', () => {
	it('reports the actual confirmation depth after continuing early', () => {
		expect(
			purchaseStatusMessage({
				stage: 'registration-accepting',
				registration: { consensus: { confirmations: 2 } },
			} as any)
		).toContain('2 registration confirmations');
	});

	it('keeps transaction recovery outside the assertive alert summary', () => {
		const alert = renderToStaticMarkup(
			React.createElement(AtomicOperationErrorAlert, {
				message: 'The signed transaction is saved in this browser.',
			})
		);
		expect(alert).toContain('role="alert"');
		expect(alert).not.toContain('<button');
		expect(alert).not.toContain('<a');
		expect(alert).toContain('The signed transaction is saved in this browser.');
	});

	it('distinguishes the connected signer from another pending listing signer', () => {
		const signer = 'S'.repeat(43);
		const transaction = 'T'.repeat(43);
		const own = pendingListingMessage({ id: transaction, actor: signer, height: 12, timestamp: 1 }, signer);
		const other = pendingListingMessage(
			{ id: transaction, actor: 'O'.repeat(43), height: 12, timestamp: 1 },
			signer
		);

		expect(own).toBe(
			'You already submitted listing transaction TTTTTT…TTTTT; waiting for live asset state. No new wallet approval was requested.'
		);
		expect(other).toBe(
			'Another wallet OOOOOO…OOOOO submitted pending listing transaction TTTTTT…TTTTT, but it has not been accepted by live asset state. No new wallet approval was requested.'
		);
	});
});

describe('atomic asset operation validation', () => {
	it('requires a positive AR price with at most twelve decimals', () => {
		expect(atomicOperationFormError('sell', '')).toContain('AR price');
		expect(atomicOperationFormError('sell', '0')).toContain('at least');
		expect(atomicOperationFormError('sell', '0.000000000001')).toBe('');
		expect(atomicOperationFormError('sell', '0.0000000000001')).toContain('valid AR amount');
	});

	it('requires an exact Arweave recipient before transfer', () => {
		expect(atomicOperationFormError('transfer', '')).toContain('43-character');
		expect(atomicOperationFormError('transfer', 'too-short')).toContain('valid');
		expect(atomicOperationFormError('transfer', 'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc')).toBe('');
	});

	it('rejects a 43-character recipient whose last character makes it no wallet address', () => {
		const mistyped = 'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwB';
		expect(atomicOperationFormError('transfer', mistyped)).toBe(
			'This is not a valid Arweave wallet address. Check the last characters.'
		);
		expect(atomicOperationFormError('transfer', ` ${mistyped}\n`)).toContain('Check the last characters');
		expect(atomicOperationFormError('transfer', 'not-an-address')).toBe(
			'Enter a valid 43-character Arweave address.'
		);
	});

	it('only offers "Send to" for a recipient the form accepts', () => {
		const transfer = { kind: 'transfer' } as Parameters<typeof atomicOperationActionLabel>[0];
		expect(atomicOperationActionLabel(transfer, 'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwB')).toBe(
			'Enter a recipient'
		);
		expect(atomicOperationActionLabel(transfer, ' BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc ')).toMatch(
			/^Send to BLyLiO.+KONwc$/
		);
	});

	it('rejects a transfer back to the current owner', () => {
		const owner = 'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc';
		expect(atomicOperationFormError('transfer', owner, owner)).toContain('different wallet');
	});

	it('uses the normalized recipient for the transfer operation', () => {
		expect(atomicOperationValue('transfer', '  BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc  ')).toBe(
			'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc'
		);
	});

	it('does not block buy or cancellation forms', () => {
		expect(atomicOperationFormError('buy', '')).toBe('');
		expect(atomicOperationFormError('cancel', '')).toBe('');
	});
});

describe('atomic order actions', () => {
	it('only allows an open order to be bought', () => {
		expect(atomicOrderCanBeBought({ status: 'open' } as any)).toBe(true);
		expect(atomicOrderCanBeBought({ status: 'reserved' } as any)).toBe(false);
		expect(atomicOrderCanBeBought(null)).toBe(false);
	});

	it('recovers only the exact reservation submitted by the connected buyer', () => {
		const buyer = 'B'.repeat(43);
		const order = {
			orderId: 'O'.repeat(43),
			status: 'reserved',
			buyer,
			deadline: 100,
			reservedUntil: 110,
		} as any;
		const matching = {
			id: 'R'.repeat(43),
			processId: 'P'.repeat(43),
			action: 'register-interest',
			actor: buyer,
			orderId: order.orderId,
			height: 10,
			timestamp: 20,
		} as any;
		expect(externalReservationTransaction(order, buyer, [matching])).toBe(matching);
		expect(externalReservationTransaction(order, 'X'.repeat(43), [matching])).toBeNull();
		expect(externalReservationTransaction(order, buyer, [{ ...matching, actor: 'X'.repeat(43) }])).toBeNull();
		expect(externalReservationTransaction({ ...order, status: 'open' }, buyer, [matching])).toBeNull();
	});

	it('makes an expired process reservation actionable without showing a reservation recovery', () => {
		const seller = 'S'.repeat(43);
		const buyer = 'B'.repeat(43);
		const orderId = 'O'.repeat(43);
		const state = parseAssetState(
			{
				'execution-device': 'token@1.0',
				'total-supply': '1',
				balances: {},
				orders: {
					[orderId]: {
						'order-id': orderId,
						creator: seller,
						recipient: seller,
						asking: '100',
						deadline: 20,
						'created-at': 1,
						quantity: '1',
						status: 'reserved',
						buyer,
						'reserved-until': 1_980_253,
					},
				},
				'swap-height': 1_980_233,
				'next-deadline': 1_980_254,
			},
			1_980_357
		);
		const order = liveOrderOfAsset(state);

		expect(atomicOrderCanBeBought(order)).toBe(true);
		expect(
			externalReservationTransaction(order, buyer, [
				{
					id: 'R'.repeat(43),
					processId: 'P'.repeat(43),
					action: 'register-interest',
					actor: buyer,
					orderId,
					height: 100,
					timestamp: 20,
				},
			] as any)
		).toBeNull();
	});

	it('rejects stale ownership and order snapshots before approval', () => {
		const owner = 'A'.repeat(43);
		const buyer = 'B'.repeat(43);
		const order = {
			orderId: 'O'.repeat(43),
			creator: owner,
			asking: '100',
			quantity: '1',
			status: 'open',
		} as any;
		const listed = {
			balances: {},
			orders: { [order.orderId]: order },
		} as any;
		expect(atomicOperationStateError('buy', listed, buyer, order)).toBe('');
		expect(atomicOperationStateError('buy', { ...listed, orders: {} }, buyer, order)).toBe('market-state-changed');
		expect(atomicOperationStateError('cancel', listed, owner, order)).toBe('');
		expect(atomicOperationStateError('cancel', listed, buyer, order)).toBe('market-state-changed');
		expect(
			atomicOperationStateError('transfer', { balances: { [owner]: '1' }, orders: {} } as any, owner, null)
		).toBe('');
		expect(atomicOperationStateError('transfer', { balances: {}, orders: {} } as any, owner, null)).toBe(
			'market-state-changed'
		);
	});

	it('rejects every new mutation when holder balance state is incomplete', () => {
		const owner = 'A'.repeat(43);
		const buyer = 'B'.repeat(43);
		const order = {
			orderId: 'O'.repeat(43),
			creator: owner,
			asking: '100',
			quantity: '1',
			status: 'open',
		} as any;
		const incomplete = {
			balances: {},
			holderBalancesAvailable: false,
			orders: { [order.orderId]: order },
		} as any;

		expect(atomicOperationStateError('buy', incomplete, buyer, order)).toBe('asset-balance-state-unavailable');
		expect(atomicOperationStateError('sell', incomplete, owner, null)).toBe('asset-balance-state-unavailable');
		expect(atomicOperationStateError('cancel', incomplete, owner, order)).toBe('asset-balance-state-unavailable');
		expect(atomicOperationStateError('transfer', incomplete, owner, null)).toBe('asset-balance-state-unavailable');
	});
});

describe('atomic purchase failure trace', () => {
	it('shows NFT-specific purchase stages using the shared sequence styling', () => {
		const steps = atomicPurchaseSequence({ stage: 'payment-confirming' } as any);
		const sequence = renderToStaticMarkup(
			React.createElement(AtomicPurchaseSequence, {
				state: { stage: 'payment-confirming' } as any,
			})
		);

		expect(steps.map((step) => [step.key, step.label, step.state])).toEqual([
			['sign', 'Sign reservation', 'done'],
			['reserve', 'Reserve asset', 'done'],
			['pay', 'Pay seller', 'active'],
			['verify', 'Verify ownership', 'next'],
		]);
		expect(sequence).toContain('aria-label="Asset purchase transaction sequence"');
		expect(sequence).toContain('Reserve asset');
		expect(sequence).toContain('Verify ownership');
		expect(sequence.match(/aria-current="step"/g)).toHaveLength(1);
		expect(sequence.match(/<li[^>]*aria-current="step"[^>]*>.*?<\/li>/)?.[0]).toContain('Pay seller');
		expect(sequence.match(/<span class="sr-only">, completed<\/span>/g)).toHaveLength(2);
		expect(sequence.match(/<span class="sr-only">, in progress<\/span>/g)).toHaveLength(1);
		expect(sequence.match(/<span class="sr-only">, not started<\/span>/g)).toHaveLength(1);
	});

	it('names every NFT purchase step state for screen readers as the purchase advances', () => {
		const stepStatus = (stage: string) =>
			Array.from(
				renderToStaticMarkup(React.createElement(AtomicPurchaseSequence, { state: { stage } as any })).matchAll(
					/<strong>([^<]+)<\/strong><span class="sr-only">, ([^<]+)<\/span>/g
				),
				(match) => `${match[1]}: ${match[2]}`
			);

		expect(stepStatus('signing')).toEqual([
			'Sign reservation: in progress',
			'Reserve asset: not started',
			'Pay seller: not started',
			'Verify ownership: not started',
		]);
		expect(stepStatus('ownership-verifying')).toEqual([
			'Sign reservation: completed',
			'Reserve asset: completed',
			'Pay seller: completed',
			'Verify ownership: in progress',
		]);
		const complete = renderToStaticMarkup(
			React.createElement(AtomicPurchaseSequence, { state: { stage: 'complete' } as any })
		);
		expect(stepStatus('complete').every((entry) => entry.endsWith(': completed'))).toBe(true);
		expect(complete).not.toContain('aria-current');
	});

	it('keeps reservation signing active until the first NFT transaction is prepared', () => {
		expect(atomicPurchaseSequence({ stage: 'signing' } as any).map((step) => step.state)).toEqual([
			'active',
			'next',
			'next',
			'next',
		]);
	});

	it('shows a recovered reservation at the reserve step while its observations rebuild', () => {
		const recovered = purchaseObservationResumeState({
			registration: { id: 'R'.repeat(43), dispatched: true },
			payment: { id: 'P'.repeat(43), dispatched: false },
		});

		expect(atomicPurchaseSequence(recovered).map((step) => step.state)).toEqual(['done', 'active', 'next', 'next']);
	});

	it('resumes only orders still available to the same buyer', () => {
		const buyer = 'B'.repeat(43);
		const otherBuyer = 'C'.repeat(43);
		const order = {
			orderId: 'O'.repeat(43),
			creator: 'S'.repeat(43),
			recipient: 'S'.repeat(43),
			asking: '100',
			quantity: '1',
			status: 'open',
		} as any;
		const state = (currentOrder?: any, balances: Record<string, string> = {}) =>
			({
				balances,
				orders: currentOrder ? { [order.orderId]: currentOrder } : {},
			} as any);

		expect(atomicPurchaseRecoveryStatus(state(order), buyer, order)).toBe('resumable');
		expect(atomicPurchaseRecoveryStatus(state({ ...order, status: 'reserved', buyer }), buyer, order)).toBe(
			'resumable'
		);
		expect(
			atomicPurchaseRecoveryStatus(state({ ...order, status: 'reserved', buyer: otherBuyer }), buyer, order)
		).toBe('blocked');
		expect(atomicPurchaseRecoveryStatus(state(), buyer, order)).toBe('blocked');
		expect(
			atomicPurchaseRecoveryStatus(state(undefined, { [buyer]: '0' }), buyer, order, {
				payment: { id: 'P'.repeat(43), dispatched: true },
			})
		).toBe('resumable');
	});

	it('identifies the furthest known settlement stage', () => {
		expect(atomicPurchaseFailureStage(null)).toBe('Before reservation');
		expect(
			atomicPurchaseFailureStage({
				registration: { id: 'reservation', dispatched: false },
			} as any)
		).toBe('Reservation dispatch');
		expect(
			atomicPurchaseFailureStage({
				registration: { id: 'reservation', dispatched: true },
			} as any)
		).toBe('Reservation confirmation or acceptance');
		expect(
			atomicPurchaseFailureStage({
				payment: { id: 'payment', dispatched: false },
			} as any)
		).toBe('Payment release');
		expect(
			atomicPurchaseFailureStage({
				payment: { id: 'payment', dispatched: true },
			} as any)
		).toBe('Payment confirmation or ownership');
	});

	it('normalizes terminal reservation failures before choosing a recovery action', () => {
		const expired = {
			stage: 'failed',
			error: { code: 'unexpected', message: 'asset-order-reservation-expired' },
		} as any;
		const paymentRejected = {
			stage: 'failed',
			error: { code: 'payment-dispatch-rejected', message: 'invalid payment' },
		} as any;

		expect(atomicPurchaseFailureCode(expired)).toBe('asset-order-reservation-expired');
		expect(atomicPurchaseHasTerminalReservationFailure(expired)).toBe(true);
		expect(atomicPurchaseHasTerminalReservationFailure(paymentRejected)).toBe(false);
	});
});
