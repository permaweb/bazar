import React from 'react';
import { Send, ShoppingCart, Tag } from 'lucide-react';

import type { AssetState } from 'api/marketplace';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { type SegmentedTab, SegmentedTabs } from 'components/atoms/SegmentedTabs';
import { ConnectWalletButton } from 'components/organisms/ConnectWalletButton';
import {
	AssetBalanceStateNotice,
	AssetOperationStatus,
	useAssetOperationPendingActionLabel,
} from 'features/Operations';
import { useMessages } from 'providers/LanguageProvider';

import type { FungibleOperationActivities } from '../../../hooks/useFungibleOperationActivities';
import { ASSET_DETAIL_MESSAGES, type AssetDetailMessages } from '../../../messages';
import { orderPriceLabel, type purchaseAmountMatch, tokenLabel } from '../../../model/fungible-market';
import type { FungibleListingDraft, FungibleMarketView } from '../../../model/fungible-market-view';
import { fungibleActivityPhaseStatus } from '../../../model/fungible-operation';
import { FungibleListingComposer } from '../../molecules/FungibleListingComposer';
import { FungiblePurchaseComposer } from '../../molecules/FungiblePurchaseComposer';

import * as S from './styles';

export type FungibleTradeMode = 'buy' | 'sell' | 'transfer';

function tradeTabs(messages: AssetDetailMessages): SegmentedTab<FungibleTradeMode>[] {
	return [
		{
			value: 'buy',
			label: messages.fungibleTradeBuy,
			icon: <Icon icon={ShoppingCart} />,
			panelId: 'fungible-trade-buy',
		},
		{
			value: 'sell',
			label: messages.fungibleTradeSell,
			icon: <Icon icon={Tag} />,
			panelId: 'fungible-trade-sell',
		},
		{
			value: 'transfer',
			label: messages.fungibleTradeTransfer,
			icon: <Icon icon={Send} />,
			panelId: 'fungible-trade-transfer',
		},
	];
}

