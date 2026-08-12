import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PurchaseSnapshot, PurchaseState } from 'weave-wrangler';

import type { CollectionActivityEvent } from 'api/asset-discovery';
import type { AssetState, SwapOrder } from 'api/asset-marketplace';
import { filledOrder } from 'api/order-matching';

import {
	appendFungibleOperationActivity,
	batchHasNoDispatchedSellerPayment,
	batchPaymentBarrierState,
	batchPurchaseRecoveryApprovalCopy,
	batchPurchaseRecoveryApprovalCount,
	batchPurchaseStartingBalance,
	batchRecoveryFrameBuffer,
	batchRecoveryIdentity,
	batchSettlementSummary,
	batchStageLabel,
	checkpointBatchPreparation,
	fungibleActivityAmount,
	fungibleAskHistory,
	fungibleBatchRecoveryStatus,
	fungibleHolders,
	fungibleListingAccessibleLabel,
	FungibleListingComposer,
	type FungibleOperationActivity,
	FungibleOperationErrorAlert,
	fungibleOperationStateError,
	fungibleOrderActionLabel,
	FungiblePurchaseComposer,
	FungiblePurchaseReceiptNavigator,
	fungiblePurchaseReceiptOptions,
	FungiblePurchaseSequence,
	fungiblePurchaseSequence,
	FungibleSettlementRecoveryPanel,
	fungibleTransferRecipientError,
	fungibleTransferSubmitLabel,
	isRecoverableBatch,
	latestRecoverableSnapshot,
	MatchedListingsReview,
	nextSettlementAnnouncement,
	purchaseAmountMatch,
	purchaseFailureMessageNeedsManualReview,
	purchaseQuoteIdentity,
	PurchaseRoute,
	purchaseSettlementNeedsManualReview,
	purchaseStateFrameBuffer,
	restartFungibleOperationActivity,
	settlementTabIndex,
	storeBatchRecoveryBeforeDispatch,
	visibleOrderbookRows,
	waitForSettlementBatch,
} from './FungibleAssetView';

const BUYER = 'b'.repeat(43);
const ORDER_ID = 'o'.repeat(43);
const REGISTRATION_ID = 'r'.repeat(43);
const PAYMENT_ID = 'p'.repeat(43);

describe('fungible ask history', () => {
	it('converts atomic lot quantities into whole-token unit prices', () => {
		const points = fungibleAskHistory(
			[
				{
					id: 'newer',
					processId: 'token',
					action: 'make-offer',
					actor: BUYER,
					height: 2,
					timestamp: 20,
					asking: '2500000000000',
					quantity: '1000',
				},
				{
					id: 'older',
					processId: 'token',
					action: 'make-offer',
					actor: BUYER,
					height: 1,
					timestamp: 10,
					asking: '1000000000000',
					quantity: '2000',
				},
			],
			3
		);

		expect(points).toEqual([
			{ id: 'older', timestamp: 10, value: '500000000000' },
			{ id: 'newer', timestamp: 20, value: '2500000000000' },
		]);
	});

	it('ignores transfers and malformed or zero-value asks', () => {
		const base = { processId: 'token', actor: BUYER, height: 1, timestamp: 1 };
		expect(
			fungibleAskHistory(
				[
					{ ...base, id: 'transfer', action: 'transfer', quantity: '1000' },
					{ ...base, id: 'bad', action: 'make-offer', asking: 'nope', quantity: '1000' },
					{ ...base, id: 'zero', action: 'make-offer', asking: '1', quantity: '0' },
				],
				3
			)
		).toEqual([]);
	});
});

function purchaseOrder(orderId: string, creator: string, quantity: string, asking: string): SwapOrder {
	return {
		asking,
		createdAt: 1,
		creator,
		deadline: 100,
		deposit: '0',
		minimumFee: '0',
		orderId,
		quantity,
		recipient: creator,
		status: 'open',
	};
}

describe('fungible holders', () => {
	it('combines liquid and listed balances and sorts holders by total ownership', () => {
		const largest = 'a'.repeat(43);
		const listedOnly = 'b'.repeat(43);
		const liquidOnly = 'c'.repeat(43);
		const open = purchaseOrder('d'.repeat(43), listedOnly, '300', '1');
		const reserved = {
			...purchaseOrder('e'.repeat(43), listedOnly, '200', '1'),
			status: 'reserved',
		} as SwapOrder;
		const cancelled = {
			...purchaseOrder('f'.repeat(43), liquidOnly, '900', '1'),
			status: 'cancelled',
		} as SwapOrder;
		const state = {
			device: 'token@1.0',
			name: 'Test token',
			ticker: 'TEST',
			denomination: 0,
			totalSupply: '1200',
			balances: {
				[largest]: '700',
				[listedOnly]: '0',
				[liquidOnly]: '500',
				invalid: '1000',
			},
			orders: {
				[open.orderId]: open,
				[reserved.orderId]: reserved,
				[cancelled.orderId]: cancelled,
			},
			swapHeight: 0,
			value: null,
			raw: {},
		} satisfies AssetState;

		expect(fungibleHolders(state)).toEqual([
			{ address: largest, liquid: '700', listed: '0', total: '700' },
			{ address: listedOnly, liquid: '0', listed: '500', total: '500' },
			{ address: liquidOnly, liquid: '500', listed: '0', total: '500' },
		]);
	});
});

