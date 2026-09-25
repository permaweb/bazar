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
import { StateVerification } from 'components/molecules/StateVerification';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { DeferredMarketActivityList } from 'features/Activity';
import { winstonToAr } from 'helpers/ar-units';
import { isAudioContentType } from 'helpers/asset-media';
import { formatAudioDuration } from 'helpers/audio-metadata';
import { transactionExplorerUrl } from 'helpers/explorer';
import { short } from 'helpers/format';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES, type AssetDetailMessages } from '../../../messages';
import { audioArtworkLabel, stateVerificationCopy } from '../../../model/asset-detail';
import type { AssetActivityFeedView } from '../../../model/asset-detail-activity';
import type { UniqueAssetView } from '../../../model/unique-asset-view';
import { type AssetDetailTab, AssetDetailTabs } from '../../molecules/AssetDetailTabs';
import type { TokenPricePoint } from '../TokenPriceChart';

import * as S from './styles';

export type UniqueAssetSection = 'about' | 'orders' | 'activity' | 'rights' | 'blockchain' | 'more';

const UniquePriceChart = React.lazy(() =>
	import('../TokenPriceChart').then(({ TokenPriceChart }) => ({ default: TokenPriceChart }))
);

function uniqueAssetTabs(messages: AssetDetailMessages): AssetDetailTab<UniqueAssetSection>[] {
	return [
		{
			value: 'about',
			label: messages.uniqueTabAbout,
			icon: <Icon icon={Info} />,
			panelId: 'asset-about',
		},
		{
			value: 'orders',
			label: messages.uniqueTabOrders,
			icon: <Icon icon={Layers3} />,
			panelId: 'asset-orders',
		},
		{
			value: 'activity',
			label: messages.uniqueTabActivity,
			icon: <Icon icon={BarChart3} />,
			panelId: 'asset-activity',
		},
		{
			value: 'rights',
			label: messages.uniqueTabRights,
			icon: <Icon icon={FileText} />,
			panelId: 'asset-rights',
		},
		{
			value: 'blockchain',
			label: messages.uniqueTabBlockchain,
			icon: <Icon icon={Grid2X2} />,
			panelId: 'asset-blockchain',
		},
		{
			value: 'more',
			label: messages.uniqueTabMore,
			icon: <Icon icon={Images} />,
			panelId: 'asset-more',
		},
	];
}

