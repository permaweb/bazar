// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssetSummary, Collection } from 'api/collections';
import type { AssetState, SwapOrder } from 'api/marketplace';
import {
	FUNGIBLE_OPERATION_ACTIVITY_CHANGE_EVENT,
	fungibleBatchStorageKey,
	operationClaimStorageKey,
	operationStorageKey,
} from 'api/operations';

import {
	type FungibleOperationActivities,
	useFungibleOperationActivities,
} from 'features/AssetDetail/hooks/useFungibleOperationActivities';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ restore: vi.fn() }));

vi.mock('api/transactions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('api/transactions')>();
	class MockClient {
		restore(id: string, owner: string) {
			return mocks.restore(id, owner);
		}
	}
	return { ...actual, AssetTransactionClient: MockClient };
});

const ASSET_ID = 'a'.repeat(43);
const COLLECTION_ID = 'k'.repeat(43);
const SELLER = 's'.repeat(43);
const OTHER = 'c'.repeat(43);
const TX = 't'.repeat(43);
const REGISTRATION = 'r'.repeat(43);
const PAYMENT = 'p'.repeat(43);

const ORDER = {
	orderId: 'o'.repeat(43),
	creator: SELLER,
	recipient: 'q'.repeat(43),
	asking: '5000000000',
	deposit: '0',
	minimumFee: '0',
	deadline: 0,
	createdAt: 1,
	quantity: '1000',
	status: 'open',
} satisfies SwapOrder;

const ASSET: AssetSummary = { id: ASSET_ID, name: 'Test Token', ticker: 'TEST' };
const COLLECTION: Collection = {
	id: COLLECTION_ID,
	name: 'Tokens',
	description: 'Tokens',
	kind: 'tokens',
	assets: [ASSET],
};

function assetState(overrides: Partial<AssetState> = {}): AssetState {
	return {
		device: 'token@1.0',
		name: 'Test token',
		ticker: 'TEST',
		denomination: 2,
		totalSupply: '100000',
		balances: { [SELLER]: '5000' },
		orders: { [ORDER.orderId]: ORDER },
		swapHeight: 0,
		value: null,
		raw: {},
		...overrides,
	};
}

let root: Root;
let host: HTMLElement;
let announcements: unknown[] = [];
let refresh: ReturnType<typeof vi.fn>;
let view: FungibleOperationActivities;

function Probe(props: { state: AssetState; walletAddress: string | null }) {
	view = useFungibleOperationActivities({
		asset: ASSET,
		collectionId: COLLECTION.id,
		state: props.state,
		walletAddress: props.walletAddress,
		onRefresh: refresh,
	});
	return null;
}

function render(walletAddress: string | null = SELLER, state = assetState()) {
	React.act(() =>
		root.render(
			<MemoryRouter initialEntries={['/asset/collection/token']}>
				<Probe state={state} walletAddress={walletAddress} />
			</MemoryRouter>
		)
	);
}

async function settle() {
	await React.act(async () => {
		await Promise.resolve();
	});
}

function recordAnnouncement(event: Event) {
	announcements.push((event as CustomEvent).detail);
}

beforeEach(() => {
	localStorage.clear();
	announcements = [];
	refresh = vi.fn(async () => undefined);
	mocks.restore.mockReset();
	mocks.restore.mockReturnValue({ id: TX });
	window.addEventListener(FUNGIBLE_OPERATION_ACTIVITY_CHANGE_EVENT, recordAnnouncement);
	host = document.createElement('div');
	document.body.append(host);
	root = createRoot(host);
});

afterEach(() => {
	React.act(() => root.unmount());
	window.removeEventListener(FUNGIBLE_OPERATION_ACTIVITY_CHANGE_EVENT, recordAnnouncement);
	host.remove();
	vi.restoreAllMocks();
});

