import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AtSign,
  BarChart3,
  Check,
  ChevronDown,
  CircleX,
  Diamond,
  FileText,
  Grid2X2,
  History,
  Images,
  Info,
  LayoutGrid,
  Layers3,
  Library,
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

import { loadCollections, loadMoreCarrierNames, type AssetSummary, type Collection } from 'api/collections';
import {
  discoverCollectionActivity,
  discoverMarketActivity,
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
  type AssetState,
  type SwapOrder,
} from 'api/asset-marketplace';
import { ArweaveObserverNetwork } from 'api/arweave-observers';
import { assetObserverNetworkOptions } from 'api/asset-observers';
import { AssetTransactionClient, DEFAULT_REGISTRATION_FEE, dispatchAndConfirm } from 'api/asset-transactions';
import { ArweaveTransactionSync, type ArweaveSyncStep } from 'components/ArweaveTransactionSync';
import { useWallet } from 'providers/WalletProvider';

import arweaveNamesCube from '../assets/arweave-names-cube.gif';
import arweaveNamesCubeStill from '../assets/arweave-names-cube.png';
import bazarLogo from '../assets/logo.svg';

import './styles.css';

type MarketContextValue = {
  collections: Collection[];
  loading: boolean;
  error: string | null;
  loadMore(collectionId: string): Promise<void>;
};

const MarketContext = React.createContext<MarketContextValue>({
  collections: [],
  loading: true,
  error: null,
  loadMore: async () => undefined,
});

