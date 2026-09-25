import type { AssetSummary, Collection } from 'api/collections/adapter';

import { isArweaveId } from 'helpers/arweave-id';
import {
	isAudioContentType,
	isHtmlContentType,
	isImageContentType,
	isSupportedAssetContentType,
	normalizeAssetContentType,
	normalizeDisplayAssetContentType,
} from 'helpers/asset-media';
import { arweaveDataUrl, permanentContentGatewayFromLocation } from 'helpers/config';

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

export function removeMintedAssets(
	ids: Iterable<string>,
	storage: StorageLike | undefined = globalThis.window?.localStorage
): void {
	if (!storage) return;
	const removed = new Set(ids);
	if (!removed.size) return;
	storage.setItem(STORAGE_KEY, JSON.stringify(loadMintedAssets(storage).filter((asset) => !removed.has(asset.id))));
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
	const contentType = normalizeDisplayAssetContentType(
		String(raw['asset-content-type'] ?? raw['content-type'] ?? '')
	);
	const artworkId = String(raw['asset-artwork'] ?? '');
	const previewId = String(raw['asset-preview'] ?? '');
	const previewContentType = normalizeAssetContentType(String(raw['asset-preview-content-type'] ?? ''));
	const artist = typeof raw.artist === 'string' ? raw.artist.trim() : '';
	const album = typeof raw.album === 'string' ? raw.album.trim() : '';
	const duration = Number(raw.duration);
	const name = String(raw.name ?? fallbackName).trim();
	if (
		!isArweaveId(processId) ||
		!isArweaveId(mediaId) ||
		!contentType ||
		(artworkId && !isArweaveId(artworkId)) ||
		(previewId && !isArweaveId(previewId)) ||
		(raw['asset-preview-content-type'] !== undefined && !isImageContentType(previewContentType ?? undefined)) ||
		(isHtmlContentType(contentType) && (!previewId || !previewContentType)) ||
		!name
	)
		return null;
	const mediaGateway = permanentContentGatewayFromLocation();
	return {
		id: processId,
		name,
		contentType,
		...(artist ? { artist } : {}),
		...(album ? { album } : {}),
		...(Number.isFinite(duration) && duration > 0 ? { duration } : {}),
		...(isHtmlContentType(contentType)
			? {
					media: arweaveDataUrl(mediaId, mediaGateway),
					image: arweaveDataUrl(previewId, mediaGateway),
			  }
			: isAudioContentType(contentType)
			? {
					media: arweaveDataUrl(mediaId, mediaGateway),
					...(artworkId ? { image: arweaveDataUrl(artworkId, mediaGateway) } : {}),
			  }
			: { image: arweaveDataUrl(mediaId, mediaGateway) }),
	};
}

function isMintedAsset(value: unknown): value is MintedAsset {
	if (!value || typeof value !== 'object') return false;
	const asset = value as MintedAsset;
	return (
		isArweaveId(asset.id) &&
		isArweaveId(asset.mediaId) &&
		isArweaveId(asset.owner) &&
		typeof asset.name === 'string' &&
		typeof asset.description === 'string' &&
		isSupportedAssetContentType(asset.contentType) &&
		(isAudioContentType(asset.contentType) ? typeof asset.media === 'string' : typeof asset.image === 'string') &&
		(asset.artworkId === undefined || isArweaveId(asset.artworkId)) &&
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
		isArweaveId(collection.id) &&
		isArweaveId(collection.manifestId) &&
		isArweaveId(collection.owner) &&
		collection.kind === 'images' &&
		typeof collection.name === 'string' &&
		typeof collection.description === 'string' &&
		Array.isArray(collection.assets) &&
		collection.assets.every(isMintedAsset) &&
		Number.isSafeInteger(collection.createdAt)
	);
}
