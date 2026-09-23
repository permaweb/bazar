import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BarChart3, Diamond, FileText, Grid2X2, Images, Info, Layers3 } from 'lucide-react';

import type { AssetSummary, Collection } from 'api/collections';
import type { AssetState } from 'api/marketplace';

import { ArCurrencyLabel } from 'components/atoms/ArCurrencyLabel';
import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { AudioArtwork } from 'components/atoms/AudioArtwork';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Loading } from 'components/atoms/Loading';
import { RetryNotice } from 'components/molecules/RetryNotice';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { DeferredMarketActivityList } from 'features/Activity';
import { winstonToAr } from 'helpers/ar-units';
import { isAudioContentType } from 'helpers/asset-media';
import { formatAudioDuration } from 'helpers/audio-metadata';
import { transactionExplorerUrl } from 'helpers/explorer';
import { short } from 'helpers/format';

import type { AssetActivityFeedView } from '../../../model/asset-detail-activity';
import type { UniqueAssetView } from '../../../model/unique-asset-view';
import { type AssetDetailTab, AssetDetailTabs } from '../../molecules/AssetDetailTabs';
import type { TokenPricePoint } from '../TokenPriceChart';

export type UniqueAssetSection = 'about' | 'orders' | 'activity' | 'rights' | 'blockchain' | 'more';

const UniquePriceChart = React.lazy(() =>
	import('../TokenPriceChart').then(({ TokenPriceChart }) => ({ default: TokenPriceChart }))
);

const UNIQUE_ASSET_TABS: AssetDetailTab<UniqueAssetSection>[] = [
	{
		value: 'about',
		label: 'About',
		icon: <Icon icon={Info} />,
		panelId: 'asset-about',
	},
	{
		value: 'orders',
		label: 'Orders',
		icon: <Icon icon={Layers3} />,
		panelId: 'asset-orders',
	},
	{
		value: 'activity',
		label: 'Activity',
		icon: <Icon icon={BarChart3} />,
		panelId: 'asset-activity',
	},
	{
		value: 'rights',
		label: 'Usage rights',
		icon: <Icon icon={FileText} />,
		panelId: 'asset-rights',
	},
	{
		value: 'blockchain',
		label: 'Blockchain',
		icon: <Icon icon={Grid2X2} />,
		panelId: 'asset-blockchain',
	},
	{
		value: 'more',
		label: 'More',
		icon: <Icon icon={Images} />,
		panelId: 'asset-more',
	},
];