describe('fungible operation error semantics', () => {
	it('shows the gated transaction sequence for a multi-listing purchase', () => {
		const registration = { stage: 'registration-confirming' } as PurchaseState;
		const payment = { stage: 'payment-confirming' } as PurchaseState;
		const steps = fungiblePurchaseSequence([payment, registration], 2);
		const sequence = renderToStaticMarkup(
			React.createElement(FungiblePurchaseSequence, {
				listingCount: 2,
				states: [payment, registration],
			})
		);

		expect(steps.map((step) => [step.key, step.state])).toEqual([
			['sign', 'done'],
			['reserve', 'active'],
			['pay', 'next'],
			['verify', 'next'],
		]);
		expect(sequence).toContain('Purchase transaction sequence');
		expect(sequence).not.toContain('Purchase sequence');
		expect(sequence).not.toContain('2 listings · 4 transactions');
		expect(sequence).not.toContain('Seller payments begin only after every reservation is accepted.');
		expect(sequence).not.toContain('2 wallet approvals');
		expect(sequence).not.toContain('0/2 accepted');
		expect(sequence).not.toContain('0/2 confirmed');
		expect(sequence).not.toContain('0/2 verified');
	});

	it('keeps payment and receipt verification as separate visible stages', () => {
		const verifying = { stage: 'ownership-verifying' } as PurchaseState;
		const complete = { stage: 'complete' } as PurchaseState;

		expect(fungiblePurchaseSequence([verifying], 1).map((step) => step.state)).toEqual([
			'done',
			'done',
			'done',
			'active',
		]);
		expect(fungiblePurchaseSequence([complete], 1).every((step) => step.state === 'done')).toBe(true);
	});

	it('keeps a running purchase when a separate listing form opens', () => {
		const purchase = {
			id: 'purchase',
			operation: { kind: 'buy', availableOrders: [] as SwapOrder[], startingBalance: '0' } as const,
			phase: 'working' as const,
			signer: BUYER,
			visible: true,
		};
		const listing = {
			id: 'listing',
			operation: { kind: 'sell' } as const,
			phase: null,
			signer: BUYER,
			visible: true,
		};
		const activities = appendFungibleOperationActivity([purchase], listing);

		expect(activities.map((activity) => activity.operation.kind)).toEqual(['buy', 'sell']);
		expect(activities.map((activity) => activity.visible)).toEqual([false, true]);
	});

	it('restarts a recoverable settlement as a visible fresh dialog instance', () => {
		const failed: FungibleOperationActivity = {
			id: 'purchase',
			operation: {
				kind: 'buy',
				availableOrders: [] as SwapOrder[],
				startingBalance: '0',
				resume: { version: 3, buyer: BUYER, startingBalance: '0', entries: [] },
			},
			phase: 'error',
			signer: BUYER,
			visible: true,
			createdAt: 100,
		};

		expect(restartFungibleOperationActivity(failed, 100)).toMatchObject({
			id: 'purchase',
			operation: failed.operation,
			phase: null,
			visible: true,
			createdAt: 101,
		});
	});

	it('does not present a process-rejected payment as resumable observation', () => {
		expect(
			purchaseSettlementNeedsManualReview({
				stage: 'failed',
				error: { code: 'asset-purchase-rejected', message: 'asset purchase rejected' },
			} as PurchaseState)
		).toBe(true);
		expect(
			purchaseSettlementNeedsManualReview({
				stage: 'failed',
				error: { code: 'asset-payment-observer-timeout', message: 'asset purchase rejected' },
			} as PurchaseState)
		).toBe(true);
		expect(
			purchaseSettlementNeedsManualReview({
				stage: 'failed',
				error: { code: 'asset-payment-observer-timeout', message: 'observer timeout' },
			} as PurchaseState)
		).toBe(false);
	});

	it('recognizes a terminal failure reported only by the batch summary', () => {
		expect(
			purchaseFailureMessageNeedsManualReview('1 of 1 settlements need attention. asset purchase rejected')
		).toBe(true);
		expect(
			purchaseFailureMessageNeedsManualReview(
				'1 of 1 settlements need attention. observer timed out while checking transaction'
			)
		).toBe(false);
	});

	it('quotes a requested token amount from automatic partial fills', () => {
		const orders = [
			purchaseOrder('1'.repeat(43), 'a'.repeat(43), '2', '2'),
			purchaseOrder('2'.repeat(43), 'b'.repeat(43), '5', '10'),
		];
		const state = { denomination: 0, ticker: 'WEAVE' } as AssetState;
		const quote = purchaseAmountMatch(orders, '4', state);
		const composer = renderToStaticMarkup(
			React.createElement(FungiblePurchaseComposer, {
				availableQuantity: '7',
				excludedQuantity: '2',
				error: quote.error,
				match: quote.match,
				onChange: () => undefined,
				onMax: () => undefined,
				quantity: '4',
				state,
			})
		);

		expect(quote.match?.fills.map((fill) => [fill.order.quantity, fill.partial])).toEqual([
			['2', false],
			['2', true],
		]);
		expect(composer).toContain('You buy');
		expect(composer).toContain('value="4"');
		expect(composer).toContain('$WEAVE');
		expect(composer).toContain('You pay');
		expect(composer).toContain('0.000000000006');
		expect(composer).toContain('2 orders · 2 sellers · network fees shown in review');
		expect(composer).not.toContain('type="range"');
	});

	it('rejects an amount beyond the available partial-fill liquidity', () => {
		const state = { denomination: 0, ticker: 'WEAVE' } as AssetState;
		const quote = purchaseAmountMatch([purchaseOrder('1'.repeat(43), 'a'.repeat(43), '2', '2')], '3', state);
		expect(quote.match).toBeNull();
		expect(quote.error).toBe('Only 2 $WEAVE is currently available.');
	});

	it('presents listing quantity and unit price as one connected composer', () => {
		const composer = renderToStaticMarkup(
			React.createElement(FungibleListingComposer, {
				availableQuantity: '48',
				onMax: () => undefined,
				onQuantityChange: () => undefined,
				onUnitPriceChange: () => undefined,
				quantity: '12',
				quantityError: '',
				state: { denomination: 0, ticker: 'MINTA' } as AssetState,
				total: '0.00024',
				unitPrice: '0.00002',
				unitPriceError: '',
			})
		);

		expect(composer).toContain('Create listing');
		expect(composer).toContain('You list');
		expect(composer).toContain('value="12"');
		expect(composer).toContain('Unit price');
		expect(composer).toContain('value="0.00002"');
		expect(composer).toContain('$MINTA');
		expect(composer).toContain('0.00024 <span class="ar-currency-label">');
		expect(composer).toContain('$AR</span> total');
	});

	it('counts only the new wallet approvals missing from a recovered batch', () => {
		expect(
			batchPurchaseRecoveryApprovalCount([
				{
					snapshot: {
						registration: { id: REGISTRATION_ID, dispatched: true },
						payment: { id: PAYMENT_ID, dispatched: false },
					},
				},
				{ snapshot: { registration: { id: REGISTRATION_ID, dispatched: true } } },
				{ snapshot: {} },
			])
		).toBe(3);
	});

	it('keeps a reload-safe checkpoint before and between batch approval prompts', () => {
		const order = purchaseOrder(ORDER_ID, 's'.repeat(43), '2', '4');
		let entries = checkpointBatchPreparation([], {
			type: 'quoted',
			entries: [{ order, fillQuantity: '2', paymentCost: '9' }],
		});
		expect(entries).toEqual([{ order, fillQuantity: '2', paymentCost: '9', snapshot: {} }]);

		entries = checkpointBatchPreparation(entries, {
			type: 'signed',
			kind: 'registration',
			orderId: ORDER_ID,
			transactionId: REGISTRATION_ID,
			cost: '1',
		});
		expect(entries[0].snapshot).toEqual({
			registration: { id: REGISTRATION_ID, dispatched: false },
		});

		entries = checkpointBatchPreparation(entries, {
			type: 'signed',
			kind: 'payment',
			orderId: ORDER_ID,
			transactionId: PAYMENT_ID,
			cost: '10',
		});
		expect(entries[0]).toMatchObject({
			paymentCost: '10',
			snapshot: {
				registration: { id: REGISTRATION_ID, dispatched: false },
				payment: { id: PAYMENT_ID, dispatched: false },
			},
		});
	});

	it('explains how much of a recovered batch will be reused', () => {
		expect(
			batchPurchaseRecoveryApprovalCopy([
				{
					snapshot: {
						registration: { id: REGISTRATION_ID, dispatched: true },
						payment: { id: PAYMENT_ID, dispatched: false },
					},
				},
				{ snapshot: { registration: { id: REGISTRATION_ID, dispatched: true } } },
			])
		).toEqual({
			title: '1 missing transaction approval needed to resume',
			detail: 'Bazar recovered 3 of 4 signed transactions and will reuse those exact transactions. Your wallet will be asked only for the 1 missing approval. No seller payment has been submitted. Signed seller payments remain held until every reservation is accepted. Nothing new will be signed or submitted until you choose Continue.',
			action: 'Approve 1 missing transaction and continue',
		});
	});

	it('bounds the initial order book without changing its complete market truth', () => {
		const orders = Array.from({ length: 5_000 }, (_, index) => ({ orderId: `order-${index}` }));
		expect(visibleOrderbookRows(orders, 50)).toEqual(orders.slice(0, 50));
		expect(visibleOrderbookRows(orders, 100)).toEqual(orders.slice(0, 100));
		expect(orders).toHaveLength(5_000);
	});

	it('keeps a 512-order completion bounded while every exact receipt remains selectable', () => {
		const orders = Array.from({ length: 512 }, (_, index) => ({
			asking: `${index + 1}`,
			creator: `${String(index).padStart(42, '0')}A`,
			orderId: `${String(index).padStart(42, '0')}O`,
			quantity: '1',
		})) as SwapOrder[];
		const purchaseStates = Object.fromEntries(
			orders.map((order, index) => [
				order.orderId,
				{
					registration: { id: `${String(index).padStart(42, '0')}R`, views: [] },
					payment: { id: `${String(index).padStart(42, '0')}P`, views: [] },
				},
			])
		) as unknown as Record<string, PurchaseState>;
		const receiptOptions = fungiblePurchaseReceiptOptions(orders, {
			denomination: 0,
			ticker: 'WEAVE',
		} as AssetState);
		expect(receiptOptions).toHaveLength(512);
		expect(receiptOptions[511]).toEqual({
			value: orders[511].orderId,
			label: `Listing 512 · 1 $WEAVE · ${orders[511].creator.slice(0, 6)}…${orders[511].creator.slice(-5)}`,
		});
		const receipt = renderToStaticMarkup(
			React.createElement(FungiblePurchaseReceiptNavigator, {
				activeOrderId: orders[511].orderId,
				onSelect: () => undefined,
				orders,
				purchaseStates,
				state: { denomination: 0, ticker: 'WEAVE' } as AssetState,
			})
		);
		expect(receipt.match(/<section/g)).toHaveLength(1);
		expect(receipt).toContain('class="market-select"');
		expect(receipt).not.toContain('<select');
		expect(receipt).toContain('Settlement receipt 512 of 512');
		expect(receipt).toContain(orders[511].creator);
		expect(receipt).toContain(purchaseStates[orders[511].orderId].registration?.id);
		expect(receipt).toContain(purchaseStates[orders[511].orderId].payment?.id);
		expect(receipt).not.toContain(orders[0].creator);
		const nextButton = receipt.match(/<button[^>]*>Next receipt<\/button>/)?.[0] ?? '';
		expect(nextButton).toContain('aria-disabled="true"');
		expect(nextButton).not.toMatch(/\sdisabled(?:=|\s|>)/);

		const firstReceipt = renderToStaticMarkup(
			React.createElement(FungiblePurchaseReceiptNavigator, {
				activeOrderId: orders[0].orderId,
				onSelect: () => undefined,
				orders: orders.slice(0, 2),
				purchaseStates,
				state: { denomination: 0, ticker: 'WEAVE' } as AssetState,
			})
		);
		const previousButton = firstReceipt.match(/<button[^>]*>Previous receipt<\/button>/)?.[0] ?? '';
		expect(previousButton).toContain('aria-disabled="true"');
		expect(previousButton).not.toMatch(/\sdisabled(?:=|\s|>)/);

		const singleReceipt = renderToStaticMarkup(
			React.createElement(FungiblePurchaseReceiptNavigator, {
				activeOrderId: orders[0].orderId,
				onSelect: () => undefined,
				orders: orders.slice(0, 1),
				purchaseStates,
				state: { denomination: 0, ticker: 'WEAVE' } as AssetState,
			})
		);
		expect(singleReceipt).toContain('settlement-receipt-navigation single');
		expect(singleReceipt).toContain('settlement-receipt-count');
		expect(singleReceipt).toContain('receipt-proof-links');
		expect(singleReceipt).not.toContain('class="market-select"');
	});

	it('makes every matched seller reachable through one bounded keyboard region', () => {
		const orders = Array.from({ length: 512 }, (_, index) => ({
			asking: '1',
			creator: `${String(index).padStart(42, '0')}A`,
			orderId: `${String(index).padStart(42, '0')}O`,
			quantity: '1',
		})) as SwapOrder[];
		const review = renderToStaticMarkup(
			React.createElement(PurchaseRoute, {
				fills: orders.map((order) => ({ sourceOrder: order, order, partial: false })),
				state: { denomination: 0, ticker: 'WEAVE' } as AssetState,
			})
		);
		expect(review).toContain('Purchase route');
		expect(review).toContain('512 orders');
		expect(review).toContain('aria-label="Purchase execution route"');
		expect(review.match(/tabindex="0"/g)).toHaveLength(1);
		expect(review).toContain(orders[511].creator);
	});

	it('renders checkout listings without tabs and exposes a remove action for each lot', () => {
		const orders = [
			{ orderId: '1'.repeat(43), creator: 'a'.repeat(43), quantity: '1', asking: '1000' },
			{ orderId: '2'.repeat(43), creator: 'b'.repeat(43), quantity: '2', asking: '2000' },
		] as SwapOrder[];
		const overview = renderToStaticMarkup(
			React.createElement(MatchedListingsReview, {
				onRemove: () => undefined,
				orders,
				state: { denomination: 0, ticker: 'WEAVE' } as AssetState,
			})
		);

		expect(overview).toContain('aria-label="Purchase overview"');
		expect(overview).not.toContain('role="tablist"');
		expect(overview).not.toContain('<details');
		expect(overview.match(/>Remove<\/button>/g)).toHaveLength(2);
	});

	it('keeps interactive settlement recovery outside the assertive alert summary', () => {
		const alert = renderToStaticMarkup(
			React.createElement(FungibleOperationErrorAlert, {
				message: 'One settlement needs attention.',
			})
		);
		expect(alert).toContain('role="alert"');
		expect(alert).not.toContain('role="tablist"');
		expect(alert).not.toContain('<button');
		expect(alert).toContain('One settlement needs attention.');
	});

	it('puts explanatory settlement recovery content in sequential focus order', () => {
		const panel = renderToStaticMarkup(
			React.createElement(
				FungibleSettlementRecoveryPanel,
				{ orderId: ORDER_ID },
				React.createElement('p', null, 'This incomplete listing can be continued with the same wallet.')
			)
		);
		expect(panel).toContain('role="tabpanel"');
		expect(panel).toContain('tabindex="0"');
		expect(panel).toContain(`aria-labelledby="settlement-error-tab-${ORDER_ID}"`);
		expect(panel).toContain('id="fungible-settlement-error-panel"');
		expect(panel).toContain('This incomplete listing can be continued with the same wallet.');
	});

	it('renders a settled recovery result with positive styling', () => {
		const panel = renderToStaticMarkup(
			React.createElement(
				FungibleSettlementRecoveryPanel,
				{ orderId: ORDER_ID, settled: true },
				React.createElement('p', null, 'This listing settled successfully.')
			)
		);
		expect(panel).toContain('settlement-success-detail');
		expect(panel).toContain('This listing settled successfully.');
	});
});

