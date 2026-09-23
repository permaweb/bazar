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

import type { Collection } from 'api/collections';

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
import { audioFormatLabel, isAudioContentType } from 'helpers/asset-media';
import { short } from 'helpers/format';
import { formatMessage } from 'helpers/i18n';
import { type MarketplaceSearchScope, useMarketplaceSearch } from 'hooks/useMarketplaceSearch';
import { GatewayControl } from 'navigation/GatewayControl';
import { OperationActivityControl } from 'navigation/OperationActivityControl';
import { WalletMenu } from 'navigation/WalletMenu';
import { useMessages, usePlural } from 'providers/LanguageProvider';
import { useMarketProvider } from 'providers/MarketProvider';

import { HEADER_MESSAGES, type HeaderMessages } from './messages';

/** Navigation's own wording for the collections the catalogue adapter describes with a code. */
function collectionDescriptionText(collection: Collection, language: HeaderMessages) {
	if (collection.descriptionCode === 'fungible-tokens') return language.collectionDescriptionFungibleTokens;
	if (collection.descriptionCode === 'arweave-names') return language.collectionDescriptionArweaveNames;
	if (collection.descriptionCode === 'permanent-collection') return language.collectionDescriptionPermanent;
	return collection.description;
}

export default function Header() {
	const location = useLocation();
	const navigate = useNavigate();
	const language = useMessages(HEADER_MESSAGES);
	const plural = usePlural();
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
	const describeCollection = React.useCallback(
		(collection: Collection) => collectionDescriptionText(collection, language),
		[language]
	);
	const search = useMarketplaceSearch({ open: searchOpen, query, scope, describeCollection });
	const assetResultCount = search.tokenResults.length + search.collectibleResults.length;
	const atomicIndexSearchPending = search.indexSearch === 'pending';
	const atomicIndexSearchFailed = search.indexSearch === 'failed';
	const summaryAssetCount = assetResultCount + (search.directTokenCollection ? 1 : 0);
	const searchResultAnnouncement = atomicIndexSearchPending
		? language.headerSearchIndexPendingAnnouncement
		: atomicIndexSearchFailed
		? language.headerSearchIndexFailedAnnouncement
		: market.loading
		? language.headerSearchCollectionsLoadingAnnouncement
		: market.error
		? language.headerSearchUnavailableAnnouncement
		: normalizedQuery && !search.collectionResults.length && !assetResultCount && !search.directTokenCollection
		? formatMessage(
				search.partialTokenCollection ? language.headerSearchNoMatchesPartial : language.headerSearchNoMatches,
				{ query: query.trim() }
		  )
		: formatMessage(normalizedQuery ? language.headerSearchSummaryForQuery : language.headerSearchSummary, {
				collections: plural(language.headerSearchSummaryCollections, search.collectionResults.length, {
					count: search.collectionResults.length.toLocaleString(),
				}),
				assets: plural(language.headerSearchSummaryAssets, summaryAssetCount, {
					count: summaryAssetCount.toLocaleString(),
				}),
				query: query.trim(),
		  });
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
		setSearchFeedback(language.headerSearchRecentCleared);
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
		{ id: 'all' as const, label: language.headerSearchScopeAll, Icon: Search },
		{ id: 'tokens' as const, label: language.headerSearchScopeTokens, Icon: BarChart3 },
		{ id: 'collections' as const, label: language.headerSearchScopeCollections, Icon: LayoutGrid },
		{ id: 'assets' as const, label: language.headerSearchScopeAssets, Icon: Images },
		{ id: 'names' as const, label: language.headerSearchScopeNames, Icon: AtSign },
	];
	return (
		<>
			<header className="site-header">
				<div className="site-header-content max-view-wrapper">
					<Link aria-label={language.headerHome} className="brand" to="/">
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
							aria-label={language.headerSearchLabel}
							placeholder={language.headerSearchPlaceholder}
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
								content={language.headerCreateAsset}
								delayMs={1000}
							>
								{(tooltipId) => (
									<Link
										aria-describedby={tooltipId}
										aria-label={language.headerCreateAsset}
										aria-current={location.pathname === '/create' ? 'page' : undefined}
										className={`create-link${location.pathname === '/create' ? ' active' : ''}`}
										to="/create"
									>
										<Icon icon={Upload} size="sm" />
										<span className="create-link-label">{language.headerCreate}</span>
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
				label={language.headerSearchDialog}
				onDismiss={closeSearch}
				open={searchOpen}
				restoreTarget={searchRestoreTarget}
			>
				<form className="search-panel-query" role="search" onSubmit={submitSearch}>
					<Icon icon={Search} />
					<TextInput
						autoFocus
						aria-label={language.headerSearchPanelLabel}
						placeholder={language.headerSearchPanelPlaceholder}
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
							aria-label={language.headerSearchClearLabel}
							variant="ghost"
						>
							{language.headerSearchClear}
						</Button>
					) : null}
					<Button
						size="icon"
						className="search-panel-submit"
						type="submit"
						aria-label={language.headerSearchSubmitLabel}
						variant="primary"
					>
						<Icon icon={ArrowRight} size="sm" />
					</Button>
					<IconButton
						icon={X}
						label={language.headerSearchCloseLabel}
						onClick={() => closeSearch()}
						className="search-panel-close"
					/>
				</form>
				<aside className="search-categories" aria-label={language.headerSearchCategories}>
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
							<Loading label={language.headerSearchCollectionsLoading} />
						) : null}
						{atomicIndexSearchPending && !assetResultCount ? (
							<Loading label={language.headerSearchIndexPending} />
						) : null}
						{search.partialTokenCollection ? (
							<div className="collection-source-notice">
								<span role="status">
									{formatMessage(language.headerTokenCoverage, {
										loaded: search.partialTokenCollection.assets.length.toLocaleString(),
										discovered: (
											search.partialTokenCollection.total ??
											search.partialTokenCollection.assets.length
										).toLocaleString(),
									})}
								</span>
								<Link
									className="with-icon"
									to={`/collection/${search.partialTokenCollection.id}?q=${encodeURIComponent(
										query.trim()
									)}`}
									onClick={followSearchResult}
								>
									{language.headerContinueTokenSearch}
									<Icon icon={ArrowRight} size="xs" />
								</Link>
							</div>
						) : null}
						{!normalizedQuery && recentQueries.length ? (
							<section className="search-result-section">
								<div className="search-result-heading">
									<h2>{language.headerRecentSearches}</h2>
									<Button onClick={clearRecentSearches} size="custom" variant="ghost">
										{language.headerRecentSearchesClear}
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
									<h2>
										{normalizedQuery
											? language.headerMatchingCollections
											: language.headerFeaturedCollections}
									</h2>
									<span>
										{formatMessage(language.headerResultsShown, {
											count: search.collectionResults.length,
										})}
									</span>
								</div>
								<div className="search-collection-grid">
									{search.collectionResults.map(({ collection }) => {
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
															ticker={tokenPreview?.ticker ?? language.headerTokenTicker}
														/>
													) : preview ? (
														<ArtworkImage
															src={preview}
															alt=""
															unavailableLabel={language.headerArtworkUnavailable}
														/>
													) : collection.kind === 'names' ? (
														<NamesCubePreview />
													) : (
														<BazarMark />
													)}
												</span>
												<span>
													<strong>{collection.name}</strong>
													<small>
														{formatMessage(language.headerCollectionMeta, {
															kind: collectionKindLabel(collection.kind, language),
															detail:
																collection.kind === 'names'
																	? formatMessage(
																			language.headerCollectionNamesLoaded,
																			{
																				count: collection.assets.length.toLocaleString(),
																			}
																	  )
																	: plural(
																			language.headerCollectionAssets,
																			collection.total ??
																				collection.assets.length,
																			{
																				count: (
																					collection.total ??
																					collection.assets.length
																				).toLocaleString(),
																			}
																	  ),
														})}
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
									<h2>{normalizedQuery ? language.headerMatchingTokens : language.headerTokens}</h2>
									<span>
										{formatMessage(language.headerResultsShown, {
											count: search.tokenResults.length,
										})}
									</span>
								</div>
								<div className="token-market-list compact">
									{search.tokenResults.map(({ asset, collection }, index) => (
										<TokenMarketRow
											asset={asset}
											collection={collection}
											context={language.headerTokenMarketContext}
											tickerFallback={language.headerTokenTickerFallback}
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
									<h2>
										{normalizedQuery
											? language.headerMatchingUniques
											: language.headerFeaturedUniques}
									</h2>
									<span>
										{formatMessage(language.headerResultsShown, {
											count: search.collectibleResults.length,
										})}
									</span>
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
													<TokenAvatar
														image={asset.image}
														ticker={asset.ticker ?? language.headerTokenTicker}
													/>
												) : asset.image ? (
													<ArtworkImage
														src={asset.image}
														alt=""
														unavailableLabel={language.headerArtworkUnavailable}
													/>
												) : isAudioContentType(asset.contentType) ? (
													<AudioArtwork
														contentType={asset.contentType}
														label={formatMessage(language.headerAudioArtworkLabel, {
															format: audioFormatLabel(asset.contentType),
															name: asset.name,
														})}
														typeLabel={language.headerAudioArtworkType}
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
						{search.directTokenCollection ? (
							<section className="search-result-section">
								<div className="search-result-heading">
									<h2>{language.headerDirectProcess}</h2>
									<span>{language.headerDirectProcessNote}</span>
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
											<TokenAvatar ticker={language.headerTokenTicker} />
										</span>
										<span>
											<strong>{language.headerCheckTokenProcess}</strong>
											<small>
												{formatMessage(language.headerCheckTokenProcessDetail, {
													id: short(query.trim()),
												})}
											</small>
										</span>
										<Icon icon={ArrowUpRight} size="sm" />
									</Link>
								</div>
							</section>
						) : null}
						{market.error ? (
							<ErrorPanel
								heading={language.headerErrorHeading}
								message={market.error}
								retryAction={{ label: language.headerErrorRetry, onClick: market.retry }}
							/>
						) : null}
						{!market.loading &&
						!market.error &&
						!atomicIndexSearchPending &&
						!search.collectionResults.length &&
						!assetResultCount &&
						!search.directTokenCollection ? (
							<div className="search-empty">
								<strong>{formatMessage(language.headerNoResults, { query })}</strong>
								<span>
									{search.partialTokenCollection
										? language.headerNoResultsPartialTokens
										: atomicIndexSearchFailed
										? language.headerNoResultsIndexFailed
										: language.headerNoResultsHint}
								</span>
							</div>
						) : null}
					</div>
				</div>
			</Dialog>
		</>
	);
}

/** Navigation may not import a feature, so the collection's stable kind code is mapped to copy here. */
function collectionKindLabel(kind: Collection['kind'], language: HeaderMessages): string {
	if (kind === 'names') return language.headerCollectionKindNames;
	if (kind === 'tokens') return language.headerCollectionKindTokens;
	return language.headerCollectionKindAssets;
}
