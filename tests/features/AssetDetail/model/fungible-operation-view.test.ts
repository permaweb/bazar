import { describe, expect, it } from 'vitest';

import type { AssetState, SwapOrder } from 'api/marketplace';
import type { PurchaseState } from 'api/transactions';

import { ASSET_DETAIL_MESSAGES, type AssetDetailPlural } from 'features/AssetDetail/messages';
import type { BatchEntry, FungibleOperation } from 'features/AssetDetail/model/fungible-operation';
import {
	fungibleOperationDraftView,
	fungibleOperationOutcome,
	fungibleOperationSubmit,
	fungibleOperationVisibleFills,
	fungiblePurchaseCandidates,
	fungiblePurchaseDraftMatch,
	fungiblePurchaseSync,
	fungiblePurchaseTotals,
	fungibleSingleSyncSteps,
	initialExactActionBaseline,
	initialFungibleOperationDraft,
	isRecoverableFungiblePurchase,
	shouldResumeFungibleOperation,
} from 'features/AssetDetail/model/fungible-operation-view';
import { APP_ERROR_MESSAGES } from 'helpers/app-error.messages';
import { formatPlural } from 'helpers/i18n';

const messages = ASSET_DETAIL_MESSAGES.en;
const plural: AssetDetailPlural = (message, count, values) => formatPlural('en', message, count, values);
const SELLER = 's'.repeat(43);
const OTHER = 'c'.repeat(43);
const OWNER = 'o'.repeat(43);
const REGISTRATION = 'r'.repeat(43);
const PAYMENT = 'p'.repeat(43);

function order(id: string, creator: string, quantity: string, asking: string): SwapOrder {
	return {
		orderId: id.repeat(43).slice(0, 43),
		creator,
		recipient: 'q'.repeat(43),
		asking,
		deposit: '0',
		minimumFee: '0',
		deadline: 0,
		createdAt: 1,
		quantity,
		status: 'open',
	};
}

const FIRST = order('a', SELLER, '1000', '5000000000');
const SECOND = order('b', OTHER, '2000', '12000000000');

const STATE = {
	device: 'token@1.0',
	name: 'Test token',
	ticker: 'TEST',
	denomination: 2,
	totalSupply: '100000',
	balances: { [OWNER]: '5000' },
	orders: { [FIRST.orderId]: FIRST, [SECOND.orderId]: SECOND },
	swapHeight: 0,
	value: null,
	raw: {},
} satisfies AssetState;

function entry(snapshot: BatchEntry['snapshot'] = {}): BatchEntry {
	return { order: FIRST, fillQuantity: '600', paymentCost: '5', snapshot };
}

function resumeOperation(entries: BatchEntry[]): FungibleOperation {
	return {
		kind: 'buy',
		availableOrders: [],
		startingBalance: '0',
		resume: { version: 3, buyer: OWNER, startingBalance: '0', entries },
	};
}