function recoveryBatch() {
	return {
		version: 3 as const,
		buyer: BUYER,
		startingBalance: '0',
		entries: [
			{
				order: {
					orderId: ORDER_ID,
					creator: 's'.repeat(43),
					recipient: 's'.repeat(43),
					quantity: '1000',
					asking: '2000',
					minimumFee: '100',
					deposit: '100',
					deadline: 200,
					createdAt: 100,
					status: 'open',
				} as SwapOrder,
				fillQuantity: '400',
				snapshot: { registration: { id: REGISTRATION_ID, dispatched: false } },
				paymentCost: '100',
			},
		],
	};
}

describe('fungible batch payment coordination', () => {
	it('coalesces a 512-lot observer wave into one visual state commit', () => {
		const frames: Array<() => void> = [];
		const commits: Array<Record<string, PurchaseState>> = [];
		const buffer = purchaseStateFrameBuffer(
			(updates) => commits.push(updates),
			(callback) => {
				frames.push(callback);
				return frames.length;
			},
			() => undefined
		);
		for (let index = 0; index < 512; index += 1) {
			buffer.push(`order-${index}`, { stage: 'registration-confirming', updatedAt: index } as PurchaseState);
		}
		buffer.push('order-511', { stage: 'payment-confirming', updatedAt: 513 } as PurchaseState);

		expect(frames).toHaveLength(1);
		expect(commits).toHaveLength(0);
		frames[0]();
		expect(commits).toHaveLength(1);
		expect(Object.keys(commits[0])).toHaveLength(512);
		expect(commits[0]['order-511']).toMatchObject({ stage: 'payment-confirming', updatedAt: 513 });
	});

	it('flushes a terminal settlement state before its scheduled frame', () => {
		const frames: Array<() => void> = [];
		const cancelled: number[] = [];
		const commits: Array<Record<string, PurchaseState>> = [];
		const buffer = purchaseStateFrameBuffer(
			(updates) => commits.push(updates),
			(callback) => {
				frames.push(callback);
				return 17;
			},
			(handle) => cancelled.push(handle)
		);
		buffer.push(ORDER_ID, { stage: 'complete', success: true } as PurchaseState);
		buffer.flush();

		expect(cancelled).toEqual([17]);
		expect(commits).toHaveLength(1);
		expect(commits[0][ORDER_ID]).toMatchObject({ stage: 'complete', success: true });
		frames[0]();
		expect(commits).toHaveLength(1);
	});

	it('uses the fresh pre-approval balance for a new batch and the persisted baseline for recovery', () => {
		const freshState = {
			balances: { [BUYER]: '10' },
		} as AssetState;
		const newBaseline = batchPurchaseStartingBalance(undefined, freshState, BUYER, '0');

		expect(newBaseline).toBe('10');
		expect(BigInt(newBaseline) + 3n).toBe(13n);
		expect(batchPurchaseStartingBalance({ startingBalance: '7' }, freshState, BUYER, '0')).toBe('7');
	});

	it('resumes only batch orders still available to the same buyer', () => {
		const resume = recoveryBatch();
		const openOrder = { ...resume.entries[0].order, status: 'open' } as SwapOrder;
		const reservedOrder = {
			...filledOrder(openOrder, resume.entries[0].fillQuantity),
			status: 'reserved',
			buyer: BUYER,
		} as SwapOrder;
		const state = (orders: Record<string, SwapOrder>, balance = '0') =>
			({
				balances: { [BUYER]: balance },
				orders,
			} as AssetState);

		expect(fungibleBatchRecoveryStatus(resume, state({ [ORDER_ID]: openOrder }), BUYER)).toBe('resumable');
		expect(fungibleBatchRecoveryStatus(resume, state({ [ORDER_ID]: reservedOrder }), BUYER)).toBe('resumable');
		expect(
			fungibleBatchRecoveryStatus(
				resume,
				state({ [ORDER_ID]: { ...reservedOrder, buyer: 'x'.repeat(43) } }),
				BUYER
			)
		).toBe('blocked');
		expect(fungibleBatchRecoveryStatus(resume, state({}), BUYER)).toBe('blocked');
		(resume.entries[0].snapshot as PurchaseSnapshot).payment = { id: PAYMENT_ID, dispatched: true };
		expect(fungibleBatchRecoveryStatus(resume, state({}, '0'), BUYER)).toBe('resumable');
	});

	it('announces bounded milestones rather than every sibling transition', () => {
		let key = '';
		const messages: string[] = [];
		for (let settled = 0; settled <= 512; settled += 1) {
			const next = nextSettlementAnnouncement(key, true, 512, { failed: 0, settled });
			if (!next) continue;
			key = next.key;
			messages.push(next.message);
		}
		expect(messages).toEqual([
			'Watching 512 parallel settlements.',
			'128 of 512 settlements complete.',
			'256 of 512 settlements complete.',
			'384 of 512 settlements complete.',
			'All 512 settlements are complete.',
		]);
		const failure = nextSettlementAnnouncement(key, true, 512, { failed: 1, settled: 400 });
		expect(failure?.message).toContain('needs attention');
		expect(nextSettlementAnnouncement(failure!.key, true, 512, { failed: 27, settled: 401 })).toBeNull();
	});

	it('distinguishes recovery attempts for the same order by their signed transactions', () => {
		const order = { orderId: 'order' } as SwapOrder;
		expect(
			batchRecoveryIdentity([
				{ order, fillQuantity: '1', snapshot: { registration: { id: 'registration-a', dispatched: false } } },
			])
		).not.toBe(
			batchRecoveryIdentity([
				{ order, fillQuantity: '1', snapshot: { registration: { id: 'registration-b', dispatched: false } } },
			])
		);
	});

	it('requotes when a partial fill changes without changing its source order', () => {
		const order = {
			orderId: 'order',
			quantity: '5',
			asking: '15',
			deposit: '0',
			minimumFee: '10',
			recipient: 'seller',
		} as SwapOrder;
		expect(purchaseQuoteIdentity([filledOrder(order, '1')])).not.toBe(
			purchaseQuoteIdentity([filledOrder(order, '2')])
		);
	});

	it('waits for every sibling before reporting a batch failure', async () => {
		let resolveSibling!: (state: PurchaseState) => void;
		const sibling = new Promise<PurchaseState>((resolve) => {
			resolveSibling = resolve;
		});
		let reported = false;
		const result = waitForSettlementBatch([Promise.reject(new Error('reservation failed')), sibling]).catch(
			(cause) => {
				reported = true;
				throw cause;
			}
		);

		await Promise.resolve();
		expect(reported).toBe(false);
		resolveSibling({ stage: 'complete', success: true } as PurchaseState);
		await expect(result).rejects.toThrow('1 of 2 settlements need attention. reservation failed');
		expect(reported).toBe(true);
	});

	it('releases a mixed resumed batch after only its remaining reservation becomes ready', () => {
		expect(
			batchPaymentBarrierState([
				{
					snapshot: {
						registration: { id: 'registration-a', dispatched: true },
						payment: { id: 'payment-a', dispatched: true },
					},
					paymentCost: '900',
				},
				{
					snapshot: { registration: { id: 'registration-b', dispatched: true } },
					paymentCost: '1100',
				},
			])
		).toEqual({
			registrationsReady: 1,
			pendingPaymentCost: 1100n,
		});
	});

	it('requires every fresh reservation and its complete aggregate payment cost', () => {
		expect(
			batchPaymentBarrierState([
				{ snapshot: {}, paymentCost: '900' },
				{ snapshot: {}, paymentCost: '1100' },
			])
		).toEqual({
			registrationsReady: 0,
			pendingPaymentCost: 2000n,
		});
	});

	it('accepts an explicit replacement leg while rejecting malformed batch recovery', () => {
		expect(isRecoverableBatch(recoveryBatch(), BUYER)).toBe(true);
		expect(isRecoverableBatch({ ...recoveryBatch(), entries: [] }, BUYER)).toBe(false);
		expect(
			isRecoverableBatch(
				{
					...recoveryBatch(),
					entries: [{ ...recoveryBatch().entries[0], snapshot: {} }],
				},
				BUYER
			)
		).toBe(true);
		expect(
			isRecoverableBatch(
				{
					...recoveryBatch(),
					entries: [
						{
							...recoveryBatch().entries[0],
							snapshot: { registration: { id: 'not-a-transaction', dispatched: false } },
						},
					],
				},
				BUYER
			)
		).toBe(false);
	});

	it('does not let an idle purchase event erase its prepared registration', () => {
		const prepared = recoveryBatch().entries[0].snapshot;
		expect(latestRecoverableSnapshot(prepared, {})).toBe(prepared);
		expect(
			latestRecoverableSnapshot(prepared, {
				registration: { ...prepared.registration! },
			})
		).toBe(prepared);
		const dispatched = { registration: { id: REGISTRATION_ID, dispatched: true } };
		expect(latestRecoverableSnapshot(prepared, dispatched)).toEqual(dispatched);
		const dismissed = { ...dispatched, dismissed: true };
		expect(latestRecoverableSnapshot(dispatched, dismissed)).toEqual(dismissed);
	});

	it('keeps complete recovery evidence through partial resumed purchase states', () => {
		const complete = {
			registration: { id: REGISTRATION_ID, dispatched: true },
			payment: { id: PAYMENT_ID, dispatched: true },
			dismissed: true,
		};
		expect(
			latestRecoverableSnapshot(complete, {
				registration: { id: REGISTRATION_ID, dispatched: false },
			})
		).toBe(complete);
		expect(
			latestRecoverableSnapshot(complete, {
				registration: { id: REGISTRATION_ID, dispatched: false },
				payment: { id: PAYMENT_ID, dispatched: false },
			})
		).toBe(complete);
	});

	it('does not rewrite a 512-lot batch for partial resume projections', () => {
		const complete = Array.from({ length: 512 }, (_, index) => ({
			registration: { id: `${String(index).padStart(42, '0')}R`, dispatched: true },
			payment: { id: `${String(index).padStart(42, '0')}P`, dispatched: true },
		}));
		let writes = 0;
		const resumed = complete.map((snapshot) => {
			const next = latestRecoverableSnapshot(snapshot, {
				registration: { ...snapshot.registration, dispatched: false },
			});
			if (next !== snapshot) writes += 1;
			return next;
		});

		expect(writes).toBe(0);
		expect(resumed.map((snapshot) => snapshot.payment?.id)).toEqual(
			complete.map((snapshot) => snapshot.payment.id)
		);
	});

	it('coalesces a 512-lot durable update wave and flushes payment-gate ownership synchronously', () => {
		let frame: (() => void) | undefined;
		let schedules = 0;
		let cancels = 0;
		let writes = 0;
		const buffer = batchRecoveryFrameBuffer(
			() => {
				writes += 1;
			},
			(callback) => {
				frame = callback;
				schedules += 1;
				return schedules;
			},
			() => {
				cancels += 1;
			}
		);

		for (let index = 0; index < 1_024; index += 1) buffer.schedule();
		expect({ schedules, writes }).toEqual({ schedules: 1, writes: 0 });
		frame?.();
		expect(writes).toBe(1);

		for (let index = 0; index < 512; index += 1) buffer.schedule();
		buffer.flush();
		expect({ cancels, schedules, writes }).toEqual({ cancels: 1, schedules: 2, writes: 2 });

		buffer.flush(true);
		expect(writes).toBe(3);
		buffer.schedule();
		buffer.clear();
		expect({ cancels, schedules, writes }).toEqual({ cancels: 2, schedules: 3, writes: 3 });
	});

	it('replaces only a deliberately changed purchase leg', () => {
		const complete = {
			registration: { id: REGISTRATION_ID, dispatched: true },
			payment: { id: PAYMENT_ID, dispatched: true },
			dismissed: true,
		};
		const replacementPayment = 'n'.repeat(43);
		expect(
			latestRecoverableSnapshot(complete, {
				registration: { id: REGISTRATION_ID, dispatched: false },
				payment: { id: replacementPayment, dispatched: false },
			})
		).toEqual({
			registration: { id: REGISTRATION_ID, dispatched: true },
			payment: { id: replacementPayment, dispatched: false },
			dismissed: true,
		});
		const replacementRegistration = 's'.repeat(43);
		expect(
			latestRecoverableSnapshot(complete, {
				registration: { id: replacementRegistration, dispatched: false },
			})
		).toEqual({
			registration: { id: replacementRegistration, dispatched: false },
		});
	});

	it('persists a fully signed batch before honoring a late abort', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
		};
		const controller = new AbortController();
		controller.abort(new Error('wallet changed'));

		expect(() =>
			storeBatchRecoveryBeforeDispatch(
				storage,
				'bazar-purchase-batch:asset:buyer',
				recoveryBatch(),
				controller.signal
			)
		).toThrow('wallet changed');
		expect(JSON.parse(values.get('bazar-purchase-batch:asset:buyer')!)).toMatchObject({
			buyer: BUYER,
			entries: [{ snapshot: { registration: { id: REGISTRATION_ID } } }],
		});
	});

	it('refuses to replace another batch recovery before dispatch', () => {
		const key = 'bazar-purchase-batch:asset:buyer';
		const values = new Map([[key, JSON.stringify({ ...recoveryBatch(), attemptId: 'older-attempt' })]]);
		const storage = {
			getItem: (candidate: string) => values.get(candidate) ?? null,
			setItem: (candidate: string, value: string) => values.set(candidate, value),
		};

		expect(() =>
			storeBatchRecoveryBeforeDispatch(storage, key, recoveryBatch(), new AbortController().signal)
		).toThrow('wallet-recovery-conflict');
		expect(JSON.parse(values.get(key)!)).toMatchObject({ attemptId: 'older-attempt' });
	});
});

