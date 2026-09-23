import { describe, expect, it } from 'vitest';

import type { Collection } from 'api/collections';
import type { AssetState, SwapOrder } from 'api/marketplace';

import {
	fungibleListingDraft,
	fungibleMarketView,
	fungibleTokenIdentity,
} from 'features/AssetDetail/model/fungible-market-view';

const SELLER = 's'.repeat(43);
const OTHER = 'c'.repeat(43);
const BUYER = 'b'.repeat(43);

function order(id: string, creator: string, quantity: string, asking: string, overrides: Partial<SwapOrder> = {}) {
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
		...overrides,
	} satisfies SwapOrder;
}

const OWN = order('a', SELLER, '1000', '5000000000');
const OTHERS = order('b', OTHER, '2000', '12000000000');
const RESERVED = order('d', OTHER, '500', '3000000000', { status: 'reserved' });
const RESERVED_FOR_WALLET = order('e', OTHER, '700', '4000000000', { recipient: SELLER });

function state(overrides: Partial<AssetState> = {}): AssetState {
	return {
		device: 'token@1.0',
		name: 'Test token',
		ticker: 'TEST',
		denomination: 2,
		totalSupply: '100000',
		balances: { [SELLER]: '5000', [OTHER]: '3000' },
		orders: {
			[OWN.orderId]: OWN,
			[OTHERS.orderId]: OTHERS,
			[RESERVED.orderId]: RESERVED,
			[RESERVED_FOR_WALLET.orderId]: RESERVED_FOR_WALLET,
		},
		swapHeight: 0,
		value: null,
		raw: {},
		...overrides,
	};
}

describe('fungible market view', () => {
	it('separates open liquidity from the lots a wallet may not buy', () => {
		const view = fungibleMarketView(state(), SELLER);
		expect(view.orders).toHaveLength(4);
		// Open asks stay in unit-price order.
		expect(view.openOrders.map((item) => item.orderId)).toEqual([
			OWN.orderId,
			RESERVED_FOR_WALLET.orderId,
			OTHERS.orderId,
		]);
		// The wallet's own listing and the lot reserved for it are excluded from its purchasable depth.
		expect(view.purchasableOrders.map((item) => item.orderId)).toEqual([OTHERS.orderId]);
		expect(view.forSale).toBe('3700');
		expect(view.purchasableQuantity).toBe('2000');
		expect(view.excludedQuantity).toBe('1700');
		expect(view.maximumPurchaseQuantity).toBe('20');
		expect(view.best?.orderId).toBe(OWN.orderId);
	});

	it('reports wallet balances and listing capacity', () => {
		const connected = fungibleMarketView(state(), SELLER);
		expect(connected).toMatchObject({
			liquid: '5000',
			listed: '1000',
			hasLiquidTokens: true,
			maximumListingQuantity: '50',
			holderBalancesAvailable: true,
		});

		const disconnected = fungibleMarketView(state(), null);
		expect(disconnected).toMatchObject({ liquid: '0', listed: '0', hasLiquidTokens: false });
		expect(disconnected.purchasableOrders).toHaveLength(3);
	});

	it('handles an empty book and incomplete balance state', () => {
		const empty = fungibleMarketView(state({ orders: {}, holderBalancesAvailable: false, balances: {} }), BUYER);
		expect(empty).toMatchObject({
			best: null,
			forSale: '0',
			purchasableQuantity: '0',
			excludedQuantity: '0',
			holderBalancesAvailable: false,
			hasLiquidTokens: false,
		});
		expect(empty.orderDepths).toEqual([]);
	});

	it('builds cumulative open depth for the visible rows', () => {
		const view = fungibleMarketView(state(), null);
		expect(view.orderDepths).toHaveLength(4);
		expect(view.orderDepths[view.orderDepths.length - 1]).toBe(100);
	});
});

describe('fungible token identity', () => {
	it('falls back to a generic ticker and the collection description', () => {
		const collection = {
			id: 'k'.repeat(43),
			name: 'Tokens',
			description: 'Collection copy.',
			kind: 'tokens',
			assets: [],
		} satisfies Collection;
		expect(fungibleTokenIdentity(state(), collection)).toMatchObject({
			ticker: 'TEST',
			tickerDisplay: '$TEST',
			collectionName: 'Tokens',
			description: 'Collection copy.',
		});

		const identity = fungibleTokenIdentity(
			state({ ticker: '', raw: { description: 'Process copy.' } }),
			collection
		);
		expect(identity).toMatchObject({ ticker: 'Token', description: 'Process copy.' });
	});
});

describe('fungible listing draft', () => {
	it('accepts a lot within the liquid balance and quotes its AR total', () => {
		expect(fungibleListingDraft('10', '0.5', state(), '5000')).toEqual({
			quantityError: '',
			unitPriceError: '',
			quote: '5',
			ready: true,
		});
	});

	it('explains malformed amounts, oversized lots, and invalid prices', () => {
		expect(fungibleListingDraft('1.005', '0.5', state(), '5000').quantityError).toContain(
			'no more than 2 decimal places'
		);
		expect(fungibleListingDraft('60', '0.5', state(), '5000').quantityError).toBe('You can list up to 50 $TEST.');
		expect(fungibleListingDraft('10', '0', state(), '5000')).toMatchObject({
			unitPriceError: 'Enter a positive AR price with no more than 12 decimal places.',
			quote: null,
			ready: false,
		});
		expect(fungibleListingDraft('', '', state(), '5000')).toEqual({
			quantityError: '',
			unitPriceError: '',
			quote: null,
			ready: false,
		});
	});
});
