import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Grid2X2, Users } from 'lucide-react';

import type { AssetSummary, Collection } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';
import type { AssetState } from 'api/marketplace';

import { Icon } from 'components/atoms/Icon';
import { Loading } from 'components/atoms/Loading';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { ErrorPanel, type ErrorPanelAction } from 'components/molecules/ErrorPanel';
import { unitPriceWinston } from 'features/Catalogue';
import { preloadArweaveTransactionSync } from 'features/TransactionSync';
import { winstonToArDecimal } from 'helpers/ar-units';
import { formatMessage } from 'helpers/i18n';
import { useAppErrorMessages } from 'hooks/useAppErrorMessage';
import { useMessages } from 'providers/LanguageProvider';
import { useWallet } from 'providers/WalletProvider';

import { useFungibleOperationActivities } from '../../../hooks/useFungibleOperationActivities';
import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { fungibleHolders } from '../../../model/fungible-holders';
import { fungiblePriceHistory, purchaseAmountMatch, tokenLabel } from '../../../model/fungible-market';
import { fungibleListingDraft, fungibleMarketView, fungibleTokenIdentity } from '../../../model/fungible-market-view';
import { type AssetDetailTab, AssetDetailTabs } from '../../molecules/AssetDetailTabs';
import { FungibleRecoveryNotices } from '../../molecules/FungibleRecoveryNotices';
import { FungibleAboutPanel } from '../FungibleAboutPanel';
import { FungibleHolderChart } from '../FungibleHolderChart';
import { FungibleHolderTable } from '../FungibleHolderTable';
import { FungibleMarketActivity } from '../FungibleMarketActivity';
import { FungibleOperationDialog } from '../FungibleOperationDialog';
import { FungibleOrderbook } from '../FungibleOrderbook';
import { FungibleTradeCard, type FungibleTradeMode } from '../FungibleTradeCard';
import { TokenPriceChart } from '../TokenPriceChart';

// The synchronization view loads as its own chunk; warm it as soon as the trading view loads.
preloadArweaveTransactionSync();

type Props = {
	asset: AssetSummary;
	collection: Collection;
	collectionIndexNotice?: React.ReactNode;
	state: AssetState;
	activity: CollectionActivityEvent[];
	activityHasNextPage: boolean;
	activityLoading: boolean;
	activityLoadingMore: boolean;
	activityTotalCount: number | null;
	activityError: string | null;
	askActivity: CollectionActivityEvent[];
	askError: string | null;
	askHasNextPage: boolean;
	askLoading: boolean;
	askLoadingMore: boolean;
	onActivityLoadMore(): void;
	onActivityRetry(): void;
	onActivityVisible(): void;
	onAskLoadMore(): void;
	onAskRetry(): void;
	loading: boolean;
	error: string | null;
	provider: string;
	verifiedAt: number | null;
	onRefresh(): Promise<void>;
	stateRecoveryAction?: ErrorPanelAction;
};

type FungibleAssetSection = 'market' | 'holders' | 'about';

