import type { AssetSummary, Collection } from 'api/collections';

const MARKET_SHELL_STORAGE_KEY = 'bazar-market-shell:v1';
const ASSET_SHELL_STORAGE_PREFIX = 'bazar-asset-shell:v1:';
const HOME_LISTING_SHELL_STORAGE_KEY = 'bazar-home-listing-shell:v1';

export type HomeListingShell = {
	asset: AssetSummary;
	collection: Collection;
	activity: { processId: string; height: number; timestamp: number };
	price: string;
};

type HomeListingSnapshot = {
	scope: string;
	updatedAt: number;
	listings: HomeListingShell[];
};

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

function isHomeListingShell(value: unknown): value is HomeListingShell {
	if (!value || typeof value !== 'object') return false;
	const listing = value as Partial<HomeListingShell>;
	const asset = listing.asset;
	const collection = listing.collection;
	const activity = listing.activity;
	return (
		isCachedAsset(asset) &&
		isCachedCollection(collection) &&
		collection.assets.some((collectionAsset) => collectionAsset.id === asset.id) &&
		Boolean(activity) &&
		typeof activity?.processId === 'string' &&
		activity.processId.length === 43 &&
		activity.processId === asset.id &&
		Number.isSafeInteger(activity.height) &&
		activity.height >= 0 &&
		Number.isSafeInteger(activity.timestamp) &&
		activity.timestamp >= 0 &&
		typeof listing.price === 'string' &&
		listing.price.length > 0
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

export function loadHomeListingSnapshot(
	storage: Pick<Storage, 'getItem'>,
	scope: string,
	maxAgeMs: number,
	now = Date.now()
): HomeListingShell[] {
	try {
		const value = JSON.parse(
			storage.getItem(HOME_LISTING_SHELL_STORAGE_KEY) ?? 'null'
		) as Partial<HomeListingSnapshot>;
		return value &&
			value.scope === scope &&
			Number.isSafeInteger(value.updatedAt) &&
			(value.updatedAt ?? -1) >= 0 &&
			(value.updatedAt ?? now + 1) <= now &&
			maxAgeMs >= 0 &&
			now - (value.updatedAt ?? 0) <= maxAgeMs &&
			Array.isArray(value.listings) &&
			value.listings.every(isHomeListingShell)
			? value.listings
			: [];
	} catch {
		return [];
	}
}

export function storeHomeListingSnapshot(
	storage: Pick<Storage, 'setItem'>,
	scope: string,
	listings: HomeListingShell[],
	now = Date.now()
) {
	try {
		storage.setItem(
			HOME_LISTING_SHELL_STORAGE_KEY,
			JSON.stringify({ scope, updatedAt: now, listings } satisfies HomeListingSnapshot)
		);
	} catch {
		// Browser storage is an optional acceleration layer.
	}
}
