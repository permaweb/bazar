import { describe, expect, it } from 'vitest';

import type { CollectionActivityEvent } from 'api/asset-discovery';
import type { Collection } from 'api/collections';

import {
	assetDetailCanResolve,
	assetDetailMembershipVerified,
	collectionActivityScanAnnouncement,
	collectionActivityVersion,
	collectionActivityWindowDelta,
	collectionAssetWindowDelta,
	collectionCandidateMembership,
	collectionDefaultsToListed,
	collectionListingScopeVersion,
	commitHomeActivityBatch,
	commitHomeFloorResult,
	compareCollectionAssetNames,
	compareHomeCollections,
	compareHomeListingRecency,
	completeHomeActivityScan,
	completeHomeSummaryRetryGroup,
	createAnimationFrameBatch,
	filterGlobalActivity,
	globalActivityCollection,
	homeAllAssets,
	homeAssetPage,
	homeAssetTypeMatches,
	homeAssetVisibleForView,
	homeCollectionAssetCountLabel,
	homeDiscoveryAssets,
	homeFloorCandidateNeedsResolution,
	homeFloorScanSummary,
	homeListingComputeFailure,
	homeListingSupportVersion,
	homeMarketHasPending,
	homeMarketPriceValue,
	homeMarketShellLoading,
	homeMarketSummariesReady,
	type HomeMarketSummary,
	homeRouteSearch,
	homeScrollIndicatorMetrics,
	homeSearchAssets,
	homeSummaryRequestKeys,
	homeTabFromPathname,
	homeTabPath,
	mergeResolvedListingBatch,
	newestCollectionActivity,
	nextListingAnnouncementProgress,
	pendingHomeActivityRecipients,
	pendingHomeFloorCandidates,
	publishHomeListingResult,
	reconcileHomeActivityScan,
	reconcileHomeFloorScan,
	recordHomeListingComputeResult,
	retainNewestCollectionActivity,
	retryableHomeSummaryKeys,
	shouldLoadHomeAssetSummaries,
	shouldLoadHomeCollectionSummaries,
	verifiedAssetForDetail,
	verifiedCollectionIdsFrom,
} from './App';
import {
	loadAssetShellSnapshot,
	loadHomeListingSnapshot,
	loadMarketShellSnapshot,
	storeAssetShellSnapshot,
	storeHomeListingSnapshot,
	storeMarketShellSnapshot,
} from './shell-snapshot';

