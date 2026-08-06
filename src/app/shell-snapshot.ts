import type { AssetSummary, Collection } from 'api/collections';

const MARKET_SHELL_STORAGE_KEY = 'bazar-market-shell:v1';
const ASSET_SHELL_STORAGE_PREFIX = 'bazar-asset-shell:v1:';

function isCachedAsset(value: unknown): value is AssetSummary {
	if (!value || typeof value !== 'object') return false;
	const asset = value as Partial<AssetSummary>;
	return typeof asset.id === 'string' && typeof asset.name === 'string';
}

function isCachedCollection(value: unknown): value is Collection {
	if (!value || typeof value !== 'object') return false;
	const collection = value as Partial<Collection>;
	return (
		typeof collection.id === 'string' &&
		typeof collection.name === 'string' &&
		typeof collection.description === 'string' &&
		['names', 'images', 'tokens'].includes(collection.kind ?? '') &&
		Array.isArray(collection.assets) &&
		collection.assets.every(isCachedAsset)
	);
}

export function loadMarketShellSnapshot(storage: Pick<Storage, 'getItem'>): Collection[] {
	try {
		const value = JSON.parse(storage.getItem(MARKET_SHELL_STORAGE_KEY) ?? 'null');
		return Array.isArray(value) && value.every(isCachedCollection) ? value : [];
	} catch {
		return [];
	}
}

export function storeMarketShellSnapshot(storage: Pick<Storage, 'setItem'>, collections: Collection[]) {
	try {
		storage.setItem(MARKET_SHELL_STORAGE_KEY, JSON.stringify(collections));
	} catch {
		// Browser storage is an optional acceleration layer.
	}
}

export function loadAssetShellSnapshot(storage: Pick<Storage, 'getItem'>, assetId: string): AssetSummary | undefined {
	try {
		const value = JSON.parse(storage.getItem(`${ASSET_SHELL_STORAGE_PREFIX}${assetId}`) ?? 'null');
		return isCachedAsset(value) && value.id === assetId ? value : undefined;
	} catch {
		return undefined;
	}
}

export function storeAssetShellSnapshot(storage: Pick<Storage, 'setItem'>, asset: AssetSummary) {
	try {
		storage.setItem(`${ASSET_SHELL_STORAGE_PREFIX}${asset.id}`, JSON.stringify(asset));
	} catch {
		// Browser storage is an optional acceleration layer.
	}
}
