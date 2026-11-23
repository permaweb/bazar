import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CollectionActivityEvent, ResolvedAsset } from 'api/asset-discovery';
import { parseAssetState } from 'api/asset-marketplace';
import {
	type Collection,
	compiledFungibleTokenCollection,
	fungibleAssetFromState,
	HIDDEN_COLLECTION_IDS,
	hiddenCollectionAssetIndex,
	replaceHiddenCollectionAssetIndex,
} from 'api/collections';

import { nextStableOrder, stableOrderDiffers } from 'helpers/stable-order';

import {
	ACTIVITY_CATALOGUE_QUIET_MS,
	ACTIVITY_CATALOGUE_WAIT_CAP_MS,
	activityCatalogueMembershipKey,
	activityCatalogueRevealDelay,
	activityLoadingPlacement,
	AssetCardArtwork,
	assetDetailCanResolve,
	assetDetailMembership,
	assetDetailMembershipVerified,
	COLLECTION_PRICE_DISPLAY_DEADLINE_MS,
	collectionActivityScanAnnouncement,
	collectionActivityVersion,
	collectionActivityWindowDelta,
	collectionAssetOrderKey,
	collectionAssetWindowDelta,
	collectionCandidateMembership,
	collectionCardPriceLabel,
	collectionDefaultsToListed,
	CollectionDescription,
	collectionListedFromSearch,
	collectionListingScopeVersion,
	collectionPriceRetryNotice,
	collectionRecipientsWithoutListingCandidates,
	CollectionTabs,
	collectionViewFromSearch,
	collectionViewSearch,
	commitHomeActivityBatch,
	commitHomeFloorResult,
	compareCollectionAssetNames,
	compareHomeCollections,
	compareHomeListingRecency,
	completeHomeActivityScan,
	completeHomeSummaryRetryGroup,
	createAnimationFrameBatch,
	createCollectionPriceDeadlines,
	cumulativeCollectionDepth,
	DiscoveryAssetArtwork,
	filterGlobalActivity,
	globalActivityCollection,
	globalActivityRecipientIds,
	globalActivityRevealDescription,
	globalCatalogueActivity,
	heldPriceRetryNotice,
	HOME_ASSET_PAGE_SIZE,
	HOME_DISCOVER_LOADING_DEADLINE_MS,
	HOME_DISCOVER_TOKEN_PAGE_SIZE,
	HOME_DISCOVER_UNIQUE_PREVIEW,
	HOME_SUMMARY_AUTO_RETRY_LIMIT,
	HOME_TOKEN_CHANGE_DISPLAY_DEADLINE_MS,
	HOME_TOKEN_CHANGE_MAX_AGE_MS,
	HOME_TOKEN_CHANGE_REFRESH_MS,
	HOME_TOKEN_CHANGE_RETRY_MS,
	homeAllAssets,
	homeAssetPage,
	homeAssetTypeMatches,
	homeAssetVisibleForView,
	homeCollectionAssetCountLabel,
	homeCollectionFloorsPending,
	homeDiscoverBusy,
	homeDiscoverDisplay,
	homeDiscoverFailureNotice,
	homeDiscoverOrderId,
	homeDiscoverOrderSettled,
	homeDiscoverOverdueFailure,
	homeDiscoverPagesFull,
	homeDiscoverPartialFailureMessage,
	homeDiscoverPending,
	homeDiscoveryAssets,
	homeFloorCandidateNeedsResolution,
	homeFloorScanSummary,
	homeListingComputeFailure,
	homeListingCrawlDemand,
	homeListingSupportVersion,
	homeMarketHasPending,
	homeMarketPriceValue,
	homeMarketShellLoading,
	homeMarketShowsInitialLoader,
	homeMarketSummariesReady,
	type HomeMarketSummary,
	HomeMarketTabs,
	homeRouteSearch,
	homeScrollIndicatorMetrics,
	homeSearchAssets,
	homeSummaryAutoRetryDue,
	homeSummaryFailuresPresent,
	homeSummaryRequestKeys,
	homeSummaryWindow,
	homeTabFromPathname,
	homeTabHeading,
	homeTabPath,
	homeTokenPlaceholderRows,
	homeTokenPriceChangeCurrent,
	homeTokenPriceChangeDueAt,
	homeTokenPriceChangeFailed,
	homeTokenPriceChangeLabel,
	homeTokenPriceChangeNextCheck,
	homeTokenPriceChangePending,
	homeTokenPriceChangePercent,
	homeTokenPriceChangeRequests,
	isFungiblePendingMint,
	marketCatalogueCollections,
	mergeResolvedListingBatch,
	newestCollectionActivity,
	nextListingAnnouncementProgress,
	observeCollectionPriceDeadlines,
	pendingCollectionPriceAssets,
	pendingHomeActivityRecipients,
	pendingHomeFloorCandidates,
	PRESERVE_ROUTE_FOCUS,
	publishHomeListingResult,
	reconcileHomeActivityScan,
	reconcileHomeFloorScan,
	reconcileHomeListingAssets,
	recordHomeListingComputeResult,
	restartCollectionPriceDeadlines,
	retainedCollectionAssetNames,
	retainNewestCollectionActivity,
	retryableHomeSummaryKeys,
	routeFocusAction,
	routeFocusPreserved,
	shouldLoadHomeAssetSummaries,
	shouldLoadHomeCollectionSummaries,
	tokenListingNoticeCopy,
	tokenListingStatus,
	verifiedAssetForDetail,
	verifiedCollectionIdsFrom,
	visibleActivityAssets,
	withoutDuplicatedCreatedAssets,
} from './App';
import {
	loadAssetShellSnapshot,
	loadHiddenCollectionAssetIndex,
	loadHomeListingSnapshot,
	loadMarketShellSnapshot,
	storeAssetShellSnapshot,
	storeHiddenCollectionAssetIndex,
	storeHomeListingSnapshot,
	storeMarketShellSnapshot,
} from './shell-snapshot';

const readyHiddenCollectionIndex = Object.fromEntries(HIDDEN_COLLECTION_IDS.map((id) => [id, []]));

beforeEach(() => replaceHiddenCollectionAssetIndex(readyHiddenCollectionIndex));
afterEach(() => replaceHiddenCollectionAssetIndex({}));

