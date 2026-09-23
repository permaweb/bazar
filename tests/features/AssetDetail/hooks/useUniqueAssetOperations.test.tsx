// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssetSummary } from 'api/collections';
import type { AssetState, SwapOrder } from 'api/marketplace';
import {
	atomicPurchaseStorageKey,
	type Operation,
	type OperationActivity,
	operationClaimStorageKey,
	operationStorageKey,
} from 'api/operations';

import { useUniqueAssetOperations } from 'features/AssetDetail/hooks/useUniqueAssetOperations';

import { renderHook, settle } from '../../../test-utils/render-hook';

const assetId = 'A'.repeat(43);
const collectionId = 'created-on-bazar';
const wallet = 'W'.repeat(43);
const seller = 'S'.repeat(43);
const txId = 'T'.repeat(43);
const registrationId = 'R'.repeat(43);
const paymentId = 'P'.repeat(43);
const orderId = 'O'.repeat(43);
const signedTransactionKey = `bazar-signed-transaction:${registrationId}`;

const start = vi.fn();
const remove = vi.fn();
const show = vi.fn();
const refreshAsset = vi.fn(async () => undefined);
const restore = vi.fn();
const findStoredRegistration = vi.fn();
const activities: OperationActivity[] = [];

vi.mock('providers/OperationActivityProvider', () => ({
	useOperationActivity: () => ({ activities, start, remove, show }),
}));

vi.mock('features/TransactionSync', () => ({ preloadArweaveTransactionSync: vi.fn() }));

vi.mock('api/transactions', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/transactions')>()),
	preloadAtomicTransactionRuntime: vi.fn(),
	loadAtomicTransactionRuntime: () =>
		Promise.resolve({
			AssetTransactionClient: class {
				restore(id: string, signer: string) {
					return restore(id, signer);
				}
				findStoredRegistration(processId: string, order: string, signer: string) {
					return findStoredRegistration(processId, order, signer);
				}
			},
		}),
}));

const asset: AssetSummary = { id: assetId, name: 'AntiqueWhite' };

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
		orders: {},
		swapHeight: 100,
		value: null,
		raw: {},
		...overrides,
	};
}

function input(overrides: Partial<Parameters<typeof useUniqueAssetOperations>[0]> = {}) {
	return {
		assetId,
		collectionId,
		walletAddress: wallet,
		verifiedAsset: asset,
		state: assetState(),
		refreshAsset,
		...overrides,
	};
}

beforeEach(() => {
	localStorage.clear();
	activities.length = 0;
	start.mockReset();
	remove.mockReset();
	show.mockReset();
	refreshAsset.mockReset();
	restore.mockReset();
	findStoredRegistration.mockReset().mockReturnValue(null);
});

afterEach(() => vi.restoreAllMocks());