export function App() {
  const [market, setMarket] = React.useState<MarketContextValue>({
    collections: [],
    loading: true,
    error: null,
    loadMore: async () => undefined,
  });
  React.useEffect(() => {
    const controller = new AbortController();
    loadCollections(controller.signal).then(
      (collections) => setMarket((current) => ({ ...current, collections, loading: false, error: null })),
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
  const value = React.useMemo(() => ({ ...market, loadMore }), [loadMore, market]);

  return (
    <MarketContext.Provider value={value}>
      <HashRouter>
        <RouteScroll />
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/my-assets" element={<MyAssetsView />} />
            <Route path="/collection/:collectionId" element={<CollectionView />} />
            <Route path="/collection/:collectionId/activity" element={<CollectionActivityView />} />
            <Route path="/asset/:collectionId/:assetId" element={<AssetView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </HashRouter>
    </MarketContext.Provider>
  );
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
            {wallet.address ? (
              <Link className="my-assets-link" to="/my-assets">
                <Library className="ui-icon ui-icon--sm" aria-hidden="true" /> My assets
              </Link>
            ) : null}
            <GatewayControl />
          </div>
          <div className="site-nav-wallet">
            {wallet.loadDevelopmentWallet ? (
              <label className="development-wallet">
                <Upload className="ui-icon ui-icon--sm" aria-hidden="true" /> Test wallet
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void wallet.loadDevelopmentWallet?.(file);
                  }}
                />
              </label>
            ) : null}
            <button
              aria-label={wallet.address ? `Disconnect wallet ${short(wallet.address)}` : 'Connect wallet'}
              className="wallet"
              onClick={() => void (wallet.address ? wallet.disconnect() : wallet.connect())}
            >
              <Wallet className="ui-icon ui-icon--sm" aria-hidden="true" />
              <span>{wallet.address ? short(wallet.address) : 'Connect wallet'}</span>
            </button>
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

function Home() {
  const market = React.useContext(MarketContext);
  const { search } = useLocation();
  const query = new URLSearchParams(search).get('q') ?? '';
  const normalizedQuery = query.trim().toLowerCase();
  const collections = market.collections.filter((collection) => {
    if (!normalizedQuery) return true;
    return (
      `${collection.name} ${collection.description}`.toLowerCase().includes(normalizedQuery) ||
      collection.assets.some((asset) => asset.name.toLowerCase().includes(normalizedQuery))
    );
  });
  const assets = market.collections
    .flatMap((collection) => collection.assets.filter((asset) => asset.image).map((asset) => ({ asset, collection })))
    .filter(
      ({ asset, collection }) =>
        !normalizedQuery || `${asset.name} ${collection.name}`.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, 10);
  const assetKey = assets.map(({ asset }) => asset.id).join(',');
  const [assetPrices, setAssetPrices] = React.useState<Record<string, string | null>>({});
  const collectionKey = collections
    .map((collection) => `${collection.id}:${collection.assets.map((asset) => asset.id).join('.')}`)
    .join(',');
  const [collectionFloors, setCollectionFloors] = React.useState<Record<string, string | null>>({});
  React.useEffect(() => {
    const controller = new AbortController();
    setAssetPrices({});
    void Promise.all(
      assets.map(async ({ asset }) => {
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
  }, [assetKey]);
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
  return (
    <div className="home-shell">
      <div className="home-main">
        <div className="home-content">
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
                      <p>{collection.kind === 'names' ? 'Arweave identity' : 'Permanent collection'}</p>
                      <h2>{collection.name}</h2>
                      <span>{collection.description}</span>
                    </div>
                    <div className="home-feature-stats">
                      <div>
                        <span>Assets</span>
                        <strong>{(collection.total ?? collection.assets.length).toLocaleString()}</strong>
                      </div>
                      <div>
                        <span>Type</span>
                        <strong>{collection.kind === 'names' ? 'Names' : 'Images'}</strong>
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

          {assets.length ? (
            <section className="home-section home-assets" id="assets">
              <div className="home-section-heading">
                <div>
                  <h2>Discover assets</h2>
                  <p>Individual assets from the latest permanent collection indexes.</p>
                </div>
              </div>
              <div className="home-asset-grid">
                {assets.map(({ asset, collection }) => (
                  <Link key={`${collection.id}-${asset.id}`} to={`/asset/${collection.id}/${asset.id}`}>
                    <img src={asset.image} alt="" />
                    <div className="home-asset-details">
                      <div>
                        <strong>{asset.name}</strong>
                        <span>{collection.name}</span>
                      </div>
                      <b className={`home-asset-price${assetPrices[asset.id] ? ' listed' : ''}`}>
                        {asset.id in assetPrices ? (assetPrices[asset.id] ?? 'Not listed') : 'Checking…'}
                      </b>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
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
      <summary title={current}>
        <Server className="ui-icon ui-icon--sm" aria-hidden="true" /> Compute gateway
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
}: {
  label: string;
  value: Value;
  options: readonly MarketSelectOption<Value>[];
  onChange(value: Value): void;
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
      <span className="market-select-label">{label}</span>
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
  const collection = market.collections.find((item) => item.id === collectionId);
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
  const [activityState, setActivityState] = React.useState({
    loading: false,
    resolved: 0,
    total: 0,
    error: null as string | null,
  });
  const [retry, setRetry] = React.useState(0);
  const gateway = servingNodeOrigin(window.location);
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
  if (market.loading) return <Loading label="Reading collection index…" />;
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
          <p className="eyebrow">{collection.kind === 'names' ? 'CARRIER ASSETS' : 'TOKEN ASSETS'}</p>
          <h1>{collection.name}</h1>
        </div>
        <p>{collection.description}</p>
      </div>
      <CollectionTabs collection={collection} active="assets" />
      {collection.kind === 'names' ? (
        <nav className="alphabet-filter" aria-label="Filter names by first letter">
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
              aria-label={`Names beginning with ${letter}`}
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
                ? `No names beginning with ${initial}`
                : 'Nothing here yet'}
          </h3>
          <p>
            {query
              ? 'Try a shorter search or clear the current query.'
              : initial !== 'all'
                ? 'Try another letter or return to all names.'
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
      {limit < filtered.length ? (
        <button className="load-more" onClick={() => setLimit((value) => value + 48)}>
          Show more
        </button>
      ) : filtered.length && collection.hasMore && !query && !listedOnly ? (
        <button className="load-more" onClick={() => void market.loadMore(collection.id)}>
          Load 100 more from Arweave
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
          <p className="eyebrow">PERMANENT ACTIVITY</p>
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
        <p className="eyebrow">YOUR WALLET</p>
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
          <p className="eyebrow">LIVE WALLET INVENTORY</p>
          <h1>My assets</h1>
          <p>Ownership is computed now through {gateway}. Transaction history only tells Bazar what to check.</p>
        </div>
        <button className="with-icon" onClick={() => setRetry((value) => value + 1)} disabled={working}>
          <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />
          {working ? 'Resolving…' : 'Retry'}
        </button>
      </div>
      <div className="resolution-status" aria-live="polite">
        <div>
          <strong>
            {status.phase === 'discovering'
              ? 'Discovering candidates'
              : status.phase === 'resolving'
                ? 'Computing live state'
                : status.phase === 'done'
                  ? 'Live state resolved'
                  : 'Resolution interrupted'}
          </strong>
          <span>
            {status.phase === 'discovering'
              ? `${status.discovered.toLocaleString()} candidates found`
              : `${status.resolved.toLocaleString()} of ${status.total.toLocaleString()} checked${
                  status.failures ? ` · ${status.failures.toLocaleString()} unavailable` : ''
                }`}
          </span>
        </div>
        <div className="resolution-track">
          <span
            style={{
              width: status.total
                ? `${Math.min(100, (status.resolved / status.total) * 100)}%`
                : status.phase === 'discovering'
                  ? '12%'
                  : '0%',
            }}
          />
        </div>
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
  const collection = market.collections.find((item) => item.id === collectionId);
  const indexedAsset = collection?.assets.find((item) => item.id === assetId);
  const [state, setState] = React.useState<AssetState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [operation, setOperation] = React.useState<Operation | null>(null);
  const [assetActivity, setAssetActivity] = React.useState<CollectionActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = React.useState(true);
  const [activeSection, setActiveSection] = React.useState<'about' | 'orders' | 'activity'>('about');
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setState((await readAssetState(assetId)).state);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [assetId]);
  React.useEffect(() => void load(), [load]);
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
  React.useEffect(() => setActiveSection('about'), [assetId]);
  React.useEffect(() => {
    if (!wallet.address || operation || !state) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`bazar-purchase:${assetId}`) ?? 'null');
      if (saved?.buyer === wallet.address && saved?.order) {
        if (!state.orders[saved.order.orderId] && state.balances[wallet.address] === '1') {
          localStorage.removeItem(`bazar-purchase:${assetId}`);
        } else {
          setOperation({ kind: 'buy', order: saved.order, resume: saved.snapshot });
          return;
        }
      }
      const order = liveOrder(state);
      if (order && order.creator !== wallet.address) {
        const client = new AssetTransactionClient();
        const registrationId = client.findStoredRegistration(assetId, order.orderId, wallet.address);
        if (registrationId) {
          setOperation({
            kind: 'buy',
            order,
            resume: {
              registration: { id: registrationId, dispatched: false },
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
          setOperation({
            kind: 'cancel',
            order: savedOperation.order,
            resumeId: savedOperation.txId,
          });
        } else {
          setOperation({
            kind: savedOperation.kind,
            resumeId: savedOperation.txId,
            value: savedOperation.value,
          });
        }
      }
    } catch {
      localStorage.removeItem(`bazar-purchase:${assetId}`);
      localStorage.removeItem(`bazar-operation:${assetId}`);
    }
  }, [assetId, operation, state, wallet.address]);
  if (!collection) return <ErrorPanel message="This collection could not be found on Arweave." />;
  const asset =
    indexedAsset ??
    (collection.kind === 'names' && state && ['carrier@1.0', 'name-token@1.0'].includes(state.device)
      ? { id: assetId, name: state.name || short(assetId) }
      : null);
  if (!asset && !loading) return <ErrorPanel message="This asset is not in the selected collection." />;
  if (!asset) return <Loading label="Computing current state…" />;
  const owner = state ? ownerOfAsset(state) : null;
  const order = state ? liveOrder(state) : null;
  const mine = Boolean(wallet.address && owner === wallet.address);
  const license = state ? licenseProperties(state) : [];
  const description = assetDescription(state, collection.description);
  const moreAssets = collection.assets.filter((item) => item.id !== asset.id).slice(0, 4);
  const showAssetSection = (section: 'about' | 'orders' | 'activity') => {
    setActiveSection(section);
    const target = document.getElementById(`asset-${section}`);
    if (target instanceof HTMLDetailsElement) target.open = true;
    window.requestAnimationFrame(() => target?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  return (
    <section className="asset-page asset-detail-page">
      <div className="asset-detail-layout">
        <div className="asset-visual-column">
          <div className="asset-hero-media">
            {asset.image ? (
              <img src={asset.image} alt={asset.name} />
            ) : (
              <span>{asset.name.slice(0, 1).toUpperCase()}</span>
            )}
            <div className="asset-media-label">
              <span>Permanent asset</span>
              <strong>{asset.contentType ?? (asset.image ? 'image' : (state?.device ?? 'process'))}</strong>
            </div>
          </div>
        </div>
        <div className="asset-commerce-column">
          <div className="asset-details asset-identity">
            <div className="asset-kicker">
              <Link className="asset-collection-link" to={`/collection/${collection.id}`}>
                {collection.name}
              </Link>
              <span className={order ? 'status-dot listed' : 'status-dot'}>{order ? 'For sale' : 'Live'}</span>
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
              <span>ARWEAVE</span>
              <span>SUPPLY 1</span>
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
                    <button className="primary with-icon" onClick={() => setOperation({ kind: 'buy', order })}>
                      <ShoppingCart className="ui-icon ui-icon--sm" aria-hidden="true" /> Buy now
                    </button>
                  ) : null}
                  {wallet.address && mine && !order ? (
                    <button className="primary with-icon" onClick={() => setOperation({ kind: 'sell' })}>
                      <Tag className="ui-icon ui-icon--sm" aria-hidden="true" /> List for sale
                    </button>
                  ) : null}
                  {wallet.address && mine && order?.status === 'open' ? (
                    <button className="with-icon" onClick={() => setOperation({ kind: 'cancel', order })}>
                      <CircleX className="ui-icon ui-icon--sm" aria-hidden="true" /> Cancel listing
                    </button>
                  ) : null}
                  {wallet.address && mine && !order ? (
                    <button className="with-icon" onClick={() => setOperation({ kind: 'transfer' })}>
                      <Send className="ui-icon ui-icon--sm" aria-hidden="true" /> Transfer
                    </button>
                  ) : null}
                  <button className="with-icon" onClick={() => void load()}>
                    <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Refresh
                  </button>
                </div>
              </section>
            ) : null}
          </div>
          <nav className="asset-section-tabs" aria-label="Asset detail sections">
            <button
              className={activeSection === 'about' ? 'active' : undefined}
              onClick={() => showAssetSection('about')}
              type="button"
            >
              Details
            </button>
            <button
              className={activeSection === 'orders' ? 'active' : undefined}
              onClick={() => showAssetSection('orders')}
              type="button"
            >
              Orders
            </button>
            <button
              className={activeSection === 'activity' ? 'active' : undefined}
              onClick={() => showAssetSection('activity')}
              type="button"
            >
              Activity
            </button>
          </nav>
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
      {operation && wallet.address ? (
        <OperationDialog
          asset={asset}
          owner={wallet.address}
          operation={operation}
          onClose={() => {
            setState(null);
            setOperation(null);
            void load();
          }}
        />
      ) : null}
    </section>
  );
}

type Operation =
  | { kind: 'sell' | 'transfer'; resumeId?: string; value?: string }
  | { kind: 'cancel'; order: SwapOrder; resumeId?: string }
  | { kind: 'buy'; order: SwapOrder; resume?: PurchaseSnapshot };

function OperationDialog({
  asset,
  owner,
  operation,
  onClose,
}: {
  asset: AssetSummary;
  owner: string;
  operation: Operation;
  onClose(): void;
}) {
  const [value, setValue] = React.useState(
    operation.kind === 'sell' || operation.kind === 'transfer' ? (operation.value ?? '') : '',
  );
  const [phase, setPhase] = React.useState<'form' | 'working' | 'done' | 'error'>(
    (operation.kind === 'buy' && operation.resume) || (operation.kind !== 'buy' && operation.resumeId)
      ? 'working'
      : 'form',
  );
  const [message, setMessage] = React.useState('');
  const [views, setViews] = React.useState<ObserverView[]>([]);
  const [transaction, setTransaction] = React.useState<PreparedTransaction | null>(null);
  const [purchaseState, setPurchaseState] = React.useState<PurchaseState | null>(null);
  const purchaseRef = React.useRef<SwapPurchase | null>(null);
  const networkRef = React.useRef<ArweaveObserverNetwork | null>(null);
  const lifecycleRef = React.useRef<object | null>(null);

  React.useEffect(() => {
    const lifecycle = {};
    lifecycleRef.current = lifecycle;
    return () => {
      queueMicrotask(() => {
        if (lifecycleRef.current !== lifecycle) return;
        purchaseRef.current?.abandon();
        networkRef.current?.stop();
      });
    };
  }, []);
  const resumed = React.useRef(false);
  React.useEffect(() => {
    const shouldResume =
      (operation.kind === 'buy' && operation.resume) || (operation.kind !== 'buy' && operation.resumeId);
    if (!shouldResume || resumed.current) return;
    resumed.current = true;
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
          setPurchaseState(state);
          localStorage.setItem(
            `bazar-purchase:${asset.id}`,
            JSON.stringify({
              asset: { id: asset.id, name: asset.name },
              buyer: owner,
              order: operation.order,
              snapshot: purchase.snapshot(),
            }),
          );
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
          txId: prepared.id,
          kind: operation.kind,
          assetId: asset.id,
          signer: owner,
          ...(operation.kind === 'cancel' ? { order: operation.order } : { value }),
          createdAt: Date.now(),
        }),
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
  const visiblePhase =
    operation.kind === 'buy' && phase === 'done' && purchaseState?.stage !== 'complete' ? 'error' : phase;
  const visibleMessage =
    message ||
    (purchaseState?.error ? errorMessage(new Error(purchaseState.error.message || purchaseState.error.code)) : '');
  const workingStatus = message || purchaseStatusMessage(purchaseState);
  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true">
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">{operationLabel(operation.kind)}</p>
            <h2>{asset.name}</h2>
          </div>
          {visiblePhase !== 'working' ? (
            <button className="close" onClick={onClose} aria-label="Close dialog">
              <X className="ui-icon" aria-hidden="true" />
            </button>
          ) : null}
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
            {operation.kind === 'cancel' ? <p>This removes the open order. The asset remains in your wallet.</p> : null}
            <button className="primary wide" onClick={() => void submit()}>
              Sign {operationLabel(operation.kind).toLowerCase()}
            </button>
          </>
        ) : null}
        {visiblePhase === 'working' && steps.length ? (
          <>
            <p className="sync-intro">
              {(operation.kind === 'buy' && operation.resume) || (operation.kind !== 'buy' && operation.resumeId)
                ? 'Recovered the exact signed transactions. Resuming from the weave—nothing will be signed twice.'
                : 'Signed. Now watching independent Arweave nodes agree on the transaction.'}
            </p>
            {workingStatus ? <p className="scheduler-wait">{workingStatus}</p> : null}
            <ArweaveTransactionSync subject={asset.name} steps={steps} activeStep={activeStep} />
          </>
        ) : null}
        {visiblePhase === 'done' ? (
          <div className="result success">
            <h3>Applied to live asset state</h3>
            <p>Arweave nodes now compute this action as part of the asset.</p>
            <button className="primary with-icon" onClick={onClose}>
              <ArrowLeft className="ui-icon ui-icon--sm" aria-hidden="true" /> Return to asset
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
                        asset: { id: asset.id, name: asset.name },
                        buyer: owner,
                        order: operation.order,
                        snapshot: purchaseSnapshot(purchaseState),
                      }),
                    );
                  }
                  window.location.reload();
                }}
              >
                Reload and resume safely
              </button>
            ) : /^transaction dispatch 4\d\d/.test(message) && transaction ? (
              <button
                onClick={() => {
                  localStorage.removeItem(`bazar-operation:${asset.id}`);
                  localStorage.removeItem(`bazar-signed-transaction:${transaction.id}`);
                  onClose();
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
function arToWinston(value: string) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value) || Number(value) <= 0)
    throw new Error('Enter a positive AR amount.');
  const [whole, decimals = ''] = value.split('.');
  return (BigInt(whole) * 1_000_000_000_000n + BigInt(decimals.padEnd(12, '0'))).toString();
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
    'registration not found':
      'Arweave nodes accepted the reservation, but it was not mined during this observation window. Reload to resume the exact signed transaction without signing again.',
    'payment not found':
      'Arweave nodes accepted the payment, but it was not mined during this observation window. Reload to resume the exact signed payment without paying again.',
  };
  return friendly[value] ?? value.replaceAll('-', ' ');
}
