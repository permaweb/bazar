import localForage from 'localforage';

function isQuotaExceededError(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false;
	}

	const quotaName = (error as any).name;
	const quotaCode = (error as any).code;

	return (
		quotaName === 'QuotaExceededError' ||
		quotaName === 'NS_ERROR_DOM_QUOTA_REACHED' ||
		quotaCode === 22 ||
		quotaCode === 1014
	);
}

async function clearProblematicKey(key: string) {
	try {
		await localForage.removeItem(key);
	} catch (removeError) {
		// Swallow removal failures to avoid bubbling noise
	}
}

export const safeStorage = {
	async getItem<T>(key: string): Promise<T | null> {
		return localForage.getItem<T>(key);
	},

	async setItem<T>(key: string, value: T): Promise<T | null> {
		try {
			await localForage.setItem(key, value);
			return value;
		} catch (error) {
			if (isQuotaExceededError(error)) {
				await clearProblematicKey(key);
				return null;
			}
			throw error;
		}
	},

	async removeItem(key: string): Promise<void> {
		await localForage.removeItem(key);
	},

	async getAllKeys(): Promise<string[]> {
		return localForage.keys();
	},
};
