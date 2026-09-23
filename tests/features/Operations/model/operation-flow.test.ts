import { describe, expect, it } from 'vitest';

import type { Operation } from 'api/operations';
import type { PurchaseState } from 'api/transactions';

import { OPERATIONS_MESSAGES } from 'features/Operations/messages';
import {
	ATOMIC_ACTION_CONFIRMATION_TARGET,
	initialOperationFlowState,
	initialOperationPhase,
	type OperationFlowEvent,
	operationFlowReducer,
	type OperationFlowState,
	operationResumesAutomatically,
} from 'features/Operations/model/operation-flow';
import { appError, appErrorReasonMessage } from 'helpers/app-error';
import { APP_ERROR_MESSAGES } from 'helpers/app-error.messages';

const messages = OPERATIONS_MESSAGES.en;

const OWNER = 'O'.repeat(43);
const REGISTRATION = 'G'.repeat(43);
const PAYMENT = 'P'.repeat(43);
const TRANSACTION = 'T'.repeat(43);
const ORDER = { orderId: 'D'.repeat(43), creator: 'S'.repeat(43), asking: '100', quantity: '1', status: 'open' } as any;

function purchaseState(overrides: Partial<PurchaseState> = {}): PurchaseState {
	return {
		stage: 'payment-propagating',
		txId: PAYMENT,
		code: 'payment-propagating',
		canSkip: false,
		canDismiss: false,
		success: false,
		backgroundable: true,
		dismissed: false,
		registration: { id: REGISTRATION, dispatched: true, views: [] },
		payment: { id: PAYMENT, dispatched: true, views: [] },
		updatedAt: 1,
		...overrides,
	} as PurchaseState;
}

function state(overrides: Partial<OperationFlowState> = {}): OperationFlowState {
	return { ...initialOperationFlowState({ kind: 'sell' }), ...overrides };
}

function reduce(initial: OperationFlowState, ...events: OperationFlowEvent[]) {
	return events.reduce(
		(state, event) => operationFlowReducer(state, event, messages, APP_ERROR_MESSAGES.en),
		initial
	);
}

describe('atomic operation initial stage', () => {
	it.each<[string, Operation, string]>([
		['new listing', { kind: 'sell' }, 'form'],
		['saved listing', { kind: 'sell', resumeId: TRANSACTION }, 'working'],
		['saved transfer', { kind: 'transfer', resumeId: TRANSACTION, startingSlot: 3 }, 'working'],
		['new cancellation', { kind: 'cancel', order: ORDER }, 'form'],
		['new purchase', { kind: 'buy', order: ORDER }, 'form'],
		[
			'purchase with a signed payment',
			{
				kind: 'buy',
				order: ORDER,
				resume: {
					registration: { id: REGISTRATION, dispatched: true },
					payment: { id: PAYMENT, dispatched: false },
				},
			},
			'working',
		],
		[
			'purchase needing the seller payment',
			{ kind: 'buy', order: ORDER, resume: { registration: { id: REGISTRATION, dispatched: true } } },
			'approval',
		],
		['purchase with unusable signatures', { kind: 'buy', order: ORDER, resume: {} }, 'approval'],
	])('opens a %s in the %s stage', (_label, operation, phase) => {
		expect(initialOperationPhase(operation)).toBe(phase);
		expect(initialOperationFlowState(operation)).toEqual({
			phase,
			message: '',
			failureKind: null,
			transaction: null,
			purchaseState: null,
			views: [],
			confirmations: 0,
			consensus: null,
		});
	});

	it('resumes only saved work that needs no new wallet approval', () => {
		expect(operationResumesAutomatically({ kind: 'sell' })).toBe(false);
		expect(operationResumesAutomatically({ kind: 'cancel', order: ORDER, resumeId: TRANSACTION })).toBe(true);
		expect(
			operationResumesAutomatically({
				kind: 'buy',
				order: ORDER,
				resume: { registration: { id: REGISTRATION, dispatched: true } },
			})
		).toBe(false);
		expect(
			operationResumesAutomatically({
				kind: 'buy',
				order: ORDER,
				resume: {
					registration: { id: REGISTRATION, dispatched: true },
					payment: { id: PAYMENT, dispatched: true },
				},
			})
		).toBe(true);
	});
});

