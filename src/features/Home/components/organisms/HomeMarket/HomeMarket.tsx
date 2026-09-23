import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, History, LayoutGrid } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Select } from 'components/atoms/Select';
import { VisuallyHidden } from 'components/atoms/VisuallyHidden';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import { requestFailureMessage } from 'helpers/app-error';
import { formatMessage } from 'helpers/i18n';
import { useAppErrorMessages } from 'hooks/useAppErrorMessage';
import { useMessages } from 'providers/LanguageProvider';
import { useMarketProvider } from 'providers/MarketProvider';

import { useHomeMarket } from '../../../hooks/useHomeMarket';
import { HOME_MESSAGES } from '../../../messages';
import {
	type HomeAssetType,
	type HomeAssetView,
	type HomeCollectionSort,
	homeRouteSearch,
	type HomeTab,
	homeTabFromPathname,
	homeTabPath,
} from '../../../model/home-market';
import { HomeActivityPanel } from '../HomeActivityPanel';
import { HomeCollectionsPanel } from '../HomeCollectionsPanel';
import { HomeDiscoverPanel } from '../HomeDiscoverPanel';

export default function HomeMarket() {
	const location = useLocation();
	const navigate = useNavigate();
	const market = useMarketProvider();
	const messages = useMessages(HOME_MESSAGES);
	const errorMessages = useAppErrorMessages();
	const marketPaneRef = React.useRef<HTMLDivElement>(null);
	const homeTab = homeTabFromPathname(location.pathname);
	const query = new URLSearchParams(location.search).get('q') ?? '';
	const home = useHomeMarket(homeTab, query);

	const handleTabSelect = (tab: HomeTab) => {
		navigate({ pathname: homeTabPath(tab), search: homeRouteSearch(location.search) });
		if (marketPaneRef.current) marketPaneRef.current.scrollTop = 0;
	};
	const handleAssetPageChange = (page: number) => {
		home.setAssetPage(page);
		marketPaneRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
	};
	return (
		<div className="home-shell">
			<div className="home-main">
				<div className="home-content">
					<div className="home-market-layout" ref={marketPaneRef}>
						<section className="home-section home-assets" id="market">
							<VisuallyHidden as="h1">{messages.homeMarketplace}</VisuallyHidden>
							<div className="home-section-heading">
								<div>
									<div
										aria-label={messages.homeMarketplaceView}
										className="home-market-tabs"
										role="tablist"
									>
										<Button
											aria-controls="home-discover-panel"
											aria-selected={homeTab === 'discover'}
											className="home-market-tab"
											id="home-discover-tab"
											onClick={() => handleTabSelect('discover')}
											role="tab"
											size="small"
										>
											<Icon icon={Compass} />
											{messages.homeTabDiscover}
										</Button>
										<Button
											aria-controls="home-collections-panel"
											aria-selected={homeTab === 'collections'}
											className="home-market-tab"
											id="home-collections-tab"
											onClick={() => handleTabSelect('collections')}
											role="tab"
											size="small"
										>
											<Icon icon={LayoutGrid} />
											{messages.homeTabCollections}
										</Button>
										<Button
											aria-controls="home-activity-panel"
											aria-selected={homeTab === 'activity'}
											className="home-market-tab"
											id="home-activity-tab"
											onClick={() => handleTabSelect('activity')}
											role="tab"
											size="small"
										>
											<Icon icon={History} />
											{messages.homeTabActivity}
										</Button>
									</div>
									<p>
										{homeTab === 'discover'
											? home.normalizedQuery
												? formatMessage(messages.homeDiscoverSearchIntro, { query })
												: messages.homeDiscoverIntro
											: homeTab === 'collections'
											? messages.homeCollectionsIntro
											: messages.homeActivityIntro}
									</p>
								</div>
								{homeTab === 'discover' ? (
									<div aria-busy={home.discover.pending} className="home-asset-filters">
										<Select<HomeAssetType>
											label={messages.homeAssetTypeLabel}
											onChange={home.setAssetType}
											options={[
												{ value: 'all', label: messages.homeAssetTypeAll },
												{ value: 'tokens', label: messages.homeAssetTypeTokens },
												{ value: 'atomic', label: messages.homeAssetTypeAtomic },
											]}
											value={home.assetType}
										/>
										<Select<HomeAssetView>
											label={messages.homeAssetViewLabel}
											onChange={home.setAssetView}
											options={[
												{ value: 'all', label: messages.homeAssetViewAll },
												{ value: 'listed', label: messages.homeAssetViewListed },
												{ value: 'price-low', label: messages.homeAssetViewPriceLow },
												{ value: 'price-high', label: messages.homeAssetViewPriceHigh },
											]}
											value={home.assetView}
										/>
									</div>
								) : homeTab === 'collections' ? (
									<div aria-busy={home.collections.pending} className="home-asset-filters">
										<Select<HomeCollectionSort>
											label={messages.homeCollectionSortLabel}
											onChange={home.setCollectionSort}
											options={[
												{ value: 'recent', label: messages.homeCollectionSortRecent },
												{ value: 'newest', label: messages.homeCollectionSortNewest },
												{ value: 'oldest', label: messages.homeCollectionSortOldest },
											]}
											value={home.collectionSort}
										/>
									</div>
								) : null}
							</div>
							{market.error ? (
								<ErrorPanel
									heading={messages.homeErrorHeading}
									message={market.error}
									retryAction={{ label: messages.homeErrorRetry, onClick: market.retry }}
								/>
							) : null}
							{homeTab === 'discover' && home.listingFailure ? (
								<ErrorPanel
									heading={messages.homeErrorHeading}
									message={requestFailureMessage(
										errorMessages,
										home.listingFailure.source,
										home.listingFailure.kind
									)}
									retryAction={{ label: messages.homeErrorRetry, onClick: home.retryListings }}
								/>
							) : null}
							{homeTab === 'discover' && home.partialTokenCollection ? (
								<div className="collection-source-notice">
									<span role="status">
										{formatMessage(messages.homeTokenSearchCoverage, {
											loaded: home.partialTokenCollection.assets.length.toLocaleString(),
											total: (
												home.partialTokenCollection.total ??
												home.partialTokenCollection.assets.length
											).toLocaleString(),
										})}
									</span>
									<Link
										className="with-icon"
										to={`/collection/${home.partialTokenCollection.id}?q=${encodeURIComponent(
											query.trim()
										)}`}
									>
										{messages.homeTokenSearchContinue}
										<Icon icon={ArrowRight} size="xs" />
									</Link>
								</div>
							) : null}
							{homeTab === 'collections' ? (
								<HomeCollectionsPanel
									collections={home.collections}
									marketFailed={Boolean(market.error)}
									query={query}
								/>
							) : homeTab === 'activity' ? (
								<HomeActivityPanel collections={market.collections} marketLoading={market.loading} />
							) : (
								<HomeDiscoverPanel
									assetType={home.assetType}
									assetView={home.assetView}
									discover={home.discover}
									onAssetPageChange={handleAssetPageChange}
									onAssetTypeChange={home.setAssetType}
									onTokenPageChange={home.setTokenPage}
								/>
							)}
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}
