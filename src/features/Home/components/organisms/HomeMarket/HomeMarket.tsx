import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, History, LayoutGrid } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Select } from 'components/atoms/Select';
import { VisuallyHidden } from 'components/atoms/VisuallyHidden';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import { requestFailureMessage } from 'helpers/app-error';
import { useMarketProvider } from 'providers/MarketProvider';

import { useHomeMarket } from '../../../hooks/useHomeMarket';
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
							<VisuallyHidden as="h1">Marketplace</VisuallyHidden>
							<div className="home-section-heading">
								<div>
									<div aria-label="Marketplace view" className="home-market-tabs" role="tablist">
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
											Discover
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
											Collections
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
											Activity
										</Button>
									</div>
									<p>
										{homeTab === 'discover'
											? home.normalizedQuery
												? `Results for “${query}” across the current Arweave collection indexes.`
												: 'Browse fungible tokens and Uniques on the permaweb.'
											: homeTab === 'collections'
											? 'Browse NFT and name collections.'
											: 'Latest indexed purchases, listings, and transfers across every marketplace collection.'}
									</p>
								</div>
								{homeTab === 'discover' ? (
									<div aria-busy={home.discover.pending} className="home-asset-filters">
										<Select<HomeAssetType>
											label="Asset type"
											onChange={home.setAssetType}
											options={[
												{ value: 'all', label: 'All' },
												{ value: 'tokens', label: 'Tokens' },
												{ value: 'atomic', label: 'Uniques (NFTs)' },
											]}
											value={home.assetType}
										/>
										<Select<HomeAssetView>
											label="View"
											onChange={home.setAssetView}
											options={[
												{ value: 'all', label: 'All records' },
												{ value: 'listed', label: 'Listed for sale' },
												{ value: 'price-low', label: 'Price: low to high' },
												{ value: 'price-high', label: 'Price: high to low' },
											]}
											value={home.assetView}
										/>
									</div>
								) : homeTab === 'collections' ? (
									<div aria-busy={home.collections.pending} className="home-asset-filters">
										<Select<HomeCollectionSort>
											label="Sort collections"
											onChange={home.setCollectionSort}
											options={[
												{ value: 'recent', label: 'Recent Activity' },
												{ value: 'newest', label: 'Newest' },
												{ value: 'oldest', label: 'Oldest' },
											]}
											value={home.collectionSort}
										/>
									</div>
								) : null}
							</div>
							{market.error ? <ErrorPanel message={market.error} onRetry={market.retry} /> : null}
							{homeTab === 'discover' && home.listingFailure ? (
								<ErrorPanel
									message={requestFailureMessage(
										home.listingFailure.source,
										home.listingFailure.kind
									)}
									onRetry={home.retryListings}
								/>
							) : null}
							{homeTab === 'discover' && home.partialTokenCollection ? (
								<div className="collection-source-notice">
									<span role="status">
										Search covers {home.partialTokenCollection.assets.length.toLocaleString()} of{' '}
										{(
											home.partialTokenCollection.total ??
											home.partialTokenCollection.assets.length
										).toLocaleString()}{' '}
										discovered token records currently loaded.
									</span>
									<Link
										className="with-icon"
										to={`/collection/${home.partialTokenCollection.id}?q=${encodeURIComponent(
											query.trim()
										)}`}
									>
										Continue token search
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
