import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { AssetState, SwapOrder } from 'api/marketplace';
import type { OperationActivity } from 'api/operations';

import UniqueAssetCommerceCard from 'features/AssetDetail/components/organisms/UniqueAssetCommerceCard/UniqueAssetCommerceCard';
import type { UniqueAssetView } from 'features/AssetDetail/model/unique-asset-view';

vi.mock('features/AssetDetail/components/molecules/SetProfilePictureButton', () => ({
	SetProfilePictureButton: (props: { disabled: boolean }) => (
		<span className="profile-picture-button" data-disabled={String(props.disabled)} />
	),
}));

const assetId = 'A'.repeat(43);
const wallet = 'W'.repeat(43);
const seller = 'S'.repeat(43);
const orderId = 'O'.repeat(43);

const asset = { id: assetId, name: 'AntiqueWhite', image: `https://arweave.net/${assetId}` };

const state = {
	device: 'token@1.0',
	name: 'AntiqueWhite',
	ticker: 'ASSET',
	denomination: 0,
	totalSupply: '1',
	balances: { [wallet]: '1' },
	orders: {},
	swapHeight: 1,
	value: null,
	raw: {},
} as AssetState;

const openOrder = {
	orderId,
	creator: seller,
	recipient: 'C'.repeat(43),
	asking: '1000000000000',
	deposit: '0',
	minimumFee: '0',
	deadline: 900,
	createdAt: 10,
	quantity: '1',
	status: 'open',
} as SwapOrder;

const baseView = {
	owner: wallet,
	order: null,
	buyableOrder: null,
	balanceStateAvailable: true,
	mine: true,
	externalReservation: null,
	license: [],
	description: 'Permanent artwork',
	moreAssets: [],
	floorValue: null,
	operationBlocksActions: false,
	liveActionBlocked: false,
	newOperationBlocksActions: false,
	operationIsBusy: false,
} as UniqueAssetView;

function markup(overrides: Partial<UniqueAssetView> = {}, activity?: OperationActivity) {
	return renderToStaticMarkup(
		<UniqueAssetCommerceCard
			asset={asset}
			state={state}
			view={{ ...baseView, ...overrides }}
			walletAddress={wallet}
			operationActivity={activity}
			operation={activity?.operation ?? null}
			onOpenOperation={() => undefined}
			onShowOperation={() => undefined}
		/>
	);
}

describe('unique asset commerce card', () => {
	it('offers listing, transfer, and profile actions to the owner of an unlisted asset', () => {
		const html = markup();
		expect(html).toContain('asset-commerce-card');
		expect(html).toContain('List for sale');
		expect(html).toContain('Transfer');
		expect(html).toContain('profile-picture-button');
		expect(html).toContain('Not listed');
		expect(html).not.toContain('Buy now');
	});

	it('offers a purchase for an open order from another wallet', () => {
		const html = markup({ order: openOrder, buyableOrder: openOrder, mine: false });
		expect(html).toContain('Buy now');
		expect(html).toContain('ar-currency-label');
		expect(html).not.toContain('List for sale');
	});

	it('leads with one price, the edition, and fee guidance instead of repeated market stats', () => {
		const html = markup({ order: openOrder, buyableOrder: openOrder, mine: false });
		expect(html).toContain('asset-purchase-summary');
		expect(html).toContain('<span>Price</span>');
		expect(html).toContain('1 of 1');
		expect(html).toContain('Network fees are shown before you approve.');
		expect(html).not.toContain('asset-market-stats');
		expect(html).not.toContain('Current ask');
		expect(html).not.toContain('Order status');
		expect(html).not.toContain('License terms');
	});

	it('names a reserved order without repeating its price', () => {
		const html = markup({ order: { ...openOrder, status: 'reserved' }, mine: false });
		expect(html).toContain('Reserved at');
		expect(html.match(/asset-buy-summary/g)).toHaveLength(1);
	});

	it('offers cancellation for the owner of an open listing', () => {
		const html = markup({ order: openOrder, buyableOrder: openOrder });
		expect(html).toContain('Cancel listing');
		expect(html).not.toContain('Transfer');
	});

	it('disables new actions while live state or a saved recovery blocks them', () => {
		expect(markup({ newOperationBlocksActions: true })).toContain('disabled=""');
		expect(markup({ liveActionBlocked: true })).toContain('data-disabled="true"');
	});

	it('labels a reserved order and marks the card busy while an operation runs', () => {
		const activity = {
			id: 'active',
			asset,
			collectionId: 'created-on-bazar',
			owner: wallet,
			operation: { kind: 'buy', order: openOrder },
			phase: 'working',
			status: { text: 'Reserving the asset' },
			confirmations: 1,
			confirmationTarget: 5,
			createdAt: 1,
		} as OperationActivity;
		const html = markup(
			{
				order: { ...openOrder, status: 'reserved', buyer: wallet } as SwapOrder,
				mine: false,
				operationIsBusy: true,
			},
			activity
		);
		expect(html).toContain('Reserved at');
		expect(html).toContain('aria-busy="true"');
		expect(html).toContain('Reserving the asset');
	});
});
