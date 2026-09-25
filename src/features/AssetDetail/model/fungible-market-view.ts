import type { Collection } from 'api/collections';
import {
	assetBalanceStateAvailable,
	type AssetState,
	formatTokenAmount,
	licenseProperties,
	liquidBalanceOf,
	listedBalanceOf,
	liveOrdersOfAsset,
	type SwapOrder,
} from 'api/marketplace';

import { formatMessage } from 'helpers/i18n';
import { formatTickerLabel } from 'helpers/token-display';

import type { AssetDetailMessages } from '../messages';

import { collectionDescriptionFallback } from './asset-detail';
import {
	assetDescription,
	orderbookCumulativeDepths,
	safeArPrice,
	safeLotQuote,
	safeTokenAmount,
	tokenLabel,
} from './fungible-market';
import { licenseDisplayProperties, type LicenseDisplayProperty } from './license-display';

export type FungibleTokenIdentity = {
	ticker: string;
	tickerDisplay: string;
	collectionName: string;
	description: string;
	license: LicenseDisplayProperty[];
};

/** How a token names and describes itself on its trading page. */
export function fungibleTokenIdentity(
	state: AssetState,
	collection: Collection,
	messages: AssetDetailMessages
): FungibleTokenIdentity {
	const ticker = state.ticker || messages.validationDefaultTicker;
	return {
		ticker,
		tickerDisplay: formatTickerLabel(ticker, messages.validationDefaultTicker),
		collectionName: collection.kind === 'tokens' ? messages.collectionTokensName : collection.name,
		description: assetDescription(state, collectionDescriptionFallback(collection, messages)),
		license: licenseDisplayProperties(licenseProperties(state), messages),
	};
}

export type FungibleMarketView = {
	/** Live asks, open and reserved, in book order. */
	orders: SwapOrder[];
	/** Cumulative open depth behind each row of `orders`, as a percentage. */
	orderDepths: number[];
	openOrders: SwapOrder[];
	/** Open asks this wallet may fill: not its own listings and not reserved for it. */
	purchasableOrders: SwapOrder[];
	best: SwapOrder | null;
	forSale: string;
	purchasableQuantity: string;
	/** Open quantity excluded from purchase because this wallet listed or is the recipient of it. */
	excludedQuantity: string;
	maximumPurchaseQuantity: string;
	liquid: string;
	listed: string;
	hasLiquidTokens: boolean;
	maximumListingQuantity: string;
	holderBalancesAvailable: boolean;
};

/** Order book, supply, and wallet balances for one token page from its live process state. */
export function fungibleMarketView(state: AssetState, walletAddress?: string | null): FungibleMarketView {
	const orders = liveOrdersOfAsset(state);
	const openOrders = orders.filter((order) => order.status === 'open');
	const purchasableOrders = openOrders.filter(
		(order) => order.creator !== walletAddress && order.recipient !== walletAddress
	);
	const forSale = openOrders.reduce((total, order) => total + BigInt(order.quantity), 0n);
	const purchasableQuantity = purchasableOrders.reduce((total, order) => total + BigInt(order.quantity), 0n);
	const liquid = walletAddress ? liquidBalanceOf(state, walletAddress) : '0';
	return {
		orders,
		orderDepths: orderbookCumulativeDepths(orders),
		openOrders,
		purchasableOrders,
		best: openOrders[0] ?? null,
		forSale: forSale.toString(),
		purchasableQuantity: purchasableQuantity.toString(),
		excludedQuantity: (forSale - purchasableQuantity).toString(),
		maximumPurchaseQuantity: formatTokenAmount(purchasableQuantity.toString(), state.denomination),
		liquid,
		listed: walletAddress ? listedBalanceOf(state, walletAddress) : '0',
		hasLiquidTokens: BigInt(liquid) > 0n,
		maximumListingQuantity: formatTokenAmount(liquid, state.denomination),
		holderBalancesAvailable: assetBalanceStateAvailable(state),
	};
}

export type FungibleListingDraft = {
	quantityError: string;
	unitPriceError: string;
	/** AR total for the whole lot, when the quantity fits the liquid balance and the price is valid. */
	quote: string | null;
	ready: boolean;
};

/** Validate a listing composer draft against the wallet's liquid balance. */
export function fungibleListingDraft(
	quantity: string,
	unitPrice: string,
	state: AssetState,
	liquid: string,
	messages: AssetDetailMessages
): FungibleListingDraft {
	const amount = safeTokenAmount(quantity, state.denomination);
	const balance = BigInt(liquid);
	const quote = amount !== null && amount <= balance ? safeLotQuote(quantity, unitPrice, state) : null;
	return {
		quantityError: quantity.trim()
			? amount === null
				? formatMessage(messages.validationTokenAmount, {
						ticker: formatTickerLabel(state.ticker, messages.validationDefaultTicker),
						denomination: state.denomination,
				  })
				: amount > balance
				? formatMessage(messages.validationListUpTo, { amount: tokenLabel(liquid, state) })
				: ''
			: '',
		unitPriceError: unitPrice.trim() && !safeArPrice(unitPrice) ? messages.validationArPrice : '',
		quote,
		ready: Boolean(amount !== null && amount <= balance && safeArPrice(unitPrice) && quote),
	};
}
