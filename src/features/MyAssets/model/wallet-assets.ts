import { type ResolvedAsset, walletAssetGroups } from 'api/discovery';
import { liquidBalanceOf, listedBalanceOf, liveOrdersOfAsset } from 'api/marketplace';

import { orderPriceLabel } from 'features/Catalogue';

export type WalletAssetKind = 'tokens' | 'uniques';
export type WalletAssetView = 'all' | 'listed';

export type WalletAssetHolding = {
	/** The wallet has an open listing for this asset. */
	listed: boolean;
	/** The atomic balance to show: listed only, or liquid plus listed. */
	balance: string;
	/** The wallet's asking price for a listed unique asset. */
	uniquePrice?: string;
};

/** Newest wallet activity first, by block height and then timestamp. */
export function sortWalletResults(results: Iterable<ResolvedAsset>): ResolvedAsset[] {
	return [...results].sort(
		(a, b) => b.activity.height - a.activity.height || b.activity.timestamp - a.activity.timestamp
	);
}

/** The results shown in one inventory group: tokens or uniques, optionally only those the wallet has listed. */
export function walletGroupResults(
	results: ResolvedAsset[],
	address: string,
	kind: WalletAssetKind,
	view: WalletAssetView
): ResolvedAsset[] {
	return results.filter(
		(result) =>
			(kind === 'tokens' ? result.collection.kind === 'tokens' : result.collection.kind !== 'tokens') &&
			(view === 'all' || walletAssetGroups(result, address).includes('listed'))
	);
}

export function listedUniquePrice(result: ResolvedAsset, address: string): string | undefined {
	if (result.collection.kind === 'tokens') return undefined;
	const order = liveOrdersOfAsset(result.state).find((candidate) => candidate.creator === address);
	return order ? orderPriceLabel(order, result.state) : undefined;
}

export function walletAssetHolding(result: ResolvedAsset, address: string, view: WalletAssetView): WalletAssetHolding {
	const listed = walletAssetGroups(result, address).includes('listed');
	const listedBalance = listedBalanceOf(result.state, address);
	const uniquePrice = listed ? listedUniquePrice(result, address) : undefined;
	const balance =
		view === 'listed'
			? listedBalance
			: (BigInt(liquidBalanceOf(result.state, address)) + BigInt(listedBalance)).toString();
	return { listed, balance, ...(uniquePrice === undefined ? {} : { uniquePrice }) };
}
