import {
	type Collection,
	hiddenCollectionAssetIndexComplete,
	isVisibleCollectionId,
	loadHiddenCollectionAssetIndex,
	loadMarketShellSnapshot,
	replaceHiddenCollectionAssetIndex,
	withVisibleCollectionAssets,
} from 'api/collections';
import { CREATED_COLLECTION_ID, createdCollection, loadMintedAssets, loadMintedCollections } from 'api/mint';

export function initialMarketCollections() {
	replaceHiddenCollectionAssetIndex(loadHiddenCollectionAssetIndex(window.localStorage));
	if (!hiddenCollectionAssetIndexComplete()) return [];
	return storedMarketCollections();
}

export function storedMarketCollections() {
	const cached = loadMarketShellSnapshot(window.localStorage);
	const localCollections = loadMintedCollections();
	const mintedAssets = loadMintedAssets();
	const known = new Set(cached.map((collection) => collection.id));
	const localAdditions = localCollections.filter((collection) => !known.has(collection.id));
	for (const collection of localAdditions) known.add(collection.id);
	return marketCatalogueCollections([
		...cached,
		...localAdditions,
		...(mintedAssets.length && !known.has(CREATED_COLLECTION_ID) ? [createdCollection(mintedAssets)] : []),
	]);
}

export function marketCatalogueCollections(collections: Collection[]): Collection[] {
	return withoutDuplicatedCreatedAssets(
		collections.filter((collection) => isVisibleCollectionId(collection.id)).map(withVisibleCollectionAssets)
	);
}

export function withoutDuplicatedCreatedAssets(collections: Collection[]): Collection[] {
	const collectionAssetIds = new Set(
		collections
			.filter((collection) => collection.id !== CREATED_COLLECTION_ID)
			.flatMap((collection) => collection.assets.map((asset) => asset.id))
	);
	return collections.flatMap((collection) => {
		if (collection.id !== CREATED_COLLECTION_ID) return [collection];
		const assets = collection.assets.filter((asset) => !collectionAssetIds.has(asset.id));
		return assets.length ? [{ ...collection, assets, total: assets.length }] : [];
	});
}

export function verifiedCollectionIdsFrom(collections: Collection[]) {
	return collections
		.filter((collection) => collection.indexSource !== 'compiled-fallback')
		.map((collection) => collection.id);
}
