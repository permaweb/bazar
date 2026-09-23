import { appError } from './app-error';

export const MARKET_SHELL_STORAGE_KEY = 'bazar-market-shell:v1';
export const MARKET_ACTIVITY_STORAGE_KEY = 'bazar-market-activity:v1';
export const GLOBAL_ACTIVITY_STATS_STORAGE_KEY = 'bazar-global-activity-stats:v1';
export const HOME_LISTING_SHELL_STORAGE_KEY = 'bazar-home-listing-shell:v1';
export const HIDDEN_COLLECTION_ASSETS_STORAGE_KEY = 'bazar-hidden-collection-assets:v1';
export const ASSET_SHELL_STORAGE_PREFIX = 'bazar-asset-shell:v1:';
export const WALLET_CANDIDATE_SCAN_STORAGE_PREFIX = 'bazar.wallet-candidate-scan';

const REBUILDABLE_CACHE_KEYS = [
	MARKET_SHELL_STORAGE_KEY,
	MARKET_ACTIVITY_STORAGE_KEY,
	GLOBAL_ACTIVITY_STATS_STORAGE_KEY,
	HOME_LISTING_SHELL_STORAGE_KEY,
	HIDDEN_COLLECTION_ASSETS_STORAGE_KEY,
];
const REBUILDABLE_CACHE_PREFIXES = [ASSET_SHELL_STORAGE_PREFIX, `${WALLET_CANDIDATE_SCAN_STORAGE_PREFIX}:`];

type WritableStorage = Pick<Storage, 'setItem'> & Partial<Pick<Storage, 'key' | 'length' | 'removeItem'>>;

/** Browsers identify a full origin quota by DOMException name, or by its legacy numeric code (22, Firefox 1014). */
function isQuotaError(error: unknown) {
	if (!error || typeof error !== 'object') return false;
	const { name, code } = error as { name?: string; code?: number };
	return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}

function clearRebuildableCaches(storage: WritableStorage) {
	if (!storage.removeItem) return;
	for (const key of REBUILDABLE_CACHE_KEYS) storage.removeItem(key);
	if (!storage.key || typeof storage.length !== 'number') return;
	const keys = Array.from({ length: storage.length }, (_, index) => storage.key?.(index));
	for (const key of keys) {
		if (key && REBUILDABLE_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) storage.removeItem(key);
	}
}

export function setCriticalStorageItem(storage: WritableStorage, key: string, value: string) {
	try {
		storage.setItem(key, value);
		return;
	} catch (error) {
		if (!isQuotaError(error)) throw error;
	}

	clearRebuildableCaches(storage);
	try {
		storage.setItem(key, value);
	} catch (error) {
		if (!isQuotaError(error)) throw error;
		throw appError('browser-storage-full', { cause: error });
	}
}
