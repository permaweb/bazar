import { describe, expect, it } from 'vitest';

import type { AssetSummary, Collection } from 'api/collections';

import {
	alphabetBrowseIndex,
	alphabetFilterIndex,
	assetStateErrorMessage,
	collectionMatchesSearch,
	collectionMoreAssets,
	collectionSearchAssets,
	directTokenSearchCollection,
	interleaveCollectionAssets,
	marketplaceAssetMatchesSearch,
	searchResultScore,
} from './App';

const collection: Collection = {
	id: 'tokens',
	name: 'Arweave-native assets',
	description: 'Fungible assets',
	kind: 'tokens',
	assets: [],
};

function score(asset: AssetSummary, query: string) {
	return searchResultScore({ asset, collection }, query);
}

describe('marketplace search ranking', () => {
	it('stops collecting related assets at the visible limit', () => {
		const assets = Array.from({ length: 16_000 }, (_, index) => ({
			id: String(index),
			name: `Asset ${index}`,
		}));
		expect(collectionMoreAssets(assets, '1')).toEqual([assets[0], assets[2], assets[3], assets[4]]);
	});

	it('turns compute rate limits into actionable recovery guidance', () => {
		expect(assetStateErrorMessage(new Error('HTTP 429'))).toBe(
			'The selected compute gateway is temporarily rate-limiting live-state requests. Wait briefly and retry, or choose another Compute gateway in the header.'
		);
	});

	it('ranks exact tickers and direct asset matches ahead of collection-only matches', () => {
		expect(score({ id: 'token', name: 'Weave Credit', ticker: 'WEAVE' }, 'weave')).toBe(5);
		expect(score({ id: 'signal', name: 'Weave Signals #001' }, 'weave')).toBe(3);
		expect(score({ id: 'name', name: 'unrelated name' }, 'weave')).toBe(1);
	});

	it('preserves collection order when there is no query', () => {
		expect(score({ id: 'token', name: 'Weave Credit', ticker: 'WEAVE' }, '')).toBe(0);
	});

	it('interleaves featured assets across collections without changing their local order', () => {
		const collections: Collection[] = [
			{
				...collection,
				id: 'a',
				assets: [
					{ id: 'a1', name: 'A1' },
					{ id: 'a2', name: 'A2' },
					{ id: 'a3', name: 'A3' },
				],
			},
			{
				...collection,
				id: 'b',
				assets: [
					{ id: 'b1', name: 'B1' },
					{ id: 'b2', name: 'B2' },
				],
			},
			{ ...collection, id: 'c', assets: [{ id: 'c1', name: 'C1' }] },
		];

		expect(interleaveCollectionAssets(collections, 6).map(({ asset }) => asset.id)).toEqual([
			'a1',
			'b1',
			'c1',
			'a2',
			'b2',
			'a3',
		]);
	});

	it('skips ineligible assets while retaining collection balance', () => {
		const collections: Collection[] = [
			{
				...collection,
				id: 'a',
				assets: [
					{ id: 'a0', name: 'Hidden' },
					{ id: 'a1', name: 'A1', image: 'a.png' },
				],
			},
			{ ...collection, id: 'b', assets: [{ id: 'b1', name: 'B1', image: 'b.png' }] },
		];

		expect(
			interleaveCollectionAssets(collections, 2, (asset) => Boolean(asset.image)).map(({ asset }) => asset.id)
		).toEqual(['a1', 'b1']);
	});

	it('finds canonical names before their carrier record has been paged into the collection', () => {
		const names: Collection = {
			id: 'names',
			name: 'Arweave names',
			description: 'Canonical carrier names',
			kind: 'names',
			assets: [{ id: 'loaded', name: 'already-loaded' }],
			namespace: {
				manifestId: 'manifest',
				namesById: {
					loaded: 'already-loaded',
					canonical: 'welcome-to-fwd-hq',
				},
			},
		};

		expect(collectionSearchAssets(names, 'welcome-to-fwd-hq')).toEqual([
			{ id: 'canonical', name: 'welcome-to-fwd-hq' },
		]);
		expect(collectionMatchesSearch(names, 'welcome-to-fwd-hq')).toBe(true);
	});

	it('indexes a canonical namespace once across query revisions', () => {
		let enumerations = 0;
		const namesById = new Proxy(
			{
				first: 'welcome-to-fwd-hq',
				second: 'goblinarchmagus',
			},
			{
				ownKeys(target) {
					enumerations += 1;
					return Reflect.ownKeys(target);
				},
			}
		);
		const names: Collection = {
			id: 'names',
			name: 'Arweave names',
			description: 'Canonical carrier names',
			kind: 'names',
			assets: [],
			namespace: { manifestId: 'manifest', namesById },
		};

		expect(collectionSearchAssets(names, 'welcome')).toEqual([{ id: 'first', name: 'welcome-to-fwd-hq' }]);
		expect(collectionSearchAssets(names, 'goblin')).toEqual([{ id: 'second', name: 'goblinarchmagus' }]);
		expect(enumerations).toBe(1);
	});

	it('matches loaded fungible tokens by ticker or process ID as well as name', () => {
		const processId = 'P'.repeat(43);
		const tokens: Collection = {
			...collection,
			assets: [{ id: processId, name: 'Internet Token', ticker: 'WWW' }],
		};

		expect(collectionSearchAssets(tokens, 'internet')).toEqual(tokens.assets);
		expect(collectionSearchAssets(tokens, 'pppppppp')).toEqual(tokens.assets);
		expect(collectionSearchAssets(tokens, 'missing')).toEqual([]);
		expect(marketplaceAssetMatchesSearch(tokens.assets[0], tokens, 'WWW')).toBe(true);
		expect(marketplaceAssetMatchesSearch(tokens.assets[0], tokens, 'PPPPPPPP')).toBe(true);
	});

	it('offers exact process IDs for direct live token verification', () => {
		const processId = 'P'.repeat(43);

		expect(directTokenSearchCollection([collection], processId)).toBe(collection);
		expect(
			directTokenSearchCollection([collection], 'bASFYsRBQm_dfG__wqRVwMh8bqwEvSTl4lURRBqfu2M')
		).toBeUndefined();
		expect(directTokenSearchCollection([collection], 'not-a-process')).toBeUndefined();
		expect(directTokenSearchCollection([], processId)).toBeUndefined();
	});
});

describe('alphabet filter keyboard navigation', () => {
	it('wraps arrow keys and supports Home and End', () => {
		expect(alphabetFilterIndex('ArrowRight', 26, 27)).toBe(0);
		expect(alphabetFilterIndex('ArrowLeft', 0, 27)).toBe(26);
		expect(alphabetFilterIndex('Home', 13, 27)).toBe(0);
		expect(alphabetFilterIndex('End', 13, 27)).toBe(26);
		expect(alphabetFilterIndex('Tab', 13, 27)).toBeNull();
	});

	it('moves the mobile viewport to the next hidden alphabet control', () => {
		expect(alphabetBrowseIndex('next', [0, 1, 2, 3, 4, 5], 27)).toBe(10);
		expect(alphabetBrowseIndex('previous', [6, 7, 8, 9, 10], 27)).toBe(1);
		expect(alphabetBrowseIndex('previous', [0, 1, 2], 27)).toBe(0);
		expect(alphabetBrowseIndex('next', [24, 25, 26], 27)).toBe(26);
	});
});