describe('Home market summary retries', () => {
	it('maps every Home tab to a hash-router subroute without dropping other query parameters', () => {
		expect(homeTabFromPathname('/discover')).toBe('discover');
		expect(homeTabFromPathname('/collections/')).toBe('collections');
		expect(homeTabFromPathname('/activity')).toBe('activity');
		expect(homeTabFromPathname('/unknown')).toBe('discover');
		expect(homeTabPath('discover')).toBe('/discover');
		expect(homeTabPath('collections')).toBe('/collections');
		expect(homeTabPath('activity')).toBe('/activity');
		expect(homeRouteSearch('?q=art&tab=discover')).toBe('?q=art');
		expect(homeRouteSearch('?q=art')).toBe('?q=art');
	});

	it('sorts collections by indexed activity or carrier creation height without computing state', () => {
		const collection = (id: string, name: string, createdHeight?: number): Collection => ({
			id,
			name,
			description: name,
			kind: 'images',
			assets: [],
			...(createdHeight === undefined ? {} : { createdHeight, createdAt: createdHeight * 1_000 }),
		});
		const alpha = collection('alpha', 'Alpha', 10);
		const beta = collection('beta', 'Beta', 20);
		const newest = collection('newest', 'Newest', 50);
		const unknown = collection('unknown', 'Unknown');
		const activity = new Map([
			['alpha', { processId: 'A'.repeat(43), height: 40, timestamp: 40 }],
			['beta', { processId: 'B'.repeat(43), height: 30, timestamp: 30 }],
		]);

		expect([beta, unknown, newest, alpha].sort((a, b) => compareHomeCollections(a, b, 'recent', activity))).toEqual(
			[newest, alpha, beta, unknown]
		);
		expect([alpha, unknown, beta, newest].sort((a, b) => compareHomeCollections(a, b, 'newest', activity))).toEqual(
			[newest, beta, alpha, unknown]
		);
		expect([beta, unknown, newest, alpha].sort((a, b) => compareHomeCollections(a, b, 'oldest', activity))).toEqual(
			[alpha, beta, newest, unknown]
		);
	});

	it('reports compute failure only when every listing refresh failed', () => {
		const failure = new Error('compute unavailable');
		expect(homeListingComputeFailure(failure, 3, 3)).toBe(failure);
		expect(homeListingComputeFailure(failure, 3, 2)).toBeUndefined();
		expect(homeListingComputeFailure(failure, 0, 0)).toBeUndefined();
	});

	it('resets a failure streak on success and keeps an open listing circuit until retry or gateway change', () => {
		const failure = new Error('all configured peers unavailable');
		const circuit = { scope: '', consecutiveFailures: 0 };
		for (let index = 0; index < 35; index += 1) {
			expect(recordHomeListingComputeResult(circuit, 'alpha,charlie|0', failure)).toBeUndefined();
		}
		expect(recordHomeListingComputeResult(circuit, 'alpha,charlie|0')).toBeUndefined();
		expect(circuit.consecutiveFailures).toBe(0);
		for (let index = 0; index < 35; index += 1) {
			expect(recordHomeListingComputeResult(circuit, 'alpha,charlie|0', failure)).toBeUndefined();
		}
		expect(recordHomeListingComputeResult(circuit, 'alpha,charlie|0', failure)).toBe(failure);
		expect(recordHomeListingComputeResult(circuit, 'alpha,charlie|0')).toBe(failure);
		expect(circuit).toEqual({ scope: 'alpha,charlie|0', consecutiveFailures: 36, failure });
		expect(recordHomeListingComputeResult(circuit, 'alpha,charlie|1')).toBeUndefined();
		expect(circuit).toEqual({ scope: 'alpha,charlie|1', consecutiveFailures: 0, failure: undefined });
	});

	it('publishes progressive outcomes once per frame and drops canceled work', () => {
		const frames = new Map<number, FrameRequestCallback>();
		const canceled: number[] = [];
		let frameId = 0;
		const request = (callback: FrameRequestCallback) => {
			const id = ++frameId;
			frames.set(id, callback);
			return id;
		};
		const cancel = (id: number) => {
			canceled.push(id);
			frames.delete(id);
		};
		const published: number[][] = [];
		const batch = createAnimationFrameBatch<number>((values) => published.push(values), request, cancel);

		batch.push(1);
		batch.push(2);
		expect(frames.size).toBe(1);
		expect(published).toEqual([]);
		frames.get(1)?.(0);
		expect(published).toEqual([[1, 2]]);

		batch.push(3);
		batch.flush();
		expect(canceled).toContain(2);
		expect(published).toEqual([[1, 2], [3]]);

		batch.push(4);
		batch.cancel();
		expect(canceled).toContain(3);
		expect(published).toEqual([[1, 2], [3]]);
	});

	it('opens Arweave names on complete live listings ordered A to Z', () => {
		expect(collectionDefaultsToListed('arweave-names')).toBe(true);
		expect(collectionDefaultsToListed('fungible-tokens')).toBe(false);
		expect(
			[
				{ id: '3', name: 'zupercollectiv' },
				{ id: '2', name: 'blockdata10' },
				{ id: '1', name: 'blockdata2' },
			]
				.sort(compareCollectionAssetNames)
				.map(({ name }) => name)
		).toEqual(['blockdata2', 'blockdata10', 'zupercollectiv']);
	});

	it('does not present an empty partial names page as a zero-asset collection', () => {
		expect(
			homeCollectionAssetCountLabel({
				id: 'arweave-names',
				name: 'Arweave names',
				description: 'Names',
				kind: 'names',
				assets: [],
				hasMore: true,
			})
		).toBe('N/A');
		expect(
			homeCollectionAssetCountLabel({
				id: 'arweave-names',
				name: 'Arweave names',
				description: 'Names',
				kind: 'names',
				assets: [{ id: 'name-id', name: 'alice' }],
				hasMore: true,
			})
		).toBe('1');
	});

	it('round-trips a structural market snapshot for stable refresh shells', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
		};
		const collections: Collection[] = [
			{
				id: 'names',
				name: 'Names',
				description: 'Current names',
				kind: 'names',
				assets: [{ id: 'asset', name: 'blockdata' }],
			},
		];

		storeMarketShellSnapshot(storage, collections);
		expect(loadMarketShellSnapshot(storage)).toEqual(collections);
	});

	it('ignores malformed market snapshots', () => {
		expect(loadMarketShellSnapshot({ getItem: () => '{bad json' })).toEqual([]);
		expect(loadMarketShellSnapshot({ getItem: () => JSON.stringify([{ id: 'broken' }]) })).toEqual([]);
	});

	it('round-trips asset display metadata without caching live ownership state', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
		};
		const asset = { id: 'asset-id', name: 'blockdata', ticker: 'BLOCK' };

		storeAssetShellSnapshot(storage, asset);
		expect(loadAssetShellSnapshot(storage, asset.id)).toEqual(asset);
		expect(loadAssetShellSnapshot(storage, 'another-id')).toBeUndefined();
	});

	it('restores only recent Home listing display metadata from the same peer scope', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
		};
		const asset = { id: 'A'.repeat(43), name: 'Recent asset' };
		const listing = {
			asset,
			collection: {
				id: 'images',
				name: 'Images',
				description: 'Recent images',
				kind: 'images' as const,
				assets: [asset],
			},
			activity: { processId: asset.id, height: 100, timestamp: 200 },
			price: '1 AR',
		};

		storeHomeListingSnapshot(storage, 'alpha,charlie', [listing], 1_000);
		expect(loadHomeListingSnapshot(storage, 'alpha,charlie', 60_000, 1_001)).toEqual([listing]);
		expect(loadHomeListingSnapshot(storage, 'charlie', 60_000, 1_001)).toEqual([]);
		expect(loadHomeListingSnapshot(storage, 'alpha,charlie', 60_000, 61_001)).toEqual([]);
	});

	it('rejects Home listing shells that do not bind activity to the displayed asset', () => {
		const storage = {
			getItem: () =>
				JSON.stringify({
					scope: 'nodes',
					updatedAt: 1,
					listings: [
						{
							asset: { id: 'A'.repeat(43), name: 'Asset' },
							collection: {
								id: 'images',
								name: 'Images',
								description: 'Images',
								kind: 'images',
								assets: [{ id: 'A'.repeat(43), name: 'Asset' }],
							},
							activity: { processId: 'B'.repeat(43), height: 1, timestamp: 1 },
							price: '1 AR',
						},
					],
				}),
		};

		expect(loadHomeListingSnapshot(storage, 'nodes', 60_000, 2)).toEqual([]);
	});

	it('warms a cached asset while its index loads without restarting when membership arrives', () => {
		const asset = { id: 'A'.repeat(43), name: 'Cached asset' };
		const pending = assetDetailCanResolve({
			assetId: asset.id,
			cachedAsset: asset,
			directAtomicRoute: false,
		});
		const verified = assetDetailCanResolve({
			assetId: asset.id,
			cachedAsset: asset,
			indexedAsset: asset,
			indexedCollection: {
				id: 'collection',
				name: 'Collection',
				description: '',
				kind: 'images',
				assets: [asset],
			},
			directAtomicRoute: false,
		});

		expect(pending).toBe(true);
		expect(verified).toBe(pending);
	});

	it('starts a direct fungible read before its immutable collection index settles', () => {
		const assetId = 'A'.repeat(43);
		expect(
			assetDetailCanResolve({
				assetId,
				directAtomicRoute: false,
				directFungibleRoute: true,
			})
		).toBe(true);
		expect(assetDetailMembershipVerified('fungible-tokens', new Set(), false)).toBe(false);
	});

	it('restarts listing support as progressively loaded collections expand', () => {
		const first: Collection = {
			id: 'fungible',
			name: 'Tokens',
			description: '',
			kind: 'tokens',
			assets: [{ id: 'A'.repeat(43), name: 'Token' }],
		};
		const second: Collection = {
			id: 'artwork',
			name: 'Artwork',
			description: '',
			kind: 'images',
			manifestId: 'B'.repeat(43),
			assets: [{ id: 'C'.repeat(43), name: 'Image' }],
		};

		expect(homeListingSupportVersion([first, second])).not.toBe(homeListingSupportVersion([first]));
	});

	it('keeps malformed or unverified asset shells outside the actionable asset boundary', () => {
		const asset = { id: 'A'.repeat(43), name: 'Cached asset' };
		expect(
			assetDetailCanResolve({
				assetId: asset.id,
				cachedAsset: { ...asset, id: 'B'.repeat(43) },
				directAtomicRoute: false,
			})
		).toBe(false);
		expect(assetDetailMembershipVerified('collection', new Set(), false)).toBe(false);
		expect(assetDetailMembershipVerified('collection', new Set(['collection']), false)).toBe(true);
		expect(assetDetailMembershipVerified(undefined, new Set(), true)).toBe(true);
		expect(verifiedAssetForDetail(undefined, undefined, asset, null)).toBeUndefined();
	});

	it('keeps a compiled fallback passive until its current reference index arrives', () => {
		const asset = { id: 'A'.repeat(43), name: 'Cached asset' };
		const fallback: Collection = {
			id: 'collection',
			name: 'Collection',
			description: '',
			kind: 'images',
			assets: [asset],
			indexSource: 'compiled-fallback',
		};
		expect(
			assetDetailCanResolve({
				assetId: asset.id,
				cachedAsset: asset,
				indexedAsset: asset,
				indexedCollection: fallback,
				directAtomicRoute: false,
			})
		).toBe(true);
		const fallbackIds = verifiedCollectionIdsFrom([fallback]);
		expect(fallbackIds).toEqual([]);
		expect(assetDetailMembershipVerified(fallback.id, new Set(fallbackIds), false)).toBe(false);
		expect(verifiedCollectionIdsFrom([{ ...fallback, indexSource: 'reference' }])).toEqual(['collection']);
	});

	it('sizes and positions persistent pane scroll indicators', () => {
		expect(homeScrollIndicatorMetrics(0, 1_200, 600)).toEqual({ visible: true, size: 150, offset: 0 });
		expect(homeScrollIndicatorMetrics(300, 1_200, 600)).toEqual({ visible: true, size: 150, offset: 225 });
		expect(homeScrollIndicatorMetrics(0, 600, 600)).toEqual({ visible: false, size: 600, offset: 0 });
	});

	it('keeps the indicator within a track below the sticky heading', () => {
		expect(homeScrollIndicatorMetrics(300, 1_200, 600, 492)).toEqual({
			visible: true,
			size: 123,
			offset: 184.5,
		});
	});

	it('separates fungible tokens from atomic assets', () => {
		const tokenCollection: Collection = {
			id: 'tokens',
			name: 'Tokens',
			description: '',
			kind: 'tokens',
			assets: [],
		};
		const nameCollection: Collection = {
			id: 'names',
			name: 'Names',
			description: '',
			kind: 'names',
			assets: [],
		};
		const imageCollection: Collection = {
			id: 'images',
			name: 'Images',
			description: '',
			kind: 'images',
			assets: [],
		};

		expect(
			[tokenCollection, nameCollection, imageCollection].filter((collection) =>
				homeAssetTypeMatches(collection, 'all')
			)
		).toHaveLength(3);
		expect(
			[tokenCollection, nameCollection, imageCollection].filter((collection) =>
				homeAssetTypeMatches(collection, 'tokens')
			)
		).toEqual([tokenCollection]);
		expect(
			[tokenCollection, nameCollection, imageCollection].filter((collection) =>
				homeAssetTypeMatches(collection, 'atomic')
			)
		).toEqual([nameCollection, imageCollection]);
	});

	it('keeps verified Arweave names in the discovery mosaic', () => {
		const name = { id: 'n'.repeat(43), name: 'alice' };
		const image = { id: 'i'.repeat(43), name: 'Image', image: 'https://arweave.net/image' };
		const collections: Collection[] = [
			{ id: 'names', name: 'Names', description: '', kind: 'names', assets: [] },
			{ id: 'images', name: 'Images', description: '', kind: 'images', assets: [image] },
		];

		expect(homeDiscoveryAssets(collections, { names: [name] }, 10)).toEqual([
			{ asset: name, collection: collections[0] },
			{ asset: image, collection: collections[1] },
		]);
	});

	it('keeps audio assets without album artwork in discovery and search', () => {
		const audio = {
			id: 'a'.repeat(43),
			name: 'Permanent signal',
			contentType: 'audio/mpeg',
			media: 'https://arweave.net/audio',
		};
		const collection: Collection = {
			id: 'audio',
			name: 'Audio',
			description: '',
			kind: 'images',
			assets: [audio],
		};

		expect(homeDiscoveryAssets([collection], {}, 10)).toEqual([{ asset: audio, collection }]);
		expect(homeSearchAssets([collection], [], 'signal', 10)).toEqual([{ asset: audio, collection }]);
	});

	it('puts verified portable listings on Discover without a collection index', () => {
		const indexed = { id: 'i'.repeat(43), name: 'Indexed', image: 'https://arweave.net/indexed' };
		const portable = { id: 'p'.repeat(43), name: 'Portable', image: 'https://arweave.net/portable' };
		const indexedCollection: Collection = {
			id: 'images',
			name: 'Images',
			description: '',
			kind: 'images',
			assets: [indexed],
		};
		const portableCollection: Collection = {
			id: 'created-assets',
			name: 'Portable collection',
			description: '',
			kind: 'images',
			assets: [portable],
		};

		expect(
			homeDiscoveryAssets([indexedCollection], {}, 10, [{ asset: portable, collection: portableCollection }])
		).toEqual([
			{ asset: portable, collection: portableCollection },
			{ asset: indexed, collection: indexedCollection },
		]);
	});

	it('caps portable listings by indexed activity rather than compute completion', () => {
		const collection: Collection = {
			id: 'images',
			name: 'Images',
			description: '',
			kind: 'images',
			assets: [],
		};
		const older = { id: 'o'.repeat(43), name: 'Older' };
		const newer = { id: 'n'.repeat(43), name: 'Newer' };

		expect(
			homeDiscoveryAssets([collection], {}, 1, [
				{ asset: older, collection, activity: { processId: older.id, height: 1, timestamp: 1 } },
				{ asset: newer, collection, activity: { processId: newer.id, height: 2, timestamp: 2 } },
			])
		).toEqual([{ asset: newer, collection, activity: { processId: newer.id, height: 2, timestamp: 2 } }]);
	});

	it('uses indexed collection assets before listings-only additions for the All assets view', () => {
		const indexed = { id: 'i'.repeat(43), name: 'Indexed', image: 'https://arweave.net/indexed' };
		const portable = { id: 'p'.repeat(43), name: 'Portable', image: 'https://arweave.net/portable' };
		const collection: Collection = {
			id: 'images',
			name: 'Images',
			description: '',
			kind: 'images',
			assets: [indexed],
		};
		const portableCollection: Collection = {
			id: 'created-assets',
			name: 'Created on Bazar',
			description: '',
			kind: 'images',
			assets: [portable],
		};

		expect(homeAllAssets([collection], 10, [{ asset: portable, collection: portableCollection }])).toEqual([
			{ asset: indexed, collection },
			{ asset: portable, collection: portableCollection },
		]);
	});

	it('includes portable listings in Discover search and de-duplicates indexed matches', () => {
		const portable = {
			id: 'p'.repeat(43),
			name: 'permaweb as a substrate for ai',
			image: 'https://arweave.net/portable',
		};
		const indexed = { id: 'i'.repeat(43), name: 'Indexed substrate', image: 'https://arweave.net/indexed' };
		const indexedCollection: Collection = {
			id: 'images',
			name: 'Images',
			description: '',
			kind: 'images',
			assets: [indexed, portable],
		};
		const portableCollection: Collection = {
			id: 'created-assets',
			name: 'Created on Bazar',
			description: '',
			kind: 'images',
			assets: [portable],
		};

		expect(
			homeSearchAssets(
				[indexedCollection],
				[{ asset: portable, collection: portableCollection }],
				'substrate',
				10
			)
		).toEqual([
			{ asset: portable, collection: portableCollection },
			{ asset: indexed, collection: indexedCollection },
		]);
	});

	it('sorts NFT and fungible AR price labels by their numeric amount', () => {
		expect(homeMarketPriceValue('0.000001 AR / WEAVE')).toBe(0.000001);
		expect(homeMarketPriceValue('1,234.5 AR')).toBe(1234.5);
		expect(homeMarketPriceValue('Unavailable')).toBe(Number.POSITIVE_INFINITY);
	});

	it('keeps the most recently listed asset at the top of Listed for sale', () => {
		const activity = new Map([
			['older', { processId: 'older', height: 100, timestamp: 200 }],
			['newer', { processId: 'newer', height: 101, timestamp: 100 }],
			['same-block-newer', { processId: 'same-block-newer', height: 100, timestamp: 300 }],
		]);

		expect(
			['older', 'unknown', 'same-block-newer', 'newer'].sort((left, right) =>
				compareHomeListingRecency(left, right, activity)
			)
		).toEqual(['newer', 'same-block-newer', 'older', 'unknown']);
	});

	it('allows Discover to show all assets without treating unlisted assets as live listings', () => {
		const unlisted: HomeMarketSummary = { status: 'resolved', value: null };
		const listed: HomeMarketSummary = { status: 'resolved', value: '0.001 AR' };

		expect(homeAssetVisibleForView(unlisted, 'all')).toBe(true);
		expect(homeAssetVisibleForView(undefined, 'listed')).toBe(false);
		expect(
			homeAssetVisibleForView({ status: 'unavailable', source: 'compute', kind: 'unavailable' }, 'listed')
		).toBe(false);
		expect(homeAssetVisibleForView(unlisted, 'listed')).toBe(false);
		expect(homeAssetVisibleForView(listed, 'listed')).toBe(true);
		expect(homeAssetVisibleForView(listed, 'price-low')).toBe(true);
	});

	it('publishes each proven listing without waiting for unresolved siblings', () => {
		const summaries: Record<string, HomeMarketSummary | undefined> = {
			listed: { status: 'resolved', value: '0.001 AR' },
			unlisted: { status: 'resolved', value: null },
			pending: undefined,
		};

		expect(
			Object.keys(summaries).filter((assetId) => homeAssetVisibleForView(summaries[assetId], 'listed'))
		).toEqual(['listed']);
	});

	it('publishes and removes each live collection listing independently', () => {
		const first = { id: 'first', name: 'First' };
		const second = { id: 'second', name: 'Second' };
		const start = { collection: [first] };

		expect(publishHomeListingResult(start, 'collection', first, true)).toBe(start);
		expect(publishHomeListingResult(start, 'collection', second, true)).toEqual({
			collection: [first, second],
		});
		expect(publishHomeListingResult(start, 'collection', first, false)).toEqual({ collection: [] });
		expect(publishHomeListingResult(start, 'collection', second, false)).toBe(start);
	});

	it('paginates Discover assets and clamps pages when filters reduce the result set', () => {
		const assets = Array.from({ length: 20 }, (_, index) => `asset-${index + 1}`);

		expect(homeAssetPage(assets, 2)).toEqual({
			items: assets.slice(9, 18),
			page: 2,
			pageCount: 3,
		});
		expect(homeAssetPage(assets.slice(0, 4), 3)).toEqual({
			items: assets.slice(0, 4),
			page: 1,
			pageCount: 1,
		});
	});

	it('publishes the home mosaic only after every live summary settles', () => {
		const summaries: Record<string, HomeMarketSummary> = {
			listed: { status: 'resolved', value: '0.001 AR' },
			empty: { status: 'unindexed' },
			failed: { status: 'unavailable', source: 'compute', kind: 'unavailable' },
		};

		expect(homeMarketSummariesReady(true, ['listed'], summaries)).toBe(false);
		expect(homeMarketSummariesReady(false, ['listed', 'pending'], summaries)).toBe(false);
		expect(homeMarketSummariesReady(false, ['listed', 'empty', 'failed'], summaries)).toBe(true);
	});

	it('publishes a cached or progressive market shell while indexes refresh', () => {
		expect(homeMarketShellLoading(true, 0)).toBe(true);
		expect(homeMarketShellLoading(true, 1)).toBe(false);
		expect(homeMarketShellLoading(false, 0)).toBe(false);
	});

	it('keeps a trailing ghost while indexes or visible card summaries are pending', () => {
		const summaries: Record<string, HomeMarketSummary> = {
			ready: { status: 'resolved', value: '0.001 AR' },
		};

		expect(homeMarketHasPending(true, ['ready'], summaries)).toBe(true);
		expect(homeMarketHasPending(false, ['ready', 'pending'], summaries)).toBe(true);
		expect(homeMarketHasPending(false, ['ready'], summaries)).toBe(false);
	});

	it('keeps collection floor scans isolated to the collections view', () => {
		expect(shouldLoadHomeCollectionSummaries('discover')).toBe(false);
		expect(shouldLoadHomeCollectionSummaries('collections')).toBe(true);
		expect(shouldLoadHomeCollectionSummaries('activity')).toBe(false);
	});

	it('keeps listing discovery isolated to the discover view', () => {
		expect(shouldLoadHomeAssetSummaries('discover')).toBe(true);
		expect(shouldLoadHomeAssetSummaries('collections')).toBe(false);
		expect(shouldLoadHomeAssetSummaries('activity')).toBe(false);
	});

	it('resolves global activity to its marketplace collection', () => {
		const tokenId = 't'.repeat(43);
		const nameId = 'n'.repeat(43);
		const collections: Collection[] = [
			{
				id: 'tokens',
				name: 'Tokens',
				description: '',
				kind: 'tokens',
				assets: [{ id: tokenId, name: 'Token' }],
			},
			{
				id: 'names',
				name: 'Names',
				description: '',
				kind: 'names',
				assets: [],
				namespace: { manifestId: 'm'.repeat(43), namesById: { [nameId]: 'name' } },
			},
		];

		expect(globalActivityCollection(collections, tokenId)?.id).toBe('tokens');
		expect(globalActivityCollection(collections, nameId)?.id).toBe('names');
		expect(globalActivityCollection(collections, 'x'.repeat(43))).toBeUndefined();
	});

	it('filters global activity by submitted market action', () => {
		const events = [
			{ id: 'listing', action: 'make-offer' },
			{ id: 'purchase', action: 'register-interest', purchaseProof: { transactionId: 'proof', height: 1 } },
			{ id: 'transfer', action: 'transfer' },
			{ id: 'cancel', action: 'cancel-order' },
		] as CollectionActivityEvent[];

		expect(filterGlobalActivity(events, 'all')).toEqual(events);
		expect(filterGlobalActivity(events, 'make-offer').map((event) => event.id)).toEqual(['listing']);
		expect(filterGlobalActivity(events, 'register-interest').map((event) => event.id)).toEqual(['purchase']);
		expect(filterGlobalActivity(events, 'transfer').map((event) => event.id)).toEqual(['transfer']);
		expect(filterGlobalActivity(events, 'cancel-order').map((event) => event.id)).toEqual(['cancel']);
	});

	it('checks exact collection membership without rescanning loaded assets', () => {
		const loadedImage = 'i'.repeat(43);
		const loadedToken = 't'.repeat(43);
		const canonicalName = 'n'.repeat(43);
		const staleLoadedName = 's'.repeat(43);
		const foreign = 'f'.repeat(43);
		const imageIncludes = collectionCandidateMembership({
			id: 'images',
			name: 'Images',
			description: '',
			kind: 'images',
			assets: [{ id: loadedImage, name: 'Image' }],
		});
		const tokenIncludes = collectionCandidateMembership({
			id: 'tokens',
			name: 'Tokens',
			description: '',
			kind: 'tokens',
			assets: [{ id: loadedToken, name: 'Token' }],
		});
		const nameIncludes = collectionCandidateMembership({
			id: 'names',
			name: 'Names',
			description: '',
			kind: 'names',
			assets: [{ id: staleLoadedName, name: 'Stale' }],
			namespace: {
				manifestId: 'm'.repeat(43),
				namesById: { [canonicalName]: 'canonical' },
			},
		});

		expect([imageIncludes(loadedImage), imageIncludes(foreign)]).toEqual([true, false]);
		expect([tokenIncludes(loadedToken), tokenIncludes(foreign)]).toEqual([true, false]);
		expect([nameIncludes(canonicalName), nameIncludes(staleLoadedName)]).toEqual([true, false]);
	});

	it('screens a large collection candidate set with exact indexed membership', () => {
		const ids = Array.from({ length: 16_653 }, (_, index) => `${String(index).padStart(42, '0')}A`);
		const includes = collectionCandidateMembership({
			id: 'large',
			name: 'Large',
			description: '',
			kind: 'images',
			assets: ids.map((id) => ({ id, name: id })),
		});
		const candidates = Array.from({ length: 13_769 }, (_, index) =>
			index % 3 === 0 ? `${String(index).padStart(42, '0')}Z` : ids[index]
		);

		expect(candidates.filter(includes)).toHaveLength(9_179);
	});

	it('announces large activity scans only at bounded batch milestones', () => {
		const messages = new Set(
			Array.from({ length: 160 }, (_, index) =>
				collectionActivityScanAnnouncement({
					error: false,
					events: index * 3,
					loading: true,
					pages: index + 1,
					preservingEvents: false,
				})
			)
		);

		expect(messages.size).toBe(17);
		expect(messages).toContain('Activity scan checked 1 batch so far.');
		expect(messages).toContain('Activity scan checked 150 batches so far.');
		expect(
			collectionActivityScanAnnouncement({
				error: false,
				events: 18,
				loading: false,
				pages: 160,
				preservingEvents: false,
			})
		).toBe('Activity scan complete. 18 indexed events found.');
	});

	it('selects unavailable and still-pending summaries for an in-place retry', () => {
		const summaries: Record<string, HomeMarketSummary> = {
			listed: { status: 'resolved', value: '0.001 AR' },
			empty: { status: 'unindexed' },
			throttled: { status: 'unavailable', source: 'compute', kind: 'rate-limited' },
			index: { status: 'unavailable', source: 'index', kind: 'unavailable' },
		};

		expect(retryableHomeSummaryKeys(['listed', 'empty', 'throttled', 'index', 'pending'], summaries)).toEqual([
			'throttled',
			'index',
			'pending',
		]);
	});

	it('starts only new work while an unchanged summary remains in flight', () => {
		expect(homeSummaryRequestKeys(['existing', 'arrived'], {}, ['existing'], new Set())).toEqual(['arrived']);
	});

	it('restarts an explicitly retried in-flight summary', () => {
		expect(
			homeSummaryRequestKeys(
				['pending', 'settled'],
				{ settled: { status: 'resolved', value: null } },
				['pending'],
				new Set(['pending'])
			)
		).toEqual(['pending']);
	});

	it('keeps retry ownership until replacement requests finish', () => {
		const run = { token: 1, pending: new Set<'assets' | 'collections'>(['assets', 'collections']) };

		expect(completeHomeSummaryRetryGroup(run, 1, 'assets', 1)).toBe(false);
		expect(run.pending.has('assets')).toBe(true);
		expect(completeHomeSummaryRetryGroup(run, 1, 'assets', 0)).toBe(false);
		expect(run.pending.has('assets')).toBe(false);
		expect(completeHomeSummaryRetryGroup(run, 1, 'collections', 0)).toBe(true);
		expect(run.pending.size).toBe(0);
	});

	it('ignores completion from an obsolete retry token', () => {
		const run = { token: 2, pending: new Set<'assets' | 'collections'>(['assets']) };

		expect(completeHomeSummaryRetryGroup(run, 1, 'assets', 0)).toBe(false);
		expect(run.pending.has('assets')).toBe(true);
	});
});

