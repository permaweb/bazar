import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { liveOrderOfAsset, parseAssetState } from 'api/asset-marketplace';

import {
	atomicListingPriceLabel,
	atomicOperationActionLabel,
	AtomicOperationErrorAlert,
	atomicOperationFormError,
	atomicOperationResult,
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
	winstonToAr,
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

function withGermanBigIntGrouping(run: () => void) {
	const original = BigInt.prototype.toLocaleString;
	// de-DE groups with '.', which must never meet the fixed '.' decimal.
	BigInt.prototype.toLocaleString = function (this: bigint) {
		return this.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
	};
	try {
		run();
	} finally {
		BigInt.prototype.toLocaleString = original;
	}
}

describe('atomic asset operation validation', () => {
	it('formats AR prices with fixed comma grouping in every locale', () => {
		withGermanBigIntGrouping(() => {
			expect(winstonToAr('1234500000000000')).toBe('1,234.5');
			expect(winstonToAr('1000000000000000')).toBe('1,000');
		});
	});

	it('accepts a pasted AR price with surrounding whitespace', () => {
		expect(atomicOperationValue('sell', ' 0.25 ')).toBe('0.25');
		expect(atomicOperationFormError('sell', ' 0.25 ')).toBe('');
		expect(atomicOperationFormError('sell', '0.25 ')).toBe('');
		expect(atomicOperationFormError('sell', ' 0.0 ')).toContain('at least');
	});

	it('echoes the listing price as it is recorded on-chain', () => {
		const sell = { kind: 'sell' } as any;
		expect(atomicListingPriceLabel(' 0.50 ')).toBe('0.5 AR');
		expect(atomicOperationActionLabel(sell, ' 1234.50 ')).toBe('List for 1,234.5 AR');
		expect(atomicOperationActionLabel(sell, ' ')).toBe('Enter a listing price');
		expect(atomicOperationResult('sell', 'Asset', '0.50')).toEqual({
			title: 'Listing is live',
			detail: 'Asset is offered for 0.5 AR.',
		});
	});

	it('requires a positive AR price with at most twelve decimals', () => {
		expect(atomicOperationFormError('sell', '')).toContain('AR price');
		expect(atomicOperationFormError('sell', '0')).toContain('at least');
		expect(atomicOperationFormError('sell', '0.000000000001')).toBe('');
		expect(atomicOperationFormError('sell', '0.0000000000001')).toContain('valid AR amount');
	});

	it('enforces the makeOffer price cap inline, before any network work', () => {
		expect(atomicOperationFormError('sell', '66000000')).toBe('');
		expect(atomicOperationFormError('sell', ' 66000000.000000000000 ')).toBe('');
		expect(atomicOperationFormError('sell', '66000000.000000000001')).toBe(
			'Enter a price no higher than 66,000,000 AR.'
		);
		expect(atomicOperationFormError('sell', '66000001')).toBe('Enter a price no higher than 66,000,000 AR.');
		expect(atomicOperationFormError('sell', '100000000')).toBe('Enter a price no higher than 66,000,000 AR.');
	});

	it('requires an exact Arweave recipient before transfer', () => {
		expect(atomicOperationFormError('transfer', '')).toContain('43-character');
		expect(atomicOperationFormError('transfer', 'too-short')).toContain('valid');
		expect(atomicOperationFormError('transfer', 'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc')).toBe('');
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
