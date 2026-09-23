import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AssetSummary, Collection } from 'api/collections';
import { HIDDEN_COLLECTION_IDS, replaceHiddenCollectionAssetIndex } from 'api/collections';
import type { AssetState } from 'api/marketplace';
import { CREATED_COLLECTION_ID } from 'api/mint';

import { ASSET_DETAIL_MESSAGES } from 'features/AssetDetail/messages';
import {
	assetDetailErrorMessage,
	assetDetailHasIndexedLookup,
	assetDetailLoadingPresentation,
	assetDetailLoadingShellView,
	assetDetailScreen,
	assetDetailSources,
	assetStateErrorMessage,
	assetStateRecoveryUrl,
	mergeAssetActivityPages,
	mergeAssetDetailMetadata,
	resolveAssetDetail,
	uniquePriceHistory,
} from 'features/AssetDetail/model/asset-detail';
import { APP_ERROR_MESSAGES } from 'helpers/app-error.messages';
import { formatMessage } from 'helpers/i18n';

const assetId = 'A'.repeat(43);
const messages = ASSET_DETAIL_MESSAGES.en;

describe('asset detail fallbacks', () => {
	it('labels Atomic Asset shells as token@1.0 while retaining carrier@1.0 for names', () => {
		const images: Collection = {
			id: 'images',
			name: 'Images',
			description: '',
			kind: 'images',
			assets: [],
		};
		const names: Collection = { ...images, id: 'names', name: 'Names', kind: 'names' };

		expect(assetDetailLoadingPresentation(images, images.id)).toEqual({ kind: 'images', device: 'token@1.0' });
		expect(assetDetailLoadingPresentation(undefined, CREATED_COLLECTION_ID)).toEqual({
			kind: 'images',
			device: 'token@1.0',
		});
		expect(assetDetailLoadingPresentation(names, names.id)).toEqual({ kind: 'names', device: 'carrier@1.0' });
	});

	it('replaces an ID-only manifest label with permanent indexed metadata', () => {
		const manifestAsset: AssetSummary = {
			id: assetId,
			name: `${assetId.slice(0, 7)}…${assetId.slice(-6)}`,
			image: `https://arweave.net/${assetId}`,
		};
		const indexedAsset: AssetSummary = {
			id: assetId,
			name: 'AntiqueWhite',
			contentType: 'image/png',
			image: `https://arweave.net/${assetId}`,
		};

		expect(mergeAssetDetailMetadata(manifestAsset, indexedAsset)).toEqual(indexedAsset);
		expect(mergeAssetDetailMetadata({ ...manifestAsset, name: 'Curated title' }, indexedAsset)).toEqual({
			...indexedAsset,
			name: 'Curated title',
		});
	});

	it('turns AO transport quorum failures into asset-specific compute availability copy', () => {
		const friendly = assetStateErrorMessage(
			new Error('AO response quorum not met'),
			messages,
			APP_ERROR_MESSAGES.en
		);
		const legacyFriendly = assetStateErrorMessage(
			new Error('ao-wrangler-response-quorum-not-met'),
			messages,
			APP_ERROR_MESSAGES.en
		);
		expect(friendly).toContain('the configured AO peers');
		expect(legacyFriendly).toBe(friendly);
		expect(assetDetailErrorMessage(friendly, { name: 'AntiqueWhite' }, true, messages)).toBe(
			formatMessage(messages.assetDetailIndexedStateUnavailable, { name: 'AntiqueWhite' })
		);
	});

	it('explains a bounded foreground state timeout', () => {
		expect(assetStateErrorMessage(new Error('asset-state-read-timeout'), messages, APP_ERROR_MESSAGES.en)).toBe(
			messages.assetStateTimeout
		);
	});

	it('offers an explicit Bazar peer route only for failed PermawebOS asset-state reads', () => {
		const href =
			'https://bazar.arweave.net/?node=https%3A%2F%2Falpha.example#/asset/fungible-tokens/WEAVE?tab=market';
		const location = {
			href,
			protocol: 'https:',
			hostname: 'bazar.arweave.net',
			port: '',
			search: '?node=https%3A%2F%2Falpha.example',
			hash: '#/asset/fungible-tokens/WEAVE?tab=market',
		};
		const scope = { aoFetch: (() => undefined) as unknown as PermawebOsAoFetch };

		expect(assetStateRecoveryUrl('Live state unavailable', location, scope)).toBe(
			'https://bazar.arweave.net/?node=https%3A%2F%2Falpha.example&ao-transport=bazar#/asset/fungible-tokens/WEAVE?tab=market'
		);
		expect(assetStateRecoveryUrl(null, location, scope)).toBeNull();
		expect(
			assetStateRecoveryUrl(
				'Live state unavailable',
				{
					...location,
					href: 'https://bazar.arweave.net/?ao-transport=bazar#/asset/fungible-tokens/WEAVE?tab=market',
					search: '?ao-transport=bazar',
				},
				scope
			)
		).toBeNull();
	});

	it('starts Unique price history at the first listing and then moves only on completed sales', () => {
		const shared = {
			processId: assetId,
			actor: 'B'.repeat(43),
			height: 1,
		};
		expect(
			uniquePriceHistory([
				{ ...shared, id: 'later', action: 'make-offer', timestamp: 20, asking: '2500000000000' },
				{ ...shared, id: 'transfer', action: 'transfer', timestamp: 15, asking: '999' },
				{ ...shared, id: 'invalid', action: 'make-offer', timestamp: 12, asking: '0' },
				{ ...shared, id: 'earlier', action: 'make-offer', timestamp: 10, asking: '1000000000000' },
				{
					...shared,
					id: 'unpaid',
					action: 'register-interest',
					timestamp: 25,
					orderId: 'later',
				},
				{
					...shared,
					id: 'sale',
					action: 'register-interest',
					timestamp: 30,
					orderId: 'later',
					purchaseProof: { transactionId: 'P'.repeat(43), height: 2 },
				},
			])
		).toEqual([
			{ id: 'earlier', timestamp: 10, value: '1000000000000' },
			{ id: 'sale', timestamp: 30, value: '2500000000000' },
		]);
	});

	it('names the loading shell after its collection, falling back to the route kind', () => {
		const tokens: Collection = {
			id: 'fungible-tokens',
			name: 'Fungible tokens',
			description: '',
			kind: 'tokens',
			assets: [],
		};
		const images: Collection = { ...tokens, id: 'images', name: 'Bazar images', kind: 'images' };

		expect(assetDetailLoadingShellView(tokens, tokens.id, messages)).toEqual({
			kind: 'tokens',
			device: 'token@1.0',
			detailClass: 'fungible-asset-page',
			collectionName: 'Tokens',
		});
		expect(assetDetailLoadingShellView(images, images.id, messages)).toEqual({
			kind: 'images',
			device: 'token@1.0',
			detailClass: 'atomic-asset-page',
			collectionName: 'Bazar images',
		});
		expect(assetDetailLoadingShellView(undefined, CREATED_COLLECTION_ID, messages).collectionName).toBe(
			'Created on Bazar'
		);
		expect(assetDetailLoadingShellView(undefined, 'arweave-names', messages)).toEqual({
			kind: 'names',
			device: 'carrier@1.0',
			detailClass: 'atomic-asset-page',
			collectionName: messages.loadingShellCollectionNames,
		});
	});

	it('merges older cursor pages without duplicating indexed activity', () => {
		const event = (id: string, height: number) => ({
			id,
			processId: assetId,
			action: 'transfer' as const,
			actor: 'B'.repeat(43),
			height,
			timestamp: height * 10,
		});
		expect(
			mergeAssetActivityPages(
				[event('newest', 3), event('overlap', 2)],
				[event('overlap', 2), event('oldest', 1)]
			)
		).toEqual([event('newest', 3), event('overlap', 2), event('oldest', 1)]);
	});
});

