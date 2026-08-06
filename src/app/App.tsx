import React from 'react';
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
  Info,
  InfinityIcon,
  LayoutGrid,
  Layers3,
  Library,
  LoaderCircle,
  RefreshCw,
  Search,
  Send,
  Server,
  ShoppingCart,
  Tag,
  Upload,
  X,
} from 'lucide-react';
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  SwapPurchase,
  type Consensus,
  type ObserverView,
  type PreparedTransaction,
  type PurchaseSnapshot,
  type PurchaseState,
} from 'weave-wrangler';

import {
  collectionAsset,
  loadCollections,
  loadMoreFungibleTokens,
  loadMoreCarrierNames,
  mergeCollectionSnapshots,
  type AssetSummary,
  type Collection,
} from 'api/collections';
import {
  bazarAtomicAssetFromState,
  discoverCollectionActivity,
  discoverCollectionActivityBatched,
  discoverMarketActivity,
  discoverMarketActivityBatched,
  discoverWalletAssetCandidates,
  createWalletCandidateScan,
  isLiveListing,
  partitionAssetCandidateSupport,
  resolveAssetCandidates,
  verifyAssetCandidateSupport,
  walletAssetGroups,
  type AssetCandidate,
  type CollectionActivityEvent,
  type ResolvedAsset,
  type WalletCandidateScan,
} from 'api/asset-discovery';
import {
  bestAskOfAsset,
  licenseProperties,
  listedBalanceOf,
  liquidBalanceOf,
  liveOrderOfAsset,
  liveOrdersOfAsset,
  openOrdersOfAsset,
  ownerOfAsset,
  readAssetState,
  normalizeServingNodeOrigin,
  servingNodeOrigin,
  waitForAssetState,
  type AssetState,
  type SwapOrder,
} from 'api/asset-marketplace';
import {
  AssetMintClient,
  CollectionMintClient,
  CREATED_COLLECTION_ID,
  UDL_LICENSE_ID,
  createdCollection,
  discardMintDraft,
  getMintDraft,
  isHighMintCost,
  loadMintedAssets,
  loadMintedCollections,
  type CollectionMintEstimate,
  type CollectionMintPhase,
  type MintDraft,
  type MintEstimate,
  type MintPhase,
  type MintedAsset,
  type UdlTerms,
} from 'api/asset-mint';
import { transactionExplorerUrl } from 'api/arweave-explorer';
import { formatTokenAmount } from 'api/order-matching';
import { ArweaveObserverNetwork } from 'api/arweave-observers';
import { assetObserverNetworkOptions } from 'api/asset-observers';
import {
  AssetTransactionClient,
  DEFAULT_REGISTRATION_FEE,
  dispatchAndConfirm,
  type PurchaseCostEstimate,
} from 'api/asset-transactions';
import { ArweaveTransactionSync, type ArweaveSyncStep } from 'components/ArweaveTransactionSync';
import { quorumConfirmationDepth } from 'components/ArweaveTransactionSync/confirmationDepth';
import { ArtworkImage } from 'components/ArtworkImage';
import { AssetDetailTabs, type AssetDetailTab } from 'components/AssetDetailTabs';
import { ConnectWalletButton } from 'components/ConnectWalletButton';
import { MarketActivityList } from 'components/MarketActivityList';
import { OperationOutcome, OperationOutcomeAnnouncement } from 'components/OperationOutcomeAnnouncement';
import {
  isTransactionActivityVisible,
  prepareTransactionDialogHide,
  TRANSACTION_DIALOG_HIDE_DURATION_MS,
  TransactionDialogControl,
  transactionDialogDismissAction,
} from 'components/TransactionDialogControl';
import { StateVerification } from 'components/StateVerification';
import { TokenArtwork } from 'components/TokenArtwork';
import { NameArtwork } from 'components/NameArtwork';
import {
  UnavailableOperationRecoveryNotice,
  type UnavailableOperationRecovery,
} from 'components/UnavailableOperationRecovery';
import { WalletAddress, WalletIdentity } from 'components/WalletAddress';
import { WalletMenu } from 'components/WalletMenu';
import { gatewayFromLocation } from 'helpers/config';
import { optionalMotionBehavior } from 'helpers/motion';
import { useWallet } from 'providers/WalletProvider';
import { FungibleAssetView } from './FungibleAssetView';
import {
  atomicOperationActivityId,
  deriveFungibleOperationActivities,
  deriveOperationActivities,
  FUNGIBLE_OPERATION_ACTIVITY_CHANGE_EVENT,
  FUNGIBLE_OPERATION_ACTIVITY_STORAGE_KEY,
  fungibleActivityHasRecovery,
  reduceFungibleRuntimeActivities,
  saveFungibleOperationActivities,
  saveOperationActivities,
  type FungibleOperationActivityChange,
  type FungibleOperationActivitySummary,
} from './operation-activity';
import {
  acquireWalletOperationClaim,
  atomicPurchaseStorageKey,
  clearStaleWalletOperationClaim,
  discardNewlyPreparedTransactionIfAborted,
  hasRecoverablePurchase,
  isWalletOperationRecoveryKey,
  latestPurchaseSnapshot,
  loadWalletRecord,
  operationClaimStorageKey,
  operationStorageKey,
  promoteWalletOperationClaim,
  purchaseRecoveryApprovalCount,
  repairRejectedPurchase,
  removeWalletRecord,
  removeWalletRecoveryAndSignatures,
  releaseWalletOperationClaim,
  removeWalletRecordIf,
  storeWalletRecordIf,
  storeWalletRecordOrThrow,
  shouldAutomaticallyResumePurchase,
  walletOperationStorageChange,
  WALLET_OPERATION_RECOVERY_CHANGE_EVENT,
  type WalletOperationClaim,
} from './operation-session';
import { useDialogFocus } from './useDialogFocus';
import {
  marketplaceCodedError,
  marketplaceErrorMessage as errorMessage,
  marketplaceFailureKind,
  marketplaceOperationFailure,
  marketplaceRequestFailureMessage,
  type MarketplaceOperationFailure,
  type MarketplaceFailureKind,
  type MarketplaceRequestSource,
} from './marketplace-error';

import arweaveNamesCube from '../assets/arweave-names-cube.gif';
import arweaveNamesCubeStill from '../assets/arweave-names-cube.png';
import bazarLogo from '../assets/logo.svg';

import './styles.css';

type MarketContextValue = {
  collections: Collection[];
  loading: boolean;
  error: string | null;
  notice: string | null;
  loadMore(collectionId: string, signal?: AbortSignal): Promise<number>;
  addCreatedAsset(asset: MintedAsset): void;
  addCollection(collection: Collection): void;
  retry(): void;
};

const MARKET_SHELL_CACHE_KEY = 'bazar-market-shell:v1';
const ASSET_SHELL_CACHE_PREFIX = 'bazar-asset-shell:v1:';

function isCachedAsset(value: unknown): value is AssetSummary {
  if (!value || typeof value !== 'object') return false;
  const asset = value as Partial<AssetSummary>;
  return typeof asset.id === 'string' && typeof asset.name === 'string';
}

function isCachedCollection(value: unknown): value is Collection {
  if (!value || typeof value !== 'object') return false;
  const collection = value as Partial<Collection>;
  return (
    typeof collection.id === 'string' &&
    typeof collection.name === 'string' &&
    typeof collection.description === 'string' &&
    ['names', 'images', 'tokens'].includes(collection.kind ?? '') &&
    Array.isArray(collection.assets) &&
    collection.assets.every(isCachedAsset)
  );
}

export function loadMarketShellSnapshot(storage: Pick<Storage, 'getItem'>): Collection[] {
  try {
    const value = JSON.parse(storage.getItem(MARKET_SHELL_CACHE_KEY) ?? 'null');
    return Array.isArray(value) && value.every(isCachedCollection) ? value : [];
  } catch {
    return [];
  }
}

export function storeMarketShellSnapshot(storage: Pick<Storage, 'setItem'>, collections: Collection[]) {
  try {
    storage.setItem(MARKET_SHELL_CACHE_KEY, JSON.stringify(collections));
  } catch {
    // A denied or full session store should not block live collection loading.
  }
}

export function loadAssetShellSnapshot(storage: Pick<Storage, 'getItem'>, assetId: string): AssetSummary | undefined {
  try {
    const value = JSON.parse(storage.getItem(`${ASSET_SHELL_CACHE_PREFIX}${assetId}`) ?? 'null');
    return isCachedAsset(value) && value.id === assetId ? value : undefined;
  } catch {
    return undefined;
  }
}

export function storeAssetShellSnapshot(storage: Pick<Storage, 'setItem'>, asset: AssetSummary) {
  try {
    storage.setItem(`${ASSET_SHELL_CACHE_PREFIX}${asset.id}`, JSON.stringify(asset));
  } catch {
    // A denied or full session store should not block live asset verification.
  }
}

function initialMarketCollections() {
  const cached = loadMarketShellSnapshot(window.sessionStorage);
  const localCollections = loadMintedCollections();
  const mintedAssets = loadMintedAssets();
  const known = new Set(cached.map((collection) => collection.id));
  const localAdditions = localCollections.filter((collection) => !known.has(collection.id));
  for (const collection of localAdditions) known.add(collection.id);
  return [
    ...cached,
    ...localAdditions,
    ...(mintedAssets.length && !known.has(CREATED_COLLECTION_ID) ? [createdCollection(mintedAssets)] : []),
  ];
}

const MarketContext = React.createContext<MarketContextValue>({
  collections: [],
  loading: true,
  error: null,
  notice: null,
  loadMore: async () => 0,
  addCreatedAsset: () => undefined,
  addCollection: () => undefined,
  retry: () => undefined,
});

