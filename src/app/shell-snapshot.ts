import type { AssetSummary, Collection } from 'api/collections';

const MARKET_SHELL_STORAGE_KEY = 'bazar-market-shell:v1';
const ASSET_SHELL_STORAGE_PREFIX = 'bazar-asset-shell:v1:';
const HOME_DISCOVER_STORAGE_KEY = 'bazar-home-discover:v1';
const HOME_LISTING_SHELL_STORAGE_KEY = 'bazar-home-listing-shell:v1';
const ARWEAVE_ID = /^[A-Za-z0-9_-]{43}$/;

type SnapshotStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function sessionSnapshotStorage(
	production: boolean,
	resolve: () => SnapshotStorage = () => window.sessionStorage
): SnapshotStorage | undefined {
	return production ? resolve() : undefined;
}

export type HomeDiscoverListing = {
	asset: AssetSummary;
	collection: Collection;
	activity: { processId: string; height: number; timestamp: number };
	price: string;
};

export type HomeListingShell = HomeDiscoverListing;

export type HomeDiscoverCandidate = {
	processId: string;
	height: number;
	timestamp: number;
	activityIds?: string[];
	marketAction?: 'make-offer' | 'register-interest' | 'transfer' | 'cancel-order';
};

export type HomeDiscoverSnapshot = {
	scope: string;
	updatedAt: number;
	cursor: string | null;
	hasMore: boolean;
	seenProcessIds: string[];
	pendingCandidates: HomeDiscoverCandidate[];
	listings: HomeDiscoverListing[];
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

function isSafeInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isHomeDiscoverCandidate(value: unknown): value is HomeDiscoverCandidate {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<HomeDiscoverCandidate>;
	return (
		ARWEAVE_ID.test(candidate.processId ?? '') &&
		isSafeInteger(candidate.height) &&
		isSafeInteger(candidate.timestamp) &&
		(candidate.marketAction === undefined ||
			['make-offer', 'register-interest', 'transfer', 'cancel-order'].includes(candidate.marketAction)) &&
		(candidate.activityIds === undefined ||
			(Array.isArray(candidate.activityIds) && candidate.activityIds.every((id) => ARWEAVE_ID.test(id))))
	);
}

function isHomeDiscoverListing(value: unknown): value is HomeDiscoverListing {
	if (!value || typeof value !== 'object') return false;
	const listing = value as Partial<HomeDiscoverListing>;
	return (
		isCachedAsset(listing.asset) &&
		isCachedCollection(listing.collection) &&
		isHomeDiscoverCandidate(listing.activity) &&
		listing.activity.processId === listing.asset.id &&
		typeof listing.price === 'string' &&
		Boolean(listing.price.trim())
	);
}

function isHomeListingShell(value: unknown): value is HomeListingShell {
	return (
		isHomeDiscoverListing(value) &&
		value.collection.assets.some((collectionAsset) => collectionAsset.id === value.asset.id)
	);
}

export function loadMarketShellSnapshot(storage?: Pick<Storage, 'getItem'>): Collection[] {
	if (!storage) return [];
	try {
		const value = JSON.parse(storage.getItem(MARKET_SHELL_STORAGE_KEY) ?? 'null');
		return Array.isArray(value) && value.every(isCachedCollection) ? value : [];
	} catch {
		return [];
	}
}

export function storeMarketShellSnapshot(storage: Pick<Storage, 'setItem'> | undefined, collections: Collection[]) {
	if (!storage) return;
	try {
		storage.setItem(MARKET_SHELL_STORAGE_KEY, JSON.stringify(collections));
	} catch {
		// Browser storage is an optional acceleration layer.
	}
}

export function loadAssetShellSnapshot(
	storage: Pick<Storage, 'getItem'> | undefined,
	assetId: string
): AssetSummary | undefined {
	if (!storage) return undefined;
	try {
		const value = JSON.parse(storage.getItem(`${ASSET_SHELL_STORAGE_PREFIX}${assetId}`) ?? 'null');
		return isCachedAsset(value) && value.id === assetId ? value : undefined;
	} catch {
		return undefined;
	}
}

export function storeAssetShellSnapshot(storage: Pick<Storage, 'setItem'> | undefined, asset: AssetSummary) {
	if (!storage) return;
	try {
		storage.setItem(`${ASSET_SHELL_STORAGE_PREFIX}${asset.id}`, JSON.stringify(asset));
	} catch {
		// Browser storage is an optional acceleration layer.
	}
}

export function loadHomeDiscoverSnapshot(
	storage: Pick<Storage, 'getItem'> | undefined,
	scope: string
): HomeDiscoverSnapshot | undefined {
	if (!storage) return undefined;
	try {
		const value = JSON.parse(storage.getItem(HOME_DISCOVER_STORAGE_KEY) ?? 'null') as Partial<HomeDiscoverSnapshot>;
		if (
			!value ||
			typeof value !== 'object' ||
			value.scope !== scope ||
			!isSafeInteger(value.updatedAt) ||
			(value.cursor !== null && typeof value.cursor !== 'string') ||
			typeof value.hasMore !== 'boolean' ||
			!Array.isArray(value.seenProcessIds) ||
			!value.seenProcessIds.every((id) => ARWEAVE_ID.test(id)) ||
			!Array.isArray(value.pendingCandidates) ||
			!value.pendingCandidates.every(isHomeDiscoverCandidate) ||
			!Array.isArray(value.listings) ||
			!value.listings.every(isHomeDiscoverListing)
		)
			return undefined;
		return value as HomeDiscoverSnapshot;
	} catch {
		return undefined;
	}
}

export function storeHomeDiscoverSnapshot(
	storage: Pick<Storage, 'setItem'> | undefined,
	snapshot: HomeDiscoverSnapshot
) {
	if (!storage) return;
	try {
		storage.setItem(HOME_DISCOVER_STORAGE_KEY, JSON.stringify(snapshot));
	} catch {
		// Browser storage is an optional acceleration layer.
	}
}

export function loadHomeListingSnapshot(
	storage: Pick<Storage, 'getItem'> | undefined,
	scope: string,
	maxAgeMs: number,
	now = Date.now()
): HomeListingShell[] {
	if (!storage) return [];
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
	storage: Pick<Storage, 'setItem'> | undefined,
	scope: string,
	listings: HomeListingShell[],
	now = Date.now()
) {
	if (!storage) return;
	try {
		storage.setItem(
			HOME_LISTING_SHELL_STORAGE_KEY,
			JSON.stringify({ scope, updatedAt: now, listings } satisfies HomeListingSnapshot)
		);
	} catch {
		// Browser storage is an optional acceleration layer.
	}
}