export default function FungibleTradeCard(props: {
	activities: FungibleOperationActivities;
	error: string | null;
	holderCount: number;
	listing: FungibleListingDraft;
	listingQuantity: string;
	listingUnitPrice: string;
	loading: boolean;
	market: FungibleMarketView;
	purchaseMatch: ReturnType<typeof purchaseAmountMatch>;
	purchaseQuantity: string;
	state: AssetState;
	tradeMode: FungibleTradeMode;
	walletAddress: string | null;
	onBuy(): void;
	onListingQuantityChange(quantity: string): void;
	onListingUnitPriceChange(unitPrice: string): void;
	onListingQuantityMax(): void;
	onPurchaseQuantityChange(quantity: string): void;
	onPurchaseQuantityMax(): void;
	onSell(): void;
	onTradeModeChange(mode: FungibleTradeMode): void;
	onTransfer(): void;
}) {
	const pendingActionLabel = useAssetOperationPendingActionLabel();
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const blockedByState = !props.market.holderBalancesAvailable || props.loading || Boolean(props.error);
	return (
		<S.CommerceCard
			as="section"
			aria-busy={props.activities.hasBusyWalletActivities}
			className="asset-commerce-card"
		>
			<AssetBalanceStateNotice state={props.state} />
			<S.MarketStats className="asset-market-stats">
				<div>
					<span>{messages.fungibleStatCurrentUnitPrice}</span>
					<strong>
						{props.market.best ? (
							<ArCurrencyText>{orderPriceLabel(props.market.best, props.state)}</ArCurrencyText>
						) : (
							messages.fungibleStatNotListed
						)}
					</strong>
				</div>
				<div>
					<span>{messages.fungibleStatForSale}</span>
					<strong>{tokenLabel(props.market.forSale, props.state)}</strong>
				</div>
				<div>
					<span>{messages.fungibleStatYourListed}</span>
					<strong>
						{props.walletAddress
							? tokenLabel(props.market.listed, props.state)
							: messages.fungibleStatEmptyValue}
					</strong>
				</div>
				<div>
					<span>{messages.fungibleStatHolders}</span>
					<strong>
						{props.market.holderBalancesAvailable
							? props.holderCount.toLocaleString()
							: messages.fungibleUnavailable}
					</strong>
				</div>
			</S.MarketStats>
			<S.TradeSwitcher className="fungible-trade-switcher">
				<SegmentedTabs<FungibleTradeMode>
					active={props.tradeMode}
					ariaLabel={messages.fungibleTradeAriaLabel}
					className="fungible-trade-tabs"
					idPrefix="fungible-trade"
					onChange={props.onTradeModeChange}
					tabs={tradeTabs(messages)}
				/>
			</S.TradeSwitcher>
			{props.tradeMode === 'buy' ? (
				<S.TradePanel
					aria-labelledby="fungible-trade-buy-tab"
					className="fungible-trade-panel"
					id="fungible-trade-buy"
					role="tabpanel"
				>
					{props.market.purchasableOrders.length ? (
						<FungiblePurchaseComposer
							availableQuantity={props.market.purchasableQuantity}
							excludedQuantity={props.market.excludedQuantity}
							error={props.purchaseMatch.error}
							match={props.purchaseMatch.match}
							onChange={props.onPurchaseQuantityChange}
							onMax={props.onPurchaseQuantityMax}
							quantity={props.purchaseQuantity}
							state={props.state}
						/>
					) : (
						<S.BuySummaryEmpty className="asset-buy-summary asset-buy-summary-empty">
							<span>{messages.fungiblePurchaseAmount}</span>
							<h1>{messages.fungibleNoPurchasableListings}</h1>
							<small>{messages.fungibleNoPurchasableListingsDetail}</small>
						</S.BuySummaryEmpty>
					)}
				</S.TradePanel>
			) : props.tradeMode === 'sell' ? (
				<S.TradePanel
					aria-labelledby="fungible-trade-sell-tab"
					className="fungible-trade-panel"
					id="fungible-trade-sell"
					role="tabpanel"
				>
					{props.walletAddress && props.market.holderBalancesAvailable && props.market.hasLiquidTokens ? (
						<FungibleListingComposer
							availableQuantity={props.market.liquid}
							onMax={props.onListingQuantityMax}
							onQuantityChange={props.onListingQuantityChange}
							onUnitPriceChange={props.onListingUnitPriceChange}
							quantity={props.listingQuantity}
							quantityError={props.listing.quantityError}
							state={props.state}
							total={props.listing.quote}
							unitPrice={props.listingUnitPrice}
							unitPriceError={props.listing.unitPriceError}
						/>
					) : (
						<S.BuySummaryEmpty className="asset-buy-summary asset-buy-summary-empty">
							<span>{messages.fungibleListingAmount}</span>
							<h1>
								{props.walletAddress
									? props.market.holderBalancesAvailable
										? messages.fungibleNoLiquidTokens
										: messages.fungibleBalanceUnavailable
									: messages.fungibleConnectToList}
							</h1>
							<small>
								{props.walletAddress
									? props.market.holderBalancesAvailable
										? messages.fungibleListedNotAvailable
										: messages.fungibleBalanceRequiredToList
									: messages.fungibleConnectToSeeListable}
							</small>
						</S.BuySummaryEmpty>
					)}
				</S.TradePanel>
			) : (
				<S.TradePanel
					aria-labelledby="fungible-trade-transfer-tab"
					className="fungible-trade-panel"
					id="fungible-trade-transfer"
					role="tabpanel"
				>
					<S.BuySummaryEmpty className="asset-buy-summary asset-buy-summary-empty">
						<span>{messages.fungibleAvailableToTransfer}</span>
						<h1>
							{props.walletAddress
								? !props.market.holderBalancesAvailable
									? messages.fungibleBalanceUnavailable
									: props.market.hasLiquidTokens
									? tokenLabel(props.market.liquid, props.state)
									: messages.fungibleNoLiquidTokens
								: messages.fungibleConnectToTransfer}
						</h1>
						<small>
							{props.walletAddress
								? !props.market.holderBalancesAvailable
									? messages.fungibleBalanceRequiredToTransfer
									: props.market.hasLiquidTokens
									? messages.fungibleChooseRecipient
									: messages.fungibleListedNotTransferable
								: messages.fungibleConnectToSeeTransferable}
						</small>
					</S.BuySummaryEmpty>
				</S.TradePanel>
			)}
			{props.activities.walletActivities.map((activity) => (
				<AssetOperationStatus
					key={activity.id}
					kind={activity.operation.kind}
					phase={activity.phase ?? 'form'}
					status={{ text: fungibleActivityPhaseStatus(activity.phase ?? 'form', messages) }}
					onView={() => props.activities.show(activity.id)}
				/>
			))}
			<S.CommerceActions className="asset-commerce-actions">
				{!props.walletAddress ? <ConnectWalletButton /> : null}
				{props.tradeMode === 'buy' && props.walletAddress && props.market.purchasableOrders.length ? (
					<Button
						className="with-icon market-primary-action"
						disabled={
							!props.purchaseMatch.match || props.activities.purchaseBlocksActions || blockedByState
						}
						size="custom"
						variant="primary"
						onClick={props.onBuy}
					>
						<Icon icon={ShoppingCart} size="sm" />{' '}
						{props.activities.activePurchaseActivity
							? pendingActionLabel('buy')
							: props.purchaseMatch.match
							? messages.fungibleBuyTokens
							: messages.fungibleEnterAmount}
					</Button>
				) : null}
				{props.tradeMode === 'sell' &&
				props.walletAddress &&
				(!props.market.holderBalancesAvailable || props.market.hasLiquidTokens) ? (
					<Button
						className="with-icon market-primary-action"
						disabled={!props.listing.ready || props.activities.assetBlocksActions || blockedByState}
						size="custom"
						onClick={props.onSell}
						variant="primary"
					>
						<Icon icon={Tag} size="sm" />{' '}
						{props.activities.activeAssetActivity?.operation.kind === 'sell'
							? pendingActionLabel('sell')
							: props.listing.ready
							? messages.fungibleReviewListing
							: messages.fungibleEnterListingDetails}
					</Button>
				) : null}
				{props.tradeMode === 'transfer' &&
				props.walletAddress &&
				(!props.market.holderBalancesAvailable || props.market.hasLiquidTokens) ? (
					<Button
						className="with-icon market-primary-action"
						disabled={props.activities.assetBlocksActions || blockedByState}
						size="custom"
						onClick={props.onTransfer}
						variant="primary"
					>
						<Icon icon={Send} size="sm" />{' '}
						{props.activities.activeAssetActivity?.operation.kind === 'transfer'
							? pendingActionLabel('transfer')
							: messages.fungibleTransferTokens}
					</Button>
				) : null}
			</S.CommerceActions>
		</S.CommerceCard>
	);
}
