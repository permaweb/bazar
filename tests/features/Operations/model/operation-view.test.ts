import { describe, expect, it } from 'vitest';

import type { Operation } from 'api/operations';
import type { PurchaseState } from 'api/transactions';

import { initialOperationFlowState, type OperationFlowState } from 'features/Operations/model/operation-flow';
import {
	atomicOperationView,
	atomicPurchaseSyncSteps,
	initialOperationValue,
	type PurchaseQuote,
	purchaseQuoteView,
} from 'features/Operations/model/operation-view';
import { appError } from 'helpers/app-error';
import { IDLE, LOADING } from 'helpers/async-state';

const OWNER = 'O'.repeat(43);
const RECIPIENT = 'R'.repeat(43);
const REGISTRATION = 'G'.repeat(43);
const PAYMENT = 'P'.repeat(43);
const TRANSACTION = 'T'.repeat(43);
const ORDER = { orderId: 'D'.repeat(43), creator: 'S'.repeat(43), asking: '1000000000000', quantity: '1' } as any;

function purchaseState(overrides: Partial<PurchaseState> = {}): PurchaseState {
	return {
		stage: 'registration-confirming',
		txId: REGISTRATION,
		code: 'registration-confirming',
		canSkip: false,
		canDismiss: false,
		success: false,
		backgroundable: false,
		dismissed: false,
		registration: { id: REGISTRATION, dispatched: true, views: [], consensus: { confirmations: 3 } },
		updatedAt: 1,
		...overrides,
	} as PurchaseState;
}

function view(operation: Operation, flow: Partial<OperationFlowState> = {}, value = '') {
	return atomicOperationView({
		operation,
		flow: { ...initialOperationFlowState(operation), ...flow },
		assetName: 'Atomic art',
		owner: OWNER,
		value,
	});
}

describe('atomic operation view', () => {
	it('restores the saved listing price or transfer recipient', () => {
		expect(initialOperationValue({ kind: 'sell', value: '2' })).toBe('2');
		expect(initialOperationValue({ kind: 'transfer' })).toBe('');
		expect(initialOperationValue({ kind: 'cancel', order: ORDER })).toBe('');
	});

	it('describes a listing form and its validation', () => {
		expect(view({ kind: 'sell' }, {}, '')).toMatchObject({
			phase: 'form',
			label: 'List for sale',
			formError: 'listing-price-required',
			actionLabel: 'Enter a listing price',
			reportedStatus: 'Waiting for details',
			sellerPrice: '',
			order: null,
			recovering: false,
		});
		expect(view({ kind: 'sell' }, {}, '1.5')).toMatchObject({ formError: null, actionLabel: 'List for 1.5 AR' });
	});

	it('acts on the trimmed transfer recipient', () => {
		expect(view({ kind: 'transfer' }, {}, `  ${RECIPIENT} `)).toMatchObject({
			value: RECIPIENT,
			formError: null,
			result: { title: 'Transfer complete' },
		});
	});

	it('observes a signed action on its own confirmation lane', () => {
		const signed = view(
			{ kind: 'cancel', order: ORDER, resumeId: TRANSACTION },
			{
				phase: 'working',
				transaction: { id: TRANSACTION } as any,
				confirmations: 3,
				consensus: { confirmations: 3 } as any,
			}
		);
		expect(signed.steps).toEqual([
			{
				key: 'cancel',
				label: 'Cancel listing',
				target: 5,
				terminal: true,
				confirmations: 3,
				transaction: { id: TRANSACTION, views: [], consensus: { confirmations: 3 } },
			},
		]);
		expect(signed).toMatchObject({
			activeStep: 'cancel',
			confirmationTarget: 5,
			activityConfirmations: 3,
			recoverable: true,
			resumable: true,
			recovering: true,
			sellerPrice: '1 AR',
			reportedStatus: 'Watching Arweave confirmations…',
		});
	});

	it('follows a purchase from reservation to payment', () => {
		const reserving = view({ kind: 'buy', order: ORDER }, { phase: 'working', purchaseState: purchaseState() });
		expect(reserving.purchaseSteps.map((step) => step.key)).toEqual(['register', 'pay']);
		expect(reserving).toMatchObject({ activeStep: 'register', confirmationTarget: 5, activityConfirmations: 3 });

		const paying = view(
			{ kind: 'buy', order: ORDER },
			{
				phase: 'working',
				purchaseState: purchaseState({
					stage: 'ownership-verifying',
					payment: { id: PAYMENT, dispatched: true, views: [], consensus: { confirmations: 2 } } as any,
				}),
			}
		);
		expect(paying).toMatchObject({
			activeStep: 'pay',
			confirmationTarget: 1,
			activityConfirmations: 1,
			pendingAfterConfirmation: 'Checking ownership',
			paymentConfirmations: 2,
		});
	});

	it('presents an unfinished purchase as a failure after the attempt ends', () => {
		const failed = view(
			{ kind: 'buy', order: ORDER },
			{
				phase: 'done',
				purchaseState: purchaseState({
					stage: 'failed',
					error: { code: 'asset-order-reservation-expired', message: '' },
				} as Partial<PurchaseState>),
			}
		);
		expect(failed).toMatchObject({
			phase: 'error',
			terminalReservationFailure: true,
			resumable: false,
			failureStage: 'Reservation confirmation or acceptance',
		});
		expect(failed.purchaseFailure?.reason).toBe('asset-order-reservation-expired');
		expect(failed.reportedStatus).toBe(failed.message);
	});

	it('asks for the approvals a saved purchase still needs', () => {
		const approval = view({
			kind: 'buy',
			order: ORDER,
			externalOrigin: true,
			resume: { registration: { id: REGISTRATION, dispatched: true } },
		});
		expect(approval).toMatchObject({
			phase: 'approval',
			recoveryApprovalCount: 1,
			recovering: true,
			recoverable: true,
			reportedStatus: 'Waiting for wallet approval',
		});
		expect(approval.recoveryApprovalCopy?.detail).toContain('Close the other Bazar tab');
		expect(view({ kind: 'sell' })).toMatchObject({ recoveryApprovalCount: 0, recoveryApprovalCopy: null });
	});

	it('prefers the flow message over purchase lifecycle status', () => {
		expect(view({ kind: 'sell' }, { phase: 'error', message: 'Failed' })).toMatchObject({
			message: 'Failed',
			reportedStatus: 'Failed',
		});
		expect(view({ kind: 'sell' }, { phase: 'error' }).reportedStatus).toBe('This transaction needs attention');
		expect(view({ kind: 'sell' }, { phase: 'done' }, '2').reportedStatus).toBe('Listing is live');
	});

	it('only exposes the purchase lanes once signed work exists', () => {
		expect(atomicPurchaseSyncSteps(null)).toEqual([]);
		expect(atomicPurchaseSyncSteps(purchaseState({ registration: undefined }))).toEqual([]);
		expect(atomicPurchaseSyncSteps(purchaseState())).toHaveLength(2);
	});
});