describe('parallel settlement keyboard navigation', () => {
	it('wraps arrow navigation and supports Home and End', () => {
		expect(settlementTabIndex('ArrowRight', 2, 3)).toBe(0);
		expect(settlementTabIndex('ArrowLeft', 0, 3)).toBe(2);
		expect(settlementTabIndex('Home', 2, 3)).toBe(0);
		expect(settlementTabIndex('End', 0, 3)).toBe(2);
	});

	it('ignores unrelated keys and empty tab lists', () => {
		expect(settlementTabIndex('Tab', 0, 3)).toBeNull();
		expect(settlementTabIndex('ArrowRight', 0, 0)).toBeNull();
	});
});

describe('parallel settlement progress summary', () => {
	it('keeps settled, failed, paying, and reserving states mutually exclusive', () => {
		const summary = batchSettlementSummary([
			{ stage: 'complete' } as PurchaseState,
			{ stage: 'failed' } as PurchaseState,
			{ stage: 'payment-confirming' } as PurchaseState,
			{ stage: 'registration-confirming' } as PurchaseState,
		]);
		expect(summary).toMatchObject({ settled: 1, failed: 1, paying: 1, reserving: 1 });
		expect(summary.label).toBe('4 listings · 1 settled · 1 needs attention · 1 paying · 1 reserving');
	});

	it('reports all-failed and not-yet-started batches truthfully', () => {
		expect(
			batchSettlementSummary([{ stage: 'failed' } as PurchaseState, { stage: 'failed' } as PurchaseState])
		).toMatchObject({ settled: 0, failed: 2, paying: 0, reserving: 0 });
		expect(batchSettlementSummary([undefined, undefined])).toMatchObject({
			settled: 0,
			failed: 0,
			paying: 0,
			reserving: 2,
		});
	});

	it('does not report payment completion while token receipt is still being verified', () => {
		expect(batchStageLabel({ stage: 'ownership-verifying' } as PurchaseState)).toBe('Checking receipt');
	});

	it('names the live reservation check and caps historical confirmation counts', () => {
		expect(batchStageLabel({ stage: 'registration-accepting' } as PurchaseState)).toBe('Checking reservation');
		expect(
			batchStageLabel({
				stage: 'registration-confirming',
				registration: { consensus: { confirmations: 316 } },
			} as PurchaseState)
		).toBe('Reserve 5/5');
	});
});

