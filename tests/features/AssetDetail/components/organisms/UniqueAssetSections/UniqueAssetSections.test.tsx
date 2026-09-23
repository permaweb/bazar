import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { Collection } from 'api/collections';
import type { AssetState } from 'api/marketplace';

import UniqueAssetSections, {
	type UniqueAssetSection,
} from 'features/AssetDetail/components/organisms/UniqueAssetSections/UniqueAssetSections';
import type { AssetActivityFeedView } from 'features/AssetDetail/model/asset-detail-activity';
import type { UniqueAssetView } from 'features/AssetDetail/model/unique-asset-view';

vi.mock('react-router-dom', () => ({
	Link: (props: { to: string; children?: React.ReactNode }) => <a href={props.to}>{props.children}</a>,
}));

const assetId = 'A'.repeat(43);
const relatedId = 'B'.repeat(43);
const owner = 'W'.repeat(43);

const asset = { id: assetId, name: 'AntiqueWhite', contentType: 'image/png', artist: 'Ada', duration: 90 };

const collection: Collection = {
	id: 'created-on-bazar',
	name: 'Created on Bazar',
	description: 'Collection description',
	kind: 'images',
	assets: [asset],
};

const state = {
	device: 'token@1.0',
	name: 'AntiqueWhite',
	ticker: 'ASSET',
	denomination: 0,
	totalSupply: '1',
	balances: { [owner]: '1' },
	orders: {},
	swapHeight: 1,
	value: null,
	raw: {},
} as AssetState;

const emptyFeed: AssetActivityFeedView = {
	events: [],
	loading: false,
	loadingMore: false,
	error: null,
	hasNextPage: false,
	totalCount: null,
};

const view = {
	owner,
	order: null,
	buyableOrder: null,
	balanceStateAvailable: true,
	mine: true,
	externalReservation: null,
	license: [{ key: 'license', label: 'License', value: 'UDL' }],
	description: 'Permanent artwork',
	moreAssets: [{ id: relatedId, name: 'Beige' }],
	floorValue: null,
	operationBlocksActions: false,
	liveActionBlocked: false,
	newOperationBlocksActions: false,
	operationIsBusy: false,
} as UniqueAssetView;

function markup(active: UniqueAssetSection, activity: AssetActivityFeedView = emptyFeed) {
	return renderToStaticMarkup(
		<UniqueAssetSections
			active={active}
			asset={asset}
			collection={collection}
			state={state}
			view={view}
			activity={activity}
			asks={emptyFeed}
			askPricePoints={[]}
			onChange={() => undefined}
			onActivityRetry={() => undefined}
			onActivityLoadMore={() => undefined}
			onAskRetry={() => undefined}
			onAskLoadMore={() => undefined}
			onPrefetchAsset={() => undefined}
		/>
	);
}

describe('unique asset sections', () => {
	it('labels every section tab for the asset page', () => {
		const html = markup('about');
		for (const label of ['About', 'Orders', 'Activity', 'Usage rights', 'Blockchain', 'More']) {
			expect(html).toContain(label);
		}
		expect(html).toContain('id="asset-about"');
	});

	it('shows the asset facts on the about panel', () => {
		const html = markup('about');
		expect(html).toContain('Permanent artwork');
		expect(html).toContain('Created on Bazar');
		expect(html).toContain('image/png');
		expect(html).toContain('Ada');
		expect(html).toContain('1:30');
	});

	it('reports an empty indexed history and how much of it is loaded', () => {
		const html = markup('activity');
		expect(html).toContain('asset-activity-panel');
		expect(html).toContain('No indexed market events found.');
		expect(html).toContain('0 indexed process submissions loaded.');
	});

	it('keeps previously loaded events visible next to a retry notice', () => {
		const html = markup('activity', {
			...emptyFeed,
			error: 'Compute unavailable',
			totalCount: 12,
			events: [
				{
					id: 'E'.repeat(43),
					processId: assetId,
					action: 'transfer',
					actor: owner,
					height: 5,
					timestamp: 50,
				},
			],
		});
		expect(html).toContain('Previously loaded events remain visible.');
		expect(html).toContain('1 of 12 indexed process submissions loaded.');
		expect(html).not.toContain('No indexed market events found.');
	});

	it('lists declared usage rights and blockchain details', () => {
		expect(markup('rights')).toContain('License');
		const blockchain = markup('blockchain');
		expect(blockchain).toContain('asset-blockchain-details');
		expect(blockchain).toContain('token@1.0');
	});

	it('links related assets from the collection', () => {
		const html = markup('more');
		expect(html).toContain(`/asset/${collection.id}/${relatedId}`);
		expect(html).toContain('Beige');
	});
});
