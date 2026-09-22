import { type AssetSummary, type Collection, isVisibleAssetId, isVisibleCollectionId } from 'api/collections';

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

export function searchAssetMatchesScope(result: SearchAsset, scope: string): boolean {
	if (scope === 'collections') return false;
	if (scope === 'tokens') return result.collection.kind === 'tokens';
	if (scope === 'names') return result.collection.kind === 'names';
	if (scope === 'assets') return result.collection.kind !== 'tokens';
	return true;
}