describe('useFungibleOperationActivities', () => {
	it('opens one dialog per scope and announces it to the activity centre', () => {
		render();
		React.act(() => view.open({ kind: 'sell', quantity: '5' }));
		expect(view.walletActivities).toHaveLength(1);
		expect(view.walletActivities[0].visible).toBe(true);
		expect(view.assetBlocksActions).toBe(true);
		expect(view.purchaseBlocksActions).toBe(false);
		expect(announcements).toEqual([
			{
				type: 'upsert',
				activity: expect.objectContaining({
					id: `fungible:${ASSET_ID}:${SELLER}:asset`,
					collectionId: COLLECTION_ID,
					operationKind: 'sell',
					owner: SELLER,
					phase: 'form',
					status: 'Waiting for details',
				}),
			},
		]);

		// A second asset action reveals the dialog that already owns the scope.
		React.act(() => view.hide(view.walletActivities[0].id));
		expect(view.walletActivities[0].visible).toBe(false);
		React.act(() => view.open({ kind: 'transfer' }));
		expect(view.walletActivities).toHaveLength(1);
		expect(view.walletActivities[0].operation.kind).toBe('sell');
		expect(view.walletActivities[0].visible).toBe(true);
	});

	it('ignores operations without a connected wallet', () => {
		render(null);
		React.act(() => view.open({ kind: 'sell' }));
		expect(view.walletActivities).toEqual([]);
		expect(announcements).toEqual([]);
	});

	it('announces the phase of a running operation and refreshes once it completes', async () => {
		render();
		React.act(() => view.open({ kind: 'sell' }));
		const id = view.walletActivities[0].id;
		React.act(() =>
			view.change(id, {
				phase: 'working',
				status: 'Watching Arweave confirmations…',
				confirmations: 2,
				confirmationTarget: 5,
			})
		);
		expect(view.walletActivities[0].phase).toBe('working');
		expect(announcements.at(-1)).toMatchObject({
			type: 'upsert',
			activity: { phase: 'working', confirmations: 2, confirmationTarget: 5 },
		});
		expect(refresh).not.toHaveBeenCalled();

		React.act(() => view.change(id, { phase: 'done', status: 'Complete' }));
		expect(announcements.at(-1)).toEqual({ type: 'remove', id, owner: SELLER });
		expect(refresh).toHaveBeenCalledTimes(1);
		await settle();
	});

	it('closes a dialog outright or keeps it for later', async () => {
		render();
		React.act(() => view.open({ kind: 'sell' }));
		React.act(() => view.close(view.walletActivities[0], true));
		expect(view.walletActivities).toHaveLength(1);
		expect(view.walletActivities[0].visible).toBe(false);
		expect(view.recoverySuppressed).toBe(true);
		expect(refresh).toHaveBeenCalledTimes(1);

		React.act(() => view.resumeRecovery());
		expect(view.recoverySuppressed).toBe(false);
		React.act(() => view.close(view.walletActivities[0], false, false));
		expect(view.walletActivities).toEqual([]);
		expect(announcements.at(-1)).toMatchObject({ type: 'remove' });
		expect(refresh).toHaveBeenCalledTimes(1);
		await settle();
	});

	it('withdraws every open dialog when the wallet changes', () => {
		render();
		React.act(() => view.open({ kind: 'sell' }));
		announcements = [];
		render(OTHER);
		expect(announcements).toEqual([{ type: 'remove', id: `fungible:${ASSET_ID}:${SELLER}:asset`, owner: SELLER }]);
		expect(view.walletActivities).toEqual([]);
	});

	it('restores a saved signed listing as a hidden dialog', async () => {
		localStorage.setItem(
			operationStorageKey(ASSET_ID, SELLER),
			JSON.stringify({
				txId: TX,
				kind: 'sell',
				assetId: ASSET_ID,
				signer: SELLER,
				quantity: '5',
				unitPrice: '0.5',
			})
		);
		render();
		await settle();
		expect(mocks.restore).toHaveBeenCalledWith(TX, SELLER);
		expect(view.walletActivities).toHaveLength(1);
		expect(view.walletActivities[0].operation).toMatchObject({ kind: 'sell', quantity: '5', resumeId: TX });
		expect(view.walletActivities[0].visible).toBe(false);
		expect(view.unavailableRecovery).toBeNull();
	});

	it('offers manual recovery when the signed transaction is missing but can still apply', async () => {
		mocks.restore.mockImplementation(() => {
			throw new Error('signature missing');
		});
		const key = operationStorageKey(ASSET_ID, SELLER);
		localStorage.setItem(
			key,
			JSON.stringify({
				txId: TX,
				kind: 'sell',
				assetId: ASSET_ID,
				signer: SELLER,
				quantity: '5',
				unitPrice: '0.5',
			})
		);
		render();
		await settle();
		expect(view.walletActivities).toEqual([]);
		expect(view.unavailableRecovery).toEqual({ key, kind: 'sell', signer: SELLER, txId: TX });
		expect(view.assetBlocksActions).toBe(true);

		React.act(() => view.discardUnavailableRecovery());
		expect(localStorage.getItem(key)).toBeNull();
		expect(view.unavailableRecovery).toBeNull();
		expect(view.recoveryNotice).toContain('Local tracking was discarded');

		React.act(() => view.dismissRecoveryNotice());
		expect(view.recoveryNotice).toBe('');
	});

	it('removes a saved action that live state proves can no longer apply', async () => {
		mocks.restore.mockImplementation(() => {
			throw new Error('signature missing');
		});
		const key = operationStorageKey(ASSET_ID, SELLER);
		localStorage.setItem(
			key,
			JSON.stringify({
				txId: TX,
				kind: 'transfer',
				assetId: ASSET_ID,
				signer: SELLER,
				quantity: '999999',
				recipient: OTHER,
			})
		);
		render();
		await settle();
		expect(localStorage.getItem(key)).toBeNull();
		expect(view.unavailableRecovery).toBeNull();
		expect(view.recoveryNotice).toContain('no longer apply');
	});

	it('resumes a saved purchase batch that still matches the live order', async () => {
		localStorage.setItem(
			fungibleBatchStorageKey(ASSET_ID, SELLER),
			JSON.stringify({
				version: 3,
				buyer: SELLER,
				startingBalance: '100',
				attemptId: 'attempt-1',
				entries: [
					{
						order: ORDER,
						fillQuantity: '1000',
						paymentCost: '100',
						snapshot: {
							registration: { id: REGISTRATION, dispatched: true },
							payment: { id: PAYMENT, dispatched: true },
						},
					},
				],
			})
		);
		render();
		await settle();
		expect(view.walletActivities).toHaveLength(1);
		expect(view.walletActivities[0].operation).toMatchObject({ kind: 'buy', startingBalance: '100' });
		expect(view.purchaseBlocksActions).toBe(true);
	});

	it('clears a stale unpaid batch and explains why', async () => {
		const key = fungibleBatchStorageKey(ASSET_ID, SELLER);
		localStorage.setItem(
			key,
			JSON.stringify({
				version: 3,
				buyer: SELLER,
				startingBalance: '100',
				attemptId: 'attempt-1',
				entries: [
					{
						order: { ...ORDER, orderId: 'z'.repeat(43) },
						fillQuantity: '1000',
						paymentCost: '100',
						snapshot: { registration: { id: REGISTRATION, dispatched: true } },
					},
				],
			})
		);
		render();
		await settle();
		expect(localStorage.getItem(key)).toBeNull();
		expect(view.recoveryNotice).toContain('stale unpaid purchase was cleared');
		expect(view.walletActivities).toEqual([]);
	});

	it('discards a saved batch that no longer parses', async () => {
		const key = fungibleBatchStorageKey(ASSET_ID, SELLER);
		localStorage.setItem(key, '{not json');
		render();
		await settle();
		expect(localStorage.getItem(key)).toBeNull();
	});

	it('follows another tab that claims the same wallet scope', async () => {
		render();
		React.act(() => view.open({ kind: 'sell' }));
		React.act(() => view.open({ kind: 'buy', availableOrders: [ORDER], startingBalance: '0' }));
		expect(view.walletActivities).toHaveLength(2);

		React.act(() => {
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: operationClaimStorageKey(ASSET_ID, SELLER, 'asset'),
					newValue: '{"attemptId":"other-tab"}',
					storageArea: localStorage,
				})
			);
		});
		await settle();
		expect(view.walletActivities.map((activity) => activity.operation.kind)).toEqual(['buy']);
		expect(refresh).not.toHaveBeenCalled();

		React.act(() => {
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: fungibleBatchStorageKey(ASSET_ID, SELLER),
					newValue: null,
					storageArea: localStorage,
				})
			);
		});
		await settle();
		expect(view.walletActivities).toEqual([]);
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('ignores storage events from another origin store', async () => {
		render();
		React.act(() => view.open({ kind: 'sell' }));
		React.act(() => {
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: operationStorageKey(ASSET_ID, SELLER),
					newValue: null,
					storageArea: sessionStorage,
				})
			);
		});
		await settle();
		expect(view.walletActivities).toHaveLength(1);
		expect(refresh).not.toHaveBeenCalled();
	});
});
