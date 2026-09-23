export type TransactionSyncSessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Session storage when the browser exposes it; blocked or absent storage disables visual continuity only. */
export function browserSessionStorage(): TransactionSyncSessionStorage | undefined {
	try {
		return typeof window === 'undefined' ? undefined : window.sessionStorage;
	} catch {
		return undefined;
	}
}
