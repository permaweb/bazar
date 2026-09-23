import React from 'react';
import { Send, ShoppingCart, Tag } from 'lucide-react';

import type { AssetState } from 'api/marketplace';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { type SegmentedTab, SegmentedTabs } from 'components/atoms/SegmentedTabs';
import { ConnectWalletButton } from 'components/organisms/ConnectWalletButton';
import { AssetBalanceStateNotice, assetOperationPendingActionLabel, AssetOperationStatus } from 'features/Operations';

import type { FungibleOperationActivities } from '../../../hooks/useFungibleOperationActivities';
import { orderPriceLabel, type purchaseAmountMatch, tokenLabel } from '../../../model/fungible-market';
import type { FungibleListingDraft, FungibleMarketView } from '../../../model/fungible-market-view';
import { fungibleActivityPhaseStatus } from '../../../model/fungible-operation';
import { FungibleListingComposer } from '../../molecules/FungibleListingComposer';
import { FungiblePurchaseComposer } from '../../molecules/FungiblePurchaseComposer';

export type FungibleTradeMode = 'buy' | 'sell' | 'transfer';

const TRADE_TABS: SegmentedTab<FungibleTradeMode>[] = [
	{
		value: 'buy',
		label: 'Buy',
		icon: <Icon icon={ShoppingCart} />,
		panelId: 'fungible-trade-buy',
	},
	{
		value: 'sell',
		label: 'List',
		icon: <Icon icon={Tag} />,
		panelId: 'fungible-trade-sell',
	},
	{
		value: 'transfer',
		label: 'Transfer',
		icon: <Icon icon={Send} />,
		panelId: 'fungible-trade-transfer',
	},
];

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
	const blockedByState = !props.market.holderBalancesAvailable || props.loading || Boolean(props.error);
	return (
		<section aria-busy={props.activities.hasBusyWalletActivities} className="asset-commerce-card">
			<AssetBalanceStateNotice state={props.state} />
			<div className="asset-market-stats">
				<div>
					<span>Current unit price</span>
					<strong>
						{props.market.best ? (
							<ArCurrencyText>{orderPriceLabel(props.market.best, props.state)}</ArCurrencyText>
						) : (
							'Not listed'
						)}
					</strong>
				</div>
				<div>
					<span>For sale</span>
					<strong>{tokenLabel(props.market.forSale, props.state)}</strong>
				</div>
				<div>
					<span>Your listed</span>
					<strong>{props.walletAddress ? tokenLabel(props.market.listed, props.state) : '—'}</strong>
				</div>
				<div>
					<span>Holders</span>
					<strong>
						{props.market.holderBalancesAvailable ? props.holderCount.toLocaleString() : 'Unavailable'}
					</strong>
				</div>
			</div>
			<div className="fungible-trade-switcher">
				<SegmentedTabs<FungibleTradeMode>
					active={props.tradeMode}
					ariaLabel="Trade action"
					className="fungible-trade-tabs"
					idPrefix="fungible-trade"
					onChange={props.onTradeModeChange}
					tabs={TRADE_TABS}
				/>
			</div>
			{props.tradeMode === 'buy' ? (
				<div
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
						<div className="asset-buy-summary asset-buy-summary-empty">
							<span>Purchase amount</span>
							<h1>No purchasable listings</h1>
							<small>No open listings are available to this wallet.</small>
						</div>
					)}
				</div>
			) : props.tradeMode === 'sell' ? (
				<div
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
						<div className="asset-buy-summary asset-buy-summary-empty">
							<span>Listing amount</span>
							<h1>
								{props.walletAddress
									? props.market.holderBalancesAvailable
										? 'No liquid tokens'
										: 'Balance unavailable'
									: 'Connect to list'}
							</h1>
							<small>
								{props.walletAddress
									? props.market.holderBalancesAvailable
										? 'Tokens already listed for sale are not available for a new listing.'
										: 'Complete holder balance state is required before listing tokens.'
									: 'Connect your wallet to see the tokens available to list.'}
							</small>
						</div>
					)}
				</div>
			) : (
				<div
					aria-labelledby="fungible-trade-transfer-tab"
					className="fungible-trade-panel"
					id="fungible-trade-transfer"
					role="tabpanel"
				>
					<div className="asset-buy-summary asset-buy-summary-empty">
						<span>Available to transfer</span>
						<h1>
							{props.walletAddress
								? !props.market.holderBalancesAvailable
									? 'Balance unavailable'
									: props.market.hasLiquidTokens
									? tokenLabel(props.market.liquid, props.state)
									: 'No liquid tokens'
								: 'Connect to transfer'}
						</h1>
						<small>
							{props.walletAddress
								? !props.market.holderBalancesAvailable
									? 'Complete holder balance state is required before transferring tokens.'
									: props.market.hasLiquidTokens
									? 'Choose a recipient and amount in the transfer review.'
									: 'Tokens listed for sale are not available to transfer.'
								: 'Connect your wallet to see the tokens available to transfer.'}
						</small>
					</div>
				</div>
			)}
			{props.activities.walletActivities.map((activity) => (
				<AssetOperationStatus
					key={activity.id}
					kind={activity.operation.kind}
					phase={activity.phase ?? 'form'}
					status={fungibleActivityPhaseStatus(activity.phase ?? 'form')}
					onView={() => props.activities.show(activity.id)}
				/>
			))}
			<div className="asset-commerce-actions">
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
							? assetOperationPendingActionLabel('buy')
							: props.purchaseMatch.match
							? 'Buy tokens'
							: 'Enter an amount'}
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
							? assetOperationPendingActionLabel('sell')
							: props.listing.ready
							? 'Review listing'
							: 'Enter listing details'}
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
							? assetOperationPendingActionLabel('transfer')
							: 'Transfer tokens'}
					</Button>
				) : null}
			</div>
		</section>
	);
}
