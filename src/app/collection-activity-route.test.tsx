import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { Collection } from 'api/collections';

import { CollectionActivityView, collectionRouteState, MarketContext } from './App';

const collectionId = 'C'.repeat(43);
const idle = { loading: false, error: '' };

describe('collection route state', () => {
	it('is ready whenever the collection is present', () => {
		for (const marketLoading of [false, true])
			for (const lookup of [idle, { loading: true, error: '' }, { loading: false, error: 'lookup failed' }])
				for (const marketError of [null, 'market failed'])
					expect(collectionRouteState({ hasCollection: true, marketLoading, marketError, lookup })).toBe(
						'ready'
					);
	});

	it('keeps loading while the catalogue or the id lookup is still answering', () => {
		for (const marketError of [null, 'market failed']) {
			expect(collectionRouteState({ hasCollection: false, marketLoading: true, marketError, lookup: idle })).toBe(
				'loading'
			);
			expect(
				collectionRouteState({
					hasCollection: false,
					marketLoading: false,
					marketError,
					lookup: { loading: true, error: '' },
				})
			).toBe('loading');
		}
	});

	it('is unavailable when the lookup or the catalogue failed', () => {
		expect(
			collectionRouteState({
				hasCollection: false,
				marketLoading: false,
				marketError: null,
				lookup: { loading: false, error: 'lookup failed' },
			})
		).toBe('unavailable');
		expect(
			collectionRouteState({
				hasCollection: false,
				marketLoading: false,
				marketError: 'market failed',
				lookup: idle,
			})
		).toBe('unavailable');
	});

	it('is not found only after both sources answered without the collection', () => {
		expect(
			collectionRouteState({ hasCollection: false, marketLoading: false, marketError: null, lookup: idle })
		).toBe('not-found');
	});
});

type MarketValue = React.ContextType<typeof MarketContext>;

function renderActivity(market: Pick<MarketValue, 'verifiedCollectionIds'>) {
	const value: MarketValue = {
		collections: [] as Collection[],
		searchAssets: [],
		rememberSearchAssets: () => undefined,
		visibilityReady: true,
		loading: false,
		error: null,
		notice: null,
		pageRefreshing: false,
		loadMore: async () => 0,
		addCreatedAsset: () => undefined,
		addCollection: () => undefined,
		setPageRefreshing: () => undefined,
		retry: () => undefined,
		...market,
	};
	return renderToStaticMarkup(
		<MarketContext.Provider value={value}>
			<MemoryRouter initialEntries={[`/collection/${collectionId}/activity`]}>
				<Routes>
					<Route path="/collection/:collectionId/activity" element={<CollectionActivityView />} />
				</Routes>
			</MemoryRouter>
		</MarketContext.Provider>
	);
}

describe('collection activity deep link', () => {
	it('looks up a collection outside the loaded catalogue instead of reporting it missing', () => {
		const markup = renderActivity({ verifiedCollectionIds: new Set() });

		expect(markup).toContain('Collection activity');
		expect(markup).toContain('Reading collection index…');
		expect(markup).not.toContain('Collection not found');
	});

	it('offers Retry when a verified catalogue does not hold the collection', () => {
		const markup = renderActivity({ verifiedCollectionIds: new Set([collectionId]) });

		expect(markup).toContain('Collection not found');
		expect(markup).toContain('error-panel-retry');
	});
});
