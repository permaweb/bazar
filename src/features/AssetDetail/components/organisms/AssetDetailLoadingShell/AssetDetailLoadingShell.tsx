import { Link } from 'react-router-dom';

import type { AssetSummary, Collection } from 'api/collections';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { AudioArtwork } from 'components/atoms/AudioArtwork';
import { NameArtwork } from 'components/atoms/NameArtwork';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { ErrorPanel, type ErrorPanelAction } from 'components/molecules/ErrorPanel';
import { isAudioContentType } from 'helpers/asset-media';
import { formatTickerLabel } from 'helpers/token-display';
import { useMessages } from 'providers/LanguageProvider';
import { useWallet } from 'providers/WalletProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { assetDetailLoadingShellView, audioArtworkLabel } from '../../../model/asset-detail';

import * as S from './styles';

export default function AssetDetailLoadingShell(props: {
	asset?: AssetSummary;
	collection?: Collection;
	collectionId: string;
	error?: string | null;
	onRetry?: () => void;
	secondaryAction?: ErrorPanelAction;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const wallet = useWallet();
	const { kind, device, detailClass, collectionName } = assetDetailLoadingShellView(
		props.collection,
		props.collectionId,
		messages
	);
	const retryAction = props.onRetry ? { label: messages.assetDetailRetry, onClick: props.onRetry } : undefined;

	if (kind === 'tokens') {
		return (
			<S.FungibleShell className="asset-page asset-detail-page asset-detail-loading-shell fungible-asset-page">
				<S.TokenHeader className="fungible-token-header">
					{props.asset ? (
						<S.TokenAvatarFrame
							className="fungible-token-avatar"
							fetchPriority="high"
							image={props.asset.image}
							loading="eager"
							ticker={props.asset.ticker ?? props.asset.name}
						/>
					) : (
						<S.AvatarPlaceholder className="fungible-token-avatar layout-placeholder" aria-hidden="true" />
					)}
					<S.TokenIdentity className="fungible-token-identity">
						<S.TokenTitle className="fungible-token-title">
							{props.asset ? (
								<h1>{formatTickerLabel(props.asset.ticker, messages.validationDefaultTicker)}</h1>
							) : (
								<S.PlaceholderTitle className="layout-placeholder layout-placeholder-title" />
							)}
							{props.asset ? (
								<S.TokenName className="fungible-token-name">{props.asset.name}</S.TokenName>
							) : null}
						</S.TokenTitle>
						<S.TokenMeta className="fungible-token-meta" aria-hidden="true">
							{props.collection ? (
								<Link to={`/collection/${props.collection.id}`}>{collectionName}</Link>
							) : (
								<span>{collectionName}</span>
							)}
							<span>{device}</span>
						</S.TokenMeta>
					</S.TokenIdentity>
					<S.TokenBalance aria-hidden="true" className="fungible-token-balance">
						<span>
							{wallet.address
								? messages.loadingShellYourLiquidBalance
								: messages.loadingShellCirculatingSupply}
						</span>
						<S.BalancePlaceholder as="strong" className="layout-placeholder asset-loading-balance" />
					</S.TokenBalance>
				</S.TokenHeader>
				{props.error ? (
					<ErrorPanel
						heading={messages.assetDetailErrorHeading}
						message={props.error}
						retryAction={retryAction}
						secondaryAction={props.secondaryAction}
					/>
				) : (
					<S.LoadingVerification
						aria-live="polite"
						className="state-verification asset-loading-verification"
						role="status"
					>
						<span aria-hidden="true" /> {messages.assetDetailComputingState}
					</S.LoadingVerification>
				)}
				<S.Layout className="asset-detail-layout">
					<S.CommerceColumn className="asset-commerce-column asset-commerce-primary">
						<S.CommerceCardLoading
							as="section"
							aria-hidden="true"
							className="asset-commerce-card asset-commerce-card-loading"
						>
							<S.LoadingMarketStats className="asset-market-stats asset-loading-market-stats">
								{[
									messages.fungibleStatCurrentUnitPrice,
									messages.fungibleStatForSale,
									messages.fungibleStatYourListed,
									messages.fungibleStatHolders,
								].map((label) => (
									<div key={label}>
										<span>{label}</span>
										<S.Placeholder as="i" className="layout-placeholder" />
									</div>
								))}
							</S.LoadingMarketStats>
							<S.TradeSwitcher className="fungible-trade-switcher">
								<S.LoadingTradeTabs className="segmented-tabs fungible-trade-tabs asset-loading-trade-tabs">
									<span>{messages.fungibleTradeBuy}</span>
									<span>{messages.fungibleTradeSell}</span>
									<span>{messages.fungibleTradeTransfer}</span>
								</S.LoadingTradeTabs>
							</S.TradeSwitcher>
							<S.LoadingTradeComposer className="asset-loading-trade-composer">
								<div>
									<span>{messages.loadingShellYouBuy}</span>
									<S.Placeholder as="i" className="layout-placeholder" />
									<S.Placeholder as="small" className="layout-placeholder" />
								</div>
								<div>
									<span>{messages.loadingShellYouPay}</span>
									<S.Placeholder as="i" className="layout-placeholder" />
									<S.Placeholder as="small" className="layout-placeholder" />
								</div>
							</S.LoadingTradeComposer>
							<S.ActionPlaceholder className="layout-placeholder asset-loading-action" />
						</S.CommerceCardLoading>
					</S.CommerceColumn>
					<S.CommerceColumn className="asset-commerce-column asset-commerce-secondary">
						<S.LoadingTabs
							as="nav"
							aria-hidden="true"
							className="home-market-tabs asset-detail-tabs asset-section-tabs-loading"
						>
							<span>{messages.fungibleTabMarket}</span>
							<span>{messages.fungibleTabHolders}</span>
							<span>{messages.fungibleTabAbout}</span>
						</S.LoadingTabs>
						<S.LoadingMarketPanel
							aria-hidden="true"
							className="fungible-market-panel asset-loading-market-panel"
						>
							<S.LoadingChart className="token-price-chart asset-loading-chart">
								<S.Heading className="token-price-chart-heading">
									<S.LoadingChartQuote className="asset-loading-chart-quote">
										<span>{messages.loadingShellIndexedAskHistory}</span>
										<S.Placeholder as="strong" className="layout-placeholder" />
									</S.LoadingChartQuote>
									<S.LoadingChartRanges className="asset-loading-chart-ranges">
										{Array.from({ length: 4 }, (_, index) => (
											<S.Placeholder className="layout-placeholder" key={index} />
										))}
									</S.LoadingChartRanges>
								</S.Heading>
								<S.LoadingChartPlot className="asset-loading-chart-plot">
									<span />
									<span />
									<span />
								</S.LoadingChartPlot>
							</S.LoadingChart>
							<S.LoadingOrderbook className="orderbook-table fungible-orderbook asset-loading-orderbook">
								<S.Head className="orderbook-head">
									<span>{messages.uniqueOrderColumnPrice}</span>
									<span>{messages.loadingShellOrderbookSize}</span>
									<span>{messages.loadingShellOrderbookValue}</span>
									<span>{messages.orderbookColumnSeller}</span>
									<span>{messages.orderbookColumnState}</span>
								</S.Head>
								{Array.from({ length: 3 }, (_, row) => (
									<S.Row className="orderbook-row" key={row}>
										{Array.from({ length: 5 }, (_, column) => (
											<S.Placeholder className="layout-placeholder" key={column} />
										))}
									</S.Row>
								))}
							</S.LoadingOrderbook>
							<S.LoadingActivity className="asset-loading-activity">
								<h2>{messages.loadingShellActivity}</h2>
								{Array.from({ length: 3 }, (_, row) => (
									<div key={row}>
										<S.Placeholder className="layout-placeholder" />
										<S.Placeholder className="layout-placeholder" />
										<S.Placeholder className="layout-placeholder" />
									</div>
								))}
							</S.LoadingActivity>
						</S.LoadingMarketPanel>
					</S.CommerceColumn>
				</S.Layout>
			</S.FungibleShell>
		);
	}

	return (
		<S.AtomicShell className={`asset-page asset-detail-page asset-detail-loading-shell ${detailClass}`}>
			<S.Layout className="asset-detail-layout">
				<S.CommerceColumn className="asset-commerce-column asset-commerce-primary">
					<S.Identity className="asset-details asset-identity">
						<S.Kicker className="asset-kicker">
							{props.collection ? (
								<S.CollectionLink
									as={Link}
									className="asset-collection-link"
									to={`/collection/${props.collection.id}`}
								>
									{collectionName}
								</S.CollectionLink>
							) : (
								<S.CollectionLink className="asset-collection-link">{collectionName}</S.CollectionLink>
							)}
						</S.Kicker>
						{props.asset ? (
							<h1>{props.asset.name}</h1>
						) : (
							<S.PlaceholderTitle className="layout-placeholder layout-placeholder-title" />
						)}
						<S.OwnerLine className="asset-owner-line">
							<span>{messages.loadingShellOwnership}</span>
						</S.OwnerLine>
						<S.TokenTags className="asset-token-tags" aria-hidden="true">
							<span>{device}</span>
							<span>{messages.uniqueProtocolNetwork}</span>
							<span>{messages.uniqueProtocolSupply}</span>
						</S.TokenTags>
						{props.error ? (
							<ErrorPanel
								heading={messages.assetDetailErrorHeading}
								message={props.error}
								retryAction={retryAction}
								secondaryAction={props.secondaryAction}
							/>
						) : (
							<S.LoadingVerification
								aria-live="polite"
								className="state-verification asset-loading-verification"
								role="status"
							>
								<span aria-hidden="true" /> {messages.assetDetailComputingState}
							</S.LoadingVerification>
						)}
						<S.CommerceCardLoading
							as="section"
							aria-hidden="true"
							className="asset-commerce-card asset-commerce-card-loading"
						>
							<S.StatGrid className="asset-loading-stat-grid">
								{Array.from({ length: 4 }, (_, index) => (
									<S.Placeholder className="layout-placeholder" key={index} />
								))}
							</S.StatGrid>
							<S.SummaryPlaceholder className="layout-placeholder asset-loading-summary" />
							<S.ActionPlaceholder className="layout-placeholder asset-loading-action" />
						</S.CommerceCardLoading>
					</S.Identity>
				</S.CommerceColumn>
				<S.VisualColumn className="asset-visual-column">
					<S.HeroMedia className="asset-hero-media">
						{props.asset?.image ? (
							<ArtworkImage
								src={props.asset.image}
								alt={props.asset.name}
								fetchPriority="high"
								loading="eager"
								unavailableLabel={messages.assetDetailArtworkUnavailable}
							/>
						) : props.asset && isAudioContentType(props.asset.contentType) ? (
							<AudioArtwork
								contentType={props.asset.contentType}
								label={audioArtworkLabel(props.asset, messages)}
								typeLabel={messages.assetDetailAudioArtworkType}
							/>
						) : kind === 'names' && props.asset ? (
							<NameArtwork name={props.asset.name} />
						) : (
							<S.ArtworkPlaceholder className="layout-placeholder asset-loading-artwork" />
						)}
					</S.HeroMedia>
				</S.VisualColumn>
				<S.CommerceColumn className="asset-commerce-column asset-commerce-secondary">
					<S.LoadingTabs
						as="nav"
						aria-hidden="true"
						className="home-market-tabs asset-detail-tabs asset-section-tabs-loading"
					>
						<span>{messages.loadingShellDetails}</span>
						<span>{messages.loadingShellOrders}</span>
						<span>{messages.loadingShellActivity}</span>
					</S.LoadingTabs>
					<S.LoadingPanel aria-hidden="true" className="asset-loading-panel">
						<S.Placeholder className="layout-placeholder" />
						<S.Placeholder className="layout-placeholder" />
						<S.Placeholder className="layout-placeholder" />
					</S.LoadingPanel>
				</S.CommerceColumn>
			</S.Layout>
		</S.AtomicShell>
	);
}
