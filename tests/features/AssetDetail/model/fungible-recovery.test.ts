import { describe, expect, it } from 'vitest';

import type { AssetSummary } from 'api/collections';
import type { SwapOrder } from 'api/marketplace';

import type { BatchResume, FungibleOperationActivity } from 'features/AssetDetail/model/fungible-operation';
import {
	batchResumeOperation,
	fungibleOperationActivitySummary,
	isSavedFungibleOperationRecord,
	retainResumingActivities,
	revealFungibleOperationActivity,
	savedFungibleOperation,
	savedOperationRecordMatches,
	withoutScopedActivities,
} from 'features/AssetDetail/model/fungible-recovery';

const ASSET_ID = 'a'.repeat(43);
const COLLECTION_ID = 'k'.repeat(43);
const SIGNER = 's'.repeat(43);
const OTHER_SIGNER = 'c'.repeat(43);
const TX = 't'.repeat(43);
const ORDER = { orderId: 'o'.repeat(43), quantity: '10', asking: '20' } as SwapOrder;
const ASSET: AssetSummary = { id: ASSET_ID, name: 'Test Token', ticker: 'TEST' };

function activity(
	id: string,
	signer: string,
	operation: FungibleOperationActivity['operation'],
	visible = false
): FungibleOperationActivity {
	return { id, signer, operation, phase: null, visible, createdAt: 1 };
}

const PURCHASE = activity('purchase', SIGNER, { kind: 'buy', availableOrders: [], startingBalance: '0' });
const RESUMING_PURCHASE = activity('resuming-purchase', SIGNER, {
	kind: 'buy',
	availableOrders: [],
	startingBalance: '0',
	resume: { version: 3, buyer: SIGNER, startingBalance: '0', entries: [] },
});
const ASSET_ACTION = activity('asset', SIGNER, { kind: 'sell' });
const RESUMING_ASSET_ACTION = activity('resuming-asset', SIGNER, { kind: 'sell', resumeId: TX });
const OTHER_WALLET = activity('other', OTHER_SIGNER, { kind: 'sell' });

describe('saved fungible operation records', () => {
	it('accepts only a signed listing, cancellation, or transfer from this wallet', () => {
		const record = { txId: TX, kind: 'sell', signer: SIGNER, quantity: '5' };
		expect(isSavedFungibleOperationRecord(record, SIGNER)).toBe(true);
		expect(isSavedFungibleOperationRecord(record, OTHER_SIGNER)).toBe(false);
		expect(isSavedFungibleOperationRecord({ ...record, txId: 'short' }, SIGNER)).toBe(false);
		expect(isSavedFungibleOperationRecord({ ...record, kind: 'buy' }, SIGNER)).toBe(false);
		for (const malformed of [null, undefined, 5, 'record', [], {}]) {
			expect(isSavedFungibleOperationRecord(malformed, SIGNER)).toBe(false);
		}
	});

	it('matches a stored record by asset, signer, and transaction', () => {
		const expected = { assetId: ASSET_ID, signer: SIGNER, txId: TX };
		expect(savedOperationRecordMatches({ assetId: ASSET_ID, signer: SIGNER, txId: TX }, expected)).toBe(true);
		expect(savedOperationRecordMatches({ assetId: ASSET_ID, signer: SIGNER, txId: 'x'.repeat(43) }, expected)).toBe(
			false
		);
		expect(savedOperationRecordMatches(null, expected)).toBe(false);
	});

	it('resumes each saved action as its own dialog operation', () => {
		expect(
			savedFungibleOperation({ txId: TX, kind: 'sell', signer: SIGNER, quantity: '5', unitPrice: '0.5' })
		).toEqual({ kind: 'sell', quantity: '5', unitPrice: '0.5', resumeId: TX });
		expect(
			savedFungibleOperation({
				txId: TX,
				kind: 'transfer',
				signer: SIGNER,
				quantity: '5',
				recipient: OTHER_SIGNER,
				startingSlot: 7,
			})
		).toEqual({ kind: 'transfer', quantity: '5', recipient: OTHER_SIGNER, startingSlot: 7, resumeId: TX });
		expect(
			savedFungibleOperation({ txId: TX, kind: 'cancel', signer: SIGNER, order: ORDER, startingSlot: 7 })
		).toEqual({ kind: 'cancel', order: ORDER, startingSlot: 7, resumeId: TX });
		// A cancellation without its order cannot prove what it cancels.
		expect(savedFungibleOperation({ txId: TX, kind: 'cancel', signer: SIGNER })).toBeNull();
	});

	it('rebuilds a purchase dialog from a saved settlement batch', () => {
		const resume: BatchResume = {
			version: 3,
			buyer: SIGNER,
			startingBalance: '100',
			entries: [{ order: ORDER, fillQuantity: '10', paymentCost: '5', snapshot: {} }],
		};
		expect(batchResumeOperation(resume)).toEqual({
			kind: 'buy',
			availableOrders: [ORDER],
			startingBalance: '100',
			resume,
		});
	});
});