export default function UniqueAssetSections(props: {
	active: UniqueAssetSection;
	asset: AssetSummary;
	collection: Collection;
	state: AssetState;
	view: UniqueAssetView;
	activity: AssetActivityFeedView;
	asks: AssetActivityFeedView;
	askPricePoints: TokenPricePoint[];
	onChange(section: UniqueAssetSection): void;
	onActivityRetry(): void;
	onActivityLoadMore(): void;
	onAskRetry(): void;
	onAskLoadMore(): void;
	onPrefetchAsset(assetId: string): void;
}) {
	const order = props.view.order;
	const ownerLabel = props.view.owner ? (
		<WalletAddress address={props.view.owner} label="owner" />
	) : (
		<strong>{props.view.balanceStateAvailable ? 'Unassigned' : 'Ownership unavailable'}</strong>
	);
	return (
		<>
			<AssetDetailTabs<UniqueAssetSection>
				active={props.active}
				ariaLabel="Asset detail sections"
				idPrefix="asset"
				onChange={props.onChange}
				tabs={UNIQUE_ASSET_TABS}
			/>
			{props.active === 'about' ? (
				<section
					aria-labelledby="asset-about-tab"
					className="asset-tab-panel"
					id="asset-about"
					role="tabpanel"
					tabIndex={0}
				>
					<p className="asset-description">{props.view.description}</p>
					<div className="asset-detail-facts">
						<div>
							<span>Owner</span>
							{ownerLabel}
						</div>
						<div>
							<span>Collection</span>
							<strong>{props.collection.name}</strong>
						</div>
						<div>
							<span>Asset type</span>
							<strong>{props.asset.contentType ?? props.state.device ?? 'process'}</strong>
						</div>
						<div>
							<span>Supply</span>
							<strong>1</strong>
						</div>
						{props.asset.artist ? (
							<div>
								<span>Artist</span>
								<strong>{props.asset.artist}</strong>
							</div>
						) : null}
						{props.asset.album ? (
							<div>
								<span>Album</span>
								<strong>{props.asset.album}</strong>
							</div>
						) : null}
						{props.asset.duration ? (
							<div>
								<span>Duration</span>
								<strong>{formatAudioDuration(props.asset.duration)}</strong>
							</div>
						) : null}
					</div>
				</section>
			) : null}
			{props.active === 'orders' ? (
				<section
					aria-labelledby="asset-orders-tab"
					className="asset-tab-panel atomic-market-panel"
					id="asset-orders"
					role="tabpanel"
					tabIndex={0}
				>
					<React.Suspense fallback={<Loading label="Preparing ask history…" />}>
						<UniquePriceChart
							error={props.asks.error}
							floorValue={props.view.floorValue}
							formatValue={(value) => `${winstonToAr(value)} AR`}
							hasNextPage={props.asks.hasNextPage}
							loading={props.asks.loading}
							loadingMore={props.asks.loadingMore}
							onLoadMore={props.onAskLoadMore}
							onRetry={props.onAskRetry}
							points={props.askPricePoints}
							ticker={props.asset.name}
						/>
					</React.Suspense>
					<div aria-label={`${props.asset.name} order book`} className="orderbook-table" role="table">
						<div className="orderbook-head" role="row">
							<span role="columnheader">Price</span>
							<span role="columnheader">Quantity</span>
							<span role="columnheader">Seller</span>
							<span role="columnheader">Status</span>
						</div>
						{order ? (
							<div className="orderbook-row" role="row">
								<strong data-label="Price" role="cell">
									{winstonToAr(order.asking)} <ArCurrencyLabel />
								</strong>
								<span data-label="Quantity" role="cell">
									{order.quantity}
								</span>
								<span data-label="Seller" role="cell">
									<WalletAddress address={order.creator} label="seller" />
								</span>
								<span className={`order-status ${order.status}`} data-label="Status" role="cell">
									{order.status}
								</span>
							</div>
						) : (
							<div className="orderbook-empty" role="row">
								<div aria-colspan={4} className="orderbook-empty-cell" role="cell">
									<strong>No open asks</strong>
									<span>This asset is not currently listed.</span>
								</div>
							</div>
						)}
					</div>
					<p className="market-note">
						Computed from the last loaded asset process state through the selected AO transport.
					</p>
				</section>
			) : null}
			{props.active === 'activity' ? (
				<section
					aria-labelledby="asset-activity-tab"
					className="asset-tab-panel asset-activity-panel"
					id="asset-activity"
					role="tabpanel"
					tabIndex={0}
				>
					{order ? (
						<div className="asset-history-current">
							<span>Current ask</span>
							<strong>
								{winstonToAr(order.asking)} <ArCurrencyLabel />
							</strong>
						</div>
					) : null}
					{props.activity.loading ? (
						<Loading
							label={
								props.activity.events.length
									? 'Refreshing market history…'
									: 'Reading indexed market history…'
							}
						/>
					) : null}
					{props.activity.error ? (
						<RetryNotice onRetry={props.onActivityRetry}>
							Compute hasn’t completed yet. Please try again.{' '}
							{props.activity.events.length ? 'Previously loaded events remain visible.' : ''}
						</RetryNotice>
					) : null}
					{props.activity.events.length ? (
						<DeferredMarketActivityList
							ariaLabel={`${props.asset.name} market activity`}
							collectionId={props.collection.id}
							events={props.activity.events}
							loading={props.activity.loading || props.activity.loadingMore}
							reservationState={props.state}
							resolveAsset={() => props.asset}
						/>
					) : null}
					{!props.activity.loading && !props.activity.error && !props.activity.events.length ? (
						<p className="asset-empty-copy">No indexed market events found.</p>
					) : null}
					<div className="asset-market-activity-footer">
						<p className="market-note">
							{props.activity.totalCount === null
								? `${props.activity.events.length.toLocaleString()} indexed process submissions loaded.`
								: `${props.activity.events.length.toLocaleString()} of ${props.activity.totalCount.toLocaleString()} indexed process submissions loaded.`}{' '}
							Live ownership and orders above remain authoritative.
						</p>
						{props.activity.hasNextPage ? (
							<Button
								disabled={props.activity.loadingMore}
								onClick={props.onActivityLoadMore}
								size="custom"
								type="button"
							>
								{props.activity.loadingMore ? 'Loading older activity…' : 'Load older activity'}
							</Button>
						) : null}
					</div>
				</section>
			) : null}
			{props.active === 'rights' ? (
				<section
					aria-labelledby="asset-rights-tab"
					className="asset-tab-panel"
					id="asset-rights"
					role="tabpanel"
					tabIndex={0}
				>
					{props.view.license.length ? (
						<dl className="license-properties">
							{props.view.license.map((property) => (
								<div key={property.key}>
									<dt>{property.label}</dt>
									<dd>{property.value}</dd>
								</div>
							))}
							<div className="license-proof">
								<dt>Proof</dt>
								<dd>
									<a href={transactionExplorerUrl(props.asset.id)} target="_blank" rel="noreferrer">
										View license proof on ViewBlock <Icon icon={ArrowUpRight} size="xs" />
									</a>
								</dd>
							</div>
						</dl>
					) : (
						<div className="license-empty">
							<span>
								<Icon icon={Diamond} />
							</span>
							<div>
								<strong>No UDL terms declared</strong>
								<p>This process does not publish Universal Data License properties.</p>
							</div>
						</div>
					)}
					<p className="market-note">
						Declared terms and effective UDL 0.2 defaults are derived from immutable process metadata.
					</p>
				</section>
			) : null}
			{props.active === 'blockchain' ? (
				<section
					aria-labelledby="asset-blockchain-tab"
					className="asset-tab-panel"
					id="asset-blockchain"
					role="tabpanel"
					tabIndex={0}
				>
					<dl className="asset-blockchain-details">
						<div>
							<dt>Process ID</dt>
							<dd>
								<a href={transactionExplorerUrl(props.asset.id)} target="_blank" rel="noreferrer">
									{short(props.asset.id)} <Icon icon={ArrowUpRight} size="xs" />
								</a>
							</dd>
						</div>
						<div>
							<dt>Network</dt>
							<dd>Arweave</dd>
						</div>
						<div>
							<dt>Execution</dt>
							<dd>{props.state.device || 'token@1.0'}</dd>
						</div>
						<div>
							<dt>Settlement</dt>
							<dd>
								<ArCurrencyLabel />
							</dd>
						</div>
						<div>
							<dt>Content type</dt>
							<dd>{props.asset.contentType ?? (props.asset.image ? 'image' : 'process')}</dd>
						</div>
					</dl>
				</section>
			) : null}
			{props.active === 'more' ? (
				<section
					aria-labelledby="asset-more-tab"
					className="asset-tab-panel"
					id="asset-more"
					role="tabpanel"
					tabIndex={0}
				>
					<div className="asset-more-grid">
						{props.view.moreAssets.map((item) => (
							<Link
								key={item.id}
								to={`/asset/${props.collection.id}/${item.id}`}
								onFocus={() => props.onPrefetchAsset(item.id)}
								onMouseEnter={() => props.onPrefetchAsset(item.id)}
								onTouchStart={() => props.onPrefetchAsset(item.id)}
							>
								{item.image ? (
									<ArtworkImage src={item.image} alt="" />
								) : isAudioContentType(item.contentType) ? (
									<AudioArtwork contentType={item.contentType} name={item.name} />
								) : (
									<span>{item.name.slice(0, 1)}</span>
								)}
								<strong>{item.name}</strong>
							</Link>
						))}
					</div>
				</section>
			) : null}
		</>
	);
}