describe('fungible operation draft', () => {
	it('opens with the amounts the operation carried, or the whole resumed batch', () => {
		expect(initialFungibleOperationDraft({ kind: 'sell', quantity: '5', unitPrice: '0.5' }, 2)).toEqual({
			quantity: '5',
			unitPrice: '0.5',
			recipient: '',
		});
		expect(initialFungibleOperationDraft({ kind: 'transfer', recipient: OTHER }, 2)).toEqual({
			quantity: '',
			unitPrice: '',
			recipient: OTHER,
		});
		expect(initialFungibleOperationDraft({ kind: 'cancel', order: FIRST }, 2)).toEqual({
			quantity: '',
			unitPrice: '',
			recipient: '',
		});
		// Two 600-unit fills of a two-decimal token are shown as the 12 tokens being bought.
		expect(initialFungibleOperationDraft(resumeOperation([entry(), entry()]), 2).quantity).toBe('12');
	});

	it('rejects quantities above the liquid balance and prices that are not positive AR', () => {
		const view = fungibleOperationDraftView({ kind: 'sell' }, STATE, OWNER, {
			quantity: '60',
			unitPrice: '0',
			recipient: '',
		});
		expect(view).toMatchObject({
			available: '5000',
			quantityInvalid: true,
			unitPriceValid: false,
			listingQuote: null,
			sellValid: false,
		});
	});

	it('quotes a valid listing and reports the balance it will leave', () => {
		const view = fungibleOperationDraftView({ kind: 'sell' }, STATE, OWNER, {
			quantity: '10',
			unitPrice: '0.5',
			recipient: '',
		});
		expect(view).toMatchObject({ quantityInvalid: false, unitPriceValid: true, sellValid: true });
		expect(view.listingQuote).toBe('5');
		expect(view.enteredQuantity).toBe(1000n);
		expect(view.currentLiquid).toBe(5000n);
	});

	it('normalizes and validates a transfer recipient', () => {
		const invalid = fungibleOperationDraftView({ kind: 'transfer' }, STATE, OWNER, {
			quantity: '1',
			unitPrice: '',
			recipient: ' not-an-address ',
		});
		expect(invalid.recipientError).toBe('fungible-recipient-invalid');
		expect(invalid.transferValid).toBe(false);

		const valid = fungibleOperationDraftView({ kind: 'transfer' }, STATE, OWNER, {
			quantity: '1',
			unitPrice: '',
			recipient: ` ${OTHER}\n`,
		});
		expect(valid.transferRecipient).toBe(OTHER);
		expect(valid.transferValid).toBe(true);
	});

	it('matches a purchase amount against open candidates only', () => {
		const reserved = { ...SECOND, status: 'reserved' } as SwapOrder;
		const operation: FungibleOperation = {
			kind: 'buy',
			availableOrders: [FIRST, reserved],
			startingBalance: '0',
		};
		expect(fungiblePurchaseCandidates(operation)).toEqual([FIRST]);
		expect(fungiblePurchaseCandidates({ kind: 'sell' })).toEqual([]);

		const matched = fungiblePurchaseDraftMatch(
			'buy',
			[FIRST],
			'10',
			STATE,
			'$TEST',
			messages,
			APP_ERROR_MESSAGES.en
		);
		expect(matched.match?.fills).toHaveLength(1);
		expect(matched.error).toBe('');

		const tooLarge = fungiblePurchaseDraftMatch(
			'buy',
			[FIRST],
			'999',
			STATE,
			'$TEST',
			messages,
			APP_ERROR_MESSAGES.en
		);
		expect(tooLarge.match).toBeNull();
		expect(tooLarge.error).toContain('is currently available');

		const malformed = fungiblePurchaseDraftMatch(
			'buy',
			[FIRST],
			'1.005',
			STATE,
			'$TEST',
			messages,
			APP_ERROR_MESSAGES.en
		);
		expect(malformed.match).toBeNull();
		expect(malformed.error).toContain('no more than 2 decimal places');
		expect(fungiblePurchaseDraftMatch('buy', [FIRST], '', STATE, '$TEST', messages, APP_ERROR_MESSAGES.en)).toEqual(
			{
				match: null,
				error: '',
			}
		);
		expect(
			fungiblePurchaseDraftMatch('sell', [FIRST], '10', STATE, '$TEST', messages, APP_ERROR_MESSAGES.en)
		).toEqual({
			match: null,
			error: '',
		});
	});
});

