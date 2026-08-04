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
  Copy,
  Diamond,
  Eye,
  EyeOff,
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
  LogOut,
  RefreshCw,
  Search,
  Send,
  Server,
  ShoppingCart,
  Tag,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  SwapPurchase,
  type ObserverView,
  type PreparedTransaction,
  type PurchaseSnapshot,
  type PurchaseState,
} from 'weave-wrangler';

import {
  loadCollectionReference,
  loadCollections,
  loadMoreCarrierNames,
  type AssetSummary,
  type Collection,
} from 'api/collections';
import {
  discoverCollectionActivity,
  discoverMarketActivity,
  discoverMarketActivityPage,
  discoverWalletAssetCandidates,
  isLiveListing,
  resolveAssetCandidates,
  restrictAssetCandidates,
  walletAssetGroup,
  type AssetCandidate,
  type CollectionActivityEvent,
  type ResolvedAsset,
} from 'api/asset-discovery';
import {
  licenseProperties,
  liveOrderOfAsset,
  ownerOfAsset,
  readAssetState,
  servingNodeOrigin,
  waitForAssetState,
  type AssetState,
} from 'api/asset-marketplace';
import {
  AssetMintClient,
  CollectionMintClient,
  CREATED_COLLECTION_ID,
  UDL_LICENSE_ID,
  assetFromMintState,
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
import { ArweaveObserverNetwork } from 'api/arweave-observers';
import { assetObserverNetworkOptions } from 'api/asset-observers';
import { AssetTransactionClient, DEFAULT_REGISTRATION_FEE, dispatchAndConfirm } from 'api/asset-transactions';
import {
  ArweaveTransactionSync,
  observedConfirmationDepth,
  type ArweaveSyncStep,
} from 'components/ArweaveTransactionSync';
import { useWallet } from 'providers/WalletProvider';

import arweaveNamesCube from '../assets/arweave-names-cube.gif';
import arweaveNamesCubeStill from '../assets/arweave-names-cube.png';
import bazarLogo from '../assets/logo.svg';
import {
  loadOperationActivities,
  saveOperationActivities,
  type Operation,
  type OperationActivity,
  type OperationActivityPhase,
} from './operation-activity';

import './styles.css';

type MarketContextValue = {
  collections: Collection[];
  loading: boolean;
  error: string | null;
  loadMore(collectionId: string): Promise<void>;
  addCreatedAsset(asset: MintedAsset): void;
  addCollection(collection: Collection): void;
};

const MarketContext = React.createContext<MarketContextValue>({
  collections: [],
  loading: true,
  error: null,
  loadMore: async () => undefined,
  addCreatedAsset: () => undefined,
  addCollection: () => undefined,
});

type OperationActivityContextValue = {
  activities: OperationActivity[];
  activeId: string | null;
  start(input: Pick<OperationActivity, 'asset' | 'collectionId' | 'owner' | 'operation'>): void;
  show(id: string): void;
  hide(): void;
  remove(id: string): void;
  clearFinished(): void;
};

const OperationActivityContext = React.createContext<OperationActivityContextValue | null>(null);

export function App() {
  const [market, setMarket] = React.useState<MarketContextValue>({
    collections: [],
    loading: true,
    error: null,
    loadMore: async () => undefined,
    addCreatedAsset: () => undefined,
    addCollection: () => undefined,
  });
  React.useEffect(() => {
    const controller = new AbortController();
    loadCollections(controller.signal).then(
      (collections) => {
        const created = loadMintedAssets();
        const localCollections = loadMintedCollections();
        const known = new Set(collections.map((collection) => collection.id));
        setMarket((current) => ({
          ...current,
          collections: [
            ...collections,
            ...localCollections.filter((collection) => !known.has(collection.id)),
            ...(created.length ? [createdCollection(created)] : []),
          ],
          loading: false,
          error: null,
        }));
      },
      (error) => {
        if (!controller.signal.aborted) {
          setMarket((current) => ({ ...current, collections: [], loading: false, error: errorMessage(error) }));
        }
      },
    );
    return () => controller.abort();
  }, []);
  const loadMore = React.useCallback(
    async (collectionId: string) => {
      const collection = market.collections.find((item) => item.id === collectionId);
      if (!collection) return;
      const updated = await loadMoreCarrierNames(collection);
      setMarket((current) => ({
        ...current,
        collections: current.collections.map((item) => (item.id === collectionId ? updated : item)),
      }));
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
  const value = React.useMemo(
    () => ({ ...market, loadMore, addCreatedAsset, addCollection }),
    [addCollection, addCreatedAsset, loadMore, market],
  );

  return (
    <MarketContext.Provider value={value}>
      <HashRouter>
        <OperationActivityProvider>
          <RouteScroll />
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/create" element={<CreateView />} />
              <Route path="/my-assets" element={<MyAssetsView />} />
              <Route path="/collection/:collectionId" element={<CollectionView />} />
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

function OperationActivityProvider({ children }: React.PropsWithChildren) {
  const navigate = useNavigate();
  const wallet = useWallet();
  const [activities, setActivities] = React.useState<OperationActivity[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [hydratedOwners, setHydratedOwners] = React.useState<string[]>([]);
  React.useEffect(() => {
    const owner = wallet.address;
    if (!owner || hydratedOwners.includes(owner)) return;
    const restored = loadOperationActivities(localStorage, owner);
    setActivities((current) => {
      const known = new Set(current.map((activity) => activity.id));
      return [...current, ...restored.filter((activity) => !known.has(activity.id))].sort(
        (left, right) => right.createdAt - left.createdAt,
      );
    });
    setHydratedOwners((current) => (current.includes(owner) ? current : [...current, owner]));
  }, [hydratedOwners, wallet.address]);
  React.useEffect(() => {
    if (!hydratedOwners.length) return;
    saveOperationActivities(localStorage, activities, hydratedOwners);
  }, [activities, hydratedOwners]);
  const start = React.useCallback(
    (input: Pick<OperationActivity, 'asset' | 'collectionId' | 'owner' | 'operation'>) => {
      const existing = activities.find((activity) => activity.asset.id === input.asset.id && activity.phase !== 'done');
      if (existing) {
        setActiveId(existing.id);
        return;
      }
      const id = `${input.asset.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      const phase =
        input.operation.kind === 'buy' || ('resumeId' in input.operation && input.operation.resumeId)
          ? 'working'
          : 'form';
      const activity: OperationActivity = {
        ...input,
        id,
        phase,
        status: phase === 'working' ? 'Starting transaction…' : 'Waiting for details',
        confirmations: 0,
        confirmationTarget: 5,
        createdAt: Date.now(),
      };
      setActivities((current) => [activity, ...current]);
      setActiveId(id);
    },
    [activities],
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
  const clearFinished = React.useCallback(() => {
    setActivities((current) => current.filter((activity) => activity.phase !== 'done'));
    setActiveId((current) => {
      const active = activities.find((activity) => activity.id === current);
      return active?.phase === 'done' ? null : current;
    });
  }, [activities]);
  const value = React.useMemo<OperationActivityContextValue>(
    () => ({
      activities,
      activeId,
      start,
      show: setActiveId,
      hide: () => setActiveId(null),
      remove,
      clearFinished,
    }),
    [activeId, activities, clearFinished, remove, start],
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
          onUpdate={update}
          onOperation={(operation) => updateOperation(activity.id, operation)}
          onClose={() => {
            if (activity.phase === 'form') remove(activity.id);
            else setActiveId(null);
          }}
          onDiscard={() => remove(activity.id)}
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

function RouteScroll() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);
  return null;
}

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const wallet = useWallet();
  const market = React.useContext(MarketContext);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const urlQuery = new URLSearchParams(location.search).get('q') ?? '';
  const [query, setQuery] = React.useState(urlQuery);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [scope, setScope] = React.useState<'all' | 'collections' | 'assets' | 'names'>('all');
  const [recentQueries, setRecentQueries] = React.useState<string[]>([]);
  const normalizedQuery = query.trim().toLowerCase();
  const collectionResults = market.collections
    .filter((collection) => {
      if (scope === 'assets') return false;
      if (scope === 'names' && collection.kind !== 'names') return false;
      return (
        !normalizedQuery ||
        `${collection.name} ${collection.description}`.toLowerCase().includes(normalizedQuery) ||
        collection.assets.some((asset) => asset.name.toLowerCase().includes(normalizedQuery))
      );
    })
    .slice(0, 6);
  const assetResults = market.collections
    .filter((collection) => scope !== 'collections' && (scope !== 'names' || collection.kind === 'names'))
    .flatMap((collection) => collection.assets.map((asset) => ({ asset, collection })))
    .filter(({ asset, collection }) => {
      if (!normalizedQuery) return Boolean(asset.image) || collection.kind === 'names';
      return `${asset.name} ${collection.name}`.toLowerCase().includes(normalizedQuery);
    })
    .slice(0, 8);
  React.useEffect(() => setQuery(urlQuery), [urlQuery]);
  React.useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);
  const updateQuery = (value: string) => {
    setQuery(value);
    if (location.pathname === '/') {
      navigate(value.trim() ? `/?q=${encodeURIComponent(value)}` : '/', { replace: true });
    }
  };
  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim()) {
      setRecentQueries((current) => [query.trim(), ...current.filter((item) => item !== query.trim())].slice(0, 4));
    }
    navigate(query.trim() ? `/?q=${encodeURIComponent(query.trim())}` : '/');
    setSearchOpen(false);
  };
  const useRecentQuery = (value: string) => {
    setQuery(value);
    navigate(`/?q=${encodeURIComponent(value)}`);
    setSearchOpen(false);
  };
  const closeSearch = () => {
    if (query.trim()) {
      setRecentQueries((current) => [query.trim(), ...current.filter((item) => item !== query.trim())].slice(0, 4));
    }
    setSearchOpen(false);
  };
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
            onFocus={() => setSearchOpen(true)}
            aria-expanded={searchOpen}
            aria-controls="marketplace-search-panel"
          />
        </form>
        <nav className="site-nav">
          <div className="site-nav-primary">
            <Link aria-label="Create asset" className="create-link" data-tooltip="Create asset" to="/create">
              <Upload className="ui-icon ui-icon--sm" aria-hidden="true" />
            </Link>
            {wallet.address ? (
              <Link aria-label="My assets" className="my-assets-link" data-tooltip="My assets" to="/my-assets">
                <Library className="ui-icon ui-icon--sm" aria-hidden="true" />
              </Link>
            ) : null}
            <GatewayControl />
          </div>
          <div className="site-nav-wallet">
            <OperationActivityControl />
            <WalletControl />
          </div>
        </nav>
      </header>
      {searchOpen ? (
        <div className="search-overlay" onMouseDown={(event) => event.target === event.currentTarget && closeSearch()}>
          <section id="marketplace-search-panel" className="search-panel" role="dialog" aria-label="Search Bazar">
            <form className="search-panel-query" role="search" onSubmit={submitSearch}>
              <Search className="ui-icon" aria-hidden="true" />
              <input
                autoFocus
                aria-label="Search Bazar marketplace"
                placeholder="Search Bazar"
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
              />
              {query ? (
                <button type="button" onClick={() => updateQuery('')} aria-label="Clear search">
                  Clear
                </button>
              ) : null}
              <button className="search-panel-close" type="button" onClick={closeSearch} aria-label="Close search">
                <X aria-hidden="true" />
              </button>
            </form>
            <aside className="search-categories" aria-label="Search categories">
              {scopes.map((item) => {
                const ScopeIcon = item.Icon;
                return (
                  <button
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
              <div className="search-scope-row">
                {scopes.map((item) => (
                  <button
                    className={scope === item.id ? 'active' : undefined}
                    key={item.id}
                    onClick={() => setScope(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="search-panel-content">
                {!normalizedQuery && recentQueries.length ? (
                  <section className="search-result-section">
                    <div className="search-result-heading">
                      <h2>Recent searches</h2>
                      <button onClick={() => setRecentQueries([])}>Clear</button>
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
                          <Link key={collection.id} to={`/collection/${collection.id}`} onClick={closeSearch}>
                            <span className="search-result-image">
                              {preview ? (
                                <img src={preview} alt="" />
                              ) : collection.kind === 'names' ? (
                                <NamesCubePreview />
                              ) : (
                                <BazarMark />
                              )}
                            </span>
                            <span>
                              <strong>{collection.name}</strong>
                              <small>
                                {collection.kind === 'names' ? 'Names' : 'Collection'} ·{' '}
                                {(collection.total ?? collection.assets.length).toLocaleString()} assets
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
                      <h2>{normalizedQuery ? 'Matching assets' : 'Recent assets'}</h2>
                      <span>{assetResults.length} shown</span>
                    </div>
                    <div className="search-asset-grid">
                      {assetResults.map(({ asset, collection }) => (
                        <Link
                          key={`${collection.id}-${asset.id}`}
                          to={`/asset/${collection.id}/${asset.id}`}
                          onClick={closeSearch}
                        >
                          <span className="search-result-image">
                            {asset.image ? <img src={asset.image} alt="" /> : <BazarMark />}
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
                {!market.loading && !collectionResults.length && !assetResults.length ? (
                  <div className="search-empty">
                    <strong>No results for “{query}”</strong>
                    <span>Try another asset, collection, or Arweave name.</span>
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

function WalletControl() {
  const wallet = useWallet();
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuId = React.useId();

  const clearCloseTimer = React.useCallback(() => {
    if (!closeTimerRef.current) return;
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const openMenu = React.useCallback(() => {
    clearCloseTimer();
    if (wallet.address && usesDesktopWalletMenu()) setOpen(true);
  }, [clearCloseTimer, wallet.address]);

  const scheduleMenuClose = React.useCallback(() => {
    if (!usesDesktopWalletMenu()) return;
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 200);
  }, [clearCloseTimer]);

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

  React.useEffect(() => {
    setOpen(false);
    setCopied(false);
  }, [wallet.address]);

  React.useEffect(
    () => () => {
      clearCloseTimer();
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    },
    [clearCloseTimer],
  );

  const copyAddress = async () => {
    if (!wallet.address) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => {
      setCopied(false);
      copiedTimerRef.current = null;
    }, 2000);
  };

  const handlePress = () => {
    if (!wallet.address) {
      void wallet.connect();
      return;
    }
    clearCloseTimer();
    if (usesDesktopWalletMenu()) setOpen(true);
    else setOpen((value) => !value);
  };

  return (
    <div
      className="wallet-control"
      onMouseEnter={wallet.address ? openMenu : undefined}
      onMouseLeave={wallet.address ? scheduleMenuClose : undefined}
      ref={rootRef}
    >
      <button
        aria-controls={wallet.address ? menuId : undefined}
        aria-expanded={wallet.address ? open : undefined}
        aria-haspopup={wallet.address ? 'menu' : undefined}
        aria-label={wallet.address ? `Wallet ${short(wallet.address)}` : 'Connect wallet'}
        className="wallet"
        data-tooltip={wallet.address ? undefined : 'Connect wallet'}
        onClick={handlePress}
        ref={triggerRef}
        type="button"
      >
        <Wallet className="ui-icon ui-icon--sm" aria-hidden="true" />
        <span>{wallet.address ? short(wallet.address) : 'Connect'}</span>
      </button>
      {open && wallet.address ? (
        <section aria-label="Wallet" className="wallet-menu" id={menuId} role="menu">
          <div className="wallet-menu-heading">
            <span className="wallet-menu-icon" aria-hidden="true">
              <Wallet className="ui-icon ui-icon--sm" />
            </span>
            <span className="wallet-menu-copy">
              <small>Connected wallet</small>
              <strong title={wallet.address}>{short(wallet.address)}</strong>
            </span>
          </div>
          <div className="wallet-menu-actions">
            <button role="menuitem" type="button" onClick={() => void copyAddress()}>
              {copied ? (
                <Check className="ui-icon ui-icon--sm" aria-hidden="true" />
              ) : (
                <Copy className="ui-icon ui-icon--sm" aria-hidden="true" />
              )}
              <span aria-live="polite">{copied ? 'Copied!' : 'Copy address'}</span>
            </button>
            <button
              className="wallet-menu-disconnect"
              role="menuitem"
              type="button"
              onClick={() => void wallet.disconnect()}
            >
              <LogOut className="ui-icon ui-icon--sm" aria-hidden="true" />
              <span>Disconnect</span>
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function usesDesktopWalletMenu() {
  return window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)').matches;
}

function OperationActivityControl() {
  const { activities, show, remove, clearFinished } = useOperationActivity();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const workingCount = activities.filter((activity) => activity.phase === 'working').length;
  const completedCount = activities.filter((activity) => activity.phase === 'done').length;
  React.useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  if (!activities.length) return null;
  return (
    <div className="operation-activity-control" ref={containerRef}>
      <button
        type="button"
        className={`operation-activity-trigger${workingCount ? ' working' : ''}`}
        aria-label={`Transaction activity, ${activities.length} ${activities.length === 1 ? 'item' : 'items'}`}
        aria-expanded={open}
        data-tooltip="Transaction activity"
        onClick={() => setOpen((value) => !value)}
      >
        <InfinityIcon className="ui-icon" aria-hidden="true" />
        <span>{activities.length}</span>
      </button>
      {open ? (
        <section className="operation-activity-menu" aria-label="Transaction activity">
          <div className="operation-activity-heading">
            <div>
              <strong>Transaction activity</strong>
              <span>{workingCount ? `${workingCount} running in the background` : 'No transactions running'}</span>
            </div>
            {completedCount ? (
              <button type="button" onClick={clearFinished}>
                Clear completed
              </button>
            ) : null}
          </div>
          <div className="operation-activity-list">
            {activities.map((activity) => (
              <div className={`operation-activity-item ${activity.phase}`} key={activity.id}>
                <button
                  type="button"
                  className="operation-activity-open"
                  onClick={() => {
                    show(activity.id);
                    setOpen(false);
                  }}
                >
                  <span className="operation-activity-symbol" aria-hidden="true">
                    {activity.asset.image ? (
                      <img src={activity.asset.image} alt="" />
                    ) : (
                      <span>{activity.asset.name.slice(0, 1).toUpperCase()}</span>
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
                      className="operation-activity-confirmations"
                      aria-label={`${activity.confirmations} of ${activity.confirmationTarget} confirmations`}
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
                {activity.phase === 'done' ? (
                  <button
                    type="button"
                    className="operation-activity-remove"
                    aria-label={`Remove ${activity.asset.name} transaction`}
                    onClick={() => remove(activity.id)}
                  >
                    <X className="ui-icon ui-icon--sm" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
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
  const motionAllowed = typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <span
      className="names-cube-preview"
      aria-hidden="true"
      onMouseEnter={() => motionAllowed && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={hovered ? arweaveNamesCube : arweaveNamesCubeStill} alt="" />
    </span>
  );
}

function NameAssetArtwork({
  name,
  className = '',
  showCube = true,
}: {
  name: string;
  className?: string;
  showCube?: boolean;
}) {
  const characterCount = Math.max(1, Array.from(name.trim()).length);
  const fontScale = Math.max(3.5, Math.min(18, 138 / characterCount));
  return (
    <span
      className={`name-asset-artwork${className ? ` ${className}` : ''}`}
      style={{ '--name-font-cqw': fontScale } as React.CSSProperties}
      aria-hidden="true"
    >
      <strong>{name}</strong>
      {showCube ? <img src={arweaveNamesCube} alt="" /> : null}
    </span>
  );
}

const HOME_LISTING_PAGE_SIZE = 24;
const HOME_LISTING_TARGET = 12;
const HOME_LISTING_MAX_PAGES_PER_LOAD = 2;

function Home() {
  const market = React.useContext(MarketContext);
  const { search } = useLocation();
  const [assetView, setAssetView] = React.useState<'recent' | 'listed' | 'price-low' | 'price-high'>('listed');
  const query = new URLSearchParams(search).get('q') ?? '';
  const normalizedQuery = query.trim().toLowerCase();
  const collections = market.collections.filter((collection) => {
    if (!normalizedQuery) return true;
    return (
      `${collection.name} ${collection.description}`.toLowerCase().includes(normalizedQuery) ||
      collection.assets.some((asset) => asset.name.toLowerCase().includes(normalizedQuery))
    );
  });
  const recentAssets = market.collections
    .flatMap((collection) => collection.assets.filter((asset) => asset.image).map((asset) => ({ asset, collection })))
    .filter(
      ({ asset, collection }) =>
        !normalizedQuery || `${asset.name} ${collection.name}`.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, 10);
  const assetKey = recentAssets.map(({ asset }) => asset.id).join(',');
  const [assetPrices, setAssetPrices] = React.useState<Record<string, string | null>>({});
  const [activeListings, setActiveListings] = React.useState<ResolvedAsset[]>([]);
  const [activeListingLimit, setActiveListingLimit] = React.useState(HOME_LISTING_TARGET);
  const [listingLoading, setListingLoading] = React.useState(false);
  const [listingHasMore, setListingHasMore] = React.useState(false);
  const [listingError, setListingError] = React.useState<string | null>(null);
  const [listingRefresh, setListingRefresh] = React.useState(0);
  const listingControllerRef = React.useRef<AbortController | null>(null);
  const listingScanRef = React.useRef<{
    cursor: string | null;
    hasMore: boolean;
    loading: boolean;
    seen: Set<string>;
    results: ResolvedAsset[];
  }>({ cursor: null, hasMore: true, loading: false, seen: new Set(), results: [] });
  const marketCollectionKey = market.collections
    .map((collection) => `${collection.id}:${collection.assets.map((asset) => asset.id).join('.')}`)
    .join(',');
  const collectionKey = collections
    .map((collection) => `${collection.id}:${collection.assets.map((asset) => asset.id).join('.')}`)
    .join(',');
  const [collectionFloors, setCollectionFloors] = React.useState<Record<string, string | null>>({});
  const loadActiveListings = React.useCallback(
    async (target: number, controller: AbortController) => {
      const scan = listingScanRef.current;
      if (scan.loading || controller.signal.aborted) return;
      scan.loading = true;
      setListingLoading(true);
      setListingError(null);
      let pages = 0;
      try {
        while (scan.results.length < target && scan.hasMore && pages < HOME_LISTING_MAX_PAGES_PER_LOAD) {
          const previousCursor = scan.cursor;
          const page = await discoverMarketActivityPage({
            cursor: scan.cursor,
            listingsOnly: true,
            pageSize: HOME_LISTING_PAGE_SIZE,
            signal: controller.signal,
          });
          if (page.hasMore && (!page.cursor || page.cursor === previousCursor)) {
            throw new Error('asset-activity-pagination-stalled');
          }
          scan.cursor = page.cursor;
          scan.hasMore = page.hasMore;
          pages += 1;
          const candidates = page.candidates.filter((candidate) => {
            if (scan.seen.has(candidate.processId)) return false;
            scan.seen.add(candidate.processId);
            return true;
          });
          if (candidates.length) {
            const resolved = await resolveAssetCandidates(candidates, market.collections, {
              signal: controller.signal,
              read: (processId, signal) => readAssetState(processId, { signal, maxAttempts: 1 }),
            });
            const known = new Set(scan.results.map((result) => result.asset.id));
            for (const result of resolved) {
              if (isLiveListing(result) && !known.has(result.asset.id)) {
                scan.results.push(result);
                known.add(result.asset.id);
              }
            }
            scan.results.sort(
              (left, right) =>
                right.activity.height - left.activity.height ||
                right.activity.timestamp - left.activity.timestamp ||
                left.asset.id.localeCompare(right.asset.id),
            );
            setActiveListings([...scan.results]);
          }
          setListingHasMore(scan.hasMore);
        }
      } catch (error) {
        if (!controller.signal.aborted) setListingError(errorMessage(error));
      } finally {
        scan.loading = false;
        if (!controller.signal.aborted) setListingLoading(false);
      }
    },
    [market.collections],
  );
  React.useEffect(() => {
    const refresh = () => setListingRefresh((value) => value + 1);
    window.addEventListener('bazar:asset-operation-finished', refresh);
    return () => window.removeEventListener('bazar:asset-operation-finished', refresh);
  }, []);
  React.useEffect(() => {
    listingControllerRef.current?.abort();
    const controller = new AbortController();
    listingControllerRef.current = controller;
    listingScanRef.current = { cursor: null, hasMore: true, loading: false, seen: new Set(), results: [] };
    setActiveListings([]);
    setActiveListingLimit(HOME_LISTING_TARGET);
    setListingHasMore(false);
    setListingError(null);
    if (!market.loading && market.collections.length) {
      void loadActiveListings(HOME_LISTING_TARGET, controller);
    }
    return () => controller.abort();
  }, [listingRefresh, loadActiveListings, market.loading, marketCollectionKey]);
  React.useEffect(() => {
    const controller = new AbortController();
    setAssetPrices({});
    if (assetView !== 'recent') return () => controller.abort();
    void Promise.all(
      recentAssets.map(async ({ asset }) => {
        try {
          const { state } = await readAssetState(asset.id, { signal: controller.signal, maxAttempts: 1 });
          const order = liveOrderOfAsset(state);
          return [asset.id, order ? `${winstonToAr(order.asking)} AR` : null] as const;
        } catch {
          return [asset.id, null] as const;
        }
      }),
    ).then((prices) => {
      if (!controller.signal.aborted) setAssetPrices(Object.fromEntries(prices));
    });
    return () => controller.abort();
  }, [assetKey, assetView]);
  React.useEffect(() => {
    const controller = new AbortController();
    setCollectionFloors({});
    void Promise.all(
      collections.map(async (collection) => {
        try {
          const candidates = await discoverMarketActivity({
            recipients: collection.assets.map((asset) => asset.id),
            listingsOnly: true,
            signal: controller.signal,
          });
          const resolved = await resolveAssetCandidates(candidates, [collection], {
            signal: controller.signal,
            read: (processId, signal) => readAssetState(processId, { signal, maxAttempts: 1 }),
          });
          let floor: bigint | null = null;
          for (const result of resolved) {
            const order = liveOrderOfAsset(result.state);
            if (!order) continue;
            const asking = BigInt(order.asking);
            if (floor === null || asking < floor) floor = asking;
          }
          return [collection.id, floor === null ? null : `${winstonToAr(floor.toString())} AR`] as const;
        } catch {
          return [collection.id, null] as const;
        }
      }),
    ).then((floors) => {
      if (!controller.signal.aborted) setCollectionFloors(Object.fromEntries(floors));
    });
    return () => controller.abort();
  }, [collectionKey]);
  const recentCards = recentAssets.map(({ asset, collection }) => ({
    asset,
    collection,
    price: asset.id in assetPrices ? assetPrices[asset.id] : undefined,
  }));
  const listingCards = activeListings
    .map((result) => ({
      asset: result.asset,
      collection: result.collection,
      price: `${winstonToAr(liveOrderOfAsset(result.state)!.asking)} AR`,
    }))
    .filter(
      ({ asset, collection }) =>
        !normalizedQuery || `${asset.name} ${collection.name}`.toLowerCase().includes(normalizedQuery),
    )
    .sort((left, right) => {
      if (assetView !== 'price-low' && assetView !== 'price-high') return 0;
      const leftPrice = Number(left.price.replace(/,/g, '').replace(/\s+AR$/, ''));
      const rightPrice = Number(right.price.replace(/,/g, '').replace(/\s+AR$/, ''));
      return assetView === 'price-low' ? leftPrice - rightPrice : rightPrice - leftPrice;
    });
  const displayedAssets = assetView === 'recent' ? recentCards : listingCards.slice(0, activeListingLimit);
  const canLoadMoreListings = listingCards.length > activeListingLimit || listingHasMore;
  const showMoreListings = () => {
    const nextLimit = activeListingLimit + HOME_LISTING_TARGET;
    setActiveListingLimit(nextLimit);
    const controller = listingControllerRef.current;
    if (listingCards.length < nextLimit && controller && !controller.signal.aborted) {
      void loadActiveListings(nextLimit, controller);
    }
  };
  return (
    <div className="home-shell">
      <div className="home-main">
        <div className="home-content">
          <div className="home-market-layout">
            <section className="home-section" id="featured">
              <div className="home-section-heading">
                <div>
                  <h1>Collections</h1>
                  <p>Permanent assets with ownership and settlement native to Arweave.</p>
                </div>
              </div>
              {market.loading ? <Loading label="Loading collection indexes from Arweave…" /> : null}
              {market.error ? <ErrorPanel message={market.error} /> : null}
              <div className="home-feature-grid">
                {collections.slice(0, 3).map((collection, index) => {
                  const image = collection.assets.find((asset) => asset.image)?.image;
                  return (
                    <Link
                      className={`home-feature-card feature-${index}`}
                      key={collection.id}
                      to={`/collection/${collection.id}`}
                    >
                      <div className="home-feature-art">
                        {image ? (
                          <img src={image} alt="" />
                        ) : collection.kind === 'names' ? (
                          <NamesCubePreview />
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
                          <span>Assets</span>
                          <strong>{(collection.total ?? collection.assets.length).toLocaleString()}</strong>
                        </div>
                        <div>
                          <span>Floor</span>
                          <strong>
                            {collection.id in collectionFloors
                              ? (collectionFloors[collection.id] ?? 'No listings')
                              : 'Checking…'}
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
              </div>
              {!market.loading && !market.error && collections.length === 0 ? (
                <div className="home-no-results">No collections match “{query}”.</div>
              ) : null}
            </section>

            {recentAssets.length || activeListings.length || listingLoading || listingError ? (
              <section className="home-section home-assets" id="assets">
                <div className="home-section-heading">
                  <div>
                    <h2>Discover assets</h2>
                    <p>
                      {assetView === 'recent'
                        ? 'Individual assets from the latest permanent collection indexes.'
                        : 'Verified active listings across every marketplace collection.'}
                    </p>
                  </div>
                  <MarketSelect<'recent' | 'listed' | 'price-low' | 'price-high'>
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
                <div className="home-asset-grid">
                  {displayedAssets.map(({ asset, collection, price }) => (
                    <Link key={`${collection.id}-${asset.id}`} to={`/asset/${collection.id}/${asset.id}`}>
                      {asset.image ? (
                        <img className="home-asset-media" src={asset.image} alt="" />
                      ) : collection.kind === 'names' ? (
                        <NameAssetArtwork
                          className="home-asset-media name-asset-artwork--card"
                          name={asset.name}
                          showCube={false}
                        />
                      ) : (
                        <span className="home-asset-media home-asset-placeholder" aria-hidden="true">
                          <BazarMark />
                        </span>
                      )}
                      <div className="home-asset-details">
                        <div>
                          <strong>{asset.name}</strong>
                          <span>{collection.name}</span>
                        </div>
                        <b className={`home-asset-price${price ? ' listed' : ''}`}>
                          {price === undefined ? 'Checking…' : (price ?? 'Not listed')}
                        </b>
                      </div>
                    </Link>
                  ))}
                </div>
                {assetView !== 'recent' && listingLoading ? (
                  <div className="home-assets-status">Verifying recent listing activity…</div>
                ) : null}
                {assetView !== 'recent' && listingError ? <ErrorPanel message={listingError} /> : null}
                {assetView !== 'recent' && !displayedAssets.length ? (
                  <div className="home-assets-empty">
                    {listingLoading ? 'Checking live listings…' : 'No active listings found in the latest activity.'}
                  </div>
                ) : null}
                {assetView !== 'recent' && canLoadMoreListings ? (
                  <button className="load-more" disabled={listingLoading} onClick={showMoreListings}>
                    {listingLoading ? 'Checking listings…' : 'Load more listings'}
                  </button>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
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
      try {
        await wallet.connect();
      } catch (cause) {
        setError(mintErrorMessage(cause));
      }
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
          'uploading-media': 'Uploading media permanently…',
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
            : 'Mint a group of one-of-one assets and publish their permanent, shareable collection index.'}
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
            <span>The media for “{draft.name}” is already permanent. Only the asset process remains.</span>
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
                  Attach permanent, machine-readable terms to {mode === 'asset' ? 'this asset' : 'every asset'}.
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
              <span>{mode === 'asset' ? 'Storage' : 'Transactions'}</span>
              <strong>
                {mode === 'asset' ? 'Permanent' : collectionEstimate ? collectionEstimate.transactionCount : '—'}
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
                  : 'Each image becomes a one-of-one asset. Bazar then publishes a permanent collection manifest and index.'}
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
                <strong>{collectionResult ? 'Collection submitted to Arweave' : 'Mint submitted to Arweave'}</strong>
                <p>
                  {collectionResult
                    ? 'The permanent collection index may take a few minutes to become available through every gateway.'
                    : resultReady
                      ? 'The asset is live and computable through the selected gateway.'
                      : 'Watching Arweave continuously. You can view the asset as soon as its live state resolves.'}
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
            Uploads are permanent. Review every image, name, and description before signing.
          </p>
        </form>
      </div>
    </section>
  );
}

function GatewayControl() {
  const current = new URLSearchParams(window.location.search).get('node') ?? 'https://arweave.net';
  const [value, setValue] = React.useState(current);
  function apply() {
    try {
      const origin = new URL(value.includes('://') ? value : `https://${value}`).origin;
      const url = new URL(window.location.href);
      url.searchParams.set('node', origin);
      window.location.assign(url);
    } catch {
      setValue(current);
    }
  }
  return (
    <details className="gateway">
      <summary aria-label="Compute gateway" data-tooltip={`Compute gateway: ${current}`}>
        <Server className="ui-icon ui-icon--sm" aria-hidden="true" />
      </summary>
      <div>
        <label>
          HyperBEAM gateway
          <input value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
        <button className="with-icon" onClick={apply}>
          <Server className="ui-icon ui-icon--sm" aria-hidden="true" /> Use gateway
        </button>
        <p>Process reads and browser-safe observer checks use this node. Transactions still settle on Arweave.</p>
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

  return (
    <div className="market-select" ref={rootRef}>
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
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
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

function CollectionView() {
  const { collectionId = '' } = useParams();
  const market = React.useContext(MarketContext);
  const indexedCollection = market.collections.find((item) => item.id === collectionId);
  const [remoteCollection, setRemoteCollection] = React.useState<Collection | null>(null);
  const [remoteCollectionLoading, setRemoteCollectionLoading] = React.useState(false);
  React.useEffect(() => {
    if (indexedCollection || !/^[A-Za-z0-9_-]{43}$/.test(collectionId)) {
      setRemoteCollection(null);
      return;
    }
    const controller = new AbortController();
    setRemoteCollectionLoading(true);
    void loadCollectionReference(collectionId, controller.signal)
      .then(
        (loaded) => {
          if (!controller.signal.aborted) {
            setRemoteCollection(loaded);
            market.addCollection(loaded);
          }
        },
        () => undefined,
      )
      .finally(() => {
        if (!controller.signal.aborted) setRemoteCollectionLoading(false);
      });
    return () => controller.abort();
  }, [collectionId, indexedCollection]);
  const collection = indexedCollection ?? remoteCollection;
  const [query, setQuery] = React.useState('');
  const [limit, setLimit] = React.useState(48);
  const [sort, setSort] = React.useState<'default' | 'recent'>('default');
  const [listedOnly, setListedOnly] = React.useState(false);
  const [initial, setInitial] = React.useState<string>('all');
  const [activity, setActivity] = React.useState<AssetCandidate[]>([]);
  const [listed, setListed] = React.useState<ResolvedAsset[]>([]);
  const [cardPrices, setCardPrices] = React.useState<Record<string, string | null>>({});
  const [cardPricesLoading, setCardPricesLoading] = React.useState(false);
  const [cardPricesUnavailable, setCardPricesUnavailable] = React.useState(false);
  const [pageLoading, setPageLoading] = React.useState(false);
  const [pageError, setPageError] = React.useState<string | null>(null);
  const [activityState, setActivityState] = React.useState({
    loading: false,
    resolved: 0,
    total: 0,
    error: null as string | null,
  });
  const [retry, setRetry] = React.useState(0);
  const gateway = servingNodeOrigin(window.location);
  const loadNextCarrierPage = async () => {
    if (!collection || pageLoading) return;
    setPageLoading(true);
    setPageError(null);
    try {
      await market.loadMore(collection.id);
    } catch (cause) {
      setPageError(errorMessage(cause));
    } finally {
      setPageLoading(false);
    }
  };
  React.useEffect(() => {
    if (!collection) return;
    const controller = new AbortController();
    setCardPrices({});
    setCardPricesLoading(true);
    setCardPricesUnavailable(false);
    void (async () => {
      try {
        const candidates = await discoverMarketActivity({
          recipients: collection.assets.map((asset) => asset.id),
          listingsOnly: true,
          signal: controller.signal,
        });
        const resolved = await resolveAssetCandidates(candidates, [collection], {
          signal: controller.signal,
          read: (processId, signal) => readAssetState(processId, { signal, maxAttempts: 1 }),
        });
        if (controller.signal.aborted) return;
        const prices: Record<string, string | null> = Object.fromEntries(
          collection.assets.map((asset) => [asset.id, null]),
        );
        for (const result of resolved) {
          const order = liveOrderOfAsset(result.state);
          if (order) prices[result.asset.id] = `${winstonToAr(order.asking)} AR`;
        }
        setCardPrices(prices);
      } catch {
        if (!controller.signal.aborted) setCardPricesUnavailable(true);
      } finally {
        if (!controller.signal.aborted) setCardPricesLoading(false);
      }
    })();
    return () => controller.abort();
  }, [collection]);
  React.useEffect(() => {
    if (!collection || (!listedOnly && sort === 'default')) {
      setActivity([]);
      setListed([]);
      setActivityState({ loading: false, resolved: 0, total: 0, error: null });
      return;
    }
    const controller = new AbortController();
    setActivity([]);
    setListed([]);
    setActivityState({ loading: true, resolved: 0, total: 0, error: null });
    void (async () => {
      try {
        const allActivity = await discoverMarketActivity({
          signal: controller.signal,
          listingsOnly: listedOnly,
          ...(!listedOnly || collection.kind === 'images'
            ? { recipients: collection.assets.map((asset) => asset.id) }
            : {}),
        });
        if (controller.signal.aborted) return;
        const candidates =
          collection.kind === 'images'
            ? allActivity.filter((candidate) => collection.assets.some((asset) => asset.id === candidate.processId))
            : allActivity;
        setActivity(candidates);
        if (!listedOnly) {
          setActivityState({
            loading: false,
            resolved: candidates.length,
            total: candidates.length,
            error: null,
          });
          return;
        }
        setActivityState({ loading: true, resolved: 0, total: candidates.length, error: null });
        await resolveAssetCandidates(candidates, [collection], {
          signal: controller.signal,
          onSettled: (result) => {
            if (controller.signal.aborted) return;
            setActivityState((current) => ({ ...current, resolved: current.resolved + 1 }));
            if (result && isLiveListing(result)) {
              setListed((current) => [...current.filter((item) => item.asset.id !== result.asset.id), result]);
            }
          },
        });
        if (!controller.signal.aborted) {
          setActivityState((current) => ({ ...current, loading: false }));
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setActivityState((current) => ({
            ...current,
            loading: false,
            error: errorMessage(cause),
          }));
        }
      }
    })();
    return () => controller.abort();
  }, [collection, gateway, listedOnly, retry, sort]);
  React.useEffect(() => setLimit(48), [initial, listedOnly, query, sort]);
  if (market.loading || remoteCollectionLoading) return <Loading label="Reading collection index…" />;
  if (!collection) return <ErrorPanel message="This collection could not be found on Arweave." />;
  const activityByAsset = new Map(activity.map((candidate) => [candidate.processId, candidate]));
  const defaultIndex = new Map(collection.assets.map((asset, index) => [asset.id, index]));
  const visibleAssets = listedOnly ? listed.map((result) => result.asset) : collection.assets;
  const filtered = visibleAssets
    .filter(
      (asset) =>
        asset.name.toLowerCase().includes(query.toLowerCase()) &&
        (initial === 'all' || asset.name.trim().toUpperCase().startsWith(initial)),
    )
    .sort((a, b) => {
      if (initial !== 'all') return a.name.localeCompare(b.name);
      if (sort === 'recent') {
        const activityA = activityByAsset.get(a.id);
        const activityB = activityByAsset.get(b.id);
        return (
          (activityB?.height ?? 0) - (activityA?.height ?? 0) ||
          (activityB?.timestamp ?? 0) - (activityA?.timestamp ?? 0) ||
          a.name.localeCompare(b.name)
        );
      }
      return (
        (defaultIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (defaultIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name)
      );
    });
  return (
    <section className="collection-page">
      <Link className="back" to="/">
        <ArrowLeft className="ui-icon ui-icon--sm" aria-hidden="true" /> All collections
      </Link>
      <div className="collection-title">
        <div>
          <p className="eyebrow">{collection.kind === 'names' ? 'Carrier assets' : 'Token assets'}</p>
          <h1>{collection.name}</h1>
        </div>
        <p>{collection.description}</p>
      </div>
      <CollectionTabs collection={collection} active="assets" />
      {collection.kind === 'names' ? (
        <>
          <nav className="alphabet-filter" aria-label="Filter loaded names by first letter">
            <button
              aria-pressed={initial === 'all'}
              className={initial === 'all' ? 'active' : undefined}
              type="button"
              onClick={() => setInitial('all')}
            >
              All
            </button>
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => (
              <button
                aria-label={`Loaded names beginning with ${letter}`}
                aria-pressed={initial === letter}
                className={initial === letter ? 'active' : undefined}
                key={letter}
                type="button"
                onClick={() => setInitial(letter)}
              >
                {letter}
              </button>
            ))}
          </nav>
          {collection.hasMore ? (
            <p className="collection-index-note">
              Showing {collection.assets.length.toLocaleString()} of{' '}
              {(collection.total ?? collection.assets.length).toLocaleString()} indexed names. Search and A–Z filters
              cover loaded names only.
            </p>
          ) : null}
        </>
      ) : null}
      <div className="asset-tools">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this collection" />
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
              { value: 'default', label: 'Default' },
              { value: 'recent', label: 'Recent activity' },
            ]}
            value={sort}
          />
        </div>
        <span>
          {activityState.loading && listedOnly
            ? activityState.total
              ? `Resolving live listings ${activityState.resolved.toLocaleString()} / ${activityState.total.toLocaleString()}`
              : 'Finding listing activity on Arweave…'
            : query
              ? `${filtered.length.toLocaleString()} loaded matches`
              : initial !== 'all'
                ? `${filtered.length.toLocaleString()} loaded names beginning with ${initial}`
                : listedOnly
                  ? `${filtered.length.toLocaleString()} live listings`
                  : `${collection.assets.length.toLocaleString()} of ${(collection.total ?? collection.assets.length).toLocaleString()}`}
        </span>
      </div>
      {activityState.error ? (
        <div className="inline-error">
          <span>{activityState.error}</span>
          <button className="with-icon" onClick={() => setRetry((value) => value + 1)}>
            <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
          </button>
        </div>
      ) : null}
      <div className="asset-grid">
        {filtered.slice(0, limit).map((asset) => (
          <AssetCard
            key={asset.id}
            collection={collection}
            asset={asset}
            badge={listedOnly ? 'For sale' : undefined}
            price={
              cardPricesLoading
                ? 'Checking…'
                : cardPricesUnavailable
                  ? 'Unavailable'
                  : (cardPrices[asset.id] ?? 'Not listed')
            }
            priceListed={Boolean(cardPrices[asset.id])}
          />
        ))}
      </div>
      {listedOnly && !activityState.loading && !activityState.error && !filtered.length ? (
        <div className="empty-state">
          <h3>No live listings</h3>
          <p>Every candidate was checked against current process state through {gateway}.</p>
        </div>
      ) : null}
      {!listedOnly && !filtered.length ? (
        <div className="collection-empty-state">
          <span>
            <Search className="ui-icon" aria-hidden="true" />
          </span>
          <h3>
            {query
              ? `No assets match “${query}”`
              : initial !== 'all'
                ? `No loaded names beginning with ${initial}`
                : 'Nothing here yet'}
          </h3>
          <p>
            {query
              ? 'Try a shorter search or clear the current query.'
              : initial !== 'all'
                ? collection.hasMore
                  ? 'Load more names from Arweave or try another letter.'
                  : 'Try another letter or return to all names.'
                : 'This collection does not contain any indexed assets yet.'}
          </p>
          {query || initial !== 'all' ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setInitial('all');
              }}
            >
              {initial !== 'all' ? 'View all names' : 'Clear search'}
            </button>
          ) : null}
        </div>
      ) : null}
      {pageError ? (
        <div className="inline-error collection-page-error">
          <span>{pageError}</span>
          <button className="with-icon" onClick={() => void loadNextCarrierPage()}>
            <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Try again
          </button>
        </div>
      ) : null}
      {limit < filtered.length ? (
        <button className="load-more" onClick={() => setLimit((value) => value + 48)}>
          Show more
        </button>
      ) : collection.hasMore && !query && !listedOnly && !pageError ? (
        <button className="load-more" disabled={pageLoading} onClick={() => void loadNextCarrierPage()}>
          {pageLoading ? 'Loading 100 more…' : 'Load next 100 names from Arweave'}
        </button>
      ) : null}
    </section>
  );
}

function CollectionActivityView() {
  const { collectionId = '' } = useParams();
  const market = React.useContext(MarketContext);
  const collection = market.collections.find((item) => item.id === collectionId);
  const [events, setEvents] = React.useState<CollectionActivityEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [retry, setRetry] = React.useState(0);

  React.useEffect(() => {
    if (!collection) return;
    const controller = new AbortController();
    setEvents([]);
    setLoading(true);
    setError(null);
    void discoverCollectionActivity({
      recipients: collection.assets.map((asset) => asset.id),
      signal: controller.signal,
      limit: 100,
      onPage: (page) => {
        if (!controller.signal.aborted) {
          setEvents((current) => [...current, ...page]);
        }
      },
    }).then(
      () => {
        if (!controller.signal.aborted) setLoading(false);
      },
      (cause) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(cause));
          setLoading(false);
        }
      },
    );
    return () => controller.abort();
  }, [collection, retry]);

  if (market.loading) return <Loading label="Reading collection index…" />;
  if (!collection) return <ErrorPanel message="This collection could not be found on Arweave." />;
  const assets = new Map(collection.assets.map((asset) => [asset.id, asset]));
  return (
    <section className="collection-page collection-activity-page">
      <Link className="back" to="/">
        <ArrowLeft className="ui-icon ui-icon--sm" aria-hidden="true" /> All collections
      </Link>
      <div className="collection-title">
        <div>
          <p className="eyebrow">Permanent activity</p>
          <h1>{collection.name}</h1>
        </div>
        <p>
          Recent signed market actions discovered from Arweave. Current ownership and listing status still come only
          from live process state.
        </p>
      </div>
      <CollectionTabs collection={collection} active="activity" />
      <div className="activity-heading">
        <div>
          <strong>Recent market activity</strong>
          <span>Newest first · up to 100 permanent transactions</span>
        </div>
        <button className="with-icon" onClick={() => setRetry((value) => value + 1)} disabled={loading}>
          <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {error ? <ErrorPanel message={error} /> : null}
      <div className="activity-list" aria-live="polite">
        {events.map((event) => {
          const asset = assets.get(event.processId);
          return (
            <article className="activity-row" key={event.id}>
              <span className={`activity-icon action-${event.action}`}>{activitySymbol(event.action)}</span>
              <div className="activity-main">
                <strong>{activityLabel(event.action)}</strong>
                {asset ? (
                  <Link to={`/asset/${collection.id}/${asset.id}`}>{asset.name}</Link>
                ) : (
                  <span>{short(event.processId)}</span>
                )}
              </div>
              <div className="activity-actor">
                <span>Actor</span>
                <strong>{event.actor ? short(event.actor) : 'Unknown'}</strong>
              </div>
              <div className="activity-block">
                <span>{event.timestamp ? formatTimestamp(event.timestamp) : 'Pending timestamp'}</span>
                <a href={`https://arweave.net/${event.id}`} target="_blank" rel="noreferrer">
                  Block {event.height.toLocaleString()}
                  <ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
                </a>
              </div>
            </article>
          );
        })}
      </div>
      {loading && !events.length ? <Loading label="Reading recent collection activity from Arweave…" /> : null}
      {!loading && !error && !events.length ? (
        <div className="empty-state">
          <h3>No market activity yet</h3>
          <p>This collection has no matching permanent market actions in the current index.</p>
        </div>
      ) : null}
    </section>
  );
}