describe('Home collection activity windows', () => {
	it('retains completed windows and retries only pending recipients', () => {
		const recipients = Array.from({ length: 205 }, (_, index) => `${index}`.padStart(43, 'A'));
		const firstWindow = recipients.slice(0, 100);
		const scan = reconcileHomeActivityScan(undefined, recipients);
		commitHomeActivityBatch(scan, [{ processId: firstWindow[0], height: 10 } as any], firstWindow);

		expect(pendingHomeActivityRecipients(scan, recipients)).toEqual(recipients.slice(100));
		expect(scan.candidates.get(firstWindow[0])?.height).toBe(10);
	});

	it('merges later successful windows without publishing or losing earlier candidates', () => {
		const first = 'A'.repeat(43);
		const second = 'B'.repeat(43);
		const scan = reconcileHomeActivityScan(undefined, [first, second]);
		commitHomeActivityBatch(scan, [{ processId: first, height: 20 } as any], [first]);
		expect(pendingHomeActivityRecipients(scan, [first, second])).toEqual([second]);
		commitHomeActivityBatch(scan, [{ processId: second, height: 30 } as any], [second]);

		expect([...scan.candidates.keys()]).toEqual([first, second]);
		expect(pendingHomeActivityRecipients(scan, [first, second])).toEqual([]);
	});

	it('deduplicates recipients and resets after collection members are removed', () => {
		const kept = 'A'.repeat(43);
		const removed = 'B'.repeat(43);
		const scan = reconcileHomeActivityScan(undefined, [kept, removed, kept]);
		commitHomeActivityBatch(
			scan,
			[{ processId: kept, height: 20 } as any, { processId: removed, height: 10 } as any],
			[kept, removed]
		);
		const reconciled = reconcileHomeActivityScan(scan, [kept, kept]);

		expect([...reconciled.members]).toEqual([kept]);
		expect([...reconciled.completed]).toEqual([]);
		expect([...reconciled.candidates.keys()]).toEqual([]);
		expect(pendingHomeActivityRecipients(reconciled, [kept, kept])).toEqual([kept]);
	});

	it('preserves completed windows when an incomplete index scan grows', () => {
		const first = 'A'.repeat(43);
		const added = 'B'.repeat(43);
		const scan = reconcileHomeActivityScan(undefined, [first]);
		commitHomeActivityBatch(scan, [], [first]);
		const reconciled = reconcileHomeActivityScan(scan, [first, added]);

		expect(pendingHomeActivityRecipients(reconciled, [first, added])).toEqual([added]);
	});

	it('rescans every member when a completed collection grows', () => {
		const first = 'A'.repeat(43);
		const added = 'B'.repeat(43);
		const scan = reconcileHomeActivityScan(undefined, [first]);
		commitHomeActivityBatch(scan, [{ processId: first, height: 10 } as any], [first]);
		completeHomeActivityScan(scan, [first]);
		const reconciled = reconcileHomeActivityScan(scan, [first, added]);

		expect(reconciled.indexComplete).toBe(false);
		expect(pendingHomeActivityRecipients(reconciled, [first, added])).toEqual([first, added]);
		expect(reconciled.candidates.has(first)).toBe(true);
	});

	it('keeps a complete scan through a pure collection reorder', () => {
		const first = 'A'.repeat(43);
		const second = 'B'.repeat(43);
		const scan = reconcileHomeActivityScan(undefined, [first, second]);
		commitHomeActivityBatch(scan, [], [first, second]);
		completeHomeActivityScan(scan, [first, second]);
		const reconciled = reconcileHomeActivityScan(scan, [second, first]);

		expect(reconciled.indexComplete).toBe(true);
		expect(pendingHomeActivityRecipients(reconciled, [second, first])).toEqual([]);
	});

	it('rejects foreign candidates before committing a discovery batch', () => {
		const requested = 'A'.repeat(43);
		const foreign = 'B'.repeat(43);
		const scan = reconcileHomeActivityScan(undefined, [requested]);

		expect(() => commitHomeActivityBatch(scan, [{ processId: foreign, height: 10 } as any], [requested])).toThrow(
			'home-activity-batch-out-of-scope'
		);
		expect(scan.completed.size).toBe(0);
		expect(scan.candidates.size).toBe(0);
	});
});