const collectionId = CREATED_COLLECTION_ID;
const readyHiddenCollectionIndex = Object.fromEntries(HIDDEN_COLLECTION_IDS.map((id) => [id, []]));

const indexedCollection: Collection = {
	id: collectionId,
	name: 'Created on Bazar',
	description: 'Collection description',
	kind: 'images',
	assets: [{ id: assetId, name: 'AntiqueWhite', image: `https://arweave.net/${assetId}` }],
};

const uniqueState = {
	device: 'token@1.0',
	name: 'AntiqueWhite',
	ticker: 'ASSET',
	denomination: 0,
	totalSupply: '1',
	balances: { ['O'.repeat(43)]: '1' },
	orders: {},
	swapHeight: 4,
	value: null,
	raw: {},
} as AssetState;

const idleMarket = { loading: false, error: null as string | null, notice: null as string | null };

function screenFor(overrides: {
	market?: Partial<typeof idleMarket>;
	directAtomicRoute?: boolean;
	resolution?: Partial<ReturnType<typeof resolveAssetDetail>>;
	live?: Partial<{ state: AssetState | null; loading: boolean; error: string | null }>;
	detailError?: string | null;
}) {
	return assetDetailScreen({
		market: { ...idleMarket, ...overrides.market },
		directAtomicRoute: overrides.directAtomicRoute ?? false,
		resolution: {
			shellAsset: indexedCollection.assets[0],
			collection: indexedCollection,
			resolvedAsset: indexedCollection.assets[0],
			membershipVerified: true,
			verifiedAsset: indexedCollection.assets[0],
			...overrides.resolution,
		},
		live: { state: uniqueState, loading: false, error: null, ...overrides.live },
		detailError: overrides.detailError ?? null,
		messages,
	});
}

