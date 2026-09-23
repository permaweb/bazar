import { describe, expect, it } from 'vitest';

import type { PreparedTransaction, PurchaseState } from 'api/transactions';

import type { BatchEntry, FungibleOperation } from 'features/AssetDetail/model/fungible-operation';
import {
	createFungibleOperationFlowState,
	type FungibleOperationFlowEvent,
	fungibleOperationFlowReducer,
	initialFungibleOperationPhase,
} from 'features/AssetDetail/model/fungible-operation-flow';
import { appError } from 'helpers/app-error';

const BUYER = 'b'.repeat(43);
const REGISTRATION = 'r'.repeat(43);
const PAYMENT = 'p'.repeat(43);

const transaction = { id: 't'.repeat(43), dispatch: async () => undefined } as unknown as PreparedTransaction;

function entry(snapshot: BatchEntry['snapshot']): BatchEntry {
	return {
		order: { orderId: 'o'.repeat(43), quantity: '10', asking: '20' } as BatchEntry['order'],
		fillQuantity: '10',
		paymentCost: '5',
		snapshot,
	};
}

function resumeOperation(snapshot: BatchEntry['snapshot']): FungibleOperation {
	return {
		kind: 'buy',
		availableOrders: [],
		startingBalance: '0',
		resume: { version: 3, buyer: BUYER, startingBalance: '0', entries: [entry(snapshot)] },
	};
}

function reduce(operation: FungibleOperation, events: FungibleOperationFlowEvent[]) {
	return events.reduce(fungibleOperationFlowReducer, createFungibleOperationFlowState(operation));
}

describe('fungible operation phases', () => {
	it('opens a fresh operation in its form and a saved signed action in progress', () => {
		expect(initialFungibleOperationPhase({ kind: 'sell' })).toBe('form');
		expect(initialFungibleOperationPhase({ kind: 'sell', resumeId: 't'.repeat(43) })).toBe('working');
		expect(initialFungibleOperationPhase({ kind: 'buy', availableOrders: [], startingBalance: '0' })).toBe('form');
	});

	it('asks for the missing approvals before resuming a partially signed purchase', () => {
		expect(
			initialFungibleOperationPhase(resumeOperation({ registration: { id: REGISTRATION, dispatched: true } }))
		).toBe('approval');
		expect(
			initialFungibleOperationPhase(
				resumeOperation({
					registration: { id: REGISTRATION, dispatched: true },
					payment: { id: PAYMENT, dispatched: false },
				})
			)
		).toBe('working');
	});
});