describe('purchase quote view', () => {
	const quote: PurchaseQuote = {
		estimate: {
			asking: '1000000000000',
			total: '1200000000000',
			registrationFee: '0',
			registrationNetworkReward: '0',
			paymentNetworkReward: '0',
		},
		balance: 5_000_000_000_000n,
	};

	it('checks before a quote exists', () => {
		expect(purchaseQuoteView(IDLE)).toEqual({ status: 'checking', affordable: null });
		expect(purchaseQuoteView(LOADING)).toEqual({ status: 'checking', affordable: null });
	});

	it('shows the exact fees, total, and remaining balance', () => {
		expect(purchaseQuoteView({ status: 'success', data: quote })).toEqual({
			status: 'ready',
			affordable: true,
			networkFees: '0.2 AR',
			maximumTotal: '1.2 AR',
			walletAfterPurchase: '3.8 AR',
		});
		expect(purchaseQuoteView({ status: 'refreshing', data: quote }).status).toBe('ready');
	});

	it('blocks a purchase the wallet cannot afford, including the exact boundary', () => {
		expect(purchaseQuoteView({ status: 'success', data: { ...quote, balance: 1_199_999_999_999n } })).toMatchObject(
			{ affordable: false, walletAfterPurchase: null }
		);
		expect(purchaseQuoteView({ status: 'success', data: { ...quote, balance: 1_200_000_000_000n } })).toMatchObject(
			{ affordable: true, walletAfterPurchase: '0 AR' }
		);
	});

	it('keeps totals above the safe integer range exact', () => {
		const large = { ...quote.estimate, asking: '9007199254740993000', total: '9007199254740993001' };
		expect(
			purchaseQuoteView({ status: 'success', data: { estimate: large, balance: 9_007_199_254_740_993_002n } })
		).toMatchObject({ maximumTotal: '9,007,199.254740993001 AR', walletAfterPurchase: '0.000000000001 AR' });
	});

	it('reports an unavailable quote even when an earlier one is known', () => {
		expect(purchaseQuoteView({ status: 'error', error: appError('unknown') })).toEqual({
			status: 'unavailable',
			affordable: null,
		});
		expect(purchaseQuoteView({ status: 'stale', data: quote, error: appError('unknown') }).status).toBe(
			'unavailable'
		);
	});
});