function CollectionTabs({ collection, active }: { collection: Collection; active: 'assets' | 'activity' }) {
  return (
    <nav className="collection-tabs" aria-label={`${collection.name} views`}>
      <Link className={active === 'assets' ? 'active' : ''} to={`/collection/${collection.id}`}>
        <LayoutGrid className="ui-icon ui-icon--sm" aria-hidden="true" /> Assets
      </Link>
      <Link className={active === 'activity' ? 'active' : ''} to={`/collection/${collection.id}/activity`}>
        <History className="ui-icon ui-icon--sm" aria-hidden="true" /> Activity
      </Link>
    </nav>
  );
}

function AssetCard({
  collection,
  asset,
  badge,
  price,
  priceListed = false,
}: {
  collection: Collection;
  asset: AssetSummary;
  badge?: string;
  price?: string;
  priceListed?: boolean;
}) {
  return (
    <Link className="asset-card" to={`/asset/${collection.id}/${asset.id}`}>
      <div className="asset-media">
        {asset.image ? (
          <img src={asset.image} loading="lazy" alt="" />
        ) : (
          <span>{asset.name.slice(0, 1).toUpperCase()}</span>
        )}
        {badge ? <strong className="asset-badge">{badge}</strong> : null}
      </div>
      <div className="asset-card-copy">
        <p>{collection.name}</p>
        <div className="asset-card-heading">
          <h3>{asset.name}</h3>
          {price ? <strong className={priceListed ? 'listed' : undefined}>{price}</strong> : null}
        </div>
        <span>{short(asset.id)}</span>
      </div>
    </Link>
  );
}

