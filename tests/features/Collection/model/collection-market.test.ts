import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { replaceHiddenCollectionAssetIndex } from 'api/collections';

import { orderPriceLabel } from 'features/Catalogue';
import {
	collectionAssetWindowVersion,
	collectionCandidateIndex,
	collectionCardPriceLabel,
	collectionCardPriceListed,
	type CollectionCardPrices,
	collectionDefaultOrder,
	collectionIdentity,
	collectionIndexFailure,
	collectionListingPrice,
	collectionLiveListingRows,
	collectionSearchScope,
	collectionUnavailablePriceCount,
	filterCollectionAssets,
	unavailableCollectionPriceIds,
} from 'features/Collection/model/collection-market';
import { appError, appErrorMessage, requestFailureMessage } from 'helpers/app-error';

import {
	assetStateFixture,
	assetSummary,
	candidateFixture,
	collectionFixture,
	orderFixture,
	processId,
	READY_HIDDEN_COLLECTION_INDEX,
	resolvedFixture,
} from '../../../fixtures/collection';

beforeEach(() => replaceHiddenCollectionAssetIndex(READY_HIDDEN_COLLECTION_INDEX));
afterEach(() => replaceHiddenCollectionAssetIndex({}));

const alpha = assetSummary(1, 'Alpha');
const beta = assetSummary(2, 'beta');
const gamma = assetSummary(3, 'Gamma 10');
const delta = assetSummary(4, 'Gamma 9');
const collection = collectionFixture([gamma, alpha, delta, beta]);

function filter(options: Partial<Parameters<typeof filterCollectionAssets>[1]> = {}) {
	return filterCollectionAssets(collection.assets, {
		query: '',
		initial: 'all',
		sort: 'recent',
		kind: collection.kind,
		prices: {},
		candidates: new Map(),
		defaultOrder: collectionDefaultOrder(collection),
		...options,
	}).map((asset) => asset.name);
}

describe('collection identity', () => {
	it('names token collections generically and others by name', () => {
		expect(collectionIdentity(collectionFixture([], { kind: 'tokens', name: 'Fungible' }))).toEqual({
			name: 'Tokens',
			eyebrow: 'Fungible tokens',
			monogram: 'T',
		});
		expect(collectionIdentity(collectionFixture([], { name: 'Waves' }))).toEqual({
			name: 'Waves',
			eyebrow: 'Permanent artwork',
			monogram: 'W',
		});
		expect(collectionIdentity(collectionFixture([], { kind: 'names', name: '' })).monogram).toBe('');
	});
});

describe('collection index failures', () => {
	it('keeps rate limiting distinct from other index failures, with the same copy as before', () => {
		const limited = collectionIndexFailure(appError('rate-limited'));
		expect(limited.reason).toBe('index-rate-limited');
		expect(appErrorMessage(limited)).toBe(requestFailureMessage('index', 'rate-limited'));
		const unavailable = collectionIndexFailure(new TypeError('Failed to fetch'));
		expect(unavailable.reason).toBe('index-unavailable');
		expect(appErrorMessage(unavailable)).toBe(requestFailureMessage('index', 'unavailable'));
	});
});

describe('collection asset selection', () => {
	it('versions an asset window by its IDs', () => {
		expect(collectionAssetWindowVersion(undefined)).toBe('');
		expect(collectionAssetWindowVersion([alpha, beta])).toBe(`${processId(1)}.${processId(2)}`);
	});

	it('searches live listings, the loaded assets, or nothing', () => {
		const listed = [resolvedFixture(beta, collection)];
		expect(collectionSearchScope(collection, listed, true, 'alpha')).toEqual([beta]);
		expect(collectionSearchScope(collection, listed, false, '')).toBe(collection.assets);
		expect(collectionSearchScope(collection, listed, false, '  ALP ')).toEqual([alpha]);
		expect(collectionSearchScope(undefined, listed, false, 'alpha')).toEqual([]);
	});

	it('keeps loaded order by default and filters by query and initial', () => {
		expect(filter()).toEqual(['Gamma 10', 'Alpha', 'Gamma 9', 'beta']);
		expect(filter({ query: 'gam' })).toEqual(['Gamma 10', 'Gamma 9']);
		expect(filter({ initial: 'G' })).toEqual(['Gamma 9', 'Gamma 10']);
		expect(filter({ initial: 'Z' })).toEqual([]);
	});

	it('sorts names naturally and case-insensitively', () => {
		expect(filter({ sort: 'name' })).toEqual(['Alpha', 'beta', 'Gamma 9', 'Gamma 10']);
		expect(filter({ kind: 'names', defaultOrder: null })).toEqual(['Alpha', 'beta', 'Gamma 9', 'Gamma 10']);
	});

	it('sorts by live price with unpriced assets last', () => {
		const prices: CollectionCardPrices = {
			[alpha.id]: { status: 'resolved', label: '2 AR' },
			[beta.id]: { status: 'resolved', label: '1,000 AR' },
			[gamma.id]: { status: 'unindexed' },
		};
		expect(filter({ sort: 'price-low', prices })).toEqual(['Alpha', 'beta', 'Gamma 10', 'Gamma 9']);
		expect(filter({ sort: 'price-high', prices })).toEqual(['beta', 'Alpha', 'Gamma 10', 'Gamma 9']);
	});

	it('puts recently active assets first', () => {
		const candidates = collectionCandidateIndex([candidateFixture(2, 50), candidateFixture(4, 90)]);
		expect(filter({ candidates })).toEqual(['Gamma 9', 'beta', 'Gamma 10', 'Alpha']);
	});
});

