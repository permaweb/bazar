import { ArrowRight } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Eyebrow } from 'components/atoms/Eyebrow';
import { Icon } from 'components/atoms/Icon';
import { Loading } from 'components/atoms/Loading';
import { Pagination } from 'components/molecules/Pagination';

import type { HomeAssetType, HomeAssetView } from '../../../model/home-market';
import type { HomeDiscoverView, HomeMarketEntry } from '../../../model/home-market-view';
import { HomeAssetTile } from '../../molecules/HomeAssetTile';
import { HomeTokenRow } from '../../molecules/HomeTokenRow';

export default function HomeDiscoverPanel(props: {
	discover: HomeDiscoverView;
	assetType: HomeAssetType;
	assetView: HomeAssetView;
	onAssetTypeChange(assetType: HomeAssetType): void;
	onTokenPageChange(page: number): void;
	onAssetPageChange(page: number): void;
}) {
	const renderTokenList = (items: HomeMarketEntry[]) => (
		<div className="token-market-list" role="list">
			{items.map(({ asset, collection }, index) => (
				<HomeTokenRow
					asset={asset}
					change={props.discover.tokenPriceChanges[asset.id]}
					collection={collection}
					image={props.discover.images[asset.id]}
					key={`${collection.id}-${asset.id}`}
					price={props.discover.prices[asset.id]}
					priority={index < 2}
				/>
			))}
		</div>
	);
	const renderCollectibleGrid = (items: HomeMarketEntry[]) => (
		<div className="home-asset-grid">
			{items.map(({ asset, collection }, index) => (
				<HomeAssetTile
					asset={asset}
					collection={collection}
					key={`${collection.id}-${asset.id}`}
					price={props.discover.prices[asset.id]}
					priority={index < 2}
				/>
			))}
		</div>
	);
	return (
		<div
			aria-busy={props.discover.pending}
			aria-labelledby="home-discover-tab"
			id="home-discover-panel"
			role="tabpanel"
		>
			{props.discover.initialLoading ? (
				<div className="home-market-loading">
					<Loading label="Loading marketplace assets…" />
				</div>
			) : props.discover.displayed.length ? (
				props.assetType === 'all' ? (
					<div className="discover-market-sections">
						<section className="discover-market-section token-section">
							<div className="discover-market-heading">
								<div>
									<Eyebrow>Fungible assets</Eyebrow>
									<h2>Tokens</h2>
								</div>
								<Button size="custom" onClick={() => props.onAssetTypeChange('tokens')}>
									View all tokens
									<Icon icon={ArrowRight} size="xs" />
								</Button>
							</div>
							{props.discover.tokens.length ? (
								<>
									{renderTokenList(props.discover.tokenPagination.items)}
									<Pagination
										ariaLabel="Token overview pages"
										className="discover-token-pagination"
										onPageChange={props.onTokenPageChange}
										page={props.discover.tokenPagination.page}
										pageCount={props.discover.tokenPagination.pageCount}
									/>
								</>
							) : (
								<p className="discover-section-empty">No tokens match this view.</p>
							)}
						</section>
						<section className="discover-market-section collectible-section">
							<div className="discover-market-heading">
								<div>
									<Eyebrow>1/1 assets</Eyebrow>
									<h2>Uniques</h2>
								</div>
								<Button size="custom" onClick={() => props.onAssetTypeChange('atomic')}>
									View all Uniques
									<Icon icon={ArrowRight} size="xs" />
								</Button>
							</div>
							{props.discover.collectibles.length ? (
								renderCollectibleGrid(props.discover.collectibles.slice(0, 12))
							) : (
								<p className="discover-section-empty">No Uniques match this view.</p>
							)}
						</section>
					</div>
				) : (
					<>
						{props.assetType === 'tokens'
							? renderTokenList(props.discover.assetPagination.items)
							: renderCollectibleGrid(props.discover.assetPagination.items)}
						<Pagination
							ariaLabel={props.assetType === 'tokens' ? 'Token pages' : 'Unique pages'}
							className="home-asset-pagination"
							onPageChange={props.onAssetPageChange}
							page={props.discover.assetPagination.page}
							pageCount={props.discover.assetPagination.pageCount}
						/>
					</>
				)
			) : props.discover.failed ? null : (
				<div className="home-assets-empty">
					{props.assetView === 'all' ? 'No records match this type.' : 'No live listings match this type.'}
				</div>
			)}
		</div>
	);
}
