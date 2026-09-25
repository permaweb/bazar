import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type Collection, HIDDEN_COLLECTION_IDS, replaceHiddenCollectionAssetIndex } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';
import type { AssetState, SwapOrder } from 'api/marketplace';

import { ASSET_DETAIL_MESSAGES } from 'features/AssetDetail/messages';
import { uniqueAssetView } from 'features/AssetDetail/model/unique-asset-view';

const assetId = 'A'.repeat(43);
const otherAssetId = 'B'.repeat(43);
const wallet = 'W'.repeat(43);
const seller = 'S'.repeat(43);
const orderId = 'O'.repeat(43);
const reservationId = 'R'.repeat(43);
const readyHiddenCollectionIndex = Object.fromEntries(HIDDEN_COLLECTION_IDS.map((id) => [id, []]));

const asset = { id: assetId, name: 'AntiqueWhite', image: `https://arweave.net/${assetId}` };

const collection: Collection = {
	id: 'created-on-bazar',
	name: 'Created on Bazar',
	description: 'Fallback description',
	kind: 'images',
	assets: [asset, { id: otherAssetId, name: 'Beige' }],
};

const openOrder = {
	orderId,
	creator: seller,
	recipient: 'C'.repeat(43),
	asking: '2000',
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
		raw: { description: 'Permanent artwork' },
		...overrides,
	};
}

function view(overrides: Partial<Parameters<typeof uniqueAssetView>[0]> = {}) {
	return uniqueAssetView({
		asset,
		collection,
		state: assetState(),
		walletAddress: wallet,
		activity: [],
		loading: false,
		error: null,
		operationPhase: null,
		hasUnavailableRecovery: false,
		messages: ASSET_DETAIL_MESSAGES.en,
		...overrides,
	});
}

describe('unique asset view', () => {
	beforeEach(() => replaceHiddenCollectionAssetIndex(readyHiddenCollectionIndex));
	afterEach(() => replaceHiddenCollectionAssetIndex({}));

	it('reads ownership, description, and related assets from live state and the collection', () => {
		const presented = view();
		expect(presented.owner).toBe(wallet);
		expect(presented.mine).toBe(true);
		expect(presented.order).toBeNull();
		expect(presented.buyableOrder).toBeNull();
		expect(presented.balanceStateAvailable).toBe(true);
		expect(presented.description).toBe('Permanent artwork');
		expect(presented.moreAssets.map((item) => item.id)).toEqual([otherAssetId]);
		expect(presented.floorValue).toBeNull();
	});

	it('offers an open order for purchase and prices its floor per unit', () => {
		const listed = view({
			state: assetState({ balances: { [seller]: '1' }, orders: { [orderId]: openOrder } }),
		});
		expect(listed.order).toEqual(openOrder);
		expect(listed.buyableOrder).toEqual(openOrder);
		expect(listed.mine).toBe(false);
		expect(listed.floorValue).toBe('2000');

		const reserved = view({
			state: assetState({
				balances: { [seller]: '1' },
				orders: { [orderId]: { ...openOrder, status: 'reserved', buyer: wallet } as SwapOrder },
			}),
		});
		expect(reserved.order?.status).toBe('reserved');
		expect(reserved.buyableOrder).toBeNull();
	});

	it('surfaces a reservation this wallet made in another tab', () => {
		const reservedUntil = 1_000;
		const order = {
			...openOrder,
			status: 'reserved',
			buyer: wallet,
			deadline: 100,
			reservedUntil,
		} as SwapOrder;
		const reservation: CollectionActivityEvent = {
			id: reservationId,
			processId: assetId,
			action: 'register-interest',
			actor: wallet,
			height: reservedUntil - order.deadline,
			timestamp: 50,
			orderId,
		};
		expect(
			view({
				state: assetState({ balances: { [seller]: '1' }, orders: { [orderId]: order } }),
				activity: [reservation],
			}).externalReservation
		).toEqual(reservation);
		expect(
			view({ state: assetState({ balances: { [seller]: '1' }, orders: { [orderId]: order } }) })
				.externalReservation
		).toBeNull();
	});

	it('blocks actions while an operation, a saved recovery, or an unsettled read is in the way', () => {
		expect(view()).toMatchObject({
			operationBlocksActions: false,
			liveActionBlocked: false,
			newOperationBlocksActions: false,
			operationIsBusy: false,
		});
		expect(view({ operationPhase: 'approval' })).toMatchObject({
			operationBlocksActions: true,
			liveActionBlocked: true,
			newOperationBlocksActions: true,
			operationIsBusy: true,
		});
		expect(view({ operationPhase: 'error' })).toMatchObject({
			operationBlocksActions: true,
			operationIsBusy: false,
		});
		expect(view({ hasUnavailableRecovery: true }).operationBlocksActions).toBe(true);
		expect(view({ loading: true })).toMatchObject({
			operationBlocksActions: false,
			liveActionBlocked: true,
			newOperationBlocksActions: true,
		});
		expect(view({ error: 'Live state unavailable' }).liveActionBlocked).toBe(true);
		expect(view({ state: assetState({ holderBalancesAvailable: false }) })).toMatchObject({
			balanceStateAvailable: false,
			liveActionBlocked: false,
			newOperationBlocksActions: true,
		});
	});

	it('falls back to the collection description when the process publishes none', () => {
		expect(view({ state: assetState({ raw: {} }) }).description).toBe('Fallback description');
	});
});
