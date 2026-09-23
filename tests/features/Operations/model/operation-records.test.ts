import { describe, expect, it } from 'vitest';

import {
	atomicActionRecord,
	atomicActionRecordMatcher,
	atomicPurchaseRecord,
	atomicPurchaseRecordMatcher,
	exactActionBaselineFromSlot,
	initialExactActionBaseline,
	preparedAtomicOperation,
	purchaseGatewayForRecovery,
	rejectedActionTransactionId,
	requiredActionBaseline,
} from 'features/Operations/model/operation-records';
import { appError } from 'helpers/app-error';

const OWNER = 'O'.repeat(43);
const TRANSACTION = 'T'.repeat(43);
const REGISTRATION = 'G'.repeat(43);
const ORDER = { orderId: 'D'.repeat(43), creator: 'S'.repeat(43), asking: '100', quantity: '1', status: 'open' } as any;
const ASSET = { id: 'A'.repeat(43), name: 'Atomic art', image: 'https://arweave.net/image' };
const GATEWAY = { arweave: 'https://arweave.net', compute: 'https://compute.example' };

describe('saved purchase records', () => {
	it('keeps the persisted purchase format and key order', () => {
		const record = atomicPurchaseRecord({
			asset: ASSET,
			buyer: OWNER,
			collectionId: 'collection-1',
			gateway: GATEWAY,
			order: ORDER,
			snapshot: { registration: { id: REGISTRATION, dispatched: true } },
			createdAt: 7,
		});
		expect(JSON.stringify(record)).toBe(
			JSON.stringify({
				asset: { id: ASSET.id, name: ASSET.name },
				activityKind: 'atomic',
				buyer: OWNER,
				collectionId: 'collection-1',
				gateway: GATEWAY,
				order: ORDER,
				snapshot: { registration: { id: REGISTRATION, dispatched: true } },
				createdAt: 7,
			})
		);
	});

	it('matches only the same buyer, order, and signed reservation', () => {
		const matches = atomicPurchaseRecordMatcher(OWNER, ORDER.orderId, REGISTRATION);
		const record = {
			buyer: OWNER,
			order: { orderId: ORDER.orderId },
			snapshot: { registration: { id: REGISTRATION } },
		};
		expect(matches(record)).toBe(true);
		expect(matches({ ...record, buyer: 'B'.repeat(43) })).toBe(false);
		expect(matches({ ...record, order: { orderId: 'X' } })).toBe(false);
		expect(matches({ ...record, snapshot: {} })).toBe(false);
		expect(matches(null)).toBe(false);
		expect(matches('record')).toBe(false);
		expect(atomicPurchaseRecordMatcher(OWNER, ORDER.orderId, undefined)({ ...record, snapshot: {} })).toBe(true);
	});

	it('restores the gateways a purchase was signed against', () => {
		const other = { arweave: 'https://other.example', compute: 'https://compute.other' };
		expect(purchaseGatewayForRecovery(JSON.stringify({ gateway: other }))).toEqual(other);
		expect(purchaseGatewayForRecovery(null)).toEqual(purchaseGatewayForRecovery('{"gateway":{"arweave":1}}'));
		expect(purchaseGatewayForRecovery('not json')).toEqual(purchaseGatewayForRecovery(null));
		expect(purchaseGatewayForRecovery('"gateway"')).toEqual(purchaseGatewayForRecovery(null));
	});
});