export function App() {
  const [marketRetry, setMarketRetry] = React.useState(0);
  const [market, setMarket] = React.useState<MarketContextValue>(() => ({
    collections: initialMarketCollections(),
    loading: true,
    error: null,
    notice: null,
    loadMore: async () => 0,
    addCreatedAsset: () => undefined,
    addCollection: () => undefined,
    retry: () => undefined,
  }));
  React.useEffect(() => {
    if (market.collections.length) storeMarketShellSnapshot(window.sessionStorage, market.collections);
  }, [market.collections]);
  React.useEffect(() => {
    const controller = new AbortController();
    setMarket((current) => ({ ...current, loading: true, error: null }));
    loadCollections(controller.signal, (collections) => {
      if (!controller.signal.aborted) {
        setMarket((current) => ({
          ...current,
          collections: mergeCollectionSnapshots(current.collections, collections),
        }));
      }
    }).then(
      ({ collections, unavailable }) => {
        if (controller.signal.aborted) return;
        const mintedAssets = loadMintedAssets();
        const localCollections = loadMintedCollections();
        setMarket((current) => {
          const resolved = mergeCollectionSnapshots(current.collections, collections, true);
          const known = new Set(resolved.map((collection) => collection.id));
          return {
            ...current,
            collections: [
              ...resolved,
              ...localCollections.filter((collection) => !known.has(collection.id)),
              ...(mintedAssets.length && !known.has(CREATED_COLLECTION_ID) ? [createdCollection(mintedAssets)] : []),
            ],
            loading: false,
            error: null,
            notice: unavailable.length
              ? `The latest Arweave references for ${unavailable.join(', ')} could not be checked. Showing their bundled immutable indexes; ownership, listings, and prices are still read from live state.`
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
                  notice: `Collection indexes could not be refreshed: ${errorMessage(error)}. Previously loaded collections remain available.`,
                }
              : { ...current, loading: false, error: errorMessage(error), notice: null },
          );
        }
      },
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
        collections: current.collections.map((item) => {
          if (item.id !== collectionId) return item;
          const seen = new Set(item.assets.map((asset) => asset.id));
          const additions = updated.assets.filter((asset) => !seen.has(asset.id));
          return {
            ...item,
            ...updated,
            assets: [...item.assets, ...additions],
          };
        }),
      }));
      return added;
    },
    [market.collections],
  );
  const addCreatedAsset = React.useCallback((asset: MintedAsset) => {
    setMarket((current) => {
      const existing = current.collections.find((item) => item.id === CREATED_COLLECTION_ID);
      const assets = [asset, ...(existing?.assets ?? []).filter((item) => item.id !== asset.id)];
      const created = createdCollection(assets);
      return {
        ...current,
        collections: existing
          ? current.collections.map((item) => (item.id === CREATED_COLLECTION_ID ? created : item))
          : [...current.collections, created],
      };
    });
  }, []);
  const addCollection = React.useCallback((collection: Collection) => {
    setMarket((current) => ({
      ...current,
      collections: [collection, ...current.collections.filter((item) => item.id !== collection.id)],
    }));
  }, []);
  const retry = React.useCallback(() => setMarketRetry((current) => current + 1), []);
  const value = React.useMemo(
    () => ({ ...market, loadMore, addCreatedAsset, addCollection, retry }),
    [addCollection, addCreatedAsset, loadMore, market, retry],
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
          <main aria-label="Marketplace content" id="main-content" tabIndex={-1}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/create" element={<CreateView />} />
              <Route path="/my-assets" element={<MyAssetsView />} />
              <Route path="/collection/:collectionId" element={<CollectionRoute />} />
              <Route path="/collection/:collectionId/activity" element={<CollectionActivityView />} />
              <Route path="/asset/:collectionId/:assetId" element={<AssetView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
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

type OperationActivityContextValue = {
  activities: OperationActivity[];
  fungibleActivities: FungibleOperationActivitySummary[];
  activeId: string | null;
  start(input: Pick<OperationActivity, 'asset' | 'collectionId' | 'owner' | 'operation' | 'restoreFallback'>): void;
  show(id: string): void;
  showFungible(id: string): void;
  hide(): void;
  remove(id: string): void;
};

const OperationActivityContext = React.createContext<OperationActivityContextValue | null>(null);

function OperationActivityProvider({ children }: React.PropsWithChildren) {
  const navigate = useNavigate();
  const wallet = useWallet();
  const market = React.useContext(MarketContext);
  const [activities, setActivities] = React.useState<OperationActivity[]>([]);
  const [fungibleActivities, setFungibleActivities] = React.useState<FungibleOperationActivitySummary[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [hydratedOwners, setHydratedOwners] = React.useState<string[]>([]);
  const fungibleRuntimeActivitiesRef = React.useRef<FungibleOperationActivitySummary[]>([]);
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
        runtime.filter((activity) => activity.owner === owner).map((activity) => activity.asset.id),
      );
      const otherOwners = current.filter((activity) => activity.origin === 'restored' && activity.owner !== owner);
      return [...runtime, ...otherOwners, ...restored.filter((activity) => !runtimeAssets.has(activity.asset.id))].sort(
        (left, right) => right.createdAt - left.createdAt,
      );
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
        [owner],
      );
      setFungibleActivities(derived);
    },
    [market.collections, wallet.address],
  );
  React.useEffect(() => refreshFungibleActivities(), [refreshFungibleActivities]);
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
  const start = React.useCallback(
    (input: Pick<OperationActivity, 'asset' | 'collectionId' | 'owner' | 'operation' | 'restoreFallback'>) => {
      const existing = activitiesRef.current.find(
        (activity) =>
          activity.asset.id === input.asset.id && activity.owner === input.owner && activity.phase !== 'done',
      );
      if (existing) {
        setActiveId(existing.id);
        return;
      }
      const id = atomicOperationActivityId(input.asset.id, input.owner);
      const phase: OperationActivityPhase =
        input.operation.kind === 'buy' && input.operation.resume
          ? purchaseRecoveryApprovalCount(input.operation.resume)
            ? 'approval'
            : 'working'
          : input.operation.kind !== 'buy' && input.operation.resumeId
            ? 'working'
            : 'form';
      setActivities((current) => [
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
      ]);
      setActiveId(id);
    },
    [],
  );
  const update = React.useCallback(
    (
      id: string,
      patch: Pick<OperationActivity, 'phase' | 'status' | 'confirmations' | 'confirmationTarget'>,
      assetId: string,
    ) => {
      setActivities((current) =>
        current.map((activity) => (activity.id === id ? { ...activity, ...patch } : activity)),
      );
      if (patch.phase === 'done') {
        queueMicrotask(() =>
          window.dispatchEvent(new CustomEvent('bazar:asset-operation-finished', { detail: assetId })),
        );
      }
    },
    [],
  );
  const updateOperation = React.useCallback((id: string, operation: Operation) => {
    setActivities((current) => current.map((activity) => (activity.id === id ? { ...activity, operation } : activity)));
  }, []);
  const remove = React.useCallback((id: string) => {
    setActivities((current) => current.filter((activity) => activity.id !== id));
    setActiveId((current) => (current === id ? null : current));
  }, []);
  React.useEffect(() => {
    if (!activities.some((activity) => activity.phase === 'done' && activity.id !== activeId)) return;
    setActivities((current) => current.filter((activity) => activity.phase !== 'done' || activity.id === activeId));
  }, [activeId, activities]);
  const value = React.useMemo<OperationActivityContextValue>(
    () => ({
      activities,
      fungibleActivities,
      activeId,
      start,
      show: setActiveId,
      showFungible: (id) => {
        const activity = fungibleActivities.find((candidate) => candidate.id === id);
        if (!activity) return;
        navigate(`/asset/${activity.collectionId}/${activity.asset.id}`, {
          state: { fungibleOperationActivityId: activity.id },
        });
      },
      hide: () => setActiveId(null),
      remove,
    }),
    [activeId, activities, fungibleActivities, navigate, remove, start],
  );
  return (
    <OperationActivityContext.Provider value={value}>
      {children}
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
            document.querySelector<HTMLElement>('.operation-activity-trigger[data-activity-owner="global"]') ??
            document.getElementById('main-content')
          }
          onUpdate={update}
          onOperation={(operation) => updateOperation(activity.id, operation)}
          onHide={() => setActiveId(null)}
          onClose={(resumeLater, refresh = true) => {
            if (refresh) {
              window.dispatchEvent(new CustomEvent('bazar:asset-operation-finished', { detail: activity.asset.id }));
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
    </OperationActivityContext.Provider>
  );
}

function useOperationActivity() {
  const value = React.useContext(OperationActivityContext);
  if (!value) throw new Error('operation-activity-provider-missing');
  return value;
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
  const [scope, setScope] = React.useState<'all' | 'collections' | 'assets' | 'names'>('all');
  const [recentQueries, setRecentQueries] = React.useState<string[]>([]);
  const [searchFeedback, setSearchFeedback] = React.useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const collectionResults = market.collections
    .filter((collection) => {
      if (scope === 'assets') return false;
      if (scope === 'names' && collection.kind !== 'names') return false;
      return collectionMatchesSearch(collection, normalizedQuery);
    })
    .slice(0, 6);
  const searchableCollections = market.collections.filter(
    (collection) => scope !== 'collections' && (scope !== 'names' || collection.kind === 'names'),
  );
  const assetResults = normalizedQuery
    ? searchableCollections
        .flatMap((collection) =>
          collectionSearchAssets(collection, normalizedQuery).map((asset) => ({ asset, collection })),
        )
        .filter(({ asset, collection }) => marketplaceAssetMatchesSearch(asset, collection, normalizedQuery))
        .sort((left, right) => searchResultScore(right, normalizedQuery) - searchResultScore(left, normalizedQuery))
        .slice(0, 8)
    : interleaveCollectionAssets(
        searchableCollections,
        8,
        (asset, collection) => Boolean(asset.image) || collection.kind === 'names' || collection.kind === 'tokens',
      );
  const directTokenCollection =
    scope !== 'collections' && scope !== 'names' ? directTokenSearchCollection(market.collections, query) : undefined;
  const directTokenProcess = directTokenCollection && !assetResults.some(({ asset }) => asset.id === query.trim());
  const partialTokenCollection =
    normalizedQuery && scope !== 'collections' && scope !== 'names'
      ? market.collections.find((collection) => collection.kind === 'tokens' && collection.hasMore)
      : undefined;
  const searchResultAnnouncement = market.loading
    ? 'Loading collection indexes from Arweave.'
    : market.error
      ? 'Marketplace search is unavailable.'
      : normalizedQuery && !collectionResults.length && !assetResults.length && !directTokenProcess
        ? partialTokenCollection
          ? `No loaded collections or assets match ${query.trim()}; more token records remain available.`
          : `No collections or assets match ${query.trim()}.`
        : `Showing ${collectionResults.length.toLocaleString()} ${collectionResults.length === 1 ? 'collection' : 'collections'} and ${(assetResults.length + (directTokenProcess ? 1 : 0)).toLocaleString()} ${assetResults.length + (directTokenProcess ? 1 : 0) === 1 ? 'asset result' : 'asset results'}${normalizedQuery ? ` for ${query.trim()}` : ''}.`;
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
    [urlQuery],
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
    [],
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
      setRecentQueries((current) => [query.trim(), ...current.filter((item) => item !== query.trim())].slice(0, 4));
    }
    navigate(
      directTokenProcess && directTokenCollection
        ? `/asset/${directTokenCollection.id}/${query.trim()}`
        : query.trim()
          ? `/?q=${encodeURIComponent(query.trim())}`
          : '/',
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
    [],
  );
  const searchDialogRef = useDialogFocus<HTMLElement>(searchOpen, closeSearch, searchRestoreTarget);
  const scopes = [
    { id: 'all' as const, label: 'All', Icon: Search },
    { id: 'collections' as const, label: 'Collections', Icon: LayoutGrid },
    { id: 'assets' as const, label: 'Assets', Icon: Images },
    { id: 'names' as const, label: 'Names', Icon: AtSign },
  ];
  return (
    <>
      <header className="site-header">
        <Link aria-label="Bazar home" className="brand" to="/">
          <span className="brand-mark">
            <BazarMark />
          </span>
          <small>2.0</small>
        </Link>
        <form className={`site-search${searchOpen ? ' expanded' : ''}`} role="search" onSubmit={submitSearch}>
          <Search className="ui-icon ui-icon--sm" aria-hidden="true" />
          <input
            ref={inputRef}
            aria-label="Search collections and assets"
            placeholder="Search collections and assets"
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
            <Link
              aria-label="Create asset"
              aria-current={location.pathname === '/create' ? 'page' : undefined}
              className={`create-link${location.pathname === '/create' ? ' active' : ''}`}
              data-tooltip="Create asset"
              to="/create"
            >
              <Upload className="ui-icon ui-icon--sm" aria-hidden="true" />
            </Link>
            <GatewayControl />
          </div>
          <div className="site-nav-wallet">
            <OperationActivityControl />
            <WalletMenu />
          </div>
        </nav>
      </header>
      {searchOpen ? (
        <div className="search-overlay" onMouseDown={(event) => event.target === event.currentTarget && closeSearch()}>
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
                <button type="button" onClick={clearSearchQuery} aria-label="Clear search">
                  Clear
                </button>
              ) : null}
              <button className="search-panel-submit" type="submit" aria-label="View search results">
                <ArrowRight className="ui-icon ui-icon--sm" aria-hidden="true" />
              </button>
              <button
                className="search-panel-close"
                type="button"
                onClick={() => closeSearch()}
                aria-label="Close search"
              >
                <X aria-hidden="true" />
              </button>
            </form>
            <aside className="search-categories" aria-label="Search categories">
              {scopes.map((item) => {
                const ScopeIcon = item.Icon;
                return (
                  <button
                    aria-pressed={scope === item.id}
                    className={scope === item.id ? 'active' : undefined}
                    key={item.id}
                    onClick={() => setScope(item.id)}
                  >
                    <ScopeIcon className="ui-icon" aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </aside>
            <div className="search-panel-main">
              <div className="search-panel-content">
                <CollectionResultStatus message={searchFeedback || announcedSearchResult} />
                {market.loading && !market.collections.length ? (
                  <Loading label="Loading collection indexes from Arweave…" />
                ) : null}
                {partialTokenCollection ? (
                  <div className="collection-source-notice">
                    <span role="status">
                      Token matches cover {partialTokenCollection.assets.length.toLocaleString()} of{' '}
                      {(partialTokenCollection.total ?? partialTokenCollection.assets.length).toLocaleString()}{' '}
                      discovered records currently loaded.
                    </span>
                    <Link
                      className="with-icon"
                      to={`/collection/${partialTokenCollection.id}?q=${encodeURIComponent(query.trim())}`}
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
                      <button onClick={clearRecentSearches}>Clear</button>
                    </div>
                    <div className="recent-searches">
                      {recentQueries.map((item) => (
                        <button key={item} onClick={() => useRecentQuery(item)}>
                          <History className="ui-icon ui-icon--sm" aria-hidden="true" />
                          {item}
                        </button>
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
                        return (
                          <Link key={collection.id} to={`/collection/${collection.id}`} onClick={followSearchResult}>
                            <span className="search-result-image">
                              {preview ? (
                                <ArtworkImage src={preview} alt="" />
                              ) : collection.kind === 'names' ? (
                                <NamesCubePreview />
                              ) : collection.kind === 'tokens' ? (
                                <TokenArtwork ticker={collection.assets[0]?.ticker ?? 'Token'} />
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
                                  : `${(collection.total ?? collection.assets.length).toLocaleString()} ${(collection.total ?? collection.assets.length) === 1 ? 'asset' : 'assets'}`}
                              </small>
                            </span>
                            <ArrowUpRight className="ui-icon ui-icon--sm" aria-hidden="true" />
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
                {assetResults.length ? (
                  <section className="search-result-section">
                    <div className="search-result-heading">
                      <h2>{normalizedQuery ? 'Matching assets' : 'Featured assets'}</h2>
                      <span>{assetResults.length} shown</span>
                    </div>
                    <div className="search-asset-grid">
                      {assetResults.map(({ asset, collection }) => (
                        <Link
                          key={`${collection.id}-${asset.id}`}
                          to={`/asset/${collection.id}/${asset.id}`}
                          onClick={followSearchResult}
                        >
                          <span className="search-result-image">
                            {asset.image ? (
                              <ArtworkImage src={asset.image} alt="" />
                            ) : collection.kind === 'tokens' ? (
                              <TokenArtwork ticker={asset.ticker ?? 'Token'} />
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
                      <Link to={`/asset/${directTokenCollection.id}/${query.trim()}`} onClick={followSearchResult}>
                        <span className="search-result-image">
                          <TokenArtwork ticker="Token" />
                        </span>
                        <span>
                          <strong>Check token process</strong>
                          <small>{short(query.trim())} · support is determined from live state</small>
                        </span>
                        <ArrowUpRight className="ui-icon ui-icon--sm" aria-hidden="true" />
                      </Link>
                    </div>
                  </section>
                ) : null}
                {market.error ? (
                  <ErrorPanel message={market.error} onRetry={market.retry} retryLabel="Retry marketplace" />
                ) : null}
                {!market.loading &&
                !market.error &&
                !collectionResults.length &&
                !assetResults.length &&
                !directTokenProcess ? (
                  <div className="search-empty">
                    <strong>No results for “{query}”</strong>
                    <span>
                      {partialTokenCollection
                        ? 'More token records remain available from the token collection.'
                        : 'Try another asset, collection, or Arweave name.'}
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
  const { activities, fungibleActivities, show, showFungible } = useOperationActivity();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const visibleActivities = activities.filter(
    (activity) => activity.owner === wallet.address && isTransactionActivityVisible(activity.phase),
  );
  const visibleFungibleActivities = fungibleActivities.filter((activity) =>
    isTransactionActivityVisible(activity.phase),
  );
  const activityCount = visibleActivities.length + visibleFungibleActivities.length;
  const workingCount =
    visibleActivities.filter((activity) => activity.phase === 'working').length +
    visibleFungibleActivities.filter((activity) => activity.phase === 'working').length;
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
      <button
        aria-expanded={open}
        aria-label={`Transaction activity, ${activityCount} ${activityCount === 1 ? 'item' : 'items'}`}
        className={`operation-activity-trigger${workingCount ? ' working' : ''}`}
        data-activity-owner="global"
        data-tooltip="Transaction activity"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <InfinityIcon className="ui-icon" aria-hidden="true" />
        <span>{activityCount}</span>
      </button>
      {open ? (
        <section aria-label="Transaction activity" className="operation-activity-menu">
          <div className="operation-activity-heading">
            <div>
              <strong>Transaction activity</strong>
              <span>{workingCount ? `${workingCount} running in the background` : 'No transactions running'}</span>
            </div>
          </div>
          <div className="operation-activity-list">
            {visibleActivities.map((activity) => (
              <div className={`operation-activity-item ${activity.phase}`} key={activity.id}>
                <button
                  className="operation-activity-open"
                  onClick={() => {
                    show(activity.id);
                    setOpen(false);
                  }}
                  type="button"
                >
                  <span className="operation-activity-symbol" aria-hidden="true">
                    {activity.asset.image ? (
                      <img src={activity.asset.image} alt="" />
                    ) : (
                      <span>{activity.asset.name.slice(0, 1)}</span>
                    )}
                  </span>
                  <span className="operation-activity-copy">
                    <strong>{activity.asset.name}</strong>
                    <small>
                      {operationLabel(activity.operation.kind)} · {operationActivityPhaseLabel(activity.phase)}
                    </small>
                    <span>{activity.status}</span>
                  </span>
                  <span className="operation-activity-progress">
                    <span
                      aria-label={`${activity.confirmations} of ${activity.confirmationTarget} confirmations`}
                      className="operation-activity-confirmations"
                      title="Confirmations"
                    >
                      {activity.confirmations}/{activity.confirmationTarget}
                    </span>
                    {activity.phase === 'working' ? (
                      <LoaderCircle className="ui-icon ui-icon--xs operation-activity-loader" aria-hidden="true" />
                    ) : null}
                  </span>
                  <ChevronRight className="ui-icon ui-icon--sm operation-activity-chevron" aria-hidden="true" />
                </button>
              </div>
            ))}
            {visibleFungibleActivities.map((activity) => (
              <div className={`operation-activity-item ${activity.phase}`} key={activity.id}>
                <button
                  className="operation-activity-open"
                  onClick={() => {
                    showFungible(activity.id);
                    setOpen(false);
                  }}
                  type="button"
                >
                  <span className="operation-activity-symbol" aria-hidden="true">
                    {activity.asset.image ? (
                      <img src={activity.asset.image} alt="" />
                    ) : (
                      <span>{activity.asset.name.slice(0, 1)}</span>
                    )}
                  </span>
                  <span className="operation-activity-copy">
                    <strong>{activity.asset.name}</strong>
                    <small>
                      {operationLabel(activity.operationKind)} · {operationActivityPhaseLabel(activity.phase)}
                    </small>
                    <span>{activity.status}</span>
                  </span>
                  <span className="operation-activity-progress">
                    {activity.phase === 'working' ? (
                      <LoaderCircle className="ui-icon ui-icon--xs operation-activity-loader" aria-hidden="true" />
                    ) : null}
                  </span>
                  <ChevronRight className="ui-icon ui-icon--sm operation-activity-chevron" aria-hidden="true" />
                </button>
              </div>
            ))}
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

function Footer() {
  const { pathname } = useLocation();
  if (pathname === '/') return null;
  return (
    <footer className="site-footer">
      <span>Bazar 2.0</span>
      <span>Ownership, offers, and settlement live on Arweave.</span>
    </footer>
  );
}

function NamesCubePreview() {
  const [hovered, setHovered] = React.useState(false);
  return (
    <span
      className="names-cube-preview"
      aria-hidden="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={hovered ? arweaveNamesCube : arweaveNamesCubeStill} alt="" />
    </span>
  );
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
  retryKeys: ReadonlySet<string>,
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
  recipients: string[],
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
  candidateActivity: Array<Pick<AssetCandidate, 'processId' | 'height' | 'timestamp'>>,
): HomeFloorScan {
  const candidates = new Map(
    candidateActivity.map((candidate) => [candidate.processId, `${candidate.height}:${candidate.timestamp}`]),
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

export function commitHomeFloorResult(
  scan: HomeFloorScan,
  processId: string,
  value: bigint | null,
  failure?: MarketplaceFailureKind,
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
  activeRequests: number,
) {
  if (run.token !== token || activeRequests > 0 || !run.pending.has(group)) return false;
  run.pending.delete(group);
  return run.pending.size === 0;
}

function homeMarketSummaryLabel(
  summary: HomeMarketSummary | undefined,
  emptyLabel: string,
  unindexedLabel = emptyLabel,
) {
  if (!summary) return 'Checking…';
  if (summary.status === 'unavailable') return 'Unavailable';
  if (summary.status === 'unindexed') return unindexedLabel;
  return summary.value ?? emptyLabel;
}

function homeMarketSummaryListed(summary: HomeMarketSummary | undefined) {
  return summary?.status === 'resolved' && Boolean(summary.value);
}

function HomePendingMarketValue({ label = 'Checking…' }: { label?: string }) {
  return (
    <span className="home-market-value-pending">
      <LoaderCircle aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function HomeMarketGhostCard({ kind }: { kind: 'asset' | 'collection' }) {
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

export function homeMarketSummariesReady(
  loading: boolean,
  keys: string[],
  summaries: Record<string, HomeMarketSummary>,
) {
  return !loading && keys.every((key) => Boolean(summaries[key]));
}

export function homeMarketHasPending(loading: boolean, keys: string[], summaries: Record<string, HomeMarketSummary>) {
  return loading || keys.some((key) => !summaries[key]);
}

export function homeMarketShellLoading(loading: boolean, collectionCount: number) {
  return loading && collectionCount === 0;
}

export function shouldLoadHomeCollectionSummaries(
  tab: 'discover' | 'collections',
  marketLoading: boolean,
  discoverPublished: boolean,
) {
  return tab === 'collections' || (!marketLoading && discoverPublished);
}

export function homeScrollIndicatorMetrics(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  trackHeight = clientHeight,
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

function Home() {
  const market = React.useContext(MarketContext);
  const { search } = useLocation();
  const marketPaneRef = React.useRef<HTMLElement>(null);
  const [homeTab, setHomeTab] = React.useState<'discover' | 'collections'>('discover');
  const [assetType, setAssetType] = React.useState<HomeAssetType>('all');
  const [assetView, setAssetView] = React.useState<'listed' | 'price-low' | 'price-high'>('listed');
  const computeGateway = gatewayFromLocation();
  const query = new URLSearchParams(search).get('q') ?? '';
  const normalizedQuery = query.trim().toLowerCase();
  const partialTokenCollection = normalizedQuery
    ? market.collections.find((collection) => collection.kind === 'tokens' && collection.hasMore)
    : undefined;
  const collections = market.collections.filter((collection) => {
    if (!normalizedQuery) return true;
    return collectionMatchesSearch(collection, normalizedQuery);
  });
  const [verifiedHomeListings, setVerifiedHomeListings] = React.useState<Record<string, AssetSummary[]>>({});
  const [portableHomeListings, setPortableHomeListings] = React.useState<ResolvedAsset[]>([]);
  const [portableHomeListingsLoading, setPortableHomeListingsLoading] = React.useState(false);
  const [portableHomeListingsFailure, setPortableHomeListingsFailure] = React.useState<
    Extract<HomeMarketSummary, { status: 'unavailable' }> | undefined
  >();
  const [portableHomeRetry, setPortableHomeRetry] = React.useState(0);
  const assets = normalizedQuery
    ? homeSearchAssets(market.collections, portableHomeListings, normalizedQuery, 10)
    : homeDiscoveryAssets(market.collections, verifiedHomeListings, 10, portableHomeListings);
  const assetKey = assets.map(({ asset }) => asset.id).join(',');
  const portableHomeListingById = new Map(portableHomeListings.map((result) => [result.asset.id, result]));
  const portableHomeStateKey = portableHomeListings
    .map((result) => `${result.asset.id}:${String(result.state.raw['at-slot'] ?? result.state.swapHeight)}`)
    .join(',');
  const [assetPrices, setAssetPrices] = React.useState<Record<string, HomeMarketSummary>>({});
  const [publishedDiscoverQuery, setPublishedDiscoverQuery] = React.useState<string | null>(null);
  const collectionKey = collections
    .map((collection) => `${collection.id}:${collection.assets.map((asset) => asset.id).join('.')}`)
    .concat(computeGateway)
    .join(',');
  const [collectionFloors, setCollectionFloors] = React.useState<Record<string, HomeMarketSummary>>({});
  const [summaryRetry, setSummaryRetry] = React.useState(0);
  const [summaryRetrying, setSummaryRetrying] = React.useState(false);
  const summaryRetryButtonRef = React.useRef<HTMLButtonElement>(null);
  const summaryRetryOwnsFocus = React.useRef(false);
  const homeHeadingRef = React.useRef<HTMLButtonElement>(null);
  const assetSummaryControllers = React.useRef(new Map<string, AbortController>());
  const collectionSummaryControllers = React.useRef(
    new Map<
      string,
      {
        version: string;
        controller: AbortController;
      }
    >(),
  );
  const collectionSummaryVersions = React.useRef(new Map<string, string>());
  const collectionActivityScans = React.useRef(new Map<string, HomeActivityScan>());
  const collectionFloorScans = React.useRef(new Map<string, HomeFloorScan>());
  const retryAssetSummaries = React.useRef(new Set<string>());
  const retryCollectionSummaries = React.useRef(new Set<string>());
  const summaryRetryRun = React.useRef<HomeSummaryRetryRun>({ token: 0, pending: new Set() });
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
    [],
  );
  React.useEffect(() => {
    if (market.loading) return;
    if (market.error) {
      setPortableHomeListingsLoading(false);
      return;
    }
    const controller = new AbortController();
    setPortableHomeListingsLoading(true);
    setPortableHomeListingsFailure(undefined);
    setPortableHomeListings([]);
    void (async () => {
      let indexFailure: unknown;
      let computeFailure: unknown;
      const publishCandidates = async (candidates: AssetCandidate[]) => {
        const { unverified } = partitionAssetCandidateSupport(candidates, market.collections);
        if (!unverified.length) return;
        const verification = await verifyAssetCandidateSupport(unverified, market.collections, {
          signal: controller.signal,
        });
        indexFailure ??= verification.unavailable[0]?.error;
        const unverifiedIds = new Set(unverified.map((candidate) => candidate.processId));
        await resolveAssetCandidates(
          verification.supported.filter((candidate) => unverifiedIds.has(candidate.processId)),
          market.collections,
          {
            signal: controller.signal,
            concurrency: 2,
            read: (processId, signal) => readAssetState(processId, { signal, maxAge: 0, maxAttempts: 1 }),
            onSettled: (result, candidate, cause) => {
              if (cause && computeFailure === undefined) computeFailure = cause;
              setPortableHomeListings((current) =>
                mergeResolvedListingBatch(current, [{ processId: candidate.processId, result }]),
              );
            },
          },
        );
        controller.signal.throwIfAborted();
      };
      try {
        await discoverMarketActivity({
          listingsOnly: true,
          signal: controller.signal,
          onPage: publishCandidates,
        });
        if (controller.signal.aborted) return;
        const failure = indexFailure ?? computeFailure;
        setPortableHomeListingsFailure(
          failure
            ? {
                status: 'unavailable',
                source: indexFailure ? 'index' : 'compute',
                kind: marketplaceFailureKind(failure),
              }
            : undefined,
        );
      } catch (cause) {
        if (!controller.signal.aborted) {
          setPortableHomeListingsFailure({
            status: 'unavailable',
            source: 'index',
            kind: marketplaceFailureKind(cause),
          });
        }
      } finally {
        if (!controller.signal.aborted) setPortableHomeListingsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [computeGateway, market.error, market.loading, portableHomeRetry]);
  React.useEffect(() => {
    const visibleAssetIds = new Set(assets.map(({ asset }) => asset.id));
    for (const [assetId, controller] of assetSummaryControllers.current) {
      if (visibleAssetIds.has(assetId)) continue;
      controller.abort();
      assetSummaryControllers.current.delete(assetId);
    }
    setAssetPrices((current) =>
      Object.fromEntries(Object.entries(current).filter(([assetId]) => visibleAssetIds.has(assetId))),
    );
    const requestedAssetIds = new Set(
      homeSummaryRequestKeys(
        assets.map(({ asset }) => asset.id),
        assetPrices,
        assetSummaryControllers.current.keys(),
        retryAssetSummaries.current,
      ),
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
    const requests = requestedAssets.map(({ asset }) =>
      (async () => {
        const previous = assetSummaryControllers.current.get(asset.id);
        if (previous) previous.abort();
        const controller = new AbortController();
        assetSummaryControllers.current.set(asset.id, controller);
        try {
          const portable = portableHomeListingById.get(asset.id);
          const state = portable
            ? portable.state
            : (
                await readAssetState(asset.id, {
                  signal: controller.signal,
                  maxAge: 0,
                  maxAttempts: 1,
                })
              ).state;
          const order = bestAskOfAsset(state);
          if (!controller.signal.aborted) {
            setAssetPrices((current) => ({
              ...current,
              [asset.id]: { status: 'resolved', value: order ? orderPriceLabel(order, state) : null },
            }));
          }
        } catch (cause) {
          if (!controller.signal.aborted) {
            setAssetPrices((current) => ({
              ...current,
              [asset.id]: { status: 'unavailable', source: 'compute', kind: marketplaceFailureKind(cause) },
            }));
          }
        } finally {
          if (assetSummaryControllers.current.get(asset.id) === controller) {
            assetSummaryControllers.current.delete(asset.id);
          }
        }
      })(),
    );
    void Promise.all(requests).then(finishRetry);
  }, [assetKey, finishSummaryRetry, portableHomeStateKey, summaryRetry]);
  const marketShellLoading = homeMarketShellLoading(market.loading, market.collections.length);
  const visibleAssetResultsReady = homeMarketSummariesReady(
    marketShellLoading,
    assets.map(({ asset }) => asset.id),
    assetPrices,
  );
  const discoverResultsPublished = publishedDiscoverQuery === normalizedQuery;
  React.useEffect(() => {
    if (visibleAssetResultsReady) setPublishedDiscoverQuery(normalizedQuery);
  }, [normalizedQuery, visibleAssetResultsReady]);
  const shouldLoadCollectionSummaries = shouldLoadHomeCollectionSummaries(
    homeTab,
    market.loading,
    discoverResultsPublished,
  );
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
      ]),
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
          ([collectionId]) => visibleCollections.has(collectionId) && !changedCollections.has(collectionId),
        ),
      ),
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
          let candidates: AssetCandidate[];
          if (collection.kind === 'names') {
            const includesCollectionAsset = collectionCandidateMembership(collection);
            candidates = await discoverMarketActivity({
              listingsOnly: true,
              signal: controller.signal,
              acceptProcessId: includesCollectionAsset,
            });
          } else {
            const recipients = [...new Set(collection.assets.map((asset) => asset.id))];
            const scan = reconcileHomeActivityScan(collectionActivityScans.current.get(collection.id), recipients);
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
                    collectionSummaryControllers.current.get(collection.id)?.controller !== controller ||
                    collectionSummaryControllers.current.get(collection.id)?.version !== version ||
                    collectionActivityScans.current.get(collection.id) !== scan
                  )
                    return;
                  commitHomeActivityBatch(scan, batchCandidates, batchRecipients);
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
          const floorScan = reconcileHomeFloorScan(
            collectionFloorScans.current.get(collection.id),
            version,
            candidates,
          );
          collectionFloorScans.current.set(collection.id, floorScan);
          const pendingFloorIds = new Set(pendingHomeFloorCandidates(floorScan));
          const pendingFloorCandidates = candidates.filter((candidate) => pendingFloorIds.has(candidate.processId));
          await resolveAssetCandidates(pendingFloorCandidates, [collection], {
            signal: controller.signal,
            read: (processId, signal) => readAssetState(processId, { signal, maxAge: 0, maxAttempts: 1 }),
            onSettled: (result, candidate, cause) => {
              if (
                controller.signal.aborted ||
                collectionSummaryControllers.current.get(collection.id)?.controller !== controller ||
                collectionSummaryControllers.current.get(collection.id)?.version !== version ||
                collectionFloorScans.current.get(collection.id) !== floorScan
              )
                return;
              if (cause) {
                commitHomeFloorResult(floorScan, candidate.processId, null, marketplaceFailureKind(cause));
                return;
              }
              const order = result ? bestAskOfAsset(result.state) : null;
              commitHomeFloorResult(
                floorScan,
                candidate.processId,
                order && result ? unitPriceWinston(order, result.state.denomination) : null,
              );
            },
          });
          controller.signal.throwIfAborted();
          if (collectionFloorScans.current.get(collection.id) !== floorScan) {
            controller.abort(new DOMException('Home floor scan replaced.', 'AbortError'));
            controller.signal.throwIfAborted();
          }
          if (!controller.signal.aborted) {
            const verifiedListings = [...floorScan.settled].flatMap(([processId, asking]) => {
              if (asking === null) return [];
              const asset = collectionAsset(collection, processId);
              return asset ? [asset] : [];
            });
            setVerifiedHomeListings((current) => {
              const previous = current[collection.id] ?? [];
              if (
                previous.length === verifiedListings.length &&
                previous.every((asset, index) => asset.id === verifiedListings[index]?.id)
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
              [collection.id]: { status: 'unavailable', source: 'index', kind: marketplaceFailureKind(cause) },
            }));
          }
        } finally {
          if (collectionSummaryControllers.current.get(collection.id)?.controller === controller) {
            collectionSummaryControllers.current.delete(collection.id);
          }
        }
      })(),
    );
    void Promise.all(requests).then(finishRetry);
  }, [collectionKey, computeGateway, finishSummaryRetry, shouldLoadCollectionSummaries, summaryRetry]);
  const summaryFailures = [...Object.values(assetPrices), ...Object.values(collectionFloors)].filter(
    (summary): summary is Extract<HomeMarketSummary, { status: 'unavailable' }> => summary.status === 'unavailable',
  );
  const summaryFailureMessage = (['index', 'compute'] as const)
    .flatMap((source) => {
      const failures = summaryFailures.filter((failure) => failure.source === source);
      if (!failures.length) return [];
      const kind = failures.some((failure) => failure.kind === 'rate-limited') ? 'rate-limited' : 'unavailable';
      return marketplaceRequestFailureMessage(source, kind);
    })
    .join(' ');
  const retryMarketSummaries = () => {
    if (summaryRetrying) return;
    retryAssetSummaries.current = new Set(
      assets.map(({ asset }) => asset.id).filter((assetId) => assetPrices[assetId]?.status === 'unavailable'),
    );
    retryCollectionSummaries.current = new Set(
      collections
        .map((collection) => collection.id)
        .filter((collectionId) => collectionFloors[collectionId]?.status === 'unavailable'),
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
    if (summaryRetrying || !summaryRetryOwnsFocus.current) return;
    summaryRetryOwnsFocus.current = false;
    window.requestAnimationFrame(() => {
      const target = summaryRetryButtonRef.current ?? homeHeadingRef.current;
      if (target?.isConnected && document.activeElement !== target) {
        target.focus({ preventScroll: true });
      }
    });
  }, [summaryFailures.length, summaryRetrying]);
  const displayedAssets = [...assets]
    .filter(({ asset }) => {
      const summary = assetPrices[asset.id];
      return !summary || summary.status === 'unavailable' || homeMarketSummaryListed(summary);
    })
    .filter(({ collection }) => homeAssetTypeMatches(collection, assetType))
    .sort((left, right) => {
      if (assetView === 'listed') return 0;
      const price = (assetId: string) => {
        const summary = assetPrices[assetId];
        if (!summary || summary.status !== 'resolved' || !summary.value) return Number.POSITIVE_INFINITY;
        return homeMarketPriceValue(summary.value);
      };
      const leftPrice = price(left.asset.id);
      const rightPrice = price(right.asset.id);
      if (Number.isFinite(leftPrice) !== Number.isFinite(rightPrice)) {
        return Number.isFinite(leftPrice) ? -1 : 1;
      }
      return assetView === 'price-low' ? leftPrice - rightPrice : rightPrice - leftPrice;
    });
  const collectionResultsReady = homeMarketSummariesReady(
    marketShellLoading,
    collections.map((collection) => collection.id),
    collectionFloors,
  );
  const assetSummariesRetrying = summaryRetrying && summaryRetryRun.current.pending.has('assets');
  const collectionSummariesRetrying = summaryRetrying && summaryRetryRun.current.pending.has('collections');
  const collectionResultsPending = homeMarketHasPending(
    market.loading || collectionSummariesRetrying,
    collections.map((collection) => collection.id),
    collectionFloors,
  );
  const discoverResultsPending = homeMarketHasPending(
    market.loading || assetSummariesRetrying || portableHomeListingsLoading,
    assets.map(({ asset }) => asset.id),
    assetPrices,
  );
  const discoverResultsReady = discoverResultsPublished || visibleAssetResultsReady;
  const selectHomeTab = (tab: 'discover' | 'collections') => {
    setHomeTab(tab);
    if (marketPaneRef.current) marketPaneRef.current.scrollTop = 0;
  };
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
                    <button
                      aria-controls="home-discover-panel"
                      aria-selected={homeTab === 'discover'}
                      className="home-market-tab"
                      id="home-discover-tab"
                      onClick={() => selectHomeTab('discover')}
                      ref={homeHeadingRef}
                      role="tab"
                      type="button"
                    >
                      <Compass className="ui-icon" aria-hidden="true" />
                      Discover
                    </button>
                    <button
                      aria-controls="home-collections-panel"
                      aria-selected={homeTab === 'collections'}
                      className="home-market-tab"
                      id="home-collections-tab"
                      onClick={() => selectHomeTab('collections')}
                      role="tab"
                      type="button"
                    >
                      <LayoutGrid className="ui-icon" aria-hidden="true" />
                      Collections
                    </button>
                  </div>
                  <p>
                    {homeTab === 'discover'
                      ? normalizedQuery
                        ? `Results for “${query}” across the current Arweave collection indexes.`
                        : 'Active listings read from current live state across every marketplace collection.'
                      : 'Permanent assets with ownership and settlement native to Arweave.'}
                  </p>
                </div>
                {homeTab === 'discover' ? (
                  <div aria-busy={discoverResultsPending} className="home-asset-filters">
                    <span className="home-asset-filters-loading" role="status">
                      {discoverResultsPending ? (
                        <>
                          <LoaderCircle aria-hidden="true" />
                          <span className="sr-only">Loading marketplace results</span>
                        </>
                      ) : null}
                    </span>
                    <MarketSelect<HomeAssetType>
                      label="Asset type"
                      onChange={setAssetType}
                      options={[
                        { value: 'all', label: 'All' },
                        { value: 'tokens', label: 'Tokens' },
                        { value: 'atomic', label: 'Atomic assets (NFT)' },
                      ]}
                      value={assetType}
                    />
                    <MarketSelect<'listed' | 'price-low' | 'price-high'>
                      label="View"
                      onChange={setAssetView}
                      options={[
                        { value: 'listed', label: 'Listed for sale' },
                        { value: 'price-low', label: 'Price: low to high' },
                        { value: 'price-high', label: 'Price: high to low' },
                      ]}
                      value={assetView}
                    />
                  </div>
                ) : null}
              </div>
              {market.error ? (
                <ErrorPanel message={market.error} onRetry={market.retry} retryLabel="Retry collections" />
              ) : null}
              {portableHomeListingsFailure ? (
                <ErrorPanel
                  message={marketplaceRequestFailureMessage(
                    portableHomeListingsFailure.source,
                    portableHomeListingsFailure.kind,
                  )}
                  onRetry={() => setPortableHomeRetry((current) => current + 1)}
                  retryLabel="Retry public listings"
                />
              ) : null}
              {partialTokenCollection ? (
                <div className="collection-source-notice">
                  <span role="status">
                    Search covers {partialTokenCollection.assets.length.toLocaleString()} of{' '}
                    {(partialTokenCollection.total ?? partialTokenCollection.assets.length).toLocaleString()} discovered
                    token records currently loaded.
                  </span>
                  <Link
                    className="with-icon"
                    to={`/collection/${partialTokenCollection.id}?q=${encodeURIComponent(query.trim())}`}
                  >
                    Continue token search
                    <ArrowRight className="ui-icon ui-icon--xs" aria-hidden="true" />
                  </Link>
                </div>
              ) : null}
              {discoverResultsReady && summaryFailures.length ? (
                <div className="collection-source-notice">
                  <span role="status">
                    {summaryRetrying ? 'Rechecking unfinished market data.' : summaryFailureMessage}
                  </span>
                  <button
                    aria-busy={summaryRetrying}
                    aria-disabled={summaryRetrying}
                    className="with-icon"
                    onBlur={(event) => {
                      if (summaryRetrying && event.relatedTarget) summaryRetryOwnsFocus.current = false;
                    }}
                    onClick={() => {
                      if (summaryRetrying) return;
                      summaryRetryOwnsFocus.current = true;
                      retryMarketSummaries();
                    }}
                    ref={summaryRetryButtonRef}
                    type="button"
                  >
                    <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
                    {summaryRetrying ? 'Retrying…' : 'Retry market data'}
                  </button>
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
                        const floor = collectionFloors[collection.id];
                        const floorPending = !floor || (collectionSummariesRetrying && floor.status === 'unavailable');
                        return (
                          <Link
                            className={`home-feature-card feature-${index}`}
                            key={collection.id}
                            to={`/collection/${collection.id}`}
                          >
                            <div className="home-feature-art">
                              {image ? (
                                <ArtworkImage
                                  src={image}
                                  alt=""
                                  loading="eager"
                                  fallback={
                                    <span className="home-image-collection-fallback" aria-hidden="true">
                                      <BazarMark />
                                      <strong>{collection.name.replace(/^\[TEST\]\s*/, '')}</strong>
                                      <small>Permanent image collection</small>
                                    </span>
                                  }
                                />
                              ) : collection.kind === 'names' ? (
                                <NamesCubePreview />
                              ) : collection.kind === 'tokens' ? (
                                <TokenArtwork
                                  className="home-token-collection-art"
                                  ticker={collection.assets[0]?.ticker ?? 'Token'}
                                />
                              ) : (
                                <div className="home-name-art">
                                  <BazarMark />
                                  <span>AR</span>
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
                                <span>{collection.kind === 'names' && collection.hasMore ? 'Loaded' : 'Assets'}</span>
                                <strong>{(collection.total ?? collection.assets.length).toLocaleString()}</strong>
                              </div>
                              <div>
                                <span>{collection.hasMore ? 'Loaded floor' : 'Floor'}</span>
                                <strong className={homeMarketSummaryListed(floor) ? 'listed' : undefined}>
                                  {!floorPending && floor ? (
                                    homeMarketSummaryLabel(
                                      floor,
                                      collection.hasMore ? 'No loaded listings' : 'No live listings',
                                      collection.hasMore ? 'No loaded asks' : 'No indexed asks',
                                    )
                                  ) : (
                                    <HomePendingMarketValue />
                                  )}
                                </strong>
                              </div>
                            </div>
                            <strong className="home-card-action">
                              Open collection
                              <span>
                                <ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
                              </span>
                            </strong>
                          </Link>
                        );
                      })}
                      {collectionResultsPending ? <HomeMarketGhostCard kind="collection" /> : null}
                    </div>
                  ) : null}
                  {collectionResultsReady && !market.error && collections.length === 0 ? (
                    <div className="home-no-results">No collections match “{query}”.</div>
                  ) : null}
                </div>
              ) : (
                <div
                  aria-busy={discoverResultsPending}
                  aria-labelledby="home-discover-tab"
                  id="home-discover-panel"
                  role="tabpanel"
                >
                  {displayedAssets.length || discoverResultsPending ? (
                    <div className="home-asset-grid">
                      {displayedAssets.map(({ asset, collection }) => {
                        const price = assetPrices[asset.id];
                        const pricePending = !price || (assetSummariesRetrying && price.status === 'unavailable');
                        return (
                          <Link key={`${collection.id}-${asset.id}`} to={`/asset/${collection.id}/${asset.id}`}>
                            {asset.image ? (
                              <ArtworkImage className="home-asset-media" src={asset.image} alt="" />
                            ) : collection.kind === 'names' ? (
                              <NameArtwork className="home-asset-media" name={asset.name} />
                            ) : (
                              <TokenArtwork
                                className="home-asset-media home-token-art"
                                ticker={asset.ticker ?? 'Token'}
                              />
                            )}
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
                      {discoverResultsPending ? <HomeMarketGhostCard kind="asset" /> : null}
                    </div>
                  ) : (
                    <div className="home-assets-empty">No live listings match this asset type.</div>
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

function GatewayControl() {
  const current = servingNodeOrigin(window.location);
  const [value, setValue] = React.useState(current);
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
    const origin = normalizeServingNodeOrigin(value, window.location.protocol);
    if (!origin) {
      setError('Enter an HTTP or HTTPS HyperBEAM gateway, such as arweave.net or localhost:3101.');
      return;
    }
    setError('');
    const url = new URL(window.location.href);
    url.searchParams.set('node', origin);
    window.location.assign(url);
  }
  return (
    <details className="gateway" open={open} ref={detailsRef}>
      <summary
        aria-controls="compute-gateway-panel"
        aria-expanded={open}
        aria-label={`Compute gateway, current ${current}`}
        onClick={(event) => {
          event.preventDefault();
          setOpen((currentOpen) => !currentOpen);
        }}
        ref={triggerRef}
        role="button"
        title={current}
      >
        <Server className="ui-icon ui-icon--sm" aria-hidden="true" />
        <span className="gateway-label">Compute gateway</span>
      </summary>
      <div id="compute-gateway-panel">
        <form onSubmit={apply}>
          <label>
            HyperBEAM gateway
            <input
              aria-describedby={error ? 'gateway-error' : undefined}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setValue(event.target.value);
                setError('');
              }}
              ref={inputRef}
              value={value}
            />
          </label>
          {error ? (
            <p className="gateway-error" id="gateway-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="with-icon" type="submit">
            <Server className="ui-icon ui-icon--sm" aria-hidden="true" /> Use gateway
          </button>
        </form>
        <p>Process reads and observer requests use this node. Transactions still settle on Arweave.</p>
      </div>
    </details>
  );
}

type MarketSelectOption<Value extends string> = {
  value: Value;
  label: string;
};

function MarketSelect<Value extends string>({
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
    options.findIndex((option) => option.value === value),
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
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${label}: ${selected.label}`}
        className={`market-select-trigger${open ? ' open' : ''}`}
        onClick={() => (open ? setOpen(false) : openAndFocus())}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          openAndFocus(event.key === 'ArrowDown' ? selectedIndex : selectedIndex - 1);
        }}
        ref={triggerRef}
        type="button"
      >
        <span>{selected.label}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open ? (
        <div aria-label={label} className="market-select-menu" id={menuId} role="listbox">
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <button
                aria-selected={active}
                className={`market-select-option${active ? ' active' : ''}`}
                key={option.value}
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
                type="button"
              >
                <span>{option.label}</span>
                {active ? <Check aria-hidden="true" /> : null}
              </button>
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

export function collectionActivityVersion(collection: Collection) {
  if (collection.kind === 'names') return collection.namespace?.manifestId ?? '';
  return `${collection.manifestId ?? ''}:${collection.assets.map((asset) => asset.id).join('.')}`;
}

export function newestCollectionActivity(events: CollectionActivityEvent[], limit = 100) {
  return [...new Map(events.map((event) => [event.id, event])).values()]
    .sort((a, b) => b.height - a.height || b.timestamp - a.timestamp || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function collectionListingScopeVersion(collection: Collection) {
  return collection.kind === 'tokens'
    ? (collection.manifestId ?? collection.id)
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

export function collectionCandidateMembership(collection: Collection) {
  if (collection.kind === 'names') {
    const namesById = collection.namespace?.namesById ?? {};
    return (processId: string) => Object.hasOwn(namesById, processId);
  }
  const assetIds = new Set(collection.assets.map((asset) => asset.id));
  return (processId: string) => assetIds.has(processId);
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
  current: ListingAnnouncementProgress & { total: number; loading: boolean },
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

function useProgressiveAssetPageSize() {
  const query = '(max-width: 480px)';
  const [pageSize, setPageSize] = React.useState(() => (window.matchMedia(query).matches ? 24 : 48));
  React.useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setPageSize(media.matches ? 24 : 48);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return pageSize;
}

function CollectionRoute() {
  const { collectionId = '' } = useParams();
  return <CollectionView key={collectionId} />;
}

function CollectionView() {
  const { collectionId = '' } = useParams();
  const { search } = useLocation();
  const market = React.useContext(MarketContext);
  const collection = market.collections.find((item) => item.id === collectionId);
  const routedQuery = new URLSearchParams(search).get('q') ?? '';
  const [query, setQuery] = React.useState(routedQuery);
  const pageSize = useProgressiveAssetPageSize();
  const [limit, setLimit] = React.useState(pageSize);
  const [sort, setSort] = React.useState<'default' | 'recent'>('default');
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
  const assetGridId = React.useId();
  const resultSummaryId = React.useId();
  const resultSummaryRef = React.useRef<HTMLParagraphElement>(null);
  const collectionStatusRef = React.useRef<HTMLSpanElement>(null);
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
  const activityByAsset = new Map(activity.map((candidate) => [candidate.processId, candidate]));
  const defaultIndex = new Map((collection?.assets ?? []).map((asset, index) => [asset.id, index]));
  const visibleAssets = listedOnly
    ? listed.map((result) => result.asset)
    : collection && query.trim()
      ? collectionSearchAssets(collection, query.trim().toLowerCase())
      : (collection?.assets ?? []);
  const listedIdsKey = listed
    .map((result) => result.asset.id)
    .sort()
    .join(',');
  const filtered = visibleAssets
    .filter(
      (asset) =>
        assetMatchesCollectionQuery(asset, query) &&
        (initial === 'all' || asset.name.trim().toLowerCase().startsWith(initial.toLowerCase())),
    )
    .sort((a, b) => {
      if (initial !== 'all') return compareCollectionAssetNames(a, b);
      if (sort === 'recent' && !recentOrderState.loading && !recentOrderState.error) {
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
        (defaultIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (defaultIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
        compareCollectionAssetNames(a, b)
      );
    });
  const filteredCountRef = React.useRef(filtered.length);
  filteredCountRef.current = filtered.length;
  const visiblePriceAssets = filtered.slice(0, limit);
  const visiblePriceKey = visiblePriceAssets.map((asset) => asset.id).join(',');
  const visibleUnavailablePrices = visiblePriceAssets.filter(
    (asset) => cardPrices[asset.id]?.status === 'unavailable',
  ).length;
  const visibleRateLimitedPrices = visiblePriceAssets.filter((asset) => {
    const price = cardPrices[asset.id];
    return price?.status === 'unavailable' && price.kind === 'rate-limited';
  }).length;
  const activityRequestMode = listedOnly ? 'listed' : sort === 'recent' ? 'recent' : 'idle';
  const listingCollectionVersion = React.useMemo(
    () => (collection ? collectionListingScopeVersion(collection) : ''),
    [collection],
  );
  const listingWindowVersion = React.useMemo(
    () => collection?.assets.map((asset) => asset.id).join('.') ?? '',
    [collection],
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
              (asset) => completedIds.has(asset.id) && !candidateIds.has(asset.id),
            );
            withoutListingActivity.forEach((asset) => resolvedPriceIds.current.add(asset.id));
            setCardPrices((current) => ({
              ...current,
              ...Object.fromEntries(
                withoutListingActivity.map((asset) => [asset.id, { status: 'unindexed' as const }]),
              ),
            }));
            await resolveAssetCandidates(
              candidates.filter((candidate) => completedIds.has(candidate.processId)),
              [collection],
              {
                signal: controller.signal,
                read: (processId, signal) => readAssetState(processId, { signal, maxAttempts: 1 }),
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
                          label: order && result ? orderPriceLabel(order, result.state) : null,
                        },
                  }));
                },
              },
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
        }),
      ),
    );
    setCardPricesFailure(null);
    setPriceRetry((current) => current + 1);
    window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
  };
  React.useEffect(() => {
    if (!collection || (!listedOnly && sort === 'default')) {
      listingActivityScope.current = '';
      listingActivityCandidates.current.clear();
      listingLoadedAssetIds.current.clear();
      settledListingCandidates.current.clear();
      failedListingCandidates.current.clear();
      setListingRetrying(false);
      setActivity([]);
      setListed([]);
      setActivityState({ loading: false, pages: 0, resolved: 0, total: 0, failures: 0, rateLimited: 0, error: null });
      return;
    }
    const controller = new AbortController();
    const collectionAssetIds = collection.assets.map((asset) => asset.id);
    const includesCollectionAsset = collectionCandidateMembership(collection);
    const tokenWindow = collectionAssetWindowDelta(listingLoadedAssetIds.current, collectionAssetIds);
    const continuing =
      listingActivityScope.current === listingScope && !(collection.kind === 'tokens' && tokenWindow.reset);
    const addedTokenIds = collection.kind === 'tokens' && continuing ? tokenWindow.added : [];
    const requestedAssetIds = collection.kind === 'tokens' && continuing ? addedTokenIds : collectionAssetIds;
    listingActivityScope.current = listingScope;
    if (!continuing) {
      listingActivityCandidates.current.clear();
      listingLoadedAssetIds.current.clear();
      settledListingCandidates.current.clear();
      failedListingCandidates.current.clear();
      setListingRetrying(false);
      setActivity([]);
      setListed([]);
      setActivityState({ loading: true, pages: 0, resolved: 0, total: 0, failures: 0, rateLimited: 0, error: null });
    } else {
      setActivityState((current) => ({ ...current, loading: true, pages: 0, error: null }));
    }
    if (collection.kind === 'tokens' && !requestedAssetIds.length) {
      setActivityState((current) => ({ ...current, loading: false }));
      if (listedOnly) setCardPricesLoading(false);
      return () => controller.abort();
    }
    if (listedOnly) {
      if (!continuing) setCardPrices({});
      setCardPricesLoading(true);
      setCardPricesFailure(null);
    }
    void (async () => {
      try {
        const resolvePage = async (page: AssetCandidate[]) => {
          if (controller.signal.aborted) return;
          const pageCandidates = page.filter((candidate) => includesCollectionAsset(candidate.processId));
          const newCandidates = pageCandidates.filter(
            (candidate) => !listingActivityCandidates.current.has(candidate.processId),
          );
          for (const candidate of pageCandidates) {
            listingActivityCandidates.current.set(candidate.processId, candidate);
          }
          setActivity(
            [...listingActivityCandidates.current.values()].sort(
              (a, b) => b.height - a.height || b.timestamp - a.timestamp || a.processId.localeCompare(b.processId),
            ),
          );
          setActivityState((current) => ({
            ...current,
            pages: current.pages + 1,
            total: current.total + newCandidates.length,
          }));
          if (!listedOnly) return;
          const candidates = pageCandidates.filter(
            (candidate) => !settledListingCandidates.current.has(candidate.processId),
          );
          if (!candidates.length) return;
          const outcomes = new Map<
            string,
            ListingResolutionOutcome & {
              candidate: AssetCandidate;
              failureKind?: MarketplaceFailureKind;
            }
          >();
          await resolveAssetCandidates(candidates, [collection], {
            signal: controller.signal,
            onSettled: (result, candidate, cause) => {
              if (controller.signal.aborted) return;
              outcomes.set(candidate.processId, {
                candidate,
                processId: candidate.processId,
                result,
                ...(cause ? { failureKind: marketplaceFailureKind(cause) } : {}),
              });
            },
          });
          if (controller.signal.aborted || listingActivityScope.current !== listingScope) return;
          const priceUpdates: Record<string, CollectionCardPrice> = {};
          let failures = 0;
          let rateLimited = 0;
          for (const outcome of outcomes.values()) {
            settledListingCandidates.current.add(outcome.processId);
            if (outcome.failureKind) {
              failures += 1;
              if (outcome.failureKind === 'rate-limited') rateLimited += 1;
              failedListingCandidates.current.set(outcome.processId, {
                candidate: outcome.candidate,
                kind: outcome.failureKind,
              });
            } else {
              failedListingCandidates.current.delete(outcome.processId);
            }
            const order = outcome.result ? bestAskOfAsset(outcome.result.state) : null;
            priceUpdates[outcome.processId] = outcome.failureKind
              ? { status: 'unavailable', kind: outcome.failureKind }
              : {
                  status: 'resolved',
                  label: order && outcome.result ? orderPriceLabel(order, outcome.result.state) : null,
                };
          }
          setListed((current) => mergeResolvedListingBatch(current, outcomes.values()));
          setCardPrices((current) => ({ ...current, ...priceUpdates }));
          setActivityState((current) => ({
            ...current,
            resolved: current.resolved + outcomes.size,
            failures: current.failures + failures,
            rateLimited: current.rateLimited + rateLimited,
          }));
        };
        const allActivity =
          collection.kind === 'names'
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
                onBatch: async (candidates, completedRecipients) => {
                  await resolvePage(candidates);
                  if (controller.signal.aborted || listingActivityScope.current !== listingScope) return;
                  for (const assetId of completedRecipients) listingLoadedAssetIds.current.add(assetId);
                },
              });
        if (controller.signal.aborted) return;
        const candidates = allActivity.filter((candidate) => includesCollectionAsset(candidate.processId));
        for (const candidate of candidates) {
          listingActivityCandidates.current.set(candidate.processId, candidate);
        }
        const mergedCandidates = [...listingActivityCandidates.current.values()].sort(
          (a, b) => b.height - a.height || b.timestamp - a.timestamp || a.processId.localeCompare(b.processId),
        );
        if (collection.kind === 'names') {
          for (const assetId of requestedAssetIds) listingLoadedAssetIds.current.add(assetId);
        }
        setActivity(mergedCandidates);
        if (!listedOnly) {
          setActivityState((current) => ({
            ...current,
            loading: false,
            resolved: mergedCandidates.length,
            total: mergedCandidates.length,
          }));
          return;
        }
        if (!controller.signal.aborted) {
          setActivityState((current) => ({ ...current, loading: false, total: mergedCandidates.length }));
          setCardPricesLoading(false);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
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
    return () => controller.abort();
  }, [listedOnly, listingScope, listingWindowVersion, retry]);
  React.useEffect(() => {
    if (!listingRetry || !collection || !listedOnly) return;
    const controller = new AbortController();
    const requestScope = listingScope;
    const candidates = [...failedListingCandidates.current.values()].map(({ candidate }) => candidate);
    if (!candidates.length) return;
    setListingRetrying(true);
    void (async () => {
      const outcomes = new Map<
        string,
        ListingResolutionOutcome & {
          candidate: AssetCandidate;
          failureKind?: MarketplaceFailureKind;
        }
      >();
      try {
        await resolveAssetCandidates(candidates, [collection], {
          signal: controller.signal,
          onSettled: (result, candidate, cause) => {
            if (controller.signal.aborted) return;
            outcomes.set(candidate.processId, {
              candidate,
              processId: candidate.processId,
              result,
              ...(cause ? { failureKind: marketplaceFailureKind(cause) } : {}),
            });
          },
        });
        if (controller.signal.aborted || listingActivityScope.current !== requestScope) return;
        const priceUpdates: Record<string, CollectionCardPrice> = {};
        for (const outcome of outcomes.values()) {
          if (outcome.failureKind) {
            failedListingCandidates.current.set(outcome.processId, {
              candidate: outcome.candidate,
              kind: outcome.failureKind,
            });
          } else {
            failedListingCandidates.current.delete(outcome.processId);
          }
          const order = outcome.result ? bestAskOfAsset(outcome.result.state) : null;
          priceUpdates[outcome.processId] = outcome.failureKind
            ? { status: 'unavailable', kind: outcome.failureKind }
            : {
                status: 'resolved',
                label: order && outcome.result ? orderPriceLabel(order, outcome.result.state) : null,
              };
        }
        setListed((current) => mergeResolvedListingBatch(current, outcomes.values()));
        setCardPrices((current) => ({ ...current, ...priceUpdates }));
        const failures = [...failedListingCandidates.current.values()];
        setActivityState((current) => ({
          ...current,
          failures: failures.length,
          rateLimited: failures.filter(({ kind }) => kind === 'rate-limited').length,
        }));
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
    if (!collection || !listedOnly || sort !== 'recent') {
      recentOrderScope.current = '';
      recentOrderActivity.current.clear();
      recentOrderResolvedIds.current.clear();
      setRecentOrderState({ loading: false, error: null });
      return;
    }
    if (activityState.loading || listingRetrying) {
      setRecentOrderState({ loading: true, error: null });
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
          (a, b) => b.height - a.height || b.timestamp - a.timestamp || a.processId.localeCompare(b.processId),
        ),
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
      },
    }).then(
      () => {
        if (!controller.signal.aborted) {
          setActivity(
            [...recentOrderActivity.current.values()].sort(
              (a, b) => b.height - a.height || b.timestamp - a.timestamp || a.processId.localeCompare(b.processId),
            ),
          );
          setRecentOrderState({ loading: false, error: null });
        }
      },
      (cause) => {
        if (!controller.signal.aborted) {
          setRecentOrderState({ loading: false, error: marketplaceFailureKind(cause) });
        }
      },
    );
    return () => controller.abort();
  }, [activityState.loading, collection?.id, listedIdsKey, listedOnly, listingRetrying, recentOrderRetry, sort]);
  React.useEffect(() => setLimit(pageSize), [initial, listedOnly, query, sort]);
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
        <ErrorPanel message={market.error} onRetry={market.retry} retryLabel="Retry collection index" />
      </RouteState>
    );
  if (!collection)
    return (
      <RouteState title="Collection not found">
        <ErrorPanel message="This collection could not be found on Arweave." />
      </RouteState>
    );
  const compactTokenCollection = collection.kind === 'tokens' && collection.assets.length === 1 && !collection.hasMore;
  const pagedTokenScope = collection.kind === 'tokens' && collection.hasMore;
  const listingSearchDetail = `${activityState.pages.toLocaleString()} index ${activityState.pages === 1 ? 'check' : 'checks'} this pass · ${activityState.total.toLocaleString()} ${activityState.total === 1 ? 'candidate' : 'candidates'} · ${activityState.resolved.toLocaleString()} checked${activityState.failures ? ` · ${activityState.failures.toLocaleString()} unavailable` : ''}${pagedTokenScope ? ` · among ${collection.assets.length.toLocaleString()} loaded tokens` : ''}`;
  listingAnnouncementProgress.current = nextListingAnnouncementProgress(listingAnnouncementProgress.current, {
    scope: listingScope,
    resolved: activityState.resolved,
    failures: activityState.failures,
    total: activityState.total,
    loading: activityState.loading,
  });
  const announcedListingProgress = listingAnnouncementProgress.current;
  const listingSearchAnnouncement = `${activityState.pages.toLocaleString()} index ${activityState.pages === 1 ? 'check' : 'checks'} this pass · ${activityState.total.toLocaleString()} ${activityState.total === 1 ? 'candidate' : 'candidates'} · ${announcedListingProgress.resolved.toLocaleString()} checked${announcedListingProgress.failures ? ` · ${announcedListingProgress.failures.toLocaleString()} unavailable` : ''}${pagedTokenScope ? ` · among ${collection.assets.length.toLocaleString()} loaded tokens` : ''}`;
  const resultSummary = activityState.loading
    ? listedOnly
      ? `${listed.length.toLocaleString()} live ${listed.length === 1 ? 'listing' : 'listings'} so far`
      : 'Finding recent activity on Arweave…'
    : query
      ? `${filtered.length.toLocaleString()} ${collection.kind === 'names' ? 'current namespace' : 'loaded'} matches`
      : initial !== 'all'
        ? `${filtered.length.toLocaleString()} loaded names beginning with ${initial}`
        : listedOnly
          ? `${filtered.length.toLocaleString()} live ${filtered.length === 1 ? 'listing' : 'listings'}${pagedTokenScope ? ' in loaded tokens' : ''}${activityState.failures ? ` · ${activityState.failures.toLocaleString()} unavailable` : ''}`
          : collection.kind === 'names'
            ? collection.hasMore
              ? `${collection.assets.length.toLocaleString()} current names loaded · more available`
              : `${collection.assets.length.toLocaleString()} current ${collection.assets.length === 1 ? 'name' : 'names'}`
            : collection.kind === 'tokens' && collection.hasMore
              ? `${collection.assets.length.toLocaleString()} tokens loaded · more available`
              : `${collection.assets.length.toLocaleString()} ${collection.kind === 'tokens' ? (collection.assets.length === 1 ? 'token' : 'tokens') : collection.assets.length === 1 ? 'asset' : 'assets'}`;
  const resultAnnouncement = activityState.loading
    ? listedOnly
      ? `Searching Arweave for live listings in ${collection.name}: ${listingSearchAnnouncement}.`
      : `Finding recent activity in ${collection.name}.`
    : cardPricesLoading
      ? `Checking live prices for ${visiblePriceAssets.length.toLocaleString()} visible assets in ${collection.name}.`
      : query
        ? filtered.length
          ? `${filtered.length.toLocaleString()} ${collection.kind === 'names' ? 'names' : 'assets'} match ${query} in ${collection.name}.`
          : collection.kind === 'tokens' && collection.hasMore
            ? `No loaded tokens match ${query} in ${collection.name}; more token records remain available.`
            : `No ${collection.kind === 'names' ? 'names' : 'assets'} match ${query} in ${collection.name}.`
        : `${resultSummary} in ${collection.name}.`;
  return (
    <section className="collection-page">
      <Link className="back" to="/">
        <ArrowLeft className="ui-icon ui-icon--sm" aria-hidden="true" /> All collections
      </Link>
      <div className="collection-title">
        <div>
          <p className="eyebrow">{collectionEyebrow(collection)}</p>
          <h1>{collection.name}</h1>
        </div>
        <p>{collection.description}</p>
      </div>
      <CollectionTabs collection={collection} active="assets" />
      <CollectionIndexNotice collection={collection} checking={market.loading} onRetry={market.retry} />
      {pagedTokenScope ? (
        <div className="collection-source-notice" role="status">
          <span>
            Browsing {collection.assets.length.toLocaleString()} of{' '}
            {(collection.total ?? collection.assets.length).toLocaleString()} discovered tokens. Prices, listings, and
            recent activity cover the loaded records.
          </span>
        </div>
      ) : null}
      {collection.kind === 'names' ? (
        <div
          className={`alphabet-filter-shell${alphabetEdges.start ? ' at-start' : ''}${alphabetEdges.end ? ' at-end' : ''}`}
        >
          <nav
            className="alphabet-filter"
            aria-label="Filter names by first letter"
            id="name-initial-filter"
            ref={alphabetScrollerRef}
          >
            {['all', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].map((letter, index, options) => (
              <button
                aria-label={letter === 'all' ? 'All names' : `Names beginning with ${letter}`}
                aria-pressed={initial === letter}
                className={initial === letter ? 'active' : undefined}
                key={letter}
                type="button"
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
              </button>
            ))}
          </nav>
          {!alphabetEdges.start ? (
            <button
              aria-controls="name-initial-filter"
              aria-label="Browse earlier letters"
              className="alphabet-scroll alphabet-scroll-previous"
              onClick={() => browseAlphabet('previous')}
              type="button"
            >
              <ArrowLeft aria-hidden="true" />
            </button>
          ) : null}
          {!alphabetEdges.end ? (
            <button
              aria-controls="name-initial-filter"
              aria-label="Browse later letters"
              className="alphabet-scroll alphabet-scroll-next"
              onClick={() => browseAlphabet('next')}
              type="button"
            >
              <ArrowRight aria-hidden="true" />
            </button>
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
          <div className="asset-filters">
            <MarketSelect<'all' | 'listed'>
              label="Show"
              onChange={(nextValue) => setListedOnly(nextValue === 'listed')}
              options={[
                { value: 'all', label: 'All assets' },
                { value: 'listed', label: 'Listed for sale' },
              ]}
              value={listedOnly ? 'listed' : 'all'}
            />
            <MarketSelect<'default' | 'recent'>
              label="Sort"
              onChange={setSort}
              options={[
                { value: 'default', label: collection.kind === 'names' ? 'Name: A to Z' : 'Default' },
                { value: 'recent', label: 'Recent activity' },
              ]}
              value={sort}
            />
          </div>
          <span id={resultSummaryId} ref={collectionStatusRef} tabIndex={-1}>
            {resultSummary}
          </span>
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
        <div className="inline-error">
          <span role="alert">{activityState.error}</span>
          <button
            className="with-icon"
            onClick={() => {
              setRetry((value) => value + 1);
              window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
            }}
          >
            <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
          </button>
        </div>
      ) : null}
      {!listedOnly && !cardPricesLoading && (cardPricesFailure || visibleUnavailablePrices > 0) ? (
        <div className="inline-error">
          <span role="status">
            {cardPricesFailure
              ? marketplaceRequestFailureMessage(cardPricesFailure.source, cardPricesFailure.kind)
              : marketplaceRequestFailureMessage('compute', visibleRateLimitedPrices ? 'rate-limited' : 'unavailable')}
            {!cardPricesFailure && visibleUnavailablePrices
              ? ` ${visibleUnavailablePrices.toLocaleString()} visible ${visibleUnavailablePrices === 1 ? 'price remains' : 'prices remain'} unavailable.`
              : ''}
          </span>
          <button className="with-icon" type="button" onClick={retryCardPrices}>
            <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />
            {cardPricesFailure?.kind === 'rate-limited' || visibleRateLimitedPrices ? 'Retry later' : 'Retry prices'}
          </button>
        </div>
      ) : null}
      {listedOnly && !activityState.loading && !activityState.error && activityState.failures ? (
        <div className="inline-error">
          <span role="status">
            {listingRetrying
              ? 'Rechecking only the listing candidates that were unavailable.'
              : marketplaceRequestFailureMessage(
                  'compute',
                  activityState.rateLimited ? 'rate-limited' : 'unavailable',
                )}{' '}
            {activityState.failures.toLocaleString()} listing{' '}
            {activityState.failures === 1 ? 'candidate remains' : 'candidates remain'} unavailable. Resolved listings
            remain visible.
          </span>
          <button
            className="with-icon"
            disabled={listingRetrying}
            type="button"
            onClick={() => {
              setListingRetry((value) => value + 1);
              window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
            }}
          >
            <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
            {listingRetrying ? 'Retrying…' : activityState.rateLimited ? 'Retry later' : 'Retry unavailable'}
          </button>
        </div>
      ) : null}
      {listedOnly && sort === 'recent' && (recentOrderState.loading || recentOrderState.error) ? (
        <div className={recentOrderState.error ? 'inline-error' : 'collection-source-notice'}>
          <span role="status">
            {recentOrderState.loading
              ? 'Ordering live listings by their latest indexed market activity…'
              : `${marketplaceRequestFailureMessage('index', recentOrderState.error!)} Resolved listings are shown in Default order.`}
          </span>
          {recentOrderState.error ? (
            <button
              className="with-icon"
              type="button"
              onClick={() => {
                setRecentOrderRetry((value) => value + 1);
                window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
              }}
            >
              <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry recent order
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        aria-describedby={resultSummaryId}
        aria-label={`${collection.name} assets`}
        className={`asset-grid${collection.kind === 'tokens' ? ' token-collection-grid' : ''}${collection.kind === 'names' ? ' names-collection-grid' : ''}`}
        id={assetGridId}
      >
        {filtered.slice(0, limit).map((asset) => {
          const price = cardPrices[asset.id];
          return (
            <AssetCard
              key={asset.id}
              collection={collection}
              asset={asset}
              collectionContext
              badge={listedOnly ? 'For sale' : undefined}
              price={
                price?.status === 'unavailable'
                  ? 'Unavailable'
                  : price?.status === 'unindexed'
                    ? 'No indexed ask'
                    : price?.status === 'resolved'
                      ? (price.label ?? 'Not listed')
                      : cardPricesFailure
                        ? 'Unavailable'
                        : 'Checking…'
              }
              priceListed={price?.status === 'resolved' && Boolean(price.label)}
            />
          );
        })}
      </div>
      <p
        className={
          filtered.length > pageSize && limit >= filtered.length ? 'collection-result-count reveal-complete' : 'sr-only'
        }
        aria-live="polite"
        ref={resultSummaryRef}
        role="status"
        tabIndex={-1}
      >
        {filtered.length > pageSize && limit >= filtered.length
          ? `All ${filtered.length.toLocaleString()} ${collection.hasMore ? `currently loaded ${collection.kind === 'names' ? 'names' : 'assets'}` : collection.kind === 'names' ? 'names' : 'assets'} are shown.`
          : `Showing ${Math.min(limit, filtered.length).toLocaleString()} of ${filtered.length.toLocaleString()} ${collection.kind === 'names' ? 'names' : 'assets'}.`}
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
            <button type="button" onClick={clearCollectionFilters}>
              Clear filters
            </button>
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
            <button type="button" onClick={clearCollectionFilters}>
              {initial !== 'all' ? 'View all names' : 'Clear search'}
            </button>
          ) : null}
        </div>
      ) : null}
      {moreState.error ? (
        <div
          className="inline-error"
          ref={(node) => {
            moreOutcomeRef.current = node;
          }}
          tabIndex={-1}
        >
          <span role="alert">
            More {collection.kind === 'tokens' ? 'tokens' : 'names'} could not be loaded: {moreState.error}
          </span>
          <button
            className="with-icon"
            type="button"
            onClick={() => {
              void loadMore();
              window.requestAnimationFrame(() => collectionStatusRef.current?.focus());
            }}
          >
            <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry{' '}
            {collection.kind === 'tokens' ? 'tokens' : 'names'}
          </button>
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
            ? `${moreState.added.toLocaleString()} more ${collection.kind === 'tokens' ? (moreState.added === 1 ? 'token' : 'tokens') : `current ${moreState.added === 1 ? 'name' : 'names'}`} loaded.`
            : collection.kind === 'tokens'
              ? `No additional tokens were found in that page. ${collection.hasMore ? 'More token records remain.' : 'The token index is now fully checked.'}`
              : `No additional current names were found in that page. ${collection.hasMore ? 'More carrier records remain.' : 'The carrier index is now fully checked.'}`}
        </p>
      ) : null}
      {limit < filtered.length ? (
        <button
          aria-controls={assetGridId}
          className="load-more"
          ref={moreContinuationRef}
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
        </button>
      ) : collection.hasMore && (collection.kind === 'tokens' || (!listedOnly && !query)) && !moreState.error ? (
        <button
          aria-busy={moreState.loading}
          aria-disabled={moreState.loading}
          className="load-more"
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
            ? `${collection.kind === 'tokens' && query ? 'Searching' : 'Checking'} ${collection.kind === 'tokens' ? 'token' : 'carrier'} records…`
            : `${collection.kind === 'tokens' && query ? 'Search' : 'Check'} next 100 ${collection.kind === 'tokens' ? 'token' : 'carrier'} records`}
        </button>
      ) : null}
    </section>
  );
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
  directlyVerified = false,
  onRetry,
}: {
  collection: Collection;
  checking: boolean;
  directlyVerified?: boolean;
  onRetry(): void;
}) {
  if (collection.indexSource !== 'compiled-fallback') return null;
  const tokenIndex = collection.kind === 'tokens';
  const message = checking
    ? tokenIndex
      ? directlyVerified
        ? 'Checking token discovery. This token remains available directly from live state through the selected gateway.'
        : 'Checking token discovery. The configured token remains available; ownership, orders, and balances are still computed live through the selected gateway.'
      : 'Checking this collection’s live asset index. Its bundled index remains available; ownership and orders are still computed live through the selected gateway.'
    : tokenIndex
      ? directlyVerified
        ? 'This token was read directly from live state and may not appear in collection browsing while token discovery is unavailable.'
        : 'Token discovery is unavailable. Showing the configured token only; ownership, orders, and balances are still computed live through the selected gateway.'
      : 'This collection’s live asset index is unavailable. Showing its last published index; ownership and orders are still computed live through the selected gateway.';
  const compactMessage = tokenIndex
    ? directlyVerified
      ? `${checking ? 'Checking discovery' : 'Discovery unavailable'}; live token state remains available.`
      : `${checking ? 'Checking discovery' : 'Showing the configured token'}; balances and orders remain live.`
    : `${checking ? 'Checking the published index' : 'Using the published index'}; ownership and orders remain live.`;
  return (
    <div className="collection-source-notice collection-index-notice">
      <span role="status">
        <span aria-hidden="true" className="collection-index-message-full">
          {message}
        </span>
        <span aria-hidden="true" className="collection-index-message-compact">
          {compactMessage}
        </span>
        <span className="sr-only">{message}</span>
      </span>
      <button
        aria-disabled={checking}
        aria-label={checking ? 'Checking collection index' : 'Retry collection index'}
        className="with-icon"
        type="button"
        onClick={() => {
          if (!checking) onRetry();
        }}
      >
        <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />
        <span aria-hidden="true" className="collection-index-action-full">
          {checking ? 'Checking collection index…' : 'Retry collection index'}
        </span>
        <span aria-hidden="true" className="collection-index-action-compact">
          {checking ? 'Checking…' : 'Retry'}
        </span>
      </button>
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
        ? `${collection.id}:${collection.kind === 'names' ? collectionActivityVersion(collection) : (collection.manifestId ?? collection.id)}`
        : '',
    [collection],
  );
  const activityWindowVersion = React.useMemo(
    () => collection?.assets.map((asset) => asset.id).join('.') ?? '',
    [collection?.assets],
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
    const assetIds = collection.assets.map((asset) => asset.id);
    const window = collectionAssetWindowDelta(activityLoadedAssetIds.current, assetIds);
    const retryMissing =
      collection.kind !== 'names' && sameScope && !window.reset && activityRunMode.current === 'retry';
    const continueWindow = collection.kind !== 'names' && sameScope && !window.reset && window.added.length > 0;
    const incremental = retryMissing || continueWindow;
    const preserveEvents = sameScope && eventsRef.current.length > 0;
    const nextEvents: CollectionActivityEvent[] = [];
    scopeRef.current = activityScope;
    activityRunMode.current = 'refresh';
    if (!incremental) {
      activityBatchEvents.current.clear();
      activityLoadedAssetIds.current.clear();
    }
    if (!preserveEvents) {
      eventsRef.current = [];
      setEvents([]);
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
              nextEvents.push(...page);
              setPages((current) => current + 1);
              if (!preserveEvents) {
                eventsRef.current = [...nextEvents];
                setEvents(eventsRef.current);
              }
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
              for (const event of batchEvents) activityBatchEvents.current.set(event.id, event);
              for (const assetId of completedRecipients) activityLoadedAssetIds.current.add(assetId);
              setPages((current) => current + 1);
              if (!preserveEvents) {
                eventsRef.current = newestCollectionActivity([...activityBatchEvents.current.values()]);
                setEvents(eventsRef.current);
              }
            },
          });
    void discovery.then(
      () => {
        if (!controller.signal.aborted) {
          eventsRef.current =
            collection.kind === 'names'
              ? nextEvents
              : newestCollectionActivity([...activityBatchEvents.current.values()]);
          setEvents(eventsRef.current);
          setLoading(false);
          setPreservingEvents(false);
        }
      },
      (cause) => {
        if (!controller.signal.aborted) {
          setError(marketplaceRequestFailureMessage('index', marketplaceFailureKind(cause)));
          setLoading(false);
        }
      },
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
        <ErrorPanel message={market.error} onRetry={market.retry} retryLabel="Retry collection index" />
      </RouteState>
    );
  if (!collection)
    return (
      <RouteState title="Collection not found">
        <ErrorPanel message="This collection could not be found on Arweave." />
      </RouteState>
    );
  const confirmedEvents = events.filter((event) => event.height > 0).length;
  const pendingEvents = events.length - confirmedEvents;
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
        <div>
          <p className="eyebrow">Arweave activity</p>
          <h1>{collection.name}</h1>
        </div>
        <p>
          Indexed signed market actions discovered from Arweave. Current ownership and listing status still come only
          from live process state.
        </p>
      </div>
      <CollectionTabs collection={collection} active="activity" />
      <CollectionIndexNotice collection={collection} checking={market.loading} onRetry={market.retry} />
      {collection.kind === 'tokens' && collection.hasMore ? (
        <div className="collection-source-notice">
          <span role="status">
            This feed covers {collection.assets.length.toLocaleString()} of{' '}
            {(collection.total ?? collection.assets.length).toLocaleString()} discovered tokens currently loaded in the
            collection.
          </span>
          <Link className="with-icon" to={`/collection/${collection.id}`}>
            Open collection to load more
            <ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
      <div className="activity-heading">
        <div>
          <h2>Recent market activity</h2>
          <span aria-hidden="true">
            {loading
              ? preservingEvents
                ? `${events.length.toLocaleString()} retained · ${pages ? `refresh checked ${pages.toLocaleString()} ${pages === 1 ? 'page' : 'pages'}` : 'refreshing from Arweave'}`
                : pages
                  ? `${events.length.toLocaleString()} found across ${pages.toLocaleString()} ${pages === 1 ? 'page' : 'pages'} · still reading Arweave`
                  : 'Reading indexed transactions from Arweave…'
              : `${events.length.toLocaleString()} indexed ${events.length === 1 ? 'transaction' : 'transactions'} · ${confirmedEvents.toLocaleString()} confirmed${pendingEvents ? ` · ${pendingEvents.toLocaleString()} pending` : ''} · newest first`}
          </span>
          <span aria-live="polite" className="sr-only" role="status">
            {activityScanAnnouncement}
          </span>
        </div>
        <button
          aria-disabled={loading}
          className="with-icon"
          onClick={() => {
            if (loading) return;
            setActivityRevealAnnouncement('');
            activityRunMode.current = error ? 'retry' : 'refresh';
            setRetry((value) => value + 1);
          }}
        >
          <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />
          {loading ? (events.length ? 'Refreshing…' : 'Loading…') : error ? 'Retry activity' : 'Refresh'}
        </button>
      </div>
      {error ? (
        <ErrorPanel
          message={`Activity scanning was interrupted. ${events.length ? `${events.length.toLocaleString()} existing events remain visible. ` : ''}${error}`}
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
        <button
          aria-controls={activityListId}
          className="load-more"
          type="button"
          onClick={() => {
            const nextLimit = Math.min(events.length, activityLimit + 20);
            setActivityLimit(nextLimit);
            setActivityRevealAnnouncement(
              `Showing ${nextLimit.toLocaleString()} of ${events.length.toLocaleString()} indexed activity events.`,
            );
            window.requestAnimationFrame(() => {
              if (assetGroupRevealComplete(nextLimit, eventCountRef.current)) {
                activityRevealRef.current?.focus();
              }
            });
          }}
        >
          Show {Math.min(20, events.length - activityLimit).toLocaleString()} more activity events
        </button>
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
      ? `Activity scanning stopped. ${events.toLocaleString()} previously indexed ${events === 1 ? 'event remains' : 'events remain'} visible.`
      : `Activity scan complete. ${events.toLocaleString()} indexed ${events === 1 ? 'event' : 'events'} found.`;
  }
  if (pages === 0) {
    return preservingEvents
      ? 'Refreshing indexed activity from Arweave. Existing events remain visible.'
      : 'Reading indexed activity from Arweave.';
  }
  const milestone = pages < 10 ? 1 : Math.floor(pages / 10) * 10;
  return `${preservingEvents ? 'Activity refresh' : 'Activity scan'} checked ${milestone.toLocaleString()} ${milestone === 1 ? 'batch' : 'batches'} so far.`;
}

function CollectionTabs({ collection, active }: { collection: Collection; active: 'assets' | 'activity' }) {
  return (
    <nav className="collection-tabs" aria-label={`${collection.name} views`}>
      <Link
        aria-current={active === 'assets' ? 'page' : undefined}
        className={active === 'assets' ? 'active' : ''}
        to={`/collection/${collection.id}`}
      >
        <LayoutGrid className="ui-icon ui-icon--sm" aria-hidden="true" /> Assets
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

const AssetCard = React.memo(function AssetCard({
  collection,
  asset,
  badge,
  price,
  priceListed = false,
  collectionContext = false,
}: {
  collection: Collection;
  asset: AssetSummary;
  badge?: string;
  price?: string;
  priceListed?: boolean;
  collectionContext?: boolean;
}) {
  return (
    <Link
      className={`asset-card${collection.kind === 'tokens' ? ' token-asset-card' : ''}${collectionContext ? ' collection-context' : ''}`}
      to={`/asset/${collection.id}/${asset.id}`}
    >
      <div className="asset-media">
        {asset.image ? (
          <ArtworkImage src={asset.image} loading="lazy" alt="" />
        ) : collection.kind === 'tokens' ? (
          <TokenArtwork ticker={asset.ticker ?? 'Token'} />
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
  supportFailures: Map<string, CandidateSupportFailure>,
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
        ? `Discovering and checking live state. ${status.discovered.toLocaleString()} candidates found${milestone ? `, ${milestone.toLocaleString()} checked` : ''}.`
        : status.phase === 'revalidating'
          ? `Confirming current ownership. ${(status.revalidated ?? 0).toLocaleString()} of ${(status.revalidationTotal ?? 0).toLocaleString()} visible assets rechecked without cached state.`
          : status.phase === 'resolving'
            ? `Checking asset candidates. ${status.total ? Math.floor((status.resolved / status.total) * 10) * 10 : 0}% complete.`
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

export function walletResolutionMaxAge(refresh: number) {
  return refresh > 0 ? 0 : 60;
}

export type WalletAnnouncementProgress = { scope: string; discovered: number; revalidated: number };

export function nextWalletAnnouncementProgress(
  previous: WalletAnnouncementProgress,
  status: WalletResolutionStatus,
  scope: string,
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
          ? (collection.namespace?.manifestId ?? '')
          : (collection.manifestId ?? collection.id),
      ].join(':'),
    )
    .sort();
  return [address, gateway, ...supportedCollections].join('|');
}

export function walletDiscoverySession(
  current: WalletDiscoverySession | undefined,
  scope: string,
  address: string,
): WalletDiscoverySession {
  if (current?.scope === scope) return current;
  return {
    scope,
    scan: createWalletCandidateScan(address),
    counted: new Set<string>(),
    screened: new Set<string>(),
    completed: new Set<string>(),
    latestCandidates: new Map<string, AssetCandidate>(),
    resolvedAssets: new Map<string, ResolvedAsset>(),
    complete: false,
  };
}

export function walletDiscoverySessionIsCurrent(
  session: WalletDiscoverySession | undefined,
  scope: string,
): session is WalletDiscoverySession {
  return Boolean(scope && session?.scope === scope);
}

export function updateWalletResolvedAsset(
  session: WalletDiscoverySession,
  result: ResolvedAsset | null,
  candidate: AssetCandidate,
  address: string,
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
        (candidate.activityIds ?? []).some((id) => !(previous.activityIds ?? []).includes(id)))),
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

export function walletPageResolutionQueue(
  resolvePage: (page: AssetCandidate[]) => void | Promise<void>,
  signal: AbortSignal,
) {
  let tail: Promise<void> = Promise.resolve();
  const pending: Promise<void>[] = [];
  let failed = false;
  let failure: unknown;
  const throwIfStopped = () => {
    if (signal.aborted) throw signal.reason;
    if (failed) throw failure;
  };
  const waitFor = (promise: Promise<void>) => {
    if (signal.aborted) return Promise.reject(signal.reason);
    return new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
      promise.then(
        () => {
          signal.removeEventListener('abort', onAbort);
          resolve();
        },
        (cause) => {
          signal.removeEventListener('abort', onAbort);
          reject(cause);
        },
      );
    });
  };
  return {
    async push(page: AssetCandidate[]) {
      throwIfStopped();
      while (pending.length >= 2) {
        await waitFor(pending[0]);
        throwIfStopped();
      }
      const running = tail.then(async () => {
        throwIfStopped();
        try {
          await resolvePage(page);
        } catch (cause) {
          if (!failed) {
            failed = true;
            failure = cause;
          }
          throw cause;
        }
      });
      tail = running.catch(() => undefined);
      pending.push(running);
      const remove = () => {
        const index = pending.indexOf(running);
        if (index >= 0) pending.splice(index, 1);
      };
      void running.then(remove, remove);
      if (pending.length >= 2) {
        await waitFor(pending[0]);
        throwIfStopped();
      }
    },
    async drain() {
      await waitFor(tail);
      throwIfStopped();
    },
  };
}

function initialWalletResolutionStatus(): WalletResolutionStatus {
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

type UdlGrantValue = NonNullable<UdlTerms['derivation'] | UdlTerms['commercialUse'] | UdlTerms['dataModelTraining']>;

function UdlGrantField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: UdlGrantValue;
  options: Array<[string, string]>;
  onChange: (value: UdlGrantValue | undefined) => void;
}) {
  const needsValue = value && ['revenue-share', 'one-time', 'monthly'].includes(value.grant);
  return (
    <div className={needsValue ? 'udl-field udl-grant-field has-value' : 'udl-field udl-grant-field'}>
      <div className={needsValue ? 'udl-field-control with-value' : 'udl-field-control'}>
        <MarketSelect
          label={label}
          value={value?.grant ?? ''}
          options={[
            { value: '', label: 'Not granted' },
            ...options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel })),
          ]}
          onChange={(grant) => {
            if (!grant) return onChange(undefined);
            onChange({
              grant: grant as UdlGrantValue['grant'],
              ...(['one-time', 'monthly'].includes(grant)
                ? { value: '1' }
                : grant === 'revenue-share'
                  ? { value: '10' }
                  : {}),
            });
          }}
        />
        {needsValue ? (
          <label className="udl-value">
            <span>{value.grant === 'revenue-share' ? 'Percent' : 'Amount'}</span>
            <input
              aria-label={`${label} ${value.grant === 'revenue-share' ? 'percentage' : 'fee amount'}`}
              inputMode="decimal"
              min="0.000000000001"
              max={value.grant === 'revenue-share' ? '100' : undefined}
              step="any"
              type="number"
              value={value.value ?? '1'}
              onChange={(event) => onChange({ ...value, value: event.target.value || '1' })}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}

function CreateView() {
  const market = React.useContext(MarketContext);
  const wallet = useWallet();
  const navigate = useNavigate();
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [mode, setMode] = React.useState<'asset' | 'collection'>('asset');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [collectionFiles, setCollectionFiles] = React.useState<File[]>([]);
  const [preview, setPreview] = React.useState('');
  const [collectionPreviews, setCollectionPreviews] = React.useState<string[]>([]);
  const [estimate, setEstimate] = React.useState<MintEstimate | null>(null);
  const [collectionEstimate, setCollectionEstimate] = React.useState<CollectionMintEstimate | null>(null);
  const [estimating, setEstimating] = React.useState(false);
  const [allowHighCost, setAllowHighCost] = React.useState(false);
  const [udlEnabled, setUdlEnabled] = React.useState(true);
  const [udlTerms, setUdlTerms] = React.useState<UdlTerms>({});
  const [phase, setPhase] = React.useState<MintPhase | null>(null);
  const [collectionPhase, setCollectionPhase] = React.useState<CollectionMintPhase | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<MintedAsset | null>(null);
  const [resultReady, setResultReady] = React.useState(false);
  const [collectionResult, setCollectionResult] = React.useState<Collection | null>(null);
  const [draft, setDraft] = React.useState<MintDraft | null>(() =>
    wallet.address ? getMintDraft(wallet.address) : null,
  );
  const activeUdl = udlEnabled ? udlTerms : undefined;
  const hasUdlPayment = Boolean(
    activeUdl?.accessFee ||
    ['revenue-share', 'one-time', 'monthly'].includes(activeUdl?.derivation?.grant ?? '') ||
    ['revenue-share', 'one-time', 'monthly'].includes(activeUdl?.commercialUse?.grant ?? '') ||
    ['one-time', 'monthly'].includes(activeUdl?.dataModelTraining?.grant ?? ''),
  );

  React.useEffect(() => {
    setDraft(wallet.address ? getMintDraft(wallet.address) : null);
  }, [wallet.address]);
  React.useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  React.useEffect(() => {
    const urls = collectionFiles.map((item) => URL.createObjectURL(item));
    setCollectionPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [collectionFiles]);
  React.useEffect(() => {
    setResultReady(false);
    if (!result) return;
    const controller = new AbortController();
    void waitForAssetState(result.id, () => true, {
      signal: controller.signal,
      interval: 4000,
      timeout: 0,
    }).then(
      () => {
        if (!controller.signal.aborted) setResultReady(true);
      },
      () => undefined,
    );
    return () => controller.abort();
  }, [result]);
  React.useEffect(() => {
    if (mode !== 'asset' || !file || !name.trim()) {
      setEstimate(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setEstimating(true);
      setError(null);
      void new AssetMintClient()
        .estimate({ file, name, description, udl: activeUdl }, controller.signal)
        .then(
          (nextEstimate) => {
            if (!controller.signal.aborted) setEstimate(nextEstimate);
          },
          (cause) => {
            if (!controller.signal.aborted) setError(mintErrorMessage(cause));
          },
        )
        .finally(() => {
          if (!controller.signal.aborted) setEstimating(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeUdl, description, file, mode, name]);
  React.useEffect(() => {
    if (mode !== 'collection' || !collectionFiles.length || !name.trim()) {
      setCollectionEstimate(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setEstimating(true);
      setError(null);
      void new CollectionMintClient()
        .estimate({ files: collectionFiles, name, description, udl: activeUdl }, controller.signal)
        .then(
          (nextEstimate) => {
            if (!controller.signal.aborted) setCollectionEstimate(nextEstimate);
          },
          (cause) => {
            if (!controller.signal.aborted) setError(mintErrorMessage(cause));
          },
        )
        .finally(() => {
          if (!controller.signal.aborted) setEstimating(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeUdl, collectionFiles, description, mode, name]);

  const selectFile = (next: File | null) => {
    setFile(next);
    setEstimate(null);
    setAllowHighCost(false);
    setError(null);
    setResult(null);
    if (next && !name.trim()) setName(next.name.replace(/\.[^.]+$/, '').slice(0, 80));
  };
  const selectCollectionFiles = (next: File[]) => {
    setCollectionFiles(next.slice(0, 10));
    setCollectionEstimate(null);
    setAllowHighCost(false);
    setError(next.length > 10 ? 'Collections support up to 10 images at a time.' : null);
    setCollectionResult(null);
  };
  const completeMint = (asset: MintedAsset) => {
    market.addCreatedAsset(asset);
    setResult(asset);
    setDraft(null);
    setPhase(null);
  };
  const mint = async () => {
    if (!wallet.address) {
      wallet.openConnectDialog();
      return;
    }
    if (mode === 'asset' && !file) return setError('Choose an image to continue.');
    if (mode === 'collection' && !collectionFiles.length) return setError('Choose at least one collection image.');
    setError(null);
    setResult(null);
    setCollectionResult(null);
    try {
      if (mode === 'collection') {
        const minted = await new CollectionMintClient().mint(
          { files: collectionFiles, name, description, udl: activeUdl },
          wallet.address,
          { allowHighCost, onPhase: setCollectionPhase },
        );
        market.addCollection(minted.collection);
        setCollectionResult(minted.collection);
        setCollectionPhase(null);
        return;
      }
      if (!file) return;
      const minted = await new AssetMintClient().mint({ file, name, description, udl: activeUdl }, wallet.address, {
        allowHighCost,
        onPhase: setPhase,
      });
      completeMint(minted.asset);
    } catch (cause) {
      setDraft(getMintDraft(wallet.address));
      setPhase(null);
      setError(mintErrorMessage(cause));
    }
  };
  const resume = async () => {
    if (!wallet.address || !draft) return;
    setError(null);
    try {
      const minted = await new AssetMintClient().resume(draft, wallet.address, { onPhase: setPhase });
      completeMint(minted.asset);
    } catch (cause) {
      setPhase(null);
      setError(mintErrorMessage(cause));
    }
  };
  const working = phase !== null || collectionPhase !== null;
  const phaseLabel = collectionPhase
    ? collectionPhase.kind === 'asset'
      ? `Asset ${collectionPhase.index + 1} of ${collectionPhase.total}: ${
          {
            'signing-media': 'approve media upload',
            'uploading-media': 'uploading media',
            'signing-process': 'approve asset process',
            'creating-process': 'creating asset',
          }[collectionPhase.phase]
        }…`
      : `${collectionPhase.kind === 'manifest' ? 'Collection manifest' : 'Collection index'}: ${collectionPhase.phase}…`
    : phase
      ? {
          'signing-media': 'Approve the media upload in your wallet…',
          'uploading-media': 'Uploading media to Arweave…',
          'signing-process': 'Approve the asset process in your wallet…',
          'creating-process': 'Creating your one-of-one asset…',
        }[phase]
      : '';
  const activeEstimate = mode === 'asset' ? estimate : collectionEstimate;

  return (
    <section className="create-page">
      <div className="create-heading">
        <div>
          <p className="eyebrow">Create on Arweave</p>
          <h1>Upload and mint</h1>
        </div>
        <p>
          {mode === 'asset'
            ? 'Your image and its one-of-one marketplace process are signed in your wallet and stored on Arweave.'
            : 'Mint a group of one-of-one assets and submit their shareable collection index to Arweave.'}
        </p>
      </div>

      <div className="create-mode" role="tablist" aria-label="Create type">
        <button
          className={mode === 'asset' ? 'active' : undefined}
          role="tab"
          aria-selected={mode === 'asset'}
          type="button"
          onClick={() => {
            setMode('asset');
            setError(null);
            setAllowHighCost(false);
          }}
        >
          Single asset
        </button>
        <button
          className={mode === 'collection' ? 'active' : undefined}
          role="tab"
          aria-selected={mode === 'collection'}
          type="button"
          onClick={() => {
            setMode('collection');
            setError(null);
            setAllowHighCost(false);
          }}
        >
          Collection
        </button>
      </div>

      {mode === 'asset' && draft ? (
        <div className="mint-recovery" role="status">
          <div>
            <strong>Finish your previous mint</strong>
            <span>
              The media transaction for “{draft.name}” was accepted by the submission gateway. Only the asset process
              remains.
            </span>
          </div>
          <div>
            <button type="button" onClick={() => void resume()} disabled={working}>
              Finish mint
            </button>
            <button
              type="button"
              onClick={() => {
                discardMintDraft(draft.owner);
                setDraft(null);
              }}
              disabled={working}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="create-layout">
        <div className="create-preview-column">
          <button
            className={`mint-dropzone${mode === 'asset' && preview ? ' has-file' : ''}${mode === 'collection' && collectionPreviews.length ? ' has-file collection-files' : ''}`}
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (mode === 'collection') selectCollectionFiles(Array.from(event.dataTransfer.files ?? []));
              else selectFile(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            {mode === 'collection' && collectionPreviews.length ? (
              <span className="collection-preview-grid">
                {collectionPreviews.slice(0, 6).map((url, index) => (
                  <span key={`${collectionFiles[index]?.name}-${index}`}>
                    <img src={url} alt="" />
                    <small>{index + 1}</small>
                  </span>
                ))}
                {collectionPreviews.length > 6 ? <strong>+{collectionPreviews.length - 6}</strong> : null}
              </span>
            ) : mode === 'asset' && preview ? (
              <img src={preview} alt="Asset preview" />
            ) : (
              <span>
                <Upload aria-hidden="true" />
                <strong>{mode === 'asset' ? 'Choose an image' : 'Choose collection images'}</strong>
                <small>
                  PNG, JPG, WebP, or GIF · up to 10 MB each{mode === 'collection' ? ' · 10 images maximum' : ''}
                </small>
              </span>
            )}
          </button>
          <input
            ref={fileInput}
            className="mint-file-input"
            type="file"
            multiple={mode === 'collection'}
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => {
              if (mode === 'collection') selectCollectionFiles(Array.from(event.target.files ?? []));
              else selectFile(event.target.files?.[0] ?? null);
            }}
          />
          {mode === 'asset' && file ? (
            <div className="mint-file-meta">
              <span>{file.name}</span>
              <strong>{formatBytes(file.size)}</strong>
            </div>
          ) : null}
          {mode === 'collection' && collectionFiles.length ? (
            <div className="collection-file-list">
              {collectionFiles.map((item, index) => (
                <div key={`${item.name}-${item.size}-${index}`}>
                  <span>
                    <strong>{index + 1}</strong>
                    {item.name.replace(/\.[^.]+$/, '')}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => selectCollectionFiles(collectionFiles.filter((_, heldIndex) => heldIndex !== index))}
                  >
                    <X className="ui-icon ui-icon--sm" aria-hidden="true" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => fileInput.current?.click()}>
                <Upload className="ui-icon ui-icon--sm" aria-hidden="true" /> Add images
              </button>
            </div>
          ) : null}
        </div>

        <form
          className="create-form"
          onSubmit={(event) => {
            event.preventDefault();
            void mint();
          }}
        >
          <div className="create-field">
            <label htmlFor="mint-name">{mode === 'asset' ? 'Name' : 'Collection name'}</label>
            <input
              id="mint-name"
              maxLength={80}
              placeholder={mode === 'asset' ? 'Name your asset' : 'Name your collection'}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <span>{name.length} / 80</span>
          </div>
          <div className="create-field">
            <label htmlFor="mint-description">
              {mode === 'asset' ? 'Description' : 'Collection description'} <small>Optional</small>
            </label>
            <textarea
              id="mint-description"
              maxLength={600}
              placeholder={mode === 'asset' ? 'Tell collectors about this work' : 'Describe this collection'}
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <span>{description.length} / 600</span>
          </div>

          <section className="create-license" aria-labelledby="mint-license-heading">
            <div className="create-license-heading">
              <div>
                <strong id="mint-license-heading">Usage rights</strong>
                <span>
                  Attach machine-readable terms stored with {mode === 'asset' ? 'this asset' : 'every asset'} on
                  Arweave.
                </span>
              </div>
              <MarketSelect<'udl' | 'none'>
                label="License"
                value={udlEnabled ? 'udl' : 'none'}
                options={[
                  { value: 'udl', label: 'Universal Data License 0.2' },
                  { value: 'none', label: 'No license tags' },
                ]}
                onChange={(value) => {
                  setUdlEnabled(value === 'udl');
                  setEstimate(null);
                  setCollectionEstimate(null);
                  setError(null);
                }}
                showLabel={false}
              />
            </div>

            {udlEnabled ? (
              <div className="udl-options">
                <p>
                  Free access is the default. Rights not granted below remain reserved.{' '}
                  <a href={`https://arweave.net/${UDL_LICENSE_ID}`} target="_blank" rel="noreferrer">
                    Read UDL 0.2 <ArrowUpRight className="ui-icon ui-icon--sm" aria-hidden="true" />
                  </a>
                </p>
                <div className="udl-grid">
                  <div className="udl-field">
                    <div className={udlTerms.accessFee ? 'udl-field-control with-value' : 'udl-field-control'}>
                      <MarketSelect<'free' | 'one-time'>
                        label="Access"
                        value={udlTerms.accessFee ? 'one-time' : 'free'}
                        options={[
                          { value: 'free', label: 'Free' },
                          { value: 'one-time', label: 'One-time fee' },
                        ]}
                        onChange={(value) =>
                          setUdlTerms((current) => ({
                            ...current,
                            accessFee: value === 'one-time' ? '1' : undefined,
                          }))
                        }
                      />
                      {udlTerms.accessFee ? (
                        <label className="udl-value">
                          <span>Amount</span>
                          <input
                            aria-label="Access fee amount"
                            inputMode="decimal"
                            min="0.000000000001"
                            step="any"
                            type="number"
                            value={udlTerms.accessFee}
                            onChange={(event) =>
                              setUdlTerms((current) => ({ ...current, accessFee: event.target.value || '1' }))
                            }
                          />
                        </label>
                      ) : null}
                    </div>
                  </div>
                  <UdlGrantField
                    label="Derivatives"
                    value={udlTerms.derivation}
                    options={[
                      ['allowed', 'Allowed'],
                      ['credit', 'Allowed with credit'],
                      ['indication', 'Allowed with change indication'],
                      ['license-passthrough', 'Allowed with license passthrough'],
                      ['revenue-share', 'Allowed with revenue share'],
                      ['one-time', 'Allowed with one-time fee'],
                      ['monthly', 'Allowed with monthly fee'],
                    ]}
                    onChange={(value) =>
                      setUdlTerms((current) => ({ ...current, derivation: value as UdlTerms['derivation'] }))
                    }
                  />
                  <UdlGrantField
                    label="Commercial use"
                    value={udlTerms.commercialUse}
                    options={[
                      ['allowed', 'Allowed'],
                      ['credit', 'Allowed with credit'],
                      ['revenue-share', 'Allowed with revenue share'],
                      ['one-time', 'Allowed with one-time fee'],
                      ['monthly', 'Allowed with monthly fee'],
                    ]}
                    onChange={(value) =>
                      setUdlTerms((current) => ({ ...current, commercialUse: value as UdlTerms['commercialUse'] }))
                    }
                  />
                  <UdlGrantField
                    label="AI model training"
                    value={udlTerms.dataModelTraining}
                    options={[
                      ['allowed', 'Allowed'],
                      ['one-time', 'Allowed with one-time fee'],
                      ['monthly', 'Allowed with monthly fee'],
                    ]}
                    onChange={(value) =>
                      setUdlTerms((current) => ({
                        ...current,
                        dataModelTraining: value as UdlTerms['dataModelTraining'],
                      }))
                    }
                  />
                </div>

                {hasUdlPayment ? (
                  <div className="udl-payment">
                    <div className="udl-field">
                      <div className="udl-field-control">
                        <MarketSelect<'U' | 'AR'>
                          label="Payment currency"
                          value={udlTerms.currency ?? 'U'}
                          options={[
                            { value: 'U', label: '$U (UDL default)' },
                            { value: 'AR', label: 'AR' },
                          ]}
                          onChange={(value) =>
                            setUdlTerms((current) => ({
                              ...current,
                              currency: value === 'AR' ? 'AR' : undefined,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="udl-field udl-address">
                      <label htmlFor="udl-payment-address">Payment address</label>
                      <div className="udl-field-control">
                        <input
                          id="udl-payment-address"
                          maxLength={43}
                          placeholder={wallet.address || 'Uploader wallet by default'}
                          value={udlTerms.paymentAddress ?? ''}
                          onChange={(event) =>
                            setUdlTerms((current) => ({
                              ...current,
                              paymentAddress: event.target.value.trim() || undefined,
                            }))
                          }
                        />
                      </div>
                    </div>
                    {udlTerms.paymentAddress && udlTerms.paymentAddress !== wallet.address ? (
                      <p className="udl-payment-warning">
                        License payments will go to this address, not the connected wallet.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <details className="udl-advanced">
                  <summary>Advanced terms</summary>
                  <div className="udl-grid">
                    <div className="udl-field">
                      <div className="udl-field-control">
                        <MarketSelect<'included' | 'excluded'>
                          label="Unknown usage rights"
                          value={udlTerms.unknownUsageRights ?? 'included'}
                          options={[
                            { value: 'included', label: 'Included when legally available' },
                            { value: 'excluded', label: 'Excluded' },
                          ]}
                          onChange={(value) =>
                            setUdlTerms((current) => ({
                              ...current,
                              unknownUsageRights: value === 'excluded' ? 'excluded' : undefined,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="udl-field">
                      <label htmlFor="udl-expiry">License term</label>
                      <div className="udl-field-control with-suffix">
                        <input
                          id="udl-expiry"
                          inputMode="numeric"
                          min="1"
                          placeholder="Unlimited"
                          step="1"
                          type="number"
                          value={udlTerms.expiry ?? ''}
                          onChange={(event) =>
                            setUdlTerms((current) => ({ ...current, expiry: event.target.value || undefined }))
                          }
                        />
                        <span>years</span>
                      </div>
                    </div>
                    {hasUdlPayment ? (
                      <div className="udl-field">
                        <div className="udl-field-control">
                          <MarketSelect<'direct' | 'random' | 'global'>
                            label="Payment mode"
                            value={udlTerms.paymentMode ?? 'direct'}
                            options={[
                              { value: 'direct', label: 'Direct to payment address' },
                              { value: 'random', label: 'Random PST distribution' },
                              { value: 'global', label: 'Global PST distribution' },
                            ]}
                            onChange={(value) =>
                              setUdlTerms((current) => ({
                                ...current,
                                paymentMode: value === 'random' || value === 'global' ? value : undefined,
                              }))
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </details>
              </div>
            ) : (
              <p className="udl-none">No license metadata will be written. Copyright defaults still apply.</p>
            )}
          </section>

          <div className="mint-summary">
            <div>
              <span>{mode === 'asset' ? 'Edition' : 'Assets'}</span>
              <strong>{mode === 'asset' ? '1 of 1' : collectionFiles.length || '—'}</strong>
            </div>
            <div>
              <span>{mode === 'asset' ? 'Storage target' : 'Transactions'}</span>
              <strong>
                {mode === 'asset' ? 'Arweave' : collectionEstimate ? collectionEstimate.transactionCount : '—'}
              </strong>
            </div>
            <div>
              <span>Estimated network cost</span>
              <strong>
                {estimating ? 'Checking…' : activeEstimate ? `${winstonToAr(activeEstimate.total.toString())} AR` : '—'}
              </strong>
            </div>
          </div>

          {activeEstimate && isHighMintCost(activeEstimate.total) ? (
            <label className="mint-cost-confirmation">
              <input
                type="checkbox"
                checked={allowHighCost}
                onChange={(event) => setAllowHighCost(event.target.checked)}
              />
              I approve this unusually high network cost.
            </label>
          ) : null}
          <div className="mint-notice">
            <Info className="ui-icon" aria-hidden="true" />
            <span>
              {mode === 'asset'
                ? 'Your wallet will request two signatures: one for the media and one for the tradeable asset.'
                : collectionEstimate
                  ? `Your wallet will request ${collectionEstimate.transactionCount} signatures: two per asset, then the collection manifest and index.`
                  : 'Each image becomes a one-of-one asset. Bazar then submits a collection manifest and index to Arweave.'}
            </span>
          </div>
          {error ? (
            <div className="inline-error">
              <span>{error}</span>
            </div>
          ) : null}
          {result || collectionResult ? (
            <div className={`mint-success${result && !resultReady ? ' propagating' : ''}`}>
              <span>{result && !resultReady ? <InfinityIcon aria-hidden="true" /> : <Check aria-hidden="true" />}</span>
              <div>
                <strong>
                  {collectionResult
                    ? 'Collection transactions accepted by submission gateway'
                    : 'Mint transactions accepted by submission gateway'}
                </strong>
                <p>
                  {collectionResult
                    ? 'Gateway availability can vary while the collection transactions are mined and indexed.'
                    : resultReady
                      ? 'The asset is live and computable through the selected gateway.'
                      : 'Watching while this page remains open. You can view the asset as soon as its live state resolves.'}
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(result && !resultReady)}
                onClick={() =>
                  navigate(
                    collectionResult
                      ? `/collection/${collectionResult.id}`
                      : `/asset/${CREATED_COLLECTION_ID}/${result!.id}`,
                  )
                }
              >
                {result && !resultReady ? (
                  <>
                    Watching Arweave <InfinityIcon className="ui-icon ui-icon--sm" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    View {collectionResult ? 'collection' : 'asset'}{' '}
                    <ArrowRight className="ui-icon ui-icon--sm" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              className="mint-submit"
              type="submit"
              disabled={
                working ||
                Boolean(wallet.address && mode === 'asset' && file && name.trim() && !estimate) ||
                Boolean(
                  wallet.address &&
                  mode === 'collection' &&
                  collectionFiles.length &&
                  name.trim() &&
                  !collectionEstimate,
                ) ||
                Boolean(wallet.address && activeEstimate && isHighMintCost(activeEstimate.total) && !allowHighCost)
              }
            >
              {working
                ? phaseLabel
                : wallet.address
                  ? mode === 'asset'
                    ? 'Upload and mint'
                    : 'Mint collection'
                  : 'Connect wallet to create'}
              {!working ? <ArrowRight className="ui-icon" aria-hidden="true" /> : null}
            </button>
          )}
          <p className="mint-permanence">
            Confirmed Arweave uploads are permanent and cannot be edited. Review every image, name, and description
            before signing.
          </p>
        </form>
      </div>
    </section>
  );
}

function MyAssetsView() {
  const market = React.useContext(MarketContext);
  const wallet = useWallet();
  const gateway = servingNodeOrigin(window.location);
  const [retry, setRetry] = React.useState(0);
  const [discoveryRetry, setDiscoveryRetry] = React.useState(0);
  const [failedRetry, setFailedRetry] = React.useState(0);
  const failedCandidates = React.useRef(new Map<string, AssetCandidate>());
  const supportFailures = React.useRef(new Map<string, CandidateSupportFailure>());
  const computeRateLimits = React.useRef(new Set<string>());
  const indexRateLimits = React.useRef(new Set<string>());
  const discoverySession = React.useRef<WalletDiscoverySession>();
  const walletAnnouncementProgress = React.useRef<WalletAnnouncementProgress>({
    scope: '',
    discovered: 0,
    revalidated: 0,
  });
  const [results, setResults] = React.useState<ResolvedAsset[]>([]);
  const [storedStatus, setStatus] = React.useState<WalletResolutionStatus>(initialWalletResolutionStatus);
  const discoveryScope = wallet.address ? walletDiscoveryScope(wallet.address, gateway, market.collections) : '';
  const requestedSessionScope = discoveryScope ? `${discoveryScope}|refresh:${retry}` : '';
  const sessionIsCurrent = walletDiscoverySessionIsCurrent(discoverySession.current, requestedSessionScope);
  const visibleResults = sessionIsCurrent ? results : [];
  const status = sessionIsCurrent ? storedStatus : initialWalletResolutionStatus();
  const groupedResults = React.useMemo(
    () => (wallet.address ? groupWalletResults(visibleResults, wallet.address) : { owned: [], listed: [] }),
    [visibleResults, wallet.address],
  );
  const retryDiscovery = () => {
    setDiscoveryRetry((value) => value + 1);
  };
  const retryUnavailableAssets = () => {
    setFailedRetry((value) => value + 1);
  };
  const refreshAssets = () => {
    setRetry((value) => value + 1);
  };
  React.useEffect(() => {
    if (!wallet.address || market.loading || market.error) return;
    const controller = new AbortController();
    const walletAddress = wallet.address;
    const scope = requestedSessionScope;
    const previousSession = discoverySession.current;
    const session = walletDiscoverySession(previousSession, scope, walletAddress);
    const reset = session !== previousSession;
    discoverySession.current = session;
    const active = () => !controller.signal.aborted && discoverySession.current === session;
    let renderFrame: number | undefined;
    const flushResults = () => {
      renderFrame = undefined;
      if (!active()) return;
      setResults(
        [...session.resolvedAssets.values()].sort(
          (a, b) => b.activity.height - a.activity.height || b.activity.timestamp - a.activity.timestamp,
        ),
      );
    };
    const scheduleResults = () => {
      if (renderFrame === undefined) renderFrame = window.requestAnimationFrame(flushResults);
    };
    if (reset) {
      failedCandidates.current.clear();
      supportFailures.current.clear();
      computeRateLimits.current.clear();
      indexRateLimits.current.clear();
      setResults([]);
      setStatus(initialWalletResolutionStatus());
    } else {
      setStatus((current) => ({ ...current, phase: 'discovering', error: null }));
      scheduleResults();
    }
    void (async () => {
      try {
        const resolvePage = async (page: AssetCandidate[]) => {
          let reopened = 0;
          let reopenedFailures = 0;
          let reopenedIndexFailures = 0;
          let reopenedRateLimits = 0;
          let reopenedIndexRateLimits = 0;
          for (const candidate of page) {
            const wasComputeFailure = failedCandidates.current.has(candidate.processId);
            const wasIndexFailure = supportFailures.current.has(candidate.processId);
            const wasComputeRateLimited = computeRateLimits.current.has(candidate.processId);
            const wasIndexRateLimited = indexRateLimits.current.has(candidate.processId);
            const refresh = reopenWalletCandidate(session, candidate);
            if (refresh.completed) {
              reopened += 1;
              reopenedFailures += Number(wasComputeFailure || wasIndexFailure);
              reopenedIndexFailures += Number(wasIndexFailure);
              reopenedRateLimits += Number(wasComputeRateLimited || wasIndexRateLimited);
              reopenedIndexRateLimits += Number(wasIndexRateLimited);
            }
            if (refresh.reopened) {
              failedCandidates.current.delete(candidate.processId);
              supportFailures.current.delete(candidate.processId);
              computeRateLimits.current.delete(candidate.processId);
              indexRateLimits.current.delete(candidate.processId);
              if (refresh.removedResult) scheduleResults();
            }
            session.latestCandidates.set(candidate.processId, candidate);
            refreshCandidateRetryMetadata(candidate, failedCandidates.current, supportFailures.current);
            const existing = session.resolvedAssets.get(candidate.processId);
            if (existing) {
              session.resolvedAssets.set(candidate.processId, { ...existing, activity: candidate });
              scheduleResults();
            }
          }
          if (reopened && active()) {
            setStatus((current) => ({
              ...current,
              resolved: Math.max(0, current.resolved - reopened),
              failures: Math.max(0, current.failures - reopenedFailures),
              indexFailures: Math.max(0, current.indexFailures - reopenedIndexFailures),
              rateLimited: Math.max(0, current.rateLimited - reopenedRateLimits),
              indexRateLimited: Math.max(0, current.indexRateLimited - reopenedIndexRateLimits),
            }));
          }
          const unchecked = page.filter((candidate) => !session.screened.has(candidate.processId));
          const { supported, unverified } = partitionAssetCandidateSupport(unchecked, market.collections);
          const candidates = [...supported, ...unverified];
          const candidateIds = new Set(candidates.map((candidate) => candidate.processId));
          for (const candidate of unchecked) {
            if (!candidateIds.has(candidate.processId)) session.screened.add(candidate.processId);
          }
          const newlyCounted = candidates.filter((candidate) => !session.counted.has(candidate.processId));
          for (const candidate of newlyCounted) session.counted.add(candidate.processId);
          if (active()) {
            setStatus((current) => ({
              ...current,
              phase: candidates.length ? 'resolving' : current.phase,
              discovered: session.latestCandidates.size,
              total: current.total + newlyCounted.length,
            }));
          }
          const resolveSupported = (supportedCandidates: AssetCandidate[]) =>
            resolveAssetCandidates(supportedCandidates, market.collections, {
              signal: controller.signal,
              read: (processId, signal) =>
                readAssetState(processId, {
                  signal,
                  maxAge: walletResolutionMaxAge(retry),
                }),
              onSettled: (result, candidate, error) => {
                if (!active()) return;
                session.screened.add(candidate.processId);
                session.completed.add(candidate.processId);
                if (error) failedCandidates.current.set(candidate.processId, candidate);
                else failedCandidates.current.delete(candidate.processId);
                trackRateLimitFailure(computeRateLimits.current, candidate.processId, error);
                setStatus((current) => ({
                  ...current,
                  resolved: current.resolved + 1,
                  failures: current.failures + (error ? 1 : 0),
                  rateLimited:
                    current.rateLimited + (error && marketplaceFailureKind(error) === 'rate-limited' ? 1 : 0),
                }));
                if (!error && updateWalletResolvedAsset(session, result, candidate, walletAddress)) {
                  scheduleResults();
                }
              },
            });
          const verifyUnindexed = async () => {
            if (!unverified.length) return;
            const verification = await verifyAssetCandidateSupport(unverified, market.collections, {
              signal: controller.signal,
            });
            if (!active()) return;
            for (const candidate of unverified) supportFailures.current.delete(candidate.processId);
            for (const failure of verification.unavailable) {
              supportFailures.current.set(failure.candidate.processId, failure);
              trackRateLimitFailure(indexRateLimits.current, failure.candidate.processId, failure.error);
            }
            for (const candidate of unverified) {
              if (!supportFailures.current.has(candidate.processId))
                indexRateLimits.current.delete(candidate.processId);
            }
            const verifiedIds = new Set(verification.supported.map((candidate) => candidate.processId));
            for (const candidate of unverified) {
              if (!verifiedIds.has(candidate.processId)) session.screened.add(candidate.processId);
            }
            const checkedWithoutCompute = unverified.length - verification.supported.length;
            const rateLimited = verification.unavailable.filter(
              (failure) => marketplaceFailureKind(failure.error) === 'rate-limited',
            ).length;
            if (checkedWithoutCompute && active()) {
              for (const candidate of unverified) {
                if (!verifiedIds.has(candidate.processId)) session.completed.add(candidate.processId);
              }
              setStatus((current) => ({
                ...current,
                resolved: current.resolved + checkedWithoutCompute,
                failures: current.failures + verification.unavailable.length,
                indexFailures: current.indexFailures + verification.unavailable.length,
                rateLimited: current.rateLimited + rateLimited,
                indexRateLimited: current.indexRateLimited + rateLimited,
              }));
            }
            await resolveSupported(verification.supported);
          };
          await Promise.all([resolveSupported(supported), verifyUnindexed()]);
        };
        const pageQueue = walletPageResolutionQueue(resolvePage, controller.signal);
        const pendingCandidates = [...session.latestCandidates.values()].filter(
          (candidate) => !session.screened.has(candidate.processId),
        );
        if (pendingCandidates.length) await resolvePage(pendingCandidates);
        const discoveredCandidates = await discoverWalletAssetCandidates(walletAddress, {
          signal: controller.signal,
          scan: session.scan,
          catchUp: true,
          onPage: (page) => pageQueue.push(page),
        });
        if (!active()) return;
        await pageQueue.drain();
        await resolvePage(discoveredCandidates.filter((candidate) => !session.screened.has(candidate.processId)));
        const revalidationCandidates = [...session.resolvedAssets.keys()]
          .map((processId) => session.latestCandidates.get(processId))
          .filter((candidate): candidate is AssetCandidate => Boolean(candidate));
        if (revalidationCandidates.length && active()) {
          setStatus((current) => ({
            ...current,
            phase: 'revalidating',
            discoveryComplete: true,
            revalidated: 0,
            revalidationTotal: revalidationCandidates.length,
          }));
          await resolveAssetCandidates(revalidationCandidates, market.collections, {
            signal: controller.signal,
            read: (processId, signal) => readAssetState(processId, { signal, maxAge: 0 }),
            onSettled: (result, candidate, error) => {
              if (!active()) return;
              if (error) failedCandidates.current.set(candidate.processId, candidate);
              else failedCandidates.current.delete(candidate.processId);
              trackRateLimitFailure(computeRateLimits.current, candidate.processId, error);
              if (error) {
                if (session.resolvedAssets.delete(candidate.processId)) scheduleResults();
              } else if (updateWalletResolvedAsset(session, result, candidate, walletAddress)) {
                scheduleResults();
              }
              setStatus((current) => ({
                ...current,
                revalidated: (current.revalidated ?? 0) + 1,
                failures: current.failures + (error ? 1 : 0),
                rateLimited: current.rateLimited + (error && marketplaceFailureKind(error) === 'rate-limited' ? 1 : 0),
              }));
            },
          });
        }
        if (active()) {
          session.complete = true;
          if (renderFrame !== undefined) window.cancelAnimationFrame(renderFrame);
          flushResults();
          setStatus((current) => ({
            ...current,
            phase: 'done',
            discoveryComplete: true,
            discovered: session.latestCandidates.size,
            revalidated: undefined,
            revalidationTotal: undefined,
          }));
        }
      } catch (cause) {
        if (active()) {
          setStatus((current) => ({
            ...current,
            phase: 'error',
            error: marketplaceRequestFailureMessage('index', marketplaceFailureKind(cause)),
          }));
        }
      }
    })();
    return () => {
      controller.abort();
      if (renderFrame !== undefined) window.cancelAnimationFrame(renderFrame);
    };
  }, [discoveryRetry, discoveryScope, gateway, market.error, market.loading, retry, wallet.address]);
  React.useEffect(() => {
    if (
      !failedRetry ||
      !wallet.address ||
      market.loading ||
      market.error ||
      (!failedCandidates.current.size && !supportFailures.current.size)
    )
      return;
    const controller = new AbortController();
    const session = discoverySession.current;
    if (!walletDiscoverySessionIsCurrent(session, requestedSessionScope)) return;
    const active = () => !controller.signal.aborted && discoverySession.current === session;
    const walletAddress = wallet.address;
    const candidates = [...failedCandidates.current.values()];
    const unverified = [...supportFailures.current.values()].map(({ candidate }) => candidate);
    const retryCount = candidates.length + unverified.length;
    const retryComputeRateLimits = candidates.filter((candidate) =>
      computeRateLimits.current.has(candidate.processId),
    ).length;
    const retryIndexRateLimits = unverified.filter((candidate) =>
      indexRateLimits.current.has(candidate.processId),
    ).length;
    setStatus((current) => ({
      ...current,
      phase: 'resolving',
      discoveryComplete: true,
      resolved: Math.max(0, current.resolved - retryCount),
      failures: Math.max(0, current.failures - retryCount),
      indexFailures: Math.max(0, current.indexFailures - unverified.length),
      rateLimited: Math.max(0, current.rateLimited - retryComputeRateLimits - retryIndexRateLimits),
      indexRateLimited: Math.max(0, current.indexRateLimited - retryIndexRateLimits),
      error: null,
    }));
    const resolveFailed = (failed: AssetCandidate[]) =>
      resolveAssetCandidates(failed, market.collections, {
        signal: controller.signal,
        onSettled: (result, candidate, error) => {
          if (!active()) return;
          if (error) failedCandidates.current.set(candidate.processId, candidate);
          else failedCandidates.current.delete(candidate.processId);
          trackRateLimitFailure(computeRateLimits.current, candidate.processId, error);
          if (!error) updateWalletResolvedAsset(session, result, candidate, walletAddress);
          setStatus((current) => ({
            ...current,
            resolved: current.resolved + 1,
            failures: current.failures + (error ? 1 : 0),
            rateLimited: current.rateLimited + (error && marketplaceFailureKind(error) === 'rate-limited' ? 1 : 0),
          }));
        },
      });
    const retryUnavailable = async () => {
      const verification = unverified.length
        ? await verifyAssetCandidateSupport(unverified, market.collections, { signal: controller.signal })
        : { supported: [], unavailable: [] };
      if (!active()) return;
      for (const candidate of unverified) supportFailures.current.delete(candidate.processId);
      for (const failure of verification.unavailable) {
        supportFailures.current.set(failure.candidate.processId, failure);
        trackRateLimitFailure(indexRateLimits.current, failure.candidate.processId, failure.error);
      }
      for (const candidate of unverified) {
        if (!supportFailures.current.has(candidate.processId)) indexRateLimits.current.delete(candidate.processId);
      }
      const checkedWithoutCompute = unverified.length - verification.supported.length;
      const rateLimited = verification.unavailable.filter(
        (failure) => marketplaceFailureKind(failure.error) === 'rate-limited',
      ).length;
      if (checkedWithoutCompute && active()) {
        setStatus((current) => ({
          ...current,
          resolved: current.resolved + checkedWithoutCompute,
          failures: current.failures + verification.unavailable.length,
          indexFailures: current.indexFailures + verification.unavailable.length,
          rateLimited: current.rateLimited + rateLimited,
          indexRateLimited: current.indexRateLimited + rateLimited,
        }));
      }
      await resolveFailed([...candidates, ...verification.supported]);
    };
    void retryUnavailable().then(
      () => {
        if (!active()) return;
        setResults(
          [...session.resolvedAssets.values()].sort(
            (a, b) => b.activity.height - a.activity.height || b.activity.timestamp - a.activity.timestamp,
          ),
        );
        setStatus((current) => ({
          ...current,
          phase: 'done',
          failures: failedCandidates.current.size + supportFailures.current.size,
          indexFailures: supportFailures.current.size,
          rateLimited: computeRateLimits.current.size + indexRateLimits.current.size,
          indexRateLimited: indexRateLimits.current.size,
        }));
      },
      (cause) => {
        if (active()) {
          setStatus((current) => ({ ...current, phase: 'error', error: errorMessage(cause) }));
        }
      },
    );
    return () => controller.abort();
  }, [failedRetry, gateway, market.collections, market.error, market.loading, requestedSessionScope, wallet.address]);

  if (!wallet.address) {
    return (
      <section className="my-assets-page">
        <p className="eyebrow">Your wallet</p>
        <h1>My assets</h1>
        <div className="empty-state">
          <h3>Connect a wallet to resolve its assets</h3>
          <p>No signature is requested. Candidate history and live state are read-only.</p>
          <ConnectWalletButton />
        </div>
      </section>
    );
  }
  if (market.loading && !market.collections.length) {
    return (
      <RouteState title="My assets">
        <Loading label="Reading the supported asset collections from Arweave…" />
      </RouteState>
    );
  }
  if (market.error) {
    return (
      <section className="my-assets-page">
        <p className="eyebrow">Live wallet inventory</p>
        <h1>My assets</h1>
        <ErrorPanel message={market.error} onRetry={market.retry} retryLabel="Retry asset index" />
      </section>
    );
  }
  const { owned, listed } = groupedResults;
  const working = status.phase === 'discovering' || status.phase === 'resolving' || status.phase === 'revalidating';
  const computeRateLimited = status.rateLimited - status.indexRateLimited;
  const computeFailures = status.failures - status.indexFailures;
  const aggregateFailureMessage = [
    status.indexFailures
      ? marketplaceRequestFailureMessage('index', status.indexRateLimited ? 'rate-limited' : 'unavailable')
      : '',
    computeFailures
      ? marketplaceRequestFailureMessage('compute', computeRateLimited ? 'rate-limited' : 'unavailable')
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  walletAnnouncementProgress.current = nextWalletAnnouncementProgress(
    walletAnnouncementProgress.current,
    status,
    requestedSessionScope,
  );
  const resolutionCopy = walletResolutionCopy(
    {
      ...status,
      discovered: walletAnnouncementProgress.current.discovered,
      revalidated: walletAnnouncementProgress.current.revalidated,
    },
    aggregateFailureMessage,
  );
  return (
    <section className="my-assets-page">
      <div className="my-assets-heading">
        <div>
          <p className="eyebrow">Live wallet inventory</p>
          <h1>My assets</h1>
          <p>Your assets, read from live Arweave state.</p>
          <span className="gateway-pill">
            <Server className="ui-icon ui-icon--xs" aria-hidden="true" /> Gateway{' '}
            <span className="gateway-pill-host" title={new URL(gateway).host}>
              {new URL(gateway).host}
            </span>
          </span>
        </div>
        {status.phase !== 'error' ? (
          <button className="with-icon" onClick={refreshAssets} disabled={working}>
            <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />
            {working ? 'Resolving…' : 'Refresh assets'}
          </button>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite" role="status">
        {resolutionCopy.announcement}
      </p>
      {status.error ? (
        <div className="inline-error">
          <span role="alert">{status.error}</span>
          <div className="inline-error-actions">
            <button className="with-icon" onClick={retryDiscovery}>
              <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry from checkpoint
            </button>
            <button onClick={refreshAssets}>Restart discovery</button>
          </div>
        </div>
      ) : null}
      {!status.error && status.phase === 'done' && status.failures && status.failures < status.total ? (
        <div className="inline-error">
          <span role="status">
            {aggregateFailureMessage} {status.failures.toLocaleString()}{' '}
            {status.failures === 1 ? 'candidate remains' : 'candidates remain'} unavailable. Resolved assets remain
            visible.
          </span>
          <button className="with-icon" type="button" onClick={retryUnavailableAssets}>
            <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
            {status.rateLimited ? 'Retry later' : 'Retry unavailable'}
          </button>
        </div>
      ) : null}
      <AssetGroup
        title="Listed for sale"
        results={listed}
        badge="For sale"
        address={wallet.address}
        group="listed"
        settled={status.phase === 'done'}
      />
      <AssetGroup
        title="Owned"
        results={owned}
        badge="Owned"
        address={wallet.address}
        group="owned"
        settled={status.phase === 'done'}
      />
      {status.phase === 'done' && !visibleResults.length ? (
        <div className="empty-state">
          <h3>
            {status.failures
              ? 'Ownership could not be checked'
              : 'No indexed candidates currently resolve to your ownership'}
          </h3>
          <p>
            {status.failures
              ? `${aggregateFailureMessage} ${status.failures} of ${status.total} candidates could not be checked. Retry them before treating this as an empty wallet.`
              : 'Arweave GraphQL discovers candidates and can lag behind new transactions. Refresh after indexing; live state remains authoritative for every candidate found.'}
          </p>
          {status.failures ? (
            <button className="with-icon" type="button" onClick={retryUnavailableAssets}>
              <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
              {status.rateLimited ? 'Retry later' : 'Retry unavailable assets'}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function retainedAssetGroupLimit(current: number, pageSize: number) {
  return Math.max(current, pageSize);
}

export function assetGroupRevealComplete(nextLimit: number, resultCount: number) {
  return nextLimit >= resultCount;
}

export function assetGroupRevealAnnouncement(nextLimit: number, resultCount: number, assetLabel: string) {
  return assetGroupRevealComplete(nextLimit, resultCount)
    ? `All ${resultCount.toLocaleString()} ${assetLabel} are shown.`
    : `Showing ${nextLimit.toLocaleString()} of ${resultCount.toLocaleString()} ${assetLabel}.`;
}

const AssetGroup = React.memo(function AssetGroup({
  title,
  results,
  badge,
  address,
  group,
  settled,
}: {
  title: string;
  results: ResolvedAsset[];
  badge: string;
  address: string;
  group: 'owned' | 'listed';
  settled: boolean;
}) {
  const pageSize = useProgressiveAssetPageSize();
  const [limit, setLimit] = React.useState(pageSize);
  const gridId = React.useId();
  const resultSummaryRef = React.useRef<HTMLParagraphElement>(null);
  const resultCountRef = React.useRef(results.length);
  const [revealAnnouncement, setRevealAnnouncement] = React.useState('');
  resultCountRef.current = results.length;
  const assetLabel = group === 'owned' ? 'owned assets' : 'listed assets';
  React.useEffect(() => {
    setLimit(pageSize);
    setRevealAnnouncement('');
  }, [address, group]);
  React.useEffect(() => setLimit((current) => retainedAssetGroupLimit(current, pageSize)), [pageSize]);
  return (
    <section className="asset-group">
      <div className="asset-group-title">
        <h2 aria-label={`${title}, ${results.length.toLocaleString()}`}>{title}</h2>
        <span aria-hidden="true">{results.length.toLocaleString()}</span>
      </div>
      {results.length ? (
        <>
          <div className="asset-grid" id={gridId}>
            {results.slice(0, limit).map((result) => (
              <AssetCard
                key={result.asset.id}
                collection={result.collection}
                asset={result.asset}
                badge={badge}
                price={
                  result.collection.kind === 'tokens'
                    ? `${tokenBalanceLabel(
                        group === 'owned'
                          ? liquidBalanceOf(result.state, address)
                          : listedBalanceOf(result.state, address),
                        result.state,
                      )} ${group === 'owned' ? 'liquid' : 'listed'}`
                    : undefined
                }
              />
            ))}
          </div>
          <p
            className={
              results.length > pageSize && limit >= results.length
                ? 'collection-result-count reveal-complete'
                : 'sr-only'
            }
            ref={resultSummaryRef}
            tabIndex={-1}
          >
            {results.length > pageSize && limit >= results.length
              ? `All ${results.length.toLocaleString()} ${assetLabel} are shown.`
              : `Showing ${Math.min(limit, results.length).toLocaleString()} of ${results.length.toLocaleString()} ${assetLabel}.`}
          </p>
          <span aria-live="polite" className="sr-only" role="status">
            {revealAnnouncement}
          </span>
        </>
      ) : (
        <p className="asset-group-empty">{settled ? `No ${assetLabel}.` : `No ${assetLabel} loaded yet.`}</p>
      )}
      {results.length && limit < results.length ? (
        <button
          aria-controls={gridId}
          className="load-more"
          onClick={() => {
            const nextLimit = Math.min(results.length, limit + pageSize);
            setLimit(nextLimit);
            setRevealAnnouncement(assetGroupRevealAnnouncement(nextLimit, results.length, assetLabel));
            window.requestAnimationFrame(() => {
              if (assetGroupRevealComplete(nextLimit, resultCountRef.current)) {
                resultSummaryRef.current?.focus();
              }
            });
          }}
        >
          Show {Math.min(pageSize, results.length - limit).toLocaleString()} more {assetLabel}
        </button>
      ) : null}
    </section>
  );
});

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
  const kind = collection?.kind ?? (collectionId === 'fungible-tokens' ? 'tokens' : 'names');
  const detailClass = kind === 'tokens' ? 'fungible-asset-page' : 'atomic-asset-page';
  const collectionName = collection?.name ?? (kind === 'tokens' ? 'Fungible tokens' : 'Arweave names');

  if (kind === 'tokens') {
    return (
      <section className="asset-page asset-detail-page asset-detail-loading-shell fungible-asset-page">
        <header className="fungible-token-header">
          <div className="fungible-token-avatar" aria-hidden="true">
            {asset?.image ? (
              <ArtworkImage src={asset.image} alt="" loading="eager" />
            ) : asset ? (
              <TokenArtwork ticker={asset.ticker ?? asset.name} />
            ) : (
              <span className="layout-placeholder" />
            )}
          </div>
          <div className="fungible-token-identity">
            <div className="fungible-token-title">
              {asset ? <h1>{asset.name}</h1> : <span className="layout-placeholder layout-placeholder-title" />}
              {asset?.ticker ? <strong>{asset.ticker}</strong> : null}
            </div>
            <div className="fungible-token-meta" aria-hidden="true">
              {collection ? (
                <Link to={`/collection/${collection.id}`}>{collectionName}</Link>
              ) : (
                <span>{collectionName}</span>
              )}
              <span>token@1.0</span>
              <span>Token</span>
            </div>
          </div>
          <div className="fungible-token-balance">
            <span>Loading market state</span>
          </div>
        </header>
        {error ? (
          <ErrorPanel message={error} onRetry={onRetry} retryLabel="Retry live state" />
        ) : (
          <div aria-live="polite" className="state-verification asset-loading-verification" role="status">
            <span aria-hidden="true" /> Computing current state…
          </div>
        )}
        <div className="asset-detail-layout">
          <div className="asset-commerce-column asset-commerce-primary">
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
          <div className="asset-commerce-column asset-commerce-secondary">
            <nav aria-hidden="true" className="home-market-tabs asset-detail-tabs asset-section-tabs-loading">
              <span>Orders</span>
              <span>Details</span>
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
            {asset ? <h1>{asset.name}</h1> : <span className="layout-placeholder layout-placeholder-title" />}
            <div className="asset-owner-line">
              <span>Loading ownership and market state</span>
            </div>
            <div className="asset-token-tags" aria-hidden="true">
              <span>carrier@1.0</span>
              <span>Arweave</span>
              <span>Supply 1</span>
            </div>
            {error ? (
              <ErrorPanel message={error} onRetry={onRetry} retryLabel="Retry live state" />
            ) : (
              <div aria-live="polite" className="state-verification asset-loading-verification" role="status">
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
              <ArtworkImage src={asset.image} alt={asset.name} loading="eager" />
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

function AssetView() {
  const { collectionId = '', assetId = '' } = useParams();
  const market = React.useContext(MarketContext);
  const wallet = useWallet();
  const indexedCollection = market.collections.find((item) => item.id === collectionId);
  const indexedAsset = indexedCollection ? collectionAsset(indexedCollection, assetId) : undefined;
  const cachedAsset = React.useMemo(() => loadAssetShellSnapshot(window.sessionStorage, assetId), [assetId]);
  const [liveResult, setLiveResult] = React.useState<{
    assetId: string;
    state: AssetState | null;
    loading: boolean;
    error: string | null;
    provider: string;
    verifiedAt: number | null;
  }>({ assetId, state: null, loading: true, error: null, provider: '', verifiedAt: null });
  const requestRef = React.useRef<AbortController>();
  const state = liveResult.assetId === assetId ? liveResult.state : null;
  const error = liveResult.assetId === assetId ? liveResult.error : null;
  const loading = liveResult.assetId !== assetId || liveResult.loading;
  const provider = liveResult.assetId === assetId ? liveResult.provider : '';
  const verifiedAt = liveResult.assetId === assetId ? liveResult.verifiedAt : null;
  const directAtomicRoute = collectionId === CREATED_COLLECTION_ID && ARWEAVE_ADDRESS.test(assetId);
  const canResolveAsset = Boolean(
    indexedAsset || (indexedCollection?.kind === 'tokens' && ARWEAVE_ADDRESS.test(assetId)) || directAtomicRoute,
  );
  const directAtomicAsset = directAtomicRoute && state ? bazarAtomicAssetFromState(assetId, state) : null;
  const collection = indexedCollection ?? directAtomicAsset?.collection;
  const resolvedAsset =
    directAtomicAsset?.asset ??
    (indexedCollection && state ? collectionAsset(indexedCollection, assetId, state) : indexedAsset);
  const shellAsset = indexedAsset ?? cachedAsset;
  React.useEffect(() => {
    if (resolvedAsset) storeAssetShellSnapshot(window.sessionStorage, resolvedAsset);
  }, [resolvedAsset]);
  const {
    activities: operationActivities,
    start: startOperationActivity,
    remove: removeOperationActivity,
  } = useOperationActivity();
  const operationFocusFallbackRef = React.useRef<HTMLHeadingElement>(null);
  const resumeButtonRef = React.useRef<HTMLButtonElement>(null);
  const operationFocusFallback = React.useCallback(
    () => resumeButtonRef.current ?? operationFocusFallbackRef.current,
    [],
  );
  const operationActivityEntry = operationActivities.find(
    (activity) => activity.asset.id === assetId && activity.owner === wallet.address && activity.phase !== 'done',
  );
  const operation = operationActivityEntry?.operation ?? null;
  const openOperation = React.useCallback(
    (next: Operation) => {
      const activityAsset = resolvedAsset ?? indexedAsset ?? cachedAsset;
      if (!wallet.address || !activityAsset) return;
      startOperationActivity({
        asset: activityAsset,
        collectionId,
        owner: wallet.address,
        operation: next,
        restoreFallback: operationFocusFallback,
      });
    },
    [
      cachedAsset,
      collectionId,
      indexedAsset,
      operationFocusFallback,
      resolvedAsset,
      startOperationActivity,
      wallet.address,
    ],
  );
  const [recoverySuppressed, setRecoverySuppressed] = React.useState(false);
  const [recoveryNotice, setRecoveryNotice] = React.useState('');
  const [unavailableRecovery, setUnavailableRecovery] = React.useState<UnavailableOperationRecovery | null>(null);
  const [assetActivity, setAssetActivity] = React.useState<CollectionActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = React.useState(true);
  const [activityError, setActivityError] = React.useState<string | null>(null);
  const [activityRetry, setActivityRetry] = React.useState(0);
  const [storageVersion, setStorageVersion] = React.useState(0);
  const activityAssetRef = React.useRef('');
  const [activeSection, setActiveSection] = React.useState<
    'about' | 'orders' | 'activity' | 'rights' | 'blockchain' | 'more'
  >('about');
  const load = React.useCallback(async () => {
    requestRef.current?.abort();
    if (!canResolveAsset) {
      setLiveResult({ assetId, state: null, loading: false, error: null, provider: '', verifiedAt: null });
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setLiveResult((current) => ({
      assetId,
      state: current.assetId === assetId ? current.state : null,
      loading: true,
      error: null,
      provider: current.assetId === assetId ? current.provider : '',
      verifiedAt: current.assetId === assetId ? current.verifiedAt : null,
    }));
    try {
      const result = await readAssetState(assetId, { signal: controller.signal, maxAge: 0 });
      if (requestRef.current === controller && !controller.signal.aborted) {
        setLiveResult({
          assetId,
          state: result.state,
          loading: false,
          error: null,
          provider: result.provider,
          verifiedAt: result.verifiedAt ?? Date.now(),
        });
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
  }, [assetId, canResolveAsset]);
  const refreshAsset = React.useCallback(async () => {
    setActivityRetry((value) => value + 1);
    await load();
  }, [load]);
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
          const recovering = operation.kind === 'buy' ? Boolean(operation.resume) : Boolean(operation.resumeId);
          if (!recovering) removeOperationActivity(operationActivityEntry.id);
        }
        setStorageVersion((version) => version + 1);
        return;
      }
      if (change === 'recovery-updated') {
        if (operation && operationActivityEntry) {
          const recovering = operation.kind === 'buy' ? Boolean(operation.resume) : Boolean(operation.resumeId);
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
    void load();
    return () => {
      requestRef.current?.abort();
    };
  }, [load]);
  React.useEffect(() => {
    const refreshVisibleState = () => {
      if (document.visibilityState === 'visible') void refreshAsset();
    };
    document.addEventListener('visibilitychange', refreshVisibleState);
    return () => document.removeEventListener('visibilitychange', refreshVisibleState);
  }, [refreshAsset]);
  React.useEffect(() => {
    const controller = new AbortController();
    if (activityAssetRef.current !== assetId) {
      activityAssetRef.current = assetId;
      setAssetActivity([]);
    }
    setActivityError(null);
    if (!resolvedAsset) {
      setActivityLoading(false);
      return () => controller.abort();
    }
    setActivityLoading(true);
    void discoverCollectionActivity({ recipients: [assetId], signal: controller.signal, limit: 24 })
      .then(
        (events) => {
          if (!controller.signal.aborted) setAssetActivity(events);
        },
        (cause) => {
          if (!controller.signal.aborted) {
            setActivityError(marketplaceRequestFailureMessage('index', marketplaceFailureKind(cause)));
          }
        },
      )
      .finally(() => {
        if (!controller.signal.aborted) setActivityLoading(false);
      });
    return () => controller.abort();
  }, [activityRetry, assetId, resolvedAsset?.id]);
  React.useEffect(() => setActiveSection('about'), [assetId]);
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
    const activeClaimKey = operationClaimStorageKey(assetId, wallet.address);
    if (localStorage.getItem(activeClaimKey)) {
      const controller = new AbortController();
      void clearStaleWalletOperationClaim(localStorage, activeClaimKey, { signal: controller.signal })
        .then((cleared) => {
          if (!controller.signal.aborted && cleared) setStorageVersion((version) => version + 1);
        })
        .catch(() => undefined);
      return () => controller.abort();
    }
    const purchaseKey = atomicPurchaseStorageKey(assetId, wallet.address);
    const pendingOperationKey = operationStorageKey(assetId, wallet.address);
    let saved: any = null;
    try {
      saved = loadWalletRecord<any>(
        localStorage,
        purchaseKey,
        `bazar-purchase:${assetId}`,
        (record) => record?.buyer === wallet.address,
      );
    } catch {
      removeWalletRecord(localStorage, purchaseKey);
    }
    if (saved?.buyer === wallet.address && saved?.order && !hasRecoverablePurchase(saved.snapshot)) {
      removeWalletRecordIf<any>(
        localStorage,
        purchaseKey,
        (record) =>
          record?.buyer === wallet.address &&
          record?.order?.orderId === saved.order.orderId &&
          !hasRecoverablePurchase(record?.snapshot),
      );
      saved = null;
    }
    if (saved?.buyer === wallet.address && saved?.order) {
      const recoveryStatus = atomicPurchaseRecoveryStatus(state, wallet.address, saved.order, saved.snapshot);
      if (recoveryStatus === 'resumable') {
        openOperation({ kind: 'buy', order: saved.order, resume: saved.snapshot });
        return;
      } else {
        setRecoveryNotice(
          'A previous purchase is paused because its order is no longer available to this wallet. Its signed transaction details remain saved in this browser, and no replacement payment will be created.',
        );
      }
    }
    const order = liveOrder(state);
    if (order && order.creator !== wallet.address) {
      const client = new AssetTransactionClient();
      const registrationId = client.findStoredRegistration(assetId, order.orderId, wallet.address);
      if (registrationId) {
        openOperation({
          kind: 'buy',
          order,
          resume: {
            registration: { id: registrationId, dispatched: false },
          },
        });
        return;
      }
    }
    try {
      const savedOperation = loadWalletRecord<any>(
        localStorage,
        pendingOperationKey,
        `bazar-operation:${assetId}`,
        (record) =>
          record?.signer === wallet.address &&
          ARWEAVE_ADDRESS.test(record?.txId ?? '') &&
          ['sell', 'cancel', 'transfer'].includes(record?.kind),
      );
      if (!savedOperation) {
        setUnavailableRecovery((current) => (current?.key === pendingOperationKey ? null : current));
        return;
      }
      if (
        savedOperation?.signer === wallet.address &&
        typeof savedOperation?.txId === 'string' &&
        ['sell', 'cancel', 'transfer'].includes(savedOperation?.kind)
      ) {
        try {
          new AssetTransactionClient().restore(savedOperation.txId, wallet.address);
        } catch {
          const currentOrder = liveOrder(state);
          const canStillApply =
            savedOperation.kind === 'sell'
              ? ownerOfAsset(state) === wallet.address && !currentOrder
              : savedOperation.kind === 'cancel'
                ? Boolean(
                    savedOperation.order?.orderId &&
                    state.orders[savedOperation.order.orderId]?.status === 'open' &&
                    state.orders[savedOperation.order.orderId]?.creator === wallet.address,
                  )
                : liquidBalanceOf(state, wallet.address) === '1';
          const matches = (record: any) =>
            record?.assetId === assetId && record?.signer === wallet.address && record?.txId === savedOperation.txId;
          if (!canStillApply) {
            if (
              removeWalletRecoveryAndSignatures(
                localStorage,
                pendingOperationKey,
                matches,
                [savedOperation.txId],
                wallet.address,
              )
            ) {
              setUnavailableRecovery(null);
              setRecoveryNotice(
                'A stale local action was removed after current live state proved that it can no longer apply. No replacement transaction was created.',
              );
            }
          } else {
            setUnavailableRecovery({
              key: pendingOperationKey,
              kind: savedOperation.kind,
              signer: wallet.address,
              txId: savedOperation.txId,
            });
          }
          return;
        }
        setUnavailableRecovery(null);
        if (savedOperation.kind === 'cancel' && savedOperation.order) {
          openOperation({
            kind: 'cancel',
            order: savedOperation.order,
            startingSlot: savedOperation.startingSlot,
            resumeId: savedOperation.txId,
          });
        } else {
          openOperation({
            kind: savedOperation.kind,
            resumeId: savedOperation.txId,
            startingSlot: savedOperation.startingSlot,
            value: savedOperation.value,
          });
        }
      }
    } catch {
      removeWalletRecord(localStorage, pendingOperationKey);
    }
  }, [assetId, openOperation, operation, recoverySuppressed, state, storageVersion, wallet.address]);
  if (!collection && (market.loading || (directAtomicRoute && loading))) {
    return <AssetDetailLoadingShell collectionId={collectionId} error={error} onRetry={load} />;
  }
  if (!collection && market.error)
    return (
      <RouteState title="Asset unavailable">
        <ErrorPanel message={market.error} onRetry={market.retry} retryLabel="Retry collection index" />
      </RouteState>
    );
  if (!collection && directAtomicRoute && error)
    return (
      <RouteState title="Asset unavailable">
        <ErrorPanel message={error} onRetry={load} retryLabel="Retry live state" />
      </RouteState>
    );
  if (!collection)
    return (
      <RouteState title="Collection not found">
        <ErrorPanel message="This collection could not be found on Arweave." />
      </RouteState>
    );
  const asset =
    collection.kind === 'names'
      ? state && ['carrier@1.0', 'name-token@1.0'].includes(state.device)
        ? indexedAsset
        : null
      : resolvedAsset;
  if (!asset && error)
    return (
      <RouteState title="Asset unavailable" backTo={`/collection/${collection.id}`} backLabel={collection.name}>
        <ErrorPanel message={error} onRetry={load} retryLabel="Retry live state" />
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
      <AssetDetailLoadingShell asset={shellAsset} collection={collection} collectionId={collectionId} onRetry={load} />
    );
  if (!state) {
    return (
      <AssetDetailLoadingShell
        asset={asset}
        collection={collection}
        collectionId={collectionId}
        error={error}
        onRetry={load}
      />
    );
  }
  if (state && (state.totalSupply !== '1' || state.denomination > 0)) {
    return (
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
        loading={loading}
        error={error}
        provider={provider}
        verifiedAt={verifiedAt}
        onRefresh={refreshAsset}
      />
    );
  }
  const owner = state ? ownerOfAsset(state) : null;
  const order = state ? liveOrder(state) : null;
  const mine = Boolean(wallet.address && owner === wallet.address);
  const recoveryBlocksActions = recoverySuppressed || Boolean(unavailableRecovery);
  const license = state ? licenseProperties(state) : [];
  const description = assetDescription(state, collection.description);
  const moreAssets = collection.assets.filter((item) => item.id !== asset.id).slice(0, 4);
  type AtomicAssetSection = typeof activeSection;
  const assetTabs: AssetDetailTab<AtomicAssetSection>[] = [
    { value: 'about', label: 'About', icon: <Info className="ui-icon" aria-hidden="true" />, panelId: 'asset-about' },
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
            Local tracking is paused. Resume here to continue observing signed work or review any wallet approvals still
            required.
          </span>
          <button
            ref={resumeButtonRef}
            className="with-icon"
            type="button"
            onClick={() => setRecoverySuppressed(false)}
          >
            <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Resume pending action
          </button>
        </div>
      ) : null}
      {recoveryNotice ? (
        <div className="pending-operation-notice">
          <span role="status">{recoveryNotice}</span>
          <button type="button" onClick={() => setRecoveryNotice('')}>
            Dismiss
          </button>
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
              (record) => record?.signer === unavailableRecovery.signer && record?.txId === unavailableRecovery.txId,
              [unavailableRecovery.txId],
              unavailableRecovery.signer,
            );
            if (removed) {
              setUnavailableRecovery(null);
              setRecoveryNotice(
                'Local tracking was discarded. Current ownership and orders above remain the live source of truth.',
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
            {error ? <ErrorPanel message={error} onRetry={load} retryLabel="Retry live state" /> : null}
            {state ? (
              <section className="asset-commerce-card">
                <div className="asset-market-stats">
                  <div>
                    <span>Current ask</span>
                    <strong>{order ? `${winstonToAr(order.asking)} AR` : 'Not listed'}</strong>
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
                  <span>{order?.status === 'reserved' ? 'Reserved at' : order ? 'Buy for' : 'Market status'}</span>
                  <strong>{order ? `${winstonToAr(order.asking)} AR` : 'Not listed'}</strong>
                </div>
                <div className="asset-commerce-actions">
                  {!wallet.address ? <ConnectWalletButton /> : null}
                  {wallet.address && atomicOrderCanBeBought(order) && !mine ? (
                    <button
                      className="primary with-icon"
                      disabled={recoveryBlocksActions || loading || Boolean(error)}
                      onClick={() => openOperation({ kind: 'buy', order })}
                    >
                      <ShoppingCart className="ui-icon ui-icon--sm" aria-hidden="true" /> Buy now
                    </button>
                  ) : null}
                  {wallet.address && mine && !order ? (
                    <button
                      className="primary with-icon"
                      disabled={recoveryBlocksActions || loading || Boolean(error)}
                      onClick={() => openOperation({ kind: 'sell' })}
                    >
                      <Tag className="ui-icon ui-icon--sm" aria-hidden="true" /> List for sale
                    </button>
                  ) : null}
                  {wallet.address && mine && order?.status === 'open' ? (
                    <button
                      className="with-icon"
                      disabled={recoveryBlocksActions || loading || Boolean(error)}
                      onClick={() => openOperation({ kind: 'cancel', order })}
                    >
                      <CircleX className="ui-icon ui-icon--sm" aria-hidden="true" /> Cancel listing
                    </button>
                  ) : null}
                  {wallet.address && mine && !order ? (
                    <button
                      className="with-icon"
                      disabled={recoveryBlocksActions || loading || Boolean(error)}
                      onClick={() => openOperation({ kind: 'transfer' })}
                    >
                      <Send className="ui-icon ui-icon--sm" aria-hidden="true" /> Transfer
                    </button>
                  ) : null}
                  <button
                    aria-disabled={loading}
                    className="with-icon"
                    onClick={() => {
                      if (!loading) void refreshAsset();
                    }}
                  >
                    <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
                    {loading ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </div>
        <div className="asset-visual-column">
          <div className="asset-hero-media">
            {asset.image ? (
              <ArtworkImage src={asset.image} alt={asset.name} loading="eager" />
            ) : collection.kind === 'names' ? (
              <NameArtwork name={asset.name} />
            ) : (
              <span>{asset.name.slice(0, 1)}</span>
            )}
            {collection.kind !== 'names' ? (
              <div className="asset-media-label">
                <span>Permanent asset</span>
                <strong>{asset.contentType ?? (asset.image ? 'image' : (state?.device ?? 'process'))}</strong>
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
            onChange={setActiveSection}
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
                  <strong>{owner ? short(owner) : state ? 'Unassigned' : 'State unavailable'}</strong>
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
                      {winstonToAr(order.asking)} AR
                    </strong>
                    <span data-label="Quantity" role="cell">
                      {order.quantity}
                    </span>
                    <span data-label="Seller" role="cell">
                      <WalletAddress address={order.creator} label="seller" />
                    </span>
                    <span className={`order-status ${order.status}`} data-label="Status" role="cell">
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
                Computed from the last loaded asset process state through the selected HyperBEAM gateway.
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
                  <strong>{winstonToAr(order.asking)} AR</strong>
                </div>
              ) : null}
              {activityLoading ? (
                <Loading
                  label={assetActivity.length ? 'Refreshing market history…' : 'Reading indexed market history…'}
                />
              ) : null}
              <div className="asset-history-actions">
                <button
                  aria-disabled={activityLoading}
                  className="with-icon"
                  type="button"
                  onClick={() => {
                    if (!activityLoading) setActivityRetry((value) => value + 1);
                  }}
                >
                  <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
                  {activityLoading
                    ? assetActivity.length
                      ? 'Refreshing history…'
                      : 'Loading history…'
                    : activityError
                      ? 'Retry history'
                      : 'Refresh history'}
                </button>
              </div>
              {activityError ? (
                <div className="inline-error" role={assetActivity.length ? 'status' : 'alert'}>
                  <span>
                    Market history could not be read.{' '}
                    {assetActivity.length ? `Previously loaded events remain visible. ${activityError}` : activityError}
                  </span>
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
                Up to 24 recent signed process submissions indexed from Arweave. Live ownership and orders above remain
                authoritative.
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
              <p className="market-note">Terms are read directly from immutable process metadata when present.</p>
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
                      {short(asset.id)} <ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
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
                  <dd>Native AR</dd>
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
                  <Link key={item.id} to={`/asset/${collection.id}/${item.id}`}>
                    {item.image ? <ArtworkImage src={item.image} alt="" /> : <span>{item.name.slice(0, 1)}</span>}
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
  | { kind: 'buy'; order: SwapOrder; resume?: PurchaseSnapshot };

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
    assetId: string,
  ): void;
  onOperation(operation: Operation): void;
  onHide(): void;
  onClose(resumeLater?: boolean, refresh?: boolean): void;
  onViewAsset(): void;
}) {
  const recoveryApprovalCount =
    operation.kind === 'buy' && operation.resume ? purchaseRecoveryApprovalCount(operation.resume) : 0;
  const [value, setValue] = React.useState(
    operation.kind === 'sell' || operation.kind === 'transfer' ? (operation.value ?? '') : '',
  );
  const [phase, setPhase] = React.useState<'form' | 'approval' | 'working' | 'done' | 'error'>(
    operation.kind === 'buy' && operation.resume
      ? recoveryApprovalCount
        ? 'approval'
        : 'working'
      : operation.kind !== 'buy' && operation.resumeId
        ? 'working'
        : 'form',
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
  const networkRef = React.useRef<ArweaveObserverNetwork | null>(null);
  const claimRef = React.useRef<WalletOperationClaim | null>(null);
  const submittedAtRef = React.useRef<number>();
  const exactActionBaselineRef = React.useRef<{ startingSlot: number } | null>(
    (operation.kind === 'cancel' || operation.kind === 'transfer') && Number.isSafeInteger(operation.startingSlot)
      ? { startingSlot: operation.startingSlot! }
      : (operation.kind === 'cancel' || operation.kind === 'transfer') && operation.resumeId
        ? { startingSlot: 0 }
        : null,
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
        networkRef.current?.stop();
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
    if (operation.kind !== 'buy' || operation.resume) return;
    const controller = new AbortController();
    setPurchaseQuote(null);
    setPurchaseWalletBalance(null);
    setQuoteError('');
    const client = new AssetTransactionClient();
    void Promise.all([
      client.estimatePurchaseCosts(operation.order, asset.id, controller.signal),
      client.walletBalance(owner, controller.signal),
    ]).then(
      ([quote, balance]) => {
        if (!controller.signal.aborted) {
          setPurchaseQuote(quote);
          setPurchaseWalletBalance(balance);
        }
      },
      (cause) => {
        if (!controller.signal.aborted) setQuoteError(errorMessage(cause));
      },
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
    let attemptedTransactionId = operation.kind === 'buy' ? undefined : (operation.resumeId ?? transaction?.id);
    try {
      const currentPurchaseSnapshot =
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
      const resumeTransactionId = operation.kind === 'buy' ? undefined : (operation.resumeId ?? transaction?.id);
      let exactActionBaseline = exactActionBaselineRef.current;
      const recovery =
        !freshOperation && operation.kind === 'buy' && currentPurchaseSnapshot?.registration?.id
          ? localStorage.getItem(purchaseKey)
            ? {
                key: purchaseKey,
                matches: (record: any) =>
                  record?.buyer === owner &&
                  record?.order?.orderId === operation.order.orderId &&
                  record?.snapshot?.registration?.id === currentPurchaseSnapshot.registration?.id,
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
        recovery ? { recovery } : {},
      );
      claimRef.current = operationClaim;
      if (freshOperation) {
        const { state: freshState } = await readAssetState(asset.id, { signal, maxAge: 0 });
        if (
          atomicOperationStateError(operation.kind, freshState, owner, 'order' in operation ? operation.order : null)
        ) {
          throw new Error('market-state-changed');
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
      const client = new AssetTransactionClient();
      if (operation.kind === 'buy') {
        const network = new ArweaveObserverNetwork(assetObserverNetworkOptions());
        networkRef.current = network;
        await network.ready();
        if (signal.aborted) throw signal.reason;
        const purchase = new SwapPurchase(
          network,
          client.purchaseAdapter({
            processId: asset.id,
            order: operation.order,
            buyer: owner,
            startingBalance: '0',
            network,
          }),
          {
            registrationTarget: 5,
            paymentTarget: 5,
            paymentSuccessDepth: 1,
            skipFrom: 2,
            propagation: 'all',
            minObservers: 2,
            ...(currentPurchaseSnapshot ? { resume: currentPurchaseSnapshot } : {}),
          },
        );
        purchaseRef.current = purchase;
        let recoveryConflict: Error | null = null;
        const update = (state: PurchaseState) => {
          if (signal.aborted || recoveryConflict) return;
          setPurchaseState(state);
          const snapshot = purchase.snapshot();
          onOperation({ kind: 'buy', order: operation.order, resume: snapshot });
          if (hasRecoverablePurchase(snapshot)) {
            const record = {
              asset: { id: asset.id, name: asset.name },
              activityKind: 'atomic',
              buyer: owner,
              collectionId,
              order: operation.order,
              snapshot,
              createdAt: submittedAtRef.current ?? Date.now(),
            };
            try {
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
                  matches,
                );
              } else {
                storeWalletRecordOrThrow<any>(
                  localStorage,
                  atomicPurchaseStorageKey(asset.id, owner),
                  record,
                  matches,
                  true,
                );
              }
            } catch (cause) {
              recoveryConflict = cause instanceof Error ? cause : new Error(String(cause));
              purchase.abandon();
            }
          }
        };
        purchase.on('state', update);
        purchase.on('failed', update);
        purchase.on('complete', update);
        update(purchase.state());
        const finalState = await purchase.run();
        if (recoveryConflict) throw recoveryConflict;
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
                record?.snapshot?.registration?.id === snapshot.registration?.id,
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
                order: operation.order,
                snapshot: repaired.snapshot,
                createdAt: submittedAtRef.current ?? Date.now(),
              },
              (record) =>
                record?.buyer === owner &&
                record?.order?.orderId === operation.order.orderId &&
                record?.snapshot?.registration?.id === snapshot.registration?.id,
            );
            setPurchaseState({ ...finalState, payment: undefined });
          }
          throw marketplaceCodedError(code, finalState.error?.message ?? code);
        }
        const completedSnapshot = purchase.snapshot();
        removeWalletRecoveryAndSignatures<any>(
          localStorage,
          atomicPurchaseStorageKey(asset.id, owner),
          (record) =>
            record?.buyer === owner &&
            record?.order?.orderId === operation.order.orderId &&
            record?.snapshot?.registration?.id === completedSnapshot.registration?.id,
          [completedSnapshot.registration?.id, completedSnapshot.payment?.id],
          owner,
        );
        if (operationClaim) {
          releaseWalletOperationClaim(localStorage, operationClaim);
          operationClaim = null;
          claimRef.current = null;
        }
        network.stop();
        networkRef.current = null;
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
          signal,
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
            : { kind: 'sell', resumeId: prepared.id, value: operationValue },
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
            matches,
          );
        } else {
          storeWalletRecordOrThrow<any>(
            localStorage,
            operationStorageKey(asset.id, owner),
            operationRecord,
            matches,
            true,
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
      await dispatchAndConfirm(prepared, {
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
            minimumFee: DEFAULT_REGISTRATION_FEE.toString(),
          },
          signal,
        );
      } else if (operation.kind === 'cancel') {
        await client.waitForExactCancellation(
          asset.id,
          prepared.id,
          owner,
          operation.order,
          exactActionBaseline!,
          signal,
        );
      } else if (operation.kind === 'transfer') {
        await client.waitForFungibleTransfer(
          asset.id,
          prepared.id,
          owner,
          operationValue,
          '1',
          exactActionBaseline!,
          signal,
        );
      }
      removeWalletRecoveryAndSignatures<any>(
        localStorage,
        operationStorageKey(asset.id, owner),
        (record) => record?.txId === prepared.id,
        [prepared.id],
        owner,
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
      networkRef.current?.stop();
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
          (record) => record?.txId === attemptedTransactionId,
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
            target: 5,
            transaction: purchaseState.registration,
          },
          {
            key: 'pay',
            label: 'Pay seller',
            target: 5,
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
  const formError = atomicOperationFormError(operation.kind, operationValue, owner);
  const recoverable = Boolean(
    transaction ||
    hasRecoverablePurchase(purchaseState) ||
    (operation.kind === 'buy' && hasRecoverablePurchase(operation.resume)),
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
      asset.id,
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
          true,
        );
      }
    }
    attemptRef.current.abort();
    purchaseRef.current?.abandon();
    networkRef.current?.stop();
    networkRef.current = null;
    onClose(false);
  };
  const startFreshPurchase = () => {
    if (operation.kind !== 'buy') return;
    const snapshot = latestPurchaseSnapshot(operation.resume, purchaseState ? purchaseSnapshot(purchaseState) : null);
    if (snapshot?.registration?.id) {
      removeWalletRecoveryAndSignatures<any>(
        localStorage,
        atomicPurchaseStorageKey(asset.id, owner),
        (record) =>
          record?.buyer === owner &&
          record?.order?.orderId === operation.order.orderId &&
          record?.snapshot?.registration?.id === snapshot.registration?.id,
        [snapshot.registration.id, snapshot.payment?.id],
        owner,
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
        document.querySelector<HTMLElement>('.operation-activity-trigger[data-activity-owner="global"]'),
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
    <div className={`dialog-backdrop${hiding ? ' dialog-backdrop-hiding' : ''}`} hidden={!visible} role="presentation">
      <div
        className={`dialog${visiblePhase === 'working' ? '' : ' dialog-compact'}${visiblePhase === 'form' ? ' dialog-form-phase' : ''}`}
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
              <h3>
                {recoveryApprovalCount} new wallet {recoveryApprovalCount === 1 ? 'approval is' : 'approvals are'} still
                required
              </h3>
            </div>
            <div className="operation-summary">
              <span>Seller</span>
              <WalletAddress address={operation.order.creator} className="operation-summary-link" full label="seller" />
              <span>Seller payment</span>
              <strong>{sellerPrice}</strong>
              <span>New approvals</span>
              <strong>{recoveryApprovalCount}</strong>
              {operation.resume?.registration?.id ? (
                <small>
                  Reservation{' '}
                  <a href={transactionExplorerUrl(operation.resume.registration.id)} rel="noreferrer" target="_blank">
                    {short(operation.resume.registration.id)} ↗
                  </a>{' '}
                  is already signed.
                </small>
              ) : null}
            </div>
            <button className="primary wide" data-dialog-initial onClick={() => void submit()} type="button">
              Continue with {recoveryApprovalCount} new {recoveryApprovalCount === 1 ? 'approval' : 'approvals'}
            </button>
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
                  <strong>{sellerPrice}</strong>
                  <span>Network fees</span>
                  <strong>
                    {quoteError
                      ? 'Unavailable'
                      : purchaseQuote
                        ? `${winstonToAr((BigInt(purchaseQuote.total) - BigInt(purchaseQuote.asking)).toString())} AR`
                        : 'Checking…'}
                  </strong>
                  <span>Maximum total</span>
                  <strong>
                    {quoteError
                      ? 'Unavailable'
                      : purchaseQuote
                        ? `${winstonToAr(purchaseQuote.total)} AR`
                        : 'Checking…'}
                  </strong>
                  <span>Wallet after purchase</span>
                  <strong>
                    {quoteError
                      ? 'Unavailable'
                      : purchaseQuote && purchaseWalletBalance !== null
                        ? purchaseAffordable
                          ? `${winstonToAr((purchaseWalletBalance - BigInt(purchaseQuote.total)).toString())} AR`
                          : 'Insufficient AR'
                        : 'Checking…'}
                  </strong>
                  <small>One asset · native AR settlement</small>
                </div>
              ) : null}
              {operation.kind === 'buy' ? (
                <p className="sr-only" id={quoteStatusId} aria-live="polite" role="status">
                  {quoteError
                    ? 'Purchase quote unavailable. Retry the cost check before buying.'
                    : purchaseQuote
                      ? `Purchase quote ready. Maximum total ${winstonToAr(purchaseQuote.total)} AR.${purchaseAffordable ? '' : ' This wallet has insufficient AR.'}`
                      : 'Checking the exact purchase cost.'}
                </p>
              ) : null}
              {operation.kind === 'buy' ? (
                <div
                  className={quoteError ? 'inline-error' : 'quote-check-action'}
                  role={quoteError ? 'alert' : undefined}
                >
                  <span>
                    {quoteError
                      ? 'The exact network cost could not be checked.'
                      : purchaseQuote
                        ? 'Exact costs checked.'
                        : 'Checking wallet balance and network fees…'}
                  </span>
                  <button
                    aria-describedby={quoteStatusId}
                    aria-disabled={!purchaseQuote && !quoteError}
                    className="with-icon"
                    type="button"
                    onClick={() => {
                      if (purchaseQuote || quoteError) setQuoteRetry((current) => current + 1);
                    }}
                  >
                    <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
                    {quoteError ? 'Retry cost check' : purchaseQuote ? 'Recheck cost' : 'Checking cost…'}
                  </button>
                </div>
              ) : null}
              {operation.kind === 'sell' ? (
                <label>
                  Sale price in AR
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
                    Review the complete destination before asking your wallet to approve this irreversible transfer.
                  </small>
                </div>
              ) : null}
              {operation.kind === 'cancel' ? (
                <div className="operation-summary">
                  <span>Open listing</span>
                  <strong>{sellerPrice}</strong>
                  <small>Cancelling returns the asset from order escrow to your liquid balance.</small>
                </div>
              ) : null}
              {operation.kind === 'sell' || operation.kind === 'transfer' ? (
                <p
                  id={fieldHelpId}
                  className={value && formError ? 'field-help field-help-error' : 'field-help'}
                  role={value && formError ? 'alert' : undefined}
                >
                  {formError}
                </p>
              ) : null}
              <p className="operation-disclosure">
                {operation.kind === 'buy'
                  ? 'Your wallet will ask for two approvals: one reservation and one exact seller payment. The payment stays local until the reservation is accepted by the network.'
                  : 'After signing, Bazar observes this action through independently addressed Arweave nodes. Signed transaction details are saved in this browser so you can return with the same wallet while browser data remains available.'}
              </p>
            </div>
            <button
              aria-describedby={operation.kind === 'buy' ? quoteStatusId : undefined}
              className="primary wide"
              data-dialog-initial
              disabled={
                Boolean(formError) ||
                (operation.kind === 'buy' && (!purchaseQuote || purchaseAffordable !== true || Boolean(quoteError)))
              }
              type="submit"
            >
              {operation.kind === 'buy' && purchaseAffordable === false
                ? 'Insufficient AR'
                : operation.kind === 'buy' && purchaseQuote
                  ? `Buy · up to ${winstonToAr(purchaseQuote.total)} AR`
                  : actionLabel}
            </button>
          </form>
        ) : null}
        {visiblePhase === 'working' && !steps.length ? (
          <div className="operation-preparing">
            <Loading
              label={
                (operation.kind === 'buy' ? operation.resume : operation.resumeId)
                  ? 'Recovering the exact signed transaction…'
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
          <div>
            <p className="sr-only" aria-live="polite" role="status">
              {workingStatus || 'Watching independently addressed Arweave nodes report confirmations for this action.'}
            </p>
            {workingStatus ? <p className="scheduler-wait">{workingStatus}</p> : null}
            <ArweaveTransactionSync
              active={visible}
              skipKind={purchaseState?.canSkip ? (purchaseState.skipKind ?? 'skip') : undefined}
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
              pendingAfterConfirmation={
                purchaseState?.stage === 'ownership-verifying' ? 'Checking ownership' : undefined
              }
            />
          </div>
        ) : null}
        {visiblePhase === 'done' ? (
          <div className="result success">
            <OperationOutcome title={resultCopy.title} detail={resultCopy.detail} />
            {operation.kind === 'buy' ? (
              <div className="settlement-receipt">
                <div>
                  <span>Seller payment</span>
                  <strong>{sellerPrice}</strong>
                </div>
                <div>
                  <span>Seller</span>
                  <WalletAddress address={operation.order.creator} full label="seller" />
                </div>
                <div>
                  <span>Order</span>
                  <a href={transactionExplorerUrl(operation.order.orderId)} rel="noreferrer" target="_blank">
                    {short(operation.order.orderId)} ↗
                  </a>
                </div>
                <div className="settlement-receipt-links">
                  {purchaseState?.registration?.id ? (
                    <a href={transactionExplorerUrl(purchaseState.registration.id)} rel="noreferrer" target="_blank">
                      Reservation {short(purchaseState.registration.id)} ↗
                    </a>
                  ) : null}
                  {purchaseState?.payment?.id ? (
                    <a href={transactionExplorerUrl(purchaseState.payment.id)} rel="noreferrer" target="_blank">
                      Payment {short(purchaseState.payment.id)} ↗
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
                    Transaction {short(transaction.id)} ↗
                  </a>
                </div>
              </div>
            ) : transaction ? (
              <a href={transactionExplorerUrl(transaction.id)} rel="noreferrer" target="_blank">
                View transaction {short(transaction.id)} ↗
              </a>
            ) : null}
            <button className="primary with-icon" data-dialog-initial onClick={onViewAsset}>
              <ArrowLeft className="ui-icon ui-icon--sm" aria-hidden="true" /> View updated asset
            </button>
          </div>
        ) : null}
        {visiblePhase === 'error' ? (
          <div className="result error">
            <AtomicOperationErrorAlert message={visibleMessage} />
            {failureKind === 'market-state-changed' ? (
              <button data-dialog-initial type="button" onClick={() => onClose(false)}>
                View updated asset
              </button>
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
                    <a href={transactionExplorerUrl(operation.order.orderId)} rel="noreferrer" target="_blank">
                      {short(operation.order.orderId)} ↗
                    </a>
                  </div>
                  <div className="settlement-receipt-links">
                    {purchaseState?.registration?.id ? (
                      <a href={transactionExplorerUrl(purchaseState.registration.id)} rel="noreferrer" target="_blank">
                        Reservation {short(purchaseState.registration.id)} ↗
                      </a>
                    ) : null}
                    {purchaseState?.payment?.id ? (
                      <a href={transactionExplorerUrl(purchaseState.payment.id)} rel="noreferrer" target="_blank">
                        Payment {short(purchaseState.payment.id)} ↗
                      </a>
                    ) : null}
                  </div>
                </div>
                {atomicPurchaseFailureCode(purchaseState) === 'registration-dispatch-rejected' ? (
                  <button data-dialog-initial onClick={() => onClose(false)}>
                    View current listing
                  </button>
                ) : terminalReservationFailure ? (
                  <button data-dialog-initial onClick={startFreshPurchase}>
                    Start a new purchase
                  </button>
                ) : atomicPurchaseFailureCode(purchaseState) === 'payment-dispatch-rejected' ? (
                  <button data-dialog-initial onClick={() => void submit()}>
                    Sign a replacement seller payment
                  </button>
                ) : (
                  <button data-dialog-initial onClick={restartPurchase}>
                    {recoverable ? 'Continue saved purchase' : 'Try again'}
                  </button>
                )}
              </>
            ) : failureKind === 'transaction-rejected' && transaction ? (
              <button
                data-dialog-initial
                onClick={() => {
                  removeWalletRecordIf<any>(
                    localStorage,
                    operationStorageKey(asset.id, owner),
                    (record) => record?.txId === transaction.id,
                  );
                  localStorage.removeItem(`bazar-signed-transaction:${transaction.id}`);
                  onClose(false);
                }}
              >
                Discard rejected signature and sign again
              </button>
            ) : transaction ? (
              <button data-dialog-initial onClick={() => void submit()}>
                Resume the signed transaction
              </button>
            ) : (
              <button
                data-dialog-initial
                onClick={() => {
                  setFailureKind(null);
                  setMessage('');
                  setPhase('form');
                }}
              >
                Try again
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AtomicOperationErrorAlert({ message }: { message: string }) {
  return (
    <div className="result-alert" role="alert">
      <h3>Could not complete this action</h3>
      <p>{message}</p>
    </div>
  );
}

function BazarMark() {
  return <img src={bazarLogo} alt="" aria-hidden="true" />;
}

function collectionKindLabel(collection: Collection) {
  if (collection.kind === 'names') return 'Arweave identity';
  if (collection.kind === 'tokens') return 'Fungible token collection';
  return 'Permanent artwork collection';
}

function collectionEyebrow(collection: Collection) {
  if (collection.kind === 'names') return 'Carrier assets';
  if (collection.kind === 'tokens') return 'Fungible tokens';
  return 'Permanent artwork';
}

export function searchResultScore(
  { asset, collection }: { asset: AssetSummary; collection: Collection },
  query: string,
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

export function collectionSearchAssets(collection: Collection, query: string): AssetSummary[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return collection.assets;
  const loadedMatches = collection.assets.filter((asset) => assetMatchesCollectionQuery(asset, normalizedQuery));
  if (collection.kind !== 'names' || !collection.namespace) return loadedMatches;
  const seen = new Set(loadedMatches.map((asset) => asset.id));
  const canonicalMatches = Object.entries(collection.namespace.namesById)
    .filter(([, name]) => name.toLowerCase().includes(normalizedQuery))
    .map(([id, name]) => ({ id, name }))
    .filter((asset) => !seen.has(asset.id));
  return [...loadedMatches, ...canonicalMatches];
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
  const normalizedQuery = query.trim().toLowerCase();
  return (
    assetMatchesCollectionQuery(asset, normalizedQuery) ||
    `${collection.name} ${collection.description}`.toLowerCase().includes(normalizedQuery)
  );
}

export function directTokenSearchCollection(collections: Collection[], query: string): Collection | undefined {
  return ARWEAVE_ADDRESS.test(query.trim())
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
  include: (asset: AssetSummary, collection: Collection) => boolean = () => true,
) {
  const queues = collections.map((collection) => ({
    collection,
    assets: collection.assets.filter((asset) => include(asset, collection)),
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
  portableListings: Array<Pick<ResolvedAsset, 'asset' | 'collection'>> = [],
) {
  const collectionsById = new Map(collections.map((collection) => [collection.id, collection]));
  const verified = interleaveCollectionAssets(
    collections.map((collection) => ({
      ...collection,
      assets: verifiedListings[collection.id] ?? [],
    })),
    limit,
  ).map(({ asset, collection }) => ({ asset, collection: collectionsById.get(collection.id)! }));
  const fallback = interleaveCollectionAssets(
    collections,
    limit,
    (asset, collection) => Boolean(asset.image) || collection.kind === 'tokens',
  );
  const seen = new Set<string>();
  return [...portableListings, ...verified, ...fallback]
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
) {
  const indexed = collections.flatMap((collection) =>
    collectionSearchAssets(collection, query)
      .filter((asset) => asset.image || collection.kind === 'tokens' || collection.kind === 'names')
      .map((asset) => ({ asset, collection })),
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
  return direction === 'previous' ? Math.max(0, visible[0] - 5) : Math.min(count - 1, visible[visible.length - 1] + 5);
}

function Loading({ label }: { label: string }) {
  return (
    <div aria-live="polite" className="loading" role="status">
      <span aria-hidden="true" />
      {label}
    </div>
  );
}
function RouteState({
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
function ErrorPanel({
  message,
  onRetry,
  retryLabel = 'Retry',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="error-panel">
      <strong>Unable to load</strong>
      <span aria-label={`Unable to load. ${message}`} role="alert">
        {message}
      </span>
      {onRetry ? (
        <button
          className="with-icon error-panel-retry"
          onClick={() => {
            onRetry();
            document.getElementById('main-content')?.focus({ preventScroll: true });
          }}
          type="button"
        >
          <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> {retryLabel}
        </button>
      ) : null}
    </div>
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
    state.totalSupply === '1' && state.denomination === 0 ? '' : ` / ${state.ticker || 'token'}`
  }`;
}
function tokenBalanceLabel(value: string, state: AssetState) {
  const [whole, fraction] = formatTokenAmount(value, state.denomination).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${fraction ? `${grouped}.${fraction}` : grouped} ${state.ticker || (state.totalSupply === '1' ? 'asset' : 'tokens')}`;
}
function short(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-5)}`;
}
function winstonToAr(value: string) {
  const raw = BigInt(value);
  const whole = raw / 1_000_000_000_000n;
  const fraction = (raw % 1_000_000_000_000n).toString().padStart(12, '0').replace(/0+$/, '');
  return fraction ? `${whole.toLocaleString()}.${fraction}` : whole.toLocaleString();
}
function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
function mintErrorMessage(error: unknown) {
  const value = error instanceof Error ? error.message : String(error);
  const friendly: Record<string, string> = {
    'mint-name-invalid': 'Enter a name between 1 and 80 characters.',
    'mint-description-invalid': 'Keep the description under 600 characters.',
    'mint-file-required': 'Choose an image to continue.',
    'mint-file-type-unsupported': 'Use a PNG, JPG, WebP, or GIF image.',
    'mint-file-size-invalid': 'Choose an image no larger than 10 MB.',
    'mint-insufficient-balance': 'This wallet does not have enough AR for both Arweave transactions.',
    'mint-high-cost-confirmation-required': 'Review and approve the unusually high network cost before minting.',
    'wallet-sign-unavailable': 'Connect an Arweave wallet that can sign transactions.',
    'wallet-account-changed': 'The connected wallet changed. Reconnect the original wallet and try again.',
    'mint-draft-wallet-mismatch': 'Reconnect the wallet that uploaded this media to finish minting it.',
    'mint-udl-access-fee-invalid': 'Enter a UDL access fee greater than zero.',
    'mint-udl-fee-invalid': 'Enter a UDL license fee greater than zero.',
    'mint-udl-share-invalid': 'Enter a UDL revenue share between 0 and 100 percent.',
    'mint-udl-expiry-invalid': 'Enter a whole number of years for the UDL license term.',
    'mint-udl-payment-address-invalid': 'Enter a valid 43-character Arweave payment address.',
  };
  return friendly[value] ?? value.replaceAll('-', ' ');
}
function arToWinston(value: string) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value) || Number(value) <= 0)
    throw new Error('Enter a positive AR amount.');
  const [whole, decimals = ''] = value.split('.');
  return (BigInt(whole) * 1_000_000_000_000n + BigInt(decimals.padEnd(12, '0'))).toString();
}

const ARWEAVE_ADDRESS = /^[A-Za-z0-9_-]{43}$/;

export function atomicOperationFormError(kind: Operation['kind'], value: string, owner = '') {
  if (kind === 'sell') {
    if (!value.trim()) return 'Enter the exact AR price for this asset.';
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

export function atomicPurchaseRecoveryStatus(
  state: AssetState,
  buyer: string,
  expectedOrder: SwapOrder,
  snapshot?: PurchaseSnapshot,
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
    currentOrder.quantity === expectedOrder.quantity,
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
  expectedOrder: SwapOrder | null,
) {
  const currentOrder = expectedOrder ? state.orders[expectedOrder.orderId] : null;
  const orderUnchanged = Boolean(
    currentOrder &&
    currentOrder.creator === expectedOrder?.creator &&
    currentOrder.asking === expectedOrder.asking &&
    currentOrder.quantity === expectedOrder.quantity,
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
function purchaseStatusMessage(state: PurchaseState | null) {
  if (!state) return '';
  if (
    state.stage === 'dispatching-registration' ||
    state.stage === 'registration-propagating' ||
    state.stage === 'registration-confirming'
  ) {
    return 'The payment is signed but held in this browser. It will only be released after sampled observers report five confirmations and the reservation appears in live process state.';
  }
  if (state.stage === 'registration-accepting') {
    return 'Sampled observers report five registration confirmations. Waiting for ~arweave-scheduler@1.0 to reserve the order in live process state before releasing payment.';
  }
  if (state.stage === 'signing-payment' || state.stage === 'dispatching-payment') {
    return 'The reservation is live. Preparing the exact payment to the seller.';
  }
  if (state.stage === 'payment-propagating' || state.stage === 'payment-confirming') {
    return 'The reservation is live and the submission gateway accepted the payment. Sampled observers are reporting settlement confirmations.';
  }
  if (state.stage === 'ownership-verifying') {
    return 'Sampled observers report the payment as confirmed. Waiting for ~arweave-scheduler@1.0 to settle the order and transfer ownership in live process state.';
  }
  return '';
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
