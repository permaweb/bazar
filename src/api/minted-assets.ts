import { isAudioContentType, isSupportedAssetContentType, normalizeAssetContentType } from 'helpers/asset-media';
import { arweaveGatewayFromLocation, arweaveRawDataUrl } from 'helpers/config';

import type { AssetSummary, Collection } from './collections';

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const STORAGE_KEY = 'bazar-created-assets';

export const CREATED_COLLECTION_ID = 'created-assets';
export const CREATED_COLLECTION_NAME = 'Created on Bazar';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type MintedAsset = AssetSummary & {
	description: string;
	mediaId: string;
	artworkId?: string;
	artist?: string;
	album?: string;
	duration?: number;
	owner: string;
	createdAt: number;
};

export type MintedCollection = Collection & {
	manifestId: string;
	owner: string;
	createdAt: number;
};

export function loadMintedAssets(storage: StorageLike | undefined = globalThis.window?.localStorage): MintedAsset[] {
	if (!storage) return [];
	try {
		const assets = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
		if (!Array.isArray(assets)) return [];
		return assets.filter(isMintedAsset).sort((a, b) => b.createdAt - a.createdAt);
	} catch {
		return [];
	}
}

export function storeMintedAsset(
	asset: MintedAsset,
	storage: StorageLike | undefined = globalThis.window?.localStorage
): void {
	if (!storage || !isMintedAsset(asset)) return;
	storage.setItem(
		STORAGE_KEY,
		JSON.stringify([asset, ...loadMintedAssets(storage).filter((item) => item.id !== asset.id)])
	);
}

export function loadMintedCollections(
	storage: StorageLike | undefined = globalThis.window?.localStorage
): MintedCollection[] {
	if (!storage) return [];
	try {
		const collections = JSON.parse(storage.getItem(`${STORAGE_KEY}:collections`) ?? '[]');
		return Array.isArray(collections)
			? collections.filter(isMintedCollection).sort((a, b) => b.createdAt - a.createdAt)
			: [];
	} catch {
		return [];
	}
}

export function storeMintedCollection(
	collection: MintedCollection,
	storage: StorageLike | undefined = globalThis.window?.localStorage
): void {
	if (!storage || !isMintedCollection(collection)) return;
	storage.setItem(
		`${STORAGE_KEY}:collections`,
		JSON.stringify([collection, ...loadMintedCollections(storage).filter((item) => item.id !== collection.id)])
	);
}

export function createdCollection(assets: AssetSummary[] = loadMintedAssets()): Collection {
	return {
		id: CREATED_COLLECTION_ID,
		name: CREATED_COLLECTION_NAME,
		description: 'One-of-one media minted permanently through Bazar.',
		kind: 'images',
		assets,
		total: assets.length,
	};
}

export function assetFromMintState(
	processId: string,
	raw: Record<string, unknown>,
	fallbackName = ''
): AssetSummary | null {
	const explicitMediaId = String(raw['asset-data'] ?? '');
	const mediaId = explicitMediaId || processId;
	const contentType = normalizeAssetContentType(String(raw['asset-content-type'] ?? ''));
	const artworkId = String(raw['asset-artwork'] ?? '');
	const artist = typeof raw.artist === 'string' ? raw.artist.trim() : '';
	const album = typeof raw.album === 'string' ? raw.album.trim() : '';
	const duration = Number(raw.duration);
	const name = String(raw.name ?? fallbackName).trim();
	if (
		!ADDRESS.test(processId) ||
		!ADDRESS.test(mediaId) ||
		!contentType ||
		(artworkId && !ADDRESS.test(artworkId)) ||
		!name
	)
		return null;
	const gateway = arweaveGatewayFromLocation();
	return {
		id: processId,
		name,
		contentType,
		...(artist ? { artist } : {}),
		...(album ? { album } : {}),
		...(Number.isFinite(duration) && duration > 0 ? { duration } : {}),
		...(isAudioContentType(contentType)
			? {
					media: arweaveRawDataUrl(mediaId, gateway),
					...(artworkId ? { image: arweaveRawDataUrl(artworkId, gateway) } : {}),
			  }
			: { image: arweaveRawDataUrl(mediaId, gateway) }),
	};
}

function isMintedAsset(value: unknown): value is MintedAsset {
	if (!value || typeof value !== 'object') return false;
	const asset = value as MintedAsset;
	return (
		ADDRESS.test(asset.id) &&
		ADDRESS.test(asset.mediaId) &&
		ADDRESS.test(asset.owner) &&
		typeof asset.name === 'string' &&
		typeof asset.description === 'string' &&
		isSupportedAssetContentType(asset.contentType) &&
		(isAudioContentType(asset.contentType) ? typeof asset.media === 'string' : typeof asset.image === 'string') &&
		(asset.artworkId === undefined || ADDRESS.test(asset.artworkId)) &&
		(asset.artist === undefined || typeof asset.artist === 'string') &&
		(asset.album === undefined || typeof asset.album === 'string') &&
		(asset.duration === undefined || (Number.isFinite(asset.duration) && asset.duration > 0)) &&
		Number.isSafeInteger(asset.createdAt)
	);
}

function isMintedCollection(value: unknown): value is MintedCollection {
	if (!value || typeof value !== 'object') return false;
	const collection = value as MintedCollection;
	return (
		ADDRESS.test(collection.id) &&
		ADDRESS.test(collection.manifestId) &&
		ADDRESS.test(collection.owner) &&
		collection.kind === 'images' &&
		typeof collection.name === 'string' &&
		typeof collection.description === 'string' &&
		Array.isArray(collection.assets) &&
		collection.assets.every(isMintedAsset) &&
		Number.isSafeInteger(collection.createdAt)
	);
}
