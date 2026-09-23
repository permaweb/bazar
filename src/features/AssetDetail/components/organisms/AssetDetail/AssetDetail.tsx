import React from 'react';
import { Link, useParams } from 'react-router-dom';

import { Loading } from 'components/atoms/Loading';
import { ErrorPanel, type ErrorPanelAction } from 'components/molecules/ErrorPanel';
import { RouteState } from 'components/molecules/RouteState';
import { StateVerification } from 'components/molecules/StateVerification';
import { StatusNotice } from 'components/molecules/StatusNotice';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { CollectionIndexNotice } from 'features/Collection';
import { UnavailableOperationRecoveryNotice } from 'features/Operations';
import { useMarketProvider } from 'providers/MarketProvider';
import { useWallet } from 'providers/WalletProvider';

import { useAssetDetail } from '../../../hooks/useAssetDetail';
import type { AssetDetailRetry } from '../../../model/asset-detail';
import { loadFungibleAssetView } from '../../../model/fungible-asset-view';
import type { UniqueAssetRecoveryNotice } from '../../../model/unique-asset-recovery';
import { AssetDetailLoadingShell } from '../AssetDetailLoadingShell';
import { UniqueAssetCommerceCard } from '../UniqueAssetCommerceCard';
import { UniqueAssetMedia } from '../UniqueAssetMedia';
import { type UniqueAssetSection, UniqueAssetSections } from '../UniqueAssetSections';

const FungibleAssetView = React.lazy(() =>
	loadFungibleAssetView().then((module) => ({ default: module.FungibleAssetView }))
);

function recoveryNoticeMessage(notice: UniqueAssetRecoveryNotice): string {
	switch (notice.kind) {
		case 'gateway-switch':
			return notice.message;
		case 'purchase-paused':
			return 'A previous purchase is paused because its order is no longer available to this wallet. Its signed transaction details remain saved in this browser, and no replacement payment will be created.';
		case 'stale-action-removed':
			return 'A stale local action was removed after current live state proved that it can no longer apply. No replacement transaction was created.';
		case 'tracking-discarded':
			return 'Local tracking was discarded. Current ownership and orders above remain the live source of truth.';
	}
}