describe('Home collection floor retries', () => {
	const activity = (processId: string, height = 1, timestamp = height) => ({
		processId,
		height,
		timestamp,
	});

	it('retains 999 live contributions and retries only one failed candidate', () => {
		const candidates = Array.from({ length: 1000 }, (_, index) => `asset-${index}`);
		let scan = reconcileHomeFloorScan(
			undefined,
			'scope-a',
			candidates.map((processId) => activity(processId))
		);
		for (const [index, processId] of candidates.entries()) {
			if (index === 719) commitHomeFloorResult(scan, processId, null, 'unavailable');
			else commitHomeFloorResult(scan, processId, index === 500 ? 5n : 10n);
		}
		expect(pendingHomeFloorCandidates(scan)).toEqual([candidates[719]]);
		expect(homeFloorScanSummary(scan)).toEqual({ status: 'unavailable', source: 'compute', kind: 'unavailable' });

		scan = reconcileHomeFloorScan(
			scan,
			'scope-a',
			candidates.map((processId) => activity(processId))
		);
		commitHomeFloorResult(scan, candidates[719], 7n);
		expect(pendingHomeFloorCandidates(scan)).toEqual([]);
		expect(homeFloorScanSummary(scan)).toEqual({ status: 'resolved', value: '0.000000000005 AR' });
	});

	it('treats a verified no-ask result as settled and prunes removed minima', () => {
		const noAsk = 'no-ask';
		const minimum = 'minimum';
		const other = 'other';
		let scan = reconcileHomeFloorScan(
			undefined,
			'scope-a',
			[noAsk, minimum, other].map((id) => activity(id))
		);
		commitHomeFloorResult(scan, noAsk, null);
		commitHomeFloorResult(scan, minimum, 1_000_000_000_000n);
		commitHomeFloorResult(scan, other, 2_000_000_000_000n);
		expect(pendingHomeFloorCandidates(scan)).toEqual([]);
		expect(homeFloorScanSummary(scan)).toEqual({ status: 'resolved', value: '1 AR' });

		scan = reconcileHomeFloorScan(
			scan,
			'scope-a',
			[noAsk, other].map((id) => activity(id))
		);
		expect(pendingHomeFloorCandidates(scan)).toEqual([]);
		expect(homeFloorScanSummary(scan)).toEqual({ status: 'resolved', value: '2 AR' });
	});

	it('clears retained compute contributions when the gateway or collection scope changes', () => {
		const scan = reconcileHomeFloorScan(undefined, 'gateway-a:version-a', [activity('asset')]);
		commitHomeFloorResult(scan, 'asset', 1n);
		const replaced = reconcileHomeFloorScan(scan, 'gateway-b:version-a', [activity('asset')]);

		expect(pendingHomeFloorCandidates(replaced)).toEqual(['asset']);
		expect(replaced.settled.size).toBe(0);
	});

	it('revalidates only a candidate whose latest indexed activity changed', () => {
		let scan = reconcileHomeFloorScan(undefined, 'scope', [activity('changed', 1), activity('stable', 1)]);
		commitHomeFloorResult(scan, 'changed', 1n);
		commitHomeFloorResult(scan, 'stable', 2n);

		scan = reconcileHomeFloorScan(scan, 'scope', [activity('changed', 2), activity('stable', 1)]);
		expect(pendingHomeFloorCandidates(scan)).toEqual(['changed']);
		expect(scan.settled.get('stable')).toBe(2n);
	});

	it('streams only candidates whose retained floor contribution is not current', () => {
		const settled = activity('settled', 1);
		const failed = activity('failed', 1);
		let scan = reconcileHomeFloorScan(undefined, 'scope', [settled, failed]);
		commitHomeFloorResult(scan, settled.processId, 1n);
		commitHomeFloorResult(scan, failed.processId, null, 'unavailable');

		expect(homeFloorCandidateNeedsResolution(scan, 'scope', settled)).toBe(false);
		expect(homeFloorCandidateNeedsResolution(scan, 'scope', failed)).toBe(true);
		expect(homeFloorCandidateNeedsResolution(scan, 'scope', activity(settled.processId, 2))).toBe(true);
		expect(homeFloorCandidateNeedsResolution(scan, 'other-scope', settled)).toBe(true);
	});

	it('rejects stale or foreign result commits', () => {
		const scan = reconcileHomeFloorScan(undefined, 'scope', [activity('asset')]);
		expect(() => commitHomeFloorResult(scan, 'foreign', 1n)).toThrow('home-floor-result-out-of-scope');
	});
});

