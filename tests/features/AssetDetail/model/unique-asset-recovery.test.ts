import { describe, expect, it } from 'vitest';

import type { AssetState, SwapOrder } from 'api/marketplace';
import type { Operation, OperationActivity } from 'api/operations';
import type { PurchaseSnapshot } from 'api/transactions';

import {
	activeAssetOperation,
	INITIAL_UNIQUE_ASSET_RECOVERY,
	isSavedAtomicOperation,
	isStoredAtomicPurchase,
	operationIsRecovering,
	recoveryStorageReaction,
	registrationRecoveryOrder,
	resumedRegistrationOperation,
	resumedSavedOperation,
	type SavedAtomicOperation,
	savedOperationRecordMatches,
	savedPurchaseRecoveryPlan,
	storedPurchaseDiscardable,
	unavailableRecoveryRecordMatches,
	uniqueAssetRecoveryReducer,
	unrestorableOperationPlan,
} from 'features/AssetDetail/model/unique-asset-recovery';

const assetId = 'A'.repeat(43);
const wallet = 'W'.repeat(43);
const seller = 'S'.repeat(43);
const txId = 'T'.repeat(43);
const registrationId = 'R'.repeat(43);
const paymentId = 'P'.repeat(43);
const orderId = 'O'.repeat(43);
const gateway = { arweave: 'https://arweave.net', compute: 'https://compute.example' };

const openOrder = {
	orderId,
	creator: seller,
	recipient: 'C'.repeat(43),
	asking: '1000',
	deposit: '0',
	minimumFee: '0',
	deadline: 900,
	createdAt: 10,
	quantity: '1',
	status: 'open',
} as SwapOrder;

function assetState(overrides: Partial<AssetState> = {}): AssetState {
	return {
		device: 'token@1.0',
		name: 'AntiqueWhite',
		ticker: 'ASSET',
		denomination: 0,
		totalSupply: '1',
		balances: { [wallet]: '1' },
		orders: { [orderId]: openOrder },
		swapHeight: 100,
		value: null,
		raw: {},
		...overrides,
	};
}

const settledSnapshot: PurchaseSnapshot = {
	registration: { id: registrationId, dispatched: true },
	payment: { id: paymentId, dispatched: true },
} as PurchaseSnapshot;

const reservedSnapshot: PurchaseSnapshot = {
	registration: { id: registrationId, dispatched: true },
} as PurchaseSnapshot;

describe('stored recovery records', () => {
	it('accepts only records this wallet signed', () => {
		expect(isStoredAtomicPurchase({ buyer: wallet }, wallet)).toBe(true);
		expect(isStoredAtomicPurchase({ buyer: seller }, wallet)).toBe(false);
		expect(isStoredAtomicPurchase(null, wallet)).toBe(false);
		expect(isStoredAtomicPurchase('bazar-purchase', wallet)).toBe(false);

		expect(isSavedAtomicOperation({ signer: wallet, txId, kind: 'cancel' }, wallet)).toBe(true);
		expect(isSavedAtomicOperation({ signer: wallet, txId, kind: 'buy' }, wallet)).toBe(false);
		expect(isSavedAtomicOperation({ signer: wallet, txId: 'short', kind: 'sell' }, wallet)).toBe(false);
		expect(isSavedAtomicOperation({ signer: seller, txId, kind: 'sell' }, wallet)).toBe(false);
		expect(isSavedAtomicOperation(undefined, wallet)).toBe(false);
	});

	it('matches records by asset, signer, and transaction before removing them', () => {
		expect(savedOperationRecordMatches({ assetId, signer: wallet, txId }, assetId, wallet, txId)).toBe(true);
		expect(savedOperationRecordMatches({ assetId, signer: seller, txId }, assetId, wallet, txId)).toBe(false);
		expect(savedOperationRecordMatches(null, assetId, wallet, txId)).toBe(false);
		expect(
			unavailableRecoveryRecordMatches(
				{ signer: wallet, txId },
				{ key: 'bazar-operation', kind: 'sell', signer: wallet, txId }
			)
		).toBe(true);
		expect(
			unavailableRecoveryRecordMatches(
				{ signer: wallet, txId: 'X'.repeat(43) },
				{ key: 'bazar-operation', kind: 'sell', signer: wallet, txId }
			)
		).toBe(false);
	});
});