describe('asset detail resolution', () => {
	beforeEach(() => replaceHiddenCollectionAssetIndex(readyHiddenCollectionIndex));
	afterEach(() => replaceHiddenCollectionAssetIndex({}));

	it('looks up the Bazar atomic index only for visible asset processes outside tokens and names', () => {
		expect(assetDetailHasIndexedLookup(assetId, collectionId)).toBe(true);
		expect(assetDetailHasIndexedLookup(assetId, 'fungible-tokens')).toBe(false);
		expect(assetDetailHasIndexedLookup(assetId, 'arweave-names')).toBe(false);
		expect(assetDetailHasIndexedLookup('not-an-id', collectionId)).toBe(false);
	});

	it('resolves a catalogued asset and its direct atomic route', () => {
		const sources = assetDetailSources({
			assetId,
			collectionId,
			collections: [indexedCollection],
			cachedAsset: undefined,
			indexedAtomic: null,
		});
		expect(sources.indexedCollection).toBe(indexedCollection);
		expect(sources.indexedAsset?.id).toBe(assetId);
		expect(sources.directAtomicRoute).toBe(true);
		expect(sources.canResolveAsset).toBe(true);
	});

	it('cannot resolve an unknown asset without a cached shell, index entry, or direct route', () => {
		expect(
			assetDetailSources({
				assetId,
				collectionId: 'other-collection',
				collections: [],
				cachedAsset: undefined,
				indexedAtomic: null,
			}).canResolveAsset
		).toBe(false);
		expect(
			assetDetailSources({
				assetId,
				collectionId: 'other-collection',
				collections: [],
				cachedAsset: { id: assetId, name: 'Cached' },
				indexedAtomic: null,
			}).canResolveAsset
		).toBe(true);
	});

	it('presents the catalogued asset once its collection membership is verified', () => {
		const sources = assetDetailSources({
			assetId,
			collectionId,
			collections: [indexedCollection],
			cachedAsset: undefined,
			indexedAtomic: null,
		});
		const resolution = resolveAssetDetail(sources, {
			assetId,
			state: uniqueState,
			verifiedCollectionIds: new Set([collectionId]),
		});
		expect(resolution.collection).toBe(indexedCollection);
		expect(resolution.membershipVerified).toBe(true);
		expect(resolution.verifiedAsset?.id).toBe(assetId);

		const unverified = resolveAssetDetail(sources, {
			assetId,
			state: uniqueState,
			verifiedCollectionIds: new Set<string>(),
		});
		expect(unverified.membershipVerified).toBe(false);
		expect(unverified.verifiedAsset).toBeUndefined();
		expect(unverified.shellAsset?.id).toBe(assetId);
	});

	it('withholds a name asset whose live process is not a carrier', () => {
		const names = {
			...indexedCollection,
			id: 'arweave-names',
			kind: 'names',
			namespace: { namesById: { [assetId]: 'antique' } },
		} as Collection;
		const sources = assetDetailSources({
			assetId,
			collectionId: names.id,
			collections: [names],
			cachedAsset: undefined,
			indexedAtomic: null,
		});
		const verified = { assetId, verifiedCollectionIds: new Set([names.id]) };
		expect(resolveAssetDetail(sources, { ...verified, state: uniqueState }).verifiedAsset).toBeNull();
		expect(
			resolveAssetDetail(sources, { ...verified, state: { ...uniqueState, device: 'carrier@1.0' } }).verifiedAsset
				?.name
		).toBe('antique');
	});
});