describe('Collection activity scope', () => {
	const asset = { id: 'A'.repeat(43), name: 'Asset' };

	it('changes with a names namespace replacement', () => {
		const collection: Collection = {
			id: 'names',
			name: 'Names',
			description: '',
			kind: 'names',
			assets: [asset],
			namespace: { manifestId: 'M'.repeat(43), namesById: { [asset.id]: 'asset' } },
		};

		expect(collectionActivityVersion(collection)).not.toBe(
			collectionActivityVersion({
				...collection,
				namespace: { ...collection.namespace!, manifestId: 'N'.repeat(43) },
			})
		);
	});

	it('changes when another paged token enters the loaded window', () => {
		const collection: Collection = {
			id: 'tokens',
			name: 'Tokens',
			description: '',
			kind: 'tokens',
			assets: [asset],
			manifestId: 'M'.repeat(43),
		};

		expect(collectionActivityVersion(collection)).not.toBe(
			collectionActivityVersion({
				...collection,
				assets: [...collection.assets, { id: 'B'.repeat(43), name: 'Another asset' }],
			})
		);
	});

	it('keeps listing scope stable when a paged token window only grows', () => {
		const collection: Collection = {
			id: 'tokens',
			name: 'Tokens',
			description: '',
			kind: 'tokens',
			assets: [asset],
			manifestId: 'M'.repeat(43),
		};

		expect(collectionListingScopeVersion(collection)).toBe(
			collectionListingScopeVersion({
				...collection,
				assets: [...collection.assets, { id: 'B'.repeat(43), name: 'Another asset' }],
			})
		);
	});

	it('checks only the newly loaded token window and resets after removal', () => {
		expect(collectionAssetWindowDelta(['a', 'b'], ['a', 'b', 'c', 'd'])).toEqual({
			reset: false,
			added: ['c', 'd'],
		});
		expect(collectionAssetWindowDelta(['a', 'b'], ['b', 'c'])).toEqual({
			reset: true,
			added: ['b', 'c'],
		});
	});

	it('keeps an aborted token delta in the next incremental request', () => {
		const scanned = new Set(['a']);
		expect(collectionAssetWindowDelta(scanned, ['a', 'b']).added).toEqual(['b']);
		// The b request aborts, so only successfully scanned a remains committed.
		expect(collectionAssetWindowDelta(scanned, ['a', 'b', 'c']).added).toEqual(['b', 'c']);
	});

	it('uses incremental recipient windows for names activity but not global name listings', () => {
		expect(collectionActivityWindowDelta('names', false, ['a'], ['a', 'b'])).toEqual({
			recipientBatched: true,
			reset: false,
			added: ['b'],
		});
		expect(collectionActivityWindowDelta('names', true, ['a'], ['a', 'b'])).toEqual({
			recipientBatched: false,
			reset: false,
			added: ['a', 'b'],
		});
	});
});

