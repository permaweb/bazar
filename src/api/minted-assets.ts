import {
	isAudioContentType,
	isHtmlContentType,
	isImageContentType,
	isSupportedAssetContentType,
	normalizeAssetContentType,
	normalizeDisplayAssetContentType,
} from 'helpers/asset-media';
import { arweaveDataUrl, permanentContentGatewayFromLocation } from 'helpers/config';

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

/** Collection assets an earlier, failed run already minted (and paid for), by file index. */
export type MintedByIndex = Readonly<Partial<Record<number, MintedAsset>>>;

/** Paid progress kept in memory after a failed run, valid only for the inputs `key` names. */
export type MintProgress<T> = { key: string; value: T };

/**
 * Name the exact inputs a run's paid transactions were made from. A retry may
 * reuse kept progress only while this key is unchanged: another wallet, file
 * (name, size, last modified, type, position) or tagged field means the earlier
 * transactions no longer match what the creator is about to mint.
 */
export function mintProgressKey(owner: string, scope: Record<string, unknown>): string {
	return JSON.stringify([owner, scope], (_key, value) =>
		typeof File !== 'undefined' && value instanceof File
			? ['file', value.name, value.size, value.lastModified, value.type]
			: value
	);
}

export function reusableMintProgress<T>(progress: MintProgress<T> | null | undefined, key: string): T | undefined {
	return key && progress?.key === key ? progress.value : undefined;
}

/**
 * Paid progress gathered while a run is still going. The caller commits `progress`
 * to its state only when the run fails, so the quote, signature count and notice
 * keep describing the attempt in flight; only the retry sees what it paid for.
 */
export type PendingMintProgress<T> = {
	record: (update: (value: T | undefined) => T) => void;
	/** The reused progress plus what this run paid for, or null when it paid for nothing new. */
	readonly progress: MintProgress<T> | null;
};

export function pendingMintProgress<T>(key: string, reused: T | undefined): PendingMintProgress<T> {
	let progress: MintProgress<T> | null = null;
	return {
		record(update) {
			if (key) progress = { key, value: update(progress ? progress.value : reused) };
		},
		get progress() {
			return progress;
		},
	};
}

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
		!ADDRESS.test(processId) ||
		!ADDRESS.test(mediaId) ||
		!contentType ||
		(artworkId && !ADDRESS.test(artworkId)) ||
		(previewId && !ADDRESS.test(previewId)) ||
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