export default function UniqueAssetSections(props: {
	active: UniqueAssetSection;
	asset: AssetSummary;
	collection: Collection;
	state: AssetState;
	view: UniqueAssetView;
	activity: AssetActivityFeedView;
	asks: AssetActivityFeedView;
	askPricePoints: TokenPricePoint[];
	/** The AO peer the current live state came from, shown with the protocol details under Blockchain. */
	provider: string;
	verifiedAt: number | null;
	stateRefreshing: boolean;
	stateFailed: boolean;
	onChange(section: UniqueAssetSection): void;
	onActivityRetry(): void;
	onActivityLoadMore(): void;
	onAskRetry(): void;
	onAskLoadMore(): void;
	onPrefetchAsset(assetId: string): void;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const order = props.view.order;
	return (
		<>
			<AssetDetailTabs<UniqueAssetSection>
				active={props.active}
				ariaLabel={messages.uniqueSectionsAriaLabel}
				idPrefix="asset"
				onChange={props.onChange}
				tabs={uniqueAssetTabs(messages)}
			/>
			{props.active === 'about' ? (
				<S.TabPanel
					aria-labelledby="asset-about-tab"
					className="asset-tab-panel"
					id="asset-about"
					role="tabpanel"
					tabIndex={0}
				>
					<S.Description className="asset-description">{props.view.description}</S.Description>
					<S.Facts className="asset-detail-facts">
						<div>
							<span>{messages.uniqueFactAssetType}</span>
							<strong>
								{props.asset.contentType ?? props.state.device ?? messages.uniqueContentTypeProcess}
							</strong>
						</div>
						<div>
							<span>{messages.uniqueFactSupply}</span>
							<strong>1</strong>
						</div>
						{props.asset.artist ? (
							<div>
								<span>{messages.uniqueFactArtist}</span>
								<strong>{props.asset.artist}</strong>
							</div>
						) : null}
						{props.asset.album ? (
							<div>
								<span>{messages.uniqueFactAlbum}</span>
								<strong>{props.asset.album}</strong>
							</div>
						) : null}
						{props.asset.duration ? (
							<div>
								<span>{messages.uniqueFactDuration}</span>
								<strong>{formatAudioDuration(props.asset.duration)}</strong>
							</div>
						) : null}
					</S.Facts>
				</S.TabPanel>
			) : null}
			{props.active === 'orders' ? (
				<S.MarketTabPanel
					aria-labelledby="asset-orders-tab"
					className="asset-tab-panel atomic-market-panel"
					id="asset-orders"
					role="tabpanel"
					tabIndex={0}
				>
					<React.Suspense fallback={<Loading label={messages.uniquePreparingAskHistory} />}>
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
					<S.Table
						aria-label={formatMessage(messages.uniqueOrderBookLabel, { name: props.asset.name })}
						className="orderbook-table"
						role="table"
					>
						<S.Head className="orderbook-head" role="row">
							<span role="columnheader">{messages.uniqueOrderColumnPrice}</span>
							<span role="columnheader">{messages.uniqueOrderColumnQuantity}</span>
							<span role="columnheader">{messages.uniqueOrderColumnSeller}</span>
							<span role="columnheader">{messages.uniqueOrderColumnStatus}</span>
						</S.Head>
						{order ? (
							<S.Row className="orderbook-row" role="row">
								<strong data-label={messages.uniqueOrderColumnPrice} role="cell">
									{winstonToAr(order.asking)} <ArCurrencyLabel />
								</strong>
								<span data-label={messages.uniqueOrderColumnQuantity} role="cell">
									{order.quantity}
								</span>
								<span data-label={messages.uniqueOrderColumnSeller} role="cell">
									<WalletAddress
										address={order.creator}
										label={messages.assetDetailWalletLabelSeller}
									/>
								</span>
								<S.Status
									className={`order-status ${order.status}`}
									data-label={messages.uniqueOrderColumnStatus}
									role="cell"
								>
									{order.status}
								</S.Status>
							</S.Row>
						) : (
							<S.Empty className="orderbook-empty" role="row">
								<S.EmptyCell aria-colspan={4} className="orderbook-empty-cell" role="cell">
									<strong>{messages.uniqueNoOpenAsks}</strong>
									<span>{messages.uniqueNotCurrentlyListed}</span>
								</S.EmptyCell>
							</S.Empty>
						)}
					</S.Table>
					<S.MarketNote className="market-note">{messages.uniqueOrdersNote}</S.MarketNote>
				</S.MarketTabPanel>
			) : null}
			{props.active === 'activity' ? (
				<S.ActivityTabPanel
					aria-labelledby="asset-activity-tab"
					className="asset-tab-panel asset-activity-panel"
					id="asset-activity"
					role="tabpanel"
					tabIndex={0}
				>
					{order ? (
						<S.HistoryCurrent className="asset-history-current">
							<span>{messages.uniqueCurrentAsk}</span>
							<strong>
								{winstonToAr(order.asking)} <ArCurrencyLabel />
							</strong>
						</S.HistoryCurrent>
					) : null}
					{props.activity.loading ? (
						<Loading
							label={
								props.activity.events.length
									? messages.uniqueRefreshingHistory
									: messages.uniqueReadingHistory
							}
						/>
					) : null}
					{props.activity.error ? (
						<RetryNotice onRetry={props.onActivityRetry} retryLabel={messages.uniqueActivityRetryLabel}>
							{messages.uniqueActivityRetry}{' '}
							{props.activity.events.length ? messages.uniqueActivityRetryPrevious : ''}
						</RetryNotice>
					) : null}
					{props.activity.events.length ? (
						<DeferredMarketActivityList
							ariaLabel={formatMessage(messages.uniqueMarketActivityLabel, { name: props.asset.name })}
							collectionId={props.collection.id}
							events={props.activity.events}
							loading={props.activity.loading || props.activity.loadingMore}
							reservationState={props.state}
							resolveAsset={() => props.asset}
						/>
					) : null}
					{!props.activity.loading && !props.activity.error && !props.activity.events.length ? (
						<S.EmptyCopy className="asset-empty-copy">{messages.uniqueNoMarketEvents}</S.EmptyCopy>
					) : null}
					<S.MarketActivityFooter className="asset-market-activity-footer">
						<S.MarketNote className="market-note">
							{props.activity.totalCount === null
								? formatMessage(messages.uniqueSubmissionsLoaded, {
										loaded: props.activity.events.length.toLocaleString(),
								  })
								: formatMessage(messages.uniqueSubmissionsLoadedOfTotal, {
										loaded: props.activity.events.length.toLocaleString(),
										total: props.activity.totalCount.toLocaleString(),
								  })}{' '}
							{messages.uniqueLiveOrdersAuthoritative}
						</S.MarketNote>
						{props.activity.hasNextPage ? (
							<Button
								disabled={props.activity.loadingMore}
								onClick={props.onActivityLoadMore}
								size="custom"
								type="button"
							>
								{props.activity.loadingMore
									? messages.uniqueLoadingOlderActivity
									: messages.uniqueLoadOlderActivity}
							</Button>
						) : null}
					</S.MarketActivityFooter>
				</S.ActivityTabPanel>
			) : null}
			{props.active === 'rights' ? (
				<S.TabPanel
					aria-labelledby="asset-rights-tab"
					className="asset-tab-panel"
					id="asset-rights"
					role="tabpanel"
					tabIndex={0}
				>
					{props.view.license.length ? (
						<S.LicenseProperties className="license-properties">
							{props.view.license.map((property) => (
								<div key={property.key}>
									<dt>{property.label}</dt>
									<dd>{property.value}</dd>
								</div>
							))}
							<div className="license-proof">
								<dt>{messages.uniqueLicenseProof}</dt>
								<dd>
									<a href={transactionExplorerUrl(props.asset.id)} target="_blank" rel="noreferrer">
										{messages.uniqueLicenseProofLink} <Icon icon={ArrowUpRight} size="xs" />
									</a>
								</dd>
							</div>
						</S.LicenseProperties>
					) : (
						<S.LicenseEmpty className="license-empty">
							<span>
								<Icon icon={Diamond} />
							</span>
							<div>
								<strong>{messages.uniqueLicenseEmptyTitle}</strong>
								<p>{messages.uniqueLicenseEmptyDetail}</p>
							</div>
						</S.LicenseEmpty>
					)}
					<S.MarketNote className="market-note">{messages.uniqueLicenseNote}</S.MarketNote>
				</S.TabPanel>
			) : null}
			{props.active === 'blockchain' ? (
				<S.TabPanel
					aria-labelledby="asset-blockchain-tab"
					className="asset-tab-panel"
					id="asset-blockchain"
					role="tabpanel"
					tabIndex={0}
				>
					<S.TokenTags className="asset-token-tags" aria-label={messages.uniqueProtocolDetails}>
						<span>{props.state.device || 'token@1.0'}</span>
						<span>{messages.uniqueProtocolNetwork}</span>
						<span>{messages.uniqueProtocolSupply}</span>
					</S.TokenTags>
					<StateVerification
						labels={stateVerificationCopy(messages)}
						provider={props.provider}
						verifiedAt={props.verifiedAt}
						refreshing={props.stateRefreshing}
						failed={props.stateFailed}
					/>
					<S.BlockchainDetails className="asset-blockchain-details">
						<div>
							<dt>{messages.uniqueBlockchainProcessId}</dt>
							<dd>
								<a href={transactionExplorerUrl(props.asset.id)} target="_blank" rel="noreferrer">
									{short(props.asset.id)} <Icon icon={ArrowUpRight} size="xs" />
								</a>
							</dd>
						</div>
						<div>
							<dt>{messages.uniqueBlockchainNetwork}</dt>
							<dd>{messages.uniqueProtocolNetwork}</dd>
						</div>
						<div>
							<dt>{messages.uniqueBlockchainExecution}</dt>
							<dd>{props.state.device || 'token@1.0'}</dd>
						</div>
						<div>
							<dt>{messages.uniqueBlockchainSettlement}</dt>
							<dd>
								<ArCurrencyLabel />
							</dd>
						</div>
						<div>
							<dt>{messages.uniqueBlockchainContentType}</dt>
							<dd>
								{props.asset.contentType ??
									(props.asset.image
										? messages.uniqueContentTypeImage
										: messages.uniqueContentTypeProcess)}
							</dd>
						</div>
					</S.BlockchainDetails>
				</S.TabPanel>
			) : null}
			{props.active === 'more' ? (
				<S.TabPanel
					aria-labelledby="asset-more-tab"
					className="asset-tab-panel"
					id="asset-more"
					role="tabpanel"
					tabIndex={0}
				>
					<S.MoreGrid className="asset-more-grid">
						{props.view.moreAssets.map((item) => (
							<Link
								key={item.id}
								to={`/asset/${props.collection.id}/${item.id}`}
								onFocus={() => props.onPrefetchAsset(item.id)}
								onMouseEnter={() => props.onPrefetchAsset(item.id)}
								onTouchStart={() => props.onPrefetchAsset(item.id)}
							>
								{item.image ? (
									<ArtworkImage
										src={item.image}
										alt=""
										unavailableLabel={messages.assetDetailArtworkUnavailable}
									/>
								) : isAudioContentType(item.contentType) ? (
									<AudioArtwork
										contentType={item.contentType}
										label={audioArtworkLabel(item, messages)}
										typeLabel={messages.assetDetailAudioArtworkType}
									/>
								) : (
									<span>{item.name.slice(0, 1)}</span>
								)}
								<strong>{item.name}</strong>
							</Link>
						))}
					</S.MoreGrid>
				</S.TabPanel>
			) : null}
		</>
	);
}