describe('saved purchase recovery', () => {
	it('resumes a purchase whose seller payment is already signed', () => {
		const plan = savedPurchaseRecoveryPlan(
			assetState(),
			wallet,
			{ buyer: wallet, order: openOrder, snapshot: settledSnapshot },
			gateway
		);
		expect(plan).toMatchObject({ kind: 'resume', gatewayNotice: '' });
		expect(plan.kind === 'resume' && plan.operation).toEqual({
			kind: 'buy',
			order: openOrder,
			resume: settledSnapshot,
		});
	});

	it('warns when the purchase was signed against other gateways', () => {
		const plan = savedPurchaseRecoveryPlan(
			assetState(),
			wallet,
			{
				buyer: wallet,
				order: openOrder,
				snapshot: settledSnapshot,
				gateway: { arweave: 'https://other.example', compute: gateway.compute },
			},
			gateway
		);
		expect(plan.kind === 'resume' && plan.gatewayNotice).toContain('Gateway selection changed');
	});

	it('discards a purchase record that holds nothing signed', () => {
		expect(savedPurchaseRecoveryPlan(assetState(), wallet, { buyer: wallet, order: openOrder }, gateway)).toEqual({
			kind: 'discard',
			orderId,
		});
		expect(storedPurchaseDiscardable({ buyer: wallet, order: openOrder }, wallet, orderId)).toBe(true);
		expect(
			storedPurchaseDiscardable({ buyer: wallet, order: openOrder, snapshot: settledSnapshot }, wallet, orderId)
		).toBe(false);
		expect(storedPurchaseDiscardable({ buyer: wallet, order: openOrder }, wallet, 'Z'.repeat(43))).toBe(false);
	});

	it('pauses a reservation whose order is gone, and does nothing without a record', () => {
		expect(
			savedPurchaseRecoveryPlan(
				assetState({ orders: {} }),
				wallet,
				{ buyer: wallet, order: openOrder, snapshot: reservedSnapshot },
				gateway
			)
		).toEqual({ kind: 'paused' });
		expect(savedPurchaseRecoveryPlan(assetState(), wallet, null, gateway)).toEqual({ kind: 'none' });
		expect(savedPurchaseRecoveryPlan(assetState(), wallet, { buyer: wallet }, gateway)).toEqual({ kind: 'none' });
	});
});

describe('saved action recovery', () => {
	it('offers a stored reservation only for an order another wallet created', () => {
		expect(registrationRecoveryOrder(assetState(), wallet)).toBe(openOrder);
		expect(registrationRecoveryOrder(assetState(), seller)).toBeNull();
		expect(registrationRecoveryOrder(assetState({ orders: {} }), wallet)).toBeNull();
		expect(resumedRegistrationOperation(openOrder, registrationId)).toEqual({
			kind: 'buy',
			order: openOrder,
			resume: { registration: { id: registrationId, dispatched: false } },
		});
	});

	it('rebuilds the operation that continues each saved action', () => {
		const saved: SavedAtomicOperation = { kind: 'cancel', signer: wallet, txId, order: openOrder, startingSlot: 7 };
		expect(resumedSavedOperation(saved)).toEqual({
			kind: 'cancel',
			order: openOrder,
			startingSlot: 7,
			resumeId: txId,
		});
		expect(
			resumedSavedOperation({ kind: 'transfer', signer: wallet, txId, startingSlot: 3, value: seller })
		).toEqual({ kind: 'transfer', resumeId: txId, startingSlot: 3, value: seller });
		expect(resumedSavedOperation({ kind: 'sell', signer: wallet, txId, value: '1000' })).toEqual({
			kind: 'sell',
			resumeId: txId,
			value: '1000',
		});
		expect(resumedSavedOperation({ kind: 'cancel', signer: wallet, txId })).toBeNull();
	});

	it('keeps tracking an unrestorable action that live state could still apply', () => {
		const saved: SavedAtomicOperation = { kind: 'sell', signer: wallet, txId, value: '1000' };
		expect(unrestorableOperationPlan(assetState({ orders: {} }), wallet, saved, 'bazar-operation')).toEqual({
			kind: 'unavailable',
			recovery: { key: 'bazar-operation', kind: 'sell', signer: wallet, txId },
		});
		expect(unrestorableOperationPlan(assetState(), wallet, saved, 'bazar-operation')).toEqual({ kind: 'discard' });
	});
});

