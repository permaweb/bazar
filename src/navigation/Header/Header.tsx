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
import { Dialog, isModalDialogOpen } from 'components/organisms/Dialog';
import { isAudioContentType } from 'helpers/asset-media';
import { short } from 'helpers/format';
import { type MarketplaceSearchScope, useMarketplaceSearch } from 'hooks/useMarketplaceSearch';
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
	const [scope, setScope] = React.useState<MarketplaceSearchScope>('all');
	const [recentQueries, setRecentQueries] = React.useState<string[]>([]);
	const [searchFeedback, setSearchFeedback] = React.useState('');
	const normalizedQuery = query.trim().toLowerCase();
	const search = useMarketplaceSearch({ open: searchOpen, query, scope });
	const assetResultCount = search.tokenResults.length + search.collectibleResults.length;
	const atomicIndexSearchPending = search.indexSearch === 'pending';
	const atomicIndexSearchFailed = search.indexSearch === 'failed';
	const searchResultAnnouncement = atomicIndexSearchPending
		? 'Searching permanent Bazar creation records on Arweave.'
		: atomicIndexSearchFailed
		? 'Permanent Bazar creation-record search is temporarily unavailable.'
		: market.loading
		? 'Loading collection indexes from Arweave.'
		: market.error
		? 'Marketplace search is unavailable.'
		: normalizedQuery && !search.collectionResults.length && !assetResultCount && !search.directTokenCollection
		? search.partialTokenCollection
			? `No loaded tokens, collections, or Uniques match ${query.trim()}; more token records remain available.`
			: `No tokens, collections, or Uniques match ${query.trim()}.`
		: `Showing ${search.collectionResults.length.toLocaleString()} ${
				search.collectionResults.length === 1 ? 'collection' : 'collections'
		  } and ${(assetResultCount + (search.directTokenCollection ? 1 : 0)).toLocaleString()} ${
				assetResultCount + (search.directTokenCollection ? 1 : 0) === 1 ? 'asset result' : 'asset results'
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
		if (isModalDialogOpen()) return;
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
				if (isModalDialogOpen()) return;
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
			search.directTokenCollection
				? `/asset/${search.directTokenCollection.id}/${query.trim()}`
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
	const handleRecentQuery = (value: string) => {
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
										<span className="create-link-label">Create</span>
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
			<Dialog
				as="section"
				backdropClassName="search-overlay"
				className="search-panel"
				id="marketplace-search-panel"
				label="Search Bazar"
				onDismiss={closeSearch}
				open={searchOpen}
				restoreTarget={searchRestoreTarget}
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
						{atomicIndexSearchPending && !assetResultCount ? (
							<Loading label="Searching permanent Bazar creation records on Arweave…" />
						) : null}
						{search.partialTokenCollection ? (
							<div className="collection-source-notice">
								<span role="status">
									Token matches cover {search.partialTokenCollection.assets.length.toLocaleString()}{' '}
									of{' '}
									{(
										search.partialTokenCollection.total ??
										search.partialTokenCollection.assets.length
									).toLocaleString()}{' '}
									discovered records currently loaded.
								</span>
								<Link
									className="with-icon"
									to={`/collection/${search.partialTokenCollection.id}?q=${encodeURIComponent(
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
											onClick={() => handleRecentQuery(item)}
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
						{search.collectionResults.length ? (
							<section className="search-result-section">
								<div className="search-result-heading">
									<h2>{normalizedQuery ? 'Matching collections' : 'Featured collections'}</h2>
									<span>{search.collectionResults.length} shown</span>
								</div>
								<div className="search-collection-grid">
									{search.collectionResults.map(({ collection, kindLabel }) => {
										const preview = collection.assets.find((asset) => asset.image)?.image;
										const tokenPreview =
											collection.assets.find((asset) => asset.image) ?? collection.assets[0];
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
														{kindLabel} ·{' '}
														{collection.kind === 'names'
															? `${collection.assets.length.toLocaleString()} names loaded`
															: `${(
																	collection.total ?? collection.assets.length
															  ).toLocaleString()} ${
																	(collection.total ?? collection.assets.length) === 1
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
						{search.tokenResults.length ? (
							<section className="search-result-section token-search-results">
								<div className="search-result-heading">
									<h2>{normalizedQuery ? 'Matching tokens' : 'Tokens'}</h2>
									<span>{search.tokenResults.length} shown</span>
								</div>
								<div className="token-market-list compact">
									{search.tokenResults.map(({ asset, collection }, index) => (
										<TokenMarketRow
											asset={asset}
											collection={collection}
											context="Fungible token"
											key={`${collection.id}-${asset.id}`}
											onFollow={followSearchResult}
											onWarm={() => search.prefetchAsset(asset.id, true)}
											priority={index === 0}
										/>
									))}
								</div>
							</section>
						) : null}
						{search.collectibleResults.length ? (
							<section className="search-result-section">
								<div className="search-result-heading">
									<h2>{normalizedQuery ? 'Matching Uniques' : 'Featured Uniques'}</h2>
									<span>{search.collectibleResults.length} shown</span>
								</div>
								<div className="search-asset-grid">
									{search.collectibleResults.map(({ asset, collection }) => (
										<Link
											key={`${collection.id}-${asset.id}`}
											to={`/asset/${collection.id}/${asset.id}`}
											onClick={followSearchResult}
											onFocus={() => search.prefetchAsset(asset.id, collection.kind === 'tokens')}
											onMouseEnter={() =>
												search.prefetchAsset(asset.id, collection.kind === 'tokens')
											}
											onTouchStart={() =>
												search.prefetchAsset(asset.id, collection.kind === 'tokens')
											}
										>
											<span
												className={`search-result-image${
													collection.kind === 'tokens' ? ' token-avatar-slot' : ''
												}`}
											>
												{collection.kind === 'tokens' ? (
													<TokenAvatar image={asset.image} ticker={asset.ticker ?? 'Token'} />
												) : asset.image ? (
													<ArtworkImage src={asset.image} alt="" />
												) : isAudioContentType(asset.contentType) ? (
													<AudioArtwork contentType={asset.contentType} name={asset.name} />
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
						{search.directTokenCollection ? (
							<section className="search-result-section">
								<div className="search-result-heading">
									<h2>Direct process</h2>
									<span>Live state check required</span>
								</div>
								<div className="search-asset-grid">
									<Link
										to={`/asset/${search.directTokenCollection.id}/${query.trim()}`}
										onClick={followSearchResult}
										onFocus={() => search.prefetchAsset(query.trim(), true)}
										onMouseEnter={() => search.prefetchAsset(query.trim(), true)}
										onTouchStart={() => search.prefetchAsset(query.trim(), true)}
									>
										<span className="search-result-image token-avatar-slot">
											<TokenAvatar ticker="Token" />
										</span>
										<span>
											<strong>Check token process</strong>
											<small>{short(query.trim())} · support is determined from live state</small>
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
						!search.collectionResults.length &&
						!assetResultCount &&
						!search.directTokenCollection ? (
							<div className="search-empty">
								<strong>No results for “{query}”</strong>
								<span>
									{search.partialTokenCollection
										? 'More token records remain available from the token collection.'
										: atomicIndexSearchFailed
										? 'Permanent Bazar creation-record search is temporarily unavailable. Try again shortly.'
										: 'Try the full asset name or process ID. Newly created assets may take time to appear in search.'}
								</span>
							</div>
						) : null}
					</div>
				</div>
			</Dialog>
		</>
	);
}
