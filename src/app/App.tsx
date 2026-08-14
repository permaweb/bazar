import React from 'react';
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
	ArrowLeft,
	ArrowRight,
	ArrowUpRight,
	AtSign,
	BarChart3,
	Check,
	ChevronDown,
	ChevronRight,
	CircleX,
	Compass,
	Diamond,
	FileText,
	Grid2X2,
	History,
	Images,
	InfinityIcon,
	Info,
	Layers3,
	LayoutGrid,
	Library,
	LoaderCircle,
	RefreshCw,
	Search,
	Send,
	ShoppingCart,
	Tag,
	Upload,
	UserRound,
	X,
} from 'lucide-react';
import type {
	Consensus,
	ObserverView,
	PreparedTransaction,
	PurchaseSnapshot,
	PurchaseState,
	SwapPurchase,
} from 'weave-wrangler';

import { aoClient } from 'api/ao';
import { transactionExplorerUrl } from 'api/arweave-explorer';
import {
	type AssetCandidate,
	bazarAtomicAssetFromState,
	type CollectionActivityEvent,
	confirmPurchaseActivity,
	createAssetCandidateResolver,
	createWalletCandidateScan,
	discoverCollectionActivity,
	discoverCollectionActivityBatched,
	discoverMarketActivity,
	discoverMarketActivityBatched,
	discoverPendingAssetOffers,
	discoverWalletAssetCandidates,
	isLiveListing,
	loadBazarAtomicAssetById,
	partitionAssetCandidateSupport,
	type PendingAssetOffer,
	resolveAssetCandidates,
	type ResolvedAsset,
	searchBazarAtomicAssetsByName,
	verifyAssetCandidateSupport,
	walletAssetGroups,
	type WalletCandidateScan,
} from 'api/asset-discovery';
import {
	type AssetState,
	bestAskOfAsset,
	licenseProperties,
	liquidBalanceOf,
	listedBalanceOf,
	liveOrderOfAsset,
	liveOrdersOfAsset,
	normalizeServingNodeOrigins,
	openOrdersOfAsset,
	ownerOfAsset,
	readAssetState,
	servingNodeOrigin,
	servingNodeOrigins,
	type SwapOrder,
	waitForAssetState,
} from 'api/asset-marketplace';
import type { CollectionMintEstimate, CollectionMintPhase, MintUploadTransaction } from 'api/asset-mint';
import type { AssetObserverNetworkLease } from 'api/asset-observers';
import {
	cachedAssetState,
	DISPLAY_STATE_CACHE,
	invalidateAssetState,
	prefetchAssetState,
	prioritizeAssetStatePrefetch,
	readAssetStateCached,
} from 'api/asset-state-store';
import type { PurchaseCostEstimate } from 'api/asset-transactions';
import {
	type AssetSummary,
	type Collection,
	collectionAsset,
	enrichImageCollectionAssetMetadata,
	FUNGIBLE_TOKEN_COLLECTION_ID,
	hiddenCollectionAssetIndex,
	hiddenCollectionAssetIndexComplete,
	isVisibleAssetId,
	isVisibleCollectionId,
	loadCollections,
	loadMoreCarrierNames,
	loadMoreFungibleTokens,
	mergeCollectionSnapshots,
	replaceHiddenCollectionAssetIndex,
	withVisibleCollectionAssets,
} from 'api/collections';
import {
	advanceMintActivity,
	loadMintActivities,
	MINT_ACTIVITY_CHANGE_EVENT,
	type MintActivity,
	mintActivityNeedsAttention,
	removeMintActivities,
	removeMintActivity,
	upsertMintActivity,
} from 'api/mint-activity';
import {
	CREATED_COLLECTION_ID,
	CREATED_COLLECTION_NAME,
	createdCollection,
	loadMintedAssets,
	loadMintedCollections,
	type MintedAsset,
	type MintedCollection,
} from 'api/minted-assets';
import { formatTokenAmount } from 'api/order-matching';
import { ProfileClient } from 'api/profile';

import { ArCurrencyLabel, ArCurrencyText, formatArCurrencyText } from 'components/ArCurrencyLabel';
import { ArtworkImage } from 'components/ArtworkImage';
import type { ArweaveSyncStep } from 'components/ArweaveTransactionSync';
import { quorumConfirmationDepth } from 'components/ArweaveTransactionSync/confirmationDepth';
import { postConfirmationPendingLabel } from 'components/ArweaveTransactionSync/sequence';
import { type AssetDetailTab, AssetDetailTabs } from 'components/AssetDetailTabs';
import { assetOperationPendingActionLabel, AssetOperationStatus } from 'components/AssetOperationStatus';
import { AudioArtwork } from 'components/AudioArtwork';
import { BazarMark } from 'components/BazarMark';
import { Button } from 'components/Button';
import { ConnectWalletButton } from 'components/ConnectWalletButton';
import { ErrorPanel } from 'components/ErrorPanel';
import { Loading } from 'components/Loading';
import { MintTransactionReceipt } from 'components/MintTransactionReceipt';
import { NameArtwork } from 'components/NameArtwork';
import { NamesCubePreview } from 'components/NamesCubePreview';
import {
	OperationErrorAlert,
	OperationExternalLink,
	OperationOutcome,
	OperationOutcomeAnnouncement,
	OperationOutcomeSubject,
} from 'components/OperationOutcomeAnnouncement';
import { Pagination } from 'components/Pagination';
import { PortalIcon } from 'components/PortalIcon';
import { StateVerification } from 'components/StateVerification';
import { TokenArtwork } from 'components/TokenArtwork';
import { TokenAvatar } from 'components/TokenAvatar';
import { TokenMarketRow } from 'components/TokenMarketRow';
import { Tooltip } from 'components/Tooltip';
import {
	isTransactionActivityVisible,
	prepareTransactionDialogHide,
	TRANSACTION_DIALOG_HIDE_DURATION_MS,
	TransactionDialogControl,
	transactionDialogDismissAction,
} from 'components/TransactionDialogControl';
import {
	type UnavailableOperationRecovery,
	UnavailableOperationRecoveryNotice,
} from 'components/UnavailableOperationRecovery';
import { WalletAddress, WalletIdentity } from 'components/WalletAddress';
import { WalletMenu } from 'components/WalletMenu';
import { isAudioContentType } from 'helpers/asset-media';
import { formatAudioDuration } from 'helpers/audio-metadata';
import { mapConcurrent } from 'helpers/concurrency';
import {
	arweaveGatewayFromLocation,
	arweaveGraphqlEndpoint,
	gatewayFromLocation,
	gatewaysFromLocation,
} from 'helpers/config';
import { scheduleIdleTask } from 'helpers/idle';
import { optionalMotionBehavior } from 'helpers/motion';
import { assetGroupRevealComplete, retainedAssetGroupLimit } from 'helpers/progressive-assets';
import { formatTickerLabel } from 'helpers/token-display';
import { useProgressiveReveal } from 'hooks/useProgressiveReveal';
import { useWallet } from 'providers/WalletProvider';

import './styles.css';

import { loadMarketActivity, saveMarketActivity } from './market-activity-storage';
import {
	marketplaceCodedError,
	marketplaceErrorMessage as errorMessage,
	type MarketplaceFailureKind,
	marketplaceFailureKind,
	type MarketplaceOperationFailure,
	marketplaceOperationFailure,
	marketplaceRequestFailureMessage,
	type MarketplaceRequestSource,
} from './marketplace-error';
import {
	atomicOperationActivityId,
	atomicPurchaseRecoveryCanBeDiscarded,
	deriveFungibleOperationActivities,
	deriveOperationActivities,
	FUNGIBLE_OPERATION_ACTIVITY_CHANGE_EVENT,
	FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY,
	fungibleActivityHasRecovery,
	type FungibleOperationActivityChange,
	type FungibleOperationActivitySummary,
	fungiblePurchaseRecoveryCanBeDiscarded,
	operationRecoveryCanStillApply,
	reduceFungibleRuntimeActivities,
	saveFungibleOperationActivities,
	saveOperationActivities,
} from './operation-activity';
import {
	acquireWalletOperationClaim,
	atomicPurchaseStorageKey,
	clearStaleWalletOperationClaim,
	discardNewlyPreparedTransactionIfAborted,
	fungibleBatchStorageKey,
	hasRecoverablePurchase,
	isWalletOperationRecoveryKey,
	latestPurchaseSnapshot,
	loadWalletRecord,
	operationClaimStorageKey,
	operationStorageKey,
	promoteWalletOperationClaim,
	purchaseRecoveryApprovalCopy,
	purchaseRecoveryApprovalCount,
	releaseWalletOperationClaim,
	removeWalletRecord,
	removeWalletRecordIf,
	removeWalletRecoveryAndSignatures,
	repairRejectedPurchase,
	shouldAutomaticallyResumePurchase,
	storeWalletRecordIf,
	storeWalletRecordOrThrow,
	WALLET_OPERATION_RECOVERY_CHANGE_EVENT,
	type WalletOperationClaim,
	walletOperationStorageChange,
} from './operation-session';
import {
	continuePaymentConfirmations,
	PURCHASE_PAYMENT_TARGET,
	PURCHASE_REGISTRATION_TARGET,
	PURCHASE_SKIP_FROM_DEPTH,
	purchaseGatewaySwitchNotice,
	purchaseLifecycleStatus,
	purchaseSkipKind,
	withContinuingPaymentObservation,
} from './purchase-lifecycle';
import {
	purchaseObservationCheckingMessage,
	purchaseObservationPendingState,
	purchaseObservationResumeState,
	purchaseObservationRetryDelay,
	purchaseObservationRetryKind,
	purchaseObservationRetryMessage,
	waitForPurchaseObservationRetry,
} from './purchase-observation-retry';
import {
	loadArweaveTransactionSync,
	loadAssetObserverRuntime,
	loadAtomicTransactionRuntime,
	preloadArweaveTransactionSync,
	preloadAtomicTransactionRuntime,
} from './runtime';
import {
	type HomeListingShell,
	loadAssetShellSnapshot,
	loadHiddenCollectionAssetIndex,
	loadHomeListingSnapshot,
	loadMarketShellSnapshot,
	storeAssetShellSnapshot,
	storeHiddenCollectionAssetIndex,
	storeHomeListingSnapshot,
	storeMarketShellSnapshot,
} from './shell-snapshot';
import { useDialogFocus } from './useDialogFocus';

const FungibleAssetView = React.lazy(() => import('../routes/FungibleAssetRoute'));
const CreateView = React.lazy(() => import('../routes/CreateRoute'));
const DispatchView = React.lazy(() => import('../routes/DispatchRoute'));
const ProfileView = React.lazy(() => import('../routes/ProfileRoute'));
const DeferredAudioWaveformPlayer = React.lazy(async () => {
	const module = await import('components/AudioWaveformPlayer');
	return { default: module.AudioWaveformPlayer };
});
const DeferredMarketActivityList = React.lazy(async () => {
	const module = await import('components/MarketActivityList');
	return { default: module.MarketActivityList };
});
const ArweaveTransactionSync = React.lazy(async () => {
	const module = await loadArweaveTransactionSync();
	return { default: module.ArweaveTransactionSync };
});

function AudioWaveformPlayer(props: React.ComponentProps<typeof DeferredAudioWaveformPlayer>) {
	return (
		<React.Suspense fallback={<Loading label="Loading audio player…" />}>
			<DeferredAudioWaveformPlayer {...props} />
		</React.Suspense>
	);
}

function MarketActivityList(props: React.ComponentProps<typeof DeferredMarketActivityList>) {
	return (
		<React.Suspense fallback={<Loading label="Loading activity…" />}>
			<DeferredMarketActivityList {...props} />
		</React.Suspense>
	);
}

type MarketContextValue = {
	collections: Collection[];
	verifiedCollectionIds: ReadonlySet<string>;
	visibilityReady: boolean;
	loading: boolean;
	error: string | null;
	notice: string | null;
	pageRefreshing: boolean;
	loadMore(collectionId: string, signal?: AbortSignal): Promise<number>;
	addCreatedAsset(asset: MintedAsset): void;
	addCollection(collection: Collection): void;
	setPageRefreshing(refreshing: boolean): void;
	retry(): void;
};

function initialMarketCollections() {
	replaceHiddenCollectionAssetIndex(loadHiddenCollectionAssetIndex(window.localStorage));
	if (!hiddenCollectionAssetIndexComplete()) return [];
	return storedMarketCollections();
}

function storedMarketCollections() {
	const cached = loadMarketShellSnapshot(window.localStorage);
	const localCollections = loadMintedCollections();
	const mintedAssets = loadMintedAssets();
	const known = new Set(cached.map((collection) => collection.id));
	const localAdditions = localCollections.filter((collection) => !known.has(collection.id));
	for (const collection of localAdditions) known.add(collection.id);
	return marketCatalogueCollections([
		...cached,
		...localAdditions,
		...(mintedAssets.length && !known.has(CREATED_COLLECTION_ID) ? [createdCollection(mintedAssets)] : []),
	]);
}

export function marketCatalogueCollections(collections: Collection[]): Collection[] {
	return withoutDuplicatedCreatedAssets(
		collections.filter((collection) => isVisibleCollectionId(collection.id)).map(withVisibleCollectionAssets)
	);
}

export function withoutDuplicatedCreatedAssets(collections: Collection[]): Collection[] {
	const collectionAssetIds = new Set(
		collections
			.filter((collection) => collection.id !== CREATED_COLLECTION_ID)
			.flatMap((collection) => collection.assets.map((asset) => asset.id))
	);
	return collections.flatMap((collection) => {
		if (collection.id !== CREATED_COLLECTION_ID) return [collection];
		const assets = collection.assets.filter((asset) => !collectionAssetIds.has(asset.id));
		return assets.length ? [{ ...collection, assets, total: assets.length }] : [];
	});
}

export function verifiedCollectionIdsFrom(collections: Collection[]) {
	return collections
		.filter((collection) => collection.indexSource !== 'compiled-fallback')
		.map((collection) => collection.id);
}

export const MarketContext = React.createContext<MarketContextValue>({
	collections: [],
	verifiedCollectionIds: new Set(),
	visibilityReady: false,
	loading: true,
	error: null,
	notice: null,
	pageRefreshing: false,
	loadMore: async () => 0,
	addCreatedAsset: () => undefined,
	addCollection: () => undefined,
	setPageRefreshing: () => undefined,
	retry: () => undefined,
});

export function App() {
	const [marketRetry, setMarketRetry] = React.useState(0);
	const [pageRefreshing, setPageRefreshing] = React.useState(false);
	const [market, setMarket] = React.useState<MarketContextValue>(() => ({
		collections: initialMarketCollections(),
		verifiedCollectionIds: new Set(),
		visibilityReady: hiddenCollectionAssetIndexComplete(),
		loading: true,
		error: null,
		notice: null,
		pageRefreshing: false,
		loadMore: async () => 0,
		addCreatedAsset: () => undefined,
		addCollection: () => undefined,
		setPageRefreshing: () => undefined,
		retry: () => undefined,
	}));
	React.useEffect(() => {
		if (!market.collections.length) return;
		return scheduleIdleTask(() => storeMarketShellSnapshot(window.localStorage, market.collections), 750);
	}, [market.collections]);
	React.useEffect(() => {
		const controller = new AbortController();
		void aoClient(gatewaysFromLocation()).warm();
		setMarket((current) => ({ ...current, verifiedCollectionIds: new Set(), loading: true, error: null }));
		loadCollections(
			controller.signal,
			(collections) => {
				if (!controller.signal.aborted) {
					setMarket((current) => ({
						...current,
						collections: marketCatalogueCollections(
							mergeCollectionSnapshots(current.collections, collections)
						),
						verifiedCollectionIds: new Set([
							...current.verifiedCollectionIds,
							...verifiedCollectionIdsFrom(collections),
						]),
					}));
				}
			},
			() => {
				if (controller.signal.aborted) return;
				storeHiddenCollectionAssetIndex(window.localStorage, hiddenCollectionAssetIndex());
				setMarket((current) => ({
					...current,
					collections: current.collections.length ? current.collections : storedMarketCollections(),
					visibilityReady: true,
				}));
			}
		).then(
			({ collections, unavailable }) => {
				if (controller.signal.aborted) return;
				const mintedAssets = loadMintedAssets();
				const localCollections = loadMintedCollections();
				setMarket((current) => {
					const resolved = mergeCollectionSnapshots(current.collections, collections, true);
					const known = new Set(resolved.map((collection) => collection.id));
					return {
						...current,
						collections: marketCatalogueCollections([
							...resolved,
							...localCollections.filter((collection) => !known.has(collection.id)),
							...(mintedAssets.length && !known.has(CREATED_COLLECTION_ID)
								? [createdCollection(mintedAssets)]
								: []),
						]),
						verifiedCollectionIds: new Set([
							...current.verifiedCollectionIds,
							...verifiedCollectionIdsFrom(collections),
							...localCollections.map((collection) => collection.id),
						]),
						loading: false,
						error: null,
						notice: unavailable.length
							? `The latest Arweave references for ${unavailable.join(
									', '
							  )} could not be checked. Showing their bundled immutable indexes; ownership, listings, and prices are still read from live state.`
							: null,
					};
				});
			},
			(error) => {
				if (!controller.signal.aborted) {
					setMarket((current) =>
						current.collections.length
							? {
									...current,
									loading: false,
									error: null,
									notice: `Collection indexes could not be refreshed: ${errorMessage(
										error
									)}. Previously loaded collections remain available.`,
							  }
							: { ...current, loading: false, error: errorMessage(error), notice: null }
					);
				}
			}
		);
		return () => controller.abort();
	}, [marketRetry]);
	const loadMore = React.useCallback(
		async (collectionId: string, signal?: AbortSignal) => {
			const collection = market.collections.find((item) => item.id === collectionId);
			if (!collection) return 0;
			const updated =
				collection.kind === 'tokens'
					? await loadMoreFungibleTokens(collection, signal)
					: await loadMoreCarrierNames(collection, signal);
			const previous = new Set(collection.assets.map((asset) => asset.id));
			const added = updated.assets.filter((asset) => !previous.has(asset.id)).length;
			setMarket((current) => ({
				...current,
				collections: marketCatalogueCollections(
					current.collections.map((item) => {
						if (item.id !== collectionId) return item;
						const seen = new Set(item.assets.map((asset) => asset.id));
						const additions = updated.assets.filter((asset) => !seen.has(asset.id));
						return {
							...item,
							...updated,
							assets: [...item.assets, ...additions],
						};
					})
				),
			}));
			return added;
		},
		[market.collections]
	);
	const addCreatedAsset = React.useCallback((asset: MintedAsset) => {
		setMarket((current) => {
			const existing = current.collections.find((item) => item.id === CREATED_COLLECTION_ID);
			const assets = [asset, ...(existing?.assets ?? []).filter((item) => item.id !== asset.id)];
			const created = createdCollection(assets);
			return {
				...current,
				collections: marketCatalogueCollections(
					existing
						? current.collections.map((item) => (item.id === CREATED_COLLECTION_ID ? created : item))
						: [...current.collections, created]
				),
			};
		});
	}, []);
	const addCollection = React.useCallback((collection: Collection) => {
		setMarket((current) => ({
			...current,
			collections: marketCatalogueCollections([
				collection,
				...current.collections.filter((item) => item.id !== collection.id),
			]),
			verifiedCollectionIds: new Set([...current.verifiedCollectionIds, collection.id]),
		}));
	}, []);
	const retry = React.useCallback(() => setMarketRetry((current) => current + 1), []);
	const value = React.useMemo(
		() => ({ ...market, pageRefreshing, loadMore, addCreatedAsset, addCollection, setPageRefreshing, retry }),
		[addCollection, addCreatedAsset, loadMore, market, pageRefreshing, retry]
	);

	return (
		<MarketContext.Provider value={value}>
			<HashRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
				<OperationActivityProvider>
					<RouteFocus />
					<a
						className="skip-link"
						href="#main-content"
						onClick={(event) => {
							event.preventDefault();
							const main = document.getElementById('main-content');
							main?.focus();
							main?.scrollIntoView({ block: 'start' });
						}}
					>
						Skip to marketplace content
					</a>
					<Header />
					<main aria-label="Marketplace content" className="max-view-wrapper" id="main-content" tabIndex={-1}>
						<Routes>
							<Route path="/" element={<HomeRedirect />} />
							<Route path="/discover" element={<Home />} />
							<Route path="/collections" element={<Home />} />
							<Route path="/activity" element={<Home />} />
							<Route
								path="/create"
								element={
									<React.Suspense fallback={<Loading label="Loading creator…" />}>
										<CreateView />
									</React.Suspense>
								}
							/>
							<Route
								path="/dispatch/:processId"
								element={
									<React.Suspense fallback={<Loading label="Loading dispatch…" />}>
										<DispatchView />
									</React.Suspense>
								}
							/>
							<Route
								path="/profile/:address"
								element={
									<React.Suspense fallback={<Loading label="Loading profile…" />}>
										<ProfileView />
									</React.Suspense>
								}
							/>
							<Route path="/collection/:collectionId" element={<CollectionRoute />} />
							<Route path="/collection/:collectionId/activity" element={<CollectionActivityView />} />
							<Route path="/asset/:collectionId/:assetId/pending" element={<PendingAssetView />} />
							<Route path="/asset/:collectionId/:assetId" element={<AssetView />} />
							<Route path="*" element={<Navigate to="/" replace />} />
						</Routes>
					</main>
				</OperationActivityProvider>
			</HashRouter>
		</MarketContext.Provider>
	);
}

type OperationActivityPhase = 'form' | 'approval' | 'working' | 'done' | 'error';

type OperationActivity = {
	id: string;
	asset: AssetSummary;
	collectionId: string;
	owner: string;
	operation: Operation;
	phase: OperationActivityPhase;
	status: string;
	confirmations: number;
	confirmationTarget: number;
	createdAt: number;
	origin: 'runtime' | 'restored';
	restoreFallback(): HTMLElement | null;
};

export type UploadActivity = {
	id: string;
	owner: string;
	kind: 'asset' | 'collection';
	name: string;
	phase: 'working' | 'tracking' | 'done' | 'error';
	status: string;
	createdAt: number;
	transactionIds: string[];
	extended?: boolean;
	transactions: MintUploadTransaction[];
	assetId?: string;
	assetIds?: string[];
	collectionId?: string;
};

type OperationActivityContextValue = {
	activities: OperationActivity[];
	fungibleActivities: FungibleOperationActivitySummary[];
	mintActivities: MintActivity[];
	uploadActivities: UploadActivity[];
	activeId: string | null;
	start(
		input: Pick<OperationActivity, 'asset' | 'collectionId' | 'owner' | 'operation' | 'restoreFallback'>,
		options?: { show?: boolean }
	): void;
	show(id: string): void;
	showFungible(id: string): void;
	showUpload(id: string): void;
	showMint(id: string): void;
	beginUpload(input: Pick<UploadActivity, 'id' | 'owner' | 'kind' | 'name' | 'status'>): void;
	updateUpload(id: string, status: string): void;
	recordUploadTransaction(id: string, transaction: MintUploadTransaction): void;
	finishUpload(
		id: string,
		result: Pick<UploadActivity, 'transactionIds'> &
			Partial<Pick<UploadActivity, 'assetId' | 'assetIds' | 'collectionId' | 'extended'>>
	): void;
	failUpload(id: string, status: string): void;
	hide(): void;
	remove(id: string): void;
};

const OperationActivityContext = React.createContext<OperationActivityContextValue | null>(null);

async function observeMintActivity(
	activity: MintActivity,
	onPhase: (phase: MintActivity['phase']) => void,
	signal: AbortSignal
) {
	let mined = activity.phase === 'mined' || activity.phase === 'applied' || activity.phase === 'complete';
	while (!signal.aborted) {
		try {
			await readAssetState(activity.asset.id, {
				provider: activity.computeGateway || undefined,
				maxAge: 0,
				maxAttempts: 1,
				signal,
			});
			if (!mined) onPhase('mined');
			onPhase('applied');
			onPhase('complete');
			return;
		} catch (cause) {
			if (signal.aborted) throw cause;
		}

		let retryDelay = 4_000;
		if (!mined) {
			try {
				const response = await fetch(
					`${activity.arweaveGateway.replace(/\/$/, '')}/tx/${activity.asset.id}/status`,
					{ cache: 'no-store', signal }
				);
				if (response.ok) {
					const payload = (await response.json()) as { block_height?: unknown };
					if (Number(payload.block_height) > 0) {
						mined = true;
						onPhase('mined');
					}
				} else if (response.status === 429) {
					retryDelay = retryAfterDelay(response.headers.get('retry-after'), 4_000);
				}
			} catch (cause) {
				if (signal.aborted) throw cause;
				// Observation failures never create or upload another transaction.
			}
		}
		await waitForBackgroundObservation(retryDelay, signal);
	}
}

function retryAfterDelay(value: string | null, fallback: number) {
	if (!value) return fallback;
	const seconds = Number(value.trim());
	if (Number.isFinite(seconds)) return Math.min(60_000, Math.max(fallback, seconds * 1_000));
	const date = Date.parse(value);
	return Number.isFinite(date) ? Math.min(60_000, Math.max(fallback, date - Date.now())) : fallback;
}

function waitForBackgroundObservation(milliseconds: number, signal: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		const timer = window.setTimeout(() => {
			signal.removeEventListener('abort', abort);
			resolve();
		}, milliseconds);
		const abort = () => {
			window.clearTimeout(timer);
			signal.removeEventListener('abort', abort);
			reject(signal.reason);
		};
		if (signal.aborted) abort();
		else signal.addEventListener('abort', abort, { once: true });
	});
}

function OperationActivityProvider({ children }: React.PropsWithChildren) {
	const navigate = useNavigate();
	const wallet = useWallet();
	const market = React.useContext(MarketContext);
	const [activities, setActivities] = React.useState<OperationActivity[]>([]);
	const [fungibleActivities, setFungibleActivities] = React.useState<FungibleOperationActivitySummary[]>([]);
	const [mintActivities, setMintActivities] = React.useState<MintActivity[]>([]);
	const [uploadActivities, setUploadActivities] = React.useState<UploadActivity[]>([]);
	const [mintNotice, setMintNotice] = React.useState<MintActivity | null>(null);
	const [activeId, setActiveId] = React.useState<string | null>(null);
	const [activeUploadId, setActiveUploadId] = React.useState<string | null>(null);
	const [activeMintId, setActiveMintId] = React.useState<string | null>(null);
	const [hydratedOwners, setHydratedOwners] = React.useState<string[]>([]);
	const [recoveryValidationRetry, setRecoveryValidationRetry] = React.useState(0);
	const fungibleRuntimeActivitiesRef = React.useRef<FungibleOperationActivitySummary[]>([]);
	const mintWatchersRef = React.useRef(new Map<string, AbortController>());
	const activitiesRef = React.useRef(activities);
	activitiesRef.current = activities;
	const refreshOperationActivities = React.useCallback(() => {
		const owner = wallet.address;
		if (!owner) return;
		const restored = deriveOperationActivities(localStorage, owner, market.collections).map((activity) => ({
			...activity,
			origin: 'restored' as const,
			restoreFallback: () => null,
		}));
		setActivities((current) => {
			const runtime = current.filter((activity) => activity.origin === 'runtime');
			const runtimeAssets = new Set(
				runtime.filter((activity) => activity.owner === owner).map((activity) => activity.asset.id)
			);
			const otherOwners = current.filter(
				(activity) => activity.origin === 'restored' && activity.owner !== owner
			);
			return [
				...runtime,
				...otherOwners,
				...restored.filter((activity) => !runtimeAssets.has(activity.asset.id)),
			].sort((left, right) => right.createdAt - left.createdAt);
		});
		setHydratedOwners((current) => (current.includes(owner) ? current : [...current, owner]));
	}, [market.collections, wallet.address]);
	React.useEffect(() => refreshOperationActivities(), [refreshOperationActivities]);
	React.useEffect(() => {
		if (!hydratedOwners.length) return;
		saveOperationActivities(localStorage, activities, hydratedOwners);
	}, [activities, hydratedOwners]);
	const refreshFungibleActivities = React.useCallback(
		(runtime = fungibleRuntimeActivitiesRef.current) => {
			const owner = wallet.address;
			if (!owner) {
				setFungibleActivities([]);
				return;
			}
			const derived = deriveFungibleOperationActivities(localStorage, owner, market.collections, runtime);
			saveFungibleOperationActivities(
				localStorage,
				derived.filter((activity) => fungibleActivityHasRecovery(localStorage, activity)),
				[owner]
			);
			setFungibleActivities(derived);
		},
		[market.collections, wallet.address]
	);
	React.useEffect(() => refreshFungibleActivities(), [refreshFungibleActivities]);
	const refreshMintActivities = React.useCallback(() => {
		setMintActivities(loadMintActivities(localStorage));
	}, []);
	React.useEffect(() => refreshMintActivities(), [refreshMintActivities]);
	React.useEffect(() => {
		const refresh = () => refreshMintActivities();
		const refreshStorage = (event: StorageEvent) => {
			if (event.key === 'bazar-mint-activities:v1') refreshMintActivities();
		};
		window.addEventListener(MINT_ACTIVITY_CHANGE_EVENT, refresh);
		window.addEventListener('storage', refreshStorage);
		return () => {
			window.removeEventListener(MINT_ACTIVITY_CHANGE_EVENT, refresh);
			window.removeEventListener('storage', refreshStorage);
		};
	}, [refreshMintActivities]);
	React.useEffect(() => {
		const completeUpload = (event: Event) => {
			const completed = (event as CustomEvent<MintActivity>).detail;
			if (!completed?.asset?.id) return;
			setUploadActivities((current) =>
				current.map((activity) =>
					activity.assetId === completed.asset.id
						? { ...activity, phase: 'done', status: 'Live on Bazar.' }
						: activity
				)
			);
		};
		window.addEventListener('bazar:mint-live', completeUpload);
		return () => window.removeEventListener('bazar:mint-live', completeUpload);
	}, []);
	React.useEffect(() => {
		for (const activity of mintActivities) {
			if (
				mintWatchersRef.current.has(activity.id) ||
				activity.phase === 'complete' ||
				mintActivityNeedsAttention(activity)
			)
				continue;
			const controller = new AbortController();
			mintWatchersRef.current.set(activity.id, controller);
			void observeMintActivity(
				activity,
				(phase) => {
					const current = loadMintActivities(localStorage).find((candidate) => candidate.id === activity.id);
					if (!current) return;
					const updated = advanceMintActivity(current, phase);
					upsertMintActivity(localStorage, updated);
					if (phase !== 'complete') return;
					setMintNotice(updated);
					window.dispatchEvent(new CustomEvent('bazar:mint-live', { detail: updated }));
					if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
						try {
							new Notification(`${updated.asset.name} is live on Bazar`, {
								body: 'The accepted Arweave upload is now available in live process state.',
							});
						} catch {
							// The in-app completion notice remains available when system notifications fail.
						}
					}
					removeMintActivity(localStorage, updated.id);
				},
				controller.signal
			)
				.catch(() => undefined)
				.finally(() => mintWatchersRef.current.delete(activity.id));
		}
		const active = new Set(
			mintActivities.filter((activity) => !mintActivityNeedsAttention(activity)).map((activity) => activity.id)
		);
		for (const [id, controller] of mintWatchersRef.current) {
			if (!active.has(id)) {
				controller.abort();
				mintWatchersRef.current.delete(id);
			}
		}
	}, [mintActivities]);
	React.useEffect(
		() => () => {
			for (const controller of mintWatchersRef.current.values()) controller.abort();
			mintWatchersRef.current.clear();
		},
		[]
	);
	React.useEffect(() => {
		const updateRuntimeActivity = (event: Event) => {
			const change = (event as CustomEvent<FungibleOperationActivityChange>).detail;
			if (!change || (change.type !== 'upsert' && change.type !== 'remove')) return;
			const next = reduceFungibleRuntimeActivities(fungibleRuntimeActivitiesRef.current, change);
			fungibleRuntimeActivitiesRef.current = next;
			refreshFungibleActivities(next);
		};
		const refreshCurrentDocument = (event: Event) => {
			if (!isWalletOperationRecoveryKey((event as CustomEvent<string>).detail)) return;
			refreshOperationActivities();
			refreshFungibleActivities();
		};
		const refreshFromStorage = (event: StorageEvent) => {
			if (isWalletOperationRecoveryKey(event.key)) {
				refreshOperationActivities();
				refreshFungibleActivities();
			} else if (event.key === FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY) refreshFungibleActivities();
		};
		window.addEventListener(FUNGIBLE_OPERATION_ACTIVITY_CHANGE_EVENT, updateRuntimeActivity);
		window.addEventListener(WALLET_OPERATION_RECOVERY_CHANGE_EVENT, refreshCurrentDocument);
		window.addEventListener('storage', refreshFromStorage);
		return () => {
			window.removeEventListener(FUNGIBLE_OPERATION_ACTIVITY_CHANGE_EVENT, updateRuntimeActivity);
			window.removeEventListener(WALLET_OPERATION_RECOVERY_CHANGE_EVENT, refreshCurrentDocument);
			window.removeEventListener('storage', refreshFromStorage);
		};
	}, [refreshFungibleActivities, refreshOperationActivities]);
	const recoveryValidationKey = JSON.stringify(
		[
			...activities
				.filter((activity) => activity.origin === 'restored' && activity.owner === wallet.address)
				.map((activity) => ({ assetId: activity.asset.id, family: 'atomic', kind: activity.operation.kind })),
			...fungibleActivities
				.filter((activity) => activity.owner === wallet.address)
				.map((activity) => ({ assetId: activity.asset.id, family: 'fungible', kind: activity.operationKind })),
		].sort((left, right) =>
			`${left.family}:${left.assetId}:${left.kind}`.localeCompare(
				`${right.family}:${right.assetId}:${right.kind}`
			)
		)
	);
	React.useEffect(() => {
		const owner = wallet.address;
		if (!owner) return;
		const candidates = JSON.parse(recoveryValidationKey) as Array<{
			assetId: string;
			family: 'atomic' | 'fungible';
			kind: 'sell' | 'transfer' | 'cancel' | 'buy';
		}>;
		if (!candidates.length) return;
		const controller = new AbortController();
		let retryTimer: number | undefined;
		const validate = async (candidate: (typeof candidates)[number]) => {
			const key =
				candidate.kind === 'buy'
					? candidate.family === 'atomic'
						? atomicPurchaseStorageKey(candidate.assetId, owner)
						: fungibleBatchStorageKey(candidate.assetId, owner)
					: operationStorageKey(candidate.assetId, owner);
			const serialized = localStorage.getItem(key);
			if (!serialized) return;
			let record: any;
			try {
				record = JSON.parse(serialized);
			} catch {
				return;
			}
			const { state } = await readAssetStateCached(candidate.assetId, {
				cacheTtlMs: 20_000,
				maxAge: 60,
				maxAttempts: 1,
				signal: controller.signal,
			});
			if (controller.signal.aborted || localStorage.getItem(key) !== serialized) return;
			if (candidate.kind === 'buy') {
				const discard =
					candidate.family === 'atomic'
						? record?.buyer === owner &&
						  record?.order &&
						  record?.snapshot &&
						  atomicPurchaseRecoveryCanBeDiscarded(state, owner, record.order, record.snapshot)
						: record?.buyer === owner && fungiblePurchaseRecoveryCanBeDiscarded(state, owner, record);
				if (!discard) return;
				const transactionIds =
					candidate.family === 'atomic'
						? [record.snapshot?.registration?.id, record.snapshot?.payment?.id]
						: (record.entries ?? []).flatMap((entry: any) => [
								entry?.snapshot?.registration?.id,
								entry?.snapshot?.payment?.id,
						  ]);
				removeWalletRecoveryAndSignatures<any>(
					localStorage,
					key,
					(current) => current?.buyer === owner,
					transactionIds,
					owner
				);
				return;
			}
			if (operationRecoveryCanStillApply(state, owner, record, candidate.family)) return;
			removeWalletRecoveryAndSignatures<any>(
				localStorage,
				key,
				(current) => current?.signer === owner && current?.txId === record?.txId,
				[record?.txId],
				owner
			);
		};
		const cancelIdleValidation = scheduleIdleTask(() => {
			void mapConcurrent(candidates, 2, async (candidate) => {
				if (controller.signal.aborted) return false;
				try {
					await validate(candidate);
					return false;
				} catch {
					return true;
				}
			}).then((failed) => {
				if (controller.signal.aborted || !failed.includes(true)) return;
				const delay = Math.min(60_000, 5_000 * 2 ** Math.min(recoveryValidationRetry, 4));
				retryTimer = window.setTimeout(() => setRecoveryValidationRetry((attempt) => attempt + 1), delay);
			});
		}, 750);
		return () => {
			cancelIdleValidation();
			controller.abort();
			if (retryTimer !== undefined) window.clearTimeout(retryTimer);
		};
	}, [recoveryValidationKey, recoveryValidationRetry, wallet.address]);
	const start = React.useCallback(
		(
			input: Pick<OperationActivity, 'asset' | 'collectionId' | 'owner' | 'operation' | 'restoreFallback'>,
			options?: { show?: boolean }
		) => {
			const show = options?.show ?? true;
			const id = atomicOperationActivityId(input.asset.id, input.owner);
			const existing = activitiesRef.current.find(
				(activity) =>
					activity.asset.id === input.asset.id && activity.owner === input.owner && activity.phase !== 'done'
			);
			if (existing) {
				if (show) {
					setActiveUploadId(null);
					setActiveMintId(null);
					setActiveId(existing.id);
				}
				return;
			}
			const phase: OperationActivityPhase =
				input.operation.kind === 'buy' && input.operation.resume
					? purchaseRecoveryApprovalCount(input.operation.resume)
						? 'approval'
						: 'working'
					: input.operation.kind !== 'buy' && input.operation.resumeId
					? 'working'
					: 'form';
			setActivities((current) => {
				if (
					current.some(
						(activity) =>
							activity.asset.id === input.asset.id &&
							activity.owner === input.owner &&
							activity.phase !== 'done'
					)
				) {
					return current;
				}
				return [
					{
						...input,
						id,
						phase,
						status:
							phase === 'approval'
								? 'Waiting for wallet approval'
								: phase === 'working'
								? 'Starting transaction…'
								: 'Waiting for details',
						confirmations: 0,
						confirmationTarget: 5,
						createdAt: Date.now(),
						origin: 'runtime',
					},
					...current,
				];
			});
			if (show) {
				setActiveUploadId(null);
				setActiveMintId(null);
				setActiveId(id);
			}
		},
		[]
	);
	const update = React.useCallback(
		(
			id: string,
			patch: Pick<OperationActivity, 'phase' | 'status' | 'confirmations' | 'confirmationTarget'>,
			assetId: string
		) => {
			setActivities((current) =>
				current.map((activity) => (activity.id === id ? { ...activity, ...patch } : activity))
			);
			if (patch.phase === 'done') {
				queueMicrotask(() =>
					window.dispatchEvent(new CustomEvent('bazar:asset-operation-finished', { detail: assetId }))
				);
			}
		},
		[]
	);
	const updateOperation = React.useCallback((id: string, operation: Operation) => {
		setActivities((current) =>
			current.map((activity) => (activity.id === id ? { ...activity, operation } : activity))
		);
	}, []);
	const remove = React.useCallback((id: string) => {
		setActivities((current) => current.filter((activity) => activity.id !== id));
		setActiveId((current) => (current === id ? null : current));
	}, []);
	const beginUpload = React.useCallback(
		(input: Pick<UploadActivity, 'id' | 'owner' | 'kind' | 'name' | 'status'>) => {
			setUploadActivities((current) => [
				{ ...input, phase: 'working', createdAt: Date.now(), transactionIds: [], transactions: [] },
				...current.filter((activity) => activity.id !== input.id),
			]);
			setActiveId(null);
			setActiveMintId(null);
			setActiveUploadId(input.id);
		},
		[]
	);
	const updateUpload = React.useCallback((id: string, status: string) => {
		setUploadActivities((current) =>
			current.map((activity) => (activity.id === id ? { ...activity, phase: 'working', status } : activity))
		);
	}, []);
	const recordUploadTransaction = React.useCallback((id: string, transaction: MintUploadTransaction) => {
		setUploadActivities((current) =>
			current.map((activity) =>
				activity.id === id && !activity.transactions.some((candidate) => candidate.id === transaction.id)
					? { ...activity, transactions: [...activity.transactions, transaction] }
					: activity
			)
		);
	}, []);
	const finishUpload = React.useCallback(
		(
			id: string,
			result: Pick<UploadActivity, 'transactionIds'> &
				Partial<Pick<UploadActivity, 'assetId' | 'assetIds' | 'collectionId' | 'extended'>>
		) => {
			setUploadActivities((current) =>
				current.map((activity) =>
					activity.id === id
						? {
								...activity,
								...result,
								phase: result.assetId ? 'tracking' : 'done',
								status: result.assetId
									? 'Submitted; accepted by Arweave. Waiting for live process state.'
									: activity.kind === 'collection' && result.extended
									? 'Collection manifest update submitted to Arweave.'
									: 'Collection process submitted to Arweave.',
						  }
						: activity
				)
			);
		},
		[]
	);
	const failUpload = React.useCallback((id: string, status: string) => {
		setUploadActivities((current) =>
			current.map((activity) => (activity.id === id ? { ...activity, phase: 'error', status } : activity))
		);
	}, []);
	const removeUpload = React.useCallback((id: string) => {
		setUploadActivities((current) => current.filter((activity) => activity.id !== id));
		setActiveUploadId((current) => (current === id ? null : current));
	}, []);
	React.useEffect(() => {
		if (!activities.some((activity) => activity.phase === 'done' && activity.id !== activeId)) return;
		setActivities((current) => current.filter((activity) => activity.phase !== 'done' || activity.id === activeId));
	}, [activeId, activities]);
	const value = React.useMemo<OperationActivityContextValue>(
		() => ({
			activities,
			fungibleActivities,
			mintActivities,
			uploadActivities,
			activeId,
			start,
			show: (id) => {
				setActiveUploadId(null);
				setActiveMintId(null);
				setActiveId(id);
			},
			showFungible: (id) => {
				const activity = fungibleActivities.find((candidate) => candidate.id === id);
				if (!activity) return;
				setActiveId(null);
				setActiveUploadId(null);
				setActiveMintId(null);
				navigate(`/asset/${activity.collectionId}/${activity.asset.id}`, {
					state: { fungibleOperationActivityId: activity.id },
				});
			},
			showMint: (id) => {
				setActiveId(null);
				setActiveUploadId(null);
				setActiveMintId(id);
			},
			showUpload: (id) => {
				setActiveId(null);
				setActiveMintId(null);
				setActiveUploadId(id);
			},
			beginUpload,
			updateUpload,
			recordUploadTransaction,
			finishUpload,
			failUpload,
			hide: () => {
				setActiveId(null);
				setActiveUploadId(null);
				setActiveMintId(null);
			},
			remove,
		}),
		[
			activeId,
			activities,
			beginUpload,
			failUpload,
			finishUpload,
			fungibleActivities,
			mintActivities,
			navigate,
			recordUploadTransaction,
			remove,
			start,
			updateUpload,
			uploadActivities,
		]
	);
	return (
		<OperationActivityContext.Provider value={value}>
			{children}
			{mintNotice ? (
				<div className="mint-live-notice" role="status" aria-live="polite">
					<div>
						<strong>{mintNotice.asset.name} is live on Bazar</strong>
						<span>The original accepted upload is now applied to live process state.</span>
					</div>
					<Button
						type="button"
						size="custom"
						onClick={() => {
							navigate(`/asset/${mintNotice.collectionId}/${mintNotice.asset.id}`);
							setMintNotice(null);
						}}
					>
						View asset
					</Button>
					<Button type="button" size="custom" variant="ghost" onClick={() => setMintNotice(null)}>
						Dismiss
					</Button>
				</div>
			) : null}
			{activities.map((activity) => (
				<OperationDialog
					key={activity.id}
					taskId={activity.id}
					asset={activity.asset}
					collectionId={activity.collectionId}
					owner={activity.owner}
					operation={activity.operation}
					visible={activeId === activity.id}
					restoreFallback={() =>
						activity.restoreFallback() ??
						document.querySelector<HTMLElement>(
							'.operation-activity-trigger[data-activity-owner="global"]'
						) ??
						document.getElementById('main-content')
					}
					onUpdate={update}
					onOperation={(operation) => updateOperation(activity.id, operation)}
					onHide={() => setActiveId(null)}
					onClose={(resumeLater, refresh = true) => {
						if (refresh) {
							window.dispatchEvent(
								new CustomEvent('bazar:asset-operation-finished', { detail: activity.asset.id })
							);
						}
						if (resumeLater) setActiveId(null);
						else remove(activity.id);
					}}
					onViewAsset={() => {
						navigate(`/asset/${activity.collectionId}/${activity.asset.id}`);
						remove(activity.id);
					}}
				/>
			))}
			{uploadActivities.map((activity) => (
				<UploadActivityPanel
					activity={activity}
					key={activity.id}
					relatedMintActivities={mintActivities.filter(
						(candidate) =>
							candidate.asset.id === activity.assetId ||
							activity.assetIds?.includes(candidate.asset.id) ||
							candidate.transactionIds.some((id) =>
								activity.transactions.some((transaction) => transaction.id === id)
							)
					)}
					visible={activeUploadId === activity.id}
					onHide={() => setActiveUploadId(null)}
					onClose={() => removeUpload(activity.id)}
				/>
			))}
			{mintActivities
				.filter(
					(activity) =>
						!uploadActivities.some(
							(upload) =>
								upload.assetId === activity.asset.id || upload.assetIds?.includes(activity.asset.id)
						)
				)
				.map((activity) => (
					<UploadActivityPanel
						activity={{
							id: activity.id,
							owner: activity.owner,
							kind: 'asset',
							name: activity.asset.name,
							phase: 'tracking',
							status: activity.status,
							createdAt: activity.createdAt,
							transactionIds: activity.transactionIds,
							transactions: activity.transactionIds.map((id, index) => ({
								id,
								label:
									index === activity.transactionIds.length - 1
										? 'Asset transaction'
										: 'Artwork transaction',
							})),
							assetId: activity.asset.id,
							collectionId: activity.collectionId,
						}}
						key={activity.id}
						relatedMintActivities={[activity]}
						visible={activeMintId === activity.id}
						onHide={() => setActiveMintId(null)}
						onClose={() => setActiveMintId(null)}
					/>
				))}
		</OperationActivityContext.Provider>
	);
}

export function useOperationActivity() {
	const value = React.useContext(OperationActivityContext);
	if (!value) throw new Error('operation-activity-provider-missing');
	return value;
}

export type UploadObserverState = Record<string, { views: ObserverView[]; consensus?: Consensus }>;

export function uploadActivitySyncSteps(
	activity: UploadActivity,
	relatedMintActivities: MintActivity[],
	observerState: UploadObserverState = {}
): ArweaveSyncStep[] {
	return activity.transactions.map((transaction, index) => {
		const mintActivity = relatedMintActivities.find((candidate) =>
			candidate.transactionIds.includes(transaction.id)
		);
		const phase = mintActivity?.phase;
		const confirmed = phase === 'mined' || phase === 'applied' || phase === 'complete';
		const observed = observerState[transaction.id];
		const confirmations = observed?.consensus?.confirmations ?? (confirmed ? 1 : 0);
		return {
			key: transaction.id,
			label: transaction.label,
			target: 1,
			terminal: index === activity.transactions.length - 1,
			confirmations,
			transaction: {
				id: transaction.id,
				views: observed?.views ?? [],
				...(observed?.consensus ? { consensus: observed.consensus } : {}),
			},
			hasError: activity.phase === 'error',
		};
	});
}

function UploadActivityPanel({
	activity,
	relatedMintActivities,
	visible,
	onHide,
	onClose,
}: {
	activity: UploadActivity;
	relatedMintActivities: MintActivity[];
	visible: boolean;
	onHide(): void;
	onClose(): void;
}) {
	const navigate = useNavigate();
	const [hiding, setHiding] = React.useState(false);
	const [observerState, setObserverState] = React.useState<UploadObserverState>({});
	const hideTimerRef = React.useRef<number | null>(null);
	const titleId = React.useId();
	const working = activity.phase === 'working' || activity.phase === 'tracking';
	const primaryMintActivity =
		relatedMintActivities.find((candidate) => candidate.asset.id === activity.assetId) ??
		relatedMintActivities[relatedMintActivities.length - 1];
	const displayedStatus =
		activity.phase === 'tracking' ? primaryMintActivity?.status ?? activity.status : activity.status;
	const syncSteps = uploadActivitySyncSteps(activity, relatedMintActivities, observerState);
	const activeSyncStep =
		[...syncSteps].reverse().find((step) => (step.confirmations ?? 0) < step.target) ??
		syncSteps[syncSteps.length - 1];
	const closeOrHide = React.useCallback(() => {
		if (!working) {
			onClose();
			return;
		}
		if (hiding) return;
		if (dialogRef.current) {
			prepareTransactionDialogHide(
				dialogRef.current,
				document.querySelector<HTMLElement>('.operation-activity-trigger[data-activity-owner="global"]')
			);
		}
		setHiding(true);
		hideTimerRef.current = window.setTimeout(() => {
			hideTimerRef.current = null;
			onHide();
		}, TRANSACTION_DIALOG_HIDE_DURATION_MS);
	}, [hiding, onClose, onHide, working]);
	const dialogRef = useDialogFocus<HTMLDivElement>(
		visible,
		closeOrHide,
		undefined,
		activity.phase,
		() =>
			document.querySelector<HTMLElement>('.operation-activity-trigger[data-activity-owner="global"]') ??
			document.getElementById('main-content')
	);
	React.useEffect(() => {
		if (visible) setHiding(false);
	}, [visible]);
	React.useEffect(() => {
		if (!visible || !working || !activity.transactions.length) return;
		let cancelled = false;
		let lease: AssetObserverNetworkLease | undefined;
		const watchers: Array<{ stop(): void }> = [];
		const unsubscribe: Array<() => void> = [];
		const observe = async () => {
			const runtime = await loadAssetObserverRuntime();
			if (cancelled) return;
			lease = runtime.acquireAssetObserverNetwork();
			await lease.ready;
			if (cancelled) return;
			for (const transaction of activity.transactions) {
				const watcher = lease.network.watch(transaction.id, {
					target: 1,
					minObservers: 3,
					propagation: 'all',
					notFoundTimeout: 180_000,
				});
				const publish = (consensus = watcher.consensus()) => {
					if (cancelled) return;
					setObserverState((current) => ({
						...current,
						[transaction.id]: { views: watcher.views(), consensus },
					}));
				};
				unsubscribe.push(
					watcher.on('view', () => publish()),
					watcher.on('consensus', publish)
				);
				watchers.push(watcher);
				watcher.start();
			}
		};
		void observe().catch(() => {
			lease?.release();
			lease = undefined;
		});
		return () => {
			cancelled = true;
			for (const off of unsubscribe) off();
			for (const watcher of watchers) watcher.stop();
			lease?.release();
		};
	}, [activity.transactions, visible, working]);
	React.useEffect(
		() => () => {
			if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
		},
		[]
	);
	if (!visible && !working) return null;
	const receiptEntries = activity.transactions.length
		? activity.transactions.map((transaction) => ({
				label: transaction.label,
				transactionId: transaction.id,
		  }))
		: activity.transactionIds.map((transactionId, index) => ({
				label:
					activity.kind === 'collection'
						? index === activity.transactionIds.length - 1
							? activity.extended
								? 'Collection update'
								: 'Collection process'
							: 'Collection manifest'
						: index === activity.transactionIds.length - 1
						? 'Asset transaction'
						: 'Artwork transaction',
				transactionId,
		  }));
	const dialogPhase = activity.phase === 'error' ? 'error' : activity.phase === 'done' ? 'done' : 'working';
	return (
		<div
			className={`dialog-backdrop operation-panel-backdrop${hiding ? ' dialog-backdrop-hiding' : ''}`}
			hidden={!visible}
			onMouseDown={(event) => event.target === event.currentTarget && closeOrHide()}
			role="presentation"
		>
			<div
				aria-hidden={visible ? undefined : true}
				aria-labelledby={visible ? titleId : undefined}
				aria-modal={visible ? true : undefined}
				className="dialog operation-side-panel upload-activity-panel"
				ref={dialogRef}
				role={visible ? 'dialog' : undefined}
				tabIndex={-1}
			>
				<div className="dialog-heading">
					<div className="dialog-asset-heading">
						<span aria-hidden="true" className="dialog-asset-artwork dialog-asset-artwork-fallback">
							{activity.kind === 'collection' ? (
								<Images className="ui-icon ui-icon--sm" />
							) : (
								<Upload className="ui-icon ui-icon--sm" />
							)}
						</span>
						<div className="dialog-asset-heading-copy">
							<p className="eyebrow">
								{activity.kind === 'collection' ? 'Collection upload' : 'Asset upload'}
							</p>
							<h2 id={titleId}>{activity.name}</h2>
						</div>
					</div>
					<TransactionDialogControl hiding={hiding} phase={dialogPhase} onClick={closeOrHide} />
				</div>
				{working && !syncSteps.length ? (
					<div className="operation-preparing">
						<Loading label={displayedStatus} />
						<p>The network view will appear as soon as the first signed transaction is available.</p>
					</div>
				) : null}
				{working && syncSteps.length ? (
					<div className="operation-working">
						<p className="sr-only" aria-live="polite" role="status">
							{displayedStatus}
						</p>
						<React.Suspense fallback={<Loading label="Loading transaction progress…" />}>
							<ArweaveTransactionSync
								active={visible}
								activeStep={activeSyncStep?.key}
								miningTelemetryEnabled={false}
								pendingAfterConfirmation={
									primaryMintActivity?.phase === 'mined'
										? 'Waiting for live process state'
										: primaryMintActivity?.phase === 'applied'
										? 'Finishing Bazar indexing'
										: undefined
								}
								startedAt={activity.createdAt}
								steps={syncSteps}
								subject={activity.name}
								telemetryPanelEnabled={false}
							/>
						</React.Suspense>
					</div>
				) : null}
				{!working ? (
					<div className={`upload-activity-state ${activity.phase}`}>
						<span className="upload-activity-result-icon" aria-hidden="true">
							{activity.phase === 'done' ? <Check /> : <CircleX />}
						</span>
						<div>
							<strong>
								{activity.phase === 'done'
									? activity.kind === 'collection'
										? activity.extended
											? 'Collection extended'
											: 'Collection submitted'
										: 'Live on Bazar'
									: 'Upload needs attention'}
							</strong>
							<p aria-live="polite" role="status">
								{displayedStatus}
							</p>
						</div>
					</div>
				) : null}
				{receiptEntries.length ? <MintTransactionReceipt entries={receiptEntries} /> : null}
				{activity.phase === 'done' && activity.collectionId ? (
					<Button
						className="wide"
						data-dialog-initial
						onClick={() => {
							navigate(
								activity.kind === 'collection'
									? `/collection/${activity.collectionId}`
									: `/asset/${CREATED_COLLECTION_ID}/${activity.assetId}`
							);
							onClose();
						}}
						size="custom"
						variant="primary"
					>
						View {activity.kind === 'collection' ? 'collection' : 'asset'}
					</Button>
				) : null}
			</div>
		</div>
	);
}

function RouteFocus() {
	const { pathname, search } = useLocation();
	const routeKey = `${pathname}${search}`;
	const previousRoute = React.useRef<string | null>(null);
	React.useEffect(() => {
		window.scrollTo({ top: 0, left: 0 });
		const main = document.getElementById('main-content');
		if (!main) return;
		const shouldMoveFocus = previousRoute.current !== null && previousRoute.current !== routeKey;
		previousRoute.current = routeKey;
		let title = 'Bazar — Arweave-native assets';
		let observer: MutationObserver | null = null;
		const updateRouteContext = () => {
			const heading = main.querySelector('h1');
			const headingText = heading?.textContent?.trim();
			if (headingText) {
				title = `${headingText} — Bazar`;
				observer?.disconnect();
			}
			document.title = title;
		};
		const focusFrame = window.requestAnimationFrame(() => {
			updateRouteContext();
			if (shouldMoveFocus) main.focus({ preventScroll: true });
		});
		observer = new MutationObserver(updateRouteContext);
		observer.observe(main, { characterData: true, childList: true, subtree: true });
		return () => {
			window.cancelAnimationFrame(focusFrame);
			observer?.disconnect();
		};
	}, [routeKey]);
	return null;
}

function Header() {
	const location = useLocation();
	const navigate = useNavigate();
	const market = React.useContext(MarketContext);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const panelInputRef = React.useRef<HTMLInputElement>(null);
	const skipNextSearchFocus = React.useRef(false);
	const suppressSearchFocusRestore = React.useRef(false);
	const releaseSearchFocusFrame = React.useRef<number>();
	const urlQuery = new URLSearchParams(location.search).get('q') ?? '';
	const routeKey = `${location.pathname}${location.search}`;
	const searchRoute = React.useRef(routeKey);
	const [query, setQuery] = React.useState(urlQuery);
	const [searchOpen, setSearchOpen] = React.useState(false);
	const [scope, setScope] = React.useState<'all' | 'collections' | 'tokens' | 'assets' | 'names'>('all');
	const [recentQueries, setRecentQueries] = React.useState<string[]>([]);
	const [searchFeedback, setSearchFeedback] = React.useState('');
	const normalizedQuery = query.trim().toLowerCase();
	const deferredQuery = React.useDeferredValue(query.trim());
	const deferredNormalizedQuery = deferredQuery.toLowerCase();
	const [indexedAtomicSearch, setIndexedAtomicSearch] = React.useState<{
		query: string;
		loading: boolean;
		error: boolean;
		results: Array<{ asset: AssetSummary; collection: Collection }>;
	}>({ query: '', loading: false, error: false, results: [] });
	const shouldSearchAtomicIndex =
		searchOpen &&
		Boolean(deferredNormalizedQuery) &&
		scope !== 'collections' &&
		scope !== 'tokens' &&
		scope !== 'names';
	React.useEffect(() => {
		if (!shouldSearchAtomicIndex || !market.visibilityReady) {
			setIndexedAtomicSearch({ query: deferredNormalizedQuery, loading: false, error: false, results: [] });
			return;
		}
		const controller = new AbortController();
		const requestedQuery = deferredNormalizedQuery;
		setIndexedAtomicSearch({ query: requestedQuery, loading: true, error: false, results: [] });
		const timer = window.setTimeout(() => {
			void searchBazarAtomicAssetsByName(deferredQuery, { signal: controller.signal }).then(
				(results) => {
					if (!controller.signal.aborted) {
						setIndexedAtomicSearch({ query: requestedQuery, loading: false, error: false, results });
					}
				},
				() => {
					if (!controller.signal.aborted) {
						setIndexedAtomicSearch({ query: requestedQuery, loading: false, error: true, results: [] });
					}
				}
			);
		}, 250);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [deferredNormalizedQuery, deferredQuery, market.visibilityReady, shouldSearchAtomicIndex]);
	const atomicIndexSearchPending =
		shouldSearchAtomicIndex &&
		(indexedAtomicSearch.query !== deferredNormalizedQuery || indexedAtomicSearch.loading);
	const atomicIndexSearchFailed =
		shouldSearchAtomicIndex && indexedAtomicSearch.query === deferredNormalizedQuery && indexedAtomicSearch.error;
	const relevantSearchCollections = React.useMemo(
		() =>
			market.collections.filter((collection) =>
				scope === 'names'
					? collection.kind === 'names'
					: scope === 'tokens'
					? collection.kind === 'tokens'
					: scope === 'assets'
					? collection.kind !== 'tokens'
					: true
			),
		[market.collections, scope]
	);
	const localSearchMatches = React.useMemo(
		() =>
			new Map(
				relevantSearchCollections.map((collection) => [
					collection,
					collectionSearchAssets(collection, deferredNormalizedQuery),
				])
			),
		[deferredNormalizedQuery, relevantSearchCollections]
	);
	const collectionResults = React.useMemo(
		() =>
			scope === 'assets' || scope === 'tokens'
				? []
				: relevantSearchCollections
						.filter((collection) => collection.kind !== 'tokens')
						.filter(
							(collection) =>
								!deferredNormalizedQuery ||
								`${collection.name} ${collection.description}`
									.toLowerCase()
									.includes(deferredNormalizedQuery) ||
								Boolean(localSearchMatches.get(collection)?.length)
						)
						.slice(0, 6),
		[deferredNormalizedQuery, localSearchMatches, relevantSearchCollections, scope]
	);
	const searchableCollections = React.useMemo(
		() => (scope === 'collections' ? [] : relevantSearchCollections),
		[relevantSearchCollections, scope]
	);
	const localAssetResults = React.useMemo(
		() =>
			deferredNormalizedQuery
				? searchableCollections
						.flatMap((collection) =>
							(localSearchMatches.get(collection) ?? []).map((asset) => ({
								asset,
								collection,
							}))
						)
						.filter(({ asset, collection }) =>
							marketplaceAssetMatchesSearch(asset, collection, deferredNormalizedQuery)
						)
						.sort(
							(left, right) =>
								searchResultScore(right, deferredNormalizedQuery) -
								searchResultScore(left, deferredNormalizedQuery)
						)
						.slice(0, 8)
				: interleaveCollectionAssets(
						searchableCollections,
						8,
						(asset, collection) =>
							Boolean(asset.image || asset.media) ||
							collection.kind === 'names' ||
							collection.kind === 'tokens'
				  ),
		[deferredNormalizedQuery, localSearchMatches, searchableCollections]
	);
	const atomicIndexResults =
		shouldSearchAtomicIndex && indexedAtomicSearch.query === deferredNormalizedQuery
			? indexedAtomicSearch.results
			: [];
	const assetResults = React.useMemo(
		() =>
			[...localAssetResults, ...atomicIndexResults]
				.filter(({ asset, collection }) => isVisibleCollectionId(collection.id) && isVisibleAssetId(asset.id))
				.filter(
					({ asset }, index, results) =>
						results.findIndex(({ asset: candidate }) => candidate.id === asset.id) === index
				)
				.sort(
					(left, right) =>
						searchResultScore(right, deferredNormalizedQuery) -
						searchResultScore(left, deferredNormalizedQuery)
				)
				.slice(0, 8),
		[atomicIndexResults, deferredNormalizedQuery, localAssetResults]
	);
	const tokenResults = assetResults.filter(({ collection }) => collection.kind === 'tokens');
	const collectibleResults = assetResults.filter(({ collection }) => collection.kind !== 'tokens');
	const directTokenCollection =
		scope !== 'collections' && scope !== 'assets' && scope !== 'names'
			? directTokenSearchCollection(market.collections, query)
			: undefined;
	const directTokenProcess = directTokenCollection && !assetResults.some(({ asset }) => asset.id === query.trim());
	const partialTokenCollection =
		normalizedQuery && scope !== 'collections' && scope !== 'assets' && scope !== 'names'
			? market.collections.find((collection) => collection.kind === 'tokens' && collection.hasMore)
			: undefined;
	const searchResultAnnouncement = atomicIndexSearchPending
		? 'Searching permanent Bazar creation records on Arweave.'
		: atomicIndexSearchFailed
		? 'Permanent Bazar creation-record search is temporarily unavailable.'
		: market.loading
		? 'Loading collection indexes from Arweave.'
		: market.error
		? 'Marketplace search is unavailable.'
		: normalizedQuery && !collectionResults.length && !assetResults.length && !directTokenProcess
		? partialTokenCollection
			? `No loaded tokens, collections, or Uniques match ${query.trim()}; more token records remain available.`
			: `No tokens, collections, or Uniques match ${query.trim()}.`
		: `Showing ${collectionResults.length.toLocaleString()} ${
				collectionResults.length === 1 ? 'collection' : 'collections'
		  } and ${(assetResults.length + (directTokenProcess ? 1 : 0)).toLocaleString()} ${
				assetResults.length + (directTokenProcess ? 1 : 0) === 1 ? 'asset result' : 'asset results'
		  }${normalizedQuery ? ` for ${query.trim()}` : ''}.`;
	const [announcedSearchResult, setAnnouncedSearchResult] = React.useState('');
	React.useEffect(() => {
		if (!searchOpen) return;
		const timer = window.setTimeout(() => setAnnouncedSearchResult(searchResultAnnouncement), 250);
		return () => window.clearTimeout(timer);
	}, [searchOpen, searchResultAnnouncement]);
	React.useEffect(() => setQuery(urlQuery), [urlQuery]);
	const closeSearch = React.useCallback(
		(restoreFocus = true) => {
			if (restoreFocus) setQuery(urlQuery);
			suppressSearchFocusRestore.current = !restoreFocus;
			skipNextSearchFocus.current = true;
			setSearchOpen(false);
			if (releaseSearchFocusFrame.current !== undefined) {
				window.cancelAnimationFrame(releaseSearchFocusFrame.current);
			}
			releaseSearchFocusFrame.current = window.requestAnimationFrame(() => {
				releaseSearchFocusFrame.current = window.requestAnimationFrame(() => {
					skipNextSearchFocus.current = false;
					releaseSearchFocusFrame.current = undefined;
				});
			});
		},
		[urlQuery]
	);
	React.useEffect(() => {
		const previousRoute = searchRoute.current;
		searchRoute.current = routeKey;
		if (searchOpen && previousRoute !== routeKey) closeSearch(false);
	}, [closeSearch, routeKey, searchOpen]);
	const openSearch = React.useCallback(() => {
		if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
		suppressSearchFocusRestore.current = false;
		setSearchOpen(true);
	}, []);
	React.useEffect(
		() => () => {
			if (releaseSearchFocusFrame.current !== undefined) {
				window.cancelAnimationFrame(releaseSearchFocusFrame.current);
			}
		},
		[]
	);
	React.useEffect(() => {
		const focusSearch = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
				openSearch();
			}
			if (event.key === 'Escape' && searchOpen) {
				closeSearch();
			}
		};
		window.addEventListener('keydown', focusSearch);
		return () => window.removeEventListener('keydown', focusSearch);
	}, [closeSearch, openSearch, searchOpen]);
	const updateQuery = (value: string) => {
		setSearchFeedback('');
		setQuery(value);
	};
	const focusPanelInput = () => {
		window.requestAnimationFrame(() => panelInputRef.current?.focus());
	};
	const clearSearchQuery = () => {
		updateQuery('');
		focusPanelInput();
	};
	const clearRecentSearches = () => {
		setRecentQueries([]);
		setSearchFeedback('Recent searches cleared.');
		focusPanelInput();
	};
	const runSearch = () => {
		if (query.trim()) {
			setRecentQueries((current) =>
				[query.trim(), ...current.filter((item) => item !== query.trim())].slice(0, 4)
			);
		}
		navigate(
			directTokenProcess && directTokenCollection
				? `/asset/${directTokenCollection.id}/${query.trim()}`
				: query.trim()
				? `/?q=${encodeURIComponent(query.trim())}`
				: '/'
		);
		closeSearch(false);
	};
	const submitSearch = (event: React.FormEvent) => {
		event.preventDefault();
		runSearch();
	};
	const useRecentQuery = (value: string) => {
		setQuery(value);
		navigate(`/?q=${encodeURIComponent(value)}`);
		closeSearch(false);
	};
	const followSearchResult = () => {
		setQuery('');
		closeSearch(false);
	};
	const searchRestoreTarget = React.useCallback(
		() => (suppressSearchFocusRestore.current ? document.getElementById('main-content') : inputRef.current),
		[]
	);
	const searchDialogRef = useDialogFocus<HTMLElement>(searchOpen, closeSearch, searchRestoreTarget);
	const scopes = [
		{ id: 'all' as const, label: 'All', Icon: Search },
		{ id: 'tokens' as const, label: 'Tokens', Icon: BarChart3 },
		{ id: 'collections' as const, label: 'Collections', Icon: LayoutGrid },
		{ id: 'assets' as const, label: 'Uniques', Icon: Images },
		{ id: 'names' as const, label: 'Names', Icon: AtSign },
	];
	return (
		<>
			<header className="site-header">
				<div className="site-header-content max-view-wrapper">
					<Link aria-label="Bazar home" className="brand" to="/">
						<span className="brand-mark">
							<BazarMark />
						</span>
					</Link>
					<form
						className={`site-search${searchOpen ? ' expanded' : ''}`}
						role="search"
						onSubmit={submitSearch}
					>
						<Search className="ui-icon ui-icon--sm" aria-hidden="true" />
						<input
							ref={inputRef}
							aria-label="Search tokens, collections, and Uniques"
							placeholder="Search tokens, collections, and assets"
							value={query}
							onChange={(event) => updateQuery(event.target.value)}
							onClick={openSearch}
							onFocus={() => {
								if (skipNextSearchFocus.current) return;
								openSearch();
							}}
							aria-expanded={searchOpen}
							aria-controls="marketplace-search-panel"
						/>
					</form>
					<nav className="site-nav">
						<div className="site-nav-primary">
							<Tooltip
								align="center"
								className="create-link-tooltip"
								content="Create asset"
								delayMs={1000}
							>
								{(tooltipId) => (
									<Link
										aria-describedby={tooltipId}
										aria-label="Create asset"
										aria-current={location.pathname === '/create' ? 'page' : undefined}
										className={`create-link${location.pathname === '/create' ? ' active' : ''}`}
										to="/create"
									>
										<Upload className="ui-icon ui-icon--sm" aria-hidden="true" />
									</Link>
								)}
							</Tooltip>
							<GatewayControl />
						</div>
						<div className="site-nav-wallet">
							<OperationActivityControl />
							<WalletMenu />
						</div>
					</nav>
				</div>
			</header>
			{searchOpen ? (
				<div
					className="search-overlay"
					onMouseDown={(event) => event.target === event.currentTarget && closeSearch()}
				>
					<section
						aria-label="Search Bazar"
						aria-modal="true"
						className="search-panel"
						id="marketplace-search-panel"
						ref={searchDialogRef}
						role="dialog"
						tabIndex={-1}
					>
						<form className="search-panel-query" role="search" onSubmit={submitSearch}>
							<Search className="ui-icon" aria-hidden="true" />
							<input
								autoFocus
								aria-label="Search Bazar marketplace"
								placeholder="Search Bazar"
								value={query}
								onChange={(event) => updateQuery(event.target.value)}
								onKeyDown={(event) => {
									if (event.key !== 'Enter') return;
									event.preventDefault();
									runSearch();
								}}
								ref={panelInputRef}
							/>
							{query ? (
								<Button
									size="custom"
									type="button"
									onClick={clearSearchQuery}
									aria-label="Clear search"
									variant="ghost"
								>
									Clear
								</Button>
							) : null}
							<Button
								size="icon"
								className="search-panel-submit"
								type="submit"
								aria-label="View search results"
								variant="primary"
							>
								<ArrowRight className="ui-icon ui-icon--sm" aria-hidden="true" />
							</Button>
							<Button
								className="search-panel-close"
								type="button"
								onClick={() => closeSearch()}
								aria-label="Close search"
								size="icon"
								variant="ghost"
							>
								<X aria-hidden="true" />
							</Button>
						</form>
						<aside className="search-categories" aria-label="Search categories">
							{scopes.map((item) => {
								const ScopeIcon = item.Icon;
								return (
									<Button
										aria-pressed={scope === item.id}
										className={scope === item.id ? 'active' : undefined}
										key={item.id}
										size="custom"
										onClick={() => setScope(item.id)}
										variant="ghost"
									>
										<ScopeIcon className="ui-icon" aria-hidden="true" />
										{item.label}
									</Button>
								);
							})}
						</aside>
						<div className="search-panel-main">
							<div className="search-panel-content">
								<CollectionResultStatus message={searchFeedback || announcedSearchResult} />
								{market.loading && !market.collections.length ? (
									<Loading label="Loading collection indexes from Arweave…" />
								) : null}
								{atomicIndexSearchPending && !assetResults.length ? (
									<Loading label="Searching permanent Bazar creation records on Arweave…" />
								) : null}
								{partialTokenCollection ? (
									<div className="collection-source-notice">
										<span role="status">
											Token matches cover {partialTokenCollection.assets.length.toLocaleString()}{' '}
											of{' '}
											{(
												partialTokenCollection.total ?? partialTokenCollection.assets.length
											).toLocaleString()}{' '}
											discovered records currently loaded.
										</span>
										<Link
											className="with-icon"
											to={`/collection/${partialTokenCollection.id}?q=${encodeURIComponent(
												query.trim()
											)}`}
											onClick={followSearchResult}
										>
											Continue token search
											<ArrowRight className="ui-icon ui-icon--xs" aria-hidden="true" />
										</Link>
									</div>
								) : null}
								{!normalizedQuery && recentQueries.length ? (
									<section className="search-result-section">
										<div className="search-result-heading">
											<h2>Recent searches</h2>
											<Button onClick={clearRecentSearches} size="custom" variant="ghost">
												Clear
											</Button>
										</div>
										<div className="recent-searches">
											{recentQueries.map((item) => (
												<Button
													key={item}
													onClick={() => useRecentQuery(item)}
													size="custom"
													variant="ghost"
												>
													<History className="ui-icon ui-icon--sm" aria-hidden="true" />
													{item}
												</Button>
											))}
										</div>
									</section>
								) : null}
								{collectionResults.length ? (
									<section className="search-result-section">
										<div className="search-result-heading">
											<h2>{normalizedQuery ? 'Matching collections' : 'Featured collections'}</h2>
											<span>{collectionResults.length} shown</span>
										</div>
										<div className="search-collection-grid">
											{collectionResults.map((collection) => {
												const preview = collection.assets.find((asset) => asset.image)?.image;
												const tokenPreview =
													collection.assets.find((asset) => asset.image) ??
													collection.assets[0];
												return (
													<Link
														key={collection.id}
														to={`/collection/${collection.id}`}
														onClick={followSearchResult}
													>
														<span
															className={`search-result-image${
																collection.kind === 'tokens' ? ' token-avatar-slot' : ''
															}`}
														>
															{collection.kind === 'tokens' ? (
																<TokenAvatar
																	image={tokenPreview?.image}
																	ticker={tokenPreview?.ticker ?? 'Token'}
																/>
															) : preview ? (
																<ArtworkImage src={preview} alt="" />
															) : collection.kind === 'names' ? (
																<NamesCubePreview />
															) : (
																<BazarMark />
															)}
														</span>
														<span>
															<strong>{collection.name}</strong>
															<small>
																{collectionKindLabel(collection)} ·{' '}
																{collection.kind === 'names'
																	? `${collection.assets.length.toLocaleString()} names loaded`
																	: `${(
																			collection.total ?? collection.assets.length
																	  ).toLocaleString()} ${
																			(collection.total ??
																				collection.assets.length) === 1
																				? 'asset'
																				: 'assets'
																	  }`}
															</small>
														</span>
														<ArrowUpRight
															className="ui-icon ui-icon--sm"
															aria-hidden="true"
														/>
													</Link>
												);
											})}
										</div>
									</section>
								) : null}
								{tokenResults.length ? (
									<section className="search-result-section token-search-results">
										<div className="search-result-heading">
											<h2>{normalizedQuery ? 'Matching tokens' : 'Tokens'}</h2>
											<span>{tokenResults.length} shown</span>
										</div>
										<div className="token-market-list compact">
											{tokenResults.map(({ asset, collection }, index) => (
												<TokenMarketRow
													asset={asset}
													collection={collection}
													context="Fungible token"
													key={`${collection.id}-${asset.id}`}
													onFollow={followSearchResult}
													onWarm={() => prefetchAssetPage(asset.id, true)}
													priority={index === 0}
												/>
											))}
										</div>
									</section>
								) : null}
								{collectibleResults.length ? (
									<section className="search-result-section">
										<div className="search-result-heading">
											<h2>{normalizedQuery ? 'Matching Uniques' : 'Featured Uniques'}</h2>
											<span>{collectibleResults.length} shown</span>
										</div>
										<div className="search-asset-grid">
											{collectibleResults.map(({ asset, collection }) => (
												<Link
													key={`${collection.id}-${asset.id}`}
													to={`/asset/${collection.id}/${asset.id}`}
													onClick={followSearchResult}
													onFocus={() =>
														prefetchAssetPage(asset.id, collection.kind === 'tokens')
													}
													onMouseEnter={() =>
														prefetchAssetPage(asset.id, collection.kind === 'tokens')
													}
													onTouchStart={() =>
														prefetchAssetPage(asset.id, collection.kind === 'tokens')
													}
												>
													<span
														className={`search-result-image${
															collection.kind === 'tokens' ? ' token-avatar-slot' : ''
														}`}
													>
														{collection.kind === 'tokens' ? (
															<TokenAvatar
																image={asset.image}
																ticker={asset.ticker ?? 'Token'}
															/>
														) : asset.image ? (
															<ArtworkImage src={asset.image} alt="" />
														) : isAudioContentType(asset.contentType) ? (
															<AudioArtwork
																contentType={asset.contentType}
																name={asset.name}
															/>
														) : (
															<BazarMark />
														)}
													</span>
													<span>
														<strong>{asset.name}</strong>
														<small>{collection.name}</small>
													</span>
													<ArrowUpRight className="ui-icon ui-icon--sm" aria-hidden="true" />
												</Link>
											))}
										</div>
									</section>
								) : null}
								{directTokenProcess && directTokenCollection ? (
									<section className="search-result-section">
										<div className="search-result-heading">
											<h2>Direct process</h2>
											<span>Live state check required</span>
										</div>
										<div className="search-asset-grid">
											<Link
												to={`/asset/${directTokenCollection.id}/${query.trim()}`}
												onClick={followSearchResult}
												onFocus={() => prefetchAssetPage(query.trim(), true)}
												onMouseEnter={() => prefetchAssetPage(query.trim(), true)}
												onTouchStart={() => prefetchAssetPage(query.trim(), true)}
											>
												<span className="search-result-image token-avatar-slot">
													<TokenAvatar ticker="Token" />
												</span>
												<span>
													<strong>Check token process</strong>
													<small>
														{short(query.trim())} · support is determined from live state
													</small>
												</span>
												<ArrowUpRight className="ui-icon ui-icon--sm" aria-hidden="true" />
											</Link>
										</div>
									</section>
								) : null}
								{market.error ? <ErrorPanel message={market.error} onRetry={market.retry} /> : null}
								{!market.loading &&
								!market.error &&
								!atomicIndexSearchPending &&
								!collectionResults.length &&
								!assetResults.length &&
								!directTokenProcess ? (
									<div className="search-empty">
										<strong>No results for “{query}”</strong>
										<span>
											{partialTokenCollection
												? 'More token records remain available from the token collection.'
												: atomicIndexSearchFailed
												? 'Permanent Bazar creation-record search is temporarily unavailable. Try again shortly.'
												: 'Try another token, Unique, collection, or Arweave name.'}
										</span>
									</div>
								) : null}
							</div>
						</div>
					</section>
				</div>
			) : null}
		</>
	);
}

function OperationActivityControl() {
	const wallet = useWallet();
	const {
		activities,
		fungibleActivities,
		mintActivities,
		uploadActivities,
		show,
		showFungible,
		showMint,
		showUpload,
	} = useOperationActivity();
	const [open, setOpen] = React.useState(false);
	const containerRef = React.useRef<HTMLDivElement>(null);
	const visibleActivities = activities.filter(
		(activity) => activity.owner === wallet.address && isTransactionActivityVisible(activity.phase)
	);
	const visibleFungibleActivities = fungibleActivities.filter((activity) =>
		isTransactionActivityVisible(activity.phase)
	);
	const visibleUploadActivities = uploadActivities.filter((activity) => activity.owner === wallet.address);
	const linkedUploadAssets = new Set(
		visibleUploadActivities.flatMap((activity) => [activity.assetId, ...(activity.assetIds ?? [])])
	);
	const visibleMintActivities = mintActivities.filter(
		(activity) => activity.owner === wallet.address && !linkedUploadAssets.has(activity.asset.id)
	);
	const attentionMintActivities = visibleMintActivities.filter((activity) => mintActivityNeedsAttention(activity));
	const activityCount =
		visibleActivities.length +
		visibleFungibleActivities.length +
		visibleUploadActivities.length +
		visibleMintActivities.length;
	const workingCount =
		visibleActivities.filter((activity) => activity.phase === 'working').length +
		visibleFungibleActivities.filter((activity) => activity.phase === 'working').length +
		visibleUploadActivities.filter((activity) => ['working', 'tracking'].includes(activity.phase)).length +
		visibleMintActivities.filter(
			(activity) => activity.phase !== 'complete' && !mintActivityNeedsAttention(activity)
		).length;
	const clearUploadIssues = () => {
		if (!attentionMintActivities.length) return;
		const count = attentionMintActivities.length;
		if (
			!window.confirm(
				`Clear ${count.toLocaleString()} upload ${
					count === 1 ? 'item' : 'items'
				} that need attention?\n\nThis removes local Activity tracking only. It does not delete anything from Arweave.`
			)
		)
			return;
		removeMintActivities(
			localStorage,
			attentionMintActivities.map((activity) => activity.id)
		);
		setOpen(false);
	};
	React.useEffect(() => {
		if (!open) return;
		const close = (event: MouseEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
		};
		window.addEventListener('mousedown', close);
		return () => window.removeEventListener('mousedown', close);
	}, [open]);
	if (!activityCount) return null;
	return (
		<div className="operation-activity-control" ref={containerRef}>
			<Tooltip content="Transaction activity" disabled={open}>
				{(tooltipId) => (
					<Button
						aria-describedby={tooltipId}
						aria-expanded={open}
						aria-label={`Transaction activity, ${activityCount} ${activityCount === 1 ? 'item' : 'items'}`}
						className={`operation-activity-trigger${workingCount ? ' working' : ''}`}
						data-activity-owner="global"
						size="custom"
						onClick={() => setOpen((value) => !value)}
						type="button"
						variant="ghost"
					>
						<InfinityIcon className="ui-icon" aria-hidden="true" />
						<span>{activityCount}</span>
					</Button>
				)}
			</Tooltip>
			{open ? (
				<section aria-label="Transaction activity" className="operation-activity-menu">
					<div className="operation-activity-heading">
						<div>
							<strong>Transaction activity</strong>
							<span>
								{attentionMintActivities.length
									? `${attentionMintActivities.length.toLocaleString()} ${
											attentionMintActivities.length === 1 ? 'upload needs' : 'uploads need'
									  } attention`
									: workingCount
									? `${workingCount} running in the background`
									: 'No transactions running'}
							</span>
						</div>
						{attentionMintActivities.length ? (
							<Button size="custom" variant="ghost" onClick={clearUploadIssues} type="button">
								Clear upload issues
							</Button>
						) : null}
					</div>
					<div className="operation-activity-list">
						{visibleUploadActivities.map((activity) => (
							<div className={`operation-activity-item ${activity.phase}`} key={activity.id}>
								<Button
									className="operation-activity-open"
									size="custom"
									onClick={() => {
										showUpload(activity.id);
										setOpen(false);
									}}
									type="button"
									variant="ghost"
								>
									<span className="operation-activity-symbol" aria-hidden="true">
										{activity.kind === 'collection' ? (
											<Images className="ui-icon ui-icon--sm" />
										) : (
											<Upload className="ui-icon ui-icon--sm" />
										)}
									</span>
									<span className="operation-activity-copy">
										<strong>{activity.name}</strong>
										<small>
											{activity.kind === 'collection' ? 'Collection upload' : 'Upload'} ·{' '}
											{activity.phase === 'done'
												? 'Complete'
												: activity.phase === 'error'
												? 'Needs attention'
												: 'In progress'}
										</small>
										<span>{activity.status}</span>
									</span>
									<span className="operation-activity-progress">
										{['working', 'tracking'].includes(activity.phase) ? (
											<InfinityIcon
												className="ui-icon ui-icon--xs operation-activity-infinity"
												aria-hidden="true"
											/>
										) : null}
									</span>
									<ChevronRight
										className="ui-icon ui-icon--sm operation-activity-chevron"
										aria-hidden="true"
									/>
								</Button>
							</div>
						))}
						{visibleActivities.map((activity) => (
							<div className={`operation-activity-item ${activity.phase}`} key={activity.id}>
								<Button
									className="operation-activity-open"
									size="custom"
									onClick={() => {
										show(activity.id);
										setOpen(false);
									}}
									type="button"
									variant="ghost"
								>
									<span className="operation-activity-symbol" aria-hidden="true">
										{activity.asset.image ? (
											<ArtworkImage src={activity.asset.image} alt="" />
										) : (
											<span>{activity.asset.name.slice(0, 1)}</span>
										)}
									</span>
									<span className="operation-activity-copy">
										<strong>{activity.asset.name}</strong>
										<small>
											{operationLabel(activity.operation.kind)} ·{' '}
											{operationActivityPhaseLabel(activity.phase)}
										</small>
										<span>{activity.status}</span>
									</span>
									<span className="operation-activity-progress">
										<span
											aria-label={`${activity.confirmations} of ${activity.confirmationTarget} confirmations`}
											className="operation-activity-confirmations"
										>
											{activity.confirmations}/{activity.confirmationTarget}
										</span>
										{activity.phase === 'working' ? (
											<LoaderCircle
												className="ui-icon ui-icon--xs operation-activity-loader"
												aria-hidden="true"
											/>
										) : null}
									</span>
									<ChevronRight
										className="ui-icon ui-icon--sm operation-activity-chevron"
										aria-hidden="true"
									/>
								</Button>
							</div>
						))}
						{visibleFungibleActivities.map((activity) => (
							<div className={`operation-activity-item ${activity.phase}`} key={activity.id}>
								<Button
									className="operation-activity-open"
									size="custom"
									onClick={() => {
										showFungible(activity.id);
										setOpen(false);
									}}
									type="button"
									variant="ghost"
								>
									<TokenAvatar
										className="operation-activity-symbol"
										image={activity.asset.image}
										ticker={activity.asset.ticker ?? activity.asset.name}
									/>
									<span className="operation-activity-copy">
										<strong>{activity.asset.name}</strong>
										<small>
											{operationLabel(activity.operationKind)} ·{' '}
											{operationActivityPhaseLabel(activity.phase)}
										</small>
										<span>{activity.status}</span>
									</span>
									<span className="operation-activity-progress">
										{activity.phase === 'working' ? (
											<LoaderCircle
												className="ui-icon ui-icon--xs operation-activity-loader"
												aria-hidden="true"
											/>
										) : null}
									</span>
									<ChevronRight
										className="ui-icon ui-icon--sm operation-activity-chevron"
										aria-hidden="true"
									/>
								</Button>
							</div>
						))}
						{visibleMintActivities.map((activity) => {
							const pinnedGateway =
								activity.arweaveGateway !== arweaveGatewayFromLocation() ||
								activity.computeGateway !== gatewayFromLocation();
							const needsAttention = mintActivityNeedsAttention(activity);
							return (
								<div
									className={`operation-activity-item ${needsAttention ? 'error' : 'working'}`}
									key={activity.id}
								>
									<Button
										className="operation-activity-open"
										onClick={() => {
											showMint(activity.id);
											setOpen(false);
										}}
										size="custom"
										type="button"
										variant="ghost"
									>
										<span className="operation-activity-symbol" aria-hidden="true">
											<Upload className="ui-icon ui-icon--sm" />
										</span>
										<span className="operation-activity-copy">
											<strong>{activity.asset.name}</strong>
											<small>
												Upload ·{' '}
												{needsAttention
													? 'Needs attention'
													: mintActivityPhaseLabel(activity.phase)}
											</small>
											<span>
												{needsAttention
													? 'This upload has not reached live process state.'
													: activity.status}
												{pinnedGateway ? ' Tracking is pinned to the original gateways.' : ''}
											</span>
										</span>
										{needsAttention ? null : (
											<LoaderCircle
												className="ui-icon ui-icon--xs operation-activity-loader"
												aria-hidden="true"
											/>
										)}
										<ChevronRight
											className="ui-icon ui-icon--sm operation-activity-chevron"
											aria-hidden="true"
										/>
									</Button>
								</div>
							);
						})}
					</div>
				</section>
			) : null}
		</div>
	);
}

function operationActivityPhaseLabel(phase: OperationActivityPhase) {
	return {
		form: 'Awaiting signature',
		approval: 'Awaiting approval',
		working: 'In progress',
		done: 'Complete',
		error: 'Needs attention',
	}[phase];
}

function mintActivityPhaseLabel(phase: MintActivity['phase']) {
	return { accepted: 'Accepted', mined: 'Mined', applied: 'Applied', complete: 'Complete' }[phase];
}

export type HomeMarketSummary =
	| { status: 'resolved'; value: string | null }
	| { status: 'unindexed' }
	| { status: 'unavailable'; source: MarketplaceRequestSource; kind: MarketplaceFailureKind };

export function retryableHomeSummaryKeys(visibleKeys: string[], summaries: Record<string, HomeMarketSummary>) {
	return visibleKeys.filter((key) => {
		const summary = summaries[key];
		return !summary || summary.status === 'unavailable';
	});
}

export function homeSummaryRequestKeys(
	visibleKeys: string[],
	summaries: Record<string, HomeMarketSummary>,
	inFlightKeys: Iterable<string>,
	retryKeys: ReadonlySet<string>
) {
	const inFlight = new Set(inFlightKeys);
	return visibleKeys.filter((key) => retryKeys.has(key) || (!summaries[key] && !inFlight.has(key)));
}

export type HomeActivityScan = {
	members: Set<string>;
	completed: Set<string>;
	candidates: Map<string, AssetCandidate>;
	indexComplete: boolean;
};

export function reconcileHomeActivityScan(
	current: HomeActivityScan | undefined,
	recipients: string[]
): HomeActivityScan {
	const uniqueRecipients = [...new Set(recipients)];
	const delta = collectionAssetWindowDelta(current?.members ?? [], uniqueRecipients);
	if (!current || delta.reset) {
		return {
			members: new Set(uniqueRecipients),
			completed: new Set(),
			candidates: new Map(),
			indexComplete: false,
		};
	}
	const rescan = current.indexComplete && delta.added.length > 0;
	return {
		members: new Set(uniqueRecipients),
		completed: rescan ? new Set() : new Set(current.completed),
		candidates: new Map(current.candidates),
		indexComplete: rescan ? false : current.indexComplete,
	};
}

export function commitHomeActivityBatch(scan: HomeActivityScan, candidates: AssetCandidate[], recipients: string[]) {
	const scope = new Set(recipients);
	if (candidates.some((candidate) => !scope.has(candidate.processId))) {
		throw new TypeError('home-activity-batch-out-of-scope');
	}
	for (const recipient of recipients) scan.completed.add(recipient);
	for (const candidate of candidates) scan.candidates.set(candidate.processId, candidate);
}

export function pendingHomeActivityRecipients(scan: HomeActivityScan, recipients: string[]) {
	return [...new Set(recipients)].filter((recipient) => !scan.completed.has(recipient));
}

export function completeHomeActivityScan(scan: HomeActivityScan, recipients: string[]) {
	if (pendingHomeActivityRecipients(scan, recipients).length) {
		throw new TypeError('incomplete-home-activity-scan');
	}
	scan.indexComplete = true;
}

export type HomeFloorScan = {
	scope: string;
	candidates: Map<string, string>;
	settled: Map<string, bigint | null>;
	failures: Map<string, MarketplaceFailureKind>;
};

export function reconcileHomeFloorScan(
	current: HomeFloorScan | undefined,
	scope: string,
	candidateActivity: Array<Pick<AssetCandidate, 'processId' | 'height' | 'timestamp'>>
): HomeFloorScan {
	const candidates = new Map(
		candidateActivity.map((candidate) => [candidate.processId, `${candidate.height}:${candidate.timestamp}`])
	);
	if (!current || current.scope !== scope) {
		return { scope, candidates, settled: new Map(), failures: new Map() };
	}
	const unchanged = (processId: string) => current.candidates.get(processId) === candidates.get(processId);
	return {
		scope,
		candidates,
		settled: new Map([...current.settled].filter(([processId]) => unchanged(processId))),
		failures: new Map([...current.failures].filter(([processId]) => unchanged(processId))),
	};
}

export function pendingHomeFloorCandidates(scan: HomeFloorScan) {
	return [...scan.candidates.keys()].filter((processId) => !scan.settled.has(processId));
}

export function homeFloorCandidateNeedsResolution(
	scan: HomeFloorScan | undefined,
	scope: string,
	candidate: Pick<AssetCandidate, 'processId' | 'height' | 'timestamp'>
) {
	return !(
		scan?.scope === scope &&
		scan.candidates.get(candidate.processId) === `${candidate.height}:${candidate.timestamp}` &&
		scan.settled.has(candidate.processId)
	);
}

export function commitHomeFloorResult(
	scan: HomeFloorScan,
	processId: string,
	value: bigint | null,
	failure?: MarketplaceFailureKind
) {
	if (!scan.candidates.has(processId)) throw new TypeError('home-floor-result-out-of-scope');
	if (failure) {
		scan.settled.delete(processId);
		scan.failures.set(processId, failure);
		return;
	}
	scan.failures.delete(processId);
	scan.settled.set(processId, value);
}

export function publishHomeListingResult(
	current: Record<string, AssetSummary[]>,
	collectionId: string,
	asset: AssetSummary,
	listed: boolean
) {
	const previous = current[collectionId] ?? [];
	const existing = previous.findIndex((candidate) => candidate.id === asset.id);
	if (listed && existing >= 0) {
		if (previous[existing] === asset) return current;
		return {
			...current,
			[collectionId]: [...previous.slice(0, existing), asset, ...previous.slice(existing + 1)],
		};
	}
	if (!listed && existing < 0) return current;
	return {
		...current,
		[collectionId]: listed
			? [...previous, asset]
			: [...previous.slice(0, existing), ...previous.slice(existing + 1)],
	};
}

export function reconcileHomeListingAssets(previous: AssetSummary[], assetIds: string[], collection: Collection) {
	const previousById = new Map(previous.map((asset) => [asset.id, asset]));
	return assetIds.flatMap((assetId) => {
		const asset = previousById.get(assetId) ?? collectionAsset(collection, assetId);
		return asset ? [asset] : [];
	});
}

export function homeFloorScanSummary(scan: HomeFloorScan): HomeMarketSummary {
	if (!scan.candidates.size) return { status: 'unindexed' };
	if (scan.failures.size) {
		return {
			status: 'unavailable',
			source: 'compute',
			kind: [...scan.failures.values()].includes('rate-limited') ? 'rate-limited' : 'unavailable',
		};
	}
	if ([...scan.candidates.keys()].some((processId) => !scan.settled.has(processId))) {
		throw new TypeError('incomplete-home-floor-scan');
	}
	let floor: bigint | null = null;
	for (const asking of scan.settled.values()) {
		if (asking !== null && (floor === null || asking < floor)) floor = asking;
	}
	return { status: 'resolved', value: floor === null ? null : `${winstonToAr(floor.toString())} AR` };
}

export type HomeSummaryRetryRun = {
	token: number;
	pending: Set<'assets' | 'collections'>;
};

export function completeHomeSummaryRetryGroup(
	run: HomeSummaryRetryRun,
	token: number,
	group: 'assets' | 'collections',
	activeRequests: number
) {
	if (run.token !== token || activeRequests > 0 || !run.pending.has(group)) return false;
	run.pending.delete(group);
	return run.pending.size === 0;
}

function homeMarketSummaryLabel(
	summary: HomeMarketSummary | undefined,
	emptyLabel: string,
	unindexedLabel = emptyLabel
) {
	if (!summary) return 'Checking…';
	if (summary.status === 'unavailable') return 'Unavailable';
	if (summary.status === 'unindexed') return unindexedLabel;
	return summary.value ?? emptyLabel;
}

function homeMarketSummaryListed(summary: HomeMarketSummary | undefined) {
	return summary?.status === 'resolved' && Boolean(summary.value);
}

export function homeCollectionAssetCountLabel(collection: Collection) {
	if (collection.kind === 'names' && collection.hasMore && collection.assets.length === 0) return 'N/A';
	return (collection.total ?? collection.assets.length).toLocaleString();
}

export type HomeTab = 'discover' | 'collections' | 'activity';
export type HomeAssetView = 'all' | 'listed' | 'price-low' | 'price-high';
export type HomeCollectionSort = 'recent' | 'newest' | 'oldest';
const HOME_TABS = new Set<HomeTab>(['discover', 'collections', 'activity']);

export function homeTabFromPathname(pathname: string): HomeTab {
	const tab = pathname.replace(/^\/+|\/+$/g, '');
	return HOME_TABS.has(tab as HomeTab) ? (tab as HomeTab) : 'discover';
}

export function homeTabPath(tab: HomeTab) {
	return `/${tab}`;
}

export function homeRouteSearch(search: string) {
	const params = new URLSearchParams(search);
	params.delete('tab');
	const value = params.toString();
	return value ? `?${value}` : '';
}

export type HomeListingActivity = Pick<AssetCandidate, 'processId' | 'height' | 'timestamp'>;

export function compareHomeCollections(
	left: Collection,
	right: Collection,
	sort: HomeCollectionSort,
	activityByCollection: ReadonlyMap<string, HomeListingActivity>
) {
	const leftActivity = activityByCollection.get(left.id);
	const rightActivity = activityByCollection.get(right.id);
	if (sort === 'recent') {
		const point = (collection: Collection, activity: HomeListingActivity | undefined) => {
			const created = collection.createdAt
				? { height: collection.createdHeight ?? 0, timestamp: Math.floor(collection.createdAt / 1_000) }
				: collection.createdHeight === undefined
				? undefined
				: { height: collection.createdHeight, timestamp: 0 };
			if (!created || (activity && activity.timestamp >= created.timestamp)) return activity;
			return created;
		};
		const leftPoint = point(left, leftActivity);
		const rightPoint = point(right, rightActivity);
		if (leftPoint && !rightPoint) return -1;
		if (!leftPoint && rightPoint) return 1;
		if (leftPoint && rightPoint) {
			const activityOrder = rightPoint.timestamp - leftPoint.timestamp || rightPoint.height - leftPoint.height;
			if (activityOrder) return activityOrder;
		}
	}
	const leftCreated = left.createdHeight ?? (left.createdAt ? Math.floor(left.createdAt / 1_000) : undefined);
	const rightCreated = right.createdHeight ?? (right.createdAt ? Math.floor(right.createdAt / 1_000) : undefined);
	if (leftCreated !== undefined && rightCreated === undefined) return -1;
	if (leftCreated === undefined && rightCreated !== undefined) return 1;
	if (leftCreated !== undefined && rightCreated !== undefined && leftCreated !== rightCreated) {
		return sort === 'oldest' ? leftCreated - rightCreated : rightCreated - leftCreated;
	}
	return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

export function compareHomeListingRecency(
	leftAssetId: string,
	rightAssetId: string,
	activityByAsset: ReadonlyMap<string, HomeListingActivity>
) {
	const left = activityByAsset.get(leftAssetId);
	const right = activityByAsset.get(rightAssetId);
	if (left && !right) return -1;
	if (!left && right) return 1;
	if (!left || !right) return 0;
	return (
		right.height - left.height || right.timestamp - left.timestamp || left.processId.localeCompare(right.processId)
	);
}

export const HOME_ASSET_PAGE_SIZE = 9;
export const HOME_DISCOVER_TOKEN_PAGE_SIZE = 5;
const HOME_LISTING_ASSET_LIMIT = HOME_ASSET_PAGE_SIZE * 4;
const HOME_STATE_MAX_AGE = 30;
const HOME_STATE_STALE_WHILE_REVALIDATE = 86_400;
const HOME_LISTING_SNAPSHOT_MAX_AGE_MS = 60_000;

export function homeAssetPage<T>(items: T[], requestedPage: number, pageSize = HOME_ASSET_PAGE_SIZE) {
	const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
	const page = Math.min(Math.max(1, requestedPage), pageCount);
	const start = (page - 1) * pageSize;
	return { items: items.slice(start, start + pageSize), page, pageCount };
}

export function homeAssetVisibleForView(summary: HomeMarketSummary | undefined, view: HomeAssetView) {
	return view === 'all' || homeMarketSummaryListed(summary);
}

function HomePendingMarketValue({ label = 'Checking…' }: { label?: string }) {
	return (
		<span className="home-market-value-pending">
			<LoaderCircle aria-hidden="true" />
			<span>{label}</span>
		</span>
	);
}

function HomeMarketGhostCard({ kind }: { kind: 'collection' }) {
	const collection = kind === 'collection';
	return (
		<div
			className={`home-market-ghost home-market-ghost--${kind}${collection ? ' home-feature-card' : ''}`}
			role="status"
		>
			<LoaderCircle aria-hidden="true" />
			<strong>{collection ? 'Loading more collections' : 'Loading more assets'}</strong>
			<span>{collection ? 'Checking indexes and live floors.' : 'Checking active listings and prices.'}</span>
		</div>
	);
}

export function homeMarketPriceValue(value: string | null | undefined) {
	if (!value) return Number.POSITIVE_INFINITY;
	const match = value.replace(/,/g, '').match(/^([0-9]+(?:\.[0-9]+)?)\s+AR(?:\s*\/|$)/);
	const parsed = Number(match?.[1]);
	return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function homeTokenPriceChangePercent(
	events: CollectionActivityEvent[],
	now = Date.now(),
	windowComplete = true
) {
	if (!windowComplete) return null;
	const threshold = now - 24 * 60 * 60 * 1_000;
	const asks = events
		.flatMap((event) => {
			if (
				event.action !== 'make-offer' ||
				!event.asking ||
				!event.quantity ||
				(event.timestamp < 1_000_000_000_000 ? event.timestamp * 1_000 : event.timestamp) < threshold
			)
				return [];
			try {
				const asking = BigInt(event.asking);
				const quantity = BigInt(event.quantity);
				return asking > 0n && quantity > 0n ? [{ ...event, asking, quantity }] : [];
			} catch {
				return [];
			}
		})
		.sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
	if (asks.length < 2) return null;
	const first = asks[0];
	const last = asks.at(-1)!;
	const baseline = first.asking * last.quantity;
	const delta = last.asking * first.quantity - baseline;
	const scaled = (delta * 10_000n) / baseline;
	if (scaled > BigInt(Number.MAX_SAFE_INTEGER) || scaled < BigInt(Number.MIN_SAFE_INTEGER)) return null;
	return Number(scaled) / 100;
}

export function homeTokenPriceChangeLabel(change: number | null | 'unavailable') {
	if (change === null || change === 'unavailable' || !Number.isFinite(change)) return '—';
	return `${change > 0 ? '+' : ''}${change.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function homeMarketSummariesReady(
	loading: boolean,
	keys: string[],
	summaries: Record<string, HomeMarketSummary>
) {
	return !loading && keys.every((key) => Boolean(summaries[key]));
}

export function homeMarketHasPending(loading: boolean, keys: string[], summaries: Record<string, HomeMarketSummary>) {
	return loading || keys.some((key) => !summaries[key]);
}

export function homeMarketShowsInitialLoader(pending: boolean, visibleAssetCount: number) {
	return pending && visibleAssetCount === 0;
}

export function homeListingComputeFailure<T>(failure: T | undefined, attempts: number, failures: number) {
	return failure !== undefined && attempts > 0 && failures === attempts ? failure : undefined;
}

export type HomeListingComputeCircuit = {
	scope: string;
	consecutiveFailures: number;
	failure?: unknown;
};

export function recordHomeListingComputeResult(circuit: HomeListingComputeCircuit, scope: string, failure?: unknown) {
	if (circuit.scope !== scope) {
		circuit.scope = scope;
		circuit.consecutiveFailures = 0;
		circuit.failure = undefined;
	}
	if (failure === undefined) {
		if (circuit.failure === undefined) circuit.consecutiveFailures = 0;
		return circuit.failure;
	}
	circuit.consecutiveFailures += 1;
	if (circuit.consecutiveFailures >= HOME_LISTING_ASSET_LIMIT) circuit.failure ??= failure;
	return circuit.failure;
}

export function homeMarketShellLoading(loading: boolean, collectionCount: number) {
	return loading && collectionCount === 0;
}

export function shouldLoadHomeCollectionSummaries(tab: HomeTab) {
	return tab === 'collections';
}

export function shouldLoadHomeAssetSummaries(tab: HomeTab) {
	return tab === 'discover';
}

export function homeListingSupportVersion(collections: Collection[]) {
	return collections
		.map((collection) => `${collection.id}:${collectionActivityVersion(collection)}`)
		.sort()
		.join('|');
}

export function homeScrollIndicatorMetrics(
	scrollTop: number,
	scrollHeight: number,
	clientHeight: number,
	trackHeight = clientHeight
) {
	const scrollRange = Math.max(0, scrollHeight - clientHeight);
	if (!scrollRange || clientHeight <= 0 || trackHeight <= 0) {
		return { visible: false, size: Math.max(0, trackHeight), offset: 0 };
	}
	const size = Math.min(trackHeight, Math.max(44, trackHeight * (clientHeight / scrollHeight) * 0.5));
	const offsetRange = Math.max(0, trackHeight - size);
	const progress = Math.min(1, Math.max(0, scrollTop / scrollRange));
	return { visible: true, size, offset: offsetRange * progress };
}

function HomeRedirect() {
	const { search } = useLocation();
	return <Navigate to={{ pathname: homeTabPath('discover'), search: homeRouteSearch(search) }} replace />;
}

function Home() {
	const market = React.useContext(MarketContext);
	const location = useLocation();
	const navigate = useNavigate();
	const { search } = location;
	const marketPaneRef = React.useRef<HTMLElement>(null);
	const homeTab = homeTabFromPathname(location.pathname);
	const [assetType, setAssetType] = React.useState<HomeAssetType>('all');
	const [assetView, setAssetView] = React.useState<HomeAssetView>('listed');
	const [collectionSort, setCollectionSort] = React.useState<HomeCollectionSort>('recent');
	const [collectionActivity, setCollectionActivity] = React.useState<Record<string, HomeListingActivity>>({});
	const [assetPage, setAssetPage] = React.useState(1);
	const [discoverTokenPage, setDiscoverTokenPage] = React.useState(1);
	const computeGateway = gatewayFromLocation();
	const homeListingSnapshotScope = `${arweaveGraphqlEndpoint()}|${gatewaysFromLocation().join(',')}`;
	const query = new URLSearchParams(search).get('q') ?? '';
	const normalizedQuery = query.trim().toLowerCase();
	const homeSearchMatches = React.useMemo(
		() =>
			normalizedQuery
				? new Map(
						market.collections.map((collection) => [
							collection,
							collectionSearchAssets(collection, normalizedQuery),
						])
				  )
				: null,
		[market.collections, normalizedQuery]
	);
	const partialTokenCollection = React.useMemo(
		() =>
			normalizedQuery
				? market.collections.find((collection) => collection.kind === 'tokens' && collection.hasMore)
				: undefined,
		[market.collections, normalizedQuery]
	);
	const collections = React.useMemo(() => {
		const activity = new Map(Object.entries(collectionActivity));
		return market.collections
			.filter((collection) => {
				if (collection.kind === 'tokens') return false;
				if (!normalizedQuery) return true;
				return (
					`${collection.name} ${collection.description}`.toLowerCase().includes(normalizedQuery) ||
					Boolean(homeSearchMatches?.get(collection)?.length)
				);
			})
			.sort((left, right) => compareHomeCollections(left, right, collectionSort, activity));
	}, [collectionActivity, collectionSort, homeSearchMatches, market.collections, normalizedQuery]);
	const [verifiedHomeListings, setVerifiedHomeListings] = React.useState<Record<string, AssetSummary[]>>({});
	const [verifiedHomeListingActivity, setVerifiedHomeListingActivity] = React.useState<
		Record<string, HomeListingActivity>
	>({});
	const [portableHomeListings, setPortableHomeListings] = React.useState<ResolvedAsset[]>([]);
	const [cachedHomeListings, setCachedHomeListings] = React.useState<HomeListingShell[]>(() =>
		loadHomeListingSnapshot(window.sessionStorage, homeListingSnapshotScope, HOME_LISTING_SNAPSHOT_MAX_AGE_MS)
	);
	React.useEffect(() => {
		setCachedHomeListings(
			loadHomeListingSnapshot(window.sessionStorage, homeListingSnapshotScope, HOME_LISTING_SNAPSHOT_MAX_AGE_MS)
		);
	}, [homeListingSnapshotScope, market.visibilityReady]);
	const liveHomeListingShells = React.useMemo(
		() => portableHomeListings.flatMap((result) => homeListingShell(result) ?? []),
		[portableHomeListings]
	);
	const homeListingShells = React.useMemo(() => {
		const listings = new Map(cachedHomeListings.map((listing) => [listing.asset.id, listing]));
		for (const listing of liveHomeListingShells) listings.set(listing.asset.id, listing);
		return [...listings.values()];
	}, [cachedHomeListings, liveHomeListingShells]);
	const displayHomeListings = React.useMemo(
		() =>
			homeListingShells
				.filter(({ asset, collection }) => isVisibleCollectionId(collection.id) && isVisibleAssetId(asset.id))
				.map(({ asset, collection, activity }) => {
					const currentCollection = market.collections.find((candidate) => candidate.id === collection.id);
					const currentAsset = currentCollection ? collectionAsset(currentCollection, asset.id) : undefined;
					return {
						asset: currentAsset?.image && !asset.image ? { ...asset, image: currentAsset.image } : asset,
						collection: currentCollection ?? collection,
						activity,
					};
				}),
		[homeListingShells, market.collections]
	);
	const [portableHomeListingsLoading, setPortableHomeListingsLoading] = React.useState(false);
	const [portableHomeListingsComplete, setPortableHomeListingsComplete] = React.useState(false);
	const [portableHomeListingsFailure, setPortableHomeListingsFailure] = React.useState<
		Extract<HomeMarketSummary, { status: 'unavailable' }> | undefined
	>();
	const [portableHomeRetry, setPortableHomeRetry] = React.useState(0);
	const portableHomeComputeCircuit = React.useRef<HomeListingComputeCircuit>({
		scope: '',
		consecutiveFailures: 0,
	});
	const marketShellReady = market.collections.length > 0;
	const listingSupportVersion = React.useMemo(
		() => homeListingSupportVersion(market.collections),
		[market.collections]
	);
	const marketCollectionsRef = React.useRef(market.collections);
	marketCollectionsRef.current = market.collections;
	const loadedAssetLimit = React.useMemo(
		() =>
			market.collections.reduce((total, collection) => total + collection.assets.length, 0) +
			displayHomeListings.length,
		[displayHomeListings.length, market.collections]
	);
	const listingAssetLimit = HOME_LISTING_ASSET_LIMIT;
	const assetCandidates = React.useMemo(
		() =>
			normalizedQuery
				? homeSearchAssets(
						market.collections,
						displayHomeListings,
						normalizedQuery,
						assetView === 'all' ? loadedAssetLimit : listingAssetLimit,
						homeSearchMatches ?? undefined
				  )
				: assetView === 'all'
				? homeAllAssets(market.collections, loadedAssetLimit, displayHomeListings)
				: homeDiscoveryAssets(market.collections, verifiedHomeListings, listingAssetLimit, displayHomeListings),
		[
			assetView,
			loadedAssetLimit,
			homeSearchMatches,
			market.collections,
			normalizedQuery,
			displayHomeListings,
			verifiedHomeListings,
		]
	);
	const [assetPrices, setAssetPrices] = React.useState<Record<string, HomeMarketSummary>>({});
	const [assetImages, setAssetImages] = React.useState<Record<string, string>>({});
	const displayAssetPrices = React.useMemo(() => {
		const prices: Record<string, HomeMarketSummary> = Object.fromEntries(
			homeListingShells.map((listing) => [
				listing.asset.id,
				{ status: 'resolved', value: listing.price } satisfies HomeMarketSummary,
			])
		);
		for (const [assetId, summary] of Object.entries(assetPrices)) {
			if (summary.status === 'resolved') prices[assetId] = summary;
			else if (!prices[assetId]) prices[assetId] = summary;
		}
		return prices;
	}, [assetPrices, homeListingShells]);
	const homeListingActivityByAsset = React.useMemo(() => {
		const indexed = new Map<string, HomeListingActivity>(Object.entries(verifiedHomeListingActivity));
		for (const result of displayHomeListings) {
			const current = indexed.get(result.asset.id);
			if (
				!current ||
				result.activity.height > current.height ||
				(result.activity.height === current.height && result.activity.timestamp > current.timestamp)
			) {
				indexed.set(result.asset.id, result.activity);
			}
		}
		return indexed;
	}, [displayHomeListings, verifiedHomeListingActivity]);
	const displayedAssets = React.useMemo(
		() =>
			[...assetCandidates]
				.filter(({ asset }) => homeAssetVisibleForView(displayAssetPrices[asset.id], assetView))
				.filter(({ collection }) => homeAssetTypeMatches(collection, assetType))
				.sort((left, right) => {
					if (assetView === 'all') return 0;
					if (assetView === 'listed') {
						return compareHomeListingRecency(left.asset.id, right.asset.id, homeListingActivityByAsset);
					}
					const price = (assetId: string) => {
						const summary = displayAssetPrices[assetId];
						if (!summary || summary.status !== 'resolved' || !summary.value)
							return Number.POSITIVE_INFINITY;
						return homeMarketPriceValue(summary.value);
					};
					const leftPrice = price(left.asset.id);
					const rightPrice = price(right.asset.id);
					if (Number.isFinite(leftPrice) !== Number.isFinite(rightPrice)) {
						return Number.isFinite(leftPrice) ? -1 : 1;
					}
					return assetView === 'price-low' ? leftPrice - rightPrice : rightPrice - leftPrice;
				}),
		[assetCandidates, assetType, assetView, displayAssetPrices, homeListingActivityByAsset]
	);
	const discoverTokens = displayedAssets.filter(({ collection }) => collection.kind === 'tokens');
	const discoverCollectibles = displayedAssets.filter(({ collection }) => collection.kind !== 'tokens');
	const discoverTokenPagination = homeAssetPage(discoverTokens, discoverTokenPage, HOME_DISCOVER_TOKEN_PAGE_SIZE);
	const discoverOverviewAssets = [...discoverTokenPagination.items, ...discoverCollectibles.slice(0, 12)];
	const assetPagination = homeAssetPage(displayedAssets, assetPage);
	const visibleDiscoverTokens =
		assetType === 'all'
			? discoverTokenPagination.items
			: assetType === 'tokens'
			? assetPagination.items.filter(({ collection }) => collection.kind === 'tokens')
			: [];
	const visibleDiscoverTokenKey = visibleDiscoverTokens.map(({ asset }) => asset.id).join(',');
	const [tokenPriceChanges, setTokenPriceChanges] = React.useState<Record<string, number | null | 'unavailable'>>({});
	const assets =
		assetView === 'all' ? (assetType === 'all' ? discoverOverviewAssets : assetPagination.items) : assetCandidates;
	const assetKey = assets.map(({ asset }) => asset.id).join(',');
	const portableHomeListingById = React.useMemo(
		() => new Map(portableHomeListings.map((result) => [result.asset.id, result])),
		[portableHomeListings]
	);
	const portableHomeStateKey = React.useMemo(
		() =>
			portableHomeListings
				.map((result) => `${result.asset.id}:${String(result.state.raw['at-slot'] ?? result.state.swapHeight)}`)
				.join(','),
		[portableHomeListings]
	);
	const collectionKey = React.useMemo(
		() =>
			collections
				.map((collection) => `${collection.id}:${collection.assets.map((asset) => asset.id).join('.')}`)
				.sort()
				.concat(computeGateway)
				.join(','),
		[collections, computeGateway]
	);
	const [collectionFloors, setCollectionFloors] = React.useState<Record<string, HomeMarketSummary>>({});
	const [summaryRetry, setSummaryRetry] = React.useState(0);
	const [summaryRetrying, setSummaryRetrying] = React.useState(false);
	const assetSummaryControllers = React.useRef(new Map<string, AbortController>());
	const collectionSummaryControllers = React.useRef(
		new Map<
			string,
			{
				version: string;
				controller: AbortController;
			}
		>()
	);
	const collectionSummaryVersions = React.useRef(new Map<string, string>());
	const collectionActivityScans = React.useRef(new Map<string, HomeActivityScan>());
	const collectionFloorScans = React.useRef(new Map<string, HomeFloorScan>());
	const retryAssetSummaries = React.useRef(new Set<string>());
	const retryCollectionSummaries = React.useRef(new Set<string>());
	const summaryRetryRun = React.useRef<HomeSummaryRetryRun>({ token: 0, pending: new Set() });
	const shouldLoadAssetSummaries = shouldLoadHomeAssetSummaries(homeTab);
	const finishSummaryRetry = React.useCallback((token: number, group: 'assets' | 'collections') => {
		const activeRequests =
			group === 'assets' ? assetSummaryControllers.current.size : collectionSummaryControllers.current.size;
		if (completeHomeSummaryRetryGroup(summaryRetryRun.current, token, group, activeRequests)) {
			setSummaryRetrying(false);
		}
	}, []);
	React.useEffect(
		() => () => {
			for (const controller of assetSummaryControllers.current.values()) controller.abort();
			for (const { controller } of collectionSummaryControllers.current.values()) controller.abort();
			assetSummaryControllers.current.clear();
			collectionSummaryControllers.current.clear();
		},
		[]
	);
	React.useEffect(() => {
		if (!shouldLoadAssetSummaries || !visibleDiscoverTokenKey) {
			setTokenPriceChanges({});
			return;
		}
		const controller = new AbortController();
		const tokenIds = visibleDiscoverTokenKey.split(',');
		const eventLimit = 200;
		setTokenPriceChanges({});
		void discoverCollectionActivity({
			actions: ['make-offer'],
			limit: eventLimit,
			recipients: tokenIds,
			signal: controller.signal,
		}).then(
			(events) => {
				if (controller.signal.aborted) return;
				const now = Date.now();
				const windowComplete = events.length < eventLimit;
				setTokenPriceChanges(
					Object.fromEntries(
						tokenIds.map((tokenId) => [
							tokenId,
							homeTokenPriceChangePercent(
								events.filter((event) => event.processId === tokenId),
								now,
								windowComplete
							),
						])
					)
				);
			},
			() => {
				if (!controller.signal.aborted) {
					setTokenPriceChanges(Object.fromEntries(tokenIds.map((tokenId) => [tokenId, 'unavailable'])));
				}
			}
		);
		return () => controller.abort();
	}, [homeListingSnapshotScope, shouldLoadAssetSummaries, visibleDiscoverTokenKey]);
	React.useEffect(() => {
		if (!marketShellReady || !shouldLoadAssetSummaries) {
			setPortableHomeListingsLoading(false);
			return;
		}
		if (market.error) {
			setPortableHomeListingsLoading(false);
			return;
		}
		const computeCircuitScope = `${computeGateway}|${portableHomeRetry}`;
		const computeCircuit = portableHomeComputeCircuit.current;
		recordHomeListingComputeResult(computeCircuit, computeCircuitScope);
		if (computeCircuit.failure !== undefined) {
			setPortableHomeListingsLoading(false);
			setPortableHomeListingsFailure({
				status: 'unavailable',
				source: 'compute',
				kind: marketplaceFailureKind(computeCircuit.failure),
			});
			return;
		}
		const controller = new AbortController();
		let disposed = false;
		setPortableHomeListingsLoading(true);
		setPortableHomeListingsComplete(false);
		setPortableHomeListingsFailure(undefined);
		const publications = createAnimationFrameBatch<
			ListingResolutionOutcome | { processId: string; state: AssetState; provider: string; refresh: true }
		>((batch) => {
			const settledIds = new Set(batch.map((publication) => publication.processId));
			setCachedHomeListings((current) => current.filter((listing) => !settledIds.has(listing.asset.id)));
			setPortableHomeListings((current) => {
				const results = new Map(current.map((result) => [result.asset.id, result]));
				for (const publication of batch) {
					if ('refresh' in publication) {
						const previous = results.get(publication.processId);
						if (previous) {
							const updated = {
								...previous,
								state: publication.state,
								provider: publication.provider,
							};
							if (isLiveListing(updated)) results.set(publication.processId, updated);
							else results.delete(publication.processId);
						}
					} else {
						results.delete(publication.processId);
						if (publication.result && isLiveListing(publication.result)) {
							results.set(publication.processId, publication.result);
						}
					}
				}
				return [...results.values()];
			});
		});
		void (async () => {
			let indexFailure: unknown;
			let computeFailure: unknown;
			let computeAttempts = 0;
			let computeFailures = 0;
			let computeCircuitFailure: unknown;
			let discoveryFailure: unknown;
			const collections = marketCollectionsRef.current;
			const resolver = createAssetCandidateResolver(collections, {
				signal: controller.signal,
				concurrency: 8,
				read: (processId, signal) =>
					readAssetStateCached(processId, {
						signal,
						maxAge: HOME_STATE_MAX_AGE,
						maxAttempts: 1,
						staleWhileRevalidate: HOME_STATE_STALE_WHILE_REVALIDATE,
						onRevalidated: (fresh) => {
							if (controller.signal.aborted) return;
							publications.push({
								processId,
								state: fresh.state,
								provider: fresh.provider,
								refresh: true,
							});
						},
					}),
				onSettled: (result, candidate, cause) => {
					if (controller.signal.aborted) return;
					computeAttempts += 1;
					if (cause) {
						computeFailures += 1;
						computeFailure ??= cause;
						computeCircuitFailure ??= recordHomeListingComputeResult(
							computeCircuit,
							computeCircuitScope,
							cause
						);
						if (computeCircuitFailure !== undefined) controller.abort(computeCircuitFailure);
						return;
					}
					recordHomeListingComputeResult(computeCircuit, computeCircuitScope);
					publications.push({ processId: candidate.processId, result });
				},
			});
			let supportTail = Promise.resolve();
			const publishCandidates = (candidates: AssetCandidate[]) => {
				const { supported, unverified } = partitionAssetCandidateSupport(candidates, collections);
				resolver.enqueue(supported);
				if (unverified.length) {
					supportTail = supportTail.then(async () => {
						try {
							const verification = await verifyAssetCandidateSupport(unverified, collections, {
								signal: controller.signal,
								onVerified: (verified) => resolver.enqueue(verified),
							});
							indexFailure ??= verification.unavailable[0]?.error;
						} catch (cause) {
							if (controller.signal.aborted) throw cause;
							indexFailure ??= cause;
						}
					});
				}
			};
			try {
				await discoverMarketActivity({
					listingsOnly: true,
					signal: controller.signal,
					onPage: publishCandidates,
				});
			} catch (cause) {
				if (computeCircuitFailure === undefined) discoveryFailure = cause;
			}
			try {
				await supportTail;
				await resolver.finish();
				controller.signal.throwIfAborted();
				const failure =
					discoveryFailure ??
					indexFailure ??
					homeListingComputeFailure(computeFailure, computeAttempts, computeFailures);
				setPortableHomeListingsComplete(!failure);
				setPortableHomeListingsFailure(
					failure
						? {
								status: 'unavailable',
								source: discoveryFailure || indexFailure ? 'index' : 'compute',
								kind: marketplaceFailureKind(failure),
						  }
						: undefined
				);
			} catch (cause) {
				if (!disposed) {
					setPortableHomeListingsFailure({
						status: 'unavailable',
						source:
							computeCircuitFailure === undefined && (discoveryFailure || indexFailure)
								? 'index'
								: 'compute',
						kind: marketplaceFailureKind(computeCircuitFailure ?? cause),
					});
				}
			} finally {
				if (!disposed) {
					publications.flush();
					setPortableHomeListingsLoading(false);
				}
			}
		})();
		return () => {
			disposed = true;
			controller.abort();
			publications.cancel();
		};
	}, [
		computeGateway,
		listingSupportVersion,
		market.error,
		marketShellReady,
		portableHomeRetry,
		shouldLoadAssetSummaries,
	]);
	React.useEffect(() => {
		if (
			!liveHomeListingShells.length ||
			(!portableHomeListingsComplete && liveHomeListingShells.length < HOME_ASSET_PAGE_SIZE)
		)
			return;
		return scheduleIdleTask(
			() => storeHomeListingSnapshot(window.sessionStorage, homeListingSnapshotScope, liveHomeListingShells),
			250
		);
	}, [homeListingSnapshotScope, liveHomeListingShells, portableHomeListingsComplete]);
	React.useEffect(() => {
		if (!shouldLoadAssetSummaries) {
			for (const controller of assetSummaryControllers.current.values()) controller.abort();
			assetSummaryControllers.current.clear();
			return;
		}
		const visibleAssetIds = new Set(assets.map(({ asset }) => asset.id));
		for (const [assetId, controller] of assetSummaryControllers.current) {
			if (visibleAssetIds.has(assetId)) continue;
			controller.abort();
			assetSummaryControllers.current.delete(assetId);
		}
		setAssetPrices((current) =>
			Object.fromEntries(Object.entries(current).filter(([assetId]) => visibleAssetIds.has(assetId)))
		);
		setAssetImages((current) =>
			Object.fromEntries(Object.entries(current).filter(([assetId]) => visibleAssetIds.has(assetId)))
		);
		const requestedAssetIds = new Set(
			homeSummaryRequestKeys(
				assets.map(({ asset }) => asset.id),
				assetPrices,
				assetSummaryControllers.current.keys(),
				retryAssetSummaries.current
			)
		);
		const requestedAssets = assets.filter(({ asset }) => requestedAssetIds.has(asset.id));
		const retryToken = summaryRetryRun.current.pending.has('assets') ? summaryRetryRun.current.token : null;
		let retryFinished = false;
		const finishRetry = () => {
			if (retryToken === null || retryFinished) return;
			retryFinished = true;
			finishSummaryRetry(retryToken, 'assets');
		};
		retryAssetSummaries.current.clear();
		void mapConcurrent(requestedAssets, 8, async ({ asset, collection }) => {
			const previous = assetSummaryControllers.current.get(asset.id);
			if (previous) previous.abort();
			const controller = new AbortController();
			assetSummaryControllers.current.set(asset.id, controller);
			let trackingRevalidation = false;
			try {
				const publishPrice = (state: AssetState) => {
					const order = bestAskOfAsset(state);
					if (!controller.signal.aborted) {
						const image = collectionAsset(collection, asset.id, state)?.image;
						setAssetPrices((current) => ({
							...current,
							[asset.id]: { status: 'resolved', value: order ? orderPriceLabel(order, state) : null },
						}));
						if (image) {
							setAssetImages((current) =>
								current[asset.id] === image ? current : { ...current, [asset.id]: image }
							);
						}
					}
				};
				const portable = portableHomeListingById.get(asset.id);
				let state = portable?.state;
				if (!state) {
					const computed = await readAssetStateCached(asset.id, {
						signal: controller.signal,
						maxAge: HOME_STATE_MAX_AGE,
						maxAttempts: 1,
						staleWhileRevalidate: HOME_STATE_STALE_WHILE_REVALIDATE,
						onRevalidated: (fresh) => publishPrice(fresh.state),
					});
					state = computed.state;
					if (computed.revalidation) {
						trackingRevalidation = true;
						const finishRevalidation = () => {
							if (assetSummaryControllers.current.get(asset.id) === controller) {
								assetSummaryControllers.current.delete(asset.id);
							}
						};
						void computed.revalidation.then(finishRevalidation, finishRevalidation);
					}
				}
				publishPrice(state);
			} catch (cause) {
				if (!controller.signal.aborted) {
					setAssetPrices((current) => ({
						...current,
						[asset.id]: { status: 'unavailable', source: 'compute', kind: marketplaceFailureKind(cause) },
					}));
				}
			} finally {
				if (!trackingRevalidation && assetSummaryControllers.current.get(asset.id) === controller) {
					assetSummaryControllers.current.delete(asset.id);
				}
			}
		}).then(finishRetry);
	}, [assetKey, finishSummaryRetry, portableHomeStateKey, shouldLoadAssetSummaries, summaryRetry]);
	const marketShellLoading = homeMarketShellLoading(market.loading, market.collections.length);
	const shouldLoadCollectionSummaries = shouldLoadHomeCollectionSummaries(homeTab);
	React.useEffect(() => {
		if (!shouldLoadCollectionSummaries) {
			for (const { controller } of collectionSummaryControllers.current.values()) controller.abort();
			collectionSummaryControllers.current.clear();
			return;
		}
		const visibleCollections = new Map(
			collections.map((collection) => [
				collection.id,
				`${computeGateway}:${collection.id}:${collection.assets
					.map((asset) => asset.id)
					.sort()
					.join('.')}`,
			])
		);
		const changedCollections = new Set<string>();
		for (const [collectionId, request] of collectionSummaryControllers.current) {
			if (visibleCollections.get(collectionId) === request.version) continue;
			request.controller.abort();
			collectionSummaryControllers.current.delete(collectionId);
		}
		for (const [collectionId, version] of collectionSummaryVersions.current) {
			if (visibleCollections.get(collectionId) === version) continue;
			changedCollections.add(collectionId);
			collectionSummaryVersions.current.delete(collectionId);
		}
		for (const collectionId of collectionActivityScans.current.keys()) {
			if (!visibleCollections.has(collectionId)) collectionActivityScans.current.delete(collectionId);
		}
		for (const collectionId of collectionFloorScans.current.keys()) {
			if (!visibleCollections.has(collectionId)) collectionFloorScans.current.delete(collectionId);
		}
		setCollectionFloors((current) =>
			Object.fromEntries(
				Object.entries(current).filter(
					([collectionId]) => visibleCollections.has(collectionId) && !changedCollections.has(collectionId)
				)
			)
		);
		const requestedCollections = collections.filter((collection) => {
			const version = visibleCollections.get(collection.id)!;
			return (
				retryCollectionSummaries.current.has(collection.id) ||
				collectionSummaryVersions.current.get(collection.id) !== version ||
				(!collectionFloors[collection.id] && !collectionSummaryControllers.current.has(collection.id))
			);
		});
		const retryToken = summaryRetryRun.current.pending.has('collections') ? summaryRetryRun.current.token : null;
		let retryFinished = false;
		const finishRetry = () => {
			if (retryToken === null || retryFinished) return;
			retryFinished = true;
			finishSummaryRetry(retryToken, 'collections');
		};
		retryCollectionSummaries.current.clear();
		const requests = requestedCollections.map((collection) =>
			(async () => {
				const version = visibleCollections.get(collection.id)!;
				const previous = collectionSummaryControllers.current.get(collection.id);
				if (previous) previous.controller.abort();
				const controller = new AbortController();
				collectionSummaryControllers.current.set(collection.id, { version, controller });
				collectionSummaryVersions.current.set(collection.id, version);
				try {
					const previousFloorScan = collectionFloorScans.current.get(collection.id);
					const scheduled = new Set<string>();
					const outcomes = new Map<
						string,
						{ candidate: AssetCandidate; asking: bigint | null; failure?: MarketplaceFailureKind }
					>();
					let floorScan: HomeFloorScan | undefined;
					const resolver = createAssetCandidateResolver([collection], {
						concurrency: 4,
						signal: controller.signal,
						read: (processId, signal) =>
							readAssetStateCached(processId, {
								signal,
								maxAge: HOME_STATE_MAX_AGE,
								maxAttempts: 1,
								staleWhileRevalidate: HOME_STATE_STALE_WHILE_REVALIDATE,
							}),
						onSettled: (result, candidate, cause) => {
							if (
								controller.signal.aborted ||
								collectionSummaryControllers.current.get(collection.id)?.controller !== controller ||
								collectionSummaryControllers.current.get(collection.id)?.version !== version
							)
								return;
							const order = !cause && result ? bestAskOfAsset(result.state) : null;
							const outcome = {
								candidate,
								asking: order && result ? unitPriceWinston(order, result.state.denomination) : null,
								...(cause ? { failure: marketplaceFailureKind(cause) } : {}),
							};
							if (
								floorScan?.candidates.get(candidate.processId) ===
								`${candidate.height}:${candidate.timestamp}`
							) {
								commitHomeFloorResult(floorScan, candidate.processId, outcome.asking, outcome.failure);
							} else if (!floorScan) outcomes.set(candidate.processId, outcome);
							if (cause) return;
							const asset = result?.asset ?? collectionAsset(collection, candidate.processId);
							if (!asset) return;
							setVerifiedHomeListings((current) =>
								publishHomeListingResult(current, collection.id, asset, Boolean(order))
							);
							if (!order || !result) return;
							setAssetPrices((current) => ({
								...current,
								[asset.id]: { status: 'resolved', value: orderPriceLabel(order, result.state) },
							}));
							setVerifiedHomeListingActivity((current) => ({
								...current,
								[asset.id]: candidate,
							}));
						},
					});
					const enqueueCandidates = (candidates: AssetCandidate[]) => {
						resolver.enqueue(
							candidates.filter((candidate) => {
								if (
									scheduled.has(candidate.processId) ||
									!homeFloorCandidateNeedsResolution(previousFloorScan, version, candidate)
								)
									return false;
								scheduled.add(candidate.processId);
								return true;
							})
						);
					};
					let candidates: AssetCandidate[];
					if (collection.kind === 'names') {
						const includesCollectionAsset = collectionCandidateMembership(collection);
						candidates = await discoverMarketActivity({
							listingsOnly: true,
							signal: controller.signal,
							acceptProcessId: includesCollectionAsset,
							onPage: enqueueCandidates,
						});
					} else {
						const recipients = [...new Set(collection.assets.map((asset) => asset.id))];
						const scan = reconcileHomeActivityScan(
							collectionActivityScans.current.get(collection.id),
							recipients
						);
						collectionActivityScans.current.set(collection.id, scan);
						const pending = pendingHomeActivityRecipients(scan, recipients);
						if (pending.length) {
							await discoverMarketActivityBatched({
								listingsOnly: true,
								recipients: pending,
								signal: controller.signal,
								onBatch: (batchCandidates, batchRecipients) => {
									if (
										controller.signal.aborted ||
										collectionSummaryControllers.current.get(collection.id)?.controller !==
											controller ||
										collectionSummaryControllers.current.get(collection.id)?.version !== version ||
										collectionActivityScans.current.get(collection.id) !== scan
									)
										return;
									commitHomeActivityBatch(scan, batchCandidates, batchRecipients);
									enqueueCandidates(batchCandidates);
								},
							});
						}
						controller.signal.throwIfAborted();
						if (
							collectionActivityScans.current.get(collection.id) !== scan ||
							recipients.some((recipient) => !scan.completed.has(recipient))
						) {
							controller.abort(new DOMException('Home activity scan replaced.', 'AbortError'));
							controller.signal.throwIfAborted();
						}
						completeHomeActivityScan(scan, recipients);
						candidates = [...scan.candidates.values()];
					}
					enqueueCandidates(candidates);
					floorScan = reconcileHomeFloorScan(previousFloorScan, version, candidates);
					collectionFloorScans.current.set(collection.id, floorScan);
					for (const outcome of outcomes.values()) {
						if (
							floorScan.candidates.get(outcome.candidate.processId) ===
							`${outcome.candidate.height}:${outcome.candidate.timestamp}`
						) {
							commitHomeFloorResult(
								floorScan,
								outcome.candidate.processId,
								outcome.asking,
								outcome.failure
							);
						}
					}
					await resolver.finish();
					controller.signal.throwIfAborted();
					if (collectionFloorScans.current.get(collection.id) !== floorScan) {
						controller.abort(new DOMException('Home floor scan replaced.', 'AbortError'));
						controller.signal.throwIfAborted();
					}
					if (!controller.signal.aborted) {
						const verifiedListingIds = [...floorScan.settled].flatMap(([processId, asking]) =>
							asking === null ? [] : [processId]
						);
						const activityScan = collectionActivityScans.current.get(collection.id);
						setVerifiedHomeListingActivity((current) => {
							const next = { ...current };
							for (const assetId of verifiedListingIds) {
								const candidate = activityScan?.candidates.get(assetId);
								if (candidate) next[assetId] = candidate;
							}
							return next;
						});
						setVerifiedHomeListings((current) => {
							const previous = current[collection.id] ?? [];
							const verifiedListings = reconcileHomeListingAssets(
								previous,
								verifiedListingIds,
								collection
							);
							if (
								previous.length === verifiedListings.length &&
								previous.every((asset, index) => asset === verifiedListings[index])
							)
								return current;
							return { ...current, [collection.id]: verifiedListings };
						});
						setCollectionFloors((current) => ({
							...current,
							[collection.id]: homeFloorScanSummary(floorScan),
						}));
					}
				} catch (cause) {
					if (!controller.signal.aborted) {
						setCollectionFloors((current) => ({
							...current,
							[collection.id]: {
								status: 'unavailable',
								source: 'index',
								kind: marketplaceFailureKind(cause),
							},
						}));
						controller.abort(cause);
					}
				} finally {
					if (collectionSummaryControllers.current.get(collection.id)?.controller === controller) {
						collectionSummaryControllers.current.delete(collection.id);
					}
				}
			})()
		);
		void Promise.all(requests).then(finishRetry);
	}, [collectionKey, computeGateway, finishSummaryRetry, shouldLoadCollectionSummaries, summaryRetry]);
	const collectionActivityKey = React.useMemo(
		() =>
			collections
				.map((collection) => `${collection.id}:${collectionActivityVersion(collection)}`)
				.sort()
				.join('|'),
		[collections]
	);
	React.useEffect(() => {
		if (!shouldLoadCollectionSummaries || collectionSort !== 'recent') return;
		const controller = new AbortController();
		void mapConcurrent(collections, 2, async (collection) => {
			try {
				const events = await discoverCollectionActivityBatched({
					limit: 1,
					recipients: collection.assets.map((asset) => asset.id),
					signal: controller.signal,
				});
				const latest = events[0];
				if (!latest || controller.signal.aborted) return;
				setCollectionActivity((current) => {
					const previous = current[collection.id];
					if (
						previous &&
						(previous.height > latest.height ||
							(previous.height === latest.height && previous.timestamp >= latest.timestamp))
					)
						return current;
					return { ...current, [collection.id]: latest };
				});
			} catch {
				controller.signal.throwIfAborted();
				// Creation time remains a truthful fallback when activity indexing is unavailable.
			}
		});
		return () => controller.abort();
	}, [collectionActivityKey, collectionSort, shouldLoadCollectionSummaries]);
	const summaryFailures = [...Object.values(assetPrices), ...Object.values(collectionFloors)].filter(
		(summary): summary is Extract<HomeMarketSummary, { status: 'unavailable' }> => summary.status === 'unavailable'
	);
	const failedAssetIds = assets
		.map(({ asset }) => asset.id)
		.filter((assetId) => assetPrices[assetId]?.status === 'unavailable');
	const failedCollectionIds = collections
		.map((collection) => collection.id)
		.filter((collectionId) => collectionFloors[collectionId]?.status === 'unavailable');
	const summaryFailureKey = `${failedAssetIds.join(',')}|${failedCollectionIds.join(',')}`;
	const retryMarketSummaries = () => {
		if (summaryRetrying) return;
		retryAssetSummaries.current = new Set(
			assets.map(({ asset }) => asset.id).filter((assetId) => assetPrices[assetId]?.status === 'unavailable')
		);
		retryCollectionSummaries.current = new Set(
			collections
				.map((collection) => collection.id)
				.filter((collectionId) => collectionFloors[collectionId]?.status === 'unavailable')
		);
		const retryGroups = new Set<'assets' | 'collections'>();
		if (retryAssetSummaries.current.size) retryGroups.add('assets');
		if (retryCollectionSummaries.current.size) retryGroups.add('collections');
		if (!retryGroups.size) return;
		summaryRetryRun.current = {
			token: summaryRetryRun.current.token + 1,
			pending: retryGroups,
		};
		setSummaryRetrying(true);
		setSummaryRetry((current) => current + 1);
	};
	React.useEffect(() => {
		if (
			!summaryFailureKey ||
			summaryFailureKey === '|' ||
			summaryRetrying ||
			portableHomeListingsFailure?.source === 'compute'
		)
			return;
		const timer = window.setTimeout(retryMarketSummaries, 15_000);
		return () => window.clearTimeout(timer);
	}, [portableHomeListingsFailure, summaryFailureKey, summaryRetrying]);
	React.useEffect(() => setAssetPage(1), [assetType, assetView, normalizedQuery]);
	React.useEffect(() => setDiscoverTokenPage(1), [assetType, assetView, normalizedQuery]);
	React.useEffect(() => {
		if (assetPage !== assetPagination.page) setAssetPage(assetPagination.page);
	}, [assetPage, assetPagination.page]);
	React.useEffect(() => {
		if (discoverTokenPage !== discoverTokenPagination.page) {
			setDiscoverTokenPage(discoverTokenPagination.page);
		}
	}, [discoverTokenPage, discoverTokenPagination.page]);
	const collectionResultsReady = homeMarketSummariesReady(
		marketShellLoading,
		collections.map((collection) => collection.id),
		collectionFloors
	);
	const assetSummariesRetrying = summaryRetrying && summaryRetryRun.current.pending.has('assets');
	const collectionSummariesRetrying = summaryRetrying && summaryRetryRun.current.pending.has('collections');
	const collectionResultsPending = homeMarketHasPending(
		market.loading || collectionSummariesRetrying || failedCollectionIds.length > 0,
		collections.map((collection) => collection.id),
		collectionFloors
	);
	const discoverResultsPending = homeMarketHasPending(
		market.loading || assetSummariesRetrying || portableHomeListingsLoading || failedAssetIds.length > 0,
		assets.map(({ asset }) => asset.id),
		assetPrices
	);
	const discoverResultsFailed = Boolean(portableHomeListingsFailure) || summaryFailures.length > 0;
	const discoverInitialLoading = homeMarketShowsInitialLoader(discoverResultsPending, displayedAssets.length);
	const pageRefreshing =
		homeTab === 'discover' ? discoverResultsPending : homeTab === 'collections' ? collectionResultsPending : false;
	React.useEffect(() => {
		market.setPageRefreshing(pageRefreshing);
		return () => market.setPageRefreshing(false);
	}, [market.setPageRefreshing, pageRefreshing]);
	const selectHomeTab = (tab: HomeTab) => {
		navigate({ pathname: homeTabPath(tab), search: homeRouteSearch(search) });
		if (marketPaneRef.current) marketPaneRef.current.scrollTop = 0;
	};
	const selectAssetPage = (page: number) => {
		setAssetPage(page);
		marketPaneRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
	};
	const renderTokenList = (items: typeof displayedAssets) => (
		<div className="token-market-list" role="list">
			{items.map(({ asset, collection }, index) => {
				const price = displayAssetPrices[asset.id];
				const change = tokenPriceChanges[asset.id];
				return (
					<TokenMarketRow
						asset={{ ...asset, image: assetImages[asset.id] ?? asset.image }}
						collection={collection}
						context={`Fungible token · ${short(asset.id)}`}
						key={`${collection.id}-${asset.id}`}
						metric={{
							label: 'Unit price',
							value: price ? homeMarketSummaryLabel(price, 'Not listed') : <HomePendingMarketValue />,
							tone: homeMarketSummaryListed(price) ? 'positive' : 'default',
						}}
						secondaryMetric={{
							label: '24h change',
							value:
								change === undefined ? <HomePendingMarketValue /> : homeTokenPriceChangeLabel(change),
							tone:
								typeof change !== 'number'
									? 'muted'
									: change > 0
									? 'positive'
									: change < 0
									? 'negative'
									: 'muted',
						}}
						onWarm={() => prefetchAssetPage(asset.id, true)}
						priority={index < 2}
					/>
				);
			})}
		</div>
	);
	const renderCollectibleGrid = (items: typeof displayedAssets) => (
		<div className="home-asset-grid">
			{items.map(({ asset, collection }, index) => {
				const price = displayAssetPrices[asset.id];
				const pricePending = !price;
				return (
					<Link
						key={`${collection.id}-${asset.id}`}
						to={`/asset/${collection.id}/${asset.id}`}
						onFocus={() => prefetchAssetPage(asset.id, false)}
						onMouseEnter={() => prefetchAssetPage(asset.id, false)}
						onTouchStart={() => prefetchAssetPage(asset.id, false)}
					>
						<DiscoveryAssetArtwork asset={asset} collection={collection} priority={index < 2} />
						<div className="home-asset-details">
							<div>
								<strong>{asset.name}</strong>
								<span>{collection.name}</span>
							</div>
							<b className={`home-asset-price${homeMarketSummaryListed(price) ? ' listed' : ''}`}>
								{!pricePending && price ? (
									homeMarketSummaryLabel(price, 'Not listed')
								) : (
									<HomePendingMarketValue />
								)}
							</b>
						</div>
					</Link>
				);
			})}
		</div>
	);
	return (
		<div className="home-shell">
			<div className="home-main">
				<div className="home-content">
					<div className="home-market-layout">
						<section className="home-section home-assets" id="market" ref={marketPaneRef}>
							<h1 className="sr-only">Marketplace</h1>
							<div className="home-section-heading">
								<div>
									<div aria-label="Marketplace view" className="home-market-tabs" role="tablist">
										<Button
											aria-controls="home-discover-panel"
											aria-selected={homeTab === 'discover'}
											className="home-market-tab"
											id="home-discover-tab"
											onClick={() => selectHomeTab('discover')}
											role="tab"
											size="small"
										>
											<Compass className="ui-icon" aria-hidden="true" />
											Discover
										</Button>
										<Button
											aria-controls="home-collections-panel"
											aria-selected={homeTab === 'collections'}
											className="home-market-tab"
											id="home-collections-tab"
											onClick={() => selectHomeTab('collections')}
											role="tab"
											size="small"
										>
											<LayoutGrid className="ui-icon" aria-hidden="true" />
											Collections
										</Button>
										<Button
											aria-controls="home-activity-panel"
											aria-selected={homeTab === 'activity'}
											className="home-market-tab"
											id="home-activity-tab"
											onClick={() => selectHomeTab('activity')}
											role="tab"
											size="small"
										>
											<History className="ui-icon" aria-hidden="true" />
											Activity
										</Button>
									</div>
									<p>
										{homeTab === 'discover'
											? normalizedQuery
												? `Results for “${query}” across the current Arweave collection indexes.`
												: 'Browse fungible tokens and Uniques on the permaweb.'
											: homeTab === 'collections'
											? 'Browse NFT and name collections.'
											: 'Recent activity of purchases, listings, and transfers across every marketplace collection.'}
									</p>
								</div>
								{homeTab === 'discover' ? (
									<div aria-busy={discoverResultsPending} className="home-asset-filters">
										<MarketSelect<HomeAssetType>
											label="Asset type"
											onChange={setAssetType}
											options={[
												{ value: 'all', label: 'All' },
												{ value: 'tokens', label: 'Tokens' },
												{ value: 'atomic', label: 'Uniques (NFTs)' },
											]}
											value={assetType}
										/>
										<MarketSelect<HomeAssetView>
											label="View"
											onChange={setAssetView}
											options={[
												{ value: 'all', label: 'All records' },
												{ value: 'listed', label: 'Listed for sale' },
												{ value: 'price-low', label: 'Price: low to high' },
												{ value: 'price-high', label: 'Price: high to low' },
											]}
											value={assetView}
										/>
									</div>
								) : homeTab === 'collections' ? (
									<div aria-busy={collectionResultsPending} className="home-asset-filters">
										<MarketSelect<HomeCollectionSort>
											label="Sort collections"
											onChange={setCollectionSort}
											options={[
												{ value: 'recent', label: 'Recent Activity' },
												{ value: 'newest', label: 'Newest' },
												{ value: 'oldest', label: 'Oldest' },
											]}
											value={collectionSort}
										/>
									</div>
								) : null}
							</div>
							{market.error ? <ErrorPanel message={market.error} onRetry={market.retry} /> : null}
							{homeTab === 'discover' && portableHomeListingsFailure ? (
								<ErrorPanel
									message={marketplaceRequestFailureMessage(
										portableHomeListingsFailure.source,
										portableHomeListingsFailure.kind
									)}
									onRetry={() => setPortableHomeRetry((current) => current + 1)}
								/>
							) : null}
							{homeTab === 'discover' && partialTokenCollection ? (
								<div className="collection-source-notice">
									<span role="status">
										Search covers {partialTokenCollection.assets.length.toLocaleString()} of{' '}
										{(
											partialTokenCollection.total ?? partialTokenCollection.assets.length
										).toLocaleString()}{' '}
										discovered token records currently loaded.
									</span>
									<Link
										className="with-icon"
										to={`/collection/${partialTokenCollection.id}?q=${encodeURIComponent(
											query.trim()
										)}`}
									>
										Continue token search
										<ArrowRight className="ui-icon ui-icon--xs" aria-hidden="true" />
									</Link>
								</div>
							) : null}
							{homeTab === 'collections' ? (
								<div
									aria-busy={collectionResultsPending}
									aria-labelledby="home-collections-tab"
									id="home-collections-panel"
									role="tabpanel"
								>
									{collections.length || collectionResultsPending ? (
										<div className="home-feature-grid">
											{collections.map((collection, index) => {
												const image = collection.assets.find((asset) => asset.image)?.image;
												const tokenPreview =
													collection.assets.find((asset) => asset.image) ??
													collection.assets[0];
												const floor = collectionFloors[collection.id];
												const floorPending =
													!floor ||
													(collectionSummariesRetrying && floor.status === 'unavailable');
												return (
													<Link
														className={`home-feature-card feature-${index}`}
														key={collection.id}
														to={`/collection/${collection.id}`}
													>
														<div className="home-feature-art">
															{collection.kind === 'tokens' ? (
																<TokenAvatar
																	className="home-token-collection-art"
																	fetchPriority={index === 0 ? 'high' : 'auto'}
																	image={tokenPreview?.image}
																	loading={index === 0 ? 'eager' : 'lazy'}
																	ticker={tokenPreview?.ticker ?? 'Token'}
																/>
															) : image ? (
																<ArtworkImage
																	src={image}
																	alt=""
																	fetchPriority={index === 0 ? 'high' : 'auto'}
																	loading={index === 0 ? 'eager' : 'lazy'}
																	fallback={
																		<span
																			className="home-image-collection-fallback"
																			aria-hidden="true"
																		>
																			<BazarMark />
																			<strong>
																				{collection.name.replace(
																					/^\[TEST\]\s*/,
																					''
																				)}
																			</strong>
																			<small>Permanent image collection</small>
																		</span>
																	}
																/>
															) : collection.kind === 'names' ? (
																<NamesCubePreview />
															) : (
																<div className="home-name-art">
																	<BazarMark />
																	<span>$AR</span>
																</div>
															)}
															<div className="home-feature-glow" />
														</div>
														<div className="home-feature-copy">
															<h2>{collection.name}</h2>
															<span>{collection.description}</span>
														</div>
														<div className="home-feature-stats">
															<div>
																<span>
																	{collection.kind === 'names' && collection.hasMore
																		? 'Loaded'
																		: 'Assets'}
																</span>
																<strong>
																	{homeCollectionAssetCountLabel(collection)}
																</strong>
															</div>
															<div>
																<span>
																	{collection.hasMore ? 'Loaded floor' : 'Floor'}
																</span>
																<strong
																	className={
																		homeMarketSummaryListed(floor)
																			? 'listed'
																			: undefined
																	}
																>
																	{!floorPending && floor ? (
																		<ArCurrencyText>
																			{homeMarketSummaryLabel(
																				floor,
																				collection.hasMore
																					? 'No loaded listings'
																					: 'No live listings',
																				'N/A'
																			)}
																		</ArCurrencyText>
																	) : (
																		<HomePendingMarketValue />
																	)}
																</strong>
															</div>
														</div>
														<strong className="home-card-action">
															Open collection
															<span>
																<ArrowUpRight
																	className="ui-icon ui-icon--xs"
																	aria-hidden="true"
																/>
															</span>
														</strong>
													</Link>
												);
											})}
											{collectionResultsPending ? (
												<HomeMarketGhostCard kind="collection" />
											) : null}
										</div>
									) : null}
									{collectionResultsReady && !market.error && collections.length === 0 ? (
										<div className="home-no-results">No collections match “{query}”.</div>
									) : null}
								</div>
							) : homeTab === 'activity' ? (
								<HomeActivityPanel collections={market.collections} marketLoading={market.loading} />
							) : (
								<div
									aria-busy={discoverResultsPending}
									aria-labelledby="home-discover-tab"
									id="home-discover-panel"
									role="tabpanel"
								>
									{discoverInitialLoading ? (
										<div className="home-market-loading">
											<Loading label="Loading marketplace assets…" />
										</div>
									) : displayedAssets.length ? (
										assetType === 'all' ? (
											<div className="discover-market-sections">
												<section className="discover-market-section token-section">
													<div className="discover-market-heading">
														<div>
															<p className="eyebrow">Fungible assets</p>
															<h2>Tokens</h2>
														</div>
														<Button size="custom" onClick={() => setAssetType('tokens')}>
															View all tokens
															<ArrowRight
																className="ui-icon ui-icon--xs"
																aria-hidden="true"
															/>
														</Button>
													</div>
													{discoverTokens.length ? (
														<>
															{renderTokenList(discoverTokenPagination.items)}
															<Pagination
																ariaLabel="Token overview pages"
																className="discover-token-pagination"
																onPageChange={setDiscoverTokenPage}
																page={discoverTokenPagination.page}
																pageCount={discoverTokenPagination.pageCount}
															/>
														</>
													) : (
														<p className="discover-section-empty">
															No tokens match this view.
														</p>
													)}
												</section>
												<section className="discover-market-section collectible-section">
													<div className="discover-market-heading">
														<div>
															<p className="eyebrow">1/1 assets</p>
															<h2>Uniques</h2>
														</div>
														<Button size="custom" onClick={() => setAssetType('atomic')}>
															View all Uniques
															<ArrowRight
																className="ui-icon ui-icon--xs"
																aria-hidden="true"
															/>
														</Button>
													</div>
													{discoverCollectibles.length ? (
														renderCollectibleGrid(discoverCollectibles.slice(0, 12))
													) : (
														<p className="discover-section-empty">
															No Uniques match this view.
														</p>
													)}
												</section>
											</div>
										) : (
											<>
												{assetType === 'tokens'
													? renderTokenList(assetPagination.items)
													: renderCollectibleGrid(assetPagination.items)}
												<Pagination
													ariaLabel={assetType === 'tokens' ? 'Token pages' : 'Unique pages'}
													className="home-asset-pagination"
													onPageChange={selectAssetPage}
													page={assetPagination.page}
													pageCount={assetPagination.pageCount}
												/>
											</>
										)
									) : discoverResultsFailed ? null : (
										<div className="home-assets-empty">
											{assetView === 'all'
												? 'No records match this type.'
												: 'No live listings match this type.'}
										</div>
									)}
								</div>
							)}
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}

const globalActivityCollections = new WeakMap<Collection[], Map<string, Collection>>();

export function globalActivityCollection(collections: Collection[], processId: string) {
	if (!isVisibleAssetId(processId)) return undefined;
	let indexed = globalActivityCollections.get(collections);
	if (!indexed) {
		indexed = new Map();
		for (const collection of collections) {
			const processIds =
				collection.kind === 'names'
					? Object.keys(collection.namespace?.namesById ?? {})
					: collection.assets.map((asset) => asset.id);
			for (const id of processIds) {
				if (isVisibleAssetId(id)) indexed.set(id, collection);
			}
		}
		globalActivityCollections.set(collections, indexed);
	}
	return indexed.get(processId);
}

export type GlobalActivityFilter = 'all' | CollectionActivityEvent['action'];

export function filterGlobalActivity(events: CollectionActivityEvent[], filter: GlobalActivityFilter) {
	if (filter === 'all') return events;
	return events.filter(
		(event) => event.action === filter && (filter !== 'register-interest' || Boolean(event.purchaseProof))
	);
}

function HomeActivityPanel({ collections, marketLoading }: { collections: Collection[]; marketLoading: boolean }) {
	const [events, setEvents] = React.useState<CollectionActivityEvent[]>([]);
	const [discoveredAssets, setDiscoveredAssets] = React.useState<Record<string, ResolvedAsset>>({});
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [retry, setRetry] = React.useState(0);
	const [activityFilter, setActivityFilter] = React.useState<GlobalActivityFilter>('all');
	const [activityLimit, setActivityLimit] = React.useState(20);
	const [activityRevealAnnouncement, setActivityRevealAnnouncement] = React.useState('');
	const eventsRef = React.useRef(events);
	const scopeRef = React.useRef('');
	const activityListId = React.useId();
	const activityRevealRef = React.useRef<HTMLParagraphElement>(null);
	const eventCountRef = React.useRef(events.length);
	eventsRef.current = events;
	eventCountRef.current = events.length;
	const activityScope = collections
		.map((collection) => `${collection.id}:${collectionActivityVersion(collection)}`)
		.sort()
		.join('|');

	React.useEffect(() => {
		setActivityLimit(20);
		setActivityRevealAnnouncement('');
	}, [activityFilter, activityScope]);

	React.useEffect(() => {
		if (!activityScope || scopeRef.current === activityScope) return;
		try {
			const cachedEvents = loadMarketActivity(window.localStorage, activityScope).filter((event) =>
				Boolean(globalActivityCollection(collections, event.processId))
			);
			if (!cachedEvents.length) return;
			scopeRef.current = activityScope;
			eventsRef.current = cachedEvents;
			setEvents(cachedEvents);
			setDiscoveredAssets({});
		} catch {
			// Browser storage is optional; live Arweave discovery continues below.
		}
	}, [activityScope, collections]);

	React.useEffect(() => {
		if (marketLoading) return;
		if (!collections.length) {
			setEvents([]);
			setLoading(false);
			return;
		}
		const controller = new AbortController();
		const sameScope = scopeRef.current === activityScope;
		let cachedEvents: CollectionActivityEvent[] = [];
		if (!sameScope) {
			try {
				cachedEvents = loadMarketActivity(window.localStorage, activityScope).filter((event) =>
					Boolean(globalActivityCollection(collections, event.processId))
				);
			} catch {
				// Browser storage is optional; live Arweave discovery continues below.
			}
		}
		const initialEvents = sameScope && eventsRef.current.length ? eventsRef.current : cachedEvents;
		const preserveEvents = initialEvents.length > 0;
		const found = new Map(initialEvents.map((event) => [event.id, event]));
		scopeRef.current = activityScope;
		if (!preserveEvents) {
			eventsRef.current = [];
			setEvents([]);
			setDiscoveredAssets({});
		} else if (!sameScope) {
			eventsRef.current = initialEvents;
			setEvents(initialEvents);
			setDiscoveredAssets({});
		}
		setLoading(true);
		setError(null);
		const publish = (nextEvents: CollectionActivityEvent[]) => {
			if (controller.signal.aborted) return;
			for (const event of nextEvents) {
				const previous = found.get(event.id);
				found.set(
					event.id,
					previous?.purchaseProof && !event.purchaseProof
						? { ...event, purchaseProof: previous.purchaseProof }
						: event
				);
			}
			eventsRef.current = newestCollectionActivity([...found.values()]);
			setEvents(eventsRef.current);
		};
		const knownMembership = (processId: string) => globalActivityCollection(collections, processId);
		const unknownEvents = new Map<string, CollectionActivityEvent[]>();
		const resolvedUnknown = new Map<string, ResolvedAsset>();
		const pendingUnknownSettlements = new Set<string>();
		let settlementFrame: number | undefined;
		const flushUnknownSettlements = () => {
			if (settlementFrame !== undefined) window.cancelAnimationFrame(settlementFrame);
			settlementFrame = undefined;
			if (controller.signal.aborted || !pendingUnknownSettlements.size) return;
			const settled = [...pendingUnknownSettlements];
			pendingUnknownSettlements.clear();
			setDiscoveredAssets((current) => ({
				...current,
				...Object.fromEntries(settled.map((processId) => [processId, resolvedUnknown.get(processId)!])),
			}));
			publish(settled.flatMap((processId) => unknownEvents.get(processId) ?? []));
		};
		const resolver = createAssetCandidateResolver(collections, {
			signal: controller.signal,
			concurrency: 2,
			read: (processId, signal) => readAssetStateCached(processId, { signal, maxAttempts: 1 }),
			onSettled: (result, candidate) => {
				if (!result || controller.signal.aborted) return;
				resolvedUnknown.set(candidate.processId, result);
				pendingUnknownSettlements.add(candidate.processId);
				settlementFrame ??= window.requestAnimationFrame(flushUnknownSettlements);
			},
		});
		const supportFailures: unknown[] = [];
		let supportTail = Promise.resolve();
		const acceptPage = (pageEvents: CollectionActivityEvent[]) => {
			const known = pageEvents.filter((event) => knownMembership(event.processId));
			const unknown = pageEvents.filter((event) => !knownMembership(event.processId));
			if (known.length) publish(known);
			const candidates: AssetCandidate[] = [];
			const resolvedEvents: CollectionActivityEvent[] = [];
			for (const event of unknown) {
				const processEvents = unknownEvents.get(event.processId);
				if (processEvents) {
					processEvents.push(event);
				} else {
					unknownEvents.set(event.processId, [event]);
					candidates.push({
						processId: event.processId,
						height: event.height,
						timestamp: event.timestamp,
						sources: ['market-action'],
					});
				}
				if (resolvedUnknown.has(event.processId)) resolvedEvents.push(event);
			}
			if (resolvedEvents.length) publish(resolvedEvents);
			if (candidates.length) {
				supportTail = supportTail.then(async () => {
					try {
						await verifyAssetCandidateSupport(candidates, collections, {
							signal: controller.signal,
							onVerified: (verified) => resolver.enqueue(verified),
						});
					} catch (cause) {
						if (controller.signal.aborted) throw cause;
						supportFailures.push(cause);
					}
				});
			}
		};
		const requests = [
			discoverCollectionActivity({
				signal: controller.signal,
				limit: 200,
				onPage: acceptPage,
			}),
		];
		void Promise.allSettled(requests).then(async (outcomes) => {
			if (controller.signal.aborted) return;
			const failures = outcomes.flatMap((outcome) => (outcome.status === 'rejected' ? [outcome.reason] : []));
			try {
				await supportTail;
				await resolver.finish();
			} catch (cause) {
				if (controller.signal.aborted) return;
				failures.push(cause);
			}
			flushUnknownSettlements();
			failures.push(...supportFailures);
			eventsRef.current = newestCollectionActivity([...found.values()]);
			try {
				eventsRef.current = await confirmPurchaseActivity(eventsRef.current, {
					signal: controller.signal,
					readCurrent: (processId, signal) => readAssetStateCached(processId, { signal, maxAttempts: 1 }),
				});
			} catch (cause) {
				if (controller.signal.aborted) return;
				failures.push(cause);
			}
			setEvents(eventsRef.current);
			try {
				saveMarketActivity(
					window.localStorage,
					activityScope,
					eventsRef.current.filter((event) => knownMembership(event.processId))
				);
			} catch {
				// The live result remains available even when storage is unavailable.
			}
			if (failures.length) {
				const kind = failures.some((cause) => marketplaceFailureKind(cause) === 'rate-limited')
					? 'rate-limited'
					: 'unavailable';
				setError(marketplaceRequestFailureMessage('index', kind));
			}
			setLoading(false);
		});
		return () => {
			controller.abort();
			if (settlementFrame !== undefined) window.cancelAnimationFrame(settlementFrame);
		};
	}, [activityScope, marketLoading, retry]);

	const filteredEvents = filterGlobalActivity(events, activityFilter);
	eventCountRef.current = filteredEvents.length;
	const activityFilters: Array<{ value: GlobalActivityFilter; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'make-offer', label: 'Listings' },
		{ value: 'register-interest', label: 'Confirmed purchases' },
		{ value: 'transfer', label: 'Transfers' },
		{ value: 'cancel-order', label: 'Cancellations' },
	];
	const retryActivity = () => {
		if (loading) return;
		setActivityRevealAnnouncement('');
		setRetry((value) => value + 1);
	};
	const resolveCollection = (event: CollectionActivityEvent) =>
		globalActivityCollection(collections, event.processId) ?? discoveredAssets[event.processId]?.collection;
	return (
		<div
			aria-busy={loading}
			aria-labelledby="home-activity-tab"
			className="home-activity-panel"
			id="home-activity-panel"
			role="tabpanel"
		>
			<div aria-label="Filter global activity" className="activity-filters" role="group">
				{activityFilters.map((filter) => {
					const count = filterGlobalActivity(events, filter.value).length;
					return (
						<Button
							aria-controls={activityListId}
							aria-pressed={activityFilter === filter.value}
							className="activity-filter"
							key={filter.value}
							onClick={() => setActivityFilter(filter.value)}
							size="small"
						>
							<span>{filter.label}</span>
							<span aria-hidden="true" className="activity-filter-count">
								{count.toLocaleString()}
							</span>
						</Button>
					);
				})}
			</div>
			{error ? (
				events.length ? (
					<div className="collection-source-notice home-activity-partial-notice retry-notice">
						<span role="status">
							Compute hasn’t completed yet. Please try again. Showing {events.length.toLocaleString()}{' '}
							indexed {events.length === 1 ? 'event' : 'events'} already loaded.
						</span>
						<Button className="with-icon" onClick={retryActivity} size="custom" type="button">
							<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
						</Button>
					</div>
				) : (
					<ErrorPanel message={`Global activity could not be loaded. ${error}`} onRetry={retryActivity} />
				)
			) : null}
			<MarketActivityList
				ariaLabel={`Global market activity, ${
					activityFilters.find((filter) => filter.value === activityFilter)?.label
				}`}
				events={filteredEvents.slice(0, activityLimit)}
				id={activityListId}
				loading={loading}
				resolveAsset={(event) => {
					const collection = resolveCollection(event);
					return (
						discoveredAssets[event.processId]?.asset ??
						(collection ? collectionAsset(collection, event.processId) : undefined)
					);
				}}
				resolveCollection={resolveCollection}
			/>
			<p
				className={
					activityRevealAnnouncement && filteredEvents.length > 20 && activityLimit >= filteredEvents.length
						? 'collection-result-count reveal-complete'
						: 'sr-only'
				}
				aria-live="polite"
				ref={activityRevealRef}
				role="status"
				tabIndex={-1}
			>
				{activityRevealAnnouncement}
			</p>
			{activityLimit < filteredEvents.length ? (
				<Button
					aria-controls={activityListId}
					className="load-more"
					size="custom"
					type="button"
					onClick={() => {
						const nextLimit = Math.min(filteredEvents.length, activityLimit + 20);
						setActivityLimit(nextLimit);
						setActivityRevealAnnouncement(
							`Showing ${nextLimit.toLocaleString()} of ${filteredEvents.length.toLocaleString()} filtered global activity events.`
						);
						window.requestAnimationFrame(() => {
							if (assetGroupRevealComplete(nextLimit, eventCountRef.current)) {
								activityRevealRef.current?.focus();
							}
						});
					}}
				>
					Show {Math.min(20, filteredEvents.length - activityLimit).toLocaleString()} more activity events
				</Button>
			) : null}
			{loading && !events.length ? <Loading label="Reading global market activity from Arweave…" /> : null}
			{!loading && !error && events.length > 0 && !filteredEvents.length ? (
				<div className="empty-state">
					<h3>No matching activity</h3>
					<p>No submitted actions match this activity filter in the current indexed window.</p>
				</div>
			) : null}
			{!loading && !error && !events.length ? (
				<div className="empty-state">
					<h3>No indexed market activity yet</h3>
					<p>
						The current marketplace collections have no matching signed market actions in the Arweave index.
					</p>
				</div>
			) : null}
		</div>
	);
}

function GatewayControl() {
	const { pageRefreshing } = React.useContext(MarketContext);
	const computeNodes = servingNodeOrigins(window.location);
	const computeCurrent = computeNodes.join(', ');
	const [computeValue, setComputeValue] = React.useState(computeCurrent);
	const [open, setOpen] = React.useState(false);
	const [error, setError] = React.useState('');
	const detailsRef = React.useRef<HTMLDetailsElement>(null);
	const triggerRef = React.useRef<HTMLElement>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);
	React.useEffect(() => {
		if (!open) return;
		const focusFrame = window.requestAnimationFrame(() => inputRef.current?.focus());
		const closeOutside = (event: PointerEvent) => {
			if (event.target instanceof Node && !detailsRef.current?.contains(event.target)) setOpen(false);
		};
		const closeWithEscape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			setOpen(false);
			window.requestAnimationFrame(() => triggerRef.current?.focus());
		};
		document.addEventListener('pointerdown', closeOutside, true);
		document.addEventListener('keydown', closeWithEscape, true);
		return () => {
			window.cancelAnimationFrame(focusFrame);
			document.removeEventListener('pointerdown', closeOutside, true);
			document.removeEventListener('keydown', closeWithEscape, true);
		};
	}, [open]);
	function apply(event: React.FormEvent) {
		event.preventDefault();
		const computeOrigins = normalizeServingNodeOrigins(computeValue, window.location.protocol);
		if (!computeOrigins) {
			setError('Enter one or more HTTP or HTTPS HyperBEAM peers, separated by commas.');
			return;
		}
		setError('');
		const url = new URL(window.location.href);
		url.searchParams.set('node', computeOrigins.join(','));
		window.location.assign(url);
	}
	return (
		<div className="gateway-control">
			{pageRefreshing ? (
				<Tooltip content="Some assets on this page are still being refreshed on your configured nodes.">
					{(tooltipId) => (
						<span
							aria-describedby={tooltipId}
							aria-label="Some assets on this page are still being refreshed on your configured nodes."
							className="gateway-refreshing"
							role="status"
							tabIndex={0}
						>
							<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />
						</span>
					)}
				</Tooltip>
			) : null}
			<details className="gateway" open={open} ref={detailsRef}>
				<summary
					aria-controls="gateway-panel"
					aria-expanded={open}
					aria-label={`Compute peers, ${computeCurrent}`}
					onClick={(event) => {
						event.preventDefault();
						setOpen((currentOpen) => !currentOpen);
					}}
					ref={triggerRef}
					role="button"
				>
					<Tooltip
						align="center"
						className="gateway-trigger-tooltip"
						content="AO-Core peers"
						delayMs={1000}
						disabled={open}
					>
						{(tooltipId) => (
							<span aria-describedby={tooltipId} className="gateway-summary-content">
								<PortalIcon className="ui-icon gateway-portal-icon" aria-hidden="true" />
								<span className="gateway-label">Gateway</span>
							</span>
						)}
					</Tooltip>
				</summary>
				<div id="gateway-panel">
					<form onSubmit={apply}>
						<label>
							<span>Change AO-Core peers</span>
							<span className="gateway-peer-description" id="gateway-peer-description">
								If you would like to use different machines for your computer, enter in below
							</span>
							<input
								aria-describedby={`gateway-peer-description${error ? ' gateway-error' : ''}`}
								aria-invalid={Boolean(error)}
								onChange={(event) => {
									setComputeValue(event.target.value);
									setError('');
								}}
								ref={inputRef}
								value={computeValue}
							/>
						</label>
						{error ? (
							<p className="gateway-error" id="gateway-error" role="alert">
								{error}
							</p>
						) : null}
						<div className="gateway-apply-row">
							<Button className="gateway-apply-button with-icon" type="submit" size="custom">
								<PortalIcon className="ui-icon gateway-portal-icon" aria-hidden="true" /> Apply peers
							</Button>
							<Tooltip
								className="gateway-peer-help"
								content={
									<>
										Bazar is a fully decentralized marketplace: Operated by everyone, owned by
										nobody. By default, your requests are handled by the computer that gave you this
										page. If you would like to use different machines for your compute, just enter
										their address above.
									</>
								}
							>
								{(tooltipId) => (
									<Button
										aria-describedby={tooltipId}
										aria-label="About compute peers"
										className="gateway-peer-help-trigger"
										size="custom"
										type="button"
										variant="ghost"
									>
										<Info className="ui-icon ui-icon--sm" aria-hidden="true" />
									</Button>
								)}
							</Tooltip>
						</div>
					</form>
				</div>
			</details>
		</div>
	);
}

type MarketSelectOption<Value extends string> = {
	value: Value;
	label: string;
};

export function MarketSelect<Value extends string>({
	label,
	value,
	options,
	onChange,
	showLabel = true,
}: {
	label: string;
	value: Value;
	options: readonly MarketSelectOption<Value>[];
	onChange(value: Value): void;
	showLabel?: boolean;
}) {
	const [open, setOpen] = React.useState(false);
	const rootRef = React.useRef<HTMLDivElement>(null);
	const triggerRef = React.useRef<HTMLButtonElement>(null);
	const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
	const menuId = React.useId();
	const selectedIndex = Math.max(
		0,
		options.findIndex((option) => option.value === value)
	);
	const selected = options[selectedIndex];

	React.useEffect(() => {
		if (!open) return;
		const closeOnOutsidePress = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			setOpen(false);
			triggerRef.current?.focus();
		};
		document.addEventListener('pointerdown', closeOnOutsidePress);
		document.addEventListener('keydown', closeOnEscape);
		return () => {
			document.removeEventListener('pointerdown', closeOnOutsidePress);
			document.removeEventListener('keydown', closeOnEscape);
		};
	}, [open]);

	const focusOption = (index: number) => {
		const normalizedIndex = (index + options.length) % options.length;
		optionRefs.current[normalizedIndex]?.focus();
	};
	const openAndFocus = (index = selectedIndex) => {
		setOpen(true);
		window.requestAnimationFrame(() => focusOption(index));
	};
	const selectOption = (option: MarketSelectOption<Value>) => {
		onChange(option.value);
		setOpen(false);
		triggerRef.current?.focus();
	};
	const leaveOptions = (backwards: boolean) => {
		const trigger = triggerRef.current;
		const tabStops = [
			...document.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
			),
		].filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
		const triggerIndex = trigger ? tabStops.indexOf(trigger) : -1;
		const target = backwards ? trigger : tabStops[triggerIndex + 1];
		target?.focus();
		setOpen(false);
	};

	return (
		<div
			className="market-select"
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
			}}
			ref={rootRef}
		>
			{showLabel ? <span className="market-select-label">{label}</span> : null}
			<Button
				aria-controls={menuId}
				aria-expanded={open}
				aria-haspopup="listbox"
				aria-label={formatArCurrencyText(`${label}: ${selected.label}`)}
				className={`market-select-trigger${open ? ' open' : ''}`}
				size="custom"
				onClick={() => (open ? setOpen(false) : openAndFocus())}
				onKeyDown={(event) => {
					if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
					event.preventDefault();
					openAndFocus(event.key === 'ArrowDown' ? selectedIndex : selectedIndex - 1);
				}}
				ref={triggerRef}
				type="button"
			>
				<span>
					<ArCurrencyText>{selected.label}</ArCurrencyText>
				</span>
				<ChevronDown aria-hidden="true" />
			</Button>
			{open ? (
				<div aria-label={label} className="market-select-menu" id={menuId} role="listbox">
					{options.map((option, index) => {
						const active = option.value === value;
						return (
							<Button
								aria-selected={active}
								className={`market-select-option${active ? ' active' : ''}`}
								key={option.value}
								size="custom"
								onClick={() => selectOption(option)}
								onKeyDown={(event) => {
									if (event.key === 'Tab') {
										event.preventDefault();
										leaveOptions(event.shiftKey);
									} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
										event.preventDefault();
										focusOption(index + (event.key === 'ArrowDown' ? 1 : -1));
									} else if (event.key === 'Home' || event.key === 'End') {
										event.preventDefault();
										focusOption(event.key === 'Home' ? 0 : options.length - 1);
									}
								}}
								ref={(element) => {
									optionRefs.current[index] = element;
								}}
								role="option"
								tabIndex={-1}
								variant="ghost"
								type="button"
							>
								<span>
									<ArCurrencyText>{option.label}</ArCurrencyText>
								</span>
								{active ? <Check aria-hidden="true" /> : null}
							</Button>
						);
					})}
				</div>
			) : null}
		</div>
	);
}

type CollectionCardPrice =
	| { status: 'resolved'; label: string | null }
	| { status: 'unindexed' }
	| { status: 'unavailable'; kind: MarketplaceFailureKind };

type FailedListingCandidate = {
	candidate: AssetCandidate;
	kind: MarketplaceFailureKind;
};

type ListingResolutionOutcome = {
	processId: string;
	result: ResolvedAsset | null;
};

type CollectionListingPublication = {
	outcome: ListingResolutionOutcome;
	price: CollectionCardPrice;
	resolved: number;
	failures: number;
	rateLimited: number;
};

export function createAnimationFrameBatch<T>(
	publish: (values: T[]) => void,
	requestFrame: (callback: FrameRequestCallback) => number = (callback) => window.requestAnimationFrame(callback),
	cancelFrame: (handle: number) => void = (handle) => window.cancelAnimationFrame(handle)
) {
	let frame: number | undefined;
	let pending: T[] = [];
	const publishPending = () => {
		if (!pending.length) return;
		const values = pending;
		pending = [];
		publish(values);
	};
	const flush = () => {
		if (frame !== undefined) cancelFrame(frame);
		frame = undefined;
		publishPending();
	};
	return {
		push(value: T) {
			pending.push(value);
			frame ??= requestFrame(() => {
				frame = undefined;
				publishPending();
			});
		},
		flush,
		cancel() {
			if (frame !== undefined) cancelFrame(frame);
			frame = undefined;
			pending = [];
		},
	};
}

export function collectionActivityVersion(collection: Collection) {
	if (collection.kind === 'names') return collection.namespace?.manifestId ?? '';
	return `${collection.manifestId ?? ''}:${collection.assets.map((asset) => asset.id).join('.')}`;
}

export function newestCollectionActivity(events: CollectionActivityEvent[], limit = 100) {
	const byId = new Map<string, CollectionActivityEvent>();
	for (const event of events) {
		const previous = byId.get(event.id);
		byId.set(
			event.id,
			previous?.purchaseProof && !event.purchaseProof
				? { ...event, purchaseProof: previous.purchaseProof }
				: event
		);
	}
	return [...byId.values()]
		.sort((a, b) => b.height - a.height || b.timestamp - a.timestamp || a.id.localeCompare(b.id))
		.slice(0, limit);
}

export function retainNewestCollectionActivity(
	events: Map<string, CollectionActivityEvent>,
	additions: CollectionActivityEvent[],
	limit = 100
) {
	const retained = newestCollectionActivity([...events.values(), ...additions], limit);
	events.clear();
	for (const event of retained) events.set(event.id, event);
	return retained;
}

export function collectionListingScopeVersion(collection: Collection) {
	return collection.kind === 'tokens'
		? collection.manifestId ?? collection.id
		: collectionActivityVersion(collection);
}

export function collectionAssetWindowDelta(previousIds: Iterable<string>, currentIds: string[]) {
	const previous = new Set(previousIds);
	const current = new Set(currentIds);
	const reset = [...previous].some((assetId) => !current.has(assetId));
	return {
		reset,
		added: reset ? currentIds : currentIds.filter((assetId) => !previous.has(assetId)),
	};
}

export function collectionActivityWindowDelta(
	kind: Collection['kind'],
	listedOnly: boolean,
	previousIds: Iterable<string>,
	currentIds: string[]
) {
	const recipientBatched = kind !== 'names' || !listedOnly;
	const window = collectionAssetWindowDelta(previousIds, currentIds);
	return {
		recipientBatched,
		reset: recipientBatched && window.reset,
		added: recipientBatched ? window.added : currentIds,
	};
}

export function collectionCandidateMembership(collection: Collection) {
	if (collection.kind === 'names') {
		const namesById = collection.namespace?.namesById ?? {};
		return (processId: string) => isVisibleAssetId(processId) && Object.hasOwn(namesById, processId);
	}
	const assetIds = new Set(collection.assets.filter((asset) => isVisibleAssetId(asset.id)).map((asset) => asset.id));
	return (processId: string) => isVisibleAssetId(processId) && assetIds.has(processId);
}

export function collectionDefaultsToListed(collectionId: string) {
	return collectionId === 'arweave-names';
}

export function compareCollectionAssetNames(a: AssetSummary, b: AssetSummary) {
	return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

export type ListingAnnouncementProgress = {
	scope: string;
	resolved: number;
	failures: number;
};

export function nextListingAnnouncementProgress(
	previous: ListingAnnouncementProgress,
	current: ListingAnnouncementProgress & { total: number; loading: boolean }
): ListingAnnouncementProgress {
	const reset = previous.scope !== current.scope || current.resolved < previous.resolved;
	const baseline = reset ? { scope: current.scope, resolved: 0, failures: 0 } : previous;
	if (!current.loading) {
		return { scope: current.scope, resolved: current.resolved, failures: current.failures };
	}
	const milestone = Math.max(10, Math.ceil(current.total / 10));
	const resolved = Math.floor(current.resolved / milestone) * milestone;
	return resolved > baseline.resolved ? { scope: current.scope, resolved, failures: current.failures } : baseline;
}

export function mergeResolvedListingBatch(current: ResolvedAsset[], outcomes: Iterable<ListingResolutionOutcome>) {
	const byProcessId = new Map(current.map((result) => [result.asset.id, result]));
	for (const { processId, result } of outcomes) {
		byProcessId.delete(processId);
		if (result && isLiveListing(result)) byProcessId.set(processId, result);
	}
	return [...byProcessId.values()];
}

export function useProgressiveAssetPageSize() {
	const query = '(max-width: 480px)';
	const [pageSize, setPageSize] = React.useState(() => (window.matchMedia(query).matches ? 8 : 12));
	React.useEffect(() => {
		const media = window.matchMedia(query);
		const update = () => setPageSize(media.matches ? 8 : 12);
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	}, []);
	return pageSize;
}

function CollectionRoute() {
	const { collectionId = '' } = useParams();
	return <CollectionView key={collectionId} />;
}

export function CollectionDescription({ description }: { description: string }) {
	const text = description.trim();
	const contentId = React.useId();
	const paragraphRef = React.useRef<HTMLParagraphElement>(null);
	const [expanded, setExpanded] = React.useState(false);
	const [overflowing, setOverflowing] = React.useState(false);

	React.useEffect(() => {
		const paragraph = paragraphRef.current;
		if (!paragraph) return;
		let disposed = false;
		const update = () => {
			if (disposed || !paragraph.classList.contains('is-collapsed')) return;
			const next = paragraph.scrollHeight > paragraph.clientHeight + 1;
			setOverflowing((current) => (current === next ? current : next));
		};
		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
		observer?.observe(paragraph);
		window.addEventListener('resize', update);
		void document.fonts?.ready.then(update);
		update();
		return () => {
			disposed = true;
			observer?.disconnect();
			window.removeEventListener('resize', update);
		};
	}, [expanded, text]);

	if (!text) return null;
	return (
		<div className="collection-description">
			<p className={expanded ? undefined : 'is-collapsed'} id={contentId} ref={paragraphRef}>
				{text}
			</p>
			{overflowing ? (
				<Button
					aria-controls={contentId}
					aria-expanded={expanded}
					className="collection-description-toggle"
					onClick={() => setExpanded((current) => !current)}
					size="custom"
					variant="ghost"
				>
					Show {expanded ? 'less' : 'more'}
					<ChevronDown aria-hidden="true" />
				</Button>
			) : null}
		</div>
	);
}

function CollectionView() {
	const { collectionId = '' } = useParams();
	const { search } = useLocation();
	const market = React.useContext(MarketContext);
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
	const [query, setQuery] = React.useState(routedQuery);
	const deferredQuery = React.useDeferredValue(query);
	const pageSize = useProgressiveAssetPageSize();
	const [limit, setLimit] = React.useState(pageSize);
	const [listedOnly, setListedOnly] = React.useState(() => collectionDefaultsToListed(collectionId));
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
		source: MarketplaceRequestSource;
		kind: MarketplaceFailureKind;
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
		loading: false,
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
	const [recentOrderRetry, setRecentOrderRetry] = React.useState(0);
	const [recentOrderState, setRecentOrderState] = React.useState<{
		loading: boolean;
		error: MarketplaceFailureKind | null;
	}>({ loading: false, error: null });
	const recentOrderScope = React.useRef('');
	const recentOrderActivity = React.useRef(new Map<string, AssetCandidate>());
	const recentOrderResolvedIds = React.useRef(new Set<string>());
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
		void import('api/asset-mint')
			.then(({ CollectionMintClient }) =>
				new CollectionMintClient().estimateAppend(ownedCollection, appendFiles, controller.signal)
			)
			.then(
				(estimate) => {
					if (!controller.signal.aborted) setAppendEstimate(estimate);
				},
				(cause) => {
					if (!controller.signal.aborted) setAppendError(errorMessage(cause));
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
			const { CollectionMintClient } = await import('api/asset-mint');
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
			const message = errorMessage(cause);
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
	const listedIdsKey = listed
		.map((result) => result.asset.id)
		.sort()
		.join(',');
	const filtered = React.useMemo(
		() =>
			visibleAssets
				.filter(
					(asset) =>
						assetMatchesCollectionQuery(asset, deferredQuery) &&
						(initial === 'all' || asset.name.trim().toLowerCase().startsWith(initial.toLowerCase()))
				)
				.sort((a, b) => {
					if (initial !== 'all') return compareCollectionAssetNames(a, b);
					if (!recentOrderState.error) {
						const activityA = activityByAsset.get(a.id);
						const activityB = activityByAsset.get(b.id);
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
		[
			activityByAsset,
			collection?.kind,
			defaultIndex,
			deferredQuery,
			initial,
			recentOrderState.error,
			recentOrderState.loading,
			visibleAssets,
		]
	);
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
	const activityRequestMode = listedOnly ? 'listed' : 'recent';
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
					error: marketplaceRequestFailureMessage('index', marketplaceFailureKind(cause)),
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
		const nextScope = `${gateway}:${collection.id}:${listedOnly ? 'listed' : 'all'}`;
		if (priceScope.current !== nextScope) {
			priceScope.current = nextScope;
			resolvedPriceIds.current.clear();
			setCardPrices({});
			setCardPricesFailure(null);
		}
		if (listedOnly) return;
		const controller = new AbortController();
		const unresolvedAssets = visiblePriceAssets.filter((asset) => !resolvedPriceIds.current.has(asset.id));
		setCardPricesLoading(Boolean(unresolvedAssets.length));
		setCardPricesFailure(null);
		if (!unresolvedAssets.length) return () => controller.abort();
		void (async () => {
			try {
				await discoverMarketActivityBatched({
					recipients: unresolvedAssets.map((asset) => asset.id),
					listingsOnly: true,
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
								concurrency: 4,
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
									setCardPrices((current) => ({
										...current,
										[candidate.processId]: cause
											? { status: 'unavailable', kind: marketplaceFailureKind(cause) }
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
					setCardPricesFailure({ source: 'index', kind: marketplaceFailureKind(cause) });
				}
			} finally {
				if (!controller.signal.aborted) setCardPricesLoading(false);
			}
		})();
		return () => controller.abort();
	}, [collection, gateway, listedOnly, priceRetry, visiblePriceKey]);
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
			listedOnly,
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
			if (listedOnly) setCardPricesLoading(false);
			return () => controller.abort();
		}
		if (listedOnly) {
			if (!continuing) setCardPrices({});
			setCardPricesLoading(true);
			setCardPricesFailure(null);
		}
		const publications = createListingPublications();
		void (async () => {
			try {
				const resolver = listedOnly
					? createAssetCandidateResolver([collection], {
							concurrency: 4,
							signal: controller.signal,
							read: (processId, signal) =>
								readAssetStateCached(processId, {
									...DISPLAY_STATE_CACHE,
									signal,
									maxAttempts: 1,
								}),
							onSettled: (result, candidate, cause) => {
								if (controller.signal.aborted || listingActivityScope.current !== listingScope) return;
								const outcome: ListingResolutionOutcome & {
									candidate: AssetCandidate;
									failureKind?: MarketplaceFailureKind;
								} = {
									candidate,
									processId: candidate.processId,
									result,
									...(cause ? { failureKind: marketplaceFailureKind(cause) } : {}),
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
								if (controller.signal.aborted || listingActivityScope.current !== listingScope || cause)
									return;
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
					  })
					: null;
				const resolvePage = (page: AssetCandidate[]) => {
					if (controller.signal.aborted) return;
					const pageCandidates = page.filter((candidate) => includesCollectionAsset(candidate.processId));
					const newCandidates = pageCandidates.filter(
						(candidate) => !listingActivityCandidates.current.has(candidate.processId)
					);
					for (const candidate of pageCandidates) {
						listingActivityCandidates.current.set(candidate.processId, candidate);
					}
					if (!listedOnly) {
						setActivity(
							[...listingActivityCandidates.current.values()].sort(
								(a, b) =>
									b.height - a.height ||
									b.timestamp - a.timestamp ||
									a.processId.localeCompare(b.processId)
							)
						);
					}
					setActivityState((current) => ({
						...current,
						pages: current.pages + 1,
						total: current.total + newCandidates.length,
					}));
					if (!listedOnly) return;
					resolver?.enqueue(newCandidates);
				};
				let allActivity: AssetCandidate[] = [];
				let discoveryFailure: unknown;
				try {
					allActivity =
						collection.kind === 'names' && listedOnly
							? await discoverMarketActivity({
									signal: controller.signal,
									listingsOnly: listedOnly,
									acceptProcessId: includesCollectionAsset,
									onPage: resolvePage,
							  })
							: await discoverMarketActivityBatched({
									recipients: requestedAssetIds,
									signal: controller.signal,
									listingsOnly: listedOnly,
									onBatch: (candidates, completedRecipients) => {
										resolvePage(candidates);
										if (controller.signal.aborted || listingActivityScope.current !== listingScope)
											return;
										for (const assetId of completedRecipients)
											listingLoadedAssetIds.current.add(assetId);
									},
							  });
				} catch (cause) {
					discoveryFailure = cause;
				}
				await resolver?.finish();
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
				if (!listedOnly) {
					const mergedCandidates = [...listingActivityCandidates.current.values()].sort(
						(a, b) =>
							b.height - a.height || b.timestamp - a.timestamp || a.processId.localeCompare(b.processId)
					);
					setActivity(mergedCandidates);
					setActivityState((current) => ({
						...current,
						loading: false,
						resolved: mergedCandidates.length,
						total: mergedCandidates.length,
					}));
					return;
				}
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
					if (listedOnly) {
						setCardPricesLoading(false);
						setCardPricesFailure({ source: 'index', kind: marketplaceFailureKind(cause) });
					}
					setActivityState((current) => ({
						...current,
						loading: false,
						error: marketplaceRequestFailureMessage('index', marketplaceFailureKind(cause)),
					}));
				}
			}
		})();
		return () => {
			controller.abort();
			publications.cancel();
		};
	}, [listedOnly, listingScope, listingWindowVersion, retry]);
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
					concurrency: 4,
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
							failureKind?: MarketplaceFailureKind;
						} = {
							candidate,
							processId: candidate.processId,
							result,
							...(cause ? { failureKind: marketplaceFailureKind(cause) } : {}),
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
	React.useEffect(() => {
		if (!collection || !listedOnly) {
			recentOrderScope.current = '';
			recentOrderActivity.current.clear();
			recentOrderResolvedIds.current.clear();
			setRecentOrderState({ loading: false, error: null });
			return;
		}
		const controller = new AbortController();
		const recipients = listed.map((result) => result.asset.id);
		const scope = collection.id;
		if (recentOrderScope.current !== scope) {
			recentOrderScope.current = scope;
			recentOrderActivity.current.clear();
			recentOrderResolvedIds.current.clear();
		}
		const activeIds = new Set(recipients);
		for (const id of recentOrderResolvedIds.current) {
			if (!activeIds.has(id)) recentOrderResolvedIds.current.delete(id);
		}
		for (const id of recentOrderActivity.current.keys()) {
			if (!activeIds.has(id)) recentOrderActivity.current.delete(id);
		}
		if (!recipients.length) {
			setActivity([]);
			setRecentOrderState({ loading: false, error: null });
			return () => controller.abort();
		}
		const pendingRecipients = recipients.filter((id) => !recentOrderResolvedIds.current.has(id));
		if (!pendingRecipients.length) {
			setActivity(
				[...recentOrderActivity.current.values()].sort(
					(a, b) => b.height - a.height || b.timestamp - a.timestamp || a.processId.localeCompare(b.processId)
				)
			);
			setRecentOrderState({ loading: false, error: null });
			return () => controller.abort();
		}
		setRecentOrderState({ loading: true, error: null });
		void discoverMarketActivityBatched({
			recipients: pendingRecipients,
			signal: controller.signal,
			onBatch: (latest, completedRecipients) => {
				if (controller.signal.aborted || recentOrderScope.current !== scope) return;
				for (const id of completedRecipients) recentOrderResolvedIds.current.add(id);
				for (const candidate of latest) recentOrderActivity.current.set(candidate.processId, candidate);
				setActivity(
					[...recentOrderActivity.current.values()].sort(
						(a, b) =>
							b.height - a.height || b.timestamp - a.timestamp || a.processId.localeCompare(b.processId)
					)
				);
			},
		}).then(
			() => {
				if (!controller.signal.aborted) {
					setActivity(
						[...recentOrderActivity.current.values()].sort(
							(a, b) =>
								b.height - a.height ||
								b.timestamp - a.timestamp ||
								a.processId.localeCompare(b.processId)
						)
					);
					setRecentOrderState({ loading: false, error: null });
				}
			},
			(cause) => {
				if (!controller.signal.aborted) {
					setRecentOrderState({ loading: false, error: marketplaceFailureKind(cause) });
				}
			}
		);
		return () => controller.abort();
	}, [collection?.id, listedIdsKey, listedOnly, recentOrderRetry]);
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
			: 'Finding recent activity on Arweave…'
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
			: `Finding recent activity in ${collection.name}.`
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
		<section className="collection-page">
			<Link className="back" to="/">
				<ArrowLeft className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
				{collection.kind === 'tokens' ? 'Discover' : 'All collections'}
			</Link>
			<div className="collection-title">
				<div className="collection-heading-copy">
					<p className="eyebrow">{collectionEyebrow(collection)}</p>
					<h1>{collectionDisplayName(collection)}</h1>
					<CollectionDescription description={collection.description} />
				</div>
				{collection.kind === 'images' && ownedCollection?.owner === wallet.address ? (
					<div className="collection-title-copy">
						<Button onClick={() => setAppendOpen(true)} type="button" variant="neutral">
							<Images aria-hidden="true" /> Add assets
						</Button>
					</div>
				) : null}
			</div>
			{appendOpen && ownedCollection ? (
				<div className="dialog-backdrop" role="presentation">
					<section
						aria-labelledby="append-collection-title"
						aria-modal="true"
						className="dialog dialog-compact collection-append-dialog"
						role="dialog"
					>
						<div className="dialog-heading">
							<div>
								<p className="eyebrow">Extend collection</p>
								<h2 id="append-collection-title">Add assets to {collection.name}</h2>
							</div>
							<Button
								aria-label="Close add assets"
								disabled={appendWorking}
								onClick={() => setAppendOpen(false)}
								size="icon"
								type="button"
								variant="ghost"
							>
								<X aria-hidden="true" />
							</Button>
						</div>
						<p className="append-collection-copy">
							Each image becomes a wallet-owned Arweave asset. A new immutable manifest then updates the
							collection carrier.
						</p>
						<label className={`mint-dropzone${appendFiles.length ? ' has-file' : ''}`}>
							<input
								accept="image/png,image/jpeg,image/webp,image/gif"
								disabled={appendWorking}
								multiple
								onChange={(event) => {
									setAppendFiles(Array.from(event.target.files ?? []).slice(0, 10));
									setAppendError(null);
								}}
								type="file"
							/>
							<span>
								<Upload aria-hidden="true" />
								<strong>
									{appendFiles.length ? `${appendFiles.length} images ready` : 'Choose images'}
								</strong>
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
					</section>
				</div>
			) : null}
			<CollectionTabs collection={collection} active="assets" />
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
				<div className="asset-tools">
					<input
						aria-controls={assetGridId}
						aria-describedby={resultSummaryId}
						aria-label={`Search ${collection.name}`}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search this collection"
					/>
					<div className="asset-tools-controls">
						<div className="asset-filters single-filter">
							<MarketSelect<'all' | 'listed'>
								label="Show"
								onChange={(nextValue) => setListedOnly(nextValue === 'listed')}
								options={[
									{ value: 'all', label: 'All assets' },
									{ value: 'listed', label: 'Listed for sale' },
								]}
								value={listedOnly ? 'listed' : 'all'}
							/>
						</div>
						<span id={resultSummaryId} ref={collectionStatusRef} tabIndex={-1}>
							{resultSummary}
						</span>
					</div>
					<CollectionResultStatus message={resultAnnouncement} />
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
				<div className="inline-error retry-notice">
					<span role="status">Compute hasn’t completed yet. Please try again.</span>
					<Button
						className="with-icon"
						size="custom"
						onClick={() => {
							setRetry((value) => value + 1);
							window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
						}}
					>
						<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
					</Button>
				</div>
			) : null}
			{!listedOnly && !cardPricesLoading && (cardPricesFailure || visibleUnavailablePrices > 0) ? (
				<div className="inline-error retry-notice">
					<span role="status">
						Compute hasn’t completed yet. Please try again.
						{!cardPricesFailure && visibleUnavailablePrices
							? ` ${visibleUnavailablePrices.toLocaleString()} visible ${
									visibleUnavailablePrices === 1 ? 'price remains' : 'prices remain'
							  } unavailable.`
							: ''}
					</span>
					<Button className="with-icon" type="button" onClick={retryCardPrices} size="custom">
						<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />
						Retry
					</Button>
				</div>
			) : null}
			{listedOnly && !activityState.loading && !activityState.error && activityState.failures ? (
				<div className="inline-error retry-notice">
					<span role="status">
						{listingRetrying
							? 'Rechecking only the listing candidates that were unavailable.'
							: 'Compute hasn’t completed yet. Please try again.'}{' '}
						{activityState.failures.toLocaleString()} listing{' '}
						{activityState.failures === 1 ? 'candidate remains' : 'candidates remain'} unavailable. Resolved
						listings remain visible.
					</span>
					<Button
						className="with-icon"
						disabled={listingRetrying}
						size="custom"
						type="button"
						onClick={() => {
							setListingRetry((value) => value + 1);
							window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
						}}
					>
						<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
					</Button>
				</div>
			) : null}
			{listedOnly && (recentOrderState.loading || recentOrderState.error) ? (
				<div className={recentOrderState.error ? 'inline-error retry-notice' : 'collection-source-notice'}>
					<span role="status">
						{recentOrderState.loading
							? 'Ordering live listings by their latest indexed market activity…'
							: 'Compute hasn’t completed yet. Please try again. Resolved listings are shown in Default order.'}
					</span>
					{recentOrderState.error ? (
						<Button
							className="with-icon"
							size="custom"
							type="button"
							onClick={() => {
								setRecentOrderRetry((value) => value + 1);
								window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
							}}
						>
							<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
						</Button>
					) : null}
				</div>
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
					className={`asset-grid${collection.kind === 'names' ? ' names-collection-grid' : ''}`}
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
				<div className="empty-state">
					<h3>
						{query
							? `No live listings match “${query}”`
							: initial !== 'all'
							? `No live listings begin with ${initial}`
							: activityState.failures
							? 'No live listings yet'
							: pagedTokenScope
							? 'No live listings in loaded tokens'
							: 'No live listings found'}
					</h3>
					<p>
						{query || initial !== 'all'
							? 'Clear the current filters to see every live listing.'
							: activityState.failures
							? 'Some candidates could not be checked through this compute gateway. Retry them before treating this as an empty market.'
							: pagedTokenScope
							? `Every offer candidate among the ${collection.assets.length.toLocaleString()} loaded tokens was checked against current process state. Load more tokens to extend this market view.`
							: activityState.total
							? `Every indexed offer candidate was checked against current process state through ${gateway}; none remains live.`
							: 'Arweave returned no indexed offer candidates for this collection window. Live state remains the marketplace truth once a candidate is found.'}
					</p>
					{query || initial !== 'all' ? (
						<Button type="button" onClick={clearCollectionFilters} size="custom">
							Clear filters
						</Button>
					) : null}
				</div>
			) : null}
			{!listedOnly && !filtered.length ? (
				<div className="collection-empty-state">
					<span>
						<Search className="ui-icon" aria-hidden="true" />
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
				<div
					className="inline-error retry-notice"
					ref={(node) => {
						moreOutcomeRef.current = node;
					}}
					tabIndex={-1}
				>
					<span role="status">Compute hasn’t completed yet. Please try again.</span>
					<Button
						className="with-icon"
						size="custom"
						type="button"
						onClick={() => {
							void loadMore();
							window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
						}}
					>
						<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
					</Button>
				</div>
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
		</section>
	);
}

function collectionAppendPhaseLabel(phase: CollectionMintPhase) {
	if (phase.kind === 'asset') {
		const action = phase.phase.startsWith('signing') ? 'Approve in your wallet' : 'Uploading to Arweave';
		return `Asset ${phase.index + 1} of ${phase.total} · ${action}`;
	}
	if (phase.kind === 'manifest')
		return phase.phase === 'signing' ? 'Approve the new manifest' : 'Publishing manifest';
	return phase.phase === 'signing' ? 'Approve the collection update' : 'Updating collection carrier';
}

function CollectionResultStatus({ message }: { message: string }) {
	return (
		<span aria-live="polite" className="sr-only" role="status">
			{message}
		</span>
	);
}

function CollectionIndexNotice({
	collection,
	checking,
	onRetry,
}: {
	collection: Collection;
	checking: boolean;
	directlyVerified?: boolean;
	onRetry(): void;
}) {
	if (collection.indexSource !== 'compiled-fallback') return null;
	const message = checking
		? 'Checking compute. This page remains available while the check finishes.'
		: 'Compute hasn’t completed yet. Please try again.';
	const compactMessage = checking ? 'Checking compute…' : 'Compute hasn’t completed yet. Please try again.';
	return (
		<div className="collection-source-notice collection-index-notice retry-notice">
			<span role="status">
				<span aria-hidden="true" className="collection-index-message-full">
					{message}
				</span>
				<span aria-hidden="true" className="collection-index-message-compact">
					{compactMessage}
				</span>
				<span className="sr-only">{message}</span>
			</span>
			<Button
				aria-disabled={checking}
				aria-label="Retry"
				className="with-icon"
				size="custom"
				type="button"
				onClick={() => {
					if (!checking) onRetry();
				}}
			>
				<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />
				<span aria-hidden="true" className="collection-index-action-full">
					Retry
				</span>
				<span aria-hidden="true" className="collection-index-action-compact">
					Retry
				</span>
			</Button>
		</div>
	);
}

function CollectionActivityView() {
	const { collectionId = '' } = useParams();
	const market = React.useContext(MarketContext);
	const collection = market.collections.find((item) => item.id === collectionId);
	const [events, setEvents] = React.useState<CollectionActivityEvent[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [pages, setPages] = React.useState(0);
	const [preservingEvents, setPreservingEvents] = React.useState(false);
	const [retry, setRetry] = React.useState(0);
	const [activityLimit, setActivityLimit] = React.useState(20);
	const [activityRevealAnnouncement, setActivityRevealAnnouncement] = React.useState('');
	const eventsRef = React.useRef<CollectionActivityEvent[]>([]);
	const activityBatchEvents = React.useRef(new Map<string, CollectionActivityEvent>());
	const activityLoadedAssetIds = React.useRef(new Set<string>());
	const activityRunMode = React.useRef<'refresh' | 'retry'>('refresh');
	const scopeRef = React.useRef('');
	const activityListId = React.useId();
	const activityRevealRef = React.useRef<HTMLParagraphElement>(null);
	const eventCountRef = React.useRef(events.length);
	eventCountRef.current = events.length;
	const activityScope = React.useMemo(
		() =>
			collection
				? `${collection.id}:${
						collection.kind === 'names'
							? collectionActivityVersion(collection)
							: collection.manifestId ?? collection.id
				  }`
				: '',
		[collection]
	);
	const activityWindowVersion = React.useMemo(
		() => collection?.assets.map((asset) => asset.id).join('.') ?? '',
		[collection?.assets]
	);

	React.useEffect(() => {
		setActivityLimit(20);
		setActivityRevealAnnouncement('');
	}, [activityScope]);

	React.useEffect(() => {
		if (!collection) return;
		const controller = new AbortController();
		const includesCollectionAsset = collectionCandidateMembership(collection);
		const sameScope = scopeRef.current === activityScope;
		let cachedEvents: CollectionActivityEvent[] = [];
		if (!sameScope) {
			try {
				cachedEvents = loadMarketActivity(window.localStorage, activityScope).filter((event) =>
					includesCollectionAsset(event.processId)
				);
			} catch {
				// Browser storage is optional; live Arweave discovery continues below.
			}
		}
		const assetIds = collection.assets.map((asset) => asset.id);
		const assetWindow = collectionAssetWindowDelta(activityLoadedAssetIds.current, assetIds);
		const retryMissing =
			collection.kind !== 'names' && sameScope && !assetWindow.reset && activityRunMode.current === 'retry';
		const continueWindow =
			collection.kind !== 'names' && sameScope && !assetWindow.reset && assetWindow.added.length > 0;
		const incremental = retryMissing || continueWindow;
		const initialEvents = sameScope && eventsRef.current.length ? eventsRef.current : cachedEvents;
		const preserveEvents = initialEvents.length > 0;
		let nextEvents = newestCollectionActivity(initialEvents);
		scopeRef.current = activityScope;
		activityRunMode.current = 'refresh';
		if (!incremental) {
			activityBatchEvents.current.clear();
			activityLoadedAssetIds.current.clear();
			retainNewestCollectionActivity(activityBatchEvents.current, initialEvents);
		}
		if (!preserveEvents) {
			eventsRef.current = [];
			setEvents([]);
		} else if (!sameScope) {
			eventsRef.current = initialEvents;
			setEvents(initialEvents);
		}
		setPreservingEvents(preserveEvents);
		setLoading(true);
		setPages(0);
		setError(null);
		const discovery =
			collection.kind === 'names'
				? discoverCollectionActivity({
						signal: controller.signal,
						limit: 100,
						acceptProcessId: includesCollectionAsset,
						requiredExecutionDevice: 'carrier@1.0',
						onPage: (page) => {
							if (controller.signal.aborted) return;
							nextEvents = newestCollectionActivity([...nextEvents, ...page]);
							setPages((current) => current + 1);
							eventsRef.current = nextEvents;
							setEvents(eventsRef.current);
						},
				  })
				: discoverCollectionActivityBatched({
						signal: controller.signal,
						limit: 100,
						recipients: incremental
							? assetIds.filter((assetId) => !activityLoadedAssetIds.current.has(assetId))
							: assetIds,
						onBatch: (batchEvents, completedRecipients) => {
							if (controller.signal.aborted || scopeRef.current !== activityScope) return;
							for (const assetId of completedRecipients) activityLoadedAssetIds.current.add(assetId);
							setPages((current) => current + 1);
							eventsRef.current = retainNewestCollectionActivity(
								activityBatchEvents.current,
								batchEvents
							);
							setEvents(eventsRef.current);
						},
				  });
		void discovery.then(
			() => {
				if (!controller.signal.aborted) {
					eventsRef.current =
						collection.kind === 'names'
							? newestCollectionActivity(nextEvents)
							: newestCollectionActivity([...activityBatchEvents.current.values()]);
					setEvents(eventsRef.current);
					try {
						saveMarketActivity(window.localStorage, activityScope, eventsRef.current);
					} catch {
						// The live result remains available when storage is unavailable.
					}
					setLoading(false);
					setPreservingEvents(false);
				}
			},
			(cause) => {
				if (!controller.signal.aborted) {
					setError(marketplaceRequestFailureMessage('index', marketplaceFailureKind(cause)));
					setLoading(false);
				}
			}
		);
		return () => controller.abort();
	}, [activityScope, activityWindowVersion, retry]);

	if (!collection && market.loading)
		return (
			<RouteState title="Collection activity">
				<Loading label="Reading collection index…" />
			</RouteState>
		);
	if (!collection && market.error)
		return (
			<RouteState title="Activity unavailable">
				<ErrorPanel message={market.error} onRetry={market.retry} />
			</RouteState>
		);
	if (!collection)
		return (
			<RouteState title="Collection not found">
				<ErrorPanel message="This collection could not be found on Arweave." />
			</RouteState>
		);
	const activityScanAnnouncement = collectionActivityScanAnnouncement({
		error: Boolean(error),
		events: events.length,
		loading,
		pages,
		preservingEvents,
	});
	return (
		<section className="collection-page collection-activity-page">
			<Link className="back" to="/">
				<ArrowLeft className="ui-icon ui-icon--sm" aria-hidden="true" /> All collections
			</Link>
			<div className="collection-title">
				<div className="collection-heading-copy">
					<p className="eyebrow">Arweave activity</p>
					<h1>{collection.name}</h1>
					<CollectionDescription description={collection.description} />
				</div>
			</div>
			<CollectionTabs collection={collection} active="activity" />
			<span aria-live="polite" className="sr-only" role="status">
				{activityScanAnnouncement}
			</span>
			<CollectionIndexNotice collection={collection} checking={market.loading} onRetry={market.retry} />
			{collection.kind === 'tokens' && collection.hasMore ? (
				<div className="collection-source-notice">
					<span role="status">
						This feed covers {collection.assets.length.toLocaleString()} of{' '}
						{(collection.total ?? collection.assets.length).toLocaleString()} discovered tokens currently
						loaded in the collection.
					</span>
					<Link className="with-icon" to={`/collection/${collection.id}`}>
						Open collection to load more
						<ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
					</Link>
				</div>
			) : null}
			{error ? (
				<ErrorPanel
					message={`Activity scanning was interrupted. ${
						events.length ? `${events.length.toLocaleString()} existing events remain visible. ` : ''
					}${error}`}
					onRetry={() => {
						setActivityRevealAnnouncement('');
						activityRunMode.current = 'retry';
						setRetry((value) => value + 1);
					}}
				/>
			) : null}
			<MarketActivityList
				ariaLabel="Recent market activity"
				collectionId={collection.id}
				events={events.slice(0, activityLimit)}
				id={activityListId}
				loading={loading}
				resolveAsset={(event) => collectionAsset(collection, event.processId)}
			/>
			<p
				className={
					activityRevealAnnouncement && events.length > 20 && activityLimit >= events.length
						? 'collection-result-count reveal-complete'
						: 'sr-only'
				}
				aria-live="polite"
				ref={activityRevealRef}
				role="status"
				tabIndex={-1}
			>
				{activityRevealAnnouncement}
			</p>
			{activityLimit < events.length ? (
				<Button
					aria-controls={activityListId}
					className="load-more"
					size="custom"
					type="button"
					onClick={() => {
						const nextLimit = Math.min(events.length, activityLimit + 20);
						setActivityLimit(nextLimit);
						setActivityRevealAnnouncement(
							`Showing ${nextLimit.toLocaleString()} of ${events.length.toLocaleString()} indexed activity events.`
						);
						window.requestAnimationFrame(() => {
							if (assetGroupRevealComplete(nextLimit, eventCountRef.current)) {
								activityRevealRef.current?.focus();
							}
						});
					}}
				>
					Show {Math.min(20, events.length - activityLimit).toLocaleString()} more activity events
				</Button>
			) : null}
			{loading && !events.length ? <Loading label="Reading indexed collection activity from Arweave…" /> : null}
			{!loading && !error && !events.length ? (
				<div className="empty-state">
					<h3>No indexed market activity yet</h3>
					<p>This collection has no matching signed market actions in the current Arweave index.</p>
				</div>
			) : null}
		</section>
	);
}

export function collectionActivityScanAnnouncement({
	error,
	events,
	loading,
	pages,
	preservingEvents,
}: {
	error: boolean;
	events: number;
	loading: boolean;
	pages: number;
	preservingEvents: boolean;
}) {
	if (!loading) {
		return error
			? `Activity scanning stopped. ${events.toLocaleString()} previously indexed ${
					events === 1 ? 'event remains' : 'events remain'
			  } visible.`
			: `Activity scan complete. ${events.toLocaleString()} indexed ${events === 1 ? 'event' : 'events'} found.`;
	}
	if (pages === 0) {
		return preservingEvents
			? 'Refreshing indexed activity from Arweave. Existing events remain visible.'
			: 'Reading indexed activity from Arweave.';
	}
	const milestone = pages < 10 ? 1 : Math.floor(pages / 10) * 10;
	return `${preservingEvents ? 'Activity refresh' : 'Activity scan'} checked ${milestone.toLocaleString()} ${
		milestone === 1 ? 'batch' : 'batches'
	} so far.`;
}

function CollectionTabs({ collection, active }: { collection: Collection; active: 'assets' | 'activity' }) {
	return (
		<nav className="collection-tabs" aria-label={`${collectionDisplayName(collection)} views`}>
			<Link
				aria-current={active === 'assets' ? 'page' : undefined}
				className={active === 'assets' ? 'active' : ''}
				to={`/collection/${collection.id}`}
			>
				{collection.kind === 'tokens' ? (
					<BarChart3 className="ui-icon ui-icon--sm" aria-hidden="true" />
				) : (
					<LayoutGrid className="ui-icon ui-icon--sm" aria-hidden="true" />
				)}{' '}
				{collection.kind === 'tokens' ? 'Tokens' : 'Assets'}
			</Link>
			<Link
				aria-current={active === 'activity' ? 'page' : undefined}
				className={active === 'activity' ? 'active' : ''}
				to={`/collection/${collection.id}/activity`}
			>
				<History className="ui-icon ui-icon--sm" aria-hidden="true" /> Activity
			</Link>
		</nav>
	);
}

export const AssetCard = React.memo(function AssetCard({
	collection,
	asset,
	badge,
	price,
	priceListed = false,
	collectionContext = false,
	priority = false,
}: {
	collection: Collection;
	asset: AssetSummary;
	badge?: string;
	price?: string;
	priceListed?: boolean;
	collectionContext?: boolean;
	priority?: boolean;
}) {
	return (
		<Link
			className={`asset-card${collection.kind === 'tokens' ? ' token-asset-card' : ''}${
				collectionContext ? ' collection-context' : ''
			}`}
			onFocus={() => prefetchAssetPage(asset.id, collection.kind === 'tokens')}
			onMouseEnter={() => prefetchAssetPage(asset.id, collection.kind === 'tokens')}
			onTouchStart={() => prefetchAssetPage(asset.id, collection.kind === 'tokens')}
			to={`/asset/${collection.id}/${asset.id}`}
		>
			<div className="asset-media">
				{collection.kind === 'tokens' && collectionContext ? (
					<TokenAvatar
						fetchPriority={priority ? 'high' : 'auto'}
						image={asset.image}
						loading={priority ? 'eager' : 'lazy'}
						ticker={asset.ticker ?? 'Token'}
					/>
				) : asset.image ? (
					<ArtworkImage
						src={asset.image}
						fetchPriority={priority ? 'high' : 'auto'}
						loading={priority ? 'eager' : 'lazy'}
						alt=""
					/>
				) : isAudioContentType(asset.contentType) ? (
					<AudioArtwork contentType={asset.contentType} name={asset.name} />
				) : collection.kind === 'tokens' ? (
					<TokenAvatar
						fetchPriority={priority ? 'high' : 'auto'}
						image={asset.image}
						loading={priority ? 'eager' : 'lazy'}
						ticker={asset.ticker ?? 'Token'}
					/>
				) : (
					<span>{asset.name.slice(0, 1)}</span>
				)}
			</div>
			<div className="asset-card-copy">
				{!collectionContext ? <p>{collection.name}</p> : null}
				<div className="asset-card-heading">
					<h3>{asset.name}</h3>
					{price ? <strong className={priceListed ? 'listed' : undefined}>{price}</strong> : null}
				</div>
				{badge ? <span className="asset-card-status">{badge}</span> : null}
				{!collectionContext ? <span>{short(asset.id)}</span> : null}
			</div>
		</Link>
	);
});

export function AssetCardArtwork({
	asset,
	collection,
	priority = false,
}: {
	asset: AssetSummary;
	collection: Collection;
	priority?: boolean;
}) {
	return (
		<div className="asset-media">
			{asset.image ? (
				<ArtworkImage
					src={asset.image}
					fetchPriority={priority ? 'high' : 'auto'}
					loading={priority ? 'eager' : 'lazy'}
					alt=""
				/>
			) : isAudioContentType(asset.contentType) ? (
				<AudioArtwork contentType={asset.contentType} name={asset.name} />
			) : collection.kind === 'tokens' ? (
				<TokenArtwork className="circle-only-token-art" ticker={asset.ticker ?? 'Token'} />
			) : (
				<span>{asset.name.slice(0, 1)}</span>
			)}
		</div>
	);
}

export function DiscoveryAssetArtwork({
	asset,
	collection,
	priority = false,
}: {
	asset: AssetSummary;
	collection: Collection;
	priority?: boolean;
}) {
	if (asset.image) {
		return (
			<ArtworkImage
				className="home-asset-media"
				src={asset.image}
				alt=""
				fetchPriority={priority ? 'high' : 'auto'}
				loading={priority ? 'eager' : 'lazy'}
			/>
		);
	}
	if (isAudioContentType(asset.contentType)) {
		return <AudioArtwork className="home-asset-media" contentType={asset.contentType} name={asset.name} />;
	}
	if (collection.kind === 'names') {
		return <NameArtwork className="home-asset-media" name={asset.name} />;
	}
	return (
		<TokenArtwork
			className={`home-asset-media home-token-art${collection.kind === 'tokens' ? ' circle-only-token-art' : ''}`}
			ticker={asset.ticker ?? 'Token'}
		/>
	);
}

export type CandidateSupportFailure = { candidate: AssetCandidate; error: unknown };
export type WalletResolutionStatus = {
	phase: 'discovering' | 'resolving' | 'revalidating' | 'done' | 'error';
	discoveryComplete: boolean;
	discovered: number;
	resolved: number;
	total: number;
	failures: number;
	indexFailures: number;
	rateLimited: number;
	indexRateLimited: number;
	revalidated?: number;
	revalidationTotal?: number;
	error: string | null;
};

export function refreshCandidateRetryMetadata(
	candidate: AssetCandidate,
	computeFailures: Map<string, AssetCandidate>,
	supportFailures: Map<string, CandidateSupportFailure>
) {
	if (computeFailures.has(candidate.processId)) computeFailures.set(candidate.processId, candidate);
	const supportFailure = supportFailures.get(candidate.processId);
	if (supportFailure) supportFailures.set(candidate.processId, { ...supportFailure, candidate });
}

export function trackRateLimitFailure(rateLimits: Set<string>, processId: string, error?: unknown) {
	if (error && marketplaceFailureKind(error) === 'rate-limited') rateLimits.add(processId);
	else rateLimits.delete(processId);
}

export function walletResolutionCopy(status: WalletResolutionStatus, failureMessage: string) {
	const milestone = Math.floor(status.resolved / 10) * 10;
	const heading =
		status.phase === 'error'
			? 'Discovery interrupted'
			: !status.discoveryComplete
			? 'Discovering and checking live state'
			: status.phase === 'revalidating'
			? 'Confirming current ownership'
			: status.phase === 'resolving'
			? 'Computing live state'
			: status.phase === 'done' && status.failures
			? status.indexFailures
				? status.failures === status.total
					? 'Candidate checks unavailable'
					: 'Asset checks partially completed'
				: status.failures === status.total
				? 'Live state unavailable'
				: 'Live state partially resolved'
			: status.phase === 'done'
			? 'Live state resolved'
			: 'Resolution interrupted';
	const announcement =
		status.phase === 'error'
			? ''
			: !status.discoveryComplete
			? `Discovering and checking live state. ${status.discovered.toLocaleString()} candidates found${
					milestone ? `, ${milestone.toLocaleString()} checked` : ''
			  }.`
			: status.phase === 'revalidating'
			? `Confirming current ownership. ${(status.revalidated ?? 0).toLocaleString()} of ${(
					status.revalidationTotal ?? 0
			  ).toLocaleString()} visible assets rechecked without cached state.`
			: status.phase === 'resolving'
			? `Checking asset candidates. ${
					status.total ? Math.floor((status.resolved / status.total) * 10) * 10 : 0
			  }% complete.`
			: status.phase === 'done' && status.failures
			? `${failureMessage} ${status.resolved.toLocaleString()} of ${status.total.toLocaleString()} candidate checks completed; ${status.failures.toLocaleString()} unavailable. Resolved assets remain visible.`
			: status.phase === 'done'
			? `Live state resolved for ${status.resolved.toLocaleString()} candidates.`
			: 'Asset resolution was interrupted.';
	return { heading, announcement };
}

export function walletResolutionIsDeterminate(status: WalletResolutionStatus) {
	return status.discoveryComplete;
}

export function walletResolutionShowsProgress(status: WalletResolutionStatus) {
	return status.phase !== 'error';
}

export type WalletAnnouncementProgress = { scope: string; discovered: number; revalidated: number };

export function nextWalletAnnouncementProgress(
	previous: WalletAnnouncementProgress,
	status: WalletResolutionStatus,
	scope: string
): WalletAnnouncementProgress {
	const reset = previous.scope !== scope || status.discovered < previous.discovered;
	const baseline = reset ? { scope, discovered: 0, revalidated: 0 } : previous;
	const revalidated = status.revalidated ?? 0;
	const revalidationTotal = status.revalidationTotal ?? 0;
	const announcedRevalidated =
		status.phase === 'revalidating' && revalidationTotal
			? revalidated >= revalidationTotal
				? revalidationTotal
				: Math.floor((revalidated / revalidationTotal) * 10) >
				  Math.floor((baseline.revalidated / revalidationTotal) * 10)
				? Math.floor((Math.floor((revalidated / revalidationTotal) * 10) * revalidationTotal) / 10)
				: baseline.revalidated
			: revalidated;
	if (status.discoveryComplete || status.phase === 'error' || status.discovered === 0) {
		return { scope, discovered: status.discovered, revalidated: announcedRevalidated };
	}
	if (baseline.discovered === 0) return { scope, discovered: status.discovered, revalidated: announcedRevalidated };
	return {
		scope,
		discovered: Math.max(baseline.discovered, Math.floor(status.discovered / 500) * 500),
		revalidated: announcedRevalidated,
	};
}

export function groupWalletResults(results: ResolvedAsset[], address: string) {
	const owned: ResolvedAsset[] = [];
	const listed: ResolvedAsset[] = [];
	for (const result of results) {
		const groups = walletAssetGroups(result, address);
		if (groups.includes('owned')) owned.push(result);
		if (groups.includes('listed')) listed.push(result);
	}
	return { owned, listed };
}

export type WalletDiscoverySession = {
	scope: string;
	scan: WalletCandidateScan;
	counted: Set<string>;
	screened: Set<string>;
	completed: Set<string>;
	latestCandidates: Map<string, AssetCandidate>;
	resolvedAssets: Map<string, ResolvedAsset>;
	complete: boolean;
};

export function walletDiscoveryScope(address: string, gateway: string, collections: Collection[]) {
	const supportedCollections = collections
		.map((collection) =>
			[
				collection.id,
				collection.kind,
				collection.kind === 'names'
					? collection.namespace?.manifestId ?? ''
					: collection.manifestId ?? collection.id,
			].join(':')
		)
		.sort();
	return [address, gateway, ...supportedCollections].join('|');
}

export function walletDiscoverySession(
	current: WalletDiscoverySession | undefined,
	scope: string,
	address: string,
	scan = createWalletCandidateScan(address)
): WalletDiscoverySession {
	if (current?.scope === scope) return current;
	return {
		scope,
		scan,
		counted: new Set<string>(),
		screened: new Set<string>(),
		completed: new Set<string>(),
		latestCandidates: new Map(scan.found),
		resolvedAssets: new Map<string, ResolvedAsset>(),
		complete: false,
	};
}

export function walletDiscoverySessionIsCurrent(
	session: WalletDiscoverySession | undefined,
	scope: string
): session is WalletDiscoverySession {
	return Boolean(scope && session?.scope === scope);
}

export function updateWalletResolvedAsset(
	session: WalletDiscoverySession,
	result: ResolvedAsset | null,
	candidate: AssetCandidate,
	address: string
) {
	if (result && walletAssetGroups(result, address).length) {
		session.resolvedAssets.set(result.asset.id, {
			...result,
			activity: session.latestCandidates.get(result.asset.id) ?? candidate,
		});
		return true;
	}
	return session.resolvedAssets.delete(candidate.processId);
}

export function reopenWalletCandidate(session: WalletDiscoverySession, candidate: AssetCandidate) {
	const previous = session.latestCandidates.get(candidate.processId);
	const newer = Boolean(
		previous &&
			(candidate.height > previous.height ||
				(candidate.height === previous.height && candidate.timestamp > previous.timestamp) ||
				(candidate.height === previous.height &&
					candidate.timestamp === previous.timestamp &&
					(candidate.activityIds ?? []).some((id) => !(previous.activityIds ?? []).includes(id))))
	);
	if (!newer || !session.screened.delete(candidate.processId)) {
		return { reopened: false, completed: false, removedResult: false };
	}
	return {
		reopened: true,
		completed: session.completed.delete(candidate.processId),
		removedResult: session.resolvedAssets.delete(candidate.processId),
	};
}

export function initialWalletResolutionStatus(): WalletResolutionStatus {
	return {
		phase: 'discovering',
		discoveryComplete: false,
		discovered: 0,
		resolved: 0,
		total: 0,
		failures: 0,
		indexFailures: 0,
		rateLimited: 0,
		indexRateLimited: 0,
		error: null,
	};
}

export function assetDetailCanResolve({
	assetId,
	cachedAsset,
	indexedAsset,
	indexedMetadata,
	indexedCollection,
	directAtomicRoute,
	directFungibleRoute = false,
}: {
	assetId: string;
	cachedAsset?: AssetSummary;
	indexedAsset?: AssetSummary;
	indexedMetadata?: AssetSummary;
	indexedCollection?: Collection;
	directAtomicRoute: boolean;
	directFungibleRoute?: boolean;
}) {
	if (!isVisibleAssetId(assetId)) return false;
	return Boolean(
		directAtomicRoute ||
			directFungibleRoute ||
			indexedAsset ||
			(indexedMetadata?.id === assetId && ARWEAVE_ADDRESS.test(assetId)) ||
			(indexedCollection?.kind === 'tokens' && ARWEAVE_ADDRESS.test(assetId)) ||
			(cachedAsset?.id === assetId && ARWEAVE_ADDRESS.test(assetId))
	);
}

export function assetDetailMembershipVerified(
	collectionId: string | undefined,
	verifiedCollectionIds: ReadonlySet<string>,
	directAtomicAsset: boolean
) {
	return directAtomicAsset || Boolean(collectionId && verifiedCollectionIds.has(collectionId));
}

export function verifiedAssetForDetail(
	collection: Collection | undefined,
	indexedAsset: AssetSummary | undefined,
	resolvedAsset: AssetSummary | null | undefined,
	state: AssetState | null
) {
	if (!collection) return undefined;
	return collection.kind === 'names'
		? state && ['carrier@1.0', 'name-token@1.0'].includes(state.device)
			? indexedAsset
			: null
		: resolvedAsset;
}

export function assetDetailLoadingPresentation(collection: Collection | undefined, collectionId: string) {
	const kind =
		collection?.kind ??
		(collectionId === FUNGIBLE_TOKEN_COLLECTION_ID
			? 'tokens'
			: collectionId === CREATED_COLLECTION_ID
			? 'images'
			: 'names');
	return { kind, device: kind === 'names' ? 'carrier@1.0' : 'token@1.0' } as const;
}

export function mergeAssetDetailMetadata(
	primary: AssetSummary | undefined,
	indexed: AssetSummary | undefined
): AssetSummary | undefined {
	if (!primary) return indexed;
	if (!indexed || primary.id !== indexed.id) return primary;
	const abbreviatedName = `${primary.id.slice(0, 7)}…${primary.id.slice(-6)}`;
	return {
		...primary,
		...indexed,
		name: !primary.name || primary.name === abbreviatedName ? indexed.name : primary.name,
	};
}

export function assetDetailErrorMessage(
	error: string | null,
	asset: Pick<AssetSummary, 'name'> | undefined,
	indexed: boolean
): string | null {
	if (!error || !asset || !indexed) return error;
	return `${asset.name} is published and indexed, but its ownership and market state are currently unavailable from the configured compute peers. Retry shortly.`;
}

function AssetDetailLoadingShell({
	asset,
	collection,
	collectionId,
	error,
	onRetry,
}: {
	asset?: AssetSummary;
	collection?: Collection;
	collectionId: string;
	error?: string | null;
	onRetry?: () => void;
}) {
	const wallet = useWallet();
	const { kind, device } = assetDetailLoadingPresentation(collection, collectionId);
	const detailClass = kind === 'tokens' ? 'fungible-asset-page' : 'atomic-asset-page';
	const collectionName =
		(collection ? (kind === 'tokens' ? collectionDisplayName(collection) : collection.name) : undefined) ??
		(kind === 'tokens' ? 'Fungible tokens' : kind === 'images' ? CREATED_COLLECTION_NAME : 'Arweave names');

	if (kind === 'tokens') {
		return (
			<section className="asset-page asset-detail-page asset-detail-loading-shell fungible-asset-page">
				<header className="fungible-token-header">
					{asset ? (
						<TokenAvatar
							className="fungible-token-avatar"
							fetchPriority="high"
							image={asset.image}
							loading="eager"
							ticker={asset.ticker ?? asset.name}
						/>
					) : (
						<span className="fungible-token-avatar layout-placeholder" aria-hidden="true" />
					)}
					<div className="fungible-token-identity">
						<div className="fungible-token-title">
							{asset ? (
								<h1>{formatTickerLabel(asset.ticker)}</h1>
							) : (
								<span className="layout-placeholder layout-placeholder-title" />
							)}
							{asset ? <span className="fungible-token-name">{asset.name}</span> : null}
						</div>
						<div className="fungible-token-meta" aria-hidden="true">
							{collection ? (
								<Link to={`/collection/${collection.id}`}>{collectionName}</Link>
							) : (
								<span>{collectionName}</span>
							)}
							<span>token@1.0</span>
						</div>
					</div>
					<div aria-hidden="true" className="fungible-token-balance">
						<span>{wallet.address ? 'Your liquid balance' : 'Circulating supply'}</span>
						<strong className="layout-placeholder asset-loading-balance" />
					</div>
				</header>
				{error ? (
					<ErrorPanel message={error} onRetry={onRetry} />
				) : (
					<div aria-live="polite" className="state-verification asset-loading-verification" role="status">
						<span aria-hidden="true" /> Computing current state…
					</div>
				)}
				<div className="asset-detail-layout">
					<div className="asset-commerce-column asset-commerce-primary">
						<section aria-hidden="true" className="asset-commerce-card asset-commerce-card-loading">
							<div className="asset-market-stats asset-loading-market-stats">
								{['Current unit price', 'For sale', 'Your listed', 'Holders'].map((label) => (
									<div key={label}>
										<span>{label}</span>
										<i className="layout-placeholder" />
									</div>
								))}
							</div>
							<div className="fungible-trade-switcher">
								<div className="segmented-tabs fungible-trade-tabs asset-loading-trade-tabs">
									<span>Buy</span>
									<span>List</span>
									<span>Transfer</span>
								</div>
							</div>
							<div className="asset-loading-trade-composer">
								<div>
									<span>You buy</span>
									<i className="layout-placeholder" />
									<small className="layout-placeholder" />
								</div>
								<div>
									<span>You pay</span>
									<i className="layout-placeholder" />
									<small className="layout-placeholder" />
								</div>
							</div>
							<span className="layout-placeholder asset-loading-action" />
						</section>
					</div>
					<div className="asset-commerce-column asset-commerce-secondary">
						<nav
							aria-hidden="true"
							className="home-market-tabs asset-detail-tabs asset-section-tabs-loading"
						>
							<span>Market</span>
							<span>Holders</span>
							<span>About</span>
						</nav>
						<div aria-hidden="true" className="fungible-market-panel asset-loading-market-panel">
							<section className="token-price-chart asset-loading-chart">
								<div className="token-price-chart-heading">
									<div className="asset-loading-chart-quote">
										<span>Indexed ask history</span>
										<strong className="layout-placeholder" />
									</div>
									<div className="asset-loading-chart-ranges">
										{Array.from({ length: 4 }, (_, index) => (
											<span className="layout-placeholder" key={index} />
										))}
									</div>
								</div>
								<div className="asset-loading-chart-plot">
									<span />
									<span />
									<span />
								</div>
							</section>
							<div className="orderbook-table fungible-orderbook asset-loading-orderbook">
								<div className="orderbook-head">
									<span>Price</span>
									<span>Size</span>
									<span>Value</span>
									<span>Seller</span>
									<span>State</span>
								</div>
								{Array.from({ length: 3 }, (_, row) => (
									<div className="orderbook-row" key={row}>
										{Array.from({ length: 5 }, (_, column) => (
											<span className="layout-placeholder" key={column} />
										))}
									</div>
								))}
							</div>
							<section className="asset-loading-activity">
								<h2>Activity</h2>
								{Array.from({ length: 3 }, (_, row) => (
									<div key={row}>
										<span className="layout-placeholder" />
										<span className="layout-placeholder" />
										<span className="layout-placeholder" />
									</div>
								))}
							</section>
						</div>
					</div>
				</div>
			</section>
		);
	}

	return (
		<section className={`asset-page asset-detail-page asset-detail-loading-shell ${detailClass}`}>
			<div className="asset-detail-layout">
				<div className="asset-commerce-column asset-commerce-primary">
					<div className="asset-details asset-identity">
						<div className="asset-kicker">
							{collection ? (
								<Link className="asset-collection-link" to={`/collection/${collection.id}`}>
									{collectionName}
								</Link>
							) : (
								<span className="asset-collection-link">{collectionName}</span>
							)}
						</div>
						{asset ? (
							<h1>{asset.name}</h1>
						) : (
							<span className="layout-placeholder layout-placeholder-title" />
						)}
						<div className="asset-owner-line">
							<span>Loading ownership and market state</span>
						</div>
						<div className="asset-token-tags" aria-hidden="true">
							<span>{device}</span>
							<span>Arweave</span>
							<span>Supply 1</span>
						</div>
						{error ? (
							<ErrorPanel message={error} onRetry={onRetry} />
						) : (
							<div
								aria-live="polite"
								className="state-verification asset-loading-verification"
								role="status"
							>
								<span aria-hidden="true" /> Computing current state…
							</div>
						)}
						<section aria-hidden="true" className="asset-commerce-card asset-commerce-card-loading">
							<div className="asset-loading-stat-grid">
								{Array.from({ length: 4 }, (_, index) => (
									<span className="layout-placeholder" key={index} />
								))}
							</div>
							<span className="layout-placeholder asset-loading-summary" />
							<span className="layout-placeholder asset-loading-action" />
						</section>
					</div>
				</div>
				<div className="asset-visual-column">
					<div className="asset-hero-media">
						{asset?.image ? (
							<ArtworkImage src={asset.image} alt={asset.name} fetchPriority="high" loading="eager" />
						) : asset && isAudioContentType(asset.contentType) ? (
							<AudioArtwork contentType={asset.contentType} name={asset.name} />
						) : kind === 'names' && asset ? (
							<NameArtwork name={asset.name} />
						) : (
							<span className="layout-placeholder asset-loading-artwork" />
						)}
					</div>
				</div>
				<div className="asset-commerce-column asset-commerce-secondary">
					<nav aria-hidden="true" className="home-market-tabs asset-detail-tabs asset-section-tabs-loading">
						<span>Details</span>
						<span>Orders</span>
						<span>Activity</span>
					</nav>
					<div aria-hidden="true" className="asset-loading-panel">
						<span className="layout-placeholder" />
						<span className="layout-placeholder" />
						<span className="layout-placeholder" />
					</div>
				</div>
			</div>
		</section>
	);
}

export function isFungiblePendingMint(asset: Pick<MintedAsset, 'contentType' | 'ticker'>, collectionId: string) {
	return (
		collectionId === FUNGIBLE_TOKEN_COLLECTION_ID ||
		asset.contentType === 'application/x.arweave-token' ||
		Boolean(asset.ticker)
	);
}

function PendingAssetView() {
	const { collectionId = '', assetId = '' } = useParams();
	const navigate = useNavigate();
	const { mintActivities } = useOperationActivity();
	const activity =
		mintActivities.find((candidate) => candidate.asset.id === assetId) ??
		loadMintActivities(localStorage).find((candidate) => candidate.asset.id === assetId);
	const finalPath = `/asset/${activity?.collectionId ?? collectionId}/${assetId}`;
	const asset = activity?.asset ?? loadMintedAssets().find((candidate) => candidate.id === assetId);

	React.useEffect(() => {
		const showLiveAsset = (event: Event) => {
			if ((event as CustomEvent<MintActivity>).detail?.asset?.id === assetId)
				navigate(finalPath, { replace: true });
		};
		window.addEventListener('bazar:mint-live', showLiveAsset);
		return () => window.removeEventListener('bazar:mint-live', showLiveAsset);
	}, [assetId, finalPath, navigate]);

	if (!asset) {
		return (
			<RouteState title="Upload not found" backTo="/create" backLabel="Back to create">
				<p>This browser does not have a saved upload for that transaction.</p>
			</RouteState>
		);
	}
	if (!activity) return <Navigate to={finalPath} replace />;
	const fungible = isFungiblePendingMint(asset, activity.collectionId ?? collectionId);

	const phases: Array<[MintActivity['phase'], string]> = [
		['accepted', 'Accepted by Arweave'],
		['mined', 'Mined'],
		['applied', 'Applied to process state'],
		['complete', 'Live on Bazar'],
	];
	const currentPhase = phases.findIndex(([phase]) => phase === activity.phase);
	const pinnedGateway =
		activity.arweaveGateway !== arweaveGatewayFromLocation() || activity.computeGateway !== gatewayFromLocation();

	return (
		<section className="mint-pending-page">
			<Link className="back" to="/">
				<ArrowLeft className="ui-icon ui-icon--sm" aria-hidden="true" /> Continue browsing
			</Link>
			<div className="mint-pending-layout">
				<div className="mint-pending-artwork">
					{asset.image ? (
						<ArtworkImage src={asset.image} alt={`${asset.name} artwork`} />
					) : fungible ? (
						<TokenArtwork ticker={asset.ticker || asset.name} />
					) : isAudioContentType(asset.contentType) ? (
						<AudioArtwork contentType={asset.contentType} name={asset.name} />
					) : (
						<span className="mint-pending-artwork-fallback" aria-hidden="true">
							{asset.name.slice(0, 1)}
						</span>
					)}
				</div>
				<div className="mint-pending-copy">
					<p className="eyebrow">Submitted · safe to leave</p>
					<h1>{asset.name}</h1>
					<p>{activity.status}</p>
					<ol className="mint-pending-phases">
						{phases.map(([phase, label], index) => (
							<li className={index <= currentPhase ? 'reached' : undefined} key={phase}>
								<span>{index < currentPhase ? <Check aria-hidden="true" /> : index + 1}</span>
								{label}
							</li>
						))}
					</ol>
					<p className="mint-pending-gateway">
						Tracking is pinned to the gateways that accepted this operation
						{pinnedGateway
							? '. Your current gateway selection is different; Bazar will not restart the upload'
							: ''}
						.
					</p>
					<div className="mint-pending-actions">
						<a href={transactionExplorerUrl(asset.id)} target="_blank" rel="noreferrer">
							View transaction <ArrowUpRight className="ui-icon ui-icon--sm" aria-hidden="true" />
						</a>
						<Button type="button" size="custom" disabled>
							View when available <InfinityIcon className="ui-icon ui-icon--sm" aria-hidden="true" />
						</Button>
					</div>
					<MintTransactionReceipt
						entries={activity.transactionIds.map((transactionId, index) => ({
							label: fungible
								? index === activity.transactionIds.length - 1
									? 'Token process transaction'
									: 'Token logo transaction'
								: index === activity.transactionIds.length - 1
								? 'Asset transaction'
								: 'Artwork transaction',
							transactionId,
						}))}
					/>
				</div>
			</div>
		</section>
	);
}

function SetProfilePictureButton({
	assetId,
	disabled,
	image,
	owner,
}: {
	assetId: string;
	disabled: boolean;
	image: string;
	owner: string;
}) {
	const [status, setStatus] = React.useState<'idle' | 'checking' | 'signing' | 'uploading' | 'done'>('idle');
	const [error, setError] = React.useState('');
	const apply = async () => {
		setError('');
		setStatus('checking');
		try {
			const current = await readAssetState(assetId, { maxAge: 0 });
			if (
				current.state.totalSupply !== '1' ||
				current.state.denomination > 0 ||
				ownerOfAsset(current.state) !== owner
			) {
				throw new Error('This wallet no longer owns this unique asset.');
			}
			await new ProfileClient().setAvatar(owner, image, {
				onPhase: (phase) => setStatus(phase),
			});
			setStatus('done');
		} catch (cause) {
			setStatus('idle');
			setError(cause instanceof Error ? cause.message : 'Profile picture could not be updated.');
		}
	};
	return (
		<>
			<Button
				className="with-icon"
				disabled={disabled || status !== 'idle'}
				onClick={() => void apply()}
				size="custom"
				type="button"
			>
				<UserRound className="ui-icon ui-icon--sm" aria-hidden="true" />
				{status === 'checking'
					? 'Checking ownership…'
					: status === 'signing'
					? 'Approve profile…'
					: status === 'uploading'
					? 'Publishing profile…'
					: status === 'done'
					? 'Profile picture set'
					: 'Set as profile picture'}
			</Button>
			{error ? (
				<small className="profile-picture-error" role="alert">
					{error}
				</small>
			) : null}
		</>
	);
}

function AssetView() {
	const { collectionId = '', assetId = '' } = useParams();
	const market = React.useContext(MarketContext);
	const wallet = useWallet();
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
		[assetId, market.visibilityReady]
	);
	const [liveResult, setLiveResult] = React.useState<{
		assetId: string;
		state: AssetState | null;
		loading: boolean;
		error: string | null;
		provider: string;
		verifiedAt: number | null;
	}>({
		assetId,
		state: prefetchedState?.state ?? null,
		loading: true,
		error: null,
		provider: prefetchedState?.provider ?? '',
		verifiedAt: prefetchedState?.verifiedAt ?? null,
	});
	const requestRef = React.useRef<AbortController>();
	const state = liveResult.assetId === assetId ? liveResult.state : prefetchedState?.state ?? null;
	const error = liveResult.assetId === assetId ? liveResult.error : null;
	const loading = liveResult.assetId !== assetId || liveResult.loading;
	const provider = liveResult.assetId === assetId ? liveResult.provider : prefetchedState?.provider ?? '';
	const verifiedAt = liveResult.assetId === assetId ? liveResult.verifiedAt : prefetchedState?.verifiedAt ?? null;
	const directAtomicRoute =
		collectionId === CREATED_COLLECTION_ID && ARWEAVE_ADDRESS.test(assetId) && isVisibleAssetId(assetId);
	const indexedAtomic = indexedAtomicResult.assetId === assetId ? indexedAtomicResult.result : null;
	React.useEffect(() => {
		if (
			!ARWEAVE_ADDRESS.test(assetId) ||
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
		directFungibleRoute:
			collectionId === 'fungible-tokens' && ARWEAVE_ADDRESS.test(assetId) && isVisibleAssetId(assetId),
	});
	const directAtomicAsset =
		directAtomicRoute && state ? bazarAtomicAssetFromState(assetId, state, provider || undefined) : null;
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
			void import('../routes/FungibleAssetRoute');
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
	const [activityRequested, setActivityRequested] = React.useState(false);
	const [activityError, setActivityError] = React.useState<string | null>(null);
	const [activityRetry, setActivityRetry] = React.useState(0);
	const [storageVersion, setStorageVersion] = React.useState(0);
	const activityAssetRef = React.useRef('');
	const [activeSection, setActiveSection] = React.useState<
		'about' | 'orders' | 'activity' | 'rights' | 'blockchain' | 'more'
	>('about');
	const readLiveState = React.useCallback(
		async (_force: boolean) => {
			requestRef.current?.abort();
			if (!canResolveAsset) {
				setLiveResult({ assetId, state: null, loading: false, error: null, provider: '', verifiedAt: null });
				return;
			}
			const controller = new AbortController();
			requestRef.current = controller;
			const cached = cachedAssetState(assetId);
			setLiveResult((current) => ({
				assetId,
				state: current.assetId === assetId ? current.state : cached?.state ?? null,
				loading: true,
				error: null,
				provider: current.assetId === assetId ? current.provider : cached?.provider ?? '',
				verifiedAt: current.assetId === assetId ? current.verifiedAt : cached?.verifiedAt ?? null,
			}));
			try {
				const result = await readAssetStateCached(assetId, {
					maxAge: 0,
					cacheTtlMs: 20_000,
					force: true,
					signal: controller.signal,
				});
				if (requestRef.current === controller && !controller.signal.aborted) {
					setLiveResult({
						assetId,
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
							assetId,
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
					setLiveResult((current) => ({
						assetId,
						state: current.assetId === assetId ? current.state : null,
						loading: false,
						error: assetStateErrorMessage(cause),
						provider: current.assetId === assetId ? current.provider : '',
						verifiedAt: current.assetId === assetId ? current.verifiedAt : null,
					}));
				}
			}
		},
		[assetId, canResolveAsset]
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
			activityAssetRef.current = assetId;
			try {
				setAssetActivity(loadMarketActivity(window.localStorage, `asset:${assetId}`));
			} catch {
				setAssetActivity([]);
			}
		}
		setActivityError(null);
		if (!resolvedAsset || !activityRequested) {
			setActivityLoading(false);
			return () => controller.abort();
		}
		setActivityLoading(true);
		void discoverCollectionActivity({ recipients: [assetId], signal: controller.signal, limit: 24 })
			.then(
				(events) => {
					if (!controller.signal.aborted) {
						setAssetActivity(events);
						try {
							saveMarketActivity(window.localStorage, `asset:${assetId}`, events);
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
						ARWEAVE_ADDRESS.test(record?.txId ?? '') &&
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
				const currentOrder = liveOrder(state);
				const canStillApply =
					savedOperation.kind === 'sell'
						? ownerOfAsset(state) === walletAddress && !currentOrder
						: savedOperation.kind === 'cancel'
						? Boolean(
								savedOperation.order?.orderId &&
									state.orders[savedOperation.order.orderId]?.status === 'open' &&
									state.orders[savedOperation.order.orderId]?.creator === walletAddress
						  )
						: liquidBalanceOf(state, walletAddress) === '1';
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
	if (!collection && (market.loading || (directAtomicRoute && loading))) {
		return (
			<AssetDetailLoadingShell
				asset={shellAsset}
				collectionId={collectionId}
				error={detailError}
				onRetry={load}
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
				<ErrorPanel message={detailError ?? error} onRetry={load} />
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
			/>
		);
	const asset = verifiedAsset;
	if (!asset && error)
		return (
			<RouteState title="Asset unavailable" backTo={`/collection/${collection.id}`} backLabel={collection.name}>
				<ErrorPanel message={detailError ?? error} onRetry={load} />
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
					activityLoading={activityLoading}
					activityError={activityError}
					onActivityRetry={() => setActivityRetry((value) => value + 1)}
					onActivityVisible={() => setActivityRequested(true)}
					loading={loading}
					error={error}
					provider={provider}
					verifiedAt={verifiedAt}
					onRefresh={refreshAsset}
				/>
			</React.Suspense>
		);
	}
	const owner = state ? ownerOfAsset(state) : null;
	const order = state ? liveOrder(state) : null;
	const mine = Boolean(wallet.address && owner === wallet.address);
	const externalReservation = externalReservationTransaction(order, wallet.address, assetActivity);
	const recoveryBlocksActions = recoverySuppressed || Boolean(unavailableRecovery);
	const operationBlocksActions = recoveryBlocksActions || Boolean(operationActivityEntry);
	const operationIsBusy = Boolean(operationActivityEntry && operationActivityEntry.phase !== 'error');
	const license = state ? licenseProperties(state) : [];
	const description = assetDescription(state, collection.description);
	const moreAssets = collectionMoreAssets(collection.assets, asset.id);
	type AtomicAssetSection = typeof activeSection;
	const assetTabs: AssetDetailTab<AtomicAssetSection>[] = [
		{
			value: 'about',
			label: 'About',
			icon: <Info className="ui-icon" aria-hidden="true" />,
			panelId: 'asset-about',
		},
		{
			value: 'orders',
			label: 'Orders',
			icon: <Layers3 className="ui-icon" aria-hidden="true" />,
			panelId: 'asset-orders',
		},
		{
			value: 'activity',
			label: 'Activity',
			icon: <BarChart3 className="ui-icon" aria-hidden="true" />,
			panelId: 'asset-activity',
		},
		{
			value: 'rights',
			label: 'Usage rights',
			icon: <FileText className="ui-icon" aria-hidden="true" />,
			panelId: 'asset-rights',
		},
		{
			value: 'blockchain',
			label: 'Blockchain',
			icon: <Grid2X2 className="ui-icon" aria-hidden="true" />,
			panelId: 'asset-blockchain',
		},
		{
			value: 'more',
			label: 'More',
			icon: <Images className="ui-icon" aria-hidden="true" />,
			panelId: 'asset-more',
		},
	];
	return (
		<section className="asset-page asset-detail-page atomic-asset-page">
			{recoverySuppressed ? (
				<div className="pending-operation-notice">
					<span role="status">
						Local tracking is paused. Resume here to continue observing signed work or review any wallet
						approvals still required.
					</span>
					<Button
						ref={resumeButtonRef}
						className="with-icon"
						size="custom"
						type="button"
						onClick={() => setRecoverySuppressed(false)}
					>
						<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Resume pending action
					</Button>
				</div>
			) : null}
			{recoveryNotice ? (
				<div className="pending-operation-notice">
					<span role="status">{recoveryNotice}</span>
					<Button type="button" onClick={() => setRecoveryNotice('')} size="custom">
						Dismiss
					</Button>
				</div>
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
								<strong>{state ? 'Unassigned' : 'State unavailable'}</strong>
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
						{error ? <ErrorPanel message={error} onRetry={load} /> : null}
						{state ? (
							<section aria-busy={operationIsBusy} className="asset-commerce-card">
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
											disabled={operationBlocksActions || loading || Boolean(error)}
											size="custom"
											variant="primary"
											onClick={() => openOperation({ kind: 'buy', order })}
										>
											<ShoppingCart className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
											{operation?.kind === 'buy'
												? assetOperationPendingActionLabel('buy')
												: 'Buy now'}
										</Button>
									) : null}
									{wallet.address && mine && !order ? (
										<Button
											className="with-icon asset-buy-now market-primary-action"
											disabled={operationBlocksActions || loading || Boolean(error)}
											size="custom"
											variant="primary"
											onClick={() => openOperation({ kind: 'sell' })}
										>
											<Tag className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
											{operation?.kind === 'sell'
												? assetOperationPendingActionLabel('sell')
												: 'List for sale'}
										</Button>
									) : null}
									{wallet.address && mine && order?.status === 'open' ? (
										<Button
											className="with-icon"
											disabled={operationBlocksActions || loading || Boolean(error)}
											size="custom"
											onClick={() => openOperation({ kind: 'cancel', order })}
											variant="danger"
										>
											<CircleX className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
											{operation?.kind === 'cancel'
												? assetOperationPendingActionLabel('cancel')
												: 'Cancel listing'}
										</Button>
									) : null}
									{wallet.address && mine && !order ? (
										<Button
											className="with-icon"
											disabled={operationBlocksActions || loading || Boolean(error)}
											size="custom"
											onClick={() => openOperation({ kind: 'transfer' })}
										>
											<Send className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
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
						}`}
					>
						{isAudioContentType(asset.contentType) ? (
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
							if (section === 'activity') setActivityRequested(true);
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
										<strong>{state ? 'Unassigned' : 'State unavailable'}</strong>
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
							className="asset-tab-panel"
							id="asset-orders"
							role="tabpanel"
							tabIndex={0}
						>
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
								Computed from the last loaded asset process state through the selected HyperBEAM
								gateway.
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
								<div className="inline-error retry-notice" role="status">
									<span>
										Compute hasn’t completed yet. Please try again.{' '}
										{assetActivity.length ? 'Previously loaded events remain visible.' : ''}
									</span>
									<Button
										className="with-icon"
										onClick={() => setActivityRetry((value) => value + 1)}
										size="custom"
										type="button"
									>
										<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
									</Button>
								</div>
							) : null}
							{assetActivity.length ? (
								<MarketActivityList
									ariaLabel={`${asset.name} market activity`}
									collectionId={collection.id}
									events={assetActivity}
									loading={activityLoading}
									resolveAsset={() => asset}
								/>
							) : null}
							{!activityLoading && !activityError && !assetActivity.length ? (
								<p className="asset-empty-copy">No indexed market events found.</p>
							) : null}
							<p className="market-note">
								Up to 24 recent signed process submissions indexed from Arweave. Live ownership and
								orders above remain authoritative.
							</p>
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
												View license proof on ViewBlock{' '}
												<ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
											</a>
										</dd>
									</div>
								</dl>
							) : (
								<div className="license-empty">
									<span>
										<Diamond className="ui-icon" aria-hidden="true" />
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
											{short(asset.id)}{' '}
											<ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
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

type Operation =
	| { kind: 'sell'; resumeId?: string; value?: string }
	| { kind: 'transfer'; resumeId?: string; startingSlot?: number; value?: string }
	| { kind: 'cancel'; order: SwapOrder; resumeId?: string; startingSlot?: number }
	| { kind: 'buy'; order: SwapOrder; resume?: PurchaseSnapshot; externalOrigin?: boolean };

export type AtomicPurchaseSequenceStep = {
	key: 'sign' | 'reserve' | 'pay' | 'verify';
	label: string;
	state: 'done' | 'active' | 'next';
};

const ATOMIC_PAYMENT_STAGES = new Set([
	'signing-payment',
	'dispatching-payment',
	'payment-propagating',
	'payment-confirming',
	'ownership-verifying',
	'complete',
]);

export function atomicPurchaseSequence(state: PurchaseState | null): AtomicPurchaseSequenceStep[] {
	const progress = [
		Boolean(state && state.stage !== 'idle' && state.stage !== 'signing'),
		Boolean(state && ATOMIC_PAYMENT_STAGES.has(state.stage)),
		state?.stage === 'ownership-verifying' || state?.stage === 'complete',
		state?.stage === 'complete',
	];
	const activeIndex = progress.findIndex((complete) => !complete);
	const steps: Array<Omit<AtomicPurchaseSequenceStep, 'state'>> = [
		{ key: 'sign', label: 'Sign reservation' },
		{ key: 'reserve', label: 'Reserve asset' },
		{ key: 'pay', label: 'Pay seller' },
		{ key: 'verify', label: 'Verify ownership' },
	];
	return steps.map((step, index) => ({
		...step,
		state: progress[index] ? 'done' : index === activeIndex ? 'active' : 'next',
	}));
}

export function AtomicPurchaseSequence({ state }: { state: PurchaseState | null }) {
	const steps = atomicPurchaseSequence(state);
	return (
		<section aria-label="Asset purchase transaction sequence" className="purchase-sequence">
			<ol>
				{steps.map((step, index) => (
					<li className={step.state} key={step.key}>
						<span aria-hidden="true" className="purchase-sequence-marker">
							{step.state === 'done' ? <Check /> : index + 1}
						</span>
						<span className="purchase-sequence-copy">
							<strong>{step.label}</strong>
						</span>
					</li>
				))}
			</ol>
		</section>
	);
}

function OperationDialog({
	taskId,
	asset,
	collectionId,
	owner,
	operation,
	visible,
	restoreFallback,
	onUpdate,
	onOperation,
	onHide,
	onClose,
	onViewAsset,
}: {
	taskId: string;
	asset: AssetSummary;
	collectionId: string;
	owner: string;
	operation: Operation;
	visible: boolean;
	restoreFallback(): HTMLElement | null;
	onUpdate(
		id: string,
		patch: Pick<OperationActivity, 'phase' | 'status' | 'confirmations' | 'confirmationTarget'>,
		assetId: string
	): void;
	onOperation(operation: Operation): void;
	onHide(): void;
	onClose(resumeLater?: boolean, refresh?: boolean): void;
	onViewAsset(): void;
}) {
	const recoveryApprovalCount =
		operation.kind === 'buy' && operation.resume ? purchaseRecoveryApprovalCount(operation.resume) : 0;
	const recoveryApprovalCopy =
		operation.kind === 'buy' && operation.resume
			? purchaseRecoveryApprovalCopy(operation.resume, { externalOrigin: operation.externalOrigin })
			: null;
	const [value, setValue] = React.useState(
		operation.kind === 'sell' || operation.kind === 'transfer' ? operation.value ?? '' : ''
	);
	const [phase, setPhase] = React.useState<'form' | 'approval' | 'working' | 'done' | 'error'>(
		operation.kind === 'buy' && operation.resume
			? recoveryApprovalCount
				? 'approval'
				: 'working'
			: operation.kind !== 'buy' && operation.resumeId
			? 'working'
			: 'form'
	);
	const [message, setMessage] = React.useState('');
	const [failureKind, setFailureKind] = React.useState<MarketplaceOperationFailure | null>(null);
	const [views, setViews] = React.useState<ObserverView[]>([]);
	const [confirmations, setConfirmations] = React.useState(0);
	const [consensus, setConsensus] = React.useState<Consensus | null>(null);
	const [transaction, setTransaction] = React.useState<PreparedTransaction | null>(null);
	const [purchaseState, setPurchaseState] = React.useState<PurchaseState | null>(null);
	const [purchaseQuote, setPurchaseQuote] = React.useState<PurchaseCostEstimate | null>(null);
	const [purchaseWalletBalance, setPurchaseWalletBalance] = React.useState<bigint | null>(null);
	const [quoteError, setQuoteError] = React.useState('');
	const [quoteRetry, setQuoteRetry] = React.useState(0);
	const [hiding, setHiding] = React.useState(false);
	const purchaseRef = React.useRef<SwapPurchase | null>(null);
	const networkRef = React.useRef<AssetObserverNetworkLease | null>(null);
	const claimRef = React.useRef<WalletOperationClaim | null>(null);
	const submittedAtRef = React.useRef<number>();
	const exactActionBaselineRef = React.useRef<{ startingSlot: number } | null>(
		(operation.kind === 'cancel' || operation.kind === 'transfer') && Number.isSafeInteger(operation.startingSlot)
			? { startingSlot: operation.startingSlot! }
			: (operation.kind === 'cancel' || operation.kind === 'transfer') && operation.resumeId
			? { startingSlot: 0 }
			: null
	);
	const attemptRef = React.useRef(new AbortController());
	const lifecycleRef = React.useRef<object | null>(null);
	const hideTimerRef = React.useRef<number | null>(null);
	const titleId = React.useId();
	const operationLabelId = React.useId();
	const fieldHelpId = React.useId();
	const quoteStatusId = React.useId();
	const operationValue = atomicOperationValue(operation.kind, value);

	React.useEffect(() => {
		const lifecycle = {};
		lifecycleRef.current = lifecycle;
		return () => {
			if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
			queueMicrotask(() => {
				if (lifecycleRef.current !== lifecycle) return;
				attemptRef.current.abort();
				purchaseRef.current?.abandon();
				networkRef.current?.release();
				if (claimRef.current) {
					releaseWalletOperationClaim(localStorage, claimRef.current);
					claimRef.current = null;
				}
			});
		};
	}, []);
	React.useEffect(() => {
		if (visible) setHiding(false);
	}, [visible]);
	React.useEffect(() => {
		const paymentId = purchaseState?.payment?.id;
		if (phase !== 'done' || operation.kind !== 'buy' || !visible || !paymentId) return;
		const network = networkRef.current?.network;
		if (!network) return;
		const watcher = continuePaymentConfirmations(network, paymentId, (observation) => {
			setPurchaseState((current) => withContinuingPaymentObservation(current, paymentId, observation));
		});
		return () => watcher.stop();
	}, [operation.kind, phase, purchaseState?.payment?.id, visible]);
	React.useEffect(() => {
		if (operation.kind !== 'buy' || operation.resume) return;
		const controller = new AbortController();
		setPurchaseQuote(null);
		setPurchaseWalletBalance(null);
		setQuoteError('');
		void loadAtomicTransactionRuntime()
			.then(async ({ AssetTransactionClient }) => {
				const client = new AssetTransactionClient();
				return Promise.all([
					client.estimatePurchaseCosts(operation.order, asset.id, controller.signal),
					client.walletBalance(owner, controller.signal),
				]);
			})
			.then(
				([quote, balance]) => {
					if (!controller.signal.aborted) {
						setPurchaseQuote(quote);
						setPurchaseWalletBalance(balance);
					}
				},
				(cause) => {
					if (!controller.signal.aborted) setQuoteError(errorMessage(cause));
				}
			);
		return () => controller.abort();
	}, [
		asset.id,
		operation.kind === 'buy' ? operation.order.orderId : '',
		operation.kind === 'buy' ? operation.resume : undefined,
		owner,
		quoteRetry,
	]);
	const resumed = React.useRef(false);
	React.useEffect(() => {
		const shouldResume =
			(operation.kind === 'buy' && shouldAutomaticallyResumePurchase(operation.resume)) ||
			(operation.kind !== 'buy' && operation.resumeId);
		if (!shouldResume || resumed.current) return;
		resumed.current = true;
		void submit();
	}, []);

	async function submit() {
		const validation = atomicOperationFormError(operation.kind, operationValue, owner);
		if (validation) {
			setMessage(validation);
			return;
		}
		submittedAtRef.current ??= Date.now();
		setMessage('');
		setFailureKind(null);
		setPhase('working');
		let operationClaim: WalletOperationClaim | null = null;
		let attemptedTransactionId = operation.kind === 'buy' ? undefined : operation.resumeId ?? transaction?.id;
		try {
			let currentPurchaseSnapshot =
				operation.kind === 'buy'
					? latestPurchaseSnapshot(operation.resume, purchaseState ? purchaseSnapshot(purchaseState) : null)
					: null;
			const freshOperation =
				operation.kind === 'buy'
					? !hasRecoverablePurchase(currentPurchaseSnapshot)
					: !operation.resumeId && !transaction;
			const signal = attemptRef.current.signal;
			const operationKey = operationStorageKey(asset.id, owner);
			const purchaseKey = atomicPurchaseStorageKey(asset.id, owner);
			const resumeTransactionId = operation.kind === 'buy' ? undefined : operation.resumeId ?? transaction?.id;
			let exactActionBaseline = exactActionBaselineRef.current;
			const recoveryRegistrationId = currentPurchaseSnapshot?.registration?.id;
			const recovery =
				!freshOperation && operation.kind === 'buy' && recoveryRegistrationId
					? localStorage.getItem(purchaseKey)
						? {
								key: purchaseKey,
								matches: (record: any) =>
									record?.buyer === owner &&
									record?.order?.orderId === operation.order.orderId &&
									record?.snapshot?.registration?.id === recoveryRegistrationId,
						  }
						: undefined
					: !freshOperation
					? {
							key: operationKey,
							matches: (record: any) => record?.txId === resumeTransactionId,
					  }
					: undefined;
			operationClaim = await acquireWalletOperationClaim(
				localStorage,
				operationClaimStorageKey(asset.id, owner),
				[operationKey, purchaseKey],
				recovery ? { recovery } : {}
			);
			claimRef.current = operationClaim;
			if (freshOperation) {
				const { state: freshState } = await readAssetState(asset.id, { signal, maxAge: 0 });
				if (
					atomicOperationStateError(
						operation.kind,
						freshState,
						owner,
						'order' in operation ? operation.order : null
					)
				) {
					throw new Error('market-state-changed');
				}
				if (operation.kind === 'sell') {
					let pendingOffers: PendingAssetOffer[];
					try {
						pendingOffers = await discoverPendingAssetOffers(asset.id, freshState, { signal });
					} catch (cause) {
						if (signal.aborted) throw cause;
						throw marketplaceCodedError(
							'asset-pending-listing-check-unavailable',
							'asset-pending-listing-check-unavailable'
						);
					}
					const pendingOffer = pendingOffers.find((offer) => offer.actor === owner) ?? pendingOffers[0];
					if (pendingOffer) {
						throw marketplaceCodedError(
							pendingOffer.actor === owner ? 'asset-listing-pending-self' : 'asset-listing-pending-other',
							pendingListingMessage(pendingOffer, owner)
						);
					}
				}
				if (operation.kind === 'cancel' || operation.kind === 'transfer') {
					const startingSlot = Number(freshState.raw['at-slot']);
					if (!Number.isSafeInteger(startingSlot) || startingSlot < 0) {
						throw new Error('asset-action-starting-slot-unavailable');
					}
					exactActionBaseline = { startingSlot };
					exactActionBaselineRef.current = exactActionBaseline;
				}
			}
			const runtime = await loadAtomicTransactionRuntime();
			const client = new runtime.AssetTransactionClient();
			if (operation.kind === 'buy') {
				const observerLease = runtime.acquireAssetObserverNetwork();
				networkRef.current = observerLease;
				await observerLease.ready;
				const network = observerLease.network;
				if (signal.aborted) throw signal.reason;
				let observationRetryAttempt = 0;
				let completedSnapshot: PurchaseSnapshot | null = null;
				const persistPurchaseSnapshot = (snapshot: PurchaseSnapshot) => {
					onOperation({ kind: 'buy', order: operation.order, resume: snapshot });
					const record = {
						asset: { id: asset.id, name: asset.name },
						activityKind: 'atomic',
						buyer: owner,
						collectionId,
						gateway: purchaseGatewayForRecovery(purchaseKey),
						order: operation.order,
						snapshot,
						createdAt: submittedAtRef.current ?? Date.now(),
					};
					const matches = (current: any) =>
						current?.buyer === owner &&
						current?.order?.orderId === operation.order.orderId &&
						current?.snapshot?.registration?.id === snapshot.registration?.id;
					if (operationClaim) {
						promoteWalletOperationClaim(
							localStorage,
							operationClaim,
							atomicPurchaseStorageKey(asset.id, owner),
							record,
							matches
						);
					} else {
						storeWalletRecordOrThrow<any>(
							localStorage,
							atomicPurchaseStorageKey(asset.id, owner),
							record,
							matches,
							true
						);
					}
				};
				if (currentPurchaseSnapshot?.registration?.id && !currentPurchaseSnapshot.payment?.id) {
					const registration = currentPurchaseSnapshot.registration;
					const preparationAdapter = client.purchaseAdapter({
						processId: asset.id,
						order: operation.order,
						buyer: owner,
						startingBalance: '0',
						network,
						onPrepared: (event) => {
							if (event.kind !== 'payment') return;
							const snapshot = {
								...currentPurchaseSnapshot!,
								payment: { id: event.transactionId, dispatched: false },
							};
							persistPurchaseSnapshot(snapshot);
							currentPurchaseSnapshot = snapshot;
						},
					});
					if (!registration.dispatched) {
						await preparationAdapter.restorePrepared?.('registration', registration.id, signal);
					}
					await preparationAdapter.preparePayment(registration.id, signal);
					if (signal.aborted) throw signal.reason;
				}
				while (!completedSnapshot) {
					const purchase = new runtime.SwapPurchase(
						network,
						client.purchaseAdapter({
							processId: asset.id,
							order: operation.order,
							buyer: owner,
							startingBalance: '0',
							network,
						}),
						{
							registrationTarget: PURCHASE_REGISTRATION_TARGET,
							paymentTarget: PURCHASE_PAYMENT_TARGET,
							paymentSuccessDepth: 1,
							skipFrom: PURCHASE_SKIP_FROM_DEPTH,
							propagation: 'all',
							minObservers: 2,
							...(currentPurchaseSnapshot ? { resume: currentPurchaseSnapshot } : {}),
						}
					);
					purchaseRef.current = purchase;
					let recoveryConflict: Error | null = null;
					const update = (state: PurchaseState) => {
						if (signal.aborted || recoveryConflict) return;
						setPurchaseState(state);
						const snapshot = purchase.snapshot();
						if (hasRecoverablePurchase(snapshot)) {
							try {
								persistPurchaseSnapshot(snapshot);
							} catch (cause) {
								recoveryConflict = cause instanceof Error ? cause : new Error(String(cause));
								purchase.abandon();
							}
						}
					};
					purchase.on('state', update);
					purchase.on('failed', update);
					purchase.on('complete', update);
					const resumeState = purchaseObservationResumeState(currentPurchaseSnapshot, purchaseState);
					if (resumeState) setPurchaseState(resumeState);
					else update(purchase.state());
					const finalState = await purchase.run();
					if (recoveryConflict) throw recoveryConflict;
					const retryKind = purchaseObservationRetryKind(finalState);
					if (retryKind) {
						currentPurchaseSnapshot = purchase.snapshot();
						const delay = purchaseObservationRetryDelay(observationRetryAttempt++);
						setPurchaseState(purchaseObservationPendingState(finalState));
						setFailureKind(null);
						setMessage(purchaseObservationRetryMessage(finalState, delay));
						await waitForPurchaseObservationRetry(delay, signal);
						setMessage(purchaseObservationCheckingMessage(retryKind));
						continue;
					}
					if (finalState.stage !== 'complete' || !finalState.success) {
						const code = atomicPurchaseFailureCode(finalState) ?? 'asset-purchase-failed';
						const snapshot = purchase.snapshot();
						const repaired = repairRejectedPurchase(snapshot, code);
						for (const id of repaired.discardIds) {
							localStorage.removeItem(`bazar-signed-transaction:${id}`);
						}
						if (!repaired.snapshot) {
							removeWalletRecordIf<any>(
								localStorage,
								purchaseKey,
								(record) =>
									record?.buyer === owner &&
									record?.order?.orderId === operation.order.orderId &&
									record?.snapshot?.registration?.id === snapshot.registration?.id
							);
							onOperation({ kind: 'buy', order: operation.order });
						} else if (repaired.snapshot !== snapshot) {
							storeWalletRecordOrThrow<any>(
								localStorage,
								purchaseKey,
								{
									asset: { id: asset.id, name: asset.name },
									activityKind: 'atomic',
									buyer: owner,
									collectionId,
									gateway: purchaseGatewayForRecovery(purchaseKey),
									order: operation.order,
									snapshot: repaired.snapshot,
									createdAt: submittedAtRef.current ?? Date.now(),
								},
								(record) =>
									record?.buyer === owner &&
									record?.order?.orderId === operation.order.orderId &&
									record?.snapshot?.registration?.id === snapshot.registration?.id
							);
							setPurchaseState({ ...finalState, payment: undefined });
						}
						throw marketplaceCodedError(code, finalState.error?.message ?? code);
					}
					completedSnapshot = purchase.snapshot();
				}
				removeWalletRecoveryAndSignatures<any>(
					localStorage,
					atomicPurchaseStorageKey(asset.id, owner),
					(record) =>
						record?.buyer === owner &&
						record?.order?.orderId === operation.order.orderId &&
						record?.snapshot?.registration?.id === completedSnapshot.registration?.id,
					[completedSnapshot.registration?.id, completedSnapshot.payment?.id],
					owner
				);
				if (operationClaim) {
					releaseWalletOperationClaim(localStorage, operationClaim);
					operationClaim = null;
					claimRef.current = null;
				}
				setPhase('done');
				return;
			}
			let prepared: PreparedTransaction;
			let newlyPrepared = false;
			if (transaction) {
				prepared = transaction;
			} else if (operation.resumeId) {
				prepared = client.restore(operation.resumeId, owner);
			} else if (operation.kind === 'sell') {
				const winston = arToWinston(value);
				prepared = await client.makeOffer(
					{ processId: asset.id, quantity: '1', asking: winston, seller: owner },
					signal
				);
				newlyPrepared = true;
			} else if (operation.kind === 'cancel') {
				prepared = await client.cancelOrder(asset.id, operation.order.orderId, owner, signal);
				newlyPrepared = true;
			} else if (operation.kind === 'transfer') {
				prepared = await client.transfer(asset.id, operationValue, '1', owner, signal);
				newlyPrepared = true;
			} else throw new Error('invalid-operation');
			attemptedTransactionId = prepared.id;
			if ((operation.kind === 'cancel' || operation.kind === 'transfer') && !exactActionBaseline) {
				throw new Error('asset-action-recovery-baseline-missing');
			}
			if (discardNewlyPreparedTransactionIfAborted(localStorage, prepared.id, newlyPrepared, signal)) {
				throw signal.reason;
			}
			setTransaction(prepared);
			onOperation(
				operation.kind === 'cancel'
					? {
							kind: 'cancel',
							order: operation.order,
							resumeId: prepared.id,
							startingSlot: exactActionBaseline!.startingSlot,
					  }
					: operation.kind === 'transfer'
					? {
							kind: 'transfer',
							resumeId: prepared.id,
							startingSlot: exactActionBaseline!.startingSlot,
							value: operationValue,
					  }
					: { kind: 'sell', resumeId: prepared.id, value: operationValue }
			);
			const operationRecord = {
				txId: prepared.id,
				kind: operation.kind,
				assetId: asset.id,
				asset: { id: asset.id, name: asset.name, ...(asset.image ? { image: asset.image } : {}) },
				activityKind: 'atomic',
				collectionId,
				signer: owner,
				...(operation.kind === 'cancel'
					? { order: operation.order, startingSlot: exactActionBaseline!.startingSlot }
					: operation.kind === 'transfer'
					? { value: operationValue, startingSlot: exactActionBaseline!.startingSlot }
					: { value: operationValue }),
				createdAt: Date.now(),
			};
			try {
				const matches = (current: any) => current?.txId === prepared.id;
				if (operationClaim) {
					promoteWalletOperationClaim(
						localStorage,
						operationClaim,
						operationStorageKey(asset.id, owner),
						operationRecord,
						matches
					);
				} else {
					storeWalletRecordOrThrow<any>(
						localStorage,
						operationStorageKey(asset.id, owner),
						operationRecord,
						matches,
						true
					);
				}
			} catch (cause) {
				localStorage.removeItem(`bazar-signed-transaction:${prepared.id}`);
				setTransaction(null);
				throw cause;
			}
			setViews([]);
			setConfirmations(0);
			setConsensus(null);
			await runtime.dispatchAndConfirm(prepared, {
				signal,
				target: 5,
				onViews: setViews,
				onConsensus: setConsensus,
				onProgress: (progress) => setConfirmations(progress.confirmations),
			});
			setConfirmations(5);
			setMessage('Five confirmations reached. Waiting for the scheduler safety depth and live asset state…');
			if (operation.kind === 'sell') {
				await client.waitForOfferAcceptance(
					asset.id,
					{
						orderId: prepared.id,
						seller: owner,
						quantity: '1',
						asking: arToWinston(value),
						minimumFee: runtime.DEFAULT_REGISTRATION_FEE.toString(),
					},
					signal
				);
			} else if (operation.kind === 'cancel') {
				await client.waitForExactCancellation(
					asset.id,
					prepared.id,
					owner,
					operation.order,
					exactActionBaseline!,
					signal
				);
			} else if (operation.kind === 'transfer') {
				await client.waitForFungibleTransfer(
					asset.id,
					prepared.id,
					owner,
					operationValue,
					'1',
					exactActionBaseline!,
					signal
				);
			}
			removeWalletRecoveryAndSignatures<any>(
				localStorage,
				operationStorageKey(asset.id, owner),
				(record) => record?.txId === prepared.id,
				[prepared.id],
				owner
			);
			if (operationClaim) {
				releaseWalletOperationClaim(localStorage, operationClaim);
				operationClaim = null;
				claimRef.current = null;
			}
			setPhase('done');
		} catch (cause) {
			if (operationClaim) releaseWalletOperationClaim(localStorage, operationClaim);
			claimRef.current = null;
			networkRef.current?.release();
			networkRef.current = null;
			if (attemptRef.current.signal.aborted) return;
			if (
				cause instanceof Error &&
				['asset-cancel-rejected', 'fungible-transfer-rejected'].includes(cause.message) &&
				attemptedTransactionId
			) {
				removeWalletRecordIf<any>(
					localStorage,
					operationStorageKey(asset.id, owner),
					(record) => record?.txId === attemptedTransactionId
				);
				localStorage.removeItem(`bazar-signed-transaction:${attemptedTransactionId}`);
				setTransaction(null);
			}
			setFailureKind(marketplaceOperationFailure(cause));
			setMessage(errorMessage(cause));
			setPhase('error');
		}
	}

	const purchaseSteps: ArweaveSyncStep[] =
		purchaseState && hasRecoverablePurchase(purchaseState)
			? [
					{
						key: 'register',
						label: 'Reserve asset',
						target: PURCHASE_REGISTRATION_TARGET,
						transaction: purchaseState.registration,
					},
					{
						key: 'pay',
						label: 'Pay seller',
						target: PURCHASE_PAYMENT_TARGET,
						terminal: true,
						transaction: purchaseState.payment,
					},
			  ]
			: [];
	const steps: ArweaveSyncStep[] = transaction
		? [
				{
					key: operation.kind,
					label: operationLabel(operation.kind),
					target: 5,
					terminal: true,
					confirmations,
					transaction: { id: transaction.id, views, ...(consensus ? { consensus } : {}) },
				},
		  ]
		: purchaseSteps;
	const activeStep =
		purchaseState?.stage.includes('payment') || purchaseState?.stage === 'ownership-verifying'
			? 'pay'
			: operation.kind === 'buy'
			? 'register'
			: operation.kind;
	const activeSyncStep = steps.find((step) => step.key === activeStep) ?? steps[0];
	const confirmationTarget = activeSyncStep?.target ?? 5;
	const activityConfirmations = Math.min(confirmationTarget, quorumConfirmationDepth(activeSyncStep));
	const visiblePhase =
		operation.kind === 'buy' && phase === 'done' && purchaseState?.stage !== 'complete' ? 'error' : phase;
	const visibleMessage =
		message ||
		(purchaseState?.error ? errorMessage(new Error(purchaseState.error.message || purchaseState.error.code)) : '');
	const workingStatus = message || purchaseStatusMessage(purchaseState);
	const pendingAfterConfirmation =
		purchaseState?.stage === 'registration-accepting'
			? 'Checking live reservation'
			: purchaseState?.stage === 'ownership-verifying'
			? 'Checking ownership'
			: postConfirmationPendingLabel(activityConfirmations, confirmationTarget, workingStatus);
	const formError = atomicOperationFormError(operation.kind, operationValue, owner);
	const recoverable = Boolean(
		transaction ||
			hasRecoverablePurchase(purchaseState) ||
			(operation.kind === 'buy' && hasRecoverablePurchase(operation.resume))
	);
	const terminalReservationFailure = atomicPurchaseHasTerminalReservationFailure(purchaseState);
	const sellerPrice =
		operation.kind === 'buy' || operation.kind === 'cancel' ? `${winstonToAr(operation.order.asking)} AR` : '';
	const purchaseAffordable =
		purchaseQuote && purchaseWalletBalance !== null ? purchaseWalletBalance >= BigInt(purchaseQuote.total) : null;
	const actionLabel = atomicOperationActionLabel(operation, operationValue);
	const resultCopy = atomicOperationResult(operation.kind, asset.name, operationValue, owner);
	const reportedStatus =
		visiblePhase === 'form'
			? 'Waiting for details'
			: visiblePhase === 'approval'
			? 'Waiting for wallet approval'
			: visiblePhase === 'working'
			? workingStatus || 'Watching Arweave confirmations…'
			: visiblePhase === 'done'
			? resultCopy.title
			: visibleMessage || 'This transaction needs attention';
	React.useEffect(() => {
		onUpdate(
			taskId,
			{
				phase: visiblePhase,
				status: reportedStatus,
				confirmations: activityConfirmations,
				confirmationTarget,
			},
			asset.id
		);
	}, [activityConfirmations, asset.id, confirmationTarget, onUpdate, reportedStatus, taskId, visiblePhase]);
	const restartPurchase = () => {
		if (operation.kind !== 'buy' || !recoverable) {
			setMessage('');
			setFailureKind(null);
			setPhase('form');
			return;
		}
		if (purchaseState) {
			const snapshot = purchaseSnapshot(purchaseState);
			if (hasRecoverablePurchase(snapshot)) {
				const record = {
					asset: { id: asset.id, name: asset.name },
					activityKind: 'atomic',
					buyer: owner,
					collectionId,
					gateway: purchaseGatewayForRecovery(atomicPurchaseStorageKey(asset.id, owner)),
					order: operation.order,
					snapshot,
					createdAt: submittedAtRef.current ?? Date.now(),
				};
				storeWalletRecordIf<any>(
					localStorage,
					atomicPurchaseStorageKey(asset.id, owner),
					record,
					(current) =>
						current?.buyer === owner &&
						current?.order?.orderId === operation.order.orderId &&
						current?.snapshot?.registration?.id === snapshot.registration?.id,
					true
				);
			}
		}
		attemptRef.current.abort();
		purchaseRef.current?.abandon();
		networkRef.current?.release();
		networkRef.current = null;
		onClose(false);
	};
	const startFreshPurchase = () => {
		if (operation.kind !== 'buy') return;
		const snapshot = latestPurchaseSnapshot(
			operation.resume,
			purchaseState ? purchaseSnapshot(purchaseState) : null
		);
		if (snapshot?.registration?.id) {
			removeWalletRecoveryAndSignatures<any>(
				localStorage,
				atomicPurchaseStorageKey(asset.id, owner),
				(record) =>
					record?.buyer === owner &&
					record?.order?.orderId === operation.order.orderId &&
					record?.snapshot?.registration?.id === snapshot.registration?.id,
				[snapshot.registration.id, snapshot.payment?.id],
				owner
			);
		}
		onOperation({ kind: 'buy', order: operation.order });
		purchaseRef.current = null;
		submittedAtRef.current = undefined;
		setPurchaseState(null);
		setMessage('');
		setFailureKind(null);
		setPhase('form');
	};
	const closeOrHide = () => {
		const action = transactionDialogDismissAction(visiblePhase, recoverable && !terminalReservationFailure);
		if (action.kind === 'close') {
			onClose(action.resumeLater, action.refresh);
			return;
		}
		if (hiding) return;
		if (dialogRef.current) {
			prepareTransactionDialogHide(
				dialogRef.current,
				document.querySelector<HTMLElement>('.operation-activity-trigger[data-activity-owner="global"]')
			);
		}
		setHiding(true);
		hideTimerRef.current = window.setTimeout(() => {
			hideTimerRef.current = null;
			onHide();
		}, TRANSACTION_DIALOG_HIDE_DURATION_MS);
	};
	const dialogRef = useDialogFocus<HTMLDivElement>(visible, closeOrHide, undefined, visiblePhase, restoreFallback);
	React.useEffect(() => {
		if (visible) setHiding(false);
	}, [visible]);
	if (!visible && visiblePhase !== 'working') return null;
	return (
		<div
			className={`dialog-backdrop operation-panel-backdrop${hiding ? ' dialog-backdrop-hiding' : ''}`}
			hidden={!visible}
			onMouseDown={(event) => event.target === event.currentTarget && closeOrHide()}
			role="presentation"
		>
			<div
				className={`dialog operation-side-panel${visiblePhase === 'working' ? '' : ' dialog-compact'}${
					visiblePhase === 'form' ? ' dialog-form-phase' : ''
				}`}
				aria-hidden={visible ? undefined : true}
				aria-labelledby={visible ? `${operationLabelId} ${titleId}` : undefined}
				aria-modal={visible ? true : undefined}
				ref={dialogRef}
				role={visible ? 'dialog' : undefined}
				tabIndex={-1}
			>
				<div className="dialog-heading">
					<div className={visiblePhase === 'working' ? 'dialog-asset-heading' : undefined}>
						{visiblePhase === 'working' ? (
							asset.image ? (
								<ArtworkImage
									alt=""
									className="dialog-asset-artwork"
									decoding="async"
									loading="eager"
									src={asset.image}
								/>
							) : (
								<span aria-hidden="true" className="dialog-asset-artwork dialog-asset-artwork-fallback">
									{asset.name.slice(0, 1)}
								</span>
							)
						) : null}
						<div className="dialog-asset-heading-copy">
							<p className="eyebrow" id={operationLabelId}>
								{operationLabel(operation.kind)}
							</p>
							<h2 id={titleId}>{asset.name}</h2>
						</div>
					</div>
					<TransactionDialogControl hiding={hiding} phase={visiblePhase} onClick={closeOrHide} />
				</div>
				<OperationOutcomeAnnouncement
					active={visiblePhase === 'done'}
					title={resultCopy.title}
					detail={resultCopy.detail}
				/>
				{visiblePhase === 'working' && operation.kind === 'buy' ? (
					<AtomicPurchaseSequence state={purchaseState} />
				) : null}
				{visiblePhase === 'approval' && operation.kind === 'buy' ? (
					<div className="recovery-approval">
						<div>
							<h3>{recoveryApprovalCopy?.title}</h3>
							<p>{recoveryApprovalCopy?.detail}</p>
						</div>
						<div className="operation-summary">
							<span>Seller</span>
							<WalletAddress
								address={operation.order.creator}
								className="operation-summary-link"
								full
								label="seller"
							/>
							<span>Seller payment</span>
							<strong>
								<ArCurrencyText>{sellerPrice}</ArCurrencyText>
							</strong>
							<span>New approvals</span>
							<strong>{recoveryApprovalCount}</strong>
							{operation.resume?.registration?.id ? (
								<small>
									Reservation{' '}
									<a
										href={transactionExplorerUrl(operation.resume.registration.id)}
										rel="noreferrer"
										target="_blank"
									>
										<OperationExternalLink>
											{short(operation.resume.registration.id)}
										</OperationExternalLink>
									</a>{' '}
									is already signed.
								</small>
							) : null}
						</div>
						<Button
							className="wide"
							data-dialog-initial
							onClick={() => void submit()}
							type="button"
							size="custom"
							variant="primary"
						>
							{recoveryApprovalCopy?.action}
						</Button>
					</div>
				) : null}
				{visiblePhase === 'form' ? (
					<form
						className="operation-form"
						onSubmit={(event) => {
							event.preventDefault();
							void submit();
						}}
					>
						<div className="dialog-form-scroll">
							{operation.kind === 'buy' ? (
								<div className="operation-summary">
									<span>Seller</span>
									<WalletAddress
										address={operation.order.creator}
										className="operation-summary-link"
										full
										label="seller"
									/>
									<span>Seller price</span>
									<strong>
										<ArCurrencyText>{sellerPrice}</ArCurrencyText>
									</strong>
									<span>Network fees</span>
									<strong>
										{quoteError ? (
											'Unavailable'
										) : purchaseQuote ? (
											<ArCurrencyText>{`${winstonToAr(
												(BigInt(purchaseQuote.total) - BigInt(purchaseQuote.asking)).toString()
											)} AR`}</ArCurrencyText>
										) : (
											'Checking…'
										)}
									</strong>
									<span>Maximum total</span>
									<strong>
										{quoteError ? (
											'Unavailable'
										) : purchaseQuote ? (
											<ArCurrencyText>{`${winstonToAr(purchaseQuote.total)} AR`}</ArCurrencyText>
										) : (
											'Checking…'
										)}
									</strong>
									<span>Wallet after purchase</span>
									<strong>
										{quoteError ? (
											'Unavailable'
										) : purchaseQuote && purchaseWalletBalance !== null ? (
											purchaseAffordable ? (
												<ArCurrencyText>{`${winstonToAr(
													(purchaseWalletBalance - BigInt(purchaseQuote.total)).toString()
												)} AR`}</ArCurrencyText>
											) : (
												<ArCurrencyText>Insufficient AR</ArCurrencyText>
											)
										) : (
											'Checking…'
										)}
									</strong>
									<small>
										One asset · native <ArCurrencyLabel /> settlement
									</small>
								</div>
							) : null}
							{operation.kind === 'buy' ? (
								<p className="sr-only" id={quoteStatusId} aria-live="polite" role="status">
									<ArCurrencyText>
										{quoteError
											? 'Purchase quote unavailable. Retry the cost check before buying.'
											: purchaseQuote
											? `Purchase quote ready. Maximum total ${winstonToAr(
													purchaseQuote.total
											  )} AR.${purchaseAffordable ? '' : ' This wallet has insufficient AR.'}`
											: 'Checking the exact purchase cost.'}
									</ArCurrencyText>
								</p>
							) : null}
							{operation.kind === 'buy' ? (
								<div
									className={quoteError ? 'inline-error retry-notice' : 'quote-check-action'}
									role={quoteError ? 'status' : undefined}
								>
									<span>
										{quoteError
											? 'Compute hasn’t completed yet. Please try again.'
											: purchaseQuote
											? 'Costs checked.'
											: 'Checking wallet balance and network fees…'}
									</span>
									<Button
										aria-describedby={quoteStatusId}
										aria-disabled={!purchaseQuote && !quoteError}
										className="with-icon"
										size="custom"
										type="button"
										onClick={() => {
											if (purchaseQuote || quoteError) setQuoteRetry((current) => current + 1);
										}}
									>
										<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
									</Button>
								</div>
							) : null}
							{operation.kind === 'sell' ? (
								<label>
									<span>
										Sale price in <ArCurrencyLabel />
									</span>
									<input
										autoFocus
										data-dialog-initial
										aria-describedby={fieldHelpId}
										aria-invalid={Boolean(value && formError)}
										value={value}
										onChange={(event) => setValue(event.target.value)}
										placeholder="0.25"
									/>
								</label>
							) : null}
							{operation.kind === 'transfer' ? (
								<label>
									Recipient wallet address
									<input
										autoFocus
										data-dialog-initial
										aria-describedby={fieldHelpId}
										aria-invalid={Boolean(value && formError)}
										autoCapitalize="none"
										autoComplete="off"
										autoCorrect="off"
										spellCheck={false}
										value={value}
										onChange={(event) => setValue(event.target.value)}
										placeholder="43-character Arweave address"
									/>
								</label>
							) : null}
							{operation.kind === 'transfer' && operationValue && !formError ? (
								<div className="operation-summary transfer-review">
									<span>Recipient</span>
									<WalletIdentity address={operationValue} />
									<small>
										Review the complete destination before asking your wallet to approve this
										irreversible transfer.
									</small>
								</div>
							) : null}
							{operation.kind === 'cancel' ? (
								<div className="operation-summary">
									<span>Open listing</span>
									<strong>
										<ArCurrencyText>{sellerPrice}</ArCurrencyText>
									</strong>
									<small>
										Cancelling returns the asset from order escrow to your liquid balance.
									</small>
								</div>
							) : null}
							{operation.kind === 'sell' || operation.kind === 'transfer' ? (
								<p
									id={fieldHelpId}
									className={value && formError ? 'field-help field-help-error' : 'field-help'}
									role={value && formError ? 'alert' : undefined}
								>
									{formError ? <ArCurrencyText>{formError}</ArCurrencyText> : null}
								</p>
							) : null}
							<p className="operation-disclosure">
								{operation.kind === 'buy'
									? 'Your wallet will ask for two approvals: one reservation and one seller payment. The payment stays local until the reservation is accepted by the network.'
									: 'After signing, Bazar observes this action through independently addressed Arweave nodes. Signed transaction details are saved in this browser so you can return with the same wallet while browser data remains available.'}
							</p>
						</div>
						<Button
							aria-describedby={operation.kind === 'buy' ? quoteStatusId : undefined}
							className={`wide${
								operation.kind === 'buy' || operation.kind === 'sell'
									? ' with-icon market-primary-action'
									: ''
							}`}
							data-dialog-initial
							size="custom"
							disabled={
								Boolean(formError) ||
								(operation.kind === 'buy' &&
									(!purchaseQuote || purchaseAffordable !== true || Boolean(quoteError)))
							}
							type="submit"
							variant={operation.kind === 'cancel' ? 'danger' : 'primary'}
						>
							{operation.kind === 'buy' ? (
								<ShoppingCart className="ui-icon ui-icon--sm" aria-hidden="true" />
							) : operation.kind === 'sell' ? (
								<Tag className="ui-icon ui-icon--sm" aria-hidden="true" />
							) : null}
							{operation.kind === 'buy' && purchaseAffordable === false ? (
								<ArCurrencyText>Insufficient AR</ArCurrencyText>
							) : operation.kind === 'buy' && purchaseQuote ? (
								<ArCurrencyText>{`Buy · up to ${winstonToAr(purchaseQuote.total)} AR`}</ArCurrencyText>
							) : (
								<ArCurrencyText>{actionLabel}</ArCurrencyText>
							)}
						</Button>
					</form>
				) : null}
				{visiblePhase === 'working' && !steps.length ? (
					<div className="operation-preparing">
						<Loading
							label={
								(operation.kind === 'buy' ? operation.resume : operation.resumeId)
									? 'Recovering the signed transaction…'
									: 'Preparing secure wallet approvals…'
							}
						/>
						<p>
							{operation.kind === 'buy'
								? 'Bazar may contact observer nodes while preparing the reservation and seller payment, but no transaction is submitted until its signing step completes.'
								: 'Bazar is preparing the Arweave transaction. The network view will appear as soon as the signed transaction is recoverable.'}
						</p>
					</div>
				) : null}
				{visiblePhase === 'working' && recoverable ? (
					<div className="operation-working">
						<p className="sr-only" aria-live="polite" role="status">
							{workingStatus ||
								'Watching independently addressed Arweave nodes report confirmations for this action.'}
						</p>
						<React.Suspense fallback={<Loading label="Loading transaction progress…" />}>
							<ArweaveTransactionSync
								active={visible}
								skipKind={purchaseSkipKind(purchaseState)}
								onSkip={
									purchaseState?.canSkip
										? () => {
												purchaseRef.current?.skip();
										  }
										: undefined
								}
								subject={asset.name}
								startedAt={submittedAtRef.current}
								steps={steps}
								activeStep={activeStep}
								pendingAfterConfirmation={pendingAfterConfirmation}
							/>
						</React.Suspense>
					</div>
				) : null}
				{visiblePhase === 'done' ? (
					<div className="result success">
						<OperationOutcome
							title={resultCopy.title}
							detail={resultCopy.detail}
							status={
								operation.kind === 'buy'
									? `Confirmations: ${quorumConfirmationDepth(
											purchaseSteps.find((step) => step.key === 'pay')
									  )}`
									: undefined
							}
						>
							{operation.kind === 'buy' && purchaseSteps.length ? (
								<div className="result-outcome-sync">
									<React.Suspense fallback={<Loading label="Loading transaction progress…" />}>
										<ArweaveTransactionSync
											active={visible}
											activeStep="pay"
											startedAt={submittedAtRef.current}
											steps={purchaseSteps}
											subject={asset.name}
										/>
									</React.Suspense>
								</div>
							) : null}
							{operation.kind === 'buy' || operation.kind === 'sell' ? (
								<OperationOutcomeSubject
									label={operation.kind === 'buy' ? 'You received' : 'You listed'}
									title={asset.name}
									detail={operation.kind === 'sell' ? `${value} AR` : 'One asset'}
									media={
										asset.image ? (
											<ArtworkImage
												alt={`${asset.name} artwork`}
												className="operation-outcome-subject-artwork"
												decoding="async"
												loading="eager"
												src={asset.image}
											/>
										) : (
											<span
												aria-label={`${asset.name} artwork`}
												className="operation-outcome-subject-artwork operation-outcome-subject-artwork-fallback"
												role="img"
											>
												{asset.name.slice(0, 1)}
											</span>
										)
									}
								/>
							) : null}
						</OperationOutcome>
						{operation.kind === 'buy' ? (
							<div className="settlement-receipt">
								<div>
									<span>Seller payment</span>
									<strong>
										<ArCurrencyText>{sellerPrice}</ArCurrencyText>
									</strong>
								</div>
								<div>
									<span>Seller</span>
									<WalletAddress address={operation.order.creator} full label="seller" />
								</div>
								<div>
									<span>Order</span>
									<a
										href={transactionExplorerUrl(operation.order.orderId)}
										rel="noreferrer"
										target="_blank"
									>
										<OperationExternalLink>{short(operation.order.orderId)}</OperationExternalLink>
									</a>
								</div>
								<div className="settlement-receipt-links">
									{purchaseState?.registration?.id ? (
										<a
											href={transactionExplorerUrl(purchaseState.registration.id)}
											rel="noreferrer"
											target="_blank"
										>
											<OperationExternalLink>
												Reservation {short(purchaseState.registration.id)}
											</OperationExternalLink>
										</a>
									) : null}
									{purchaseState?.payment?.id ? (
										<a
											href={transactionExplorerUrl(purchaseState.payment.id)}
											rel="noreferrer"
											target="_blank"
										>
											<OperationExternalLink>
												Payment {short(purchaseState.payment.id)}
											</OperationExternalLink>
										</a>
									) : null}
								</div>
							</div>
						) : operation.kind === 'transfer' && transaction ? (
							<div className="settlement-receipt">
								<div>
									<span>Asset</span>
									<strong>{asset.name}</strong>
								</div>
								<div>
									<span>Recipient</span>
									<WalletAddress address={value.trim()} full label="recipient" />
								</div>
								<div className="settlement-receipt-links">
									<a href={transactionExplorerUrl(transaction.id)} rel="noreferrer" target="_blank">
										<OperationExternalLink>
											Transaction {short(transaction.id)}
										</OperationExternalLink>
									</a>
								</div>
							</div>
						) : transaction ? (
							<a href={transactionExplorerUrl(transaction.id)} rel="noreferrer" target="_blank">
								<OperationExternalLink>View transaction {short(transaction.id)}</OperationExternalLink>
							</a>
						) : null}
						<Button
							className="with-icon"
							data-dialog-initial
							onClick={onViewAsset}
							size="custom"
							variant="primary"
						>
							<ArrowLeft className="ui-icon ui-icon--sm" aria-hidden="true" /> View updated asset
						</Button>
					</div>
				) : null}
				{visiblePhase === 'error' ? (
					<div className="result error">
						<AtomicOperationErrorAlert message={visibleMessage} />
						{failureKind === 'market-state-changed' ? (
							<Button data-dialog-initial type="button" onClick={() => onClose(false)} size="custom">
								View updated asset
							</Button>
						) : operation.kind === 'buy' ? (
							<>
								<div className="settlement-receipt">
									<div>
										<span>Failed stage</span>
										<strong>{atomicPurchaseFailureStage(purchaseState)}</strong>
									</div>
									<div>
										<span>Seller</span>
										<WalletAddress address={operation.order.creator} full label="seller" />
									</div>
									<div>
										<span>Order</span>
										<a
											href={transactionExplorerUrl(operation.order.orderId)}
											rel="noreferrer"
											target="_blank"
										>
											<OperationExternalLink>
												{short(operation.order.orderId)}
											</OperationExternalLink>
										</a>
									</div>
									<div className="settlement-receipt-links">
										{purchaseState?.registration?.id ? (
											<a
												href={transactionExplorerUrl(purchaseState.registration.id)}
												rel="noreferrer"
												target="_blank"
											>
												<OperationExternalLink>
													Reservation {short(purchaseState.registration.id)}
												</OperationExternalLink>
											</a>
										) : null}
										{purchaseState?.payment?.id ? (
											<a
												href={transactionExplorerUrl(purchaseState.payment.id)}
												rel="noreferrer"
												target="_blank"
											>
												<OperationExternalLink>
													Payment {short(purchaseState.payment.id)}
												</OperationExternalLink>
											</a>
										) : null}
									</div>
								</div>
								{atomicPurchaseFailureCode(purchaseState) === 'registration-dispatch-rejected' ? (
									<Button data-dialog-initial onClick={() => onClose(false)} size="custom">
										View current listing
									</Button>
								) : terminalReservationFailure ? (
									<Button data-dialog-initial onClick={startFreshPurchase} size="custom">
										Start a new purchase
									</Button>
								) : atomicPurchaseFailureCode(purchaseState) === 'payment-dispatch-rejected' ? (
									<Button data-dialog-initial onClick={() => void submit()} size="custom">
										Sign a replacement seller payment
									</Button>
								) : (
									<Button data-dialog-initial onClick={restartPurchase} size="custom">
										{recoverable ? 'Continue saved purchase' : 'Try again'}
									</Button>
								)}
							</>
						) : failureKind === 'transaction-rejected' && transaction ? (
							<Button
								data-dialog-initial
								size="custom"
								onClick={() => {
									removeWalletRecordIf<any>(
										localStorage,
										operationStorageKey(asset.id, owner),
										(record) => record?.txId === transaction.id
									);
									localStorage.removeItem(`bazar-signed-transaction:${transaction.id}`);
									onClose(false);
								}}
								variant="danger"
							>
								Discard rejected signature and sign again
							</Button>
						) : transaction ? (
							<Button data-dialog-initial onClick={() => void submit()} size="custom">
								Resume the signed transaction
							</Button>
						) : (
							<Button
								data-dialog-initial
								size="custom"
								onClick={() => {
									setFailureKind(null);
									setMessage('');
									setPhase('form');
								}}
							>
								Try again
							</Button>
						)}
					</div>
				) : null}
			</div>
		</div>
	);
}

export function AtomicOperationErrorAlert({ message }: { message: string }) {
	return <OperationErrorAlert title="Could not complete this action" message={message} />;
}

function collectionKindLabel(collection: Collection) {
	if (collection.kind === 'names') return 'Arweave identity';
	if (collection.kind === 'tokens') return 'Fungible token collection';
	return 'Permanent artwork collection';
}

export function collectionDisplayName(collection: Collection) {
	return collection.kind === 'tokens' ? 'Tokens' : collection.name;
}

function collectionEyebrow(collection: Collection) {
	if (collection.kind === 'names') return 'Carrier assets';
	if (collection.kind === 'tokens') return 'Fungible tokens';
	return 'Permanent artwork';
}

export function searchResultScore(
	{ asset, collection }: { asset: AssetSummary; collection: Collection },
	query: string
) {
	if (!query) return 0;
	const name = asset.name.toLowerCase();
	const ticker = asset.ticker?.toLowerCase() ?? '';
	if (ticker === query) return 5;
	if (name === query) return 4;
	if (name.startsWith(query) || ticker.startsWith(query)) return 3;
	if (name.includes(query) || ticker.includes(query)) return 2;
	return `${collection.name} ${collection.description}`.toLowerCase().includes(query) ? 1 : 0;
}

const canonicalNameSearchIndexes = new WeakMap<object, ReadonlyArray<{ asset: AssetSummary; searchName: string }>>();

export function collectionSearchAssets(collection: Collection, query: string): AssetSummary[] {
	const normalizedQuery = query.trim().toLowerCase();
	const visibleAssets = collection.assets.filter((asset) => isVisibleAssetId(asset.id));
	if (!normalizedQuery) return visibleAssets;
	const loadedMatches = visibleAssets.filter((asset) => assetMatchesCollectionQuery(asset, normalizedQuery));
	if (collection.kind !== 'names' || !collection.namespace) return loadedMatches;
	const seen = new Set(loadedMatches.map((asset) => asset.id));
	let canonicalIndex = canonicalNameSearchIndexes.get(collection.namespace.namesById);
	if (!canonicalIndex) {
		canonicalIndex = Object.entries(collection.namespace.namesById).map(([id, name]) => ({
			asset: { id, name },
			searchName: name.toLowerCase(),
		}));
		canonicalNameSearchIndexes.set(collection.namespace.namesById, canonicalIndex);
	}
	const canonicalMatches = canonicalIndex
		.filter(
			({ asset, searchName }) =>
				isVisibleAssetId(asset.id) && searchName.includes(normalizedQuery) && !seen.has(asset.id)
		)
		.map(({ asset }) => asset);
	return [...loadedMatches, ...canonicalMatches];
}

export function collectionMoreAssets(assets: AssetSummary[], assetId: string, limit = 4): AssetSummary[] {
	const result: AssetSummary[] = [];
	for (const asset of assets) {
		if (asset.id === assetId || !isVisibleAssetId(asset.id)) continue;
		result.push(asset);
		if (result.length === limit) break;
	}
	return result;
}

export function assetMatchesCollectionQuery(asset: AssetSummary, query: string): boolean {
	const normalizedQuery = query.trim().toLowerCase();
	return (
		!normalizedQuery ||
		asset.name.toLowerCase().includes(normalizedQuery) ||
		asset.ticker?.toLowerCase().includes(normalizedQuery) === true ||
		asset.id.toLowerCase().includes(normalizedQuery)
	);
}

export function marketplaceAssetMatchesSearch(asset: AssetSummary, collection: Collection, query: string): boolean {
	if (!isVisibleCollectionId(collection.id) || !isVisibleAssetId(asset.id)) return false;
	const normalizedQuery = query.trim().toLowerCase();
	return (
		assetMatchesCollectionQuery(asset, normalizedQuery) ||
		`${collection.name} ${collection.description}`.toLowerCase().includes(normalizedQuery)
	);
}

export function directTokenSearchCollection(collections: Collection[], query: string): Collection | undefined {
	return ARWEAVE_ADDRESS.test(query.trim()) && isVisibleAssetId(query.trim())
		? collections.find((collection) => collection.kind === 'tokens')
		: undefined;
}

export function collectionMatchesSearch(collection: Collection, query: string): boolean {
	if (!query) return true;
	return (
		`${collection.name} ${collection.description}`.toLowerCase().includes(query) ||
		collectionSearchAssets(collection, query).length > 0
	);
}

export type HomeAssetType = 'all' | 'tokens' | 'atomic';

export function homeAssetTypeMatches(collection: Collection, assetType: HomeAssetType): boolean {
	if (assetType === 'all') return true;
	return assetType === 'tokens' ? collection.kind === 'tokens' : collection.kind !== 'tokens';
}

export function interleaveCollectionAssets(
	collections: Collection[],
	limit: number,
	include: (asset: AssetSummary, collection: Collection) => boolean = () => true
) {
	const queues = collections
		.filter((collection) => isVisibleCollectionId(collection.id))
		.map((collection) => ({
			collection,
			assets: collection.assets.filter((asset) => isVisibleAssetId(asset.id) && include(asset, collection)),
		}));
	const results: { asset: AssetSummary; collection: Collection }[] = [];
	for (let index = 0; results.length < limit && queues.some(({ assets }) => index < assets.length); index += 1) {
		for (const { collection, assets } of queues) {
			const asset = assets[index];
			if (asset) results.push({ asset, collection });
			if (results.length === limit) break;
		}
	}
	return results;
}

export function homeDiscoveryAssets(
	collections: Collection[],
	verifiedListings: Record<string, AssetSummary[]>,
	limit: number,
	portableListings: Array<Pick<ResolvedAsset, 'asset' | 'collection'> & { activity?: HomeListingActivity }> = []
) {
	const collectionsById = new Map(collections.map((collection) => [collection.id, collection]));
	const verified = interleaveCollectionAssets(
		collections.map((collection) => ({
			...collection,
			assets: verifiedListings[collection.id] ?? [],
		})),
		limit
	).map(({ asset, collection }) => ({ asset, collection: collectionsById.get(collection.id)! }));
	const fallback = interleaveCollectionAssets(
		collections,
		limit,
		(asset, collection) => Boolean(asset.image || asset.media) || collection.kind === 'tokens'
	);
	const verifiedAssets = new Map(
		Object.values(verifiedListings)
			.flat()
			.map((asset) => [asset.id, asset])
	);
	const seen = new Set<string>();
	const portable = [...portableListings]
		.sort((left, right) => {
			if (!left.activity || !right.activity) return 0;
			return right.activity.height - left.activity.height || right.activity.timestamp - left.activity.timestamp;
		})
		.map((listing) => {
			const asset = verifiedAssets.get(listing.asset.id);
			return asset ? { ...listing, asset } : listing;
		});
	return [...portable, ...verified, ...fallback]
		.filter(({ asset, collection }) => isVisibleCollectionId(collection.id) && isVisibleAssetId(asset.id))
		.filter(({ asset }) => {
			if (seen.has(asset.id)) return false;
			seen.add(asset.id);
			return true;
		})
		.slice(0, limit);
}

export function homeAllAssets(
	collections: Collection[],
	limit: number,
	portableListings: Array<Pick<ResolvedAsset, 'asset' | 'collection'>> = []
) {
	const indexed = interleaveCollectionAssets(
		collections,
		limit,
		(asset, collection) => Boolean(asset.image || asset.media) || collection.kind === 'tokens'
	);
	const seen = new Set<string>();
	return [...indexed, ...portableListings]
		.filter(({ asset, collection }) => isVisibleCollectionId(collection.id) && isVisibleAssetId(asset.id))
		.filter(({ asset }) => {
			if (seen.has(asset.id)) return false;
			seen.add(asset.id);
			return true;
		})
		.slice(0, limit);
}

export function homeSearchAssets(
	collections: Collection[],
	portableListings: Array<Pick<ResolvedAsset, 'asset' | 'collection'>>,
	query: string,
	limit: number,
	matches?: ReadonlyMap<Collection, AssetSummary[]>
) {
	const indexed = collections.flatMap((collection) =>
		(matches?.get(collection) ?? collectionSearchAssets(collection, query))
			.filter(
				(asset) => asset.image || asset.media || collection.kind === 'tokens' || collection.kind === 'names'
			)
			.map((asset) => ({ asset, collection }))
	);
	const seen = new Set<string>();
	return [...portableListings, ...indexed]
		.filter(({ asset, collection }) => marketplaceAssetMatchesSearch(asset, collection, query))
		.filter(({ asset }) => {
			if (seen.has(asset.id)) return false;
			seen.add(asset.id);
			return true;
		})
		.slice(0, limit);
}

export function alphabetFilterIndex(key: string, current: number, count: number): number | null {
	if (count < 1) return null;
	if (key === 'Home') return 0;
	if (key === 'End') return count - 1;
	if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % count;
	if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + count) % count;
	return null;
}

export function alphabetBrowseIndex(direction: 'previous' | 'next', visible: number[], count: number) {
	if (count < 1) return -1;
	if (!visible.length) return direction === 'previous' ? 0 : count - 1;
	return direction === 'previous'
		? Math.max(0, visible[0] - 5)
		: Math.min(count - 1, visible[visible.length - 1] + 5);
}

export function RouteState({
	children,
	title,
	backTo = '/',
	backLabel = 'All collections',
}: {
	children: React.ReactNode;
	title: string;
	backTo?: string;
	backLabel?: string;
}) {
	return (
		<section className="route-state-shell">
			<Link className="back" to={backTo}>
				<ArrowLeft className="ui-icon ui-icon--sm" aria-hidden="true" /> {backLabel}
			</Link>
			<p className="eyebrow">Arweave marketplace</p>
			<h1>{title}</h1>
			{children}
		</section>
	);
}
function assetDescription(state: AssetState | null, fallback: string) {
	if (!state) return fallback;
	if (typeof state.raw.description === 'string' && state.raw.description.trim()) {
		return state.raw.description.trim();
	}
	if (typeof state.raw.data === 'string') {
		try {
			const metadata = JSON.parse(state.raw.data);
			if (typeof metadata?.description === 'string' && metadata.description.trim()) {
				return metadata.description.trim();
			}
		} catch {
			// Non-JSON process data is content, not asset metadata.
		}
	}
	return fallback;
}
function liveOrder(state: AssetState) {
	return liveOrderOfAsset(state);
}
function unitPriceWinston(order: SwapOrder, denomination: number) {
	const scale = 10n ** BigInt(denomination);
	return (BigInt(order.asking) * scale + BigInt(order.quantity) - 1n) / BigInt(order.quantity);
}
function orderPriceLabel(order: SwapOrder, state: AssetState) {
	return `${winstonToAr(unitPriceWinston(order, state.denomination).toString())} AR${
		state.totalSupply === '1' && state.denomination === 0 ? '' : ` / ${formatTickerLabel(state.ticker, 'token')}`
	}`;
}
function homeListingShell(result: ResolvedAsset): HomeListingShell | undefined {
	const order = bestAskOfAsset(result.state);
	if (!order || !isLiveListing(result)) return undefined;
	return {
		asset: result.asset,
		collection: {
			id: result.collection.id,
			name: result.collection.name,
			description: result.collection.description,
			kind: result.collection.kind,
			assets: [result.asset],
		},
		activity: result.activity,
		price: orderPriceLabel(order, result.state),
	};
}
export function tokenBalanceLabel(value: string, state: AssetState) {
	const [whole, fraction] = formatTokenAmount(value, state.denomination).split('.');
	const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return `${fraction ? `${grouped}.${fraction}` : grouped} ${formatTickerLabel(
		state.ticker,
		state.totalSupply === '1' ? 'asset' : 'tokens'
	)}`;
}
function short(value: string) {
	return `${value.slice(0, 6)}…${value.slice(-5)}`;
}
export function winstonToAr(value: string) {
	const raw = BigInt(value);
	const whole = raw / 1_000_000_000_000n;
	const fraction = (raw % 1_000_000_000_000n).toString().padStart(12, '0').replace(/0+$/, '');
	return fraction ? `${whole.toLocaleString()}.${fraction}` : whole.toLocaleString();
}
export function formatBytes(value: number) {
	if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
	return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
export function mintErrorMessage(error: unknown) {
	const value = error instanceof Error ? error.message : String(error);
	const friendly: Record<string, string> = {
		'mint-name-invalid': 'Enter a name between 1 and 80 characters.',
		'mint-description-invalid': 'Keep the description under 600 characters.',
		'mint-file-required': 'Choose an image, MP3, or WAV file to continue.',
		'mint-file-type-unsupported': 'Use a PNG, JPG, WebP, GIF, MP3, or WAV file.',
		'mint-file-size-invalid': 'Use an image up to 10 MB, or an MP3/WAV file up to 100 MB.',
		'mint-artwork-type-unsupported': 'Use a PNG, JPG, WebP, or GIF image for album artwork.',
		'mint-artwork-size-invalid': 'Choose album artwork no larger than 10 MB.',
		'mint-artwork-audio-only': 'Album artwork can only be attached to an MP3 or WAV asset.',
		'mint-logo-type-unsupported': 'Use a PNG, JPG, WebP, or GIF image for the token logo.',
		'mint-logo-size-invalid': 'Choose a token logo no larger than 10 MB.',
		'mint-ticker-invalid': 'Enter a token ticker between 1 and 32 characters.',
		'mint-supply-invalid': 'Enter a positive whole-number token supply.',
		'mint-supply-too-large': 'Token supply exceeds the maximum allowed.',
		'mint-denomination-invalid': 'Enter decimal places from 0 to 255.',
		'mint-insufficient-balance': 'This wallet does not have enough AR for the required Arweave transaction(s).',
		'mint-high-cost-confirmation-required': 'Review and approve the unusually high network cost before minting.',
		'wallet-sign-unavailable': 'Connect an Arweave wallet that can sign transactions.',
		'wallet-account-changed': 'The connected wallet changed. Reconnect the original wallet and try again.',
		'mint-draft-wallet-mismatch': 'Reconnect the wallet that uploaded this media to finish minting it.',
		'mint-media-invalid': 'The earlier media upload is empty, too large, or unavailable in its original form.',
		'mint-udl-access-fee-invalid': 'Enter a UDL access fee greater than zero.',
		'mint-udl-fee-invalid': 'Enter a UDL license fee greater than zero.',
		'mint-udl-share-invalid': 'Enter a UDL revenue share between 0 and 100 percent.',
		'mint-udl-expiry-invalid': 'Enter a whole number of years for the UDL license term.',
	};
	if (value.startsWith('mint-media-unavailable-')) {
		return 'The earlier media upload is not available through this gateway yet. Try finishing the mint later.';
	}
	return friendly[value] ?? value.replaceAll('-', ' ');
}
function arToWinston(value: string) {
	if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value) || Number(value) <= 0)
		throw new Error('Enter a positive AR amount.');
	const [whole, decimals = ''] = value.split('.');
	return (BigInt(whole) * 1_000_000_000_000n + BigInt(decimals.padEnd(12, '0'))).toString();
}

function hasStoredSignedTransaction(storage: Pick<Storage, 'key' | 'length'>) {
	for (let index = 0; index < storage.length; index += 1) {
		if (storage.key(index)?.startsWith('bazar-signed-transaction:')) return true;
	}
	return false;
}

function prefetchAssetPage(processId: string, fungible = false) {
	if (!isVisibleAssetId(processId)) return;
	if (fungible) void import('../routes/FungibleAssetRoute');
	void prefetchAssetState(processId).then((result) => {
		if (!fungible && result && (result.state.totalSupply !== '1' || result.state.denomination > 0)) {
			void import('../routes/FungibleAssetRoute');
		}
	});
}

const ARWEAVE_ADDRESS = /^[A-Za-z0-9_-]{43}$/;

export function atomicOperationFormError(kind: Operation['kind'], value: string, owner = '') {
	if (kind === 'sell') {
		if (!value.trim()) return 'Enter the AR price for this asset.';
		if (/^0(?:\.0*)?$/.test(value)) return 'Enter a price of at least 0.000000000001 AR.';
		try {
			if (BigInt(arToWinston(value)) < 1n) return 'Enter a price of at least 0.000000000001 AR.';
		} catch {
			return 'Enter a valid AR amount with no more than 12 decimal places.';
		}
	}
	if (kind === 'transfer') {
		const recipient = value.trim();
		if (!recipient) return 'Enter the recipient’s 43-character Arweave address.';
		if (!ARWEAVE_ADDRESS.test(recipient)) return 'Enter a valid 43-character Arweave address.';
		if (owner && recipient === owner)
			return 'Choose a different wallet. An asset cannot be transferred to its current owner.';
	}
	return '';
}
export function atomicOperationValue(kind: Operation['kind'], value: string) {
	return kind === 'transfer' ? value.trim() : value;
}
export function atomicOrderCanBeBought(order: SwapOrder | null): order is SwapOrder {
	return order?.status === 'open';
}

export function externalReservationTransaction(
	order: SwapOrder | null,
	buyer: string | null | undefined,
	activity: CollectionActivityEvent[]
): CollectionActivityEvent | null {
	if (
		!buyer ||
		order?.status !== 'reserved' ||
		order.buyer !== buyer ||
		!Number.isSafeInteger(order.reservedUntil) ||
		order.reservedUntil! < order.deadline
	)
		return null;
	const reservationHeight = order.reservedUntil! - order.deadline;
	return (
		activity.find(
			(event) =>
				event.action === 'register-interest' &&
				event.actor === buyer &&
				event.orderId === order.orderId &&
				event.height === reservationHeight &&
				ARWEAVE_ADDRESS.test(event.id)
		) ?? null
	);
}

export function atomicPurchaseRecoveryStatus(
	state: AssetState,
	buyer: string,
	expectedOrder: SwapOrder,
	snapshot?: PurchaseSnapshot
): 'resumable' | 'blocked' {
	// Once an exact seller payment exists, only its immutable scheduler slot can
	// prove settlement. Current ownership may have changed again legitimately.
	if (snapshot?.payment?.id) return 'resumable';
	const currentOrder = state.orders[expectedOrder.orderId];
	const orderUnchanged = Boolean(
		currentOrder &&
			currentOrder.creator === expectedOrder.creator &&
			currentOrder.recipient === expectedOrder.recipient &&
			currentOrder.asking === expectedOrder.asking &&
			currentOrder.deposit === expectedOrder.deposit &&
			currentOrder.minimumFee === expectedOrder.minimumFee &&
			currentOrder.deadline === expectedOrder.deadline &&
			currentOrder.createdAt === expectedOrder.createdAt &&
			currentOrder.quantity === expectedOrder.quantity
	);
	if (
		orderUnchanged &&
		(currentOrder.status === 'open' || (currentOrder.status === 'reserved' && currentOrder.buyer === buyer))
	) {
		return 'resumable';
	}
	return 'blocked';
}

export function atomicOperationStateError(
	kind: Operation['kind'],
	state: AssetState,
	owner: string,
	expectedOrder: SwapOrder | null
) {
	const currentOrder = expectedOrder ? state.orders[expectedOrder.orderId] : null;
	const orderUnchanged = Boolean(
		currentOrder &&
			currentOrder.creator === expectedOrder?.creator &&
			currentOrder.asking === expectedOrder.asking &&
			currentOrder.quantity === expectedOrder.quantity
	);
	if (kind === 'buy') {
		return !orderUnchanged || !atomicOrderCanBeBought(currentOrder) || currentOrder.creator === owner
			? 'market-state-changed'
			: '';
	}
	if (kind === 'cancel') {
		return !orderUnchanged || currentOrder?.status !== 'open' || currentOrder.creator !== owner
			? 'market-state-changed'
			: '';
	}
	return liquidBalanceOf(state, owner) !== '1' || liveOrderOfAsset(state) ? 'market-state-changed' : '';
}

export function pendingListingMessage(offer: PendingAssetOffer, signer: string): string {
	const transaction = short(offer.id);
	if (offer.actor === signer) {
		return `You already submitted listing transaction ${transaction}; waiting for live asset state. No new wallet approval was requested.`;
	}
	return `Another wallet ${short(
		offer.actor
	)} submitted pending listing transaction ${transaction}, but it has not been accepted by live asset state. No new wallet approval was requested.`;
}

function atomicOperationActionLabel(operation: Operation, value: string) {
	if (operation.kind === 'buy') return `Buy for ${winstonToAr(operation.order.asking)} AR`;
	if (operation.kind === 'sell') return value ? `List for ${value} AR` : 'Enter a listing price';
	if (operation.kind === 'cancel') return 'Cancel listing and return asset';
	return ARWEAVE_ADDRESS.test(value.trim()) ? `Send to ${short(value.trim())}` : 'Enter a recipient';
}

function atomicOperationResult(kind: Operation['kind'], assetName = '', value = '', owner = '') {
	if (kind === 'buy') return { title: 'Purchase complete', detail: `${assetName} is now owned by ${short(owner)}.` };
	if (kind === 'sell') return { title: 'Listing is live', detail: `${assetName} is offered for ${value} AR.` };
	if (kind === 'cancel')
		return {
			title: 'Listing cancelled',
			detail: 'The asset is back in your liquid balance and is no longer for sale.',
		};
	return { title: 'Transfer complete', detail: `${assetName} now belongs to ${short(value)}.` };
}
function operationLabel(kind: Operation['kind']) {
	return { sell: 'List for sale', buy: 'Buy asset', cancel: 'Cancel listing', transfer: 'Transfer asset' }[kind];
}
function purchaseSnapshot(state: PurchaseState): PurchaseSnapshot {
	return {
		...(state.registration
			? { registration: { id: state.registration.id, dispatched: state.registration.dispatched } }
			: {}),
		...(state.payment ? { payment: { id: state.payment.id, dispatched: state.payment.dispatched } } : {}),
		...(state.dismissed ? { dismissed: true } : {}),
	};
}
function currentPurchaseGatewayContext() {
	return { arweave: arweaveGatewayFromLocation(), compute: gatewayFromLocation() };
}

function purchaseGatewayForRecovery(key: string) {
	try {
		const gateway = JSON.parse(localStorage.getItem(key) ?? 'null')?.gateway;
		if (typeof gateway?.arweave === 'string' && typeof gateway?.compute === 'string') return gateway;
	} catch {
		// The recovery owner will discard malformed records before resuming them.
	}
	return currentPurchaseGatewayContext();
}

export function purchaseStatusMessage(state: PurchaseState | null) {
	return purchaseLifecycleStatus(state);
}
export function atomicPurchaseFailureStage(state: PurchaseState | null) {
	if (state?.payment?.id) {
		return state.payment.dispatched ? 'Payment confirmation or ownership' : 'Payment release';
	}
	if (state?.registration?.id) {
		return state.registration.dispatched ? 'Reservation confirmation or acceptance' : 'Reservation dispatch';
	}
	return 'Before reservation';
}
export function atomicPurchaseFailureCode(state: PurchaseState | null) {
	if (!state?.error?.code) return null;
	return state.error.code === 'unexpected' ? state.error.message || state.error.code : state.error.code;
}
export function atomicPurchaseHasTerminalReservationFailure(state: PurchaseState | null) {
	return [
		'registration-dispatch-rejected',
		'asset-order-reservation-rejected',
		'asset-order-reservation-expired',
	].includes(atomicPurchaseFailureCode(state) ?? '');
}
export function assetStateErrorMessage(error: unknown) {
	const value = error instanceof Error ? error.message : String(error);
	if (/^HTTP 429(?:\b|$)/i.test(value)) {
		return marketplaceRequestFailureMessage('compute', 'rate-limited');
	}
	if (/ao[- ]wrangler.*response quorum not met/i.test(value) || /^HTTP 5\d\d(?:\b|$)/i.test(value)) {
		return 'Live state could not be read through the configured compute gateways. Retry shortly, or choose Compute gateway in the header.';
	}
	if (['Failed to fetch', 'fetch failed', 'compute-provider-failed', 'compute-provider-timeout'].includes(value)) {
		let host = 'the selected compute gateway';
		try {
			host = new URL(servingNodeOrigin(window.location)).host;
		} catch {
			// Keep the generic label if the selected origin cannot be parsed.
		}
		return `${host} could not be reached. Retry live state or choose Compute gateway in the header.`;
	}
	return errorMessage(error);
}
