import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { liveOrderOfAsset, parseAssetState } from 'api/asset-marketplace';

import {
	AtomicOperationErrorAlert,
	atomicOperationFormError,
	atomicOperationRecovery,
	atomicOperationStateError,
	atomicOperationValue,
	atomicOrderCanBeBought,
	atomicPurchaseFailureCode,
	atomicPurchaseFailureStage,
	atomicPurchaseHasTerminalReservationFailure,
	atomicPurchaseRecoveryStatus,
	AtomicPurchaseSequence,
	atomicPurchaseSequence,
	discardUnsentAtomicSignature,
	externalReservationTransaction,
	pendingListingMessage,
	purchaseStatusMessage,
} from './App';
import { operationStorageKey } from './operation-session';
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

describe('atomic operation error recovery', () => {
	const base = {
		failureKind: 'other' as const,
		hasTransaction: false,
		purchaseFailureCode: null,
		recoverable: false,
	};
	const actions = (recovery: ReturnType<typeof atomicOperationRecovery>) => [
		recovery.primary.action,
		recovery.secondary?.action,
	];

	it('sends a changed market to the updated asset before any other recovery', () => {
		for (const kind of ['sell', 'buy', 'cancel', 'transfer'] as const) {
			const recovery = atomicOperationRecovery({
				...base,
				kind,
				failureKind: 'market-state-changed',
				hasTransaction: true,
				purchaseFailureCode: 'payment-dispatch-rejected',
				recoverable: true,
			});
			expect(recovery).toEqual({
				primary: { action: 'view-updated-asset', label: 'View updated asset' },
				purchaseReceipt: false,
			});
		}
	});

	it('offers retry and discard for a signed listing, cancellation or transfer that was never sent', () => {
		for (const [kind, noun] of [
			['sell', 'listing'],
			['cancel', 'cancellation'],
			['transfer', 'transfer'],
		] as const) {
			const recovery = atomicOperationRecovery({
				...base,
				kind,
				failureKind: 'transaction-not-sent',
				hasTransaction: true,
				recoverable: true,
			});
			expect(recovery).toEqual({
				primary: { action: 'retry-not-sent', label: `Retry ${noun}` },
				secondary: { action: 'discard-not-sent', label: `Discard ${noun}`, danger: true },
				note: 'No transaction was submitted. Retry this signature or discard it to start over.',
				purchaseReceipt: false,
			});
		}
		expect(
			actions(atomicOperationRecovery({ ...base, kind: 'sell', failureKind: 'transaction-not-sent' }))
		).toEqual(['return-to-form', undefined]);
	});

	it('keeps rejected, saved and unsigned failures on their existing actions', () => {
		expect(
			atomicOperationRecovery({
				...base,
				kind: 'cancel',
				failureKind: 'transaction-rejected',
				hasTransaction: true,
			}).primary
		).toEqual({
			action: 'discard-rejected-signature',
			label: 'Discard rejected signature and sign again',
			danger: true,
		});
		expect(atomicOperationRecovery({ ...base, kind: 'sell', hasTransaction: true }).primary).toEqual({
			action: 'resume-signed-transaction',
			label: 'Resume the signed transaction',
		});
		expect(
			atomicOperationRecovery({ ...base, kind: 'transfer', failureKind: 'transaction-rejected' }).primary
		).toEqual({ action: 'return-to-form', label: 'Try again' });
		expect(atomicOperationRecovery({ ...base, kind: 'transfer', failureKind: null }).primary.action).toBe(
			'return-to-form'
		);
	});

	it('routes purchase failures classified as rejected to the purchase recovery for their code', () => {
		const buy = (purchaseFailureCode: string | null, recoverable = false) =>
			atomicOperationRecovery({
				...base,
				kind: 'buy',
				failureKind: 'transaction-rejected',
				hasTransaction: true,
				purchaseFailureCode,
				recoverable,
			});
		expect(buy('registration-dispatch-rejected')).toEqual({
			primary: { action: 'view-current-listing', label: 'View current listing' },
			purchaseReceipt: true,
		});
		expect(buy('asset-order-reservation-rejected').primary.action).toBe('start-fresh-purchase');
		expect(buy('asset-order-reservation-expired').primary).toEqual({
			action: 'start-fresh-purchase',
			label: 'Start a new purchase',
		});
		expect(buy('payment-dispatch-rejected').primary).toEqual({
			action: 'resign-seller-payment',
			label: 'Sign a replacement seller payment',
		});
		expect(buy('asset-purchase-rejected', true).primary).toEqual({
			action: 'restart-purchase',
			label: 'Continue saved purchase',
		});
		expect(buy(null).primary).toEqual({ action: 'restart-purchase', label: 'Try again' });
		expect(
			atomicOperationRecovery({ ...base, kind: 'buy', failureKind: 'transaction-not-sent', hasTransaction: true })
				.primary.action
		).toBe('restart-purchase');
	});

	it('discards an unsent NFT signature unless another tab changed the saved record', () => {
		const owner = 'W'.repeat(43);
		const txId = 'T'.repeat(43);
		const key = operationStorageKey('asset', owner);
		const signatureKey = `bazar-signed-transaction:${txId}`;
		const seed = (recordTxId: string) =>
			new Map<string, string>([
				[key, JSON.stringify({ kind: 'sell', txId: recordTxId })],
				[signatureKey, JSON.stringify({ expectedSigner: owner, transaction: { id: txId } })],
			]);
		const storageOf = (values: Map<string, string>) => ({
			getItem: (candidate: string) => values.get(candidate) ?? null,
			removeItem: (candidate: string) => void values.delete(candidate),
		});

		const values = seed(txId);
		expect(discardUnsentAtomicSignature(storageOf(values), 'asset', owner, 'sell', txId)).toBeNull();
		expect(values.has(key)).toBe(false);
		expect(values.has(signatureKey)).toBe(false);

		const changed = seed('N'.repeat(43));
		expect(discardUnsentAtomicSignature(storageOf(changed), 'asset', owner, 'sell', txId)).toBe(
			'This saved listing changed in another tab. Close this panel and review the active action.'
		);
		expect(changed.has(key)).toBe(true);
		expect(changed.has(signatureKey)).toBe(true);
	});
});
