import React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
	ArrowUpRight,
	BarChart3,
	CircleX,
	Diamond,
	FileText,
	Grid2X2,
	Images,
	Info,
	Layers3,
	Send,
	ShoppingCart,
	Tag,
} from 'lucide-react';

import {
	type AssetSummary,
	type Collection,
	collectionAsset,
	collectionMoreAssets,
	FUNGIBLE_TOKEN_COLLECTION_ID,
	isVisibleAssetId,
	loadAssetShellSnapshot,
	storeAssetShellSnapshot,
} from 'api/collections';
import {
	bazarAtomicAssetFromState,
	type CollectionActivityEvent,
	confirmPurchaseActivity,
	discoverCollectionActivityPage,
	loadBazarAtomicAssetById,
	loadMarketActivity,
	saveMarketActivity,
} from 'api/discovery';
import {
	assetBalanceStateAvailable,
	type AssetState,
	cachedAssetState,
	invalidateAssetState,
	licenseProperties,
	ownerOfAsset,
	prefetchAssetPage,
	prioritizeAssetStatePrefetch,
	readAssetStateCached,
} from 'api/marketplace';
import { CREATED_COLLECTION_ID } from 'api/mint';
import {
	atomicPurchaseStorageKey,
	clearStaleWalletOperationClaim,
	hasRecoverablePurchase,
	loadWalletRecord,
	type Operation,
	operationClaimStorageKey,
	operationRecoveryCanStillApply,
	operationStorageKey,
	removeWalletRecord,
	removeWalletRecordIf,
	removeWalletRecoveryAndSignatures,
	walletOperationStorageChange,
} from 'api/operations';
import {
	loadAtomicTransactionRuntime,
	preloadAtomicTransactionRuntime,
	purchaseGatewaySwitchNotice,
} from 'api/transactions';