describe('unique asset operations', () => {
	it('starts an operation for the verified asset and connected wallet only', async () => {
		const harness = renderHook(useUniqueAssetOperations, input());
		await settle(2);
		const operation: Operation = { kind: 'sell' };
		React.act(() => harness.current().openOperation(operation));
		expect(start).toHaveBeenCalledWith(
			expect.objectContaining({ asset, collectionId, owner: wallet, operation }),
			undefined
		);

		start.mockReset();
		harness.rerender(input({ walletAddress: null }));
		React.act(() => harness.current().openOperation(operation));
		expect(start).not.toHaveBeenCalled();
		harness.unmount();
	});

	it('resumes a saved purchase that already holds a signed seller payment', async () => {
		localStorage.setItem(
			atomicPurchaseStorageKey(assetId, wallet),
			JSON.stringify({
				buyer: wallet,
				order: openOrder,
				snapshot: {
					registration: { id: registrationId, dispatched: true },
					payment: { id: paymentId, dispatched: true },
				},
			})
		);
		const harness = renderHook(useUniqueAssetOperations, input());
		await settle(3);
		expect(start).toHaveBeenCalledWith(
			expect.objectContaining({
				operation: expect.objectContaining({ kind: 'buy', order: openOrder }),
			}),
			{ show: false }
		);
		harness.unmount();
	});

	it('pauses a saved purchase whose order is gone and keeps its signed transaction', async () => {
		localStorage.setItem(
			atomicPurchaseStorageKey(assetId, wallet),
			JSON.stringify({
				buyer: wallet,
				order: openOrder,
				snapshot: { registration: { id: registrationId, dispatched: true } },
			})
		);
		const harness = renderHook(useUniqueAssetOperations, input({ state: assetState({ orders: {} }) }));
		await settle(3);
		expect(start).not.toHaveBeenCalled();
		expect(harness.current().notice).toEqual({ kind: 'purchase-paused' });
		expect(localStorage.getItem(atomicPurchaseStorageKey(assetId, wallet))).not.toBeNull();
		React.act(() => harness.current().dismissNotice());
		expect(harness.current().notice).toBeNull();
		harness.unmount();
	});

	it('removes a purchase record that holds nothing signed', async () => {
		localStorage.setItem(
			atomicPurchaseStorageKey(assetId, wallet),
			JSON.stringify({ buyer: wallet, order: openOrder })
		);
		const harness = renderHook(useUniqueAssetOperations, input());
		await settle(3);
		expect(localStorage.getItem(atomicPurchaseStorageKey(assetId, wallet))).toBeNull();
		expect(start).not.toHaveBeenCalled();
		harness.unmount();
	});

	it('resumes a signed listing whose transaction is still in this browser', async () => {
		localStorage.setItem(
			operationStorageKey(assetId, wallet),
			JSON.stringify({ assetId, signer: wallet, txId, kind: 'sell', value: '1000' })
		);
		const harness = renderHook(useUniqueAssetOperations, input());
		await settle(3);
		expect(restore).toHaveBeenCalledWith(txId, wallet);
		expect(start).toHaveBeenCalledWith(
			expect.objectContaining({ operation: { kind: 'sell', resumeId: txId, value: '1000' } }),
			{ show: false }
		);
		expect(harness.current().unavailableRecovery).toBeNull();
		harness.unmount();
	});

	it('keeps tracking a signed action whose transaction is missing but could still apply', async () => {
		localStorage.setItem(
			operationStorageKey(assetId, wallet),
			JSON.stringify({ assetId, signer: wallet, txId, kind: 'sell', value: '1000' })
		);
		restore.mockImplementation(() => {
			throw new Error('signed-transaction-not-found');
		});
		const harness = renderHook(useUniqueAssetOperations, input());
		await settle(3);
		expect(start).not.toHaveBeenCalled();
		expect(harness.current().unavailableRecovery).toEqual({
			key: operationStorageKey(assetId, wallet),
			kind: 'sell',
			signer: wallet,
			txId,
		});

		React.act(() => harness.current().discardUnavailableRecovery());
		expect(localStorage.getItem(operationStorageKey(assetId, wallet))).toBeNull();
		expect(harness.current().unavailableRecovery).toBeNull();
		expect(harness.current().notice).toEqual({ kind: 'tracking-discarded' });
		harness.unmount();
	});

	it('removes a stale signed action that live state proves can no longer apply', async () => {
		localStorage.setItem(
			operationStorageKey(assetId, wallet),
			JSON.stringify({ assetId, signer: wallet, txId, kind: 'sell', value: '1000' })
		);
		restore.mockImplementation(() => {
			throw new Error('signed-transaction-not-found');
		});
		const harness = renderHook(
			useUniqueAssetOperations,
			input({ state: assetState({ balances: { [seller]: '1' } }) })
		);
		await settle(3);
		expect(localStorage.getItem(operationStorageKey(assetId, wallet))).toBeNull();
		expect(harness.current().unavailableRecovery).toBeNull();
		expect(harness.current().notice).toEqual({ kind: 'stale-action-removed' });
		harness.unmount();
	});

	it('continues a reservation another tab signed for the live order', async () => {
		localStorage.setItem(signedTransactionKey, JSON.stringify({ transaction: { id: registrationId } }));
		findStoredRegistration.mockReturnValue(registrationId);
		const harness = renderHook(
			useUniqueAssetOperations,
			input({ state: assetState({ orders: { [orderId]: openOrder } }) })
		);
		await settle(3);
		expect(findStoredRegistration).toHaveBeenCalledWith(assetId, orderId, wallet);
		expect(start).toHaveBeenCalledWith(
			expect.objectContaining({
				operation: {
					kind: 'buy',
					order: openOrder,
					resume: { registration: { id: registrationId, dispatched: false } },
				},
			}),
			{ show: false }
		);
		harness.unmount();
	});

	it('leaves recovery alone while an operation is already open', async () => {
		activities.push({
			id: 'active',
			asset,
			collectionId,
			owner: wallet,
			operation: { kind: 'sell' },
			phase: 'form',
			status: { text: '' },
			confirmations: 0,
			confirmationTarget: 5,
			createdAt: 1,
		} as OperationActivity);
		localStorage.setItem(
			operationStorageKey(assetId, wallet),
			JSON.stringify({ assetId, signer: wallet, txId, kind: 'sell', value: '1000' })
		);
		const harness = renderHook(useUniqueAssetOperations, input());
		await settle(3);
		expect(restore).not.toHaveBeenCalled();
		expect(harness.current().operation).toEqual({ kind: 'sell' });
		harness.unmount();
	});

	it('yields a fresh operation to another tab that claimed the wallet', async () => {
		activities.push({
			id: 'active',
			asset,
			collectionId,
			owner: wallet,
			operation: { kind: 'sell' },
			phase: 'form',
			status: { text: '' },
			confirmations: 0,
			confirmationTarget: 5,
			createdAt: 1,
		} as OperationActivity);
		const harness = renderHook(useUniqueAssetOperations, input());
		await settle(2);
		await React.act(async () => {
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: operationClaimStorageKey(assetId, wallet),
					newValue: 'claimed',
					storageArea: localStorage,
				})
			);
			await Promise.resolve();
		});
		expect(remove).toHaveBeenCalledWith('active');
		expect(refreshAsset).not.toHaveBeenCalled();
		harness.unmount();
	});

	it('refreshes live state when another tab finishes its recovery', async () => {
		const harness = renderHook(useUniqueAssetOperations, input());
		await settle(2);
		await React.act(async () => {
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: operationStorageKey(assetId, wallet),
					newValue: null,
					storageArea: localStorage,
				})
			);
			await Promise.resolve();
		});
		expect(refreshAsset).toHaveBeenCalled();
		harness.unmount();
	});

	it('ignores storage changes for other keys and other browser storage areas', async () => {
		const harness = renderHook(useUniqueAssetOperations, input());
		await settle(2);
		await React.act(async () => {
			window.dispatchEvent(
				new StorageEvent('storage', { key: 'unrelated-key', newValue: null, storageArea: localStorage })
			);
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: operationStorageKey(assetId, wallet),
					newValue: null,
					storageArea: sessionStorage,
				})
			);
			await Promise.resolve();
		});
		expect(refreshAsset).not.toHaveBeenCalled();
		harness.unmount();
	});

	it('does not recover for a fungible process', async () => {
		localStorage.setItem(
			operationStorageKey(assetId, wallet),
			JSON.stringify({ assetId, signer: wallet, txId, kind: 'sell', value: '1000' })
		);
		const harness = renderHook(useUniqueAssetOperations, input({ state: assetState({ totalSupply: '1000' }) }));
		await settle(3);
		expect(restore).not.toHaveBeenCalled();
		harness.unmount();
	});
});
