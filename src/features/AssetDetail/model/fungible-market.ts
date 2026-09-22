import type { CollectionActivityEvent } from 'api/discovery';
import {
	type AssetState,
	formatTokenAmount,
	matchSortedOrderFills,
	parseTokenAmount,
	type SwapOrder,
} from 'api/marketplace';

import { formatArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { unitPriceWinston } from 'features/Catalogue';
import { winstonToArDecimal } from 'helpers/ar-units';
import { short } from 'helpers/format';
import { formatTickerLabel, formatTokenDescription } from 'helpers/token-display';

import type { TokenPricePoint } from '../components/organisms/TokenPriceChart';

export function fungiblePriceHistory(events: CollectionActivityEvent[], denomination: number): TokenPricePoint[] {
	const scale = 10n ** BigInt(denomination);
	const ordered = [...events].sort(
		(left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id)
	);
	const listings = new Map<string, TokenPricePoint>();
	for (const event of ordered) {
		if (event.action !== 'make-offer' || !event.asking || !event.quantity) continue;
		try {
			const asking = BigInt(event.asking);
			const quantity = BigInt(event.quantity);
			if (asking <= 0n || quantity <= 0n) continue;
			listings.set(event.id, {
				id: event.id,
				timestamp: event.timestamp,
				value: ((asking * scale + quantity - 1n) / quantity).toString(),
			});
		} catch {
			// Malformed indexed values are not price evidence.
		}
	}
	const openingListing = listings.values().next().value as TokenPricePoint | undefined;
	if (!openingListing) return [];
	const completedSales = ordered.flatMap((event) => {
		if (event.action !== 'register-interest' || !event.purchaseProof || !event.orderId) return [];
		const listing = listings.get(event.orderId);
		if (!listing || event.timestamp < listing.timestamp) return [];
		return [{ id: event.id, timestamp: event.timestamp, value: listing.value }];
	});
	return [openingListing, ...completedSales].sort(
		(left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id)
	);
}

export function purchaseAmountMatch(orders: SwapOrder[], quantity: string, state: AssetState) {
	if (!quantity.trim()) return { match: null, error: '' };
	try {
		const atomic = parseTokenAmount(quantity, state.denomination);
		const match = matchSortedOrderFills(orders, atomic);
		return {
			match,
			error: match
				? ''
				: `Only ${tokenLabel(
						orders.reduce((total, order) => total + BigInt(order.quantity), 0n).toString(),
						state
				  )} is currently available.`,
		};
	} catch (cause) {
		return {
			match: null,
			error:
				cause instanceof RangeError
					? 'This order book is too large to quote safely. Refresh and try again.'
					: `Enter a valid ${formatTickerLabel(state.ticker)} amount using no more than ${
							state.denomination
					  } decimal places.`,
		};
	}
}

export function fungiblePurchaseReceiptOptions(orders: SwapOrder[], state: AssetState) {
	return orders.map((order, index) => ({
		value: order.orderId,
		label: `Listing ${index + 1} · ${tokenLabel(order.quantity, state)} · ${short(order.creator)}`,
	}));
}

export function visibleOrderbookRows<T>(orders: T[], limit: number) {
	return orders.slice(0, Math.max(0, limit));
}

/**
 * Build the one-sided sell-depth contour shown behind the ask rows. Reserved
 * listings stay visible in the table but do not add purchasable market depth.
 */
export function orderbookCumulativeDepths(orders: ReadonlyArray<Pick<SwapOrder, 'quantity' | 'status'>>) {
	const total = orders.reduce((sum, order) => (order.status === 'open' ? sum + BigInt(order.quantity) : sum), 0n);
	if (total === 0n) return orders.map(() => 0);

	let cumulative = 0n;
	return orders.map((order) => {
		if (order.status === 'open') cumulative += BigInt(order.quantity);
		return Number((cumulative * 10_000n) / total) / 100;
	});
}

export function lotAsking(rawQuantity: string, unitPrice: string, denomination: number): string {
	const price = BigInt(arToWinston(unitPrice));
	const quantity = BigInt(rawQuantity);
	const scale = 10n ** BigInt(denomination);
	return ((price * quantity + scale - 1n) / scale).toString();
}

export function safeLotQuote(quantity: string, price: string, state: AssetState): string | null {
	try {
		return winstonToArDecimal(lotAsking(parseTokenAmount(quantity, state.denomination), price, state.denomination));
	} catch {
		return null;
	}
}

export function safeArPrice(value: string): boolean {
	try {
		return BigInt(arToWinston(value)) > 0n;
	} catch {
		return false;
	}
}

export function safeTokenAmount(value: string, denomination: number): bigint | null {
	try {
		const amount = BigInt(parseTokenAmount(value, denomination));
		return amount > 0n ? amount : null;
	} catch {
		return null;
	}
}

export function orderPriceLabel(order: SwapOrder, state: AssetState) {
	return formatArCurrencyText(
		`${winstonToArDecimal(unitPriceWinston(order, state.denomination).toString())} AR / ${formatTickerLabel(
			state.ticker,
			'token'
		)}`
	);
}

export function tokenLabel(raw: string, state: AssetState) {
	return `${formatGroupedTokenAmount(raw, state.denomination)} ${formatTickerLabel(state.ticker, 'tokens')}`;
}

export function formatGroupedTokenAmount(raw: string, denomination: number) {
	const [whole, fraction] = formatTokenAmount(raw, denomination).split('.');
	const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return fraction ? `${grouped}.${fraction}` : grouped;
}

function arToWinston(value: string) {
	if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value) || value === '0') throw new Error('Enter a positive AR amount.');
	const [whole, decimals = ''] = value.split('.');
	return (BigInt(whole) * 1_000_000_000_000n + BigInt(decimals.padEnd(12, '0'))).toString();
}

export function assetDescription(state: AssetState, fallback: string) {
	if (typeof state.raw.description === 'string' && state.raw.description.trim()) {
		return formatTokenDescription(state.raw.description);
	}
	return formatTokenDescription(fallback);
}