describe('Home market summary retries', () => {
	it('re-ranks the collection grid at once only for viewer choices, not for streamed data', () => {
		const recent = collectionAssetOrderKey('recent', 'all', '', false);
		expect(collectionAssetOrderKey('recent', 'all', '  ', false)).toBe(recent);
		expect(collectionAssetOrderKey('recent', 'all', ' Dum ', false)).toBe(
			collectionAssetOrderKey('recent', 'all', 'dum', false)
		);
		expect(collectionAssetOrderKey('price-low', 'all', '', false)).not.toBe(recent);
		expect(collectionAssetOrderKey('recent', 'D', '', false)).not.toBe(recent);
		expect(collectionAssetOrderKey('recent', 'all', '', true)).not.toBe(recent);
	});

	it('calculates cumulative order-book depth from ascending offer quantities', () => {
		expect(cumulativeCollectionDepth([1, 1, 3, 5])).toEqual([10, 20, 50, 100]);
		const fallback = cumulativeCollectionDepth([0, Number.NaN, -1]);
		expect(fallback[0]).toBeCloseTo(100 / 3);
		expect(fallback[1]).toBeCloseTo(200 / 3);
		expect(fallback[2]).toBe(100);
	});

	it('does not start a visible-price fallback while the primary collection listing pass is active', () => {
		const assets = [
			{ id: 'A'.repeat(43), name: 'One' },
			{ id: 'B'.repeat(43), name: 'Two' },
		];
		expect(pendingCollectionPriceAssets(assets, [], true)).toEqual([]);
		expect(pendingCollectionPriceAssets(assets, [assets[0].id], false)).toEqual([assets[1]]);
	});

	it('marks completed recipients without listing candidates as resolved index misses', () => {
		const first = 'A'.repeat(43);
		const second = 'B'.repeat(43);
		expect(collectionRecipientsWithoutListingCandidates([first, second], [{ processId: second }])).toEqual([first]);
	});

	it('calculates an exact 24-hour token ask change from differently sized listings', () => {
		const now = Date.UTC(2026, 7, 14, 12);
		const offer = (id: string, hoursAgo: number, asking: string, quantity: string): CollectionActivityEvent => ({
			id,
			processId: 'T'.repeat(43),
			action: 'make-offer',
			actor: 'W'.repeat(43),
			height: 1,
			timestamp: (now - hoursAgo * 60 * 60 * 1_000) / 1_000,
			asking,
			quantity,
		});

		expect(
			homeTokenPriceChangePercent(
				[offer('old', 25, '1', '1'), offer('first', 20, '200', '2'), offer('last', 1, '450', '3')],
				now
			)
		).toBe(50);
		expect(
			homeTokenPriceChangePercent(
				Array.from({ length: 200 }, (_, index) => offer(String(index), 20 - index / 20, '100', '1')),
				now,
				false
			)
		).toBeNull();
		expect(
			homeTokenPriceChangePercent(
				[offer('first', 20, '1', '1'), offer('last', 1, `1${'0'.repeat(400)}`, '1')],
				now
			)
		).toBeNull();
		expect(homeTokenPriceChangeLabel(50)).toBe('+50%');
		expect(homeTokenPriceChangeLabel(-12.5)).toBe('-12.5%');
		expect(homeTokenPriceChangeLabel(null)).toBe('—');
		expect(homeTokenPriceChangeLabel(Number.POSITIVE_INFINITY)).toBe('—');
	});

	it('renders collection descriptions as collapsed, wrappable header copy', () => {
		const description =
			'Dumdumz are a long-running collection of expressive characters permanently published on Arweave.';
		const markup = renderToStaticMarkup(React.createElement(CollectionDescription, { description }));

		expect(markup).toContain(description);
		expect(markup).toContain('collection-description');
		expect(markup).toContain('is-collapsed');
	});

	it('renders permanent token logos in Discover and collection cards', () => {
		const logo = `https://arweave.net/${'L'.repeat(43)}`;
		const asset = {
			id: 'T'.repeat(43),
			name: 'Trunky',
			ticker: 'TRUNKY',
			contentType: 'application/x.arweave-token',
			image: logo,
		};
		const collection: Collection = {
			id: 'fungible-tokens',
			name: 'Tokens',
			description: '',
			kind: 'tokens',
			assets: [asset],
		};

		const discover = renderToStaticMarkup(
			React.createElement(DiscoveryAssetArtwork, { asset, collection, priority: true })
		);
		const collectionCard = renderToStaticMarkup(
			React.createElement(AssetCardArtwork, { asset, collection, priority: true })
		);

		expect(discover).toContain(`src="${logo}"`);
		expect(discover).toContain('home-asset-media');
		expect(discover).not.toContain('token-artwork');
		expect(collectionCard).toContain(`src="${logo}"`);
		expect(collectionCard).not.toContain('token-artwork');
	});

	it('keeps the ticker artwork as the fungible-card fallback when no logo exists', () => {
		const asset = {
			id: 'T'.repeat(43),
			name: 'Trunky',
			ticker: 'TRUNKY',
			contentType: 'application/x.arweave-token',
		};
		const collection: Collection = {
			id: 'fungible-tokens',
			name: 'Tokens',
			description: '',
			kind: 'tokens',
			assets: [asset],
		};

		const markup = renderToStaticMarkup(React.createElement(DiscoveryAssetArtwork, { asset, collection }));

		expect(markup).toContain('token-artwork');
		expect(markup).toContain('circle-only-token-art');
		expect(markup).toContain('TRUNKY');
	});
	it('classifies pending fungible processes as tokens instead of media assets', () => {
		expect(
			isFungiblePendingMint({ contentType: 'application/x.arweave-token', ticker: 'SIG' }, 'fungible-tokens')
		).toBe(true);
		expect(isFungiblePendingMint({ contentType: 'audio/mpeg' }, 'created-assets')).toBe(false);
	});
	it('gives each Home tab its own page heading, so each tab route gets its own document title', () => {
		expect(homeTabHeading('discover')).toBe('Discover');
		expect(homeTabHeading('collections')).toBe('Collections');
		expect(homeTabHeading('activity')).toBe('Activity');
	});
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

	it('hides denied collection cards, their assets, and denied fungible assets at the catalogue boundary', () => {
		const previousIndex = hiddenCollectionAssetIndex();
		const hidden: Collection = {
			id: 'q5KruM1NXsh-bu0oh51sk-3czm5ZBAu22twpwDl8WMY',
			name: 'HTML Colors',
			description: 'Superseded collection',
			kind: 'images',
			assets: [{ id: 'z'.repeat(43), name: 'Old color' }],
		};
		const hiddenId = 'bASFYsRBQm_dfG__wqRVwMh8bqwEvSTl4lURRBqfu2M';
		const visible = { id: 'rQugKt4xEQcsy2yTmJJtlbPqblX6sFAudqjlf2ndV2Y', name: 'REKT TRUNK' };
		const tokens: Collection = {
			id: 'fungible-tokens',
			name: 'Fungible tokens',
			description: 'Tokens',
			kind: 'tokens',
			assets: [hidden.assets[0], { id: hiddenId, name: '[TEST] PcMK spawn trade transfer' }, visible],
			total: 3,
		};

		try {
			replaceHiddenCollectionAssetIndex({
				...previousIndex,
				[hidden.id]: hidden.assets.map((asset) => asset.id),
			});
			expect(marketCatalogueCollections([hidden, tokens])).toEqual([{ ...tokens, assets: [visible], total: 1 }]);
		} finally {
			replaceHiddenCollectionAssetIndex(previousIndex);
		}
	});

	it('round-trips verified hidden-collection membership for offline reloads', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
		};
		const index = {
			...readyHiddenCollectionIndex,
			'q5KruM1NXsh-bu0oh51sk-3czm5ZBAu22twpwDl8WMY': ['z'.repeat(43)],
		};

		storeHiddenCollectionAssetIndex(storage, index);

		expect(loadHiddenCollectionAssetIndex(storage)).toEqual(index);
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
		const hiddenAsset = {
			id: 'bASFYsRBQm_dfG__wqRVwMh8bqwEvSTl4lURRBqfu2M',
			name: 'Hidden test token',
		};

		storeAssetShellSnapshot(storage, asset);
		storeAssetShellSnapshot(storage, hiddenAsset);
		expect(loadAssetShellSnapshot(storage, asset.id)).toEqual(asset);
		expect(loadAssetShellSnapshot(storage, 'another-id')).toBeUndefined();
		expect(loadAssetShellSnapshot(storage, hiddenAsset.id)).toBeUndefined();
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

	it('drops cached Home listings for denied collections and fungible assets', () => {
		const listing = (assetId: string, collectionId: string) => ({
			asset: { id: assetId, name: 'Hidden' },
			collection: {
				id: collectionId,
				name: 'Hidden',
				description: '',
				kind: 'images',
				assets: [{ id: assetId, name: 'Hidden' }],
			},
			activity: { processId: assetId, height: 1, timestamp: 1 },
			price: '1 AR',
		});
		const storage = {
			getItem: () =>
				JSON.stringify({
					scope: 'nodes',
					updatedAt: 1,
					listings: [
						listing('A'.repeat(43), 'q5KruM1NXsh-bu0oh51sk-3czm5ZBAu22twpwDl8WMY'),
						listing('IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA', 'fungible-tokens'),
					],
				}),
		};

		expect(loadHomeListingSnapshot(storage, 'nodes', 60_000, 2)).toEqual([]);
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

	it('does not resolve cached or direct assets while hidden membership is incomplete', () => {
		const asset = { id: 'A'.repeat(43), name: 'Cached asset' };
		replaceHiddenCollectionAssetIndex({});

		expect(
			assetDetailCanResolve({
				assetId: asset.id,
				cachedAsset: asset,
				directAtomicRoute: true,
				directFungibleRoute: true,
			})
		).toBe(false);
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

	it('does not resolve exact denied asset routes', () => {
		const assetId = 'bASFYsRBQm_dfG__wqRVwMh8bqwEvSTl4lURRBqfu2M';
		expect(
			assetDetailCanResolve({
				assetId,
				cachedAsset: { id: assetId, name: 'Hidden test token' },
				directAtomicRoute: true,
				directFungibleRoute: true,
			})
		).toBe(false);
	});

	it('starts a deep-linked atomic read from its exact indexed metadata while collection membership settles', () => {
		const asset = { id: 'A'.repeat(43), name: 'Indexed asset' };
		expect(
			assetDetailCanResolve({
				assetId: asset.id,
				indexedMetadata: asset,
				directAtomicRoute: false,
			})
		).toBe(true);
		expect(assetDetailMembershipVerified('large-collection', new Set(), false)).toBe(false);
	});

	it('changes listing support as progressively loaded collections expand', () => {
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

	it('bounds the home listing crawl to the visible page plus one page ahead', () => {
		const view = { assetView: 'listed' as const, assetType: 'atomic' as const, query: '', tokenPage: 1 };
		const listing = (kind: Collection['kind']) =>
			({ collection: { id: kind, name: kind, description: '', kind, assets: [] } } as unknown as ResolvedAsset);

		const firstPage = homeListingCrawlDemand({ ...view, assetPage: 1 })!;
		expect(firstPage.map(({ count }) => count)).toEqual([2 * HOME_ASSET_PAGE_SIZE]);
		expect(firstPage[0].matches?.(listing('images'))).toBe(true);
		expect(firstPage[0].matches?.(listing('tokens'))).toBe(false);
		expect(homeListingCrawlDemand({ ...view, assetPage: 3 })!.map(({ count }) => count)).toEqual([
			4 * HOME_ASSET_PAGE_SIZE,
		]);

		const overview = homeListingCrawlDemand({ ...view, assetType: 'all', assetPage: 1, tokenPage: 2 })!;
		expect(overview.map(({ count }) => count)).toEqual([
			HOME_DISCOVER_UNIQUE_PREVIEW + HOME_ASSET_PAGE_SIZE,
			3 * HOME_DISCOVER_TOKEN_PAGE_SIZE,
		]);
		expect(overview[1].matches?.(listing('tokens'))).toBe(true);

		// Without a collection lookup every candidate stays admissible.
		expect(overview[1].admits).toBeUndefined();
		const tokens = listing('tokens').collection;
		const images = listing('images').collection;
		const known = new Map([
			['T'.repeat(43), tokens],
			['I'.repeat(43), images],
		]);
		const [uniques, tokenRows] = homeListingCrawlDemand(
			{ ...view, assetType: 'all', assetPage: 1, tokenPage: 1 },
			(processId) => known.get(processId)
		)!;
		const candidate = (processId: string) => ({ processId, height: 1, timestamp: 1, sources: [] });
		expect(uniques.admits?.(candidate('T'.repeat(43)))).toBe(false);
		expect(uniques.admits?.(candidate('I'.repeat(43)))).toBe(true);
		expect(tokenRows.admits?.(candidate('T'.repeat(43)))).toBe(true);
		expect(tokenRows.admits?.(candidate('I'.repeat(43)))).toBe(false);
		// A process no loaded collection claims yet may be either kind.
		expect(uniques.admits?.(candidate('U'.repeat(43)))).toBe(true);
		expect(tokenRows.admits?.(candidate('U'.repeat(43)))).toBe(true);

		// Price order and search rank every live listing, so they keep the full crawl.
		expect(homeListingCrawlDemand({ ...view, assetView: 'price-low', assetPage: 1 })).toBeUndefined();
		expect(homeListingCrawlDemand({ ...view, assetView: 'price-high', assetPage: 1 })).toBeUndefined();
		expect(homeListingCrawlDemand({ ...view, query: 'rare', assetPage: 1 })).toBeUndefined();
	});

	it('reads card summaries only for the listings the visible pages plus one ahead need', () => {
		const collection = (kind: Collection['kind']): Collection => ({
			id: kind,
			name: kind,
			description: '',
			kind,
			assets: [],
		});
		const tokens = collection('tokens');
		const images = collection('images');
		const card = (id: string, owner: Collection) => ({ asset: { id: id.repeat(43) }, collection: owner });
		const listed: HomeMarketSummary = { status: 'resolved', value: '1 AR' };
		const unlisted: HomeMarketSummary = { status: 'resolved', value: null };
		const view = { assetView: 'listed' as const, query: '', assetPage: 1, tokenPage: 1 };
		const [uniqueDemand] = homeListingCrawlDemand({ ...view, assetType: 'atomic' })!;
		const demand = [{ ...uniqueDemand, count: 3 }];
		const ids = (cards: Array<{ asset: { id: string } }>) => cards.map(({ asset }) => asset.id[0]).join('');
		const candidates = ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => card(id, images));

		// Nothing known yet: only the first three unknown candidates are read.
		expect(ids(homeSummaryWindow(candidates, demand, {}))).toBe('ABC');
		// Known listings fill the demand without a read; an unlisted one frees its slot.
		expect(
			ids(
				homeSummaryWindow(candidates, demand, {
					['A'.repeat(43)]: listed,
					['B'.repeat(43)]: unlisted,
				})
			)
		).toBe('ABCD');
		// Crawl listings lead the candidates with known prices, so they leave no
		// speculative reads; later known summaries are kept but never re-read.
		expect(
			ids(
				homeSummaryWindow(candidates, demand, {
					['A'.repeat(43)]: listed,
					['B'.repeat(43)]: listed,
					['C'.repeat(43)]: listed,
					['F'.repeat(43)]: unlisted,
				})
			)
		).toBe('ABCF');

		// Each demand counts only its own type, so token rows do not use up Unique slots.
		const overview = homeListingCrawlDemand({ ...view, assetType: 'all' })!.map((entry, index) => ({
			...entry,
			count: index === 0 ? 1 : 2,
		}));
		const mixed = [card('T', tokens), card('A', images), card('U', tokens), card('B', images), card('V', tokens)];
		expect(ids(homeSummaryWindow(mixed, overview, {}))).toBe('TAU');

		// While the crawl works, only candidates with known summaries stay in the window.
		expect(ids(homeSummaryWindow(candidates, demand, { ['B'.repeat(43)]: listed }, false))).toBe('B');

		// Price order and search rank every candidate.
		expect(ids(homeSummaryWindow(candidates, undefined, {}))).toBe('ABCDEF');
	});

	it('settles a bounded listed Discover once its summary window is known, not every candidate', () => {
		const images: Collection = { id: 'images', name: 'images', description: '', kind: 'images', assets: [] };
		const candidates = ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => ({
			asset: { id: id.repeat(43) },
			collection: images,
		}));
		const view = {
			assetView: 'listed' as const,
			assetType: 'atomic' as const,
			query: '',
			assetPage: 1,
			tokenPage: 1,
		};
		const [uniqueDemand] = homeListingCrawlDemand(view)!;
		const demand = [{ ...uniqueDemand, count: 3 }];
		const listed: HomeMarketSummary = { status: 'resolved', value: '1 AR' };
		const summaries: Record<string, HomeMarketSummary> = {
			['A'.repeat(43)]: listed,
			['B'.repeat(43)]: listed,
			['C'.repeat(43)]: listed,
		};
		const windowIds = homeSummaryWindow(candidates, demand, summaries).map(({ asset }) => asset.id);
		// D-F are never read for this view, so they must not hold the order (and token placeholders) open.
		expect(homeDiscoverOrderSettled('listed', false, windowIds, summaries)).toBe(true);
		expect(
			homeDiscoverOrderSettled(
				'listed',
				false,
				candidates.map(({ asset }) => asset.id),
				summaries
			)
		).toBe(false);
		// An unread candidate inside the window still holds it.
		const partial = { ['A'.repeat(43)]: listed };
		expect(
			homeDiscoverOrderSettled(
				'listed',
				false,
				homeSummaryWindow(candidates, demand, partial).map(({ asset }) => asset.id),
				partial
			)
		).toBe(false);
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

	it('shows a token from its live contract when only the token index is unavailable', () => {
		const tokenId = 'T'.repeat(43);
		const contract = {
			device: 'process@1.0',
			'execution-device': 'token@1.0',
			'hint-ui-style': 'fungible',
			'swap-device': 'arweave-swap@1.0',
			'scheduler-device': 'arweave-scheduler@1.0',
			'scheduler-mode': 'all',
			name: 'Live token',
			'total-supply': '1000',
			denomination: 3,
			balances: { ['W'.repeat(43)]: '1000' },
			orders: {},
		};
		const fallback = compiledFungibleTokenCollection();
		const live = Boolean(fungibleAssetFromState(tokenId, parseAssetState(contract)));
		expect(fallback.indexSource).toBe('compiled-fallback');
		expect(live).toBe(true);

		// The index read failed: the page renders from live state with a listing notice.
		expect(assetDetailMembership(fallback, new Set(), false, live)).toBe('live');
		// The index answered: nothing to flag.
		expect(assetDetailMembership(fallback, new Set([fallback.id]), false, live)).toBe('verified');
		// A process that does not declare the swap contract stays on the loading shell.
		const noSwap = { ...contract, 'swap-device': 'other-swap@1.0' };
		expect(fungibleAssetFromState(tokenId, parseAssetState(noSwap))).toBeUndefined();
		expect(assetDetailMembership(fallback, new Set(), false, false)).toBe('unverified');
		// Image membership is defined by its index only, so a live state never stands in for it.
		const images: Collection = { id: 'images', name: 'Images', description: '', kind: 'images', assets: [] };
		expect(assetDetailMembership(images, new Set(), false, true)).toBe('unverified');
		expect(assetDetailMembership(undefined, new Set(), true, false)).toBe('verified');
	});

	it('words the token listing notice as a pending check, then as an unverified or checked listing', () => {
		expect(tokenListingNoticeCopy('checking').compact).toBe('Checking the Bazar listing…');
		expect(tokenListingNoticeCopy('unverified').compact).toBe('Bazar listing could not be verified right now.');
		expect(tokenListingNoticeCopy('unverified').message).toContain('read from live state');
		expect(tokenListingNoticeCopy('checked').compact).toBe('Bazar listing checked.');
		expect(tokenListingNoticeCopy('checked').message).toContain('read from live state');
	});

	it('keeps a painted token listing line as checked instead of removing it', () => {
		expect(tokenListingStatus('live', true, false)).toBe('checking');
		expect(tokenListingStatus('live', false, true)).toBe('unverified');
		// The line was painted while the index was unread: it stays, so the panels below hold still.
		expect(tokenListingStatus('verified', false, true)).toBe('checked');
		// Verified from the first paint: no line at all.
		expect(tokenListingStatus('verified', false, false)).toBeNull();
		expect(tokenListingStatus('unverified', true, true)).toBeNull();
	});

	it('keeps collection members out of the standalone created-assets collection', () => {
		const shared = { id: 'A'.repeat(43), name: 'Collection asset' };
		const standalone = { id: 'S'.repeat(43), name: 'Standalone asset' };
		const collections = withoutDuplicatedCreatedAssets([
			{
				id: 'created-assets',
				name: 'Created on Bazar',
				description: '',
				kind: 'images',
				assets: [shared, standalone],
				total: 2,
			},
			{
				id: 'C'.repeat(43),
				name: 'Uploaded collection',
				description: '',
				kind: 'images',
				assets: [shared],
				total: 1,
			},
		]);

		expect(collections[0]).toMatchObject({ id: 'created-assets', assets: [standalone], total: 1 });
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

	it('replaces stale portable metadata with the verified collection asset', () => {
		const id = 'i'.repeat(43);
		const other = { id: 'o'.repeat(43), name: 'Other' };
		const placeholder = { id, name: `${id.slice(0, 7)}…${id.slice(-6)}` };
		const resolved = { id, name: 'Chartreuse', image: `https://arweave.net/${id}` };
		const collection: Collection = {
			id: 'images',
			name: 'HTML Colors',
			description: '',
			kind: 'images',
			assets: [placeholder],
		};

		expect(
			homeDiscoveryAssets([collection], { images: [other, resolved] }, 1, [{ asset: placeholder, collection }])
		).toEqual([
			{ asset: resolved, collection },
			{ asset: other, collection },
		]);
	});

	it('keeps all verified listings ordered by activity when the fallback budget is full', () => {
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
		).toEqual([
			{ asset: newer, collection, activity: { processId: newer.id, height: 2, timestamp: 2 } },
			{ asset: older, collection, activity: { processId: older.id, height: 1, timestamp: 1 } },
		]);
	});

	it('checks every indexed token even beyond the mixed discovery fallback budget', () => {
		const tokens: Collection = {
			id: 'fungible-tokens',
			name: 'Tokens',
			description: '',
			kind: 'tokens',
			assets: Array.from({ length: 50 }, (_, index) => ({
				id: `token${index}`.padEnd(43, 't'),
				name: `Token ${index}`,
			})),
		};
		const images: Collection = {
			id: 'images',
			name: 'Images',
			description: '',
			kind: 'images',
			assets: Array.from({ length: 80 }, (_, index) => ({
				id: `image${index}`.padEnd(43, 'i'),
				name: `Image ${index}`,
				image: 'https://example.com/image',
			})),
		};
		const candidates = homeDiscoveryAssets([images, tokens], {}, 36);
		const tokenCandidates = candidates.filter(({ collection }) => homeAssetTypeMatches(collection, 'tokens'));
		expect(tokenCandidates.map(({ asset }) => asset.id)).toEqual(tokens.assets.map(({ id }) => id));
		expect(homeAssetPage(tokenCandidates, 6).items.map(({ asset }) => asset.id)).toContain(tokens.assets[49].id);
		expect(candidates.filter(({ collection }) => collection.kind !== 'tokens').length).toBeLessThanOrEqual(36);
		expect(new Set(candidates.map(({ asset }) => asset.id)).size).toBe(candidates.length);
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
		const renamed = { id: 'first', name: 'Resolved First' };
		const start = { collection: [first] };

		expect(publishHomeListingResult(start, 'collection', first, true)).toBe(start);
		expect(publishHomeListingResult(start, 'collection', renamed, true)).toEqual({ collection: [renamed] });
		expect(publishHomeListingResult(start, 'collection', second, true)).toEqual({
			collection: [first, second],
		});
		expect(publishHomeListingResult(start, 'collection', first, false)).toEqual({ collection: [] });
		expect(publishHomeListingResult(start, 'collection', second, false)).toBe(start);
	});

	it('preserves resolved listing metadata when a refreshed floor scan reorders assets', () => {
		const first = { id: 'f'.repeat(43), name: 'Resolved First' };
		const second = { id: 's'.repeat(43), name: 'Resolved Second' };
		const collection: Collection = {
			id: 'images',
			name: 'HTML Colors',
			description: '',
			kind: 'images',
			assets: [
				{ id: first.id, name: 'fffffff…ffffff' },
				{ id: second.id, name: 'sssssss…ssssss' },
			],
		};

		expect(reconcileHomeListingAssets([first, second], [second.id, first.id], collection)).toEqual([second, first]);
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

	it('limits the mixed Discover overview to five tokens per page', () => {
		const tokens = Array.from({ length: 12 }, (_, index) => `token-${index + 1}`);

		expect(homeAssetPage(tokens, 2, HOME_DISCOVER_TOKEN_PAGE_SIZE)).toEqual({
			items: tokens.slice(5, 10),
			page: 2,
			pageCount: 3,
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

	it('settles Discover once the visible pages are full and their summaries are known', () => {
		const ready: HomeMarketSummary = { status: 'resolved', value: '1 AR' };
		const failed: HomeMarketSummary = { status: 'unavailable', source: 'compute', kind: 'rate-limited' };
		const base = {
			marketLoading: false,
			retrying: false,
			crawlLoading: false,
			visiblePagesFull: true,
			visibleCount: 3,
			keys: ['a', 'b'],
			summaries: { a: ready, b: ready },
		};
		expect(homeDiscoverPending(base)).toBe(false);
		// A failed summary is a settled card, not a reason to stay busy.
		expect(homeDiscoverPending({ ...base, summaries: { a: ready, b: failed } })).toBe(false);
		expect(homeDiscoverPending({ ...base, summaries: { a: ready } })).toBe(true);
		expect(homeDiscoverPending({ ...base, retrying: true })).toBe(true);
		// Collections still streaming in do not hold a populated page busy.
		expect(homeDiscoverPending({ ...base, marketLoading: true })).toBe(false);
		expect(homeDiscoverPending({ ...base, marketLoading: true, visibleCount: 0 })).toBe(true);
		// The crawl's look-ahead keeps the page busy only while a visible page is short.
		expect(homeDiscoverPending({ ...base, crawlLoading: true })).toBe(false);
		expect(homeDiscoverPending({ ...base, crawlLoading: true, visiblePagesFull: false })).toBe(true);

		expect(homeDiscoverPagesFull([{ shown: 5, pageSize: 5, page: 1, pageCount: 3 }])).toBe(true);
		expect(homeDiscoverPagesFull([{ shown: 3, pageSize: 5, page: 1, pageCount: 1 }])).toBe(false);
		expect(
			homeDiscoverPagesFull([
				{ shown: 5, pageSize: 5, page: 1, pageCount: 2 },
				{ shown: 11, pageSize: 12, page: 1, pageCount: 1 },
			])
		).toBe(false);
	});

	it('retries failed card summaries in the background only a bounded number of times', () => {
		expect(homeSummaryFailuresPresent('|')).toBe(false);
		expect(homeSummaryFailuresPresent('a|')).toBe(true);
		expect(homeSummaryFailuresPresent('|c')).toBe(true);
		const due = { failureKey: 'a|', rounds: 0, retrying: false, computeCircuitOpen: false };
		expect(homeSummaryAutoRetryDue(due)).toBe(true);
		expect(homeSummaryAutoRetryDue({ ...due, rounds: HOME_SUMMARY_AUTO_RETRY_LIMIT - 1 })).toBe(true);
		expect(homeSummaryAutoRetryDue({ ...due, rounds: HOME_SUMMARY_AUTO_RETRY_LIMIT })).toBe(false);
		expect(homeSummaryAutoRetryDue({ ...due, failureKey: '|' })).toBe(false);
		expect(homeSummaryAutoRetryDue({ ...due, retrying: true })).toBe(false);
		expect(homeSummaryAutoRetryDue({ ...due, computeCircuitOpen: true })).toBe(false);
	});

	it('refreshes token 24h changes within a bounded age and retries failures instead of caching them', () => {
		const read = (value: number | null | 'unavailable', at = 0) => ({ value, readAt: at, checkedAt: at });
		// A good value is read again after the refresh time and never shown past the max age.
		expect(HOME_TOKEN_CHANGE_REFRESH_MS).toBeLessThan(HOME_TOKEN_CHANGE_MAX_AGE_MS);
		expect(homeTokenPriceChangeRequests(['a'], { a: read(4) }, HOME_TOKEN_CHANGE_REFRESH_MS - 1)).toEqual([]);
		expect(homeTokenPriceChangeRequests(['a'], { a: read(4) }, HOME_TOKEN_CHANGE_REFRESH_MS)).toEqual(['a']);
		expect(homeTokenPriceChangeCurrent(read(4), HOME_TOKEN_CHANGE_MAX_AGE_MS)).toBe(4);
		expect(homeTokenPriceChangeCurrent(read(4), HOME_TOKEN_CHANGE_MAX_AGE_MS + 1)).toBe('unavailable');
		expect(homeTokenPriceChangeCurrent(undefined, 0)).toBeUndefined();
		// "Unavailable" is not kept for the session: it is retried while the row stays visible.
		expect(homeTokenPriceChangeRequests(['a'], { a: read('unavailable') }, HOME_TOKEN_CHANGE_RETRY_MS - 1)).toEqual(
			[]
		);
		expect(homeTokenPriceChangeRequests(['a'], { a: read('unavailable') }, HOME_TOKEN_CHANGE_RETRY_MS)).toEqual([
			'a',
		]);
		// A failed refresh keeps a still-current value, retries it soon, and lets it lapse at the max age.
		const refreshedFailure = homeTokenPriceChangeFailed(read(4), HOME_TOKEN_CHANGE_REFRESH_MS);
		expect(refreshedFailure).toEqual({ value: 4, readAt: 0, checkedAt: HOME_TOKEN_CHANGE_REFRESH_MS });
		expect(homeTokenPriceChangeDueAt(refreshedFailure)).toBe(
			HOME_TOKEN_CHANGE_REFRESH_MS + HOME_TOKEN_CHANGE_RETRY_MS
		);
		expect(homeTokenPriceChangeFailed(read(4), HOME_TOKEN_CHANGE_MAX_AGE_MS + 1).value).toBe('unavailable');
		expect(homeTokenPriceChangeFailed(undefined, 5).value).toBe('unavailable');
		// The next check is the earliest refresh, retry or expiry among visible rows; unread rows are asked now.
		expect(homeTokenPriceChangeNextCheck(['a', 'b', 'c'], { a: read(4), b: read('unavailable', 10) }, 100)).toBe(
			10 + HOME_TOKEN_CHANGE_RETRY_MS
		);
		expect(homeTokenPriceChangeNextCheck(['a'], { a: read(4) }, HOME_TOKEN_CHANGE_REFRESH_MS + 5)).toBe(
			HOME_TOKEN_CHANGE_MAX_AGE_MS + 1
		);
		expect(homeTokenPriceChangeNextCheck(['c'], {}, 0)).toBeNull();
	});

	it('reads each token row 24h change once while current and ends its spinner at the display deadline', () => {
		expect(HOME_TOKEN_CHANGE_DISPLAY_DEADLINE_MS).toBe(8_000);
		const read = (value: number | null | 'unavailable', at = 0) => ({ value, readAt: at, checkedAt: at });
		// Rows that reorder or page back in keep the value already read while it is current.
		expect(
			homeTokenPriceChangeRequests(['a', 'b', 'c', 'b'], { a: read(1.5), c: read('unavailable') }, 1_000)
		).toEqual(['b']);
		expect(homeTokenPriceChangeRequests(['a'], { a: read(null) }, 1_000)).toEqual([]);
		expect(homeTokenPriceChangePending(undefined, false)).toBe(true);
		expect(homeTokenPriceChangePending(undefined, true)).toBe(false);
		expect(homeTokenPriceChangeLabel(null)).toBe('—');
		expect(homeTokenPriceChangePending(2, true)).toBe(false);
		// Per-row deadlines from the shared helper: a row revealed later gets its own start.
		const deadlines = createCollectionPriceDeadlines();
		expect(
			observeCollectionPriceDeadlines(deadlines, 'scope', ['a'], 0, HOME_TOKEN_CHANGE_DISPLAY_DEADLINE_MS)
		).toEqual({ overdue: [], nextDeadline: 8_000 });
		expect(
			observeCollectionPriceDeadlines(
				deadlines,
				'scope',
				['a', 'b'],
				8_000,
				HOME_TOKEN_CHANGE_DISPLAY_DEADLINE_MS
			)
		).toEqual({ overdue: ['a'], nextDeadline: 16_000 });
	});

	it('settles the Collections tab when floors arrive, fail or pass their display deadline', () => {
		const ready: HomeMarketSummary = { status: 'resolved', value: null };
		const failed: HomeMarketSummary = { status: 'unavailable', source: 'index', kind: 'rate-limited' };
		const base = {
			shellLoading: false,
			retrying: false,
			collectionIds: ['a', 'b', 'c'],
			floors: { a: ready, b: failed } as Record<string, HomeMarketSummary>,
			overdue: new Set<string>(),
		};
		expect(homeCollectionFloorsPending(base)).toBe(true);
		expect(homeCollectionFloorsPending({ ...base, overdue: new Set(['c']) })).toBe(false);
		expect(homeCollectionFloorsPending({ ...base, floors: { ...base.floors, c: ready } })).toBe(false);
		expect(homeCollectionFloorsPending({ ...base, overdue: new Set(['c']), retrying: true })).toBe(true);
		expect(homeCollectionFloorsPending({ ...base, collectionIds: [], floors: {}, shellLoading: true })).toBe(true);
		// The overdue floor and the failed floor are offered for retry together.
		expect(
			collectionPriceRetryNotice({
				activityError: false,
				activityLoading: false,
				cardPricesFailed: false,
				cardPricesLoading: false,
				listedOnly: false,
				overdue: 1,
				unavailable: 1,
			})
		).toEqual({ visible: true, unavailable: 2 });
	});

	it('shows the home loader only while results are pending and no assets are visible', () => {
		expect(homeMarketShowsInitialLoader(true, 0)).toBe(true);
		expect(homeMarketShowsInitialLoader(true, 1)).toBe(false);
		expect(homeMarketShowsInitialLoader(false, 0)).toBe(false);
	});

	it('holds the Discover order until the shell, the listing crawl and ranked prices are settled', () => {
		const summaries: Record<string, HomeMarketSummary> = {
			listed: { status: 'resolved', value: '1 AR' },
			failed: { status: 'unavailable', source: 'compute', kind: 'unavailable' },
		};
		expect(homeDiscoverOrderSettled('listed', true, ['listed'], summaries)).toBe(false);
		expect(homeDiscoverOrderSettled('listed', false, ['listed', 'pending'], summaries)).toBe(false);
		expect(homeDiscoverOrderSettled('price-low', false, ['listed', 'failed'], summaries)).toBe(true);
		// The unranked "all" view does not wait on prices.
		expect(homeDiscoverOrderSettled('all', false, ['pending'], summaries)).toBe(true);
		expect(homeDiscoverOrderSettled('all', true, [], summaries)).toBe(false);
	});

	it('keys Discover rows by collection and asset', () => {
		expect(homeDiscoverOrderId({ asset: { id: 'asset' }, collection: { id: 'collection' } })).toBe(
			'collection:asset'
		);
	});

	it('reserves the token overview page height only while rows may still arrive', () => {
		expect(homeTokenPlaceholderRows(false, 0)).toBe(5);
		expect(homeTokenPlaceholderRows(false, 3)).toBe(2);
		expect(homeTokenPlaceholderRows(false, 5)).toBe(0);
		expect(homeTokenPlaceholderRows(true, 2)).toBe(0);
	});

	it('turns a stuck card price into an explicit unavailable label after the display deadline', () => {
		expect(COLLECTION_PRICE_DISPLAY_DEADLINE_MS).toBe(15_000);
		expect(collectionCardPriceLabel(undefined, false, false)).toBe('Checking…');
		expect(collectionCardPriceLabel(undefined, false, true)).toBe('Price unavailable');
		expect(collectionCardPriceLabel(undefined, true, false)).toBe('Price unavailable');
		expect(collectionCardPriceLabel(undefined, false, true, 'Unavailable')).toBe('Unavailable');
		// Settled prices are never overridden by the deadline.
		expect(collectionCardPriceLabel({ status: 'resolved', label: '0.1 AR' }, false, true)).toBe('0.1 AR');
		expect(collectionCardPriceLabel({ status: 'resolved', label: null }, false, true)).toBe('Not listed');
		expect(collectionCardPriceLabel({ status: 'unindexed' }, false, true)).toBe('Unlisted');
		expect(collectionCardPriceLabel({ status: 'unavailable', kind: 'unavailable' }, false, false)).toBe(
			'Price unavailable'
		);
	});

	it('keeps each card price deadline from its own start instead of re-arming on reveal', () => {
		const deadlines = createCollectionPriceDeadlines();
		const deadline = COLLECTION_PRICE_DISPLAY_DEADLINE_MS;

		expect(observeCollectionPriceDeadlines(deadlines, 'scope', ['a', 'b'], 0)).toEqual({
			overdue: [],
			nextDeadline: deadline,
		});
		expect(observeCollectionPriceDeadlines(deadlines, 'scope', ['a', 'b'], deadline).overdue).toEqual(['a', 'b']);
		// Progressive reveal adds card c; a and b stay overdue and c gets its own deadline.
		expect(observeCollectionPriceDeadlines(deadlines, 'scope', ['a', 'b', 'c'], deadline + 1_000)).toEqual({
			overdue: ['a', 'b'],
			nextDeadline: 2 * deadline + 1_000,
		});
		// A Retry restarts only the cards it rechecks.
		restartCollectionPriceDeadlines(deadlines, ['a']);
		expect(observeCollectionPriceDeadlines(deadlines, 'scope', ['a', 'b', 'c'], deadline + 2_000)).toEqual({
			overdue: ['b'],
			nextDeadline: 2 * deadline + 1_000,
		});
		// A new listing scope starts every card over.
		expect(observeCollectionPriceDeadlines(deadlines, 'other', ['b'], deadline + 3_000)).toEqual({
			overdue: [],
			nextDeadline: 2 * deadline + 3_000,
		});
		restartCollectionPriceDeadlines(deadlines);
		expect(deadlines.startedAt.size).toBe(0);
	});

	it('holds the card-price retry notice during the activity scan and keeps overdue cards overdue after it', () => {
		const deadlines = createCollectionPriceDeadlines();
		const deadline = COLLECTION_PRICE_DISPLAY_DEADLINE_MS;
		const notice = (activityLoading: boolean, overdue: number, cardPricesLoading = false) =>
			collectionPriceRetryNotice({
				activityError: false,
				activityLoading,
				cardPricesFailed: false,
				cardPricesLoading,
				listedOnly: false,
				overdue,
				unavailable: 0,
			});

		observeCollectionPriceDeadlines(deadlines, 'scope', ['a', 'b', 'c'], 0);
		// The scan is still running past the deadline: the labels admit it, but no card-price
		// Retry is offered because the scan, not the card-price reads, owns these prices.
		const during = observeCollectionPriceDeadlines(deadlines, 'scope', ['a', 'b', 'c'], deadline + 500);
		expect(during.overdue).toEqual(['a', 'b', 'c']);
		expect(notice(true, during.overdue.length)).toEqual({ visible: false, unavailable: 0 });
		// The scan finishes and card-price reads start for the remainder: the same cards stay
		// overdue (no flip back to "Checking…") and the notice now offers a working Retry.
		const after = observeCollectionPriceDeadlines(deadlines, 'scope', ['b', 'c'], deadline + 600);
		expect(after).toEqual({ overdue: ['b', 'c'], nextDeadline: null });
		expect(notice(false, after.overdue.length, true)).toEqual({ visible: true, unavailable: 2 });
	});

	it('shows the card-price retry notice only for card-price failures outside listed-only views', () => {
		const base = {
			activityError: false,
			activityLoading: false,
			cardPricesFailed: false,
			cardPricesLoading: false,
			listedOnly: false,
			overdue: 0,
			unavailable: 0,
		};

		expect(collectionPriceRetryNotice(base)).toEqual({ visible: false, unavailable: 0 });
		expect(collectionPriceRetryNotice({ ...base, unavailable: 2 })).toEqual({ visible: true, unavailable: 2 });
		expect(collectionPriceRetryNotice({ ...base, unavailable: 2, cardPricesLoading: true })).toEqual({
			visible: false,
			unavailable: 0,
		});
		expect(collectionPriceRetryNotice({ ...base, cardPricesFailed: true, overdue: 2 })).toEqual({
			visible: true,
			unavailable: 0,
		});
		// The activity-scan error notice already carries its own Retry.
		expect(collectionPriceRetryNotice({ ...base, activityError: true, overdue: 2 })).toEqual({
			visible: false,
			unavailable: 0,
		});
		expect(collectionPriceRetryNotice({ ...base, listedOnly: true, unavailable: 2 }).visible).toBe(false);
	});

	it('holds a shown floor retry notice through the retry instead of blinking it off and on', () => {
		const shown = { visible: true, unavailable: 2 };
		// A retry starts: collectionPriceRetryNotice hides while prices load, the held notice stays.
		expect(heldPriceRetryNotice(shown, { visible: false, unavailable: 0 }, true)).toBe(shown);
		// The retry settled: whatever it found now shows (fewer floors, or none).
		expect(heldPriceRetryNotice(shown, { visible: true, unavailable: 1 }, false)).toEqual({
			visible: true,
			unavailable: 1,
		});
		expect(heldPriceRetryNotice(shown, { visible: false, unavailable: 0 }, false).visible).toBe(false);
		// Nothing was shown before the retry: nothing is held.
		expect(heldPriceRetryNotice(undefined, { visible: false, unavailable: 0 }, true).visible).toBe(false);
	});

	it('renders exactly one Discover state so a failure replaces the loader but keeps visible cards', () => {
		expect(homeDiscoverDisplay(true, false, 0)).toBe('loading');
		// A tripped compute circuit or failed discovery is terminal even while summaries remain pending.
		expect(homeDiscoverDisplay(true, true, 0)).toBe('failed');
		expect(homeDiscoverDisplay(false, true, 0)).toBe('failed');
		// Already rendered cards stay on screen; the failure becomes a banner above them.
		expect(homeDiscoverDisplay(true, true, 3)).toBe('results');
		expect(homeDiscoverDisplay(false, false, 3)).toBe('results');
		expect(homeDiscoverDisplay(false, false, 0)).toBe('empty');
	});

	it('reports an index failure beside rendered cards as a compact notice, not the full error block', () => {
		// Round 2: a GraphQL timeout showed "Unable to load" next to cards that had already rendered.
		expect(homeDiscoverFailureNotice(homeDiscoverDisplay(false, true, 6))).toBe('inline');
		expect(homeDiscoverFailureNotice(homeDiscoverDisplay(false, true, 0))).toBe('panel');
		expect(homeDiscoverFailureNotice(homeDiscoverDisplay(true, false, 0))).toBe('none');
		expect(homeDiscoverPartialFailureMessage('Arweave’s transaction index could not be read. Retry shortly.')).toBe(
			'More listings could not be loaded. Arweave’s transaction index could not be read. Retry shortly.'
		);
	});

	it('turns a loader that outlives its deadline with nothing to show into one failure with Retry', () => {
		expect(HOME_DISCOVER_LOADING_DEADLINE_MS).toBe(15_000);
		expect(homeDiscoverDisplay(true, false, 0, true)).toBe('failed');
		expect(homeDiscoverBusy(homeDiscoverDisplay(true, false, 0, true), true)).toBe(false);
		// Cards that arrive late replace the failure; a settled empty view stays empty.
		expect(homeDiscoverDisplay(true, false, 2, true)).toBe('results');
		expect(homeDiscoverDisplay(false, false, 0, true)).toBe('empty');

		expect(homeDiscoverOverdueFailure(true, [])).toEqual({ source: 'compute', kind: 'unavailable' });
		expect(homeDiscoverOverdueFailure(true, ['unavailable', 'rate-limited'])).toEqual({
			source: 'compute',
			kind: 'rate-limited',
		});
		// Without a market shell the collection index is what has not answered.
		expect(homeDiscoverOverdueFailure(false, [])).toEqual({ source: 'index', kind: 'unavailable' });
	});

	it('stops the header refresh spinner and aria-busy once Discover shows a terminal failure', () => {
		// Hidden failed or summary-less assets keep results pending after a compute-circuit failure.
		expect(homeDiscoverBusy('failed', true)).toBe(false);
		expect(homeDiscoverBusy('loading', true)).toBe(true);
		expect(homeDiscoverBusy('results', true)).toBe(true);
		expect(homeDiscoverBusy('results', false)).toBe(false);
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
		const hiddenId = 'bASFYsRBQm_dfG__wqRVwMh8bqwEvSTl4lURRBqfu2M';
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
				namespace: {
					manifestId: 'm'.repeat(43),
					namesById: { [nameId]: 'name', [hiddenId]: 'hidden' },
				},
			},
		];

		expect(globalActivityCollection(collections, tokenId)?.id).toBe('tokens');
		expect(globalActivityCollection(collections, nameId)?.id).toBe('names');
		expect(globalActivityCollection(collections, hiddenId)).toBeUndefined();
		expect(globalActivityCollection(collections, 'x'.repeat(43))).toBeUndefined();
	});

	it('keeps raw activity rows so collections that load later reveal theirs without a re-read', () => {
		const tokenId = 't'.repeat(43);
		const imageId = 'i'.repeat(43);
		const foreignId = 'f'.repeat(43);
		const event = (id: string, processId: string) => ({ id, processId } as CollectionActivityEvent);
		const events = [event('1', imageId), event('2', foreignId), event('3', tokenId)];
		const tokens: Collection = {
			id: 'tokens',
			name: 'Tokens',
			description: '',
			kind: 'tokens',
			assets: [{ id: tokenId, name: 'Token' }],
		};
		const images: Collection = {
			id: 'images',
			name: 'Images',
			description: '',
			kind: 'images',
			assets: [{ id: imageId, name: 'Image' }],
		};

		expect(globalCatalogueActivity(events, []).map((item) => item.id)).toEqual([]);
		expect(globalCatalogueActivity(events, [tokens]).map((item) => item.id)).toEqual(['3']);
		// The same loaded rows, filtered again once a streamed collection claims one; gateway order holds.
		expect(globalCatalogueActivity(events, [tokens, images]).map((item) => item.id)).toEqual(['1', '3']);
	});

	it('appends rows a late collection claims instead of inserting them above painted rows', () => {
		// Painted after the reveal: rows 3 and 5 (newest first).
		const painted = nextStableOrder(undefined, ['3', '5'], 'all|0', false);
		// A collection streaming in after the cap claims rows 1 (newest) and 4.
		const ranked = ['1', '3', '4', '5'];
		const held = nextStableOrder(painted, ranked, 'all|0', false);

		expect(held.ids).toEqual(['3', '5', '1', '4']);
		// The newest-first order is offered rather than applied, and applying it re-ranks.
		expect(stableOrderDiffers(held.ids, ranked, 20)).toBe(true);
		expect(nextStableOrder(held, ranked, 'all|1', false).ids).toEqual(ranked);
	});

	it('says Activity is loading without inserting a line above painted rows', () => {
		expect(activityLoadingPlacement(false, 0, true)).toBeNull();
		expect(activityLoadingPlacement(true, 0, true)).toBe('placeholder');
		// Rows painted: the load-more button says "Loading activity…".
		expect(activityLoadingPlacement(true, 20, true)).toBeNull();
		expect(activityLoadingPlacement(true, 4, false)).toBe('after-list');
	});

	it('paints activity rows after a short catalogue quiet time, capped from market settle', () => {
		expect(activityCatalogueRevealDelay(1_000, 1_000)).toBe(ACTIVITY_CATALOGUE_QUIET_MS);
		// A collection streamed in 2.2 s after settle: only the time left to the cap remains.
		expect(activityCatalogueRevealDelay(1_000, 3_200)).toBe(ACTIVITY_CATALOGUE_WAIT_CAP_MS - 2_200);
		expect(activityCatalogueRevealDelay(1_000, 1_000 + ACTIVITY_CATALOGUE_WAIT_CAP_MS + 1)).toBe(0);
	});

	it('keys activity catalogue membership on collections and member counts, not names', () => {
		const images: Collection = {
			id: 'images',
			name: 'Images',
			description: '',
			kind: 'images',
			assets: [{ id: 'i'.repeat(43), name: 'iiiiii…iiiii' }],
		};
		const names: Collection = {
			id: 'names',
			name: 'Names',
			description: '',
			kind: 'names',
			assets: [],
			namespace: { manifestId: 'm'.repeat(43), namesById: { ['n'.repeat(43)]: 'name' } },
		};
		const key = activityCatalogueMembershipKey([images, names]);
		expect(key).toBe('images:1,names:1');
		expect(
			activityCatalogueMembershipKey([{ ...images, assets: [{ ...images.assets[0], name: 'Named' }] }, names])
		).toBe(key);
		expect(activityCatalogueMembershipKey([images])).not.toBe(key);
	});

	it('filters global activity by submitted market action', () => {
		const events = [
			{ id: 'listing', action: 'make-offer' },
			{ id: 'registration', action: 'register-interest' },
			{ id: 'transfer', action: 'transfer' },
			{ id: 'cancel', action: 'cancel-order' },
		] as CollectionActivityEvent[];

		expect(filterGlobalActivity(events, 'all')).toEqual(events);
		expect(filterGlobalActivity(events, 'make-offer').map((event) => event.id)).toEqual(['listing']);
		expect(filterGlobalActivity(events, 'transfer').map((event) => event.id)).toEqual(['transfer']);
		expect(filterGlobalActivity(events, 'cancel-order').map((event) => event.id)).toEqual(['cancel']);
	});

	it('keeps reveal counts explicitly scoped to loaded events', () => {
		expect(globalActivityRevealDescription(40, 100, 100, false)).toBe('Showing 40 of 100 loaded events.');
		expect(globalActivityRevealDescription(100, 100, 100, false)).toBe('Showing 100 of 100 loaded events.');
		expect(globalActivityRevealDescription(90, 90, 100, true)).toBe('Showing 90 of 90 loaded matching events.');
	});

	it('checks exact collection membership without rescanning loaded assets', () => {
		const loadedImage = 'i'.repeat(43);
		const loadedToken = 't'.repeat(43);
		const canonicalName = 'n'.repeat(43);
		const hiddenName = 'bASFYsRBQm_dfG__wqRVwMh8bqwEvSTl4lURRBqfu2M';
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
				namesById: { [canonicalName]: 'canonical', [hiddenName]: 'hidden' },
			},
		});

		expect([imageIncludes(loadedImage), imageIncludes(foreign)]).toEqual([true, false]);
		expect([tokenIncludes(loadedToken), tokenIncludes(foreign)]).toEqual([true, false]);
		expect([nameIncludes(canonicalName), nameIncludes(staleLoadedName)]).toEqual([true, false]);
		expect(nameIncludes(hiddenName)).toBe(false);
	});

	it('deduplicates visible marketplace recipients for complete history scans', () => {
		const shared = 'q'.repeat(43);
		const image = 'i'.repeat(43);
		const name = 'n'.repeat(43);
		const indexed: Collection[] = [
			{
				id: 'images',
				name: 'Images',
				description: '',
				kind: 'images',
				assets: [
					{ id: image, name: 'Image' },
					{ id: shared, name: 'Shared' },
				],
			},
			{ id: 'tokens', name: 'Tokens', description: '', kind: 'tokens', assets: [{ id: shared, name: 'Shared' }] },
			{
				id: 'names',
				name: 'Names',
				description: '',
				kind: 'names',
				assets: [],
				namespace: { manifestId: 'm'.repeat(43), namesById: { [name]: 'name' } },
			},
		];

		expect(globalActivityRecipientIds(indexed)).toEqual([image, shared, name]);
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

	it('keeps listing scope stable when GraphQL titles update collection metadata only', () => {
		// The card-price effect keys on listingScope and visible IDs, not on the collection object,
		// so publishing titles page by page must not change the scope and abort in-flight price reads.
		const collection: Collection = {
			id: 'images',
			name: 'Images',
			description: '',
			kind: 'images',
			assets: [asset, { id: 'B'.repeat(43), name: 'B'.repeat(43) }],
			manifestId: 'M'.repeat(43),
		};
		const titled: Collection = {
			...collection,
			name: 'Renamed images',
			assets: collection.assets.map((item, index) => ({ ...item, name: `Title ${index}` })),
		};

		expect(collectionListingScopeVersion(titled)).toBe(collectionListingScopeVersion(collection));
		expect(collectionActivityVersion(titled)).toBe(collectionActivityVersion(collection));
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

	it('keeps the mined row and its sort position when a later batch repeats it undated', () => {
		const mined = {
			id: 'offer',
			processId: 'asset',
			action: 'make-offer' as const,
			actor: 'seller',
			height: 1500,
			timestamp: 1_700_000_000,
		};
		const older = { ...mined, id: 'older', height: 1400, timestamp: 1_699_000_000 };
		const undated = { ...mined, actor: '', height: 0, timestamp: 0 };
		expect(newestCollectionActivity([mined, older, undated])).toEqual([mined, older]);
		const retained = new Map([[mined.id, mined]]);
		retainNewestCollectionActivity(retained, [undated]);
		expect(retained.get(mined.id)).toEqual(mined);
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

	it('admits a fresh listing when its cached state had no orders, then removes it when closed', () => {
		const stale = { asset: { id: 'a' }, state: { orders: {} } } as any;
		const initial = mergeResolvedListingBatch([], [{ processId: 'a', result: stale }]);
		expect(initial).toEqual([]);
		const fresh = liveListing('a');
		const refreshed = mergeResolvedListingBatch(initial, [{ processId: 'a', result: fresh }]);
		expect(refreshed).toEqual([fresh]);
		expect(mergeResolvedListingBatch(refreshed, [{ processId: 'a', result: stale }])).toEqual([]);
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

describe('collection snapshots published from the index walk', () => {
	const id = 'VFeEyvnoB-u249MgGQHN5Jcwvs7CAwycw826ztrXpT0';
	const placeholder = { id, name: 'VFeEyvn…trXpT0' };
	const dumdumz = (name: string, manifestId = 'M'.repeat(43)): Collection => ({
		id: 'cNdMdSIuIlF3YM2j81y1k_HiaA60r4wp552w2JiWx4I',
		name: 'Dumdumz',
		description: '',
		kind: 'images',
		manifestId,
		assets: [{ ...placeholder, name }],
	});

	it('keeps names that arrived after the snapshot was taken', () => {
		const retained = retainedCollectionAssetNames([dumdumz('88')], dumdumz(placeholder.name));
		expect(retained.assets[0].name).toBe('88');
	});

	it('adopts newer names and a changed manifest as published', () => {
		expect(retainedCollectionAssetNames([dumdumz(placeholder.name)], dumdumz('88')).assets[0].name).toBe('88');
		const moved = dumdumz(placeholder.name, 'N'.repeat(43));
		expect(retainedCollectionAssetNames([dumdumz('88')], moved)).toBe(moved);
		const fresh = dumdumz(placeholder.name);
		expect(retainedCollectionAssetNames([], fresh)).toBe(fresh);
	});
});

describe('activity rows that need indexed names', () => {
	it('returns only image-collection assets behind the visible rows', () => {
		const imageId = 'I'.repeat(43);
		const nameId = 'N'.repeat(43);
		const images: Collection = {
			id: 'C'.repeat(43),
			name: 'Dumdumz',
			description: '',
			kind: 'images',
			assets: [{ id: imageId, name: 'IIIIIII…IIIIII' }],
		};
		const names: Collection = {
			id: 'arweave-names',
			name: 'Arweave Names',
			description: '',
			kind: 'names',
			assets: [{ id: nameId, name: 'example' }],
			namespace: { manifestId: 'M'.repeat(43), namesById: { [nameId]: 'example' } },
		};
		const event = (processId: string) => ({ processId } as CollectionActivityEvent);
		const byId = new Map([
			[imageId, images],
			[nameId, names],
		]);

		expect(
			visibleActivityAssets([event(imageId), event(nameId), event('U'.repeat(43))], (item) =>
				byId.get(item.processId)
			)
		).toEqual([images.assets[0]]);
	});
});

describe('Route focus policy', () => {
	it('keeps focus on first load and moves it to main on a new view', () => {
		expect(routeFocusAction(null, '/discover')).toBe('initial');
		expect(routeFocusAction('/discover', '/discover')).toBe('initial');
		expect(routeFocusAction('/discover', '/asset/a/b', { navigationType: 'PUSH' })).toBe('new-view');
		expect(routeFocusAction('/discover', '/discover?q=art', { navigationType: 'PUSH' })).toBe('new-view');
	});
	it('treats a preserveFocus push or replace as an in-view update', () => {
		expect(routeFocusAction('/discover', '/collections', { preserveFocus: true, navigationType: 'PUSH' })).toBe(
			'in-view'
		);
		expect(routeFocusAction('/collections', '/activity', { preserveFocus: true, navigationType: 'REPLACE' })).toBe(
			'in-view'
		);
		expect(routeFocusAction(null, '/collections', { preserveFocus: true, navigationType: 'PUSH' })).toBe('initial');
	});
	it('still moves focus when Back lands on an entry that stored preserveFocus', () => {
		expect(routeFocusAction('/asset/a/b', '/collections', { preserveFocus: true, navigationType: 'POP' })).toBe(
			'new-view'
		);
	});
	it('reads preserveFocus only from a strict true flag in location.state', () => {
		expect(routeFocusPreserved(PRESERVE_ROUTE_FOCUS.state)).toBe(true);
		expect(routeFocusPreserved(null)).toBe(false);
		expect(routeFocusPreserved({ fungibleOperationActivityId: 'x' })).toBe(false);
		expect(routeFocusPreserved({ preserveFocus: 'yes' })).toBe(false);
	});
});

describe('Home market tabs', () => {
	afterEach(() => vi.unstubAllGlobals());
	it('renders one tab stop with the selected tab and the panel wiring', () => {
		const html = renderToStaticMarkup(
			React.createElement(HomeMarketTabs, { active: 'collections', onSelect() {} })
		);
		expect(html.match(/tabindex="0"/g)).toHaveLength(1);
		expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
		expect(html).toMatch(/aria-selected="true"[^>]*id="home-collections-tab"[^>]*tabindex="0"/);
		expect(html).toContain('aria-controls="home-activity-panel"');
		expect(html).toContain('role="tablist"');
	});
	it('moves selection and focus with Arrow, Home and End keys', () => {
		const focused: string[] = [];
		vi.stubGlobal('window', { requestAnimationFrame: (callback: () => void) => callback() });
		vi.stubGlobal('document', { getElementById: (id: string) => ({ focus: () => focused.push(id) }) });
		const selected: string[] = [];
		const tablist = HomeMarketTabs({ active: 'discover', onSelect: (tab) => selected.push(tab) });
		const tabs = React.Children.toArray(
			(tablist.props as { children: React.ReactNode }).children
		) as React.ReactElement<{ onKeyDown(event: unknown): void }>[];
		const press = (index: number, key: string) => {
			let prevented = false;
			tabs[index].props.onKeyDown({ key, preventDefault: () => (prevented = true) });
			return prevented;
		};
		expect(press(0, 'ArrowRight')).toBe(true);
		expect(press(0, 'ArrowLeft')).toBe(true);
		expect(press(1, 'End')).toBe(true);
		expect(press(2, 'Home')).toBe(true);
		expect(press(2, 'ArrowDown')).toBe(true);
		expect(press(0, 'Enter')).toBe(false);
		expect(selected).toEqual(['collections', 'activity', 'activity', 'discover', 'discover']);
		expect(focused).toEqual([
			'home-collections-tab',
			'home-activity-tab',
			'home-activity-tab',
			'home-discover-tab',
			'home-discover-tab',
		]);
	});
});

describe('Collection listing view in the URL', () => {
	it('reads ?view as items, offers or the collection default', () => {
		expect(collectionViewFromSearch('?view=items')).toBe('items');
		expect(collectionViewFromSearch('?q=a&view=offers')).toBe('offers');
		expect(collectionViewFromSearch('?view=grid')).toBeNull();
		expect(collectionViewFromSearch('')).toBeNull();
		expect(collectionListedFromSearch('?view=items', 'arweave-names')).toBe(false);
		expect(collectionListedFromSearch('', 'arweave-names')).toBe(true);
		expect(collectionListedFromSearch('?view=offers', 'x')).toBe(true);
		expect(collectionListedFromSearch('', 'x')).toBe(false);
		expect(collectionListedFromSearch('?view=unknown', 'arweave-names')).toBe(true);
	});
	it('writes the view and keeps the other params', () => {
		expect(collectionViewSearch('', 'items')).toBe('?view=items');
		expect(collectionViewSearch('?q=moon+cat&view=offers', 'items')).toBe('?q=moon+cat&view=items');
		const next = collectionViewSearch('?q=moon%20cat&gateway=g', 'offers');
		expect(new URLSearchParams(next).get('q')).toBe('moon cat');
		expect(new URLSearchParams(next).get('gateway')).toBe('g');
		expect(collectionListedFromSearch(next, 'x')).toBe(true);
	});
	it('maps the tab buttons and the Show select to the same view', () => {
		// Items tab and Show "All assets" both write items; Offers tab and "Listed for sale" both write offers.
		for (const collectionId of ['arweave-names', 'x']) {
			expect(collectionListedFromSearch(collectionViewSearch('', 'items'), collectionId)).toBe(false);
			expect(collectionListedFromSearch(collectionViewSearch('', 'offers'), collectionId)).toBe(true);
		}
	});
	it('links the Activity page Items tab to an explicit items view', () => {
		const collection: Collection = {
			id: 'arweave-names',
			name: 'Arweave Names',
			description: '',
			kind: 'names',
			assets: [],
		};
		const html = renderToStaticMarkup(
			React.createElement(
				MemoryRouter,
				null,
				React.createElement(CollectionTabs, { collection, active: 'activity' })
			)
		);
		expect(html).toContain('href="/collection/arweave-names?view=items"');
		expect(html).toContain('href="/collection/arweave-names?view=offers"');
		expect(html).toContain('href="/collection/arweave-names/activity"');
	});
});