describe('atomic operation state machine', () => {
	it('reports invalid details without leaving the current stage', () => {
		const next = reduce(state(), { type: 'validation-failed', reason: 'listing-price-required' });
		expect(next.phase).toBe('form');
		expect(next.message).toBe(appErrorReasonMessage(APP_ERROR_MESSAGES.en, 'listing-price-required'));
	});

	it('clears earlier failures when an attempt starts', () => {
		const next = reduce(state({ phase: 'error', message: 'Failed', failureKind: 'other' }), { type: 'submitted' });
		expect(next).toMatchObject({ phase: 'working', message: '', failureKind: null });
	});

	it('tracks a signed action through confirmation to completion', () => {
		const transaction = { id: TRANSACTION } as any;
		const view = { observer: { label: 'alpha' } } as any;
		const consensus = { state: 'confirming', confirmations: 2 } as any;
		const working = reduce(
			state(),
			{ type: 'submitted' },
			{ type: 'transaction-prepared', transaction },
			{ type: 'confirmation-started' },
			{ type: 'views-observed', views: [view] },
			{ type: 'consensus-observed', consensus },
			{ type: 'confirmations-observed', confirmations: 2 }
		);
		expect(working).toMatchObject({ phase: 'working', transaction, views: [view], consensus, confirmations: 2 });

		const confirmed = reduce(working, { type: 'confirmation-target-reached' });
		expect(confirmed.confirmations).toBe(ATOMIC_ACTION_CONFIRMATION_TARGET);
		expect(confirmed.message).toContain('Five confirmations reached');
		expect(reduce(confirmed, { type: 'completed' }).phase).toBe('done');
	});

	it('restarts observation counters for a resumed transaction', () => {
		const next = reduce(state({ views: [{} as any], confirmations: 4, consensus: {} as any }), {
			type: 'confirmation-started',
		});
		expect(next).toMatchObject({ views: [], confirmations: 0, consensus: null });
	});

	it('forgets a transaction that could not be saved for recovery', () => {
		const next = reduce(state({ transaction: { id: TRANSACTION } as any }), { type: 'transaction-discarded' });
		expect(next.transaction).toBeNull();
	});

	it('classifies failures and discards refused signatures', () => {
		const transaction = { id: TRANSACTION } as any;
		const working = state({ phase: 'working', transaction });
		const refused = reduce(working, {
			type: 'failed',
			error: appError('fungible-transfer-rejected'),
			signer: OWNER,
			discardTransaction: true,
		});
		expect(refused).toMatchObject({ phase: 'error', transaction: null, failureKind: 'transaction-rejected' });
		expect(refused.message).toBe(appErrorReasonMessage(APP_ERROR_MESSAGES.en, 'fungible-transfer-rejected'));

		const kept = reduce(working, {
			type: 'failed',
			error: appError('market-state-changed'),
			signer: OWNER,
			discardTransaction: false,
		});
		expect(kept).toMatchObject({ phase: 'error', transaction, failureKind: 'market-state-changed' });
	});

	it('names the pending listing that blocked signing', () => {
		const next = reduce(state({ phase: 'working' }), {
			type: 'failed',
			error: appError('asset-listing-pending-self', { detail: { transactionId: TRANSACTION, actor: OWNER } }),
			signer: OWNER,
			discardTransaction: false,
		});
		expect(next.message).toContain('You already submitted listing transaction');
	});

	it('ignores completion and failure reports outside a running attempt', () => {
		for (const phase of ['form', 'approval', 'done', 'error'] as const) {
			const current = state({ phase, message: 'Kept' });
			expect(operationFlowReducer(current, { type: 'completed' }, messages, APP_ERROR_MESSAGES.en)).toBe(current);
			expect(
				operationFlowReducer(
					current,
					{
						type: 'failed',
						error: appError('unknown'),
						signer: OWNER,
						discardTransaction: true,
					},
					messages,
					APP_ERROR_MESSAGES.en
				)
			).toBe(current);
		}
	});

	it('only leaves a finished attempt for the form', () => {
		const running = state({ phase: 'working', purchaseState: purchaseState() });
		expect(operationFlowReducer(running, { type: 'returned-to-form' }, messages, APP_ERROR_MESSAGES.en)).toBe(
			running
		);
		expect(operationFlowReducer(running, { type: 'purchase-reset' }, messages, APP_ERROR_MESSAGES.en)).toBe(
			running
		);

		const failed = state({
			phase: 'error',
			message: 'Failed',
			failureKind: 'other',
			purchaseState: purchaseState(),
		});
		expect(reduce(failed, { type: 'returned-to-form' })).toMatchObject({
			phase: 'form',
			message: '',
			failureKind: null,
			purchaseState: failed.purchaseState,
		});
		expect(reduce(failed, { type: 'purchase-reset' })).toMatchObject({
			phase: 'form',
			message: '',
			failureKind: null,
			purchaseState: null,
		});
	});

	it('ignores unknown events', () => {
		const current = state();
		expect(
			operationFlowReducer(
				current,
				{ type: 'unknown' } as unknown as OperationFlowEvent,
				messages,
				APP_ERROR_MESSAGES.en
			)
		).toBe(current);
	});
});