describe('blocked purchase recovery cleanup', () => {
	it('clears only batches whose seller payments were never dispatched', () => {
		expect(
			batchHasNoDispatchedSellerPayment({
				entries: [{ snapshot: { registration: { id: 'R'.repeat(43), dispatched: true } } }],
			} as any)
		).toBe(true);
		expect(
			batchHasNoDispatchedSellerPayment({
				entries: [{ snapshot: { payment: { id: 'P'.repeat(43), dispatched: true } } }],
			} as any)
		).toBe(false);
	});
});

describe('fungible order action names', () => {
	it('distinguishes each whole-lot action by quantity, total, and seller', () => {
		const state = {
			ticker: 'WEAVE',
			denomination: 12,
		} as AssetState;
		const first = {
			creator: 'A'.repeat(43),
			quantity: '3000000000000',
			asking: '3000000',
		} as SwapOrder;
		const second = {
			creator: 'B'.repeat(43),
			quantity: '5000000000000',
			asking: '6000000',
		} as SwapOrder;

		expect(fungibleOrderActionLabel('buy', first, state)).toBe(
			`Buy 3 $WEAVE for 0.000003 $AR from ${'A'.repeat(43)}`
		);
		expect(fungibleOrderActionLabel('buy', second, state)).toBe(
			`Buy 5 $WEAVE for 0.000006 $AR from ${'B'.repeat(43)}`
		);
		expect(fungibleOrderActionLabel('cancel', first, state)).toBe('Cancel listing of 3 $WEAVE for 0.000003 $AR');
	});

	it('distinguishes sellers whose compact identities collide', () => {
		const state = { ticker: 'WEAVE', denomination: 12 } as AssetState;
		const shared = { quantity: '3000000000000', asking: '3000000' };
		const first = { ...shared, creator: `AAAAAA${'1'.repeat(32)}AAAAA` } as SwapOrder;
		const second = { ...shared, creator: `AAAAAA${'2'.repeat(32)}AAAAA` } as SwapOrder;

		expect(fungibleListingAccessibleLabel(first, state)).toContain(first.creator);
		expect(fungibleListingAccessibleLabel(second, state)).toContain(second.creator);
		expect(fungibleListingAccessibleLabel(first, state)).not.toBe(fungibleListingAccessibleLabel(second, state));
	});
});