describe('collection live listings', () => {
	it('lists every live order cheapest first with cumulative depth', () => {
		const cheap = resolvedFixture(alpha, collection, [
			orderFixture({ orderId: 'cheap', asking: '1000000000000', quantity: '1' }),
		]);
		const dear = resolvedFixture(beta, collection, [
			orderFixture({ orderId: 'dear', asking: '3000000000000', quantity: '1' }),
			orderFixture({ orderId: 'done', status: 'settled' }),
		]);
		const rows = collectionLiveListingRows([dear, cheap]);
		expect(rows.map((row) => row.asset.name)).toEqual(['Alpha', 'beta']);
		expect(rows.map((row) => row.depth)).toEqual([50, 100]);
		expect(rows[0].price).toBe(orderPriceLabel(orderFixture({ orderId: 'cheap' }), cheap.state));
		expect(rows[1].total).toBe('3 AR');
		expect(collectionLiveListingRows([])).toEqual([]);
	});
});

describe('collection card prices', () => {
	it('prices a card from its best ask, or records why it is unavailable', () => {
		const listed = resolvedFixture(alpha, collection);
		expect(collectionListingPrice(listed)).toEqual({
			status: 'resolved',
			label: orderPriceLabel(orderFixture(), assetStateFixture([orderFixture()])),
		});
		expect(collectionListingPrice(resolvedFixture(alpha, collection, []))).toEqual({
			status: 'resolved',
			label: null,
		});
		expect(collectionListingPrice(null)).toEqual({ status: 'resolved', label: null });
		expect(collectionListingPrice(listed, 'rate-limited')).toEqual({ status: 'unavailable', kind: 'rate-limited' });
	});

	it('labels each price state', () => {
		expect(collectionCardPriceLabel({ status: 'unavailable', kind: 'unavailable' }, false)).toBe('Unavailable');
		expect(collectionCardPriceLabel({ status: 'unindexed' }, false)).toBe('Unlisted');
		expect(collectionCardPriceLabel({ status: 'resolved', label: '1 AR' }, true)).toBe('1 AR');
		expect(collectionCardPriceLabel({ status: 'resolved', label: null }, false)).toBe('Not listed');
		expect(collectionCardPriceLabel(undefined, true)).toBe('Unavailable');
		expect(collectionCardPriceLabel(undefined, false)).toBe('Checking…');
		expect(collectionCardPriceListed({ status: 'resolved', label: '1 AR' })).toBe(true);
		expect(collectionCardPriceListed({ status: 'resolved', label: null })).toBe(false);
		expect(collectionCardPriceListed(undefined)).toBe(false);
	});

	it('finds unavailable prices among visible cards and across the collection', () => {
		const prices: CollectionCardPrices = {
			[alpha.id]: { status: 'unavailable', kind: 'rate-limited' },
			[beta.id]: { status: 'resolved', label: null },
			[gamma.id]: { status: 'unavailable', kind: 'unavailable' },
		};
		expect(collectionUnavailablePriceCount([alpha, beta], prices)).toBe(1);
		expect(unavailableCollectionPriceIds(prices)).toEqual([alpha.id, gamma.id]);
		expect(unavailableCollectionPriceIds({})).toEqual([]);
	});
});