describe('saved action records', () => {
	it('keeps the persisted listing, cancellation, and transfer formats', () => {
		const common = { transactionId: TRANSACTION, asset: ASSET, collectionId: 'c', signer: OWNER, createdAt: 9 };
		expect(
			JSON.stringify(atomicActionRecord({ ...common, operation: { kind: 'sell' }, value: '2', baseline: null }))
		).toBe(
			JSON.stringify({
				txId: TRANSACTION,
				kind: 'sell',
				assetId: ASSET.id,
				asset: ASSET,
				activityKind: 'atomic',
				collectionId: 'c',
				signer: OWNER,
				value: '2',
				createdAt: 9,
			})
		);
		expect(
			atomicActionRecord({
				...common,
				asset: { id: ASSET.id, name: ASSET.name },
				operation: { kind: 'cancel', order: ORDER },
				value: '',
				baseline: { startingSlot: 4 },
			})
		).toEqual({
			txId: TRANSACTION,
			kind: 'cancel',
			assetId: ASSET.id,
			asset: { id: ASSET.id, name: ASSET.name },
			activityKind: 'atomic',
			collectionId: 'c',
			signer: OWNER,
			order: ORDER,
			startingSlot: 4,
			createdAt: 9,
		});
		expect(
			atomicActionRecord({
				...common,
				operation: { kind: 'transfer' },
				value: 'R'.repeat(43),
				baseline: { startingSlot: 0 },
			})
		).toMatchObject({ kind: 'transfer', value: 'R'.repeat(43), startingSlot: 0 });
	});

	it('refuses to save a cancellation or transfer without its starting slot', () => {
		expect(() =>
			atomicActionRecord({
				transactionId: TRANSACTION,
				asset: ASSET,
				collectionId: 'c',
				signer: OWNER,
				createdAt: 1,
				operation: { kind: 'transfer' },
				value: 'R'.repeat(43),
				baseline: null,
			})
		).toThrow(expect.objectContaining({ reason: 'asset-action-recovery-baseline-missing' }));
		expect(() => requiredActionBaseline(null)).toThrow(
			expect.objectContaining({ reason: 'asset-action-recovery-baseline-missing' })
		);
	});

	it('matches only the exact signed transaction', () => {
		expect(atomicActionRecordMatcher(TRANSACTION)({ txId: TRANSACTION })).toBe(true);
		expect(atomicActionRecordMatcher(TRANSACTION)({ txId: 'X' })).toBe(false);
		expect(atomicActionRecordMatcher(TRANSACTION)(null)).toBe(false);
	});

	it('resumes each prepared action with its exact transaction', () => {
		expect(preparedAtomicOperation({ kind: 'sell' }, TRANSACTION, '2', null)).toEqual({
			kind: 'sell',
			resumeId: TRANSACTION,
			value: '2',
		});
		expect(preparedAtomicOperation({ kind: 'cancel', order: ORDER }, TRANSACTION, '', { startingSlot: 3 })).toEqual(
			{
				kind: 'cancel',
				order: ORDER,
				resumeId: TRANSACTION,
				startingSlot: 3,
			}
		);
		expect(preparedAtomicOperation({ kind: 'transfer' }, TRANSACTION, 'R', { startingSlot: 3 })).toEqual({
			kind: 'transfer',
			resumeId: TRANSACTION,
			startingSlot: 3,
			value: 'R',
		});
	});
});

describe('exact action baselines', () => {
	it('restores the saved starting slot of a resumed cancellation or transfer', () => {
		expect(initialExactActionBaseline({ kind: 'transfer', startingSlot: 12 })).toEqual({ startingSlot: 12 });
		expect(initialExactActionBaseline({ kind: 'cancel', order: ORDER, resumeId: TRANSACTION })).toEqual({
			startingSlot: 0,
		});
		expect(initialExactActionBaseline({ kind: 'transfer', startingSlot: 1.5 })).toBeNull();
		expect(initialExactActionBaseline({ kind: 'sell', resumeId: TRANSACTION })).toBeNull();
		expect(initialExactActionBaseline({ kind: 'buy', order: ORDER })).toBeNull();
	});

	it('reads the starting slot from live asset state', () => {
		expect(exactActionBaselineFromSlot('40')).toEqual({ startingSlot: 40 });
		expect(exactActionBaselineFromSlot(0)).toEqual({ startingSlot: 0 });
		for (const slot of [undefined, '-1', 'abc', 1.5, Number.MAX_SAFE_INTEGER + 2]) {
			expect(() => exactActionBaselineFromSlot(slot)).toThrow(
				expect.objectContaining({ reason: 'asset-action-starting-slot-unavailable' })
			);
		}
	});

	it('forgets only refused cancellations and transfers that were attempted', () => {
		expect(rejectedActionTransactionId(appError('asset-cancel-rejected'), TRANSACTION)).toBe(TRANSACTION);
		expect(rejectedActionTransactionId(appError('fungible-transfer-rejected'), TRANSACTION)).toBe(TRANSACTION);
		expect(rejectedActionTransactionId(appError('fungible-transfer-rejected'), undefined)).toBeNull();
		expect(rejectedActionTransactionId(appError('transaction-dispatch-rejected'), TRANSACTION)).toBeNull();
	});
});