function MyAssetsView() {
  const market = React.useContext(MarketContext);
  const wallet = useWallet();
  const gateway = servingNodeOrigin(window.location);
  const [retry, setRetry] = React.useState(0);
  const [results, setResults] = React.useState<ResolvedAsset[]>([]);
  const [status, setStatus] = React.useState({
    phase: 'discovering' as 'discovering' | 'resolving' | 'done' | 'error',
    discovered: 0,
    resolved: 0,
    total: 0,
    failures: 0,
    error: null as string | null,
  });
  React.useEffect(() => {
    if (!wallet.address || market.loading || market.error) return;
    const controller = new AbortController();
    const walletAddress = wallet.address;
    const discovered = new Set<string>();
    const attempted = new Set<string>();
    setResults([]);
    setStatus({
      phase: 'discovering',
      discovered: 0,
      resolved: 0,
      total: 0,
      failures: 0,
      error: null,
    });
    void (async () => {
      try {
        const resolvePage = async (page: AssetCandidate[]) => {
          for (const candidate of page) discovered.add(candidate.processId);
          const candidates = restrictAssetCandidates(page, market.collections).filter(
            (candidate) => !attempted.has(candidate.processId),
          );
          for (const candidate of candidates) attempted.add(candidate.processId);
          if (!controller.signal.aborted) {
            setStatus((current) => ({
              ...current,
              phase: candidates.length ? 'resolving' : current.phase,
              discovered: discovered.size,
              total: current.total + candidates.length,
            }));
          }
          await resolveAssetCandidates(candidates, market.collections, {
            signal: controller.signal,
            onSettled: (result, _candidate, error) => {
              if (controller.signal.aborted) return;
              setStatus((current) => ({
                ...current,
                resolved: current.resolved + 1,
                failures: current.failures + (error ? 1 : 0),
              }));
              if (result && walletAssetGroup(result, walletAddress)) {
                setResults((current) =>
                  [...current.filter((item) => item.asset.id !== result.asset.id), result].sort(
                    (a, b) => b.activity.height - a.activity.height || b.activity.timestamp - a.activity.timestamp,
                  ),
                );
              }
            },
          });
        };
        const locallyCreated =
          market.collections
            .find((collection) => collection.id === CREATED_COLLECTION_ID)
            ?.assets.map<AssetCandidate>((asset) => ({
              processId: asset.id,
              height: 0,
              timestamp: 0,
              sources: ['initial-holder'],
              device: 'token@1.0',
              collection: 'Created on Bazar',
              bazarMint: true,
            })) ?? [];
        await resolvePage(locallyCreated);
        const discoveredCandidates = await discoverWalletAssetCandidates(walletAddress, {
          signal: controller.signal,
          onPage: resolvePage,
        });
        if (controller.signal.aborted) return;
        await resolvePage(discoveredCandidates.filter((candidate) => !attempted.has(candidate.processId)));
        if (!controller.signal.aborted) {
          setStatus((current) => ({
            ...current,
            phase: 'done',
            discovered: discoveredCandidates.length,
          }));
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setStatus((current) => ({
            ...current,
            phase: 'error',
            error: errorMessage(cause),
          }));
        }
      }
    })();
    return () => controller.abort();
  }, [gateway, market.collections, market.error, market.loading, retry, wallet.address]);

  if (!wallet.address) {
    return (
      <section className="my-assets-page">
        <p className="eyebrow">Your wallet</p>
        <h1>My assets</h1>
        <div className="empty-state">
          <h3>Connect a wallet to resolve its assets</h3>
          <p>No signature is requested. Candidate history and live state are read-only.</p>
          <button className="primary with-icon" onClick={() => void wallet.connect()}>
            <Wallet className="ui-icon ui-icon--sm" aria-hidden="true" />
            Connect wallet
          </button>
        </div>
      </section>
    );
  }
  const owned = results.filter((result) => walletAssetGroup(result, wallet.address!) === 'owned');
  const listed = results.filter((result) => walletAssetGroup(result, wallet.address!) === 'listed');
  const working = status.phase === 'discovering' || status.phase === 'resolving';
  return (
    <section className="my-assets-page">
      <div className="my-assets-heading">
        <div>
          <p className="eyebrow">Live wallet inventory</p>
          <h1>My assets</h1>
          <p>Ownership is computed now through {gateway}. Transaction history only tells Bazar what to check.</p>
        </div>
        <button className="with-icon" onClick={() => setRetry((value) => value + 1)} disabled={working}>
          <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />
          {working ? 'Resolving…' : 'Retry'}
        </button>
      </div>
      {status.error ? (
        <div className="inline-error">
          <span>{status.error}</span>
          <button className="with-icon" onClick={() => setRetry((value) => value + 1)}>
            <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
          </button>
        </div>
      ) : null}
      <AssetGroup title="Listed for sale" results={listed} badge="For sale" />
      <AssetGroup title="Owned" results={owned} badge="Owned" />
      {status.phase === 'done' && !results.length ? (
        <div className="empty-state">
          <h3>No supported assets are currently owned</h3>
          <p>
            {status.failures
              ? `${status.failures} candidates could not be computed. Retry to check them again.`
              : 'Sold and transferred assets are automatically omitted from this live view.'}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function AssetGroup({ title, results, badge }: { title: string; results: ResolvedAsset[]; badge: string }) {
  if (!results.length) return null;
  return (
    <section className="asset-group">
      <div className="asset-group-title">
        <h2>{title}</h2>
        <span>{results.length.toLocaleString()}</span>
      </div>
      <div className="asset-grid">
        {results.map((result) => (
          <AssetCard key={result.asset.id} collection={result.collection} asset={result.asset} badge={badge} />
        ))}
      </div>
    </section>
  );
}

function AssetView() {
  const { collectionId = '', assetId = '' } = useParams();
  const market = React.useContext(MarketContext);
  const wallet = useWallet();
  const transactionActivity = useOperationActivity();
  const indexedCollection = market.collections.find((item) => item.id === collectionId);
  const awaitLocalMint = Boolean(
    collectionId === CREATED_COLLECTION_ID && indexedCollection?.assets.some((item) => item.id === assetId),
  );
  const [remoteCollection, setRemoteCollection] = React.useState<Collection | null>(null);
  const [state, setState] = React.useState<AssetState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [assetActivity, setAssetActivity] = React.useState<CollectionActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = React.useState(true);
  React.useEffect(() => {
    if (indexedCollection || collectionId === CREATED_COLLECTION_ID || !/^[A-Za-z0-9_-]{43}$/.test(collectionId)) {
      setRemoteCollection(null);
      return;
    }
    const controller = new AbortController();
    void loadCollectionReference(collectionId, controller.signal).then(
      (loaded) => {
        if (!controller.signal.aborted) {
          setRemoteCollection(loaded);
          market.addCollection(loaded);
        }
      },
      () => undefined,
    );
    return () => controller.abort();
  }, [collectionId, indexedCollection]);
  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const result = awaitLocalMint
          ? await waitForAssetState(assetId, () => true, { signal, interval: 4000, timeout: 0 })
          : await readAssetState(assetId, { signal });
        if (!signal?.aborted) setState(result.state);
      } catch (cause) {
        if (!signal?.aborted) setError(errorMessage(cause));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [assetId, awaitLocalMint],
  );
  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  React.useEffect(() => {
    const refresh = (event: Event) => {
      if ((event as CustomEvent<string>).detail === assetId) void load();
    };
    window.addEventListener('bazar:asset-operation-finished', refresh);
    return () => window.removeEventListener('bazar:asset-operation-finished', refresh);
  }, [assetId, load]);
  React.useEffect(() => {
    const controller = new AbortController();
    setAssetActivity([]);
    setActivityLoading(true);
    void discoverCollectionActivity({ recipients: [assetId], signal: controller.signal, limit: 24 })
      .then(
        (events) => {
          if (!controller.signal.aborted) setAssetActivity(events);
        },
        () => undefined,
      )
      .finally(() => {
        if (!controller.signal.aborted) setActivityLoading(false);
      });
    return () => controller.abort();
  }, [assetId]);
  React.useEffect(() => {
    if (!wallet.address || !state || transactionActivity.activities.some((activity) => activity.asset.id === assetId))
      return;
    const indexedActivityAsset =
      indexedCollection?.assets.find((item) => item.id === assetId) ??
      remoteCollection?.assets.find((item) => item.id === assetId);
    const fallbackActivityAsset: AssetSummary = indexedActivityAsset ?? {
      id: assetId,
      name: state.name || short(assetId),
    };
    try {
      const saved = JSON.parse(localStorage.getItem(`bazar-purchase:${assetId}`) ?? 'null');
      if (saved?.buyer === wallet.address && saved?.order) {
        if (!state.orders[saved.order.orderId] && state.balances[wallet.address] === '1') {
          localStorage.removeItem(`bazar-purchase:${assetId}`);
        } else {
          transactionActivity.start({
            asset: indexedActivityAsset ?? saved.asset ?? fallbackActivityAsset,
            collectionId,
            owner: wallet.address,
            operation: { kind: 'buy', order: saved.order, resume: saved.snapshot },
          });
          return;
        }
      }
      const order = liveOrder(state);
      if (order && order.creator !== wallet.address) {
        const client = new AssetTransactionClient();
        const registrationId = client.findStoredRegistration(assetId, order.orderId, wallet.address);
        if (registrationId) {
          transactionActivity.start({
            asset: fallbackActivityAsset,
            collectionId,
            owner: wallet.address,
            operation: {
              kind: 'buy',
              order,
              resume: {
                registration: { id: registrationId, dispatched: false },
              },
            },
          });
          return;
        }
      }
      const savedOperation = JSON.parse(localStorage.getItem(`bazar-operation:${assetId}`) ?? 'null');
      if (
        savedOperation?.signer === wallet.address &&
        typeof savedOperation?.txId === 'string' &&
        ['sell', 'cancel', 'transfer'].includes(savedOperation?.kind)
      ) {
        if (savedOperation.kind === 'cancel' && savedOperation.order) {
          transactionActivity.start({
            asset: indexedActivityAsset ?? savedOperation.asset ?? fallbackActivityAsset,
            collectionId,
            owner: wallet.address,
            operation: { kind: 'cancel', order: savedOperation.order, resumeId: savedOperation.txId },
          });
        } else {
          transactionActivity.start({
            asset: indexedActivityAsset ?? savedOperation.asset ?? fallbackActivityAsset,
            collectionId,
            owner: wallet.address,
            operation: {
              kind: savedOperation.kind,
              resumeId: savedOperation.txId,
              value: savedOperation.value,
            },
          });
        }
      }
    } catch {
      localStorage.removeItem(`bazar-purchase:${assetId}`);
      localStorage.removeItem(`bazar-operation:${assetId}`);
    }
  }, [
    assetId,
    collectionId,
    indexedCollection,
    remoteCollection,
    state,
    transactionActivity.activities,
    transactionActivity.start,
    wallet.address,
  ]);
  const collection =
    indexedCollection ??
    remoteCollection ??
    (collectionId === CREATED_COLLECTION_ID ? createdCollection([]) : undefined);
  const indexedAsset = collection?.assets.find((item) => item.id === assetId);
  if (market.loading) return <Loading label="Reading collection index…" />;
  if (!collection) return <ErrorPanel message="This collection could not be found on Arweave." />;
  const asset =
    indexedAsset ??
    (collection.kind === 'names' && state && ['carrier@1.0', 'name-token@1.0'].includes(state.device)
      ? { id: assetId, name: state.name || short(assetId) }
      : collection.id === CREATED_COLLECTION_ID && state?.device === 'token@1.0'
        ? assetFromMintState(assetId, state.raw, state.name)
        : null);
  if (!asset && !loading) return <ErrorPanel message="This asset is not in the selected collection." />;
  if (!asset) return <Loading label="Computing current state…" />;
  const owner = state ? ownerOfAsset(state) : null;
  const order = state ? liveOrder(state) : null;
  const mine = Boolean(wallet.address && owner === wallet.address);
  const license = state ? licenseProperties(state) : [];
  const description = assetDescription(state, collection.description);
  const moreAssets = collection.assets.filter((item) => item.id !== asset.id).slice(0, 4);
  const startOperation = (operation: Operation) => {
    if (!wallet.address) return;
    transactionActivity.start({ asset, collectionId: collection.id, owner: wallet.address, operation });
  };
  return (
    <section className="asset-page asset-detail-page">
      <div className="asset-detail-layout">
        <div className="asset-visual-column">
          <div className="asset-hero-media">
            {asset.image ? (
              <img src={asset.image} alt={asset.name} />
            ) : collection.kind === 'names' ? (
              <NameAssetArtwork className="name-asset-artwork--hero" name={asset.name} />
            ) : (
              <span>{asset.name.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
        </div>
        <div className="asset-commerce-column">
          <div className="asset-details asset-identity">
            <div className="asset-kicker">
              <Link className="asset-collection-link" to={`/collection/${collection.id}`}>
                {collection.name}
              </Link>
            </div>
            <h1>{asset.name}</h1>
            <div className="asset-owner-line">
              <span>Owned by</span>
              {owner ? (
                <a href={`https://arweave.net/${owner}`} target="_blank" rel="noreferrer">
                  {short(owner)} <ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
                </a>
              ) : (
                <strong>Unassigned</strong>
              )}
            </div>
            <div className="asset-token-tags" aria-label="Asset protocol details">
              <span>{state?.device || 'token@1.0'}</span>
              <span>Arweave</span>
              <span>Supply 1</span>
            </div>
            {loading ? <Loading label="Computing current state…" /> : null}
            {error ? <ErrorPanel message={error} /> : null}
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
                  <span>{order ? 'Buy for' : 'Market status'}</span>
                  <strong>{order ? `${winstonToAr(order.asking)} AR` : 'Not listed'}</strong>
                </div>
                <div className="asset-commerce-actions">
                  {!wallet.address ? (
                    <button className="primary with-icon" onClick={() => void wallet.connect()}>
                      <Wallet className="ui-icon ui-icon--sm" aria-hidden="true" /> Connect wallet
                    </button>
                  ) : null}
                  {wallet.address && order && !mine ? (
                    <button className="primary with-icon" onClick={() => startOperation({ kind: 'buy', order })}>
                      <ShoppingCart className="ui-icon ui-icon--sm" aria-hidden="true" /> Buy now
                    </button>
                  ) : null}
                  {wallet.address && mine && !order ? (
                    <button className="primary with-icon" onClick={() => startOperation({ kind: 'sell' })}>
                      <Tag className="ui-icon ui-icon--sm" aria-hidden="true" /> List for sale
                    </button>
                  ) : null}
                  {wallet.address && mine && order ? (
                    <button className="with-icon" onClick={() => startOperation({ kind: 'cancel', order })}>
                      <CircleX className="ui-icon ui-icon--sm" aria-hidden="true" /> Delist asset
                    </button>
                  ) : null}
                  {wallet.address && mine && !order ? (
                    <button className="with-icon" onClick={() => startOperation({ kind: 'transfer' })}>
                      <Send className="ui-icon ui-icon--sm" aria-hidden="true" /> Transfer
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
          <div className="asset-accordion-list">
            <details id="asset-about" open>
              <summary>
                <span className="asset-accordion-icon">
                  <Info className="ui-icon" aria-hidden="true" />
                </span>
                <strong>About</strong>
                <ChevronDown className="ui-icon ui-icon--sm" aria-hidden="true" />
              </summary>
              <div className="asset-accordion-content">
                <p className="asset-description">{description}</p>
                <div className="asset-detail-facts">
                  <div>
                    <span>Owner</span>
                    <strong>{owner ? short(owner) : 'Unassigned'}</strong>
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
              </div>
            </details>
            <details id="asset-orders">
              <summary>
                <span className="asset-accordion-icon">
                  <Layers3 className="ui-icon" aria-hidden="true" />
                </span>
                <strong>Orders</strong>
                <span className="asset-accordion-count">{order ? '1' : '0'}</span>
                <ChevronDown className="ui-icon ui-icon--sm" aria-hidden="true" />
              </summary>
              <div className="asset-accordion-content">
                <div className="orderbook-table">
                  <div className="orderbook-head">
                    <span>Price</span>
                    <span>Quantity</span>
                    <span>Seller</span>
                    <span>Status</span>
                  </div>
                  {order ? (
                    <div className="orderbook-row">
                      <strong>{winstonToAr(order.asking)} AR</strong>
                      <span>{order.quantity}</span>
                      <a href={`https://arweave.net/${order.creator}`} target="_blank" rel="noreferrer">
                        {short(order.creator)}
                      </a>
                      <span className={`order-status ${order.status}`}>{order.status}</span>
                    </div>
                  ) : (
                    <div className="orderbook-empty">
                      <strong>No open asks</strong>
                      <span>This asset is not currently listed.</span>
                    </div>
                  )}
                </div>
                <p className="market-note">
                  Computed from current asset process state through the selected HyperBEAM gateway.
                </p>
              </div>
            </details>
            <details id="asset-activity">
              <summary>
                <span className="asset-accordion-icon">
                  <BarChart3 className="ui-icon" aria-hidden="true" />
                </span>
                <strong>Price history</strong>
                <ChevronDown className="ui-icon ui-icon--sm" aria-hidden="true" />
              </summary>
              <div className="asset-accordion-content">
                {order ? (
                  <div className="asset-history-current">
                    <span>Current ask</span>
                    <strong>{winstonToAr(order.asking)} AR</strong>
                  </div>
                ) : null}
                {activityLoading ? <Loading label="Reading permanent market history…" /> : null}
                {!activityLoading && assetActivity.length ? (
                  <div className="asset-history-list">
                    {assetActivity.map((event) => (
                      <a key={event.id} href={`https://arweave.net/${event.id}`} target="_blank" rel="noreferrer">
                        <span>{activityLabel(event.action)}</span>
                        <time>{event.timestamp ? formatTimestamp(event.timestamp) : 'Pending timestamp'}</time>
                        <ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                ) : null}
                {!activityLoading && !assetActivity.length ? (
                  <p className="asset-empty-copy">No permanent market events found.</p>
                ) : null}
              </div>
            </details>
            <details>
              <summary>
                <span className="asset-accordion-icon">
                  <FileText className="ui-icon" aria-hidden="true" />
                </span>
                <strong>Usage rights</strong>
                <span className="asset-accordion-count">{license.length || '—'}</span>
                <ChevronDown className="ui-icon ui-icon--sm" aria-hidden="true" />
              </summary>
              <div className="asset-accordion-content">
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
              </div>
            </details>
            <details>
              <summary>
                <span className="asset-accordion-icon">
                  <Grid2X2 className="ui-icon" aria-hidden="true" />
                </span>
                <strong>Blockchain details</strong>
                <ChevronDown className="ui-icon ui-icon--sm" aria-hidden="true" />
              </summary>
              <div className="asset-accordion-content">
                <dl className="asset-blockchain-details">
                  <div>
                    <dt>Process ID</dt>
                    <dd>
                      <a href={`https://arweave.net/${asset.id}`} target="_blank" rel="noreferrer">
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
              </div>
            </details>
            <details>
              <summary>
                <span className="asset-accordion-icon">
                  <Grid2X2 className="ui-icon" aria-hidden="true" />
                </span>
                <strong>More from this collection</strong>
                <ChevronDown className="ui-icon ui-icon--sm" aria-hidden="true" />
              </summary>
              <div className="asset-accordion-content">
                <div className="asset-more-grid">
                  {moreAssets.map((item) => (
                    <Link key={item.id} to={`/asset/${collection.id}/${item.id}`}>
                      {item.image ? (
                        <img src={item.image} alt="" />
                      ) : (
                        <span>{item.name.slice(0, 1).toUpperCase()}</span>
                      )}
                      <strong>{item.name}</strong>
                    </Link>
                  ))}
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
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
  onUpdate,
  onOperation,
  onClose,
  onDiscard,
  onViewAsset,
}: {
  taskId: string;
  asset: AssetSummary;
  collectionId: string;
  owner: string;
  operation: Operation;
  visible: boolean;
  onUpdate(
    id: string,
    patch: Pick<OperationActivity, 'phase' | 'status' | 'confirmations' | 'confirmationTarget'>,
    assetId: string,
  ): void;
  onOperation(operation: Operation): void;
  onClose(): void;
  onDiscard(): void;
  onViewAsset(): void;
}) {
  const [value, setValue] = React.useState(
    operation.kind === 'sell' || operation.kind === 'transfer' ? (operation.value ?? '') : '',
  );
  const [phase, setPhase] = React.useState<'form' | 'working' | 'done' | 'error'>(
    operation.kind === 'buy' || operation.resumeId ? 'working' : 'form',
  );
  const [message, setMessage] = React.useState('');
  const [views, setViews] = React.useState<ObserverView[]>([]);
  const [transaction, setTransaction] = React.useState<PreparedTransaction | null>(null);
  const [purchaseState, setPurchaseState] = React.useState<PurchaseState | null>(null);
  const [hiding, setHiding] = React.useState(false);
  const purchaseRef = React.useRef<SwapPurchase | null>(null);
  const networkRef = React.useRef<ArweaveObserverNetwork | null>(null);
  const lifecycleRef = React.useRef<object | null>(null);
  const hideTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const lifecycle = {};
    lifecycleRef.current = lifecycle;
    return () => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      queueMicrotask(() => {
        if (lifecycleRef.current !== lifecycle) return;
        purchaseRef.current?.abandon();
        networkRef.current?.stop();
      });
    };
  }, []);
  React.useEffect(() => {
    if (visible) setHiding(false);
  }, [visible]);
  const submittedAutomatically = React.useRef(false);
  React.useEffect(() => {
    const shouldSubmitAutomatically = operation.kind === 'buy' || Boolean(operation.resumeId);
    if (!shouldSubmitAutomatically || submittedAutomatically.current) return;
    submittedAutomatically.current = true;
    void submit();
  }, []);

  async function submit() {
    setPhase('working');
    try {
      const client = new AssetTransactionClient();
      if (operation.kind === 'buy') {
        const network = new ArweaveObserverNetwork(assetObserverNetworkOptions());
        networkRef.current = network;
        await network.ready();
        const purchase = new SwapPurchase(
          network,
          client.purchaseAdapter({
            processId: asset.id,
            order: operation.order,
            buyer: owner,
            network,
          }),
          {
            registrationTarget: 5,
            paymentTarget: 5,
            paymentSuccessDepth: 1,
            skipFrom: 2,
            propagation: 'all',
            minObservers: 2,
            ...(operation.resume ? { resume: operation.resume } : {}),
          },
        );
        purchaseRef.current = purchase;
        const update = (state: PurchaseState) => {
          const snapshot = purchase.snapshot();
          setPurchaseState(state);
          localStorage.setItem(
            `bazar-purchase:${asset.id}`,
            JSON.stringify({
              asset: { id: asset.id, name: asset.name, image: asset.image },
              collectionId,
              buyer: owner,
              order: operation.order,
              snapshot,
            }),
          );
          onOperation({ kind: 'buy', order: operation.order, resume: snapshot });
        };
        purchase.on('state', update);
        purchase.on('failed', update);
        purchase.on('complete', update);
        update(purchase.state());
        const finalState = await purchase.run();
        if (finalState.stage !== 'complete' || !finalState.success) {
          throw new Error(finalState.error?.message ?? finalState.error?.code ?? 'asset-purchase-failed');
        }
        localStorage.removeItem(`bazar-purchase:${asset.id}`);
        setPhase('done');
        return;
      }
      let prepared: PreparedTransaction;
      if (transaction) {
        prepared = transaction;
      } else if (operation.resumeId) {
        prepared = client.restore(operation.resumeId, owner);
      } else if (operation.kind === 'sell') {
        const winston = arToWinston(value);
        prepared = await client.makeOffer({ processId: asset.id, asking: winston, seller: owner });
      } else if (operation.kind === 'cancel') {
        prepared = await client.cancelOrder(asset.id, operation.order.orderId, owner);
      } else if (operation.kind === 'transfer') {
        prepared = await client.transfer(asset.id, value, owner);
      } else throw new Error('invalid-operation');
      setTransaction(prepared);
      localStorage.setItem(
        `bazar-operation:${asset.id}`,
        JSON.stringify({
          asset: { id: asset.id, name: asset.name, image: asset.image },
          collectionId,
          txId: prepared.id,
          kind: operation.kind,
          assetId: asset.id,
          signer: owner,
          ...(operation.kind === 'cancel' ? { order: operation.order } : { value }),
          createdAt: Date.now(),
        }),
      );
      onOperation(
        operation.kind === 'cancel'
          ? { kind: 'cancel', order: operation.order, resumeId: prepared.id }
          : { kind: operation.kind, value, resumeId: prepared.id },
      );
      await dispatchAndConfirm(prepared, {
        target: 5,
        onViews: setViews,
      });
      setMessage('Five confirmations reached. Waiting for the scheduler safety depth and live asset state…');
      if (operation.kind === 'sell') {
        await client.waitForOfferAcceptance(asset.id, {
          orderId: prepared.id,
          seller: owner,
          asking: arToWinston(value),
          minimumFee: DEFAULT_REGISTRATION_FEE.toString(),
        });
      } else if (operation.kind === 'cancel') {
        await client.waitForOrderCancelled(asset.id, operation.order.orderId);
      } else if (operation.kind === 'transfer') {
        await client.waitForAssetOwnership(asset.id, value);
      }
      localStorage.removeItem(`bazar-operation:${asset.id}`);
      setPhase('done');
    } catch (cause) {
      setMessage(errorMessage(cause));
      setPhase('error');
    }
  }

  const purchaseSteps: ArweaveSyncStep[] = purchaseState
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
          transaction: { id: transaction.id, views },
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
  const confirmations = Math.min(
    confirmationTarget,
    activeSyncStep?.confirmations ??
      activeSyncStep?.transaction?.consensus?.confirmations ??
      observedConfirmationDepth(activeSyncStep?.transaction?.views ?? []),
  );
  const visiblePhase =
    operation.kind === 'buy' && phase === 'done' && purchaseState?.stage !== 'complete' ? 'error' : phase;
  const visibleMessage =
    message ||
    (purchaseState?.error ? errorMessage(new Error(purchaseState.error.message || purchaseState.error.code)) : '');
  const workingStatus = message || purchaseStatusMessage(purchaseState);
  const reportedStatus =
    visiblePhase === 'form'
      ? 'Waiting for details'
      : visiblePhase === 'working'
        ? workingStatus || 'Watching Arweave confirmations…'
        : visiblePhase === 'done'
          ? operationSuccessTitle(operation.kind)
          : visibleMessage || 'This transaction needs attention';
  React.useEffect(() => {
    onUpdate(taskId, { phase: visiblePhase, status: reportedStatus, confirmations, confirmationTarget }, asset.id);
  }, [confirmationTarget, confirmations, reportedStatus, taskId, visiblePhase]);
  const closeOrHide = () => {
    if (visiblePhase !== 'working') {
      onClose();
      return;
    }
    if (hiding) return;
    setHiding(true);
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      onClose();
    }, 240);
  };
  if (!visible && visiblePhase !== 'working') return null;
  return (
    <div className="dialog-backdrop" role="presentation" hidden={!visible}>
      <div
        className={`dialog dialog--${visiblePhase}`}
        role={visible ? 'dialog' : undefined}
        aria-modal={visible ? true : undefined}
        aria-hidden={visible ? undefined : true}
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">{operationLabel(operation.kind)}</p>
            <h2>{asset.name}</h2>
          </div>
          <button
            className={`close${visiblePhase === 'working' ? ' transaction-hide' : ''}`}
            onClick={closeOrHide}
            aria-label={visiblePhase === 'working' ? 'Hide transaction details' : 'Close dialog'}
            title={visiblePhase === 'working' ? 'Hide transaction details' : 'Close'}
          >
            {visiblePhase === 'working' ? (
              <span className={`transaction-hide-icon${hiding ? ' hiding' : ''}`} aria-hidden="true">
                <Eye className="ui-icon transaction-hide-eye-open" />
                <EyeOff className="ui-icon transaction-hide-eye-closed" />
              </span>
            ) : (
              <X className="ui-icon" aria-hidden="true" />
            )}
          </button>
        </div>
        {visiblePhase === 'form' ? (
          <>
            {operation.kind === 'sell' ? (
              <label>
                Sale price in AR
                <input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="0.25" />
              </label>
            ) : null}
            {operation.kind === 'transfer' ? (
              <label>
                Recipient wallet address
                <input
                  autoFocus
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="43-character Arweave address"
                />
              </label>
            ) : null}
            {operation.kind === 'cancel' ? (
              <p>
                {operation.order.status === 'reserved'
                  ? 'This cancels the active buyer reservation and removes the listing. The asset remains in your wallet.'
                  : 'This removes the listing. The asset remains in your wallet.'}
              </p>
            ) : null}
            <button className="primary wide" onClick={() => void submit()}>
              Sign {operationLabel(operation.kind).toLowerCase()}
            </button>
          </>
        ) : null}
        {visiblePhase === 'working' && steps.length ? (
          <>
            {!((operation.kind === 'buy' && operation.resume) || (operation.kind !== 'buy' && operation.resumeId)) ? (
              <p className="sync-intro">Signed. Now watching independent Arweave nodes agree on the transaction.</p>
            ) : null}
            {workingStatus ? <p className="scheduler-wait">{workingStatus}</p> : null}
            <ArweaveTransactionSync subject={asset.name} steps={steps} activeStep={activeStep} active={visible} />
          </>
        ) : null}
        {visiblePhase === 'done' ? (
          <div className="result success" role="status" aria-live="polite">
            <span className="result-status-icon" aria-hidden="true">
              <Check className="ui-icon" />
            </span>
            <h3>{operationSuccessTitle(operation.kind)}</h3>
            <p>{operationSuccessMessage(operation.kind)}</p>
            <button className="primary with-icon result-action" onClick={onViewAsset}>
              View asset <ArrowRight className="ui-icon ui-icon--sm" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {visiblePhase === 'error' ? (
          <div className="result error">
            <h3>Could not complete this action</h3>
            <p>{visibleMessage}</p>
            {operation.kind === 'buy' ? (
              <button
                onClick={() => {
                  if (purchaseState) {
                    localStorage.setItem(
                      `bazar-purchase:${asset.id}`,
                      JSON.stringify({
                        asset: { id: asset.id, name: asset.name, image: asset.image },
                        collectionId,
                        buyer: owner,
                        order: operation.order,
                        snapshot: purchaseSnapshot(purchaseState),
                      }),
                    );
                  }
                  window.location.reload();
                }}
              >
                Try again
              </button>
            ) : /^transaction dispatch 4\d\d/.test(message) && transaction ? (
              <button
                onClick={() => {
                  localStorage.removeItem(`bazar-operation:${asset.id}`);
                  localStorage.removeItem(`bazar-signed-transaction:${transaction.id}`);
                  onDiscard();
                }}
              >
                Discard rejected signature and sign again
              </button>
            ) : transaction ? (
              <button onClick={() => void submit()}>Resume the signed transaction</button>
            ) : (
              <button onClick={() => setPhase('form')}>Try again</button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BazarMark() {
  return <img src={bazarLogo} alt="" aria-hidden="true" />;
}

function activityLabel(action: CollectionActivityEvent['action']) {
  return {
    'make-offer': 'Listed for sale',
    'register-interest': 'Purchase reserved',
    transfer: 'Asset transferred',
    'cancel-order': 'Listing cancelled',
  }[action];
}

function activitySymbol(action: CollectionActivityEvent['action']) {
  const ActivityIcon = {
    'make-offer': Tag,
    'register-interest': ShoppingCart,
    transfer: ArrowRight,
    'cancel-order': CircleX,
  }[action];
  return <ActivityIcon className="ui-icon" aria-hidden="true" />;
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp * 1000));
}

function Loading({ label }: { label: string }) {
  return (
    <div className="loading">
      <span />
      {label}
    </div>
  );
}
function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="error-panel">
      <strong>Unable to load</strong>
      <span>{message}</span>
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
function short(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-5)}`;
}
function winstonToAr(value: string) {
  return (Number(value) / 1e12).toLocaleString(undefined, { maximumFractionDigits: 12 });
}
function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
function arToWinston(value: string) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value) || Number(value) <= 0)
    throw new Error('Enter a positive AR amount.');
  const [whole, decimals = ''] = value.split('.');
  return (BigInt(whole) * 1_000_000_000_000n + BigInt(decimals.padEnd(12, '0'))).toString();
}
function operationLabel(kind: Operation['kind']) {
  return { sell: 'List for sale', buy: 'Buy asset', cancel: 'Delist asset', transfer: 'Transfer asset' }[kind];
}
function operationActivityPhaseLabel(phase: OperationActivityPhase) {
  return {
    form: 'Awaiting signature',
    working: 'In progress',
    done: 'Complete',
    error: 'Needs attention',
  }[phase];
}
function operationSuccessTitle(kind: Operation['kind']) {
  return {
    sell: 'Listing is live',
    buy: 'Purchase complete',
    cancel: 'Asset delisted',
    transfer: 'Transfer complete',
  }[kind];
}
function operationSuccessMessage(kind: Operation['kind']) {
  return {
    sell: 'This asset is now listed for sale and reflected in its live Arweave state.',
    buy: 'Ownership has transferred to your wallet and is reflected in the asset’s live Arweave state.',
    cancel: 'The listing has been removed from the asset’s live Arweave state.',
    transfer: 'The new owner is reflected in the asset’s live Arweave state.',
  }[kind];
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
    return 'The payment is signed but held locally. It will only be released after the reservation reaches five confirmations and appears in live process state.';
  }
  if (state.stage === 'registration-accepting') {
    return 'Registration has five confirmations. Waiting for ~arweave-scheduler@1.0 to reserve the order in live process state before releasing payment.';
  }
  if (state.stage === 'signing-payment' || state.stage === 'dispatching-payment') {
    return 'The reservation is live. Preparing the exact payment to the seller.';
  }
  if (state.stage === 'payment-propagating' || state.stage === 'payment-confirming') {
    return 'The reservation is live and the payment has been posted. Independent nodes are confirming settlement.';
  }
  if (state.stage === 'ownership-verifying') {
    return 'Payment is confirmed. Waiting for ~arweave-scheduler@1.0 to settle the order and transfer ownership in live process state.';
  }
  return '';
}
function errorMessage(error: unknown) {
  const value = error instanceof Error ? error.message : String(error);
  const friendly: Record<string, string> = {
    'asset-purchase-insufficient-funds-after-signing':
      'This wallet does not have enough AR for the transaction and network fee. Add AR, then resume the same signed transaction.',
    'transaction-propagation-timeout':
      'Arweave nodes did not reach propagation consensus in time. The signed transaction is saved and safe to resume.',
    'asset-state-timeout':
      'The transaction is confirmed, but the selected compute gateway has not applied it yet. Resume to keep checking live state.',
    'wallet-account-changed':
      'The connected wallet changed after signing. Reconnect the original signer to resume safely.',
    'registration-not-found':
      'Independent observers could not verify the saved reservation during this observation window. Resume the exact signed transaction without signing again.',
    'payment-not-found':
      'Independent observers could not verify the saved payment during this observation window. Resume the exact signed payment without paying again.',
  };
  return friendly[value] ?? value.replaceAll('-', ' ');
}
function mintErrorMessage(error: unknown) {
  const value = error instanceof Error ? error.message : String(error);
  const friendly: Record<string, string> = {
    'mint-name-invalid': 'Enter a name between 1 and 80 characters.',
    'mint-description-invalid': 'Keep the description under 600 characters.',
    'mint-file-required': 'Choose an image to continue.',
    'mint-file-type-unsupported': 'Use a PNG, JPG, WebP, or GIF image.',
    'mint-file-size-invalid': 'Choose an image no larger than 10 MB.',
    'mint-insufficient-balance': 'This wallet does not have enough AR for both permanent transactions.',
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
