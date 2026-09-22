import type { HomeListingShell } from 'api/collections';
import { isLiveListing, type ResolvedAsset } from 'api/discovery';
import { type AssetState, bestAskOfAsset, formatTokenAmount, liveOrderOfAsset, type SwapOrder } from 'api/marketplace';

import { winstonToAr } from 'helpers/ar-units';
import { formatTickerLabel, formatTokenDescription } from 'helpers/token-display';

export function assetDescription(state: AssetState | null, fallback: string) {
	if (!state) return formatTokenDescription(fallback);
	if (typeof state.raw.description === 'string' && state.raw.description.trim()) {
		return formatTokenDescription(state.raw.description);
	}
	if (typeof state.raw.data === 'string') {
		try {
			const metadata = JSON.parse(state.raw.data);
			if (typeof metadata?.description === 'string' && metadata.description.trim()) {
				return formatTokenDescription(metadata.description);
			}
		} catch {
			// Non-JSON process data is content, not asset metadata.
		}
	}
	return formatTokenDescription(fallback);
}

export function liveOrder(state: AssetState) {
	return liveOrderOfAsset(state);
}

export function unitPriceWinston(order: SwapOrder, denomination: number) {
	const scale = 10n ** BigInt(denomination);
	return (BigInt(order.asking) * scale + BigInt(order.quantity) - 1n) / BigInt(order.quantity);
}

export function orderPriceLabel(order: SwapOrder, state: AssetState) {
	return `${winstonToAr(unitPriceWinston(order, state.denomination).toString())} AR${
		state.totalSupply === '1' && state.denomination === 0 ? '' : ` / ${formatTickerLabel(state.ticker, 'token')}`
	}`;
}

export function homeListingShell(result: ResolvedAsset): HomeListingShell | undefined {
	const order = bestAskOfAsset(result.state);
	if (!order || !isLiveListing(result)) return undefined;
	return {
		asset: result.asset,
		collection: {
			id: result.collection.id,
			name: result.collection.name,
			description: result.collection.description,
			kind: result.collection.kind,
			assets: [result.asset],
		},
		activity: result.activity,
		price: orderPriceLabel(order, result.state),
	};
}

export function tokenBalanceLabel(value: string, state: AssetState) {
	const [whole, fraction] = formatTokenAmount(value, state.denomination).split('.');
	const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return `${fraction ? `${grouped}.${fraction}` : grouped} ${formatTickerLabel(
		state.ticker,
		state.totalSupply === '1' ? 'asset' : 'tokens'
	)}`;
}
