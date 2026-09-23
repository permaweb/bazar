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
			<section className="asset-page asset-detail-page asset-detail-loading-shell fungible-asset-page">
				<header className="fungible-token-header">
					{props.asset ? (
						<TokenAvatar
							className="fungible-token-avatar"
							fetchPriority="high"
							image={props.asset.image}
							loading="eager"
							ticker={props.asset.ticker ?? props.asset.name}
						/>
					) : (
						<span className="fungible-token-avatar layout-placeholder" aria-hidden="true" />
					)}
					<div className="fungible-token-identity">
						<div className="fungible-token-title">
							{props.asset ? (
								<h1>{formatTickerLabel(props.asset.ticker, messages.validationDefaultTicker)}</h1>
							) : (
								<span className="layout-placeholder layout-placeholder-title" />
							)}
							{props.asset ? <span className="fungible-token-name">{props.asset.name}</span> : null}
						</div>
						<div className="fungible-token-meta" aria-hidden="true">
							{props.collection ? (
								<Link to={`/collection/${props.collection.id}`}>{collectionName}</Link>
							) : (
								<span>{collectionName}</span>
							)}
							<span>{device}</span>
						</div>
					</div>
					<div aria-hidden="true" className="fungible-token-balance">
						<span>
							{wallet.address
								? messages.loadingShellYourLiquidBalance
								: messages.loadingShellCirculatingSupply}
						</span>
						<strong className="layout-placeholder asset-loading-balance" />
					</div>
				</header>
				{props.error ? (
					<ErrorPanel
						heading={messages.assetDetailErrorHeading}
						message={props.error}
						retryAction={retryAction}
						secondaryAction={props.secondaryAction}
					/>
				) : (
					<div aria-live="polite" className="state-verification asset-loading-verification" role="status">
						<span aria-hidden="true" /> {messages.assetDetailComputingState}
					</div>
				)}
				<div className="asset-detail-layout">
					<div className="asset-commerce-column asset-commerce-primary">
						<section aria-hidden="true" className="asset-commerce-card asset-commerce-card-loading">
							<div className="asset-market-stats asset-loading-market-stats">
								{[
									messages.fungibleStatCurrentUnitPrice,
									messages.fungibleStatForSale,
									messages.fungibleStatYourListed,
									messages.fungibleStatHolders,
								].map((label) => (
									<div key={label}>
										<span>{label}</span>
										<i className="layout-placeholder" />
									</div>
								))}
							</div>
							<div className="fungible-trade-switcher">
								<div className="segmented-tabs fungible-trade-tabs asset-loading-trade-tabs">
									<span>{messages.fungibleTradeBuy}</span>
									<span>{messages.fungibleTradeSell}</span>
									<span>{messages.fungibleTradeTransfer}</span>
								</div>
							</div>
							<div className="asset-loading-trade-composer">
								<div>
									<span>{messages.loadingShellYouBuy}</span>
									<i className="layout-placeholder" />
									<small className="layout-placeholder" />
								</div>
								<div>
									<span>{messages.loadingShellYouPay}</span>
									<i className="layout-placeholder" />
									<small className="layout-placeholder" />
								</div>
							</div>
							<span className="layout-placeholder asset-loading-action" />
						</section>
					</div>
					<div className="asset-commerce-column asset-commerce-secondary">
						<nav
							aria-hidden="true"
							className="home-market-tabs asset-detail-tabs asset-section-tabs-loading"
						>
							<span>{messages.fungibleTabMarket}</span>
							<span>{messages.fungibleTabHolders}</span>
							<span>{messages.fungibleTabAbout}</span>
						</nav>
						<div aria-hidden="true" className="fungible-market-panel asset-loading-market-panel">
							<section className="token-price-chart asset-loading-chart">
								<div className="token-price-chart-heading">
									<div className="asset-loading-chart-quote">
										<span>{messages.loadingShellIndexedAskHistory}</span>
										<strong className="layout-placeholder" />
									</div>
									<div className="asset-loading-chart-ranges">
										{Array.from({ length: 4 }, (_, index) => (
											<span className="layout-placeholder" key={index} />
										))}
									</div>
								</div>
								<div className="asset-loading-chart-plot">
									<span />
									<span />
									<span />
								</div>
							</section>
							<div className="orderbook-table fungible-orderbook asset-loading-orderbook">
								<div className="orderbook-head">
									<span>{messages.uniqueOrderColumnPrice}</span>
									<span>{messages.loadingShellOrderbookSize}</span>
									<span>{messages.loadingShellOrderbookValue}</span>
									<span>{messages.orderbookColumnSeller}</span>
									<span>{messages.orderbookColumnState}</span>
								</div>
								{Array.from({ length: 3 }, (_, row) => (
									<div className="orderbook-row" key={row}>
										{Array.from({ length: 5 }, (_, column) => (
											<span className="layout-placeholder" key={column} />
										))}
									</div>
								))}
							</div>
							<section className="asset-loading-activity">
								<h2>{messages.loadingShellActivity}</h2>
								{Array.from({ length: 3 }, (_, row) => (
									<div key={row}>
										<span className="layout-placeholder" />
										<span className="layout-placeholder" />
										<span className="layout-placeholder" />
									</div>
								))}
							</section>
						</div>
					</div>
				</div>
			</section>
		);
	}

	return (
		<section className={`asset-page asset-detail-page asset-detail-loading-shell ${detailClass}`}>
			<div className="asset-detail-layout">
				<div className="asset-commerce-column asset-commerce-primary">
					<div className="asset-details asset-identity">
						<div className="asset-kicker">
							{props.collection ? (
								<Link className="asset-collection-link" to={`/collection/${props.collection.id}`}>
									{collectionName}
								</Link>
							) : (
								<span className="asset-collection-link">{collectionName}</span>
							)}
						</div>
						{props.asset ? (
							<h1>{props.asset.name}</h1>
						) : (
							<span className="layout-placeholder layout-placeholder-title" />
						)}
						<div className="asset-owner-line">
							<span>{messages.loadingShellOwnership}</span>
						</div>
						<div className="asset-token-tags" aria-hidden="true">
							<span>{device}</span>
							<span>{messages.uniqueProtocolNetwork}</span>
							<span>{messages.uniqueProtocolSupply}</span>
						</div>
						{props.error ? (
							<ErrorPanel
								heading={messages.assetDetailErrorHeading}
								message={props.error}
								retryAction={retryAction}
								secondaryAction={props.secondaryAction}
							/>
						) : (
							<div
								aria-live="polite"
								className="state-verification asset-loading-verification"
								role="status"
							>
								<span aria-hidden="true" /> {messages.assetDetailComputingState}
							</div>
						)}
						<section aria-hidden="true" className="asset-commerce-card asset-commerce-card-loading">
							<div className="asset-loading-stat-grid">
								{Array.from({ length: 4 }, (_, index) => (
									<span className="layout-placeholder" key={index} />
								))}
							</div>
							<span className="layout-placeholder asset-loading-summary" />
							<span className="layout-placeholder asset-loading-action" />
						</section>
					</div>
				</div>
				<div className="asset-visual-column">
					<div className="asset-hero-media">
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
							<span className="layout-placeholder asset-loading-artwork" />
						)}
					</div>
				</div>
				<div className="asset-commerce-column asset-commerce-secondary">
					<nav aria-hidden="true" className="home-market-tabs asset-detail-tabs asset-section-tabs-loading">
						<span>{messages.loadingShellDetails}</span>
						<span>{messages.loadingShellOrders}</span>
						<span>{messages.loadingShellActivity}</span>
					</nav>
					<div aria-hidden="true" className="asset-loading-panel">
						<span className="layout-placeholder" />
						<span className="layout-placeholder" />
						<span className="layout-placeholder" />
					</div>
				</div>
			</div>
		</section>
	);
}
