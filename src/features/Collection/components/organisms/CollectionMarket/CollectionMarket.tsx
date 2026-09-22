import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
	ArrowLeft,
	ArrowRight,
	Grid2X2,
	Images,
	LayoutGrid,
	List,
	LoaderCircle,
	Search,
	Upload,
	X,
} from 'lucide-react';

import {
	assetMatchesCollectionQuery,
	collectionSearchAssets,
	enrichImageCollectionAssetMetadata,
} from 'api/collections';
import {
	type AssetCandidate,
	createAssetCandidateResolver,
	discoverMarketActivity,
	discoverMarketActivityBatched,
	resolveAssetCandidates,
	type ResolvedAsset,
} from 'api/discovery';
import {
	bestAskOfAsset,
	DISPLAY_STATE_CACHE,
	formatTokenAmount,
	liveOrdersOfAsset,
	prefetchAssetPage,
	readAssetStateCached,
	servingNodeOrigin,
} from 'api/marketplace';
import { type CollectionMintEstimate, loadMintedCollections, loadMintRuntime, type MintedCollection } from 'api/mint';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { FileInput } from 'components/atoms/FileInput';
import { Icon } from 'components/atoms/Icon';
import { IconButton } from 'components/atoms/IconButton';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { Loading } from 'components/atoms/Loading';
import { Select } from 'components/atoms/Select';
import { TextInput } from 'components/atoms/TextInput';
import { VisuallyHidden } from 'components/atoms/VisuallyHidden';
import { DialogHeading } from 'components/molecules/DialogHeading';
import { EmptyState } from 'components/molecules/EmptyState';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import { RetryNotice } from 'components/molecules/RetryNotice';
import { RouteState } from 'components/molecules/RouteState';
import { TokenMarketRow } from 'components/molecules/TokenMarketRow';
import { Dialog } from 'components/organisms/Dialog';
import {
	collectionActivityWindowDelta,
	collectionCandidateMembership,
	collectionListingScopeVersion,
} from 'features/Activity';
import { AssetCard, orderPriceLabel } from 'features/Catalogue';
import { createAnimationFrameBatch } from 'helpers/animation-frame-batch';
import {
	appErrorMessage,
	type RequestFailureKind,
	requestFailureKind,
	requestFailureMessage,
	type RequestFailureSource,
	toAppError,
} from 'helpers/app-error';
import { winstonToAr } from 'helpers/ar-units';
import { short } from 'helpers/format';
import { optionalMotionBehavior } from 'helpers/motion';
import { assetGroupRevealComplete, retainedAssetGroupLimit } from 'helpers/progressive-assets';
import { useProgressiveAssetPageSize } from 'hooks/useProgressiveAssetPageSize';
import { useProgressiveReveal } from 'hooks/useProgressiveReveal';
import { useMarketProvider } from 'providers/MarketProvider';
import { useOperationActivity } from 'providers/OperationActivityProvider';
import { useWallet } from 'providers/WalletProvider';

import {
	alphabetBrowseIndex,
	alphabetFilterIndex,
	collectionAppendPhaseLabel,
	CollectionCardPrice,
	collectionDefaultsToListed,
	CollectionListingPublication,
	collectionPriceValue,
	collectionRecipientsWithoutListingCandidates,
	CollectionSort,
	CollectionViewMode,
	compareCollectionAssetNames,
	cumulativeCollectionDepth,
	FailedListingCandidate,
	ListingAnnouncementProgress,
	ListingResolutionOutcome,
	mergeResolvedListingBatch,
	nextListingAnnouncementProgress,
	pendingCollectionPriceAssets,
} from '../../../model/collection-market';
import { CollectionIndexNotice } from '../../molecules/CollectionIndexNotice';
import { CollectionMarketSummary } from '../../molecules/CollectionMarketSummary';
import { CollectionTabs } from '../../molecules/CollectionTabs';
import { CollectionAnalyticsPanel } from '../CollectionAnalyticsPanel';

