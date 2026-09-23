import {
	type AssetSummary,
	type Collection,
	hiddenCollectionAssetIndexComplete,
	isVisibleCollectionId,
	loadHiddenCollectionAssetIndex,
	loadMarketShellSnapshot,
	replaceHiddenCollectionAssetIndex,
	withVisibleCollectionAssets,
} from 'api/collections';
import { CREATED_COLLECTION_ID, createdCollection, loadMintedAssets, loadMintedCollections } from 'api/mint';

import type { MarketProviderMessages } from './messages';

/**
 * The local "created on Bazar" collection, with the catalogue's display copy. `api/mint` owns its stable id and the
 * name that matches Arweave `base-collection` tags; the name and description shown here are copy.
 */
export function displayCreatedCollection(assets: AssetSummary[], messages: MarketProviderMessages): Collection {
	return {
		...createdCollection(assets),
		name: messages.marketCreatedCollectionName,
		description: messages.marketCreatedCollectionDescription,
	};
}

export function initialMarketCollections(messages: MarketProviderMessages) {
	replaceHiddenCollectionAssetIndex(loadHiddenCollectionAssetIndex(window.localStorage));
	if (!hiddenCollectionAssetIndexComplete()) return [];
	return storedMarketCollections(messages);
}

export function storedMarketCollections(messages: MarketProviderMessages) {
	const cached = loadMarketShellSnapshot(window.localStorage);
	const localCollections = loadMintedCollections();
	const mintedAssets = loadMintedAssets();
	const known = new Set(cached.map((collection) => collection.id));
	const localAdditions = localCollections.filter((collection) => !known.has(collection.id));
	for (const collection of localAdditions) known.add(collection.id);
	return marketCatalogueCollections([
		...cached,
		...localAdditions,
		...(mintedAssets.length && !known.has(CREATED_COLLECTION_ID)
			? [displayCreatedCollection(mintedAssets, messages)]
			: []),
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
