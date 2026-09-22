import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
	ArrowRight,
	ArrowUpRight,
	AtSign,
	BarChart3,
	History,
	Images,
	LayoutGrid,
	Search,
	Upload,
	X,
} from 'lucide-react';

import {
	type AssetSummary,
	type Collection,
	collectionKindLabel,
	collectionSearchAssets,
	directTokenSearchCollection,
	interleaveCollectionAssets,
	isVisibleAssetId,
	isVisibleCollectionId,
	marketplaceAssetMatchesSearch,
	searchResultScore,
} from 'api/collections';
import { searchBazarAtomicAssetsByName } from 'api/discovery';
import { prefetchAssetPage } from 'api/marketplace';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { AudioArtwork } from 'components/atoms/AudioArtwork';
import { BazarMark } from 'components/atoms/BazarMark';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { IconButton } from 'components/atoms/IconButton';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { Loading } from 'components/atoms/Loading';
import { NamesCubePreview } from 'components/atoms/NamesCubePreview';
import { TextInput } from 'components/atoms/TextInput';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { Tooltip } from 'components/atoms/Tooltip';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import { TokenMarketRow } from 'components/molecules/TokenMarketRow';
import { isAudioContentType } from 'helpers/asset-media';
import { short } from 'helpers/format';
import { useDialogFocus } from 'hooks/useDialogFocus';
import { GatewayControl } from 'navigation/GatewayControl';
import { OperationActivityControl } from 'navigation/OperationActivityControl';
import { WalletMenu } from 'navigation/WalletMenu';
import { useMarketProvider } from 'providers/MarketProvider';

export default function Header() {
	const location = useLocation();
	const navigate = useNavigate();
	const market = useMarketProvider();
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
						<Icon icon={Search} size="sm" />
						<TextInput
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
										<Icon icon={Upload} size="sm" />
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
							<Icon icon={Search} />
							<TextInput
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
								<Icon icon={ArrowRight} size="sm" />
							</Button>
							<IconButton
								icon={X}
								label="Close search"
								onClick={() => closeSearch()}
								className="search-panel-close"
							/>
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
								<LiveRegion>{searchFeedback || announcedSearchResult}</LiveRegion>
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
											<Icon icon={ArrowRight} size="xs" />
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
													<Icon icon={History} size="sm" />
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
														<Icon icon={ArrowUpRight} size="sm" />
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
													<Icon icon={ArrowUpRight} size="sm" />
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
												<Icon icon={ArrowUpRight} size="sm" />
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
