// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	type AssetSummary,
	type Collection,
	HIDDEN_COLLECTION_IDS,
	replaceHiddenCollectionAssetIndex,
} from 'api/collections';

import { appError } from 'helpers/app-error';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type IndexResult = { asset: AssetSummary; collection: Collection };

const control = vi.hoisted(() => ({
	search: undefined as undefined | ((query: string, signal?: AbortSignal) => Promise<IndexResult[]>),
	queries: [] as string[],
	signals: [] as Array<AbortSignal | undefined>,
}));

vi.mock('api/discovery', async (importOriginal) => {
	const actual = await importOriginal<typeof import('api/discovery')>();
	return {
		...actual,
		searchBazarAtomicAssetsByName: (query: string, options: { signal?: AbortSignal } = {}) => {
			control.queries.push(query);
			control.signals.push(options.signal);
			return control.search ? control.search(query, options.signal) : Promise.resolve([]);
		},
	};
});

const prefetched = vi.hoisted(() => [] as Array<{ id: string; fungible: boolean }>);

vi.mock('api/marketplace', async (importOriginal) => {
	const actual = await importOriginal<typeof import('api/marketplace')>();
	return {
		...actual,
		prefetchAssetPage: (id: string, fungible = false) => void prefetched.push({ id, fungible }),
	};
});

const market = vi.hoisted(() => ({
	collections: [] as Collection[],
	searchAssets: [] as Array<{ asset: AssetSummary; collection: Collection }>,
	visibilityReady: true,
}));

vi.mock('providers/MarketProvider', () => ({ useMarketProvider: () => market }));

import {
	type MarketplaceSearch,
	type MarketplaceSearchScope,
	mergedAssetResults,
	rankedLocalAssetResults,
	scopedSearchCollections,
	useMarketplaceSearch,
} from 'hooks/useMarketplaceSearch';

const tokenId = 'T'.repeat(43);

function asset(id: string, name: string, image = 'https://image.example'): AssetSummary {
	return { id, name, image };
}

const artwork: Collection = {
	id: 'artwork',
	name: 'Artwork collection',
	description: 'Permanent art',
	kind: 'images',
	assets: [asset('A'.repeat(43), 'Sunrise')],
};
const tokens: Collection = {
	id: 'tokens',
	name: 'Tokens',
	description: 'Fungible',
	kind: 'tokens',
	assets: [asset(tokenId, 'Sun token')],
	hasMore: true,
	total: 40,
};
const names: Collection = {
	id: 'names',
	name: 'Names',
	description: 'Identity',
	kind: 'names',
	assets: [asset('N'.repeat(43), 'sunny')],
};

/** Catalogue visibility stays unresolved until the hidden-asset index is known; complete it with nothing hidden. */
function completeVisibilityIndex() {
	replaceHiddenCollectionAssetIndex(Object.fromEntries(HIDDEN_COLLECTION_IDS.map((id) => [id, []])));
}

describe('marketplace search selectors', () => {
	beforeEach(completeVisibilityIndex);

	it('restricts the searched collections to the active scope', () => {
		const collections = [artwork, tokens, names];
		expect(scopedSearchCollections(collections, 'all')).toEqual(collections);
		expect(scopedSearchCollections(collections, 'tokens')).toEqual([tokens]);
		expect(scopedSearchCollections(collections, 'names')).toEqual([names]);
		expect(scopedSearchCollections(collections, 'assets')).toEqual([artwork, names]);
	});

	it('falls back to a featured mix when nothing has been typed', () => {
		const matches = new Map([[artwork, artwork.assets]]);
		expect(rankedLocalAssetResults([artwork], matches, '').map((result) => result.asset.name)).toEqual(['Sunrise']);
		expect(rankedLocalAssetResults([artwork], matches, 'sun').map((result) => result.asset.name)).toEqual([
			'Sunrise',
		]);
		expect(rankedLocalAssetResults([artwork], new Map(), 'sun')).toEqual([]);
	});

	it('deduplicates catalogue and index results by asset', () => {
		const local = [{ asset: asset(tokenId, 'Sun token'), collection: tokens }];
		const indexed = [{ asset: asset(tokenId, 'Sun token (indexed)'), collection: tokens }];
		const merged = mergedAssetResults(local, indexed, 'sun');

		expect(merged).toHaveLength(1);
		expect(merged[0].asset.name).toBe('Sun token');
	});
});