describe('fungible purchase lots', () => {
	it('shows the saved batch lots when resuming and the live match otherwise', () => {
		const fills = [{ order: FIRST, sourceOrder: FIRST, partial: false }];
		expect(fungibleOperationVisibleFills({ kind: 'sell' }, fills)).toEqual([]);
		expect(
			fungibleOperationVisibleFills({ kind: 'buy', availableOrders: [], startingBalance: '0' }, fills)
		).toEqual(fills);

		const resumed = fungibleOperationVisibleFills(resumeOperation([entry()]), fills);
		expect(resumed).toHaveLength(1);
		expect(resumed[0].partial).toBe(true);
		expect(resumed[0].order.quantity).toBe('600');
		expect(resumed[0].sourceOrder).toBe(FIRST);
	});

	it('totals quantity, seller payments, and distinct sellers', () => {
		expect(fungiblePurchaseTotals([])).toEqual({ quantity: 0n, asking: 0n, sellers: 0 });
		expect(fungiblePurchaseTotals([FIRST, SECOND, { ...FIRST, orderId: 'z'.repeat(43) }])).toEqual({
			quantity: 4000n,
			asking: 22000000000n,
			sellers: 2,
		});
	});

	it('treats a purchase with any signed leg as recoverable', () => {
		expect(isRecoverableFungiblePurchase({ kind: 'sell' }, {})).toBe(false);
		expect(isRecoverableFungiblePurchase(resumeOperation([entry()]), {})).toBe(false);
		expect(
			isRecoverableFungiblePurchase(
				resumeOperation([entry({ registration: { id: REGISTRATION, dispatched: true } })]),
				{}
			)
		).toBe(true);
		expect(
			isRecoverableFungiblePurchase(
				{ kind: 'buy', availableOrders: [], startingBalance: '0' },
				{
					[FIRST.orderId]: {
						stage: 'payment-confirming',
						registration: { id: REGISTRATION, dispatched: true },
					} as unknown as PurchaseState,
				}
			)
		).toBe(true);
	});

	it('resumes saved work only when nothing new needs approval', () => {
		expect(shouldResumeFungibleOperation({ kind: 'sell' })).toBe(false);
		expect(shouldResumeFungibleOperation({ kind: 'sell', resumeId: 't'.repeat(43) })).toBe(true);
		expect(
			shouldResumeFungibleOperation(
				resumeOperation([entry({ registration: { id: REGISTRATION, dispatched: true } })])
			)
		).toBe(false);
		expect(
			shouldResumeFungibleOperation(
				resumeOperation([
					entry({
						registration: { id: REGISTRATION, dispatched: true },
						payment: { id: PAYMENT, dispatched: false },
					}),
				])
			)
		).toBe(true);
	});

	it('restores an exact action baseline only from a proven slot or a saved transaction', () => {
		expect(initialExactActionBaseline({ kind: 'sell' })).toBeNull();
		expect(initialExactActionBaseline({ kind: 'cancel', order: FIRST })).toBeNull();
		expect(initialExactActionBaseline({ kind: 'cancel', order: FIRST, startingSlot: 12 })).toEqual({
			startingSlot: 12,
		});
		expect(initialExactActionBaseline({ kind: 'transfer', resumeId: 't'.repeat(43) })).toEqual({
			startingSlot: 0,
		});
		expect(initialExactActionBaseline({ kind: 'transfer', startingSlot: Number.NaN })).toBeNull();
	});
});