import { ArCurrencyLabel, ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { AudioArtwork } from 'components/atoms/AudioArtwork';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { InteractiveHtmlArtwork } from 'components/atoms/InteractiveHtmlArtwork';
import { Loading } from 'components/atoms/Loading';
import { NameArtwork } from 'components/atoms/NameArtwork';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import { RetryNotice } from 'components/molecules/RetryNotice';
import { RouteState } from 'components/molecules/RouteState';
import { StateVerification } from 'components/molecules/StateVerification';
import { StatusNotice } from 'components/molecules/StatusNotice';
import { ConnectWalletButton } from 'components/organisms/ConnectWalletButton';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { DeferredMarketActivityList } from 'features/Activity';
import { assetDescription, liveOrder, unitPriceWinston } from 'features/Catalogue';
import { CollectionIndexNotice } from 'features/Collection';
import {
	AssetBalanceStateNotice,
	assetOperationPendingActionLabel,
	AssetOperationStatus,
	atomicOrderCanBeBought,
	atomicPurchaseRecoveryStatus,
	currentPurchaseGatewayContext,
	externalReservationTransaction,
	hasStoredSignedTransaction,
	type UnavailableOperationRecovery,
	UnavailableOperationRecoveryNotice,
} from 'features/Operations';
import { PausedRecoveryNotice } from 'features/Operations';
import { preloadArweaveTransactionSync } from 'features/TransactionSync';
import { winstonToAr } from 'helpers/ar-units';
import { isArweaveId } from 'helpers/arweave-id';
import { isAudioContentType, isHtmlContentType } from 'helpers/asset-media';
import { formatAudioDuration } from 'helpers/audio-metadata';
import { aoRoutingScopeFromLocation } from 'helpers/config';
import { transactionExplorerUrl } from 'helpers/explorer';
import { short } from 'helpers/format';
import { scheduleIdleTask } from 'helpers/idle';
import { marketplaceFailureKind, marketplaceRequestFailureMessage } from 'helpers/marketplace-error';
import { useMarketProvider } from 'providers/MarketProvider';
import { useOperationActivity } from 'providers/OperationActivityProvider';
import { useWallet } from 'providers/WalletProvider';

import {
	assetDetailCanResolve,
	assetDetailErrorMessage,
	assetDetailMembershipVerified,
	assetStateErrorMessage,
	assetStateRecoveryUrl,
	mergeAssetActivityPages,
	mergeAssetDetailMetadata,
	uniquePriceHistory,
	verifiedAssetForDetail,
} from '../../../model/asset-detail';
import { loadFungibleAssetView } from '../../../model/fungible-asset-view';
import { type AssetDetailTab, AssetDetailTabs } from '../../molecules/AssetDetailTabs';
import { SetProfilePictureButton } from '../../molecules/SetProfilePictureButton';
import { AssetDetailLoadingShell } from '../AssetDetailLoadingShell';

const FungibleAssetView = React.lazy(() =>
	loadFungibleAssetView().then((module) => ({ default: module.FungibleAssetView }))
);

const UniquePriceChart = React.lazy(() =>
	import('../TokenPriceChart').then(({ TokenPriceChart }) => ({ default: TokenPriceChart }))
);

const DeferredAudioWaveformPlayer = React.lazy(async () => {
	const module = await import('../AudioWaveformPlayer');
	return { default: module.AudioWaveformPlayer };
});

function AudioWaveformPlayer(props: React.ComponentProps<typeof DeferredAudioWaveformPlayer>) {
	return (
		<React.Suspense fallback={<Loading label="Loading audio player…" />}>
			<DeferredAudioWaveformPlayer {...props} />
		</React.Suspense>
	);
}

export default function AssetDetail() {
	const { collectionId = '', assetId = '' } = useParams();
	const market = useMarketProvider();
	const wallet = useWallet();
	const aoRoutingScope = aoRoutingScopeFromLocation();
	const indexedCollection = market.collections.find((item) => item.id === collectionId);
	const indexedAsset = indexedCollection ? collectionAsset(indexedCollection, assetId) : undefined;
	const cachedAsset = React.useMemo(
		() => loadAssetShellSnapshot(window.localStorage, assetId),
		[assetId, market.visibilityReady]
	);
	const [indexedAtomicResult, setIndexedAtomicResult] = React.useState<{
		assetId: string;
		result: { asset: AssetSummary; collection: Collection } | null;
	}>({ assetId, result: null });
	const prefetchedState = React.useMemo(
		() => (market.visibilityReady ? cachedAssetState(assetId) : undefined),
		[aoRoutingScope, assetId, market.visibilityReady]
	);
	const liveResultKey = `${assetId}\0${aoRoutingScope}`;
	const [liveResult, setLiveResult] = React.useState<{
		key: string;
		state: AssetState | null;
		loading: boolean;
		error: string | null;
		provider: string;
		verifiedAt: number | null;
	}>({
		key: liveResultKey,
		state: prefetchedState?.state ?? null,
		loading: true,
		error: null,
		provider: prefetchedState?.provider ?? '',
		verifiedAt: prefetchedState?.verifiedAt ?? null,
	});
	const requestRef = React.useRef<AbortController>();
	const liveResultIsCurrent = liveResult.key === liveResultKey;
	const state = liveResultIsCurrent ? liveResult.state : prefetchedState?.state ?? null;
	const error = liveResultIsCurrent ? liveResult.error : null;
	const loading = !liveResultIsCurrent || liveResult.loading;
	const provider = liveResultIsCurrent ? liveResult.provider : prefetchedState?.provider ?? '';
	const verifiedAt = liveResultIsCurrent ? liveResult.verifiedAt : prefetchedState?.verifiedAt ?? null;
	const directAtomicRoute =
		collectionId === CREATED_COLLECTION_ID && isArweaveId(assetId) && isVisibleAssetId(assetId);
	const indexedAtomic = indexedAtomicResult.assetId === assetId ? indexedAtomicResult.result : null;
	React.useEffect(() => {
		if (
			!isArweaveId(assetId) ||
			!isVisibleAssetId(assetId) ||
			collectionId === FUNGIBLE_TOKEN_COLLECTION_ID ||
			collectionId === 'arweave-names'
		)
			return;
		const controller = new AbortController();
		void loadBazarAtomicAssetById(assetId, { signal: controller.signal }).then(
			(result) => {
				if (!controller.signal.aborted) setIndexedAtomicResult({ assetId, result });
			},
			() => {
				if (!controller.signal.aborted) setIndexedAtomicResult({ assetId, result: null });
			}
		);
		return () => controller.abort();
	}, [assetId, collectionId, market.visibilityReady]);
	const canResolveAsset = assetDetailCanResolve({
		assetId,
		cachedAsset,
		indexedAsset,
		indexedMetadata: indexedAtomic?.asset,
		indexedCollection,
		directAtomicRoute,
		directFungibleRoute: collectionId === 'fungible-tokens' && isArweaveId(assetId) && isVisibleAssetId(assetId),
	});
	const directAtomicAsset = directAtomicRoute && state ? bazarAtomicAssetFromState(assetId, state) : null;
	const indexedMetadata = indexedAtomic?.asset;
	const shellAsset = mergeAssetDetailMetadata(indexedAsset ?? cachedAsset, indexedMetadata);
	const collection =
		indexedCollection ??
		directAtomicAsset?.collection ??
		(directAtomicRoute ? indexedAtomic?.collection : undefined);
	const resolvedAsset =
		directAtomicAsset?.asset ??
		mergeAssetDetailMetadata(
			indexedCollection && state
				? collectionAsset(indexedCollection, assetId, state)
				: indexedAsset ?? cachedAsset,
			indexedMetadata
		);
	const membershipVerified = assetDetailMembershipVerified(
		indexedCollection?.id,
		market.verifiedCollectionIds,
		Boolean(directAtomicAsset || (directAtomicRoute && indexedAtomic))
	);
	const verifiedAsset = membershipVerified
		? verifiedAssetForDetail(collection, indexedAsset, resolvedAsset, state)
		: undefined;
	const detailError = assetDetailErrorMessage(error, shellAsset, Boolean(indexedAtomic));
	React.useEffect(() => {
		if (collectionId === 'fungible-tokens' || indexedCollection?.kind === 'tokens') {
			void loadFungibleAssetView();
		}
	}, [collectionId, indexedCollection?.kind]);
	React.useEffect(() => {
		if (!verifiedAsset) return;
		return scheduleIdleTask(() => storeAssetShellSnapshot(window.localStorage, verifiedAsset), 500);
	}, [verifiedAsset]);
	const {
		activities: operationActivities,
		start: startOperationActivity,
		show: showOperationActivity,
		remove: removeOperationActivity,
	} = useOperationActivity();
	const operationFocusFallbackRef = React.useRef<HTMLHeadingElement>(null);
	const resumeButtonRef = React.useRef<HTMLButtonElement>(null);
	const operationFocusFallback = React.useCallback(
		() => resumeButtonRef.current ?? operationFocusFallbackRef.current,
		[]
	);
	const operationActivityEntry = operationActivities.find(
		(activity) => activity.asset.id === assetId && activity.owner === wallet.address && activity.phase !== 'done'
	);
	const operation = operationActivityEntry?.operation ?? null;
	const openOperation = React.useCallback(
		(next: Operation, options?: { show?: boolean }) => {
			if (!wallet.address || !verifiedAsset) return;
			preloadAtomicTransactionRuntime();
			preloadArweaveTransactionSync();
			startOperationActivity(
				{
					asset: verifiedAsset,
					collectionId,
					owner: wallet.address,
					operation: next,
					restoreFallback: operationFocusFallback,
				},
				options
			);
		},
		[collectionId, operationFocusFallback, startOperationActivity, verifiedAsset, wallet.address]
	);
	const [recoverySuppressed, setRecoverySuppressed] = React.useState(false);
	const [recoveryNotice, setRecoveryNotice] = React.useState('');
	const [unavailableRecovery, setUnavailableRecovery] = React.useState<UnavailableOperationRecovery | null>(null);
	const [assetActivity, setAssetActivity] = React.useState<CollectionActivityEvent[]>([]);
	const [activityLoading, setActivityLoading] = React.useState(false);
	const [activityLoadingMore, setActivityLoadingMore] = React.useState(false);
	const [activityRequested, setActivityRequested] = React.useState(false);
	const [activityError, setActivityError] = React.useState<string | null>(null);
	const [activityRetry, setActivityRetry] = React.useState(0);
	const [activityCursor, setActivityCursor] = React.useState<string | null>(null);
	const [activityHasNextPage, setActivityHasNextPage] = React.useState(false);
	const [activityTotalCount, setActivityTotalCount] = React.useState<number | null>(null);
	const [assetAskActivity, setAssetAskActivity] = React.useState<CollectionActivityEvent[]>([]);
	const [askLoading, setAskLoading] = React.useState(false);
	const [askLoadingMore, setAskLoadingMore] = React.useState(false);
	const [askError, setAskError] = React.useState<string | null>(null);
	const [askRetry, setAskRetry] = React.useState(0);
	const [askCursor, setAskCursor] = React.useState<string | null>(null);
	const [askHasNextPage, setAskHasNextPage] = React.useState(false);
	const [storageVersion, setStorageVersion] = React.useState(0);
	const activityAssetRef = React.useRef('');
	const askAssetRef = React.useRef('');
	const activityLoadMoreRef = React.useRef<AbortController | null>(null);
	const askLoadMoreRef = React.useRef<AbortController | null>(null);
	const [activeSection, setActiveSection] = React.useState<
		'about' | 'orders' | 'activity' | 'rights' | 'blockchain' | 'more'
	>('about');
	const readLiveState = React.useCallback(
		async (_force: boolean) => {
			requestRef.current?.abort();
			if (!canResolveAsset) {
				setLiveResult({
					key: liveResultKey,
					state: null,
					loading: false,
					error: null,
					provider: '',
					verifiedAt: null,
				});
				return;
			}
			const controller = new AbortController();
			requestRef.current = controller;
			const cached = cachedAssetState(assetId);
			setLiveResult((current) => {
				const isCurrent = current.key === liveResultKey;
				return {
					key: liveResultKey,
					state: isCurrent ? current.state : cached?.state ?? null,
					loading: true,
					error: null,
					provider: isCurrent ? current.provider : cached?.provider ?? '',
					verifiedAt: isCurrent ? current.verifiedAt : cached?.verifiedAt ?? null,
				};
			});
			try {
				const result = await readAssetStateCached(assetId, {
					maxAge: 0,
					cacheTtlMs: 20_000,
					force: true,
					signal: controller.signal,
				});
				if (requestRef.current === controller && !controller.signal.aborted) {
					setLiveResult({
						key: liveResultKey,
						state: result.state,
						loading: Boolean(result.revalidation),
						error: null,
						provider: result.provider,
						verifiedAt: result.verifiedAt ?? Date.now(),
					});
				}
				if (result.revalidation) {
					const fresh = await result.revalidation;
					if (requestRef.current === controller && !controller.signal.aborted) {
						setLiveResult({
							key: liveResultKey,
							state: fresh.state,
							loading: false,
							error: null,
							provider: fresh.provider,
							verifiedAt: fresh.verifiedAt ?? Date.now(),
						});
					}
				}
			} catch (cause) {
				if (requestRef.current === controller && !controller.signal.aborted) {
					setLiveResult((current) => {
						const isCurrent = current.key === liveResultKey;
						return {
							key: liveResultKey,
							state: isCurrent ? current.state : null,
							loading: false,
							error: assetStateErrorMessage(cause),
							provider: isCurrent ? current.provider : '',
							verifiedAt: isCurrent ? current.verifiedAt : null,
						};
					});
				}
			}
		},
		[assetId, canResolveAsset, liveResultKey]
	);
	const load = React.useCallback(() => readLiveState(false), [readLiveState]);
	const refreshAsset = React.useCallback(async () => {
		invalidateAssetState(assetId);
		setActivityRetry((value) => value + 1);
		await readLiveState(true);
	}, [assetId, readLiveState]);
	React.useEffect(() => {
		const refreshFinishedOperation = (event: Event) => {
			if ((event as CustomEvent<string>).detail === assetId) void refreshAsset();
		};
		window.addEventListener('bazar:asset-operation-finished', refreshFinishedOperation);
		return () => window.removeEventListener('bazar:asset-operation-finished', refreshFinishedOperation);
	}, [assetId, refreshAsset]);
	React.useEffect(() => {
		if (!wallet.address) return;
		const walletAddress = wallet.address;
		const claimKey = operationClaimStorageKey(assetId, walletAddress);
		const recoveryKeys = [
			operationStorageKey(assetId, walletAddress),
			atomicPurchaseStorageKey(assetId, walletAddress),
		];
		const onStorage = (event: StorageEvent) => {
			if (event.storageArea && event.storageArea !== localStorage) return;
			const change = walletOperationStorageChange(event.key, event.newValue, claimKey, recoveryKeys);
			if (change === 'ignore') return;
			setRecoverySuppressed(false);
			if (change === 'claim-acquired' || change === 'claim-released') {
				if (change === 'claim-acquired' && operation && operationActivityEntry) {
					const recovering =
						operation.kind === 'buy' ? Boolean(operation.resume) : Boolean(operation.resumeId);
					if (!recovering) removeOperationActivity(operationActivityEntry.id);
				}
				setStorageVersion((version) => version + 1);
				return;
			}
			if (change === 'recovery-updated') {
				if (operation && operationActivityEntry) {
					const recovering =
						operation.kind === 'buy' ? Boolean(operation.resume) : Boolean(operation.resumeId);
					if (!recovering) removeOperationActivity(operationActivityEntry.id);
				}
			} else {
				if (operationActivityEntry) removeOperationActivity(operationActivityEntry.id);
				void refreshAsset();
			}
			setStorageVersion((version) => version + 1);
		};
		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	}, [assetId, operation, operationActivityEntry, refreshAsset, removeOperationActivity, wallet.address]);
	React.useEffect(() => {
		if (isVisibleAssetId(assetId)) void prioritizeAssetStatePrefetch(assetId);
		void load();
		return () => {
			requestRef.current?.abort();
		};
	}, [load]);
	React.useEffect(() => {
		if (!wallet.address || !state) return;
		const currentOrder = liveOrder(state);
		if (currentOrder?.status === 'reserved' && currentOrder.buyer === wallet.address) {
			setActivityRequested(true);
		}
	}, [state, wallet.address]);
	React.useEffect(() => {
		const refreshVisibleState = () => {
			if (document.visibilityState === 'visible') void load();
		};
		document.addEventListener('visibilitychange', refreshVisibleState);
		return () => document.removeEventListener('visibilitychange', refreshVisibleState);
	}, [load]);
	React.useEffect(() => {
		const controller = new AbortController();
		if (activityAssetRef.current !== assetId) {
			activityLoadMoreRef.current?.abort();
			activityAssetRef.current = assetId;
			try {
				setAssetActivity(loadMarketActivity(window.localStorage, `asset:${assetId}`));
			} catch {
				setAssetActivity([]);
			}
			setActivityCursor(null);
			setActivityHasNextPage(false);
			setActivityTotalCount(null);
			setActivityLoadingMore(false);
		}
		setActivityError(null);
		if (!resolvedAsset || !activityRequested) {
			setActivityLoading(false);
			return () => controller.abort();
		}
		setActivityLoading(true);
		void discoverCollectionActivityPage({ recipients: [assetId], signal: controller.signal, pageSize: 24 })
			.then(
				(page) => {
					if (!controller.signal.aborted) {
						setAssetActivity(page.events);
						setActivityCursor(page.cursor);
						setActivityHasNextPage(page.hasNextPage);
						setActivityTotalCount(page.totalCount);
						try {
							saveMarketActivity(window.localStorage, `asset:${assetId}`, page.events);
						} catch {
							// The live result remains available when storage is unavailable.
						}
					}
				},
				(cause) => {
					if (!controller.signal.aborted) {
						setActivityError(marketplaceRequestFailureMessage('index', marketplaceFailureKind(cause)));
					}
				}
			)
			.finally(() => {
				if (!controller.signal.aborted) setActivityLoading(false);
			});
		return () => controller.abort();
	}, [activityRequested, activityRetry, assetId, resolvedAsset?.id]);
	React.useEffect(() => {
		const controller = new AbortController();
		if (askAssetRef.current !== assetId) {
			askLoadMoreRef.current?.abort();
			askAssetRef.current = assetId;
			setAssetAskActivity([]);
			setAskCursor(null);
			setAskHasNextPage(false);
			setAskLoadingMore(false);
		}
		setAskError(null);
		if (!resolvedAsset || !activityRequested) {
			setAskLoading(false);
			return () => controller.abort();
		}
		setAskLoading(true);
		void discoverCollectionActivityPage({
			actions: ['make-offer', 'register-interest'],
			pageSize: 100,
			recipients: [assetId],
			signal: controller.signal,
		})
			.then(
				async (page) => {
					if (controller.signal.aborted) return;
					setAssetAskActivity(page.events);
					setAskCursor(page.cursor);
					setAskHasNextPage(page.hasNextPage);
					try {
						const confirmed = await confirmPurchaseActivity(page.events, {
							signal: controller.signal,
							verificationTimeoutMs: 15_000,
							readCurrent: (processId, readSignal) =>
								readAssetStateCached(processId, { signal: readSignal, maxAttempts: 1 }),
						});
						if (!controller.signal.aborted && askAssetRef.current === assetId) {
							setAssetAskActivity(confirmed);
						}
					} catch (cause) {
						if (!controller.signal.aborted) {
							setAskError(marketplaceRequestFailureMessage('index', marketplaceFailureKind(cause)));
						}
					}
				},
				(cause) => {
					if (!controller.signal.aborted) {
						setAskError(marketplaceRequestFailureMessage('index', marketplaceFailureKind(cause)));
					}
				}
			)
			.finally(() => {
				if (!controller.signal.aborted) setAskLoading(false);
			});
		return () => controller.abort();
	}, [activityRequested, askRetry, assetId, resolvedAsset?.id]);
	const loadOlderAssetActivity = React.useCallback(async () => {
		if (!activityCursor || !activityHasNextPage || activityLoadingMore) return;
		activityLoadMoreRef.current?.abort();
		const controller = new AbortController();
		activityLoadMoreRef.current = controller;
		setActivityLoadingMore(true);
		setActivityError(null);
		try {
			const page = await discoverCollectionActivityPage({
				cursor: activityCursor,
				pageSize: 100,
				recipients: [assetId],
				signal: controller.signal,
			});
			if (controller.signal.aborted || activityAssetRef.current !== assetId) return;
			setAssetActivity((current) => mergeAssetActivityPages(current, page.events));
			setActivityCursor(page.cursor);
			setActivityHasNextPage(page.hasNextPage);
		} catch (cause) {
			if (!controller.signal.aborted) {
				setActivityError(marketplaceRequestFailureMessage('index', marketplaceFailureKind(cause)));
			}
		} finally {
			if (!controller.signal.aborted) setActivityLoadingMore(false);
		}
	}, [activityCursor, activityHasNextPage, activityLoadingMore, assetId]);
	const loadOlderAssetAsks = React.useCallback(async () => {
		if (!askCursor || !askHasNextPage || askLoadingMore) return;
		askLoadMoreRef.current?.abort();
		const controller = new AbortController();
		askLoadMoreRef.current = controller;
		setAskLoadingMore(true);
		setAskError(null);
		try {
			const page = await discoverCollectionActivityPage({
				actions: ['make-offer', 'register-interest'],
				cursor: askCursor,
				pageSize: 100,
				recipients: [assetId],
				signal: controller.signal,
			});
			if (controller.signal.aborted || askAssetRef.current !== assetId) return;
			setAssetAskActivity((current) => mergeAssetActivityPages(current, page.events));
			setAskCursor(page.cursor);
			setAskHasNextPage(page.hasNextPage);
			const confirmed = await confirmPurchaseActivity(page.events, {
				signal: controller.signal,
				verificationTimeoutMs: 15_000,
				readCurrent: (processId, readSignal) =>
					readAssetStateCached(processId, { signal: readSignal, maxAttempts: 1 }),
			});
			if (controller.signal.aborted || askAssetRef.current !== assetId) return;
			setAssetAskActivity((current) => mergeAssetActivityPages(current, confirmed));
		} catch (cause) {
			if (!controller.signal.aborted) {
				setAskError(marketplaceRequestFailureMessage('index', marketplaceFailureKind(cause)));
			}
		} finally {
			if (!controller.signal.aborted) setAskLoadingMore(false);
		}
	}, [askCursor, askHasNextPage, askLoadingMore, assetId]);
	React.useEffect(() => {
		setActiveSection('about');
		setActivityRequested(false);
	}, [assetId]);
	React.useEffect(() => {
		setRecoverySuppressed(false);
		setRecoveryNotice('');
		setUnavailableRecovery(null);
	}, [assetId, wallet.address]);
	React.useLayoutEffect(() => {
		if (recoverySuppressed) resumeButtonRef.current?.focus();
	}, [recoverySuppressed]);
	React.useEffect(() => {
		if (!wallet.address || operation || recoverySuppressed || !state) return;
		if (state.totalSupply !== '1' || state.denomination > 0) return;
		const walletAddress = wallet.address;
		const activeClaimKey = operationClaimStorageKey(assetId, walletAddress);
		if (localStorage.getItem(activeClaimKey)) {
			const controller = new AbortController();
			void clearStaleWalletOperationClaim(localStorage, activeClaimKey, { signal: controller.signal })
				.then((cleared) => {
					if (!controller.signal.aborted && cleared) setStorageVersion((version) => version + 1);
				})
				.catch(() => undefined);
			return () => controller.abort();
		}
		const controller = new AbortController();
		void (async () => {
			if (controller.signal.aborted) return;
			const purchaseKey = atomicPurchaseStorageKey(assetId, walletAddress);
			const pendingOperationKey = operationStorageKey(assetId, walletAddress);
			let saved: any = null;
			try {
				saved = loadWalletRecord<any>(
					localStorage,
					purchaseKey,
					`bazar-purchase:${assetId}`,
					(record) => record?.buyer === walletAddress
				);
			} catch {
				removeWalletRecord(localStorage, purchaseKey);
			}
			if (saved?.buyer === walletAddress && saved?.order && !hasRecoverablePurchase(saved.snapshot)) {
				removeWalletRecordIf<any>(
					localStorage,
					purchaseKey,
					(record) =>
						record?.buyer === walletAddress &&
						record?.order?.orderId === saved.order.orderId &&
						!hasRecoverablePurchase(record?.snapshot)
				);
				saved = null;
			}
			if (saved?.buyer === walletAddress && saved?.order) {
				const recoveryStatus = atomicPurchaseRecoveryStatus(state, walletAddress, saved.order, saved.snapshot);
				if (recoveryStatus === 'resumable') {
					const gatewayNotice = purchaseGatewaySwitchNotice(
						saved.gateway,
						currentPurchaseGatewayContext(),
						saved.snapshot
					);
					if (gatewayNotice) setRecoveryNotice(gatewayNotice);
					openOperation({ kind: 'buy', order: saved.order, resume: saved.snapshot }, { show: false });
					return;
				}
				setRecoveryNotice(
					'A previous purchase is paused because its order is no longer available to this wallet. Its signed transaction details remain saved in this browser, and no replacement payment will be created.'
				);
			}

			let savedOperation: any = null;
			try {
				savedOperation = loadWalletRecord<any>(
					localStorage,
					pendingOperationKey,
					`bazar-operation:${assetId}`,
					(record) =>
						record?.signer === walletAddress &&
						isArweaveId(record?.txId ?? '') &&
						['sell', 'cancel', 'transfer'].includes(record?.kind)
				);
			} catch {
				removeWalletRecord(localStorage, pendingOperationKey);
			}

			const order = liveOrder(state);
			const mayHaveRegistration = Boolean(
				order && order.creator !== walletAddress && hasStoredSignedTransaction(localStorage)
			);
			if (!savedOperation && !mayHaveRegistration) {
				setUnavailableRecovery((current) => (current?.key === pendingOperationKey ? null : current));
				return;
			}

			const { AssetTransactionClient } = await loadAtomicTransactionRuntime();
			if (controller.signal.aborted) return;
			const client = new AssetTransactionClient();
			if (mayHaveRegistration && order) {
				const registrationId = client.findStoredRegistration(assetId, order.orderId, walletAddress);
				if (registrationId) {
					openOperation(
						{
							kind: 'buy',
							order,
							resume: { registration: { id: registrationId, dispatched: false } },
						},
						{ show: false }
					);
					return;
				}
			}
			if (!savedOperation) return;

			try {
				client.restore(savedOperation.txId, walletAddress);
			} catch {
				const canStillApply = operationRecoveryCanStillApply(state, walletAddress, savedOperation, 'atomic');
				const matches = (record: any) =>
					record?.assetId === assetId &&
					record?.signer === walletAddress &&
					record?.txId === savedOperation.txId;
				if (!canStillApply) {
					if (
						removeWalletRecoveryAndSignatures(
							localStorage,
							pendingOperationKey,
							matches,
							[savedOperation.txId],
							walletAddress
						)
					) {
						setUnavailableRecovery(null);
						setRecoveryNotice(
							'A stale local action was removed after current live state proved that it can no longer apply. No replacement transaction was created.'
						);
					}
				} else {
					setUnavailableRecovery({
						key: pendingOperationKey,
						kind: savedOperation.kind,
						signer: walletAddress,
						txId: savedOperation.txId,
					});
				}
				return;
			}
			setUnavailableRecovery(null);
			if (savedOperation.kind === 'cancel' && savedOperation.order) {
				openOperation(
					{
						kind: 'cancel',
						order: savedOperation.order,
						startingSlot: savedOperation.startingSlot,
						resumeId: savedOperation.txId,
					},
					{ show: false }
				);
			} else {
				openOperation(
					{
						kind: savedOperation.kind,
						resumeId: savedOperation.txId,
						startingSlot: savedOperation.startingSlot,
						value: savedOperation.value,
					},
					{ show: false }
				);
			}
		})().catch(() => undefined);
		return () => controller.abort();
	}, [assetId, openOperation, operation, recoverySuppressed, state, storageVersion, wallet.address]);
	const uniquePricePoints = React.useMemo(() => uniquePriceHistory(assetAskActivity), [assetAskActivity]);
	const recoveryUrl = assetStateRecoveryUrl(error, window.location);
	const stateRecoveryAction = recoveryUrl
		? {
				label: 'Use Bazar peers',
				onClick: () => window.location.assign(recoveryUrl),
		  }
		: undefined;
	if (!collection && (market.loading || (directAtomicRoute && loading))) {
		return (
			<AssetDetailLoadingShell
				asset={shellAsset}
				collectionId={collectionId}
				error={detailError}
				onRetry={load}
				secondaryAction={detailError ? stateRecoveryAction : undefined}
			/>
		);
	}
	if (!collection && market.error)
		return (
			<RouteState title="Asset unavailable">
				<ErrorPanel message={market.error} onRetry={market.retry} />
			</RouteState>
		);
	if (!collection && directAtomicRoute && error)
		return (
			<RouteState title="Asset unavailable">
				<ErrorPanel message={detailError ?? error} onRetry={load} secondaryAction={stateRecoveryAction} />
			</RouteState>
		);
	if (!collection)
		return (
			<RouteState title="Collection not found">
				<ErrorPanel message="This collection could not be found on Arweave." />
			</RouteState>
		);
	if (!membershipVerified)
		return (
			<AssetDetailLoadingShell
				asset={shellAsset}
				collection={collection}
				collectionId={collectionId}
				error={
					market.loading
						? detailError
						: market.notice ?? 'Current collection membership could not be verified.'
				}
				onRetry={market.loading ? load : market.retry}
				secondaryAction={market.loading && detailError ? stateRecoveryAction : undefined}
			/>
		);
	const asset = verifiedAsset;
	if (!asset && error)
		return (
			<RouteState title="Asset unavailable" backTo={`/collection/${collection.id}`} backLabel={collection.name}>
				<ErrorPanel message={detailError ?? error} onRetry={load} secondaryAction={stateRecoveryAction} />
			</RouteState>
		);
	if (!asset && !loading)
		return (
			<RouteState title="Asset not found" backTo={`/collection/${collection.id}`} backLabel={collection.name}>
				<ErrorPanel message="This asset is not in the selected collection." />
			</RouteState>
		);
	if (!asset)
		return (
			<AssetDetailLoadingShell
				asset={shellAsset}
				collection={collection}
				collectionId={collectionId}
				onRetry={load}
			/>
		);
	if (!state) {
		return (
			<AssetDetailLoadingShell
				asset={asset}
				collection={collection}
				collectionId={collectionId}
				error={detailError}
				onRetry={load}
				secondaryAction={stateRecoveryAction}
			/>
		);
	}
	if (state && (state.totalSupply !== '1' || state.denomination > 0)) {
		return (
			<React.Suspense
				fallback={<AssetDetailLoadingShell asset={asset} collection={collection} collectionId={collectionId} />}
			>
				<FungibleAssetView
					asset={asset}
					collection={collection}
					collectionIndexNotice={
						<CollectionIndexNotice
							collection={collection}
							checking={market.loading}
							directlyVerified={!indexedAsset}
							onRetry={market.retry}
						/>
					}
					state={state}
					activity={assetActivity}
					activityHasNextPage={activityHasNextPage}
					activityLoading={activityLoading}
					activityLoadingMore={activityLoadingMore}
					activityTotalCount={activityTotalCount}
					activityError={activityError}
					askActivity={assetAskActivity}
					askError={askError}
					askHasNextPage={askHasNextPage}
					askLoading={askLoading}
					askLoadingMore={askLoadingMore}
					onActivityLoadMore={() => void loadOlderAssetActivity()}
					onActivityRetry={() => setActivityRetry((value) => value + 1)}
					onActivityVisible={() => setActivityRequested(true)}
					onAskLoadMore={() => void loadOlderAssetAsks()}
					onAskRetry={() => setAskRetry((value) => value + 1)}
					loading={loading}
					error={error}
					provider={provider}
					verifiedAt={verifiedAt}
					onRefresh={refreshAsset}
					stateRecoveryAction={stateRecoveryAction}
				/>
			</React.Suspense>
		);
	}
	const owner = state ? ownerOfAsset(state) : null;
	const order = state ? liveOrder(state) : null;
	const balanceStateAvailable = state ? assetBalanceStateAvailable(state) : false;
	const mine = Boolean(wallet.address && owner === wallet.address);
	const externalReservation = externalReservationTransaction(order, wallet.address, assetActivity);
	const recoveryBlocksActions = recoverySuppressed || Boolean(unavailableRecovery);
	const operationBlocksActions = recoveryBlocksActions || Boolean(operationActivityEntry);
	const newOperationBlocksActions = operationBlocksActions || !balanceStateAvailable || loading || Boolean(error);
	const operationIsBusy = Boolean(operationActivityEntry && operationActivityEntry.phase !== 'error');
	const license = state ? licenseProperties(state) : [];
	const description = assetDescription(state, collection.description);
	const moreAssets = collectionMoreAssets(collection.assets, asset.id);
	type AtomicAssetSection = typeof activeSection;
	const assetTabs: AssetDetailTab<AtomicAssetSection>[] = [
		{
			value: 'about',
			label: 'About',
			icon: <Icon icon={Info} />,
			panelId: 'asset-about',
		},
		{
			value: 'orders',
			label: 'Orders',
			icon: <Icon icon={Layers3} />,
			panelId: 'asset-orders',
		},
		{
			value: 'activity',
			label: 'Activity',
			icon: <Icon icon={BarChart3} />,
			panelId: 'asset-activity',
		},
		{
			value: 'rights',
			label: 'Usage rights',
			icon: <Icon icon={FileText} />,
			panelId: 'asset-rights',
		},
		{
			value: 'blockchain',
			label: 'Blockchain',
			icon: <Icon icon={Grid2X2} />,
			panelId: 'asset-blockchain',
		},
		{
			value: 'more',
			label: 'More',
			icon: <Icon icon={Images} />,
			panelId: 'asset-more',
		},
	];
	return (
		<section className="asset-page asset-detail-page atomic-asset-page">
			{recoverySuppressed ? (
				<PausedRecoveryNotice onResume={() => setRecoverySuppressed(false)} resumeButtonRef={resumeButtonRef} />
			) : null}
			{recoveryNotice ? (
				<StatusNotice onDismiss={() => setRecoveryNotice('')}>{recoveryNotice}</StatusNotice>
			) : null}
			{unavailableRecovery ? (
				<UnavailableOperationRecoveryNotice
					recovery={unavailableRecovery}
					stateNoun="ownership and orders above"
					onRefresh={() => void refreshAsset()}
					onDiscard={() => {
						const removed = removeWalletRecoveryAndSignatures<any>(
							localStorage,
							unavailableRecovery.key,
							(record) =>
								record?.signer === unavailableRecovery.signer &&
								record?.txId === unavailableRecovery.txId,
							[unavailableRecovery.txId],
							unavailableRecovery.signer
						);
						if (removed) {
							setUnavailableRecovery(null);
							setRecoveryNotice(
								'Local tracking was discarded. Current ownership and orders above remain the live source of truth.'
							);
						}
					}}
				/>
			) : null}
			<div className="asset-detail-layout">
				<div className="asset-commerce-column asset-commerce-primary">
					<div className="asset-details asset-identity">
						<div className="asset-kicker">
							{indexedCollection ? (
								<Link className="asset-collection-link" to={`/collection/${collection.id}`}>
									{collection.name}
								</Link>
							) : (
								<span className="asset-collection-link">{collection.name}</span>
							)}
						</div>
						<h1 ref={operationFocusFallbackRef} tabIndex={-1}>
							{asset.name}
						</h1>
						<div className="asset-owner-line">
							<span>{loading || error ? 'Last known owner' : 'Owned by'}</span>
							{owner ? (
								<WalletAddress address={owner} label="owner" />
							) : (
								<strong>
									{state
										? balanceStateAvailable
											? 'Unassigned'
											: 'Ownership unavailable'
										: 'State unavailable'}
								</strong>
							)}
						</div>
						<div className="asset-token-tags" aria-label="Asset protocol details">
							<span>{state?.device || 'token@1.0'}</span>
							<span>Arweave</span>
							<span>Supply 1</span>
						</div>
						<StateVerification
							provider={provider}
							verifiedAt={verifiedAt}
							refreshing={loading}
							failed={Boolean(error)}
						/>
						{loading ? <Loading label="Computing current state…" /> : null}
						{error ? (
							<ErrorPanel message={error} onRetry={load} secondaryAction={stateRecoveryAction} />
						) : null}
						{state ? (
							<section aria-busy={operationIsBusy} className="asset-commerce-card">
								<AssetBalanceStateNotice state={state} />
								<div className="asset-market-stats">
									<div>
										<span>Current ask</span>
										<strong>
											{order ? (
												<ArCurrencyText>{`${winstonToAr(order.asking)} AR`}</ArCurrencyText>
											) : (
												'Not listed'
											)}
										</strong>
									</div>
									<div>
										<span>Supply</span>
										<strong>1 / 1</strong>
									</div>
									<div>
										<span>Order status</span>
										<strong>{order ? order.status : 'None'}</strong>
									</div>
									<div>
										<span>License terms</span>
										<strong>{license.length || 'None'}</strong>
									</div>
								</div>
								<div className="asset-buy-summary">
									<span>
										{order?.status === 'reserved'
											? 'Reserved at'
											: order
											? 'Buy for'
											: 'Market status'}
									</span>
									<strong>
										{order ? (
											<ArCurrencyText>{`${winstonToAr(order.asking)} AR`}</ArCurrencyText>
										) : (
											'Not listed'
										)}
									</strong>
								</div>
								{operationActivityEntry ? (
									<AssetOperationStatus
										kind={operationActivityEntry.operation.kind}
										phase={operationActivityEntry.phase}
										status={operationActivityEntry.status}
										onView={() => showOperationActivity(operationActivityEntry.id)}
									/>
								) : null}
								{externalReservation && !operationActivityEntry ? (
									<div className="external-reservation-notice" role="status">
										<div>
											<strong>Your reservation is ready</strong>
											<p>
												Close the other Bazar tab, then continue here with one seller-payment
												approval.
											</p>
										</div>
										<Button
											disabled={operationBlocksActions || loading || Boolean(error)}
											size="custom"
											variant="primary"
											onClick={() =>
												openOperation({
													kind: 'buy',
													order: order!,
													resume: {
														registration: { id: externalReservation.id, dispatched: true },
													},
													externalOrigin: true,
												})
											}
											type="button"
										>
											Continue purchase
										</Button>
									</div>
								) : null}
								<div className="asset-commerce-actions">
									{!wallet.address ? <ConnectWalletButton /> : null}
									{wallet.address && atomicOrderCanBeBought(order) && !mine ? (
										<Button
											className="with-icon asset-buy-now market-primary-action"
											disabled={newOperationBlocksActions}
											size="custom"
											variant="primary"
											onClick={() => openOperation({ kind: 'buy', order })}
										>
											<Icon icon={ShoppingCart} size="sm" />{' '}
											{operation?.kind === 'buy'
												? assetOperationPendingActionLabel('buy')
												: 'Buy now'}
										</Button>
									) : null}
									{wallet.address && mine && !order ? (
										<Button
											className="with-icon asset-buy-now market-primary-action"
											disabled={newOperationBlocksActions}
											size="custom"
											variant="primary"
											onClick={() => openOperation({ kind: 'sell' })}
										>
											<Icon icon={Tag} size="sm" />{' '}
											{operation?.kind === 'sell'
												? assetOperationPendingActionLabel('sell')
												: 'List for sale'}
										</Button>
									) : null}
									{wallet.address && mine && order?.status === 'open' ? (
										<Button
											className="with-icon"
											disabled={newOperationBlocksActions}
											size="custom"
											onClick={() => openOperation({ kind: 'cancel', order })}
											variant="danger"
										>
											<Icon icon={CircleX} size="sm" />{' '}
											{operation?.kind === 'cancel'
												? assetOperationPendingActionLabel('cancel')
												: 'Cancel listing'}
										</Button>
									) : null}
									{wallet.address && mine && !order ? (
										<Button
											className="with-icon"
											disabled={newOperationBlocksActions}
											size="custom"
											onClick={() => openOperation({ kind: 'transfer' })}
										>
											<Icon icon={Send} size="sm" />{' '}
											{operation?.kind === 'transfer'
												? assetOperationPendingActionLabel('transfer')
												: 'Transfer'}
										</Button>
									) : null}
									{wallet.address && mine && asset.image ? (
										<SetProfilePictureButton
											assetId={asset.id}
											disabled={operationBlocksActions || loading || Boolean(error)}
											image={asset.image}
											owner={wallet.address}
										/>
									) : null}
								</div>
							</section>
						) : null}
					</div>
				</div>
				<div className="asset-visual-column">
					<div
						className={`asset-hero-media${
							isAudioContentType(asset.contentType) ? ' audio-hero-media' : ''
						}${isHtmlContentType(asset.contentType) ? ' interactive-hero-media' : ''}`}
					>
						{isHtmlContentType(asset.contentType) && asset.media ? (
							<InteractiveHtmlArtwork name={asset.name} src={asset.media} />
						) : isAudioContentType(asset.contentType) ? (
							<div className="asset-audio-player">
								{asset.image ? (
									<ArtworkImage
										src={asset.image}
										alt={`${asset.name} album artwork`}
										fetchPriority="high"
										loading="eager"
									/>
								) : (
									<AudioArtwork contentType={asset.contentType} name={asset.name} />
								)}
								{asset.media ? <AudioWaveformPlayer name={asset.name} src={asset.media} /> : null}
							</div>
						) : asset.image ? (
							<ArtworkImage src={asset.image} alt={asset.name} fetchPriority="high" loading="eager" />
						) : collection.kind === 'names' ? (
							<NameArtwork name={asset.name} />
						) : (
							<span>{asset.name.slice(0, 1)}</span>
						)}
						{collection.kind !== 'names' ? (
							<div className="asset-media-label">
								<span>Permanent asset</span>
								<strong>
									{asset.contentType ?? (asset.image ? 'image' : state?.device ?? 'process')}
								</strong>
							</div>
						) : null}
					</div>
				</div>
				<div className="asset-commerce-column asset-commerce-secondary">
					<CollectionIndexNotice collection={collection} checking={market.loading} onRetry={market.retry} />
					<AssetDetailTabs<AtomicAssetSection>
						active={activeSection}
						ariaLabel="Asset detail sections"
						idPrefix="asset"
						onChange={(section) => {
							setActiveSection(section);
							if (section === 'orders' || section === 'activity') setActivityRequested(true);
						}}
						tabs={assetTabs}
					/>
					{activeSection === 'about' ? (
						<section
							aria-labelledby="asset-about-tab"
							className="asset-tab-panel"
							id="asset-about"
							role="tabpanel"
							tabIndex={0}
						>
							<p className="asset-description">{description}</p>
							<div className="asset-detail-facts">
								<div>
									<span>Owner</span>
									{owner ? (
										<WalletAddress address={owner} label="owner" />
									) : (
										<strong>
											{state
												? balanceStateAvailable
													? 'Unassigned'
													: 'Ownership unavailable'
												: 'State unavailable'}
										</strong>
									)}
								</div>
								<div>
									<span>Collection</span>
									<strong>{collection.name}</strong>
								</div>
								<div>
									<span>Asset type</span>
									<strong>{asset.contentType ?? state?.device ?? 'process'}</strong>
								</div>
								<div>
									<span>Supply</span>
									<strong>1</strong>
								</div>
								{asset.artist ? (
									<div>
										<span>Artist</span>
										<strong>{asset.artist}</strong>
									</div>
								) : null}
								{asset.album ? (
									<div>
										<span>Album</span>
										<strong>{asset.album}</strong>
									</div>
								) : null}
								{asset.duration ? (
									<div>
										<span>Duration</span>
										<strong>{formatAudioDuration(asset.duration)}</strong>
									</div>
								) : null}
							</div>
						</section>
					) : null}
					{activeSection === 'orders' ? (
						<section
							aria-labelledby="asset-orders-tab"
							className="asset-tab-panel atomic-market-panel"
							id="asset-orders"
							role="tabpanel"
							tabIndex={0}
						>
							<React.Suspense fallback={<Loading label="Preparing ask history…" />}>
								<UniquePriceChart
									error={askError}
									floorValue={
										order ? unitPriceWinston(order, state?.denomination ?? 0).toString() : null
									}
									formatValue={(value) => `${winstonToAr(value)} AR`}
									hasNextPage={askHasNextPage}
									loading={askLoading}
									loadingMore={askLoadingMore}
									onLoadMore={() => void loadOlderAssetAsks()}
									onRetry={() => setAskRetry((value) => value + 1)}
									points={uniquePricePoints}
									ticker={asset.name}
								/>
							</React.Suspense>
							<div aria-label={`${asset.name} order book`} className="orderbook-table" role="table">
								<div className="orderbook-head" role="row">
									<span role="columnheader">Price</span>
									<span role="columnheader">Quantity</span>
									<span role="columnheader">Seller</span>
									<span role="columnheader">Status</span>
								</div>
								{order ? (
									<div className="orderbook-row" role="row">
										<strong data-label="Price" role="cell">
											{winstonToAr(order.asking)} <ArCurrencyLabel />
										</strong>
										<span data-label="Quantity" role="cell">
											{order.quantity}
										</span>
										<span data-label="Seller" role="cell">
											<WalletAddress address={order.creator} label="seller" />
										</span>
										<span
											className={`order-status ${order.status}`}
											data-label="Status"
											role="cell"
										>
											{order.status}
										</span>
									</div>
								) : (
									<div className="orderbook-empty" role="row">
										<div aria-colspan={4} className="orderbook-empty-cell" role="cell">
											<strong>No open asks</strong>
											<span>This asset is not currently listed.</span>
										</div>
									</div>
								)}
							</div>
							<p className="market-note">
								Computed from the last loaded asset process state through the selected AO transport.
							</p>
						</section>
					) : null}
					{activeSection === 'activity' ? (
						<section
							aria-labelledby="asset-activity-tab"
							className="asset-tab-panel asset-activity-panel"
							id="asset-activity"
							role="tabpanel"
							tabIndex={0}
						>
							{order ? (
								<div className="asset-history-current">
									<span>Current ask</span>
									<strong>
										{winstonToAr(order.asking)} <ArCurrencyLabel />
									</strong>
								</div>
							) : null}
							{activityLoading ? (
								<Loading
									label={
										assetActivity.length
											? 'Refreshing market history…'
											: 'Reading indexed market history…'
									}
								/>
							) : null}
							{activityError ? (
								<RetryNotice onRetry={() => setActivityRetry((value) => value + 1)}>
									Compute hasn’t completed yet. Please try again.{' '}
									{assetActivity.length ? 'Previously loaded events remain visible.' : ''}
								</RetryNotice>
							) : null}
							{assetActivity.length ? (
								<DeferredMarketActivityList
									ariaLabel={`${asset.name} market activity`}
									collectionId={collection.id}
									events={assetActivity}
									loading={activityLoading || activityLoadingMore}
									reservationState={state}
									resolveAsset={() => asset}
								/>
							) : null}
							{!activityLoading && !activityError && !assetActivity.length ? (
								<p className="asset-empty-copy">No indexed market events found.</p>
							) : null}
							<div className="asset-market-activity-footer">
								<p className="market-note">
									{activityTotalCount === null
										? `${assetActivity.length.toLocaleString()} indexed process submissions loaded.`
										: `${assetActivity.length.toLocaleString()} of ${activityTotalCount.toLocaleString()} indexed process submissions loaded.`}{' '}
									Live ownership and orders above remain authoritative.
								</p>
								{activityHasNextPage ? (
									<Button
										disabled={activityLoadingMore}
										onClick={() => void loadOlderAssetActivity()}
										size="custom"
										type="button"
									>
										{activityLoadingMore ? 'Loading older activity…' : 'Load older activity'}
									</Button>
								) : null}
							</div>
						</section>
					) : null}
					{activeSection === 'rights' ? (
						<section
							aria-labelledby="asset-rights-tab"
							className="asset-tab-panel"
							id="asset-rights"
							role="tabpanel"
							tabIndex={0}
						>
							{license.length ? (
								<dl className="license-properties">
									{license.map((property) => (
										<div key={property.key}>
											<dt>{property.label}</dt>
											<dd>{property.value}</dd>
										</div>
									))}
									<div className="license-proof">
										<dt>Proof</dt>
										<dd>
											<a href={transactionExplorerUrl(asset.id)} target="_blank" rel="noreferrer">
												View license proof on ViewBlock <Icon icon={ArrowUpRight} size="xs" />
											</a>
										</dd>
									</div>
								</dl>
							) : (
								<div className="license-empty">
									<span>
										<Icon icon={Diamond} />
									</span>
									<div>
										<strong>No UDL terms declared</strong>
										<p>This process does not publish Universal Data License properties.</p>
									</div>
								</div>
							)}
							<p className="market-note">
								Declared terms and effective UDL 0.2 defaults are derived from immutable process
								metadata.
							</p>
						</section>
					) : null}
					{activeSection === 'blockchain' ? (
						<section
							aria-labelledby="asset-blockchain-tab"
							className="asset-tab-panel"
							id="asset-blockchain"
							role="tabpanel"
							tabIndex={0}
						>
							<dl className="asset-blockchain-details">
								<div>
									<dt>Process ID</dt>
									<dd>
										<a href={transactionExplorerUrl(asset.id)} target="_blank" rel="noreferrer">
											{short(asset.id)} <Icon icon={ArrowUpRight} size="xs" />
										</a>
									</dd>
								</div>
								<div>
									<dt>Network</dt>
									<dd>Arweave</dd>
								</div>
								<div>
									<dt>Execution</dt>
									<dd>{state?.device || 'token@1.0'}</dd>
								</div>
								<div>
									<dt>Settlement</dt>
									<dd>
										<ArCurrencyLabel />
									</dd>
								</div>
								<div>
									<dt>Content type</dt>
									<dd>{asset.contentType ?? (asset.image ? 'image' : 'process')}</dd>
								</div>
							</dl>
						</section>
					) : null}
					{activeSection === 'more' ? (
						<section
							aria-labelledby="asset-more-tab"
							className="asset-tab-panel"
							id="asset-more"
							role="tabpanel"
							tabIndex={0}
						>
							<div className="asset-more-grid">
								{moreAssets.map((item) => (
									<Link
										key={item.id}
										to={`/asset/${collection.id}/${item.id}`}
										onFocus={() => prefetchAssetPage(item.id)}
										onMouseEnter={() => prefetchAssetPage(item.id)}
										onTouchStart={() => prefetchAssetPage(item.id)}
									>
										{item.image ? (
											<ArtworkImage src={item.image} alt="" />
										) : isAudioContentType(item.contentType) ? (
											<AudioArtwork contentType={item.contentType} name={item.name} />
										) : (
											<span>{item.name.slice(0, 1)}</span>
										)}
										<strong>{item.name}</strong>
									</Link>
								))}
							</div>
						</section>
					) : null}
				</div>
			</div>
		</section>
	);
}