describe('atomic purchase observation', () => {
	it('schedules and announces a check of an unobserved seller payment', () => {
		const unobserved = purchaseState({
			stage: 'failed',
			success: true,
			error: { code: 'payment-not-found', message: 'payment not found' },
		} as Partial<PurchaseState>);
		const scheduled = reduce(state({ phase: 'working', failureKind: 'other' }), {
			type: 'purchase-observation-retry-scheduled',
			purchaseState: unobserved,
			delayMs: 4_000,
		});
		expect(scheduled.failureKind).toBeNull();
		expect(scheduled.message).toContain('check it again automatically in 4 seconds');
		expect(scheduled.purchaseState).toMatchObject({ stage: 'payment-propagating', canSkip: false });
		expect(scheduled.purchaseState?.error).toBeUndefined();

		const checking = reduce(scheduled, { type: 'purchase-observation-retry-started', kind: 'payment' });
		expect(checking.message).toContain('Checking the exact submitted seller payment again');
	});

	it('keeps the dispatched reservation after a rejected seller payment', () => {
		const rejected = purchaseState({ stage: 'failed' });
		const next = reduce(state({ phase: 'working' }), {
			type: 'purchase-payment-discarded',
			purchaseState: rejected,
		});
		expect(next.purchaseState?.registration?.id).toBe(REGISTRATION);
		expect(next.purchaseState?.payment).toBeUndefined();
	});

	it('merges later payment confirmations only for the same payment', () => {
		const complete = state({ phase: 'done', purchaseState: purchaseState({ stage: 'complete', success: true }) });
		const observation = { consensus: { state: 'confirmed', confirmations: 3 } as any, views: [] };
		const next = reduce(complete, { type: 'payment-observed', paymentId: PAYMENT, observation });
		expect(next.purchaseState?.payment?.consensus).toEqual(observation.consensus);

		expect(
			operationFlowReducer(
				complete,
				{ type: 'payment-observed', paymentId: 'X'.repeat(43), observation },
				messages,
				APP_ERROR_MESSAGES.en
			)
		).toBe(complete);
		const empty = state({ phase: 'done' });
		expect(
			operationFlowReducer(
				empty,
				{ type: 'payment-observed', paymentId: PAYMENT, observation },
				messages,
				APP_ERROR_MESSAGES.en
			)
		).toBe(empty);
	});

	it('records every purchase lifecycle update', () => {
		const update = purchaseState({ stage: 'payment-confirming' });
		expect(
			reduce(state({ phase: 'working' }), { type: 'purchase-progressed', purchaseState: update })
		).toMatchObject({ purchaseState: update });
	});
});