describe('Collection listing announcements', () => {
	it('keeps announced progress monotonic as discovered pages expand the total', () => {
		const sequence = [
			{ resolved: 100, total: 100, failures: 3 },
			{ resolved: 100, total: 200, failures: 3 },
			{ resolved: 200, total: 200, failures: 6 },
			{ resolved: 200, total: 300, failures: 6 },
			{ resolved: 300, total: 300, failures: 9 },
		];
		let progress = { scope: 'collection', resolved: 0, failures: 0 };
		const announced = sequence.map((step) => {
			progress = nextListingAnnouncementProgress(progress, {
				...step,
				scope: 'collection',
				loading: true,
			});
			return progress.resolved;
		});

		expect(announced).toEqual([100, 100, 200, 200, 300]);
	});

	it('holds failure churn until a milestone and reports exact completion immediately', () => {
		const initial = { scope: 'collection', resolved: 0, failures: 0 };
		const belowMilestone = nextListingAnnouncementProgress(initial, {
			scope: 'collection',
			resolved: 7,
			failures: 7,
			total: 100,
			loading: true,
		});
		expect(belowMilestone).toEqual(initial);
		expect(
			nextListingAnnouncementProgress(belowMilestone, {
				scope: 'collection',
				resolved: 7,
				failures: 7,
				total: 100,
				loading: false,
			})
		).toEqual({ scope: 'collection', resolved: 7, failures: 7 });
	});
});