export default function AssetDetail() {
	const { collectionId = '', assetId = '' } = useParams();
	const market = useMarketProvider();
	const wallet = useWallet();
	const detail = useAssetDetail(collectionId, assetId);
	const [activeSection, setActiveSection] = React.useState<UniqueAssetSection>('about');
	const live = detail.live;
	const activity = detail.activity;
	const operations = detail.operations;

	React.useEffect(() => {
		setActiveSection('about');
	}, [assetId]);

	const stateRecoveryAction: ErrorPanelAction | undefined = detail.openStateRecovery
		? { label: 'Use Bazar peers', onClick: detail.openStateRecovery }
		: undefined;
	const retryFor = (retry: AssetDetailRetry) => (retry === 'market' ? market.retry : live.load);
	const handleSectionChange = (section: UniqueAssetSection) => {
		setActiveSection(section);
		if (section === 'orders' || section === 'activity') activity.requestActivity();
	};

	const screen = detail.screen;
	switch (screen.kind) {
		case 'loading':
			return (
				<AssetDetailLoadingShell
					asset={screen.asset}
					collection={screen.collection}
					collectionId={collectionId}
					error={screen.error}
					onRetry={retryFor(screen.retry)}
					secondaryAction={screen.recoverable ? stateRecoveryAction : undefined}
				/>
			);
		case 'unavailable':
			return (
				<RouteState
					title="Asset unavailable"
					backTo={screen.collection ? `/collection/${screen.collection.id}` : undefined}
					backLabel={screen.collection?.name}
				>
					<ErrorPanel
						message={screen.message}
						onRetry={retryFor(screen.retry)}
						secondaryAction={screen.recoverable ? stateRecoveryAction : undefined}
					/>
				</RouteState>
			);
		case 'collection-not-found':
			return (
				<RouteState title="Collection not found">
					<ErrorPanel message="This collection could not be found on Arweave." />
				</RouteState>
			);
		case 'asset-not-found':
			return (
				<RouteState
					title="Asset not found"
					backTo={`/collection/${screen.collection.id}`}
					backLabel={screen.collection.name}
				>
					<ErrorPanel message="This asset is not in the selected collection." />
				</RouteState>
			);
		case 'fungible':
			return (
				<React.Suspense
					fallback={
						<AssetDetailLoadingShell
							asset={screen.asset}
							collection={screen.collection}
							collectionId={collectionId}
						/>
					}
				>
					<FungibleAssetView
						asset={screen.asset}
						collection={screen.collection}
						collectionIndexNotice={
							<CollectionIndexNotice
								collection={screen.collection}
								checking={market.loading}
								directlyVerified={!detail.indexedAsset}
								onRetry={market.retry}
							/>
						}
						state={screen.state}
						activity={activity.activity.events}
						activityHasNextPage={activity.activity.hasNextPage}
						activityLoading={activity.activity.loading}
						activityLoadingMore={activity.activity.loadingMore}
						activityTotalCount={activity.activity.totalCount}
						activityError={activity.activity.error}
						askActivity={activity.asks.events}
						askError={activity.asks.error}
						askHasNextPage={activity.asks.hasNextPage}
						askLoading={activity.asks.loading}
						askLoadingMore={activity.asks.loadingMore}
						onActivityLoadMore={() => void activity.loadOlderActivity()}
						onActivityRetry={() => activity.retryActivity()}
						onActivityVisible={() => activity.requestActivity()}
						onAskLoadMore={() => void activity.loadOlderAsks()}
						onAskRetry={() => activity.retryAsks()}
						loading={live.loading}
						error={live.error}
						provider={live.provider}
						verifiedAt={live.verifiedAt}
						onRefresh={detail.refreshAsset}
						stateRecoveryAction={stateRecoveryAction}
					/>
				</React.Suspense>
			);
		case 'unique':
			break;
	}

	const asset = screen.asset;
	const collection = screen.collection;
	const state = screen.state;
	const view = screen.view;
	const unavailableRecovery = operations.unavailableRecovery;
	return (
		<section className="asset-page asset-detail-page atomic-asset-page">
			{operations.notice ? (
				<StatusNotice onDismiss={operations.dismissNotice}>
					{recoveryNoticeMessage(operations.notice)}
				</StatusNotice>
			) : null}
			{unavailableRecovery ? (
				<UnavailableOperationRecoveryNotice
					recovery={unavailableRecovery}
					stateNoun="ownership and orders above"
					onRefresh={() => void detail.refreshAsset()}
					onDiscard={operations.discardUnavailableRecovery}
				/>
			) : null}
			<div className="asset-detail-layout">
				<div className="asset-commerce-column asset-commerce-primary">
					<div className="asset-details asset-identity">
						<div className="asset-kicker">
							{detail.indexedCollection ? (
								<Link className="asset-collection-link" to={`/collection/${collection.id}`}>
									{collection.name}
								</Link>
							) : (
								<span className="asset-collection-link">{collection.name}</span>
							)}
						</div>
						<h1 ref={operations.focusFallbackRef} tabIndex={-1}>
							{asset.name}
						</h1>
						<div className="asset-owner-line">
							<span>{live.loading || live.error ? 'Last known owner' : 'Owned by'}</span>
							{view.owner ? (
								<WalletAddress address={view.owner} label="owner" />
							) : (
								<strong>{view.balanceStateAvailable ? 'Unassigned' : 'Ownership unavailable'}</strong>
							)}
						</div>
						{live.loading ? <Loading label="Computing current state…" /> : null}
						{live.error ? (
							<ErrorPanel
								message={live.error}
								onRetry={live.load}
								secondaryAction={stateRecoveryAction}
							/>
						) : null}
						<UniqueAssetCommerceCard
							asset={asset}
							state={state}
							view={view}
							walletAddress={wallet.address}
							operationActivity={operations.activity}
							operation={operations.operation}
							onOpenOperation={(operation) => operations.openOperation(operation)}
							onShowOperation={operations.showOperation}
						/>
					</div>
				</div>
				<div className="asset-visual-column">
					<UniqueAssetMedia asset={asset} collection={collection} state={state} />
				</div>
				<div className="asset-commerce-column asset-commerce-secondary">
					<CollectionIndexNotice collection={collection} checking={market.loading} onRetry={market.retry} />
					<UniqueAssetSections
						active={activeSection}
						asset={asset}
						collection={collection}
						state={state}
						view={view}
						activity={activity.activity}
						asks={activity.asks}
						askPricePoints={activity.askPricePoints}
						provider={live.provider}
						verifiedAt={live.verifiedAt}
						stateRefreshing={live.loading}
						stateFailed={Boolean(live.error)}
						onChange={handleSectionChange}
						onActivityRetry={() => activity.retryActivity()}
						onActivityLoadMore={() => void activity.loadOlderActivity()}
						onAskRetry={() => activity.retryAsks()}
						onAskLoadMore={() => void activity.loadOlderAsks()}
						onPrefetchAsset={detail.prefetchAsset}
					/>
				</div>
			</div>
		</section>
	);
}