describe('fungible operation progress and outcome', () => {
	it('keeps reservation and payment as separate steps and names the active one', () => {
		expect(fungiblePurchaseSync(messages)).toEqual({ steps: [], activeStep: 'register' });

		const reserving = fungiblePurchaseSync(messages, {
			stage: 'registration-accepting',
			canSkip: false,
			registration: { id: REGISTRATION },
		} as unknown as PurchaseState);
		expect(reserving.steps.map((step) => step.key)).toEqual(['register', 'pay']);
		expect(reserving.activeStep).toBe('register');
		expect(reserving.pendingAfterConfirmation).toBe(messages.syncPendingReservation);
		expect(reserving.skipKind).toBeUndefined();

		const verifying = fungiblePurchaseSync(messages, {
			stage: 'ownership-verifying',
			canSkip: true,
			registration: { id: REGISTRATION, consensus: { confirmations: 9 } },
			payment: { id: PAYMENT },
		} as unknown as PurchaseState);
		expect(verifying.activeStep).toBe('pay');
		expect(verifying.pendingAfterConfirmation).toBe(messages.syncPendingReceipt);
		expect(verifying.skipKind).toBe('skip');
	});

	it('builds one terminal step for a single signed transaction', () => {
		expect(fungibleSingleSyncSteps('sell', null, 0, [], null, messages)).toEqual([]);
		const steps = fungibleSingleSyncSteps(
			'transfer',
			{ id: 't'.repeat(43) } as never,
			4,
			[],
			{ confirmations: 4 } as never,
			messages
		);
		expect(steps).toHaveLength(1);
		expect(steps[0]).toMatchObject({
			key: 'transfer',
			label: messages.operationLabelTransfer,
			target: 5,
			confirmations: 4,
		});
		expect(steps[0].transaction?.consensus).toBeDefined();
	});

	it('describes each completed operation with its own receipt copy', () => {
		const purchase = fungibleOperationOutcome(
			{ kind: 'buy', availableOrders: [], startingBalance: '0' },
			STATE,
			[FIRST, SECOND],
			{ enteredQuantity: null, listingQuote: null, transferRecipient: '' },
			messages,
			plural
		);
		expect(purchase.title).toBe(messages.outcomeBuyTitle);
		expect(purchase.purchasedQuantity).toBe(3000n);
		expect(purchase.detail).toContain('2 listings');
		expect(purchase.detail).toContain('AR paid to sellers');

		const listing = fungibleOperationOutcome(
			{ kind: 'sell' },
			STATE,
			[],
			{ enteredQuantity: 1000n, listingQuote: '5', transferRecipient: '' },
			messages,
			plural
		);
		expect(listing).toMatchObject({ title: messages.outcomeSellTitle });
		expect(listing.detail).toBe('10 $TEST listed for 5 AR.');

		expect(
			fungibleOperationOutcome(
				{ kind: 'cancel', order: FIRST },
				STATE,
				[],
				{ enteredQuantity: null, listingQuote: null, transferRecipient: '' },
				messages,
				plural
			).detail
		).toContain('returned to your liquid balance');

		expect(
			fungibleOperationOutcome(
				{ kind: 'transfer' },
				STATE,
				[],
				{ enteredQuantity: 500n, listingQuote: null, transferRecipient: OTHER },
				messages,
				plural
			).detail
		).toBe(`5 $TEST sent to ${OTHER}.`);
	});

	it('labels and blocks the submit action until the draft and quote are usable', () => {
		const draft = {
			enteredQuantity: 1000n,
			listingQuote: '5',
			transferRecipient: '',
			sellValid: true,
			transferValid: false,
		};
		expect(
			fungibleOperationSubmit({ kind: 'sell' }, STATE, draft, { orders: [], quantity: 0n }, messages)
		).toMatchObject({
			label: 'List 10 $TEST for 5 AR',
			disabled: false,
		});
		expect(
			fungibleOperationSubmit(
				{ kind: 'sell' },
				STATE,
				{ ...draft, sellValid: false },
				{ orders: [], quantity: 0n },
				messages
			).disabled
		).toBe(true);

		const buying = { orders: [FIRST], quantity: 1000n, estimatedCost: '6000000000', canAfford: true };
		expect(
			fungibleOperationSubmit(
				{ kind: 'buy', availableOrders: [FIRST], startingBalance: '0' },
				STATE,
				draft,
				buying,
				messages
			)
		).toMatchObject({ label: 'Buy 10 $TEST · 0.006 AR max', disabled: false });
		expect(
			fungibleOperationSubmit(
				{ kind: 'buy', availableOrders: [FIRST], startingBalance: '0' },
				STATE,
				draft,
				{ ...buying, canAfford: false },
				messages
			).disabled
		).toBe(true);
		expect(
			fungibleOperationSubmit(
				{ kind: 'buy', availableOrders: [FIRST], startingBalance: '0' },
				STATE,
				draft,
				{ orders: [FIRST], quantity: 1000n },
				messages
			).label
		).toContain(messages.submitBuyChecking);

		const transfer = fungibleOperationSubmit(
			{ kind: 'transfer' },
			STATE,
			{ ...draft, transferRecipient: OTHER, transferValid: true },
			{ orders: [], quantity: 0n },
			messages
		);
		expect(transfer.label).toBe(`Send 10 $TEST to ${OTHER.slice(0, 6)}…${OTHER.slice(-5)}`);
		expect(transfer.ariaLabel).toBe(`Send 10 $TEST to ${OTHER}`);
		expect(transfer.disabled).toBe(false);

		expect(
			fungibleOperationSubmit(
				{ kind: 'cancel', order: FIRST },
				STATE,
				draft,
				{ orders: [], quantity: 0n },
				messages
			)
		).toMatchObject({ label: 'Cancel listing and return 10 $TEST', disabled: false });
	});
});