describe('fungible activity amounts', () => {
	it('includes the AR total beside the listed token quantity', () => {
		expect(
			fungibleActivityAmount(
				{
					action: 'make-offer',
					asking: '7800000000000',
					quantity: '1000000000000000',
				} as CollectionActivityEvent,
				{ denomination: 12, ticker: 'MIST' } as AssetState
			)
		).toBe('1,000 $MIST for 7.8 AR');
	});
});

describe('fungible state revalidation', () => {
	it('rejects changed lots and balances before wallet approval', () => {
		const seller = 's'.repeat(43);
		const buyer = 'b'.repeat(43);
		const order = {
			orderId: 'o'.repeat(43),
			creator: seller,
			asking: '2000',
			quantity: '1000',
			status: 'open',
		} as SwapOrder;
		const state = {
			denomination: 12,
			balances: { [seller]: '5000' },
			orders: { [order.orderId]: order },
		} as AssetState;
		expect(fungibleOperationStateError('buy', state, buyer, [order])).toBe('');
		expect(fungibleOperationStateError('buy', { ...state, orders: {} }, buyer, [order])).toBe(
			'market-state-changed'
		);
		expect(fungibleOperationStateError('cancel', state, seller, [order])).toBe('');
		expect(fungibleOperationStateError('cancel', state, buyer, [order])).toBe('market-state-changed');
		expect(fungibleOperationStateError('sell', state, seller, [], '5000')).toBe('');
		expect(fungibleOperationStateError('sell', state, seller, [], '5001')).toBe('market-state-changed');
		expect(fungibleOperationStateError('transfer', state, seller, [], '5000')).toBe('');
		expect(fungibleOperationStateError('transfer', state, seller, [], '5001')).toBe('market-state-changed');
	});
});

describe('fungible transfer recipient validation', () => {
	it('rejects malformed and same-wallet recipients before signing', () => {
		expect(fungibleTransferRecipientError('not-an-address', BUYER)).toContain('43-character');
		expect(fungibleTransferRecipientError(BUYER, BUYER)).toContain('different wallet');
		expect(fungibleTransferRecipientError('c'.repeat(43), BUYER)).toBe('');
		expect(fungibleTransferRecipientError(`  ${'c'.repeat(43)}\n`, BUYER)).toBe('');
	});

	it('names the exact recipient before an irreversible transfer', () => {
		const recipient = 'c'.repeat(43);
		const state = { denomination: 12, ticker: 'WEAVE' } as AssetState;
		expect(fungibleTransferSubmitLabel('2000000000000', state, recipient)).toBe('Send 2 $WEAVE to cccccc…ccccc');
		expect(fungibleTransferSubmitLabel('2000000000000', state, recipient, true)).toBe(
			`Send 2 $WEAVE to ${recipient}`
		);
	});
});
