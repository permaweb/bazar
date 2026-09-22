import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { liveOrderOfAsset, parseAssetState } from 'api/marketplace';
import { purchaseObservationResumeState, purchaseStateFailure } from 'api/transactions';

import AtomicOperationErrorAlert from 'features/Operations/components/molecules/AtomicOperationErrorAlert/AtomicOperationErrorAlert';
import AtomicPurchaseSequence from 'features/Operations/components/molecules/AtomicPurchaseSequence/AtomicPurchaseSequence';
import {
	atomicOperationFailureMessage,
	atomicOperationFormError,
	atomicOperationStateError,
	atomicOperationValue,
	atomicOrderCanBeBought,
	atomicPurchaseFailureStage,
	atomicPurchaseHasTerminalReservationFailure,
	atomicPurchaseRecoveryStatus,
	atomicPurchaseSequence,
	externalReservationTransaction,
	operationFailureKind,
	pendingListingFailure,
	pendingListingMessage,
	purchaseStatusMessage,
} from 'features/Operations/model/atomic-operation';
import { appError, appErrorReasonMessage } from 'helpers/app-error';

function formError(...args: Parameters<typeof atomicOperationFormError>) {
	const reason = atomicOperationFormError(...args);
	return reason ? appErrorReasonMessage(reason) : '';
}

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
		const own = pendingListingMessage({ id: transaction, actor: signer }, signer);
		const other = pendingListingMessage({ id: transaction, actor: 'O'.repeat(43) }, signer);

		expect(own).toBe(
			'You already submitted listing transaction TTTTTT…TTTTT; waiting for live asset state. No new wallet approval was requested.'
		);
		expect(other).toBe(
			'Another wallet OOOOOO…OOOOO submitted pending listing transaction TTTTTT…TTTTT, but it has not been accepted by live asset state. No new wallet approval was requested.'
		);
	});

	it('reports a pending listing as a typed refusal that keeps its exact identifiers', () => {
		const signer = 'S'.repeat(43);
		const offer = { id: 'T-'.repeat(21) + 'T', actor: signer, height: 12, timestamp: 1 };
		const failure = pendingListingFailure(offer, signer);

		expect(failure).toMatchObject({
			reason: 'asset-listing-pending-self',
			code: 'rejected',
			retryable: false,
			detail: { transactionId: offer.id, actor: signer },
		});
		expect(atomicOperationFailureMessage(failure, signer)).toBe(pendingListingMessage(offer, signer));
		expect(pendingListingFailure({ ...offer, actor: 'O'.repeat(43) }, signer).reason).toBe(
			'asset-listing-pending-other'
		);
	});

	it('chooses the recovery action from the failure reason and dispatch stage', () => {
		expect(operationFailureKind(appError('market-state-changed'))).toBe('market-state-changed');
		for (const reason of [
			'fungible-transfer-rejected',
			'asset-cancel-rejected',
			'asset-purchase-rejected',
			'asset-order-reservation-rejected',
			'asset-order-reservation-expired',
			'transaction-dispatch-rejected',
			'registration-dispatch-rejected',
			'payment-dispatch-rejected',
		] as const) {
			expect(operationFailureKind(appError(reason))).toBe('transaction-rejected');
		}
		expect(
			operationFailureKind(
				appError('asset-purchase-insufficient-funds', {
					detail: { transactionId: 'T'.repeat(43), stage: 'not-sent' },
				})
			)
		).toBe('transaction-not-sent');
		expect(operationFailureKind(appError('fungible-transfer-proof-mismatch'))).toBe('other');
		expect(operationFailureKind(appError('asset-balance-proof-unavailable'))).toBe('other');
		expect(operationFailureKind(appError('unknown'))).toBe('other');
	});

	it('explains ordinary failures with the shared copy', () => {
		expect(atomicOperationFailureMessage(appError('asset-order-reservation-rejected'), 'S'.repeat(43))).toContain(
			'may have lost a race'
		);
		expect(
			atomicOperationFailureMessage(appError('asset-order-reservation-rejected'), 'S'.repeat(43))
		).not.toContain('Another buyer claimed');
	});
});

describe('atomic asset operation validation', () => {
	it('requires a positive AR price with at most twelve decimals', () => {
		expect(formError('sell', '')).toBe('Enter the AR price for this asset.');
		expect(formError('sell', '0')).toBe('Enter a price of at least 0.000000000001 AR.');
		expect(formError('sell', '0.000000000001')).toBe('');
		expect(formError('sell', '0.0000000000001')).toBe(
			'Enter a valid AR amount with no more than 12 decimal places.'
		);
		expect(atomicOperationFormError('sell', '0')).toBe('listing-price-too-low');
	});

	it('requires an exact Arweave recipient before transfer', () => {
		expect(formError('transfer', '')).toContain('43-character');
		expect(formError('transfer', 'too-short')).toContain('valid');
		expect(formError('transfer', 'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc')).toBe('');
	});

	it('rejects a transfer back to the current owner', () => {
		const owner = 'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc';
		expect(formError('transfer', owner, owner)).toContain('different wallet');
	});

	it('uses the normalized recipient for the transfer operation', () => {
		expect(atomicOperationValue('transfer', '  BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc  ')).toBe(
			'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc'
		);
	});

	it('does not block buy or cancellation forms', () => {
		expect(atomicOperationFormError('buy', '')).toBeNull();
		expect(atomicOperationFormError('cancel', '')).toBeNull();
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

		expect(purchaseStateFailure(expired)?.reason).toBe('asset-order-reservation-expired');
		expect(atomicPurchaseHasTerminalReservationFailure(expired)).toBe(true);
		expect(atomicPurchaseHasTerminalReservationFailure(paymentRejected)).toBe(false);
	});
});
