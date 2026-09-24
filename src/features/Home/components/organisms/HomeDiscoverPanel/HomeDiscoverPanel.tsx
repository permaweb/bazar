import { ArrowRight } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Eyebrow } from 'components/atoms/Eyebrow';
import { Icon } from 'components/atoms/Icon';
import { Loading } from 'components/atoms/Loading';
import { Pagination } from 'components/molecules/Pagination';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { HOME_MESSAGES } from '../../../messages';
import type { HomeAssetType, HomeAssetView } from '../../../model/home-market';
import type { HomeDiscoverView, HomeMarketEntry } from '../../../model/home-market-view';
import { HomeAssetTile } from '../../molecules/HomeAssetTile';
import { HomeTokenRow } from '../../molecules/HomeTokenRow';

import * as S from './styles';

export default function HomeDiscoverPanel(props: {
	discover: HomeDiscoverView;
	assetType: HomeAssetType;
	assetView: HomeAssetView;
	onAssetTypeChange(assetType: HomeAssetType): void;
	onTokenPageChange(page: number): void;
	onAssetPageChange(page: number): void;
}) {
	const messages = useMessages(HOME_MESSAGES);
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
		<S.AssetGrid className="home-asset-grid">
			{items.map(({ asset, collection }, index) => (
				<HomeAssetTile
					asset={asset}
					collection={collection}
					key={`${collection.id}-${asset.id}`}
					price={props.discover.prices[asset.id]}
					priority={index < 2}
				/>
			))}
		</S.AssetGrid>
	);
	return (
		<div
			aria-busy={props.discover.pending}
			aria-labelledby="home-discover-tab"
			id="home-discover-panel"
			role="tabpanel"
		>
			{props.discover.initialLoading ? (
				<S.MarketLoading className="home-market-loading">
					<Loading label={messages.homeDiscoverLoading} />
				</S.MarketLoading>
			) : props.discover.displayed.length ? (
				props.assetType === 'all' ? (
					<S.MarketSections className="discover-market-sections">
						<S.MarketSection className="discover-market-section token-section">
							<S.MarketHeading className="discover-market-heading">
								<div>
									<Eyebrow>{messages.homeTokensEyebrow}</Eyebrow>
									<h2>{messages.homeTokensHeading}</h2>
								</div>
								<Button size="custom" onClick={() => props.onAssetTypeChange('tokens')}>
									{messages.homeViewAllTokens}
									<Icon icon={ArrowRight} size="xs" />
								</Button>
							</S.MarketHeading>
							{props.discover.tokens.length ? (
								<>
									{renderTokenList(props.discover.tokenPagination.items)}
									<Pagination
										ariaLabel={messages.homeTokenOverviewPages}
										className="discover-token-pagination"
										nextLabel={messages.homePaginationNext}
										pageLabel={(page) => formatMessage(messages.homePaginationPage, { page })}
										previousLabel={messages.homePaginationPrevious}
										onPageChange={props.onTokenPageChange}
										page={props.discover.tokenPagination.page}
										pageCount={props.discover.tokenPagination.pageCount}
									/>
								</>
							) : (
								<S.SectionEmpty className="discover-section-empty">{messages.homeNoTokens}</S.SectionEmpty>
							)}
						</S.MarketSection>
						<S.MarketSection className="discover-market-section collectible-section">
							<S.MarketHeading className="discover-market-heading">
								<div>
									<Eyebrow>{messages.homeUniquesEyebrow}</Eyebrow>
									<h2>{messages.homeUniquesHeading}</h2>
								</div>
								<Button size="custom" onClick={() => props.onAssetTypeChange('atomic')}>
									{messages.homeViewAllUniques}
									<Icon icon={ArrowRight} size="xs" />
								</Button>
							</S.MarketHeading>
							{props.discover.collectibles.length ? (
								renderCollectibleGrid(props.discover.collectibles.slice(0, 12))
							) : (
								<S.SectionEmpty className="discover-section-empty">{messages.homeNoUniques}</S.SectionEmpty>
							)}
						</S.MarketSection>
					</S.MarketSections>
				) : (
					<>
						{props.assetType === 'tokens'
							? renderTokenList(props.discover.assetPagination.items)
							: renderCollectibleGrid(props.discover.assetPagination.items)}
						<Pagination
							ariaLabel={
								props.assetType === 'tokens' ? messages.homeTokenPages : messages.homeUniquePages
							}
							className="home-asset-pagination"
							nextLabel={messages.homePaginationNext}
							pageLabel={(page) => formatMessage(messages.homePaginationPage, { page })}
							previousLabel={messages.homePaginationPrevious}
							onPageChange={props.onAssetPageChange}
							page={props.discover.assetPagination.page}
							pageCount={props.discover.assetPagination.pageCount}
						/>
					</>
				)
			) : props.discover.failed ? null : (
				<S.AssetsEmpty className="home-assets-empty">
					{props.assetView === 'all' ? messages.homeNoRecords : messages.homeNoListings}
				</S.AssetsEmpty>
			)}
		</div>
	);
}