export default function FungibleAssetView(props: Props) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const errorMessages = useAppErrorMessages();
	const wallet = useWallet();
	const activities = useFungibleOperationActivities({
		asset: props.asset,
		collectionId: props.collection.id,
		state: props.state,
		walletAddress: wallet.address,
		onRefresh: props.onRefresh,
	});
	const resumeButtonRef = React.useRef<HTMLButtonElement>(null);
	const operationFocusFallbackRef = React.useRef<HTMLHeadingElement>(null);
	const operationFocusFallback = React.useCallback(
		() =>
			document.querySelector<HTMLElement>('.operation-activity-trigger[data-activity-owner="global"]') ??
			resumeButtonRef.current ??
			operationFocusFallbackRef.current,
		[]
	);
	const [purchaseQuantity, setPurchaseQuantity] = React.useState('');
	const [listingQuantity, setListingQuantity] = React.useState('');
	const [listingUnitPrice, setListingUnitPrice] = React.useState('');
	const [tradeMode, setTradeMode] = React.useState<FungibleTradeMode>('buy');
	const [activeSection, setActiveSection] = React.useState<FungibleAssetSection>('market');
	const [orderReveal, setOrderReveal] = React.useState({ assetId: props.asset.id, limit: 50 });
	const [activityReveal, setActivityReveal] = React.useState({ assetId: props.asset.id, limit: 8 });
	const [holderReveal, setHolderReveal] = React.useState({ assetId: props.asset.id, limit: 50 });
	const market = React.useMemo(() => fungibleMarketView(props.state, wallet.address), [props.state, wallet.address]);
	const identity = fungibleTokenIdentity(props.state, props.collection, messages);
	const orderLimit = orderReveal.assetId === props.asset.id ? orderReveal.limit : 50;
	const activityLimit = activityReveal.assetId === props.asset.id ? activityReveal.limit : 8;
	const holderLimit = holderReveal.assetId === props.asset.id ? holderReveal.limit : 50;
	const listing = fungibleListingDraft(listingQuantity, listingUnitPrice, props.state, market.liquid, messages);
	const purchaseQuantityTracksMaximum = React.useRef(false);
	React.useEffect(() => {
		if (!purchaseQuantityTracksMaximum.current) return;
		setPurchaseQuantity((current) =>
			current === market.maximumPurchaseQuantity ? current : market.maximumPurchaseQuantity
		);
	}, [market.maximumPurchaseQuantity]);
	const purchaseMatch = React.useMemo(
		() => purchaseAmountMatch(market.purchasableOrders, purchaseQuantity, props.state, messages, errorMessages),
		[errorMessages, market.purchasableOrders, messages, purchaseQuantity, props.state]
	);
	const holderRows = React.useMemo(() => fungibleHolders(props.state), [props.state]);
	React.useEffect(() => {
		if (!market.holderBalancesAvailable && activeSection === 'holders') setActiveSection('market');
	}, [activeSection, market.holderBalancesAvailable]);
	const priceHistory = React.useMemo(
		() => fungiblePriceHistory(props.askActivity, props.state.denomination),
		[props.askActivity, props.state.denomination]
	);
	const assetTabs: AssetDetailTab<FungibleAssetSection>[] = [
		{
			value: 'market',
			label: messages.fungibleTabMarket,
			icon: <Icon icon={BarChart3} />,
			panelId: 'fungible-asset-market',
		},
		{
			value: 'holders',
			label: messages.fungibleTabHolders,
			icon: <Icon icon={Users} />,
			panelId: 'fungible-asset-holders',
			disabled: !market.holderBalancesAvailable,
			disabledMessage: !market.holderBalancesAvailable ? messages.fungibleHoldersUnavailable : undefined,
		},
		{
			value: 'about',
			label: messages.fungibleTabAbout,
			icon: <Icon icon={Grid2X2} />,
			panelId: 'fungible-asset-about',
		},
	];

	React.useEffect(() => {
		purchaseQuantityTracksMaximum.current = false;
		setPurchaseQuantity('');
		setListingQuantity('');
		setListingUnitPrice('');
		setTradeMode('buy');
		setActiveSection('market');
		setActivityReveal({ assetId: props.asset.id, limit: 8 });
	}, [props.asset.id]);

	React.useEffect(() => {
		if (activeSection === 'market') props.onActivityVisible();
	}, [activeSection, props.onActivityVisible]);

	React.useLayoutEffect(() => {
		if (activities.recoverySuppressed) resumeButtonRef.current?.focus();
	}, [activities.recoverySuppressed]);

	function handlePurchaseQuantityChange(quantity: string) {
		purchaseQuantityTracksMaximum.current = false;
		setPurchaseQuantity(quantity);
	}

	function handlePurchaseQuantityMax() {
		purchaseQuantityTracksMaximum.current = true;
		setPurchaseQuantity(market.maximumPurchaseQuantity);
	}

	function handleBuy() {
		if (!purchaseMatch.match) return;
		activities.open({
			kind: 'buy',
			availableOrders: market.purchasableOrders,
			quantity: purchaseQuantity,
			startingBalance: market.liquid,
		});
	}

	return (
		<section className="asset-page asset-detail-page fungible-asset-page">
			<FungibleRecoveryNotices
				activities={activities}
				onRefresh={() => void props.onRefresh()}
				resumeButtonRef={resumeButtonRef}
			/>
			<header className="fungible-token-header">
				<TokenAvatar
					className="fungible-token-avatar"
					fetchPriority="high"
					image={props.asset.image}
					loading="eager"
					ticker={identity.ticker}
				/>
				<div className="fungible-token-identity">
					<div className="fungible-token-title">
						<h1 ref={operationFocusFallbackRef} tabIndex={-1}>
							{identity.tickerDisplay}
						</h1>
						<span className="fungible-token-name">{props.asset.name}</span>
					</div>
					<div className="fungible-token-meta" aria-label={messages.fungibleTokenProtocolDetails}>
						<Link to={`/collection/${props.collection.id}`}>{identity.collectionName}</Link>
						<span>{props.state.device}</span>
						<span>
							{formatMessage(messages.fungibleDecimals, { denomination: props.state.denomination })}
						</span>
					</div>
				</div>
				<div className="fungible-token-balance">
					<span>
						{props.loading || props.error
							? wallet.address
								? messages.fungibleBalance
								: messages.fungibleLastKnownSupply
							: wallet.address
							? messages.fungibleYourLiquidBalance
							: messages.fungibleCirculatingSupply}
					</span>
					<strong>
						{wallet.address && !market.holderBalancesAvailable
							? messages.fungibleUnavailable
							: tokenLabel(wallet.address ? market.liquid : props.state.totalSupply, props.state)}
					</strong>
				</div>
			</header>
			{props.loading ? <Loading label={messages.assetDetailComputingState} /> : null}
			{props.error ? (
				<ErrorPanel
					heading={messages.assetDetailErrorHeading}
					message={props.error}
					retryAction={{ label: messages.assetDetailRetry, onClick: () => void props.onRefresh() }}
					secondaryAction={props.stateRecoveryAction}
				/>
			) : null}
			<div className="asset-detail-layout">
				<div className="asset-commerce-column asset-commerce-primary">
					<FungibleTradeCard
						activities={activities}
						error={props.error}
						holderCount={holderRows.length}
						listing={listing}
						listingQuantity={listingQuantity}
						listingUnitPrice={listingUnitPrice}
						loading={props.loading}
						market={market}
						onBuy={handleBuy}
						onListingQuantityChange={setListingQuantity}
						onListingQuantityMax={() => setListingQuantity(market.maximumListingQuantity)}
						onListingUnitPriceChange={setListingUnitPrice}
						onPurchaseQuantityChange={handlePurchaseQuantityChange}
						onPurchaseQuantityMax={handlePurchaseQuantityMax}
						onSell={() =>
							activities.open({ kind: 'sell', quantity: listingQuantity, unitPrice: listingUnitPrice })
						}
						onTradeModeChange={setTradeMode}
						onTransfer={() => activities.open({ kind: 'transfer' })}
						purchaseMatch={purchaseMatch}
						purchaseQuantity={purchaseQuantity}
						state={props.state}
						tradeMode={tradeMode}
						walletAddress={wallet.address}
					/>
				</div>
				<div className="asset-commerce-column asset-commerce-secondary">
					{props.collectionIndexNotice}
					<AssetDetailTabs<FungibleAssetSection>
						active={activeSection}
						ariaLabel={messages.fungibleSectionsAriaLabel}
						idPrefix="fungible-asset"
						onChange={setActiveSection}
						tabs={assetTabs}
					/>
					{activeSection === 'market' ? (
						<section
							aria-labelledby="fungible-asset-market-tab"
							className="asset-tab-panel fungible-market-panel"
							id="fungible-asset-market"
							role="tabpanel"
							tabIndex={0}
						>
							<TokenPriceChart
								error={props.askError}
								floorValue={
									market.best
										? unitPriceWinston(market.best, props.state.denomination).toString()
										: null
								}
								formatValue={(value) => `${winstonToArDecimal(value)} AR / ${identity.ticker}`}
								hasNextPage={props.askHasNextPage}
								loading={props.askLoading}
								loadingMore={props.askLoadingMore}
								onLoadMore={props.onAskLoadMore}
								onRetry={props.onAskRetry}
								points={priceHistory}
								ticker={identity.ticker}
							/>
							<FungibleOrderbook
								assetName={props.asset.name}
								cancelDisabled={
									!market.holderBalancesAvailable ||
									activities.assetBlocksActions ||
									props.loading ||
									Boolean(props.error)
								}
								limit={orderLimit}
								onCancel={(order) => activities.open({ kind: 'cancel', order })}
								onLimitChange={(limit) => setOrderReveal({ assetId: props.asset.id, limit })}
								orderDepths={market.orderDepths}
								orders={market.orders}
								pendingCancelOrderId={
									activities.activeAssetActivity?.operation.kind === 'cancel'
										? activities.activeAssetActivity.operation.order.orderId
										: undefined
								}
								state={props.state}
								walletAddress={wallet.address}
							/>
							<FungibleMarketActivity
								activity={props.activity}
								asset={props.asset}
								collectionId={props.collection.id}
								error={props.activityError}
								hasNextPage={props.activityHasNextPage}
								limit={activityLimit}
								loading={props.activityLoading}
								loadingMore={props.activityLoadingMore}
								onLimitChange={(limit) => setActivityReveal({ assetId: props.asset.id, limit })}
								onLoadMore={props.onActivityLoadMore}
								onRetry={props.onActivityRetry}
								state={props.state}
								totalCount={props.activityTotalCount}
							/>
						</section>
					) : null}
					{activeSection === 'holders' ? (
						<section
							aria-labelledby="fungible-asset-holders-tab"
							className="asset-tab-panel"
							id="fungible-asset-holders"
							role="tabpanel"
							tabIndex={0}
						>
							<FungibleHolderChart
								assetName={props.asset.name}
								holders={holderRows}
								state={props.state}
							/>
							<FungibleHolderTable
								assetName={props.asset.name}
								holders={holderRows}
								limit={holderLimit}
								onLimitChange={(limit) => setHolderReveal({ assetId: props.asset.id, limit })}
								state={props.state}
							/>
							<p className="market-note">{messages.fungibleHolderBalancesNote}</p>
						</section>
					) : null}
					{activeSection === 'about' ? (
						<section
							aria-labelledby="fungible-asset-about-tab"
							className="asset-tab-panel"
							id="fungible-asset-about"
							role="tabpanel"
							tabIndex={0}
						>
							<FungibleAboutPanel assetId={props.asset.id} identity={identity} state={props.state} />
						</section>
					) : null}
				</div>
			</div>
			{activities.walletActivities.map((activity) => (
				<FungibleOperationDialog
					key={`${activity.id}:${activity.createdAt ?? 0}`}
					asset={props.asset}
					collectionId={props.collection.id}
					state={props.state}
					owner={activity.signer}
					operation={activity.operation}
					visible={activity.visible}
					restoreFallback={operationFocusFallback}
					onHide={() => activities.hide(activity.id)}
					onActivityChange={(update) => activities.change(activity.id, update)}
					onRestart={() => activities.restart(activity.id)}
					onClose={(resumeLater, refresh) => activities.close(activity, resumeLater, refresh)}
				/>
			))}
		</section>
	);
}