describe('fungible operation flow reducer', () => {
	it('clears the previous failure when a retry starts working', () => {
		const failed = reduce({ kind: 'sell' }, [
			{ type: 'submitted' },
			{ type: 'failed', failure: appError('unknown'), message: 'Broken', discardTransaction: false },
		]);
		expect(failed.phase).toBe('error');
		expect(failed.message).toBe('Broken');

		const retried = fungibleOperationFlowReducer(failed, { type: 'submitted' });
		expect(retried).toMatchObject({ phase: 'working', message: '', failure: null });
	});

	it('keeps dispatch progress and resets it for the next dispatch', () => {
		const dispatched = reduce({ kind: 'cancel', order: entry({}).order }, [
			{ type: 'submitted' },
			{ type: 'transaction-prepared', transaction },
			{ type: 'dispatch-started' },
			{ type: 'observer-views', views: [{ observer: { url: 'https://a' } }] as never },
			{ type: 'confirmations', confirmations: 3 },
			{ type: 'consensus', consensus: { confirmations: 3 } as never },
		]);
		expect(dispatched).toMatchObject({ confirmations: 3, transaction });
		expect(dispatched.views).toHaveLength(1);

		const restarted = fungibleOperationFlowReducer(dispatched, { type: 'dispatch-started' });
		expect(restarted).toMatchObject({ confirmations: 0, consensus: null, views: [] });
		expect(restarted.transaction).toBe(transaction);
	});

	it('discards the signed transaction only when the failure proves nothing was submitted', () => {
		const prepared = reduce({ kind: 'transfer' }, [
			{ type: 'submitted' },
			{ type: 'transaction-prepared', transaction },
		]);
		expect(
			fungibleOperationFlowReducer(prepared, {
				type: 'failed',
				failure: appError('fungible-transfer-rejected'),
				message: 'Rejected',
				discardTransaction: true,
			}).transaction
		).toBeNull();
		expect(
			fungibleOperationFlowReducer(prepared, {
				type: 'failed',
				failure: appError('unknown'),
				message: 'Unknown',
				discardTransaction: false,
			}).transaction
		).toBe(transaction);
	});

	it('replaces a failure with the concrete observation retry message', () => {
		const retrying = reduce({ kind: 'buy', availableOrders: [], startingBalance: '0' }, [
			{ type: 'submitted' },
			{ type: 'failed', failure: appError('unknown'), message: 'Broken', discardTransaction: false },
			{ type: 'submitted' },
			{ type: 'observation-retry', message: 'Rechecking in 5 seconds.' },
		]);
		expect(retrying).toMatchObject({ phase: 'working', failure: null, message: 'Rechecking in 5 seconds.' });
	});

	it('ignores outcomes that no longer belong to the current phase', () => {
		const form = createFungibleOperationFlowState({ kind: 'sell' });
		expect(fungibleOperationFlowReducer(form, { type: 'completed' })).toBe(form);
		expect(
			fungibleOperationFlowReducer(form, {
				type: 'failed',
				failure: appError('unknown'),
				message: 'Late',
				discardTransaction: false,
			})
		).toBe(form);
		expect(fungibleOperationFlowReducer(form, { type: 'form-reopened' })).toBe(form);
		expect(fungibleOperationFlowReducer(form, { type: 'transaction-discarded' })).toBe(form);

		const done = reduce({ kind: 'sell' }, [{ type: 'submitted' }, { type: 'completed' }]);
		expect(done.phase).toBe('done');
		expect(fungibleOperationFlowReducer(done, { type: 'submitted' })).toBe(done);
	});

	it('merges purchase state updates without losing sibling lots', () => {
		const first = { stage: 'registration-confirming' } as PurchaseState;
		const second = { stage: 'payment-confirming' } as PurchaseState;
		const merged = reduce({ kind: 'buy', availableOrders: [], startingBalance: '0' }, [
			{ type: 'purchase-states', updates: { a: first, b: first } },
			{ type: 'purchase-states', updates: { b: second } },
		]);
		expect(merged.purchaseStates).toEqual({ a: first, b: second });
	});

	it('applies continuing payment observations only to the matching lot', () => {
		const paid = {
			stage: 'complete',
			payment: { id: PAYMENT, dispatched: true, views: [], consensus: { state: 'confirmed', confirmations: 3 } },
		} as unknown as PurchaseState;
		const state = reduce({ kind: 'buy', availableOrders: [], startingBalance: '0' }, [
			{ type: 'purchase-states', updates: { a: paid } },
		]);

		const observed = fungibleOperationFlowReducer(state, {
			type: 'payment-observed',
			orderId: 'a',
			paymentId: PAYMENT,
			observation: { views: [], consensus: { state: 'confirmed', confirmations: 9 } } as never,
		});
		expect(observed.purchaseStates.a.payment?.consensus.confirmations).toBe(9);

		const unrelated = fungibleOperationFlowReducer(state, {
			type: 'payment-observed',
			orderId: 'a',
			paymentId: 'z'.repeat(43),
			observation: { views: [], consensus: { state: 'confirmed', confirmations: 12 } } as never,
		});
		expect(unrelated.purchaseStates.a.payment?.consensus.confirmations).toBe(3);
	});
});