describe('asset detail screens', () => {
	it('waits on the loading shell while the catalogue or a direct atomic read is pending', () => {
		expect(
			screenFor({
				market: { loading: true },
				resolution: { collection: undefined },
				live: { state: null, loading: true },
				detailError: 'Compute unavailable',
			})
		).toEqual({
			kind: 'loading',
			asset: indexedCollection.assets[0],
			collection: undefined,
			error: 'Compute unavailable',
			retry: 'state',
			recoverable: true,
		});
		expect(
			screenFor({ directAtomicRoute: true, resolution: { collection: undefined }, live: { loading: true } }).kind
		).toBe('loading');
	});

	it('reports catalogue and live-state failures with the retry that can fix them', () => {
		expect(
			screenFor({ market: { error: 'Catalogue unavailable' }, resolution: { collection: undefined } })
		).toEqual({
			kind: 'unavailable',
			collection: undefined,
			message: 'Catalogue unavailable',
			retry: 'market',
			recoverable: false,
		});
		expect(
			screenFor({
				directAtomicRoute: true,
				resolution: { collection: undefined },
				live: { error: 'Live state unavailable' },
			})
		).toEqual({
			kind: 'unavailable',
			collection: undefined,
			message: 'Live state unavailable',
			retry: 'state',
			recoverable: true,
		});
		expect(screenFor({ resolution: { collection: undefined } })).toEqual({ kind: 'collection-not-found' });
	});

	it('explains unverified membership while the catalogue is still loading or already settled', () => {
		expect(
			screenFor({
				market: { loading: true },
				resolution: { membershipVerified: false },
				detailError: 'Slow peer',
			})
		).toMatchObject({ kind: 'loading', error: 'Slow peer', retry: 'state', recoverable: true });
		expect(screenFor({ resolution: { membershipVerified: false } })).toMatchObject({
			kind: 'loading',
			error: 'Current collection membership could not be verified.',
			retry: 'market',
			recoverable: false,
		});
		expect(
			screenFor({ market: { notice: 'Index incomplete' }, resolution: { membershipVerified: false } })
		).toMatchObject({ error: 'Index incomplete' });
	});

	it('separates a missing asset from a failed or pending live read', () => {
		expect(
			screenFor({ resolution: { verifiedAsset: null }, live: { error: 'Live state unavailable' } })
		).toMatchObject({ kind: 'unavailable', message: 'Live state unavailable', collection: indexedCollection });
		expect(screenFor({ resolution: { verifiedAsset: null } })).toEqual({
			kind: 'asset-not-found',
			collection: indexedCollection,
		});
		expect(screenFor({ resolution: { verifiedAsset: null }, live: { loading: true } })).toMatchObject({
			kind: 'loading',
			error: null,
			recoverable: false,
		});
		expect(screenFor({ live: { state: null } })).toMatchObject({ kind: 'loading', recoverable: true });
	});

	it('routes fungible supply to the token view and single supply to the unique page', () => {
		expect(screenFor({}).kind).toBe('unique');
		expect(screenFor({ live: { state: { ...uniqueState, totalSupply: '1000' } } }).kind).toBe('fungible');
		expect(screenFor({ live: { state: { ...uniqueState, denomination: 12 } } }).kind).toBe('fungible');
	});
});