let root: Root;
let search: MarketplaceSearch | undefined;

function Probe(props: { open: boolean; query: string; scope: MarketplaceSearchScope }) {
	search = useMarketplaceSearch({ open: props.open, query: props.query, scope: props.scope });
	return null;
}

function render(query: string, scope: MarketplaceSearchScope = 'all', open = true) {
	React.act(() => root.render(<Probe open={open} query={query} scope={scope} />));
}

function current(): MarketplaceSearch {
	if (!search) throw new Error('hook-not-rendered');
	return search;
}

async function settleSearch() {
	await React.act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 300));
	});
}

describe('useMarketplaceSearch', () => {
	beforeEach(() => {
		completeVisibilityIndex();
		root = createRoot(document.createElement('div'));
		search = undefined;
		market.collections = [artwork, tokens, names];
		market.searchAssets = [];
		market.visibilityReady = true;
		control.search = undefined;
		control.queries = [];
		control.signals = [];
		prefetched.length = 0;
	});

	afterEach(() => {
		React.act(() => root.unmount());
	});

	it('finds an asset encountered elsewhere that no catalogue index lists', async () => {
		const encountered = {
			asset: asset('E'.repeat(43), 'Sun temple, Confirmed'),
			collection: { ...artwork, id: 'created-assets', name: 'Created on Bazar' },
		};
		market.searchAssets = [encountered];
		control.search = async () => [];

		render('sun temple');
		expect(current().collectibleResults.map((result) => result.asset.id)).toEqual([encountered.asset.id]);

		render('sun temple', 'tokens');
		expect(current().collectibleResults).toEqual([]);
		expect(current().tokenResults).toEqual([]);
		await settleSearch();
	});

	it('matches the loaded catalogue before the index answers', async () => {
		control.search = async () => [];

		render('sun');
		expect(current().indexSearch).toBe('pending');
		expect(current().collectionResults.map((result) => result.collection.id)).toEqual(['artwork', 'names']);
		expect(current().collectionResults.map((result) => result.kindLabel)).toEqual([
			'Permanent artwork collection',
			'Arweave identity',
		]);
		expect(current().tokenResults.map((result) => result.asset.name)).toEqual(['Sun token']);
		expect(current().collectibleResults.map((result) => result.asset.name)).toEqual(['Sunrise', 'sunny']);
		expect(current().partialTokenCollection?.id).toBe('tokens');

		await settleSearch();
		expect(current().indexSearch).toBe('settled');
	});

	it('debounces the index search and keeps only the latest query’s results', async () => {
		control.search = async (query) => [{ asset: asset('I'.repeat(43), `${query} record`), collection: artwork }];

		render('su');
		render('sun');
		await settleSearch();

		expect(control.queries).toEqual(['sun']);
		expect(current().collectibleResults.map((result) => result.asset.name)).toContain('sun record');
	});

	it('reports a failed index search without losing catalogue matches', async () => {
		control.search = async () => {
			throw appError('index-unavailable');
		};

		render('sun');
		await settleSearch();

		expect(current().indexSearch).toBe('failed');
		expect(current().tokenResults.map((result) => result.asset.name)).toEqual(['Sun token']);
	});

	it('does not search the index for collection, token, or name scopes, or while closed', async () => {
		render('sun', 'collections');
		await settleSearch();
		render('sun', 'tokens');
		await settleSearch();
		render('sun', 'all', false);
		await settleSearch();

		expect(control.queries).toEqual([]);
		expect(current().indexSearch).toBe('inactive');
	});

	it('offers a direct token process for an unmatched Arweave ID', async () => {
		control.search = async () => [];
		const unknownProcess = 'U'.repeat(43);

		render(unknownProcess);
		expect(current().directTokenCollection?.id).toBe('tokens');

		render(tokenId);
		expect(current().directTokenCollection).toBeUndefined();
		await settleSearch();
	});

	it('warms an asset page before it is opened', () => {
		render('sun');
		current().prefetchAsset(tokenId, true);

		expect(prefetched).toEqual([{ id: tokenId, fungible: true }]);
	});
});