describe('recovery reactions to other tabs', () => {
	const resuming: Operation = { kind: 'sell', resumeId: txId };
	const fresh: Operation = { kind: 'sell' };

	it('tells a fresh operation to yield and a finished recovery to refresh', () => {
		expect(recoveryStorageReaction('ignore', fresh)).toBeNull();
		expect(recoveryStorageReaction('claim-acquired', fresh)).toEqual({ removeActivity: true, refresh: false });
		expect(recoveryStorageReaction('claim-acquired', resuming)).toEqual({ removeActivity: false, refresh: false });
		expect(recoveryStorageReaction('claim-acquired', null)).toEqual({ removeActivity: false, refresh: false });
		expect(recoveryStorageReaction('claim-released', fresh)).toEqual({ removeActivity: false, refresh: false });
		expect(recoveryStorageReaction('recovery-updated', fresh)).toEqual({ removeActivity: true, refresh: false });
		expect(recoveryStorageReaction('recovery-removed', null)).toEqual({ removeActivity: true, refresh: true });
	});

	it('knows which operations are continuing a signed transaction', () => {
		expect(operationIsRecovering(resuming)).toBe(true);
		expect(operationIsRecovering(fresh)).toBe(false);
		expect(operationIsRecovering({ kind: 'buy', order: openOrder })).toBe(false);
		expect(operationIsRecovering({ kind: 'buy', order: openOrder, resume: settledSnapshot })).toBe(true);
	});

	it('finds only the unfinished operation this wallet has on the asset', () => {
		const activities = [
			{ id: 'done', asset: { id: assetId, name: 'A' }, owner: wallet, phase: 'done' },
			{ id: 'other-wallet', asset: { id: assetId, name: 'A' }, owner: seller, phase: 'working' },
			{ id: 'other-asset', asset: { id: 'B'.repeat(43), name: 'B' }, owner: wallet, phase: 'working' },
			{ id: 'active', asset: { id: assetId, name: 'A' }, owner: wallet, phase: 'approval' },
		] as OperationActivity[];
		expect(activeAssetOperation(activities, assetId, wallet)?.id).toBe('active');
		expect(activeAssetOperation(activities, assetId, null)).toBeUndefined();
		expect(activeAssetOperation([], assetId, wallet)).toBeUndefined();
	});
});

describe('unique asset recovery state', () => {
	const recovery = { key: 'bazar-operation', kind: 'sell', signer: wallet, txId } as const;

	it('tracks and clears an unavailable recovery by its record key', () => {
		const tracked = uniqueAssetRecoveryReducer(INITIAL_UNIQUE_ASSET_RECOVERY, {
			type: 'recovery-unavailable',
			recovery,
		});
		expect(tracked.unavailable).toEqual(recovery);
		expect(uniqueAssetRecoveryReducer(tracked, { type: 'recovery-cleared', key: 'other-key' })).toBe(tracked);
		expect(
			uniqueAssetRecoveryReducer(tracked, { type: 'recovery-cleared', key: recovery.key }).unavailable
		).toBeNull();
		expect(uniqueAssetRecoveryReducer(tracked, { type: 'recovery-cleared' }).unavailable).toBeNull();
	});

	it('explains a removed stale action and a discarded local record', () => {
		const tracked = uniqueAssetRecoveryReducer(INITIAL_UNIQUE_ASSET_RECOVERY, {
			type: 'recovery-unavailable',
			recovery,
		});
		expect(uniqueAssetRecoveryReducer(tracked, { type: 'stale-action-removed' })).toEqual({
			notice: { kind: 'stale-action-removed' },
			unavailable: null,
			storageVersion: 0,
		});
		expect(uniqueAssetRecoveryReducer(tracked, { type: 'tracking-discarded' })).toEqual({
			notice: { kind: 'tracking-discarded' },
			unavailable: null,
			storageVersion: 0,
		});
	});

	it('dismisses a notice, resets on a new asset, and re-evaluates on storage changes', () => {
		const noticed = uniqueAssetRecoveryReducer(INITIAL_UNIQUE_ASSET_RECOVERY, {
			type: 'notice',
			notice: { kind: 'purchase-paused' },
		});
		expect(uniqueAssetRecoveryReducer(noticed, { type: 'notice-dismissed' }).notice).toBeNull();
		expect(uniqueAssetRecoveryReducer(noticed, { type: 'reset' }).notice).toBeNull();
		expect(uniqueAssetRecoveryReducer(INITIAL_UNIQUE_ASSET_RECOVERY, { type: 'reset' })).toBe(
			INITIAL_UNIQUE_ASSET_RECOVERY
		);
		expect(uniqueAssetRecoveryReducer(INITIAL_UNIQUE_ASSET_RECOVERY, { type: 'notice-dismissed' })).toBe(
			INITIAL_UNIQUE_ASSET_RECOVERY
		);
		expect(uniqueAssetRecoveryReducer(noticed, { type: 'storage-changed' })).toMatchObject({
			storageVersion: 1,
			notice: { kind: 'purchase-paused' },
		});
	});
});