describe('Collection activity windows', () => {
	it('deduplicates completion-order results and retains the exact newest limit', () => {
		const events = Array.from({ length: 205 }, (_, index) => ({
			id: `event-${index}`,
			processId: `process-${index}`,
			action: 'transfer' as const,
			actor: 'actor',
			height: index + 1,
			timestamp: (index + 1) * 10,
		}));
		expect(
			newestCollectionActivity([...events.slice(100), ...events.slice(0, 100), events[204]]).map(
				(event) => event.id
			)
		).toEqual(
			events
				.slice(105)
				.reverse()
				.map((event) => event.id)
		);
	});

	it('keeps an immutable purchase proof when fresh index data repeats the event', () => {
		const proved = {
			id: 'purchase',
			processId: 'asset',
			action: 'register-interest' as const,
			actor: 'buyer',
			height: 10,
			timestamp: 20,
			purchaseProof: { transactionId: 'payment', height: 11 },
		};
		expect(newestCollectionActivity([proved, { ...proved, purchaseProof: undefined }])[0].purchaseProof).toEqual(
			proved.purchaseProof
		);
	});

	it('bounds the retained activity map while admitting newer late batches', () => {
		const activity = new Map<string, CollectionActivityEvent>();
		const events = Array.from({ length: 150 }, (_, index) => ({
			id: `event-${index}`,
			processId: `process-${index}`,
			action: 'transfer' as const,
			actor: 'actor',
			height: index + 1,
			timestamp: index + 1,
		}));
		retainNewestCollectionActivity(activity, events.slice(0, 120));
		expect(activity.size).toBe(100);
		expect(retainNewestCollectionActivity(activity, events.slice(120)).map((event) => event.id)).toEqual(
			events
				.slice(50)
				.reverse()
				.map((event) => event.id)
		);
		expect(activity.size).toBe(100);
	});
});