export default function CollectionMarket() {
	const { collectionId = '' } = useParams();
	const { search } = useLocation();
	const market = useMarketProvider();
	const wallet = useWallet();
	const { beginUpload, failUpload, finishUpload, recordUploadTransaction, updateUpload } = useOperationActivity();
	const collection = market.collections.find((item) => item.id === collectionId);
	const metadataEnrichmentScope =
		collection?.kind === 'images' && collection.manifestId ? `${collection.id}:${collection.manifestId}` : '';
	const metadataEnrichmentTarget = React.useRef(collection);
	metadataEnrichmentTarget.current = collection;
	const metadataEnrichmentScopes = React.useRef(new Set<string>());
	React.useEffect(() => {
		const target = metadataEnrichmentTarget.current;
		if (!metadataEnrichmentScope || target?.kind !== 'images') return;
		if (metadataEnrichmentScopes.current.has(metadataEnrichmentScope)) return;
		metadataEnrichmentScopes.current.add(metadataEnrichmentScope);
		const controller = new AbortController();
		void enrichImageCollectionAssetMetadata(target, controller.signal).then(
			(enriched) => {
				if (!controller.signal.aborted && enriched !== target) market.addCollection(enriched);
			},
			() => undefined
		);
		return () => {
			controller.abort();
			metadataEnrichmentScopes.current.delete(metadataEnrichmentScope);
		};
	}, [metadataEnrichmentScope, market.addCollection]);
	const ownedCollection = React.useMemo(
		() => loadMintedCollections().find((item) => item.id === collectionId),
		[collectionId, collection?.assets]
	);
	const appendTrigger = React.useRef<HTMLButtonElement>(null);
	const [appendOpen, setAppendOpen] = React.useState(false);
	const [appendFiles, setAppendFiles] = React.useState<File[]>([]);
	const [appendEstimate, setAppendEstimate] = React.useState<CollectionMintEstimate | null>(null);
	const [appendEstimating, setAppendEstimating] = React.useState(false);
	const [appendWorking, setAppendWorking] = React.useState(false);
	const [appendStatus, setAppendStatus] = React.useState('');
	const [appendError, setAppendError] = React.useState<string | null>(null);
	const appendPreviews = React.useMemo(
		() => appendFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
		[appendFiles]
	);
	React.useEffect(() => () => appendPreviews.forEach(({ url }) => URL.revokeObjectURL(url)), [appendPreviews]);
	const routedQuery = new URLSearchParams(search).get('q') ?? '';
	const routedOffers = new URLSearchParams(search).get('view') === 'offers';
	const [query, setQuery] = React.useState(routedQuery);
	const deferredQuery = React.useDeferredValue(query);
	const pageSize = useProgressiveAssetPageSize();
	const [limit, setLimit] = React.useState(pageSize);
	const [listedOnly, setListedOnly] = React.useState(() => routedOffers || collectionDefaultsToListed(collectionId));
	const [sort, setSort] = React.useState<CollectionSort>('recent');
	const [viewMode, setViewMode] = React.useState<CollectionViewMode>('compact');
	const [initial, setInitial] = React.useState<string>('all');
	const [alphabetFocus, setAlphabetFocus] = React.useState<string>('all');
	const alphabetRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
	const alphabetScrollerRef = React.useRef<HTMLElement>(null);
	const [alphabetEdges, setAlphabetEdges] = React.useState({ start: true, end: false });
	const [activity, setActivity] = React.useState<AssetCandidate[]>([]);
	const [listed, setListed] = React.useState<ResolvedAsset[]>([]);
	const [cardPrices, setCardPrices] = React.useState<Record<string, CollectionCardPrice>>({});
	const [cardPricesLoading, setCardPricesLoading] = React.useState(false);
	const [cardPricesFailure, setCardPricesFailure] = React.useState<{
		source: RequestFailureSource;
		kind: RequestFailureKind;
	} | null>(null);
	const [priceRetry, setPriceRetry] = React.useState(0);
	const moreController = React.useRef<AbortController>();
	const moreLoadingRef = React.useRef(false);
	const moreContinuationRef = React.useRef<HTMLButtonElement>(null);
	const moreOutcomeRef = React.useRef<HTMLElement | null>(null);
	const restoreMoreFocus = React.useRef(false);
	const [moreState, setMoreState] = React.useState({
		loading: false,
		added: 0,
		scanned: false,
		error: null as string | null,
	});
	const resolvedPriceIds = React.useRef(new Set<string>());
	const priceScope = React.useRef('');
	const [activityState, setActivityState] = React.useState({
		loading: Boolean(collection),
		pages: 0,
		resolved: 0,
		total: 0,
		failures: 0,
		rateLimited: 0,
		error: null as string | null,
	});
	const [retry, setRetry] = React.useState(0);
	const [listingRetry, setListingRetry] = React.useState(0);
	const [listingRetrying, setListingRetrying] = React.useState(false);
	const listingActivityScope = React.useRef('');
	const listingActivityCandidates = React.useRef(new Map<string, AssetCandidate>());
	const listingLoadedAssetIds = React.useRef(new Set<string>());
	const settledListingCandidates = React.useRef(new Set<string>());
	const failedListingCandidates = React.useRef(new Map<string, FailedListingCandidate>());
	const listingAnnouncementProgress = React.useRef<ListingAnnouncementProgress>({
		scope: '',
		resolved: 0,
		failures: 0,
	});
	const createListingPublications = () =>
		createAnimationFrameBatch<CollectionListingPublication>((batch) => {
			setListed((current) =>
				mergeResolvedListingBatch(
					current,
					batch.map(({ outcome }) => outcome)
				)
			);
			setCardPrices((current) => ({
				...current,
				...Object.fromEntries(batch.map(({ outcome, price }) => [outcome.processId, price])),
			}));
			const resolved = batch.reduce((total, publication) => total + publication.resolved, 0);
			const failures = batch.reduce((total, publication) => total + publication.failures, 0);
			const rateLimited = batch.reduce((total, publication) => total + publication.rateLimited, 0);
			if (resolved || failures || rateLimited) {
				setActivityState((current) => ({
					...current,
					resolved: current.resolved + resolved,
					failures: current.failures + failures,
					rateLimited: current.rateLimited + rateLimited,
				}));
			}
		});
	const assetGridId = React.useId();
	const resultSummaryId = React.useId();
	const resultSummaryRef = React.useRef<HTMLParagraphElement>(null);
	const collectionStatusRef = React.useRef<HTMLSpanElement>(null);
	React.useEffect(() => {
		if (!appendOpen || !appendFiles.length || !ownedCollection) {
			setAppendEstimate(null);
			return;
		}
		const controller = new AbortController();
		setAppendEstimating(true);
		void loadMintRuntime()
			.then(({ CollectionMintClient }) =>
				new CollectionMintClient().estimateAppend(ownedCollection, appendFiles, controller.signal)
			)
			.then(
				(estimate) => {
					if (!controller.signal.aborted) setAppendEstimate(estimate);
				},
				(cause) => {
					if (!controller.signal.aborted) setAppendError(appErrorMessage(toAppError(cause, 'unknown')));
				}
			)
			.finally(() => {
				if (!controller.signal.aborted) setAppendEstimating(false);
			});
		return () => controller.abort();
	}, [appendFiles, appendOpen, ownedCollection]);
	const appendToCollection = async () => {
		if (!collection || !ownedCollection || !wallet.address || !appendFiles.length || appendWorking) return;
		const uploadId = `upload:${wallet.address}:${Date.now()}`;
		setAppendError(null);
		setAppendWorking(true);
		beginUpload({
			id: uploadId,
			owner: wallet.address,
			kind: 'collection',
			name: `${collection.name} additions`,
			status: 'Preparing secure wallet approvals…',
		});
		try {
			const { CollectionMintClient } = await loadMintRuntime();
			const source: MintedCollection = {
				...ownedCollection,
				...collection,
				owner: ownedCollection.owner,
				createdAt: ownedCollection.createdAt,
				manifestId: collection.manifestId ?? ownedCollection.manifestId,
			};
			const result = await new CollectionMintClient().append(source, appendFiles, wallet.address, {
				allowHighCost: true,
				onTransaction: (transaction) => recordUploadTransaction(uploadId, transaction),
				onPhase: (phase) => {
					const status = collectionAppendPhaseLabel(phase);
					setAppendStatus(status);
					updateUpload(uploadId, status);
				},
			});
			const previousIds = new Set(collection.assets.map((asset) => asset.id));
			const added = result.collection.assets.filter((asset) => !previousIds.has(asset.id));
			market.addCollection(result.collection);
			finishUpload(uploadId, {
				collectionId: collection.id,
				assetIds: added.map((asset) => asset.id),
				transactionIds: [result.manifestId, result.updateId],
				extended: true,
			});
			setAppendFiles([]);
			setAppendEstimate(null);
			setAppendOpen(false);
		} catch (cause) {
			const message = appErrorMessage(toAppError(cause, 'unknown'));
			setAppendError(message);
			failUpload(uploadId, message);
		} finally {
			setAppendWorking(false);
			setAppendStatus('');
		}
	};
	React.useEffect(() => {
		const scroller = alphabetScrollerRef.current;
		if (!scroller || collection?.kind !== 'names') return;
		const update = () => {
			const next = {
				start: scroller.scrollLeft <= 2,
				end: scroller.scrollLeft >= scroller.scrollWidth - scroller.clientWidth - 2,
			};
			setAlphabetEdges((current) => (current.start === next.start && current.end === next.end ? current : next));
		};
		update();
		scroller.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);
		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
		observer?.observe(scroller);
		return () => {
			scroller.removeEventListener('scroll', update);
			window.removeEventListener('resize', update);
			observer?.disconnect();
		};
	}, [collection?.kind]);
	React.useEffect(() => {
		if (collection?.kind !== 'names') return;
		const index = ['all', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].indexOf(alphabetFocus);
		const target = alphabetRefs.current[index];
		const scroller = alphabetScrollerRef.current;
		if (target && scroller) {
			scroller.scrollTo({
				behavior: optionalMotionBehavior(),
				left: target.offsetLeft - (scroller.clientWidth - target.offsetWidth) / 2,
			});
		}
	}, [alphabetFocus, collection?.kind]);
	const clearCollectionFilters = () => {
		setQuery('');
		setInitial('all');
		setAlphabetFocus('all');
		window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
	};
	const browseAlphabet = (direction: 'previous' | 'next') => {
		const scroller = alphabetScrollerRef.current;
		if (!scroller) return;
		const scrollerRect = scroller.getBoundingClientRect();
		const leftEdge = scrollerRect.left + (alphabetEdges.start ? 0 : 52);
		const rightEdge = scrollerRect.right - (alphabetEdges.end ? 0 : 52);
		const visible = alphabetRefs.current.flatMap((button, index) => {
			if (!button) return [];
			const bounds = button.getBoundingClientRect();
			return bounds.left >= leftEdge - 1 && bounds.right <= rightEdge + 1 ? [index] : [];
		});
		const targetIndex = alphabetBrowseIndex(direction, visible, alphabetRefs.current.length);
		const target = alphabetRefs.current[targetIndex];
		if (!target) return;
		const letter = targetIndex === 0 ? 'all' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[targetIndex - 1];
		setAlphabetFocus(letter);
		target.focus({ preventScroll: true });
	};
	const gateway = servingNodeOrigin(window.location);
	const activityByAsset = React.useMemo(
		() => new Map(activity.map((candidate) => [candidate.processId, candidate])),
		[activity]
	);
	const defaultIndex = React.useMemo(
		() =>
			collection?.kind === 'names'
				? null
				: new Map((collection?.assets ?? []).map((asset, index) => [asset.id, index])),
		[collection]
	);
	const visibleAssets = React.useMemo(
		() =>
			listedOnly
				? listed.map((result) => result.asset)
				: collection && deferredQuery.trim()
				? collectionSearchAssets(collection, deferredQuery.trim().toLowerCase())
				: collection?.assets ?? [],
		[collection, deferredQuery, listed, listedOnly]
	);
	const filtered = React.useMemo(
		() =>
			visibleAssets
				.filter(
					(asset) =>
						assetMatchesCollectionQuery(asset, deferredQuery) &&
						(initial === 'all' || asset.name.trim().toLowerCase().startsWith(initial.toLowerCase()))
				)
				.sort((a, b) => {
					if (sort === 'name') return compareCollectionAssetNames(a, b);
					if (sort === 'price-low' || sort === 'price-high') {
						const priceA = collectionPriceValue(cardPrices[a.id]);
						const priceB = collectionPriceValue(cardPrices[b.id]);
						if (priceA !== null || priceB !== null) {
							if (priceA === null) return 1;
							if (priceB === null) return -1;
							if (priceA !== priceB) return sort === 'price-low' ? priceA - priceB : priceB - priceA;
						}
					}
					if (initial !== 'all') return compareCollectionAssetNames(a, b);
					const activityA = activityByAsset.get(a.id);
					const activityB = activityByAsset.get(b.id);
					if (activityA || activityB) {
						return (
							(activityB?.height ?? 0) - (activityA?.height ?? 0) ||
							(activityB?.timestamp ?? 0) - (activityA?.timestamp ?? 0) ||
							compareCollectionAssetNames(a, b)
						);
					}
					if (collection?.kind === 'names') return compareCollectionAssetNames(a, b);
					return (
						(defaultIndex?.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
							(defaultIndex?.get(b.id) ?? Number.MAX_SAFE_INTEGER) || compareCollectionAssetNames(a, b)
					);
				}),
		[activityByAsset, cardPrices, collection?.kind, defaultIndex, deferredQuery, initial, sort, visibleAssets]
	);
	const liveListingRows = React.useMemo(() => {
		const rows = listed
			.flatMap((result) =>
				liveOrdersOfAsset(result.state).map((order) => {
					const price = orderPriceLabel(order, result.state);
					const quantity = formatTokenAmount(order.quantity, result.state.denomination);
					return {
						asset: result.asset,
						depth: 0,
						price,
						priceValue: Number.parseFloat(price.replace(/,/g, '')),
						quantity,
						quantityValue: Number.parseFloat(quantity.replace(/,/g, '')) || 0,
						total: `${winstonToAr(order.asking)} AR`,
					};
				})
			)
			.sort((a, b) => a.priceValue - b.priceValue || a.asset.name.localeCompare(b.asset.name));
		const depths = cumulativeCollectionDepth(rows.map((row) => row.quantityValue));
		return rows.map((row, index) => {
			return {
				...row,
				depth: depths[index],
			};
		});
	}, [listed]);
	const filteredCountRef = React.useRef(filtered.length);
	filteredCountRef.current = filtered.length;
	const revealNextAssetPage = React.useCallback(
		() => setLimit((current) => Math.min(filteredCountRef.current, current + pageSize)),
		[pageSize]
	);
	const progressiveRevealRef = useProgressiveReveal(limit < filtered.length, revealNextAssetPage);
	const visiblePriceAssets = filtered.slice(0, limit);
	const visiblePriceKey = visiblePriceAssets.map((asset) => asset.id).join(',');
	const visibleUnavailablePrices = visiblePriceAssets.filter(
		(asset) => cardPrices[asset.id]?.status === 'unavailable'
	).length;
	const visibleRateLimitedPrices = visiblePriceAssets.filter((asset) => {
		const price = cardPrices[asset.id];
		return price?.status === 'unavailable' && price.kind === 'rate-limited';
	}).length;
	const activityRequestMode = 'listed';
	const listingCollectionVersion = React.useMemo(
		() => (collection ? collectionListingScopeVersion(collection) : ''),
		[collection]
	);
	const listingWindowVersion = React.useMemo(
		() => collection?.assets.map((asset) => asset.id).join('.') ?? '',
		[collection]
	);
	const listingScope = collection
		? `${gateway}:${activityRequestMode}:${collection.id}:${listingCollectionVersion}`
		: '';
	React.useEffect(() => {
		moreController.current?.abort();
		moreLoadingRef.current = false;
		restoreMoreFocus.current = false;
		setMoreState({ loading: false, added: 0, scanned: false, error: null });
		return () => moreController.current?.abort();
	}, [collectionId, gateway]);
	React.useEffect(() => setQuery(routedQuery), [routedQuery]);
	const loadMore = async () => {
		if (!collection || moreLoadingRef.current) return;
		moreLoadingRef.current = true;
		moreController.current?.abort();
		const controller = new AbortController();
		moreController.current = controller;
		setMoreState({ loading: true, added: 0, scanned: false, error: null });
		try {
			const added = await market.loadMore(collection.id, controller.signal);
			if (!controller.signal.aborted) setMoreState({ loading: false, added, scanned: true, error: null });
		} catch (cause) {
			if (!controller.signal.aborted) {
				setMoreState({
					loading: false,
					added: 0,
					scanned: false,
					error: requestFailureMessage('index', requestFailureKind(cause)),
				});
			}
		} finally {
			if (moreController.current === controller) moreLoadingRef.current = false;
		}
	};
	React.useEffect(() => {
		if (moreState.loading || !restoreMoreFocus.current) return;
		restoreMoreFocus.current = false;
		window.requestAnimationFrame(() => {
			const target = moreContinuationRef.current ?? moreOutcomeRef.current;
			if (target?.isConnected && document.activeElement !== target) {
				target.focus({ preventScroll: true });
			}
		});
	}, [filtered.length, limit, moreState.error, moreState.loading, moreState.scanned]);
	React.useEffect(() => {
		if (!collection) return;
		const nextScope = listingScope;
		if (priceScope.current !== nextScope) {
			priceScope.current = nextScope;
			resolvedPriceIds.current.clear();
			setCardPrices({});
			setCardPricesFailure(null);
		}
		if (listedOnly) return;
		const controller = new AbortController();
		const unresolvedAssets = pendingCollectionPriceAssets(
			visiblePriceAssets,
			resolvedPriceIds.current,
			activityState.loading || listingActivityScope.current !== listingScope
		);
		setCardPricesLoading(Boolean(unresolvedAssets.length));
		setCardPricesFailure(null);
		if (!unresolvedAssets.length) return () => controller.abort();
		void (async () => {
			try {
				await discoverMarketActivityBatched({
					recipients: unresolvedAssets.map((asset) => asset.id),
					listingsOnly: true,
					concurrency: 1,
					signal: controller.signal,
					onBatch: async (candidates, completedRecipients) => {
						if (controller.signal.aborted || priceScope.current !== nextScope) return;
						const completedIds = new Set(completedRecipients);
						const candidateIds = new Set(candidates.map((candidate) => candidate.processId));
						const withoutListingActivity = unresolvedAssets.filter(
							(asset) => completedIds.has(asset.id) && !candidateIds.has(asset.id)
						);
						withoutListingActivity.forEach((asset) => resolvedPriceIds.current.add(asset.id));
						setCardPrices((current) => ({
							...current,
							...Object.fromEntries(
								withoutListingActivity.map((asset) => [asset.id, { status: 'unindexed' as const }])
							),
						}));
						await resolveAssetCandidates(
							candidates.filter((candidate) => completedIds.has(candidate.processId)),
							[collection],
							{
								signal: controller.signal,
								concurrency: 2,
								read: (processId, signal) =>
									readAssetStateCached(processId, {
										...DISPLAY_STATE_CACHE,
										signal,
										maxAttempts: 1,
									}),
								onSettled: (result, candidate, cause) => {
									if (controller.signal.aborted || priceScope.current !== nextScope) return;
									resolvedPriceIds.current.add(candidate.processId);
									const order = result ? bestAskOfAsset(result.state) : null;
									setListed((current) =>
										mergeResolvedListingBatch(current, [
											{ processId: candidate.processId, result: cause ? null : result },
										])
									);
									setCardPrices((current) => ({
										...current,
										[candidate.processId]: cause
											? { status: 'unavailable', kind: requestFailureKind(cause) }
											: {
													status: 'resolved',
													label:
														order && result ? orderPriceLabel(order, result.state) : null,
											  },
									}));
								},
								onRevalidated: (result, candidate, cause) => {
									if (controller.signal.aborted || priceScope.current !== nextScope) return;
									if (cause) return;
									const order = result ? bestAskOfAsset(result.state) : null;
									setListed((current) =>
										mergeResolvedListingBatch(current, [{ processId: candidate.processId, result }])
									);
									setCardPrices((current) => ({
										...current,
										[candidate.processId]: {
											status: 'resolved',
											label: order && result ? orderPriceLabel(order, result.state) : null,
										},
									}));
								},
							}
						);
					},
				});
			} catch (cause) {
				if (!controller.signal.aborted) {
					setCardPricesFailure({ source: 'index', kind: requestFailureKind(cause) });
				}
			} finally {
				if (!controller.signal.aborted) setCardPricesLoading(false);
			}
		})();
		return () => controller.abort();
	}, [activityState.loading, collection, listedOnly, listingScope, priceRetry, visiblePriceKey]);
	const retryCardPrices = () => {
		setCardPrices((current) =>
			Object.fromEntries(
				Object.entries(current).filter(([processId, price]) => {
					if (price.status !== 'unavailable') return true;
					resolvedPriceIds.current.delete(processId);
					return false;
				})
			)
		);
		setCardPricesFailure(null);
		setPriceRetry((current) => current + 1);
		window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
	};
	React.useEffect(() => {
		if (!collection) {
			listingActivityScope.current = '';
			listingActivityCandidates.current.clear();
			listingLoadedAssetIds.current.clear();
			settledListingCandidates.current.clear();
			failedListingCandidates.current.clear();
			setListingRetrying(false);
			setActivity([]);
			setListed([]);
			setActivityState({
				loading: false,
				pages: 0,
				resolved: 0,
				total: 0,
				failures: 0,
				rateLimited: 0,
				error: null,
			});
			return;
		}
		const controller = new AbortController();
		const collectionAssetIds = collection.assets.map((asset) => asset.id);
		const includesCollectionAsset = collectionCandidateMembership(collection);
		const assetWindow = collectionActivityWindowDelta(
			collection.kind,
			true,
			listingLoadedAssetIds.current,
			collectionAssetIds
		);
		const continuing = listingActivityScope.current === listingScope && !assetWindow.reset;
		const requestedAssetIds = continuing ? assetWindow.added : collectionAssetIds;
		listingActivityScope.current = listingScope;
		if (!continuing) {
			listingActivityCandidates.current.clear();
			listingLoadedAssetIds.current.clear();
			settledListingCandidates.current.clear();
			failedListingCandidates.current.clear();
			setListingRetrying(false);
			setActivity([]);
			setListed([]);
			setActivityState({
				loading: true,
				pages: 0,
				resolved: 0,
				total: 0,
				failures: 0,
				rateLimited: 0,
				error: null,
			});
		} else {
			setActivityState((current) => ({ ...current, loading: true, pages: 0, error: null }));
		}
		if (assetWindow.recipientBatched && !requestedAssetIds.length) {
			setActivityState((current) => ({ ...current, loading: false }));
			setCardPricesLoading(false);
			return () => controller.abort();
		}
		if (!continuing) setCardPrices({});
		setCardPricesLoading(true);
		setCardPricesFailure(null);
		const publications = createListingPublications();
		void (async () => {
			try {
				const resolver = createAssetCandidateResolver([collection], {
					concurrency: 2,
					signal: controller.signal,
					read: (processId, signal) =>
						readAssetStateCached(processId, {
							...DISPLAY_STATE_CACHE,
							signal,
							maxAttempts: 1,
						}),
					onSettled: (result, candidate, cause) => {
						if (controller.signal.aborted || listingActivityScope.current !== listingScope) return;
						resolvedPriceIds.current.add(candidate.processId);
						const outcome: ListingResolutionOutcome & {
							candidate: AssetCandidate;
							failureKind?: RequestFailureKind;
						} = {
							candidate,
							processId: candidate.processId,
							result,
							...(cause ? { failureKind: requestFailureKind(cause) } : {}),
						};
						settledListingCandidates.current.add(outcome.processId);
						if (outcome.failureKind) {
							failedListingCandidates.current.set(outcome.processId, {
								candidate,
								kind: outcome.failureKind,
							});
						} else {
							failedListingCandidates.current.delete(outcome.processId);
						}
						const order = result ? bestAskOfAsset(result.state) : null;
						publications.push({
							outcome,
							price: outcome.failureKind
								? { status: 'unavailable', kind: outcome.failureKind }
								: {
										status: 'resolved',
										label: order && result ? orderPriceLabel(order, result.state) : null,
								  },
							resolved: 1,
							failures: outcome.failureKind ? 1 : 0,
							rateLimited: outcome.failureKind === 'rate-limited' ? 1 : 0,
						});
					},
					onRevalidated: (result, candidate, cause) => {
						if (controller.signal.aborted || listingActivityScope.current !== listingScope || cause) return;
						resolvedPriceIds.current.add(candidate.processId);
						const outcome = { candidate, processId: candidate.processId, result };
						const order = result ? bestAskOfAsset(result.state) : null;
						publications.push({
							outcome,
							price: {
								status: 'resolved',
								label: order && result ? orderPriceLabel(order, result.state) : null,
							},
							resolved: 0,
							failures: 0,
							rateLimited: 0,
						});
					},
				});
				const resolvePage = (page: AssetCandidate[], completedRecipients: string[] = []) => {
					if (controller.signal.aborted) return;
					const pageCandidates = page.filter((candidate) => includesCollectionAsset(candidate.processId));
					const recipientsWithoutCandidates = collectionRecipientsWithoutListingCandidates(
						completedRecipients.filter(includesCollectionAsset),
						pageCandidates
					);
					for (const processId of recipientsWithoutCandidates) resolvedPriceIds.current.add(processId);
					if (recipientsWithoutCandidates.length) {
						setCardPrices((current) => ({
							...current,
							...Object.fromEntries(
								recipientsWithoutCandidates.map((processId) => [
									processId,
									{ status: 'unindexed' as const },
								])
							),
						}));
					}
					const newCandidates = pageCandidates.filter(
						(candidate) => !listingActivityCandidates.current.has(candidate.processId)
					);
					for (const candidate of pageCandidates) {
						listingActivityCandidates.current.set(candidate.processId, candidate);
					}
					setActivity(
						[...listingActivityCandidates.current.values()].sort(
							(a, b) =>
								b.height - a.height ||
								b.timestamp - a.timestamp ||
								a.processId.localeCompare(b.processId)
						)
					);
					setActivityState((current) => ({
						...current,
						pages: current.pages + 1,
						total: current.total + newCandidates.length,
					}));
					resolver.enqueue(newCandidates);
				};
				let allActivity: AssetCandidate[] = [];
				let discoveryFailure: unknown;
				try {
					allActivity =
						collection.kind === 'names'
							? await discoverMarketActivity({
									signal: controller.signal,
									listingsOnly: true,
									acceptProcessId: includesCollectionAsset,
									onPage: resolvePage,
							  })
							: await discoverMarketActivityBatched({
									recipients: requestedAssetIds,
									signal: controller.signal,
									listingsOnly: true,
									concurrency: 1,
									onBatch: (candidates, completedRecipients) => {
										resolvePage(candidates, completedRecipients);
										if (controller.signal.aborted || listingActivityScope.current !== listingScope)
											return;
										for (const assetId of completedRecipients)
											listingLoadedAssetIds.current.add(assetId);
									},
							  });
				} catch (cause) {
					discoveryFailure = cause;
				}
				await resolver.finish();
				publications.flush();
				if (controller.signal.aborted) return;
				if (discoveryFailure) throw discoveryFailure;
				const candidates = allActivity.filter((candidate) => includesCollectionAsset(candidate.processId));
				for (const candidate of candidates) {
					listingActivityCandidates.current.set(candidate.processId, candidate);
				}
				if (collection.kind === 'names') {
					for (const assetId of requestedAssetIds) listingLoadedAssetIds.current.add(assetId);
				}
				const mergedCandidates = [...listingActivityCandidates.current.values()].sort(
					(a, b) => b.height - a.height || b.timestamp - a.timestamp || a.processId.localeCompare(b.processId)
				);
				setActivity(mergedCandidates);
				if (!controller.signal.aborted) {
					setActivityState((current) => ({
						...current,
						loading: false,
						total: listingActivityCandidates.current.size,
					}));
					setCardPricesLoading(false);
				}
			} catch (cause) {
				if (!controller.signal.aborted) {
					publications.flush();
					setCardPricesLoading(false);
					setCardPricesFailure({ source: 'index', kind: requestFailureKind(cause) });
					setActivityState((current) => ({
						...current,
						loading: false,
						error: requestFailureMessage('index', requestFailureKind(cause)),
					}));
				}
			}
		})();
		return () => {
			controller.abort();
			publications.cancel();
		};
	}, [listingScope, listingWindowVersion, retry]);
	React.useEffect(() => {
		if (!listingRetry || !collection || !listedOnly) return;
		const controller = new AbortController();
		const requestScope = listingScope;
		const candidates = [...failedListingCandidates.current.values()].map(({ candidate }) => candidate);
		if (!candidates.length) return;
		setListingRetrying(true);
		void (async () => {
			try {
				await resolveAssetCandidates(candidates, [collection], {
					concurrency: 2,
					signal: controller.signal,
					read: (processId, signal) =>
						readAssetStateCached(processId, {
							...DISPLAY_STATE_CACHE,
							signal,
							maxAttempts: 1,
						}),
					onSettled: (result, candidate, cause) => {
						if (controller.signal.aborted || listingActivityScope.current !== requestScope) return;
						const outcome: ListingResolutionOutcome & {
							candidate: AssetCandidate;
							failureKind?: RequestFailureKind;
						} = {
							candidate,
							processId: candidate.processId,
							result,
							...(cause ? { failureKind: requestFailureKind(cause) } : {}),
						};
						if (outcome.failureKind) {
							failedListingCandidates.current.set(outcome.processId, {
								candidate,
								kind: outcome.failureKind,
							});
						} else {
							failedListingCandidates.current.delete(outcome.processId);
						}
						const order = result ? bestAskOfAsset(result.state) : null;
						setListed((current) => mergeResolvedListingBatch(current, [outcome]));
						setCardPrices((current) => ({
							...current,
							[outcome.processId]: outcome.failureKind
								? { status: 'unavailable', kind: outcome.failureKind }
								: {
										status: 'resolved',
										label: order && result ? orderPriceLabel(order, result.state) : null,
								  },
						}));
						const failures = [...failedListingCandidates.current.values()];
						setActivityState((current) => ({
							...current,
							failures: failures.length,
							rateLimited: failures.filter(({ kind }) => kind === 'rate-limited').length,
						}));
					},
					onRevalidated: (result, candidate, cause) => {
						if (controller.signal.aborted || listingActivityScope.current !== requestScope) return;
						if (cause) return;
						const outcome = { candidate, processId: candidate.processId, result };
						const order = result ? bestAskOfAsset(result.state) : null;
						setListed((current) => mergeResolvedListingBatch(current, [outcome]));
						setCardPrices((current) => ({
							...current,
							[candidate.processId]: {
								status: 'resolved',
								label: order && result ? orderPriceLabel(order, result.state) : null,
							},
						}));
					},
				});
			} catch {
				// Aborts leave retained listings and retry metadata unchanged.
			} finally {
				if (!controller.signal.aborted && listingActivityScope.current === requestScope) {
					setListingRetrying(false);
				}
			}
		})();
		return () => controller.abort();
	}, [listedOnly, listingRetry, listingScope]);
	React.useEffect(() => setLimit(pageSize), [initial, listedOnly, query]);
	React.useEffect(() => setLimit((current) => retainedAssetGroupLimit(current, pageSize)), [pageSize]);
	if (!collection && market.loading)
		return (
			<RouteState title="Collection">
				<Loading label="Reading collection index…" />
			</RouteState>
		);
	if (!collection && market.error)
		return (
			<RouteState title="Collection unavailable">
				<ErrorPanel message={market.error} onRetry={market.retry} />
			</RouteState>
		);
	if (!collection)
		return (
			<RouteState title="Collection not found">
				<ErrorPanel message="This collection could not be found on Arweave." />
			</RouteState>
		);
	const compactTokenCollection =
		collection.kind === 'tokens' && collection.assets.length === 1 && !collection.hasMore;
	const pagedTokenScope = collection.kind === 'tokens' && collection.hasMore;
	const listingSearchDetail = `${activityState.pages.toLocaleString()} index ${
		activityState.pages === 1 ? 'check' : 'checks'
	} this pass · ${activityState.total.toLocaleString()} ${
		activityState.total === 1 ? 'candidate' : 'candidates'
	} · ${activityState.resolved.toLocaleString()} checked${
		activityState.failures ? ` · ${activityState.failures.toLocaleString()} unavailable` : ''
	}${pagedTokenScope ? ` · among ${collection.assets.length.toLocaleString()} loaded tokens` : ''}`;
	listingAnnouncementProgress.current = nextListingAnnouncementProgress(listingAnnouncementProgress.current, {
		scope: listingScope,
		resolved: activityState.resolved,
		failures: activityState.failures,
		total: activityState.total,
		loading: activityState.loading,
	});
	const announcedListingProgress = listingAnnouncementProgress.current;
	const listingSearchAnnouncement = `${activityState.pages.toLocaleString()} index ${
		activityState.pages === 1 ? 'check' : 'checks'
	} this pass · ${activityState.total.toLocaleString()} ${
		activityState.total === 1 ? 'candidate' : 'candidates'
	} · ${announcedListingProgress.resolved.toLocaleString()} checked${
		announcedListingProgress.failures ? ` · ${announcedListingProgress.failures.toLocaleString()} unavailable` : ''
	}${pagedTokenScope ? ` · among ${collection.assets.length.toLocaleString()} loaded tokens` : ''}`;
	const resultSummary = activityState.loading
		? listedOnly
			? `${listed.length.toLocaleString()} live ${listed.length === 1 ? 'listing' : 'listings'} so far`
			: `${liveListingRows.length.toLocaleString()} live ${
					liveListingRows.length === 1 ? 'offer' : 'offers'
			  } so far`
		: query
		? `${filtered.length.toLocaleString()} ${collection.kind === 'names' ? 'current namespace' : 'loaded'} matches`
		: initial !== 'all'
		? `${filtered.length.toLocaleString()} loaded names beginning with ${initial}`
		: listedOnly
		? `${filtered.length.toLocaleString()} live ${filtered.length === 1 ? 'listing' : 'listings'}${
				pagedTokenScope ? ' in loaded tokens' : ''
		  }${activityState.failures ? ` · ${activityState.failures.toLocaleString()} unavailable` : ''}`
		: collection.kind === 'names'
		? collection.hasMore
			? `${collection.assets.length.toLocaleString()} current names loaded · more available`
			: `${collection.assets.length.toLocaleString()} current ${
					collection.assets.length === 1 ? 'name' : 'names'
			  }`
		: collection.kind === 'tokens' && collection.hasMore
		? `${collection.assets.length.toLocaleString()} tokens loaded · more available`
		: `${collection.assets.length.toLocaleString()} ${
				collection.kind === 'tokens'
					? collection.assets.length === 1
						? 'token'
						: 'tokens'
					: collection.assets.length === 1
					? 'asset'
					: 'assets'
		  }`;
	const resultAnnouncement = activityState.loading
		? listedOnly
			? `Searching Arweave for live listings in ${collection.name}: ${listingSearchAnnouncement}.`
			: `Checking live offers in ${collection.name} while all items remain visible.`
		: cardPricesLoading
		? `Checking live prices for ${visiblePriceAssets.length.toLocaleString()} visible assets in ${collection.name}.`
		: query
		? filtered.length
			? `${filtered.length.toLocaleString()} ${
					collection.kind === 'names' ? 'names' : 'assets'
			  } match ${query} in ${collection.name}.`
			: collection.kind === 'tokens' && collection.hasMore
			? `No loaded tokens match ${query} in ${collection.name}; more token records remain available.`
			: `No ${collection.kind === 'names' ? 'names' : 'assets'} match ${query} in ${collection.name}.`
		: `${resultSummary} in ${collection.name}.`;
	return (
		<section className={`collection-page collection-marketplace-page view-${viewMode}`}>
			<Link className="back" to="/">
				<Icon icon={ArrowLeft} size="sm" /> {collection.kind === 'tokens' ? 'Discover' : 'All collections'}
			</Link>
			<div className="collection-market-navigation">
				<CollectionMarketSummary
					action={
						collection.kind === 'images' && ownedCollection?.owner === wallet.address ? (
							<Button
								onClick={() => setAppendOpen(true)}
								ref={appendTrigger}
								type="button"
								variant="neutral"
							>
								<Images aria-hidden="true" /> Add assets
							</Button>
						) : undefined
					}
					collection={collection}
					stats={[
						{
							label: 'Floor price',
							value:
								activityState.loading && !liveListingRows.length
									? 'Checking…'
									: liveListingRows[0]?.price ?? '—',
						},
						{
							label: 'Live offers',
							value:
								activityState.loading && !liveListingRows.length
									? 'Checking…'
									: liveListingRows.length.toLocaleString(),
						},
						{
							label: 'Loaded / supply',
							value: `${collection.assets.length.toLocaleString()} / ${(
								collection.total ?? collection.assets.length
							).toLocaleString()}`,
						},
						{ label: 'Offer candidates', value: activity.length.toLocaleString() },
					]}
				/>
				<CollectionTabs
					collection={collection}
					active={listedOnly ? 'offers' : 'assets'}
					onSelectAssets={() => setListedOnly(false)}
					onSelectOffers={() => setListedOnly(true)}
				/>
			</div>
			<Dialog
				as="section"
				backdropClassName="dialog-backdrop"
				className="dialog dialog-compact collection-append-dialog"
				labelledBy="append-collection-title"
				onDismiss={() => {
					if (!appendWorking) setAppendOpen(false);
				}}
				open={appendOpen && Boolean(ownedCollection)}
				restoreTarget={() => appendTrigger.current}
			>
				<DialogHeading
					control={
						<IconButton
							icon={X}
							label="Close add assets"
							onClick={() => setAppendOpen(false)}
							disabled={appendWorking}
						/>
					}
					eyebrow="Extend collection"
					title={`Add assets to ${collection.name}`}
					titleId="append-collection-title"
				/>
				<p className="append-collection-copy">
					Each image becomes a wallet-owned Arweave asset. A new immutable manifest then updates the
					collection carrier.
				</p>
				<label className={`mint-dropzone${appendFiles.length ? ' has-file' : ''}`}>
					<FileInput
						accept="image/png,image/jpeg,image/webp,image/gif"
						disabled={appendWorking}
						multiple
						onChange={(event) => {
							setAppendFiles(Array.from(event.target.files ?? []).slice(0, 10));
							setAppendError(null);
						}}
					/>
					<span>
						<Upload aria-hidden="true" />
						<strong>{appendFiles.length ? `${appendFiles.length} images ready` : 'Choose images'}</strong>
						<small>PNG, JPEG, WebP, or GIF · up to 10 files</small>
					</span>
				</label>
				{appendFiles.length ? (
					<div className="collection-append-preview" aria-label="Selected images">
						{appendPreviews.map(({ file, url }) => (
							<figure key={`${file.name}:${file.size}`}>
								<img alt="" src={url} />
								<figcaption>{file.name.replace(/\.[^.]+$/, '')}</figcaption>
							</figure>
						))}
					</div>
				) : null}
				<div className="collection-append-summary">
					<span>{appendEstimating ? 'Checking Arweave storage cost…' : appendStatus || 'Ready'}</span>
					<strong>
						{appendEstimate ? (
							<ArCurrencyText>{`${winstonToAr(appendEstimate.total.toString())} AR · ${
								appendEstimate.transactionCount
							} transactions`}</ArCurrencyText>
						) : (
							'—'
						)}
					</strong>
				</div>
				{appendError ? <ErrorPanel message={appendError} /> : null}
				<Button
					className="wide"
					disabled={!appendFiles.length || !appendEstimate || appendWorking}
					onClick={() => void appendToCollection()}
					type="button"
				>
					{appendWorking ? (
						<LoaderCircle className="spin" aria-hidden="true" />
					) : (
						<Upload aria-hidden="true" />
					)}
					{appendWorking ? 'Adding assets…' : `Add ${appendFiles.length || ''} assets`}
				</Button>
			</Dialog>
			<CollectionIndexNotice collection={collection} checking={market.loading} onRetry={market.retry} />
			{pagedTokenScope ? (
				<div className="collection-source-notice" role="status">
					<span>
						Browsing {collection.assets.length.toLocaleString()} of{' '}
						{(collection.total ?? collection.assets.length).toLocaleString()} discovered tokens. Prices,
						listings, and recent activity cover the loaded records.
					</span>
				</div>
			) : null}
			{collection.kind === 'names' ? (
				<div
					className={`alphabet-filter-shell${alphabetEdges.start ? ' at-start' : ''}${
						alphabetEdges.end ? ' at-end' : ''
					}`}
				>
					<nav
						className="alphabet-filter"
						aria-label="Filter names by first letter"
						id="name-initial-filter"
						ref={alphabetScrollerRef}
					>
						{['all', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].map((letter, index, options) => (
							<Button
								aria-label={letter === 'all' ? 'All names' : `Names beginning with ${letter}`}
								aria-pressed={initial === letter}
								className={initial === letter ? 'active' : undefined}
								key={letter}
								size="custom"
								type="button"
								variant="ghost"
								onClick={() => {
									setAlphabetFocus(letter);
									setInitial(letter);
								}}
								onKeyDown={(event) => {
									const nextIndex = alphabetFilterIndex(event.key, index, options.length);
									if (nextIndex === null) return;
									event.preventDefault();
									setAlphabetFocus(options[nextIndex]);
									alphabetRefs.current[nextIndex]?.focus();
								}}
								ref={(element) => {
									alphabetRefs.current[index] = element;
								}}
								tabIndex={alphabetFocus === letter ? 0 : -1}
							>
								{letter === 'all' ? 'All' : letter}
							</Button>
						))}
					</nav>
					{!alphabetEdges.start ? (
						<Button
							aria-controls="name-initial-filter"
							aria-label="Browse earlier letters"
							className="alphabet-scroll alphabet-scroll-previous"
							size="icon"
							onClick={() => browseAlphabet('previous')}
							type="button"
						>
							<ArrowLeft aria-hidden="true" />
						</Button>
					) : null}
					{!alphabetEdges.end ? (
						<Button
							aria-controls="name-initial-filter"
							aria-label="Browse later letters"
							className="alphabet-scroll alphabet-scroll-next"
							size="icon"
							onClick={() => browseAlphabet('next')}
							type="button"
						>
							<ArrowRight aria-hidden="true" />
						</Button>
					) : null}
				</div>
			) : null}
			{compactTokenCollection ? (
				<span className="collection-result-count" id={resultSummaryId} ref={collectionStatusRef} tabIndex={-1}>
					1 token
				</span>
			) : (
				<div className="asset-tools collection-market-tools">
					<div className="collection-view-toggle" aria-label="Asset layout">
						<Button
							aria-label="Comfortable grid"
							aria-pressed={viewMode === 'comfortable'}
							className={viewMode === 'comfortable' ? 'active' : undefined}
							onClick={() => setViewMode('comfortable')}
							size="icon"
							type="button"
							variant="ghost"
						>
							<Grid2X2 aria-hidden="true" />
						</Button>
						<Button
							aria-label="Compact grid"
							aria-pressed={viewMode === 'compact'}
							className={viewMode === 'compact' ? 'active' : undefined}
							onClick={() => setViewMode('compact')}
							size="icon"
							type="button"
							variant="ghost"
						>
							<LayoutGrid aria-hidden="true" />
						</Button>
						<Button
							aria-label="List view"
							aria-pressed={viewMode === 'list'}
							className={viewMode === 'list' ? 'active' : undefined}
							onClick={() => setViewMode('list')}
							size="icon"
							type="button"
							variant="ghost"
						>
							<List aria-hidden="true" />
						</Button>
					</div>
					<label className="collection-search">
						<Search aria-hidden="true" />
						<VisuallyHidden>Search {collection.name}</VisuallyHidden>
						<TextInput
							aria-controls={assetGridId}
							aria-describedby={resultSummaryId}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search items"
						/>
					</label>
					<div className="asset-tools-controls">
						<div className="asset-filters">
							<Select<CollectionSort>
								label="Sort"
								onChange={setSort}
								options={[
									{ value: 'recent', label: 'Recently active' },
									{ value: 'price-low', label: 'Price: Low to High' },
									{ value: 'price-high', label: 'Price: High to Low' },
									{ value: 'name', label: 'Name: A to Z' },
								]}
								showLabel={false}
								value={sort}
							/>
							<Select<'all' | 'listed'>
								label="Show"
								onChange={(nextValue) => setListedOnly(nextValue === 'listed')}
								options={[
									{ value: 'all', label: 'All assets' },
									{ value: 'listed', label: 'Listed for sale' },
								]}
								showLabel={false}
								value={listedOnly ? 'listed' : 'all'}
							/>
						</div>
						<span id={resultSummaryId} ref={collectionStatusRef} tabIndex={-1}>
							{resultSummary}
						</span>
					</div>
					<LiveRegion>{resultAnnouncement}</LiveRegion>
				</div>
			)}
			{listedOnly && activityState.loading ? (
				<div className="collection-resolution-status">
					<div>
						<strong>Checking live listings</strong>
						<span>{listingSearchDetail}</span>
					</div>
					<div
						aria-label="Searching Arweave for live listings"
						aria-valuetext={listingSearchDetail}
						className="resolution-track indeterminate"
						role="progressbar"
					>
						<span />
					</div>
				</div>
			) : null}
			{activityState.error ? (
				<RetryNotice
					onRetry={() => {
						setRetry((value) => value + 1);
						window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
					}}
				/>
			) : null}
			{!listedOnly && !cardPricesLoading && (cardPricesFailure || visibleUnavailablePrices > 0) ? (
				<RetryNotice onRetry={retryCardPrices}>
					Compute hasn’t completed yet. Please try again.
					{!cardPricesFailure && visibleUnavailablePrices
						? ` ${visibleUnavailablePrices.toLocaleString()} visible ${
								visibleUnavailablePrices === 1 ? 'price remains' : 'prices remain'
						  } unavailable.`
						: ''}
				</RetryNotice>
			) : null}
			{listedOnly && !activityState.loading && !activityState.error && activityState.failures ? (
				<RetryNotice
					onRetry={() => {
						setListingRetry((value) => value + 1);
						window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
					}}
					retrying={listingRetrying}
				>
					{listingRetrying
						? 'Rechecking only the listing candidates that were unavailable.'
						: 'Compute hasn’t completed yet. Please try again.'}{' '}
					{activityState.failures.toLocaleString()} listing{' '}
					{activityState.failures === 1 ? 'candidate remains' : 'candidates remain'} unavailable. Resolved
					listings remain visible.
				</RetryNotice>
			) : null}
			{collection.kind === 'tokens' ? (
				<div
					aria-describedby={resultSummaryId}
					aria-label={`${collection.name} tokens`}
					className="token-market-list collection-token-list"
					id={assetGridId}
					role="list"
				>
					{filtered.slice(0, limit).map((asset, index) => {
						const price = cardPrices[asset.id];
						const priceLabel =
							price?.status === 'unavailable'
								? 'Unavailable'
								: price?.status === 'unindexed'
								? 'Unlisted'
								: price?.status === 'resolved'
								? price.label ?? 'Not listed'
								: cardPricesFailure
								? 'Unavailable'
								: 'Checking…';
						return (
							<TokenMarketRow
								asset={asset}
								badge={listedOnly ? 'For sale' : undefined}
								collection={collection}
								context={`Process · ${short(asset.id)}`}
								key={asset.id}
								metric={{
									label: 'Unit price',
									value: priceLabel,
									tone: price?.status === 'resolved' && price.label ? 'positive' : 'default',
								}}
								onWarm={() => prefetchAssetPage(asset.id, true)}
								priority={index < 2}
							/>
						);
					})}
				</div>
			) : (
				<div
					aria-describedby={resultSummaryId}
					aria-label={`${collection.name} assets`}
					className={`asset-grid collection-market-grid${
						collection.kind === 'names' ? ' names-collection-grid' : ''
					}`}
					id={assetGridId}
				>
					{filtered.slice(0, limit).map((asset, index) => {
						const price = cardPrices[asset.id];
						return (
							<AssetCard
								key={asset.id}
								collection={collection}
								asset={asset}
								priority={index < 2}
								collectionContext
								badge={listedOnly ? 'For sale' : undefined}
								price={
									price?.status === 'unavailable'
										? 'Unavailable'
										: price?.status === 'unindexed'
										? 'Unlisted'
										: price?.status === 'resolved'
										? price.label ?? 'Not listed'
										: cardPricesFailure
										? 'Unavailable'
										: 'Checking…'
								}
								priceListed={price?.status === 'resolved' && Boolean(price.label)}
							/>
						);
					})}
				</div>
			)}
			<p
				className={
					filtered.length > pageSize && limit >= filtered.length
						? 'collection-result-count reveal-complete'
						: 'sr-only'
				}
				aria-live="polite"
				ref={resultSummaryRef}
				role="status"
				tabIndex={-1}
			>
				{filtered.length > pageSize && limit >= filtered.length
					? `All ${filtered.length.toLocaleString()} ${
							collection.hasMore
								? `currently loaded ${collection.kind === 'names' ? 'names' : 'assets'}`
								: collection.kind === 'names'
								? 'names'
								: 'assets'
					  } are shown.`
					: `Showing ${Math.min(
							limit,
							filtered.length
					  ).toLocaleString()} of ${filtered.length.toLocaleString()} ${
							collection.kind === 'names' ? 'names' : 'assets'
					  }.`}
			</p>
			{listedOnly && !activityState.loading && !activityState.error && !filtered.length ? (
				<EmptyState
					title={
						query
							? `No live listings match “${query}”`
							: initial !== 'all'
							? `No live listings begin with ${initial}`
							: activityState.failures
							? 'No live listings yet'
							: pagedTokenScope
							? 'No live listings in loaded tokens'
							: 'No live listings found'
					}
					action={
						query || initial !== 'all' ? (
							<Button type="button" onClick={clearCollectionFilters} size="custom">
								Clear filters
							</Button>
						) : null
					}
				>
					{query || initial !== 'all'
						? 'Clear the current filters to see every live listing.'
						: activityState.failures
						? 'Some candidates could not be checked through the configured AO peers. Retry them before treating this as an empty market.'
						: pagedTokenScope
						? `Every offer candidate among the ${collection.assets.length.toLocaleString()} loaded tokens was checked against current process state. Load more tokens to extend this market view.`
						: activityState.total
						? `Every indexed offer candidate was checked against current process state through ${gateway}; none remains live.`
						: 'Arweave returned no indexed offer candidates for this collection window. Live state remains the marketplace truth once a candidate is found.'}
				</EmptyState>
			) : null}
			{!listedOnly && !filtered.length ? (
				<div className="collection-empty-state">
					<span>
						<Icon icon={Search} />
					</span>
					<h3>
						{query
							? collection.kind === 'tokens' && collection.hasMore
								? `No loaded tokens match “${query}”`
								: `No assets match “${query}”`
							: initial !== 'all'
							? `No names beginning with ${initial}`
							: 'Nothing here yet'}
					</h3>
					<p>
						{query
							? collection.kind === 'tokens' && collection.hasMore
								? 'Search the next token records or clear the current query.'
								: 'Try a shorter search or clear the current query.'
							: initial !== 'all'
							? 'Try another letter or return to all names.'
							: 'This collection does not contain any indexed assets yet.'}
					</p>
					{query || initial !== 'all' ? (
						<Button type="button" onClick={clearCollectionFilters} size="custom">
							{initial !== 'all' ? 'View all names' : 'Clear search'}
						</Button>
					) : null}
				</div>
			) : null}
			{moreState.error ? (
				<RetryNotice
					ref={(node) => {
						moreOutcomeRef.current = node;
					}}
					tabIndex={-1}
					onRetry={() => {
						void loadMore();
						window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
					}}
				/>
			) : null}
			{moreState.scanned ? (
				<p
					className={moreState.added && collection.hasMore ? 'sr-only' : 'collection-result-count'}
					aria-live="polite"
					ref={(node) => {
						moreOutcomeRef.current = node;
					}}
					role="status"
					tabIndex={-1}
				>
					{moreState.added
						? `${moreState.added.toLocaleString()} more ${
								collection.kind === 'tokens'
									? moreState.added === 1
										? 'token'
										: 'tokens'
									: `current ${moreState.added === 1 ? 'name' : 'names'}`
						  } loaded.`
						: collection.kind === 'tokens'
						? `No additional tokens were found in that page. ${
								collection.hasMore
									? 'More token records remain.'
									: 'The token index is now fully checked.'
						  }`
						: `No additional current names were found in that page. ${
								collection.hasMore
									? 'More carrier records remain.'
									: 'The carrier index is now fully checked.'
						  }`}
				</p>
			) : null}
			{limit < filtered.length ? (
				<span aria-hidden="true" className="progressive-reveal-sentinel" ref={progressiveRevealRef} />
			) : null}
			{limit < filtered.length ? (
				<Button
					aria-controls={assetGridId}
					className="load-more"
					ref={moreContinuationRef}
					size="custom"
					type="button"
					onClick={() => {
						const nextLimit = Math.min(filtered.length, limit + pageSize);
						setLimit(nextLimit);
						window.requestAnimationFrame(() => {
							if (assetGroupRevealComplete(nextLimit, filteredCountRef.current)) {
								resultSummaryRef.current?.focus();
							}
						});
					}}
				>
					Show {Math.min(pageSize, filtered.length - limit).toLocaleString()} more{' '}
					{collection.kind === 'names' ? 'names' : 'assets'}
				</Button>
			) : collection.hasMore && (collection.kind === 'tokens' || (!listedOnly && !query)) && !moreState.error ? (
				<Button
					aria-busy={moreState.loading}
					aria-disabled={moreState.loading}
					className="load-more"
					size="custom"
					onBlur={(event) => {
						if (moreState.loading && event.relatedTarget) restoreMoreFocus.current = false;
					}}
					onClick={() => {
						if (moreLoadingRef.current) return;
						restoreMoreFocus.current = true;
						void loadMore();
					}}
					ref={moreContinuationRef}
					type="button"
				>
					{moreState.loading
						? `${collection.kind === 'tokens' && query ? 'Searching' : 'Checking'} ${
								collection.kind === 'tokens' ? 'token' : 'carrier'
						  } records…`
						: `${collection.kind === 'tokens' && query ? 'Search' : 'Check'} next 100 ${
								collection.kind === 'tokens' ? 'token' : 'carrier'
						  } records`}
				</Button>
			) : null}
			<CollectionAnalyticsPanel collection={collection} loading={activityState.loading} rows={liveListingRows} />
		</section>
	);
}
