import { isArweaveId } from 'helpers/arweave-id';

import { type AssetSummary, type Collection, isVisibleAssetId, isVisibleCollectionId } from './adapter';

export function searchResultScore(
	{ asset, collection }: { asset: AssetSummary; collection: Collection },
	query: string
) {
	if (!query) return 0;
	const name = asset.name.toLowerCase();
	const ticker = asset.ticker?.toLowerCase() ?? '';
	if (ticker === query) return 5;
	if (name === query) return 4;
	if (name.startsWith(query) || ticker.startsWith(query)) return 3;
	if (name.includes(query) || ticker.includes(query)) return 2;
	return `${collection.name} ${collection.description}`.toLowerCase().includes(query) ? 1 : 0;
}

const canonicalNameSearchIndexes = new WeakMap<object, ReadonlyArray<{ asset: AssetSummary; searchName: string }>>();

export function collectionSearchAssets(collection: Collection, query: string): AssetSummary[] {
	const normalizedQuery = query.trim().toLowerCase();
	const visibleAssets = collection.assets.filter((asset) => isVisibleAssetId(asset.id));
	if (!normalizedQuery) return visibleAssets;
	const loadedMatches = visibleAssets.filter((asset) => assetMatchesCollectionQuery(asset, normalizedQuery));
	if (collection.kind !== 'names' || !collection.namespace) return loadedMatches;
	const seen = new Set(loadedMatches.map((asset) => asset.id));
	let canonicalIndex = canonicalNameSearchIndexes.get(collection.namespace.namesById);
	if (!canonicalIndex) {
		canonicalIndex = Object.entries(collection.namespace.namesById).map(([id, name]) => ({
			asset: { id, name },
			searchName: name.toLowerCase(),
		}));
		canonicalNameSearchIndexes.set(collection.namespace.namesById, canonicalIndex);
	}
	const canonicalMatches = canonicalIndex
		.filter(
			({ asset, searchName }) =>
				isVisibleAssetId(asset.id) && searchName.includes(normalizedQuery) && !seen.has(asset.id)
		)
		.map(({ asset }) => asset);
	return [...loadedMatches, ...canonicalMatches];
}

export function collectionMoreAssets(assets: AssetSummary[], assetId: string, limit = 4): AssetSummary[] {
	const result: AssetSummary[] = [];
	for (const asset of assets) {
		if (asset.id === assetId || !isVisibleAssetId(asset.id)) continue;
		result.push(asset);
		if (result.length === limit) break;
	}
	return result;
}

export function assetMatchesCollectionQuery(asset: AssetSummary, query: string): boolean {
	const normalizedQuery = query.trim().toLowerCase();
	return (
		!normalizedQuery ||
		asset.name.toLowerCase().includes(normalizedQuery) ||
		asset.ticker?.toLowerCase().includes(normalizedQuery) === true ||
		asset.id.toLowerCase().includes(normalizedQuery)
	);
}

export function marketplaceAssetMatchesSearch(asset: AssetSummary, collection: Collection, query: string): boolean {
	if (!isVisibleCollectionId(collection.id) || !isVisibleAssetId(asset.id)) return false;
	const normalizedQuery = query.trim().toLowerCase();
	return (
		assetMatchesCollectionQuery(asset, normalizedQuery) ||
		`${collection.name} ${collection.description}`.toLowerCase().includes(normalizedQuery)
	);
}

export function directTokenSearchCollection(collections: Collection[], query: string): Collection | undefined {
	return isArweaveId(query.trim()) && isVisibleAssetId(query.trim())
		? collections.find((collection) => collection.kind === 'tokens')
		: undefined;
}

export function collectionMatchesSearch(collection: Collection, query: string): boolean {
	if (!query) return true;
	return (
		`${collection.name} ${collection.description}`.toLowerCase().includes(query) ||
		collectionSearchAssets(collection, query).length > 0
	);
}

/** Which catalogue kinds a marketplace search accepts. */
export type SearchScope = 'all' | 'collections' | 'tokens' | 'assets' | 'names';

/** An asset encountered outside the collection catalogue, kept searchable with the collection it belongs to. */
export type SearchAsset = { asset: AssetSummary; collection: Collection };

// Share metadata already encountered in Discover or an asset page without fetching the whole catalogue.
export function mergeSearchAssets(current: SearchAsset[], incoming: SearchAsset[], limit = 200): SearchAsset[] {
	const merged = new Map(current.map((result) => [result.asset.id, result]));
	for (const result of incoming) {
		if (!isVisibleAssetId(result.asset.id) || !isVisibleCollectionId(result.collection.id)) continue;
		merged.delete(result.asset.id);
		merged.set(result.asset.id, result);
	}
	return [...merged.values()]
		.filter(({ asset, collection }) => isVisibleAssetId(asset.id) && isVisibleCollectionId(collection.id))
		.slice(-limit);
}

export function searchAssetMatchesScope(result: SearchAsset, scope: SearchScope): boolean {
	if (scope === 'collections') return false;
	if (scope === 'tokens') return result.collection.kind === 'tokens';
	if (scope === 'names') return result.collection.kind === 'names';
	if (scope === 'assets') return result.collection.kind !== 'tokens';
	return true;
}

export function interleaveCollectionAssets(
	collections: Collection[],
	limit: number,
	include: (asset: AssetSummary, collection: Collection) => boolean = () => true
) {
	const queues = collections
		.filter((collection) => isVisibleCollectionId(collection.id))
		.map((collection) => ({
			collection,
			assets: collection.assets.filter((asset) => isVisibleAssetId(asset.id) && include(asset, collection)),
		}));
	const results: { asset: AssetSummary; collection: Collection }[] = [];
	for (let index = 0; results.length < limit && queues.some(({ assets }) => index < assets.length); index += 1) {
		for (const { collection, assets } of queues) {
			const asset = assets[index];
			if (asset) results.push({ asset, collection });
			if (results.length === limit) break;
		}
	}
	return results;
}