describe('Collection live listing truth', () => {
	const liveListing = (id: string, marker = id) =>
		({
			asset: { id, name: marker },
			state: { orders: { order: { status: 'open' } } },
		} as any);

	it('merges a resolution batch once with last-outcome truth', () => {
		const first = { asset: { id: 'a' } } as any;
		const second = { asset: { id: 'b' } } as any;
		const untouched = liveListing('d');
		const latest = liveListing('a', 'latest');
		expect(
			mergeResolvedListingBatch(
				[first, second, untouched],
				[
					{ processId: 'a', result: liveListing('a', 'older') },
					{ processId: 'b', result: null },
					{ processId: 'c', result: liveListing('c') },
					{ processId: 'a', result: latest },
				]
			)
		).toEqual([untouched, liveListing('c'), latest]);
	});

	it('restores a listing only from a successful current live-state result', () => {
		const previous = { asset: { id: 'a' } } as any;
		const current = liveListing('a');
		expect(mergeResolvedListingBatch([previous], [{ processId: 'a', result: current }])).toEqual([current]);
	});

	it('consumes a 10,000-listing resolution iterable exactly once', () => {
		let iterations = 0;
		const outcomes = {
			*[Symbol.iterator]() {
				iterations += 1;
				if (iterations > 1) throw new Error('resolution batch was consumed twice');
				for (let index = 0; index < 10_000; index += 1) {
					const processId = `${String(index).padStart(42, '0')}A`;
					yield { processId, result: liveListing(processId) };
				}
			},
		};

		const merged = mergeResolvedListingBatch([], outcomes);
		expect(iterations).toBe(1);
		expect(merged).toHaveLength(10_000);
		expect(new Set(merged.map((result) => result.asset.id)).size).toBe(10_000);
	});
});