describe('fungible operation activity announcements', () => {
	it('publishes the phase and its status for the activity centre', () => {
		expect(fungibleOperationActivitySummary(ASSET_ACTION, ASSET, COLLECTION_ID, 'working')).toEqual({
			id: 'asset',
			asset: ASSET,
			collectionId: COLLECTION_ID,
			owner: SIGNER,
			operationKind: 'sell',
			phase: 'working',
			status: 'Transaction in progress',
			createdAt: 1,
		});
	});

	it('includes confirmation progress only when both values are known', () => {
		expect(
			fungibleOperationActivitySummary(ASSET_ACTION, ASSET, COLLECTION_ID, 'working', {
				status: 'Watching Arweave confirmations…',
				confirmations: 2,
				confirmationTarget: 5,
			})
		).toMatchObject({ status: 'Watching Arweave confirmations…', confirmations: 2, confirmationTarget: 5 });
		expect(
			fungibleOperationActivitySummary(ASSET_ACTION, ASSET, COLLECTION_ID, 'working', {
				status: 'Watching Arweave confirmations…',
				confirmations: 2,
			})
		).not.toHaveProperty('confirmations');
	});

	it('stamps an activity that never opened with the current time', () => {
		expect(
			fungibleOperationActivitySummary(
				{ ...ASSET_ACTION, createdAt: undefined },
				ASSET,
				COLLECTION_ID,
				'form',
				undefined,
				42
			).createdAt
		).toBe(42);
	});
});

describe('cross-tab activity pruning', () => {
	it('keeps resuming dialogs when another tab claims the same scope', () => {
		const activities = [PURCHASE, RESUMING_PURCHASE, ASSET_ACTION, RESUMING_ASSET_ACTION, OTHER_WALLET];
		expect(retainResumingActivities(activities, SIGNER, 'purchase').map((item) => item.id)).toEqual([
			'resuming-purchase',
			'asset',
			'resuming-asset',
			'other',
		]);
		expect(retainResumingActivities(activities, SIGNER, 'asset').map((item) => item.id)).toEqual([
			'purchase',
			'resuming-purchase',
			'resuming-asset',
			'other',
		]);
	});

	it('drops every dialog of the scope whose recovery another tab removed', () => {
		const activities = [PURCHASE, RESUMING_PURCHASE, ASSET_ACTION, RESUMING_ASSET_ACTION, OTHER_WALLET];
		expect(withoutScopedActivities(activities, SIGNER, 'purchase').map((item) => item.id)).toEqual([
			'asset',
			'resuming-asset',
			'other',
		]);
		expect(withoutScopedActivities(activities, SIGNER, 'asset').map((item) => item.id)).toEqual([
			'purchase',
			'resuming-purchase',
			'other',
		]);
	});

	it('reveals one requested dialog and keeps the list when nothing changes', () => {
		const activities = [PURCHASE, ASSET_ACTION];
		const revealed = revealFungibleOperationActivity(activities, 'asset');
		expect(revealed.map((item) => item.visible)).toEqual([false, true]);
		expect(revealFungibleOperationActivity(revealed, 'asset')).toBe(revealed);
		expect(revealFungibleOperationActivity(activities, 'missing')).toBe(activities);
	});
});
