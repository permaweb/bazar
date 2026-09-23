import { Link } from 'react-router-dom';

import type { AssetSummary, Collection } from 'api/collections';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { AudioArtwork } from 'components/atoms/AudioArtwork';
import { NameArtwork } from 'components/atoms/NameArtwork';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { ErrorPanel, type ErrorPanelAction } from 'components/molecules/ErrorPanel';
import { isAudioContentType } from 'helpers/asset-media';
import { formatTickerLabel } from 'helpers/token-display';
import { useWallet } from 'providers/WalletProvider';

import { assetDetailLoadingShellView } from '../../../model/asset-detail';

export default function AssetDetailLoadingShell(props: {
	asset?: AssetSummary;
	collection?: Collection;
	collectionId: string;
	error?: string | null;
	onRetry?: () => void;
	secondaryAction?: ErrorPanelAction;
}) {
	const wallet = useWallet();
	const { kind, device, detailClass, collectionName } = assetDetailLoadingShellView(
		props.collection,
		props.collectionId
	);

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
								<h1>{formatTickerLabel(props.asset.ticker)}</h1>
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
							<span>token@1.0</span>
						</div>
					</div>
					<div aria-hidden="true" className="fungible-token-balance">
						<span>{wallet.address ? 'Your liquid balance' : 'Circulating supply'}</span>
						<strong className="layout-placeholder asset-loading-balance" />
					</div>
				</header>
				{props.error ? (
					<ErrorPanel message={props.error} onRetry={props.onRetry} secondaryAction={props.secondaryAction} />
				) : (
					<div aria-live="polite" className="state-verification asset-loading-verification" role="status">
						<span aria-hidden="true" /> Computing current state…
					</div>
				)}
				<div className="asset-detail-layout">
					<div className="asset-commerce-column asset-commerce-primary">
						<section aria-hidden="true" className="asset-commerce-card asset-commerce-card-loading">
							<div className="asset-market-stats asset-loading-market-stats">
								{['Current unit price', 'For sale', 'Your listed', 'Holders'].map((label) => (
									<div key={label}>
										<span>{label}</span>
										<i className="layout-placeholder" />
									</div>
								))}
							</div>
							<div className="fungible-trade-switcher">
								<div className="segmented-tabs fungible-trade-tabs asset-loading-trade-tabs">
									<span>Buy</span>
									<span>List</span>
									<span>Transfer</span>
								</div>
							</div>
							<div className="asset-loading-trade-composer">
								<div>
									<span>You buy</span>
									<i className="layout-placeholder" />
									<small className="layout-placeholder" />
								</div>
								<div>
									<span>You pay</span>
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
							<span>Market</span>
							<span>Holders</span>
							<span>About</span>
						</nav>
						<div aria-hidden="true" className="fungible-market-panel asset-loading-market-panel">
							<section className="token-price-chart asset-loading-chart">
								<div className="token-price-chart-heading">
									<div className="asset-loading-chart-quote">
										<span>Indexed ask history</span>
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
									<span>Price</span>
									<span>Size</span>
									<span>Value</span>
									<span>Seller</span>
									<span>State</span>
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
								<h2>Activity</h2>
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
							<span>Loading ownership and market state</span>
						</div>
						<div className="asset-token-tags" aria-hidden="true">
							<span>{device}</span>
							<span>Arweave</span>
							<span>Supply 1</span>
						</div>
						{props.error ? (
							<ErrorPanel
								message={props.error}
								onRetry={props.onRetry}
								secondaryAction={props.secondaryAction}
							/>
						) : (
							<div
								aria-live="polite"
								className="state-verification asset-loading-verification"
								role="status"
							>
								<span aria-hidden="true" /> Computing current state…
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
							/>
						) : props.asset && isAudioContentType(props.asset.contentType) ? (
							<AudioArtwork contentType={props.asset.contentType} name={props.asset.name} />
						) : kind === 'names' && props.asset ? (
							<NameArtwork name={props.asset.name} />
						) : (
							<span className="layout-placeholder asset-loading-artwork" />
						)}
					</div>
				</div>
				<div className="asset-commerce-column asset-commerce-secondary">
					<nav aria-hidden="true" className="home-market-tabs asset-detail-tabs asset-section-tabs-loading">
						<span>Details</span>
						<span>Orders</span>
						<span>Activity</span>
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
