import type { WatchOptions } from 'weave-wrangler';

export const ARWEAVE_OBSERVER_HEALTHY_TARGET = 7;
export const ARWEAVE_OBSERVER_PENDING_INTERVAL_MS = 9_000;

export function observerWatchOptions(options: WatchOptions = {}): WatchOptions {
	return {
		...options,
		pendingInterval: Math.max(options.pendingInterval ?? 0, ARWEAVE_OBSERVER_PENDING_INTERVAL_MS),
	};
}

export function observerDiscoveryComplete(activeObservers: number, path: string): boolean {
	if (activeObservers < ARWEAVE_OBSERVER_HEALTHY_TARGET) return false;
	return path === '/peers' || path.startsWith('/~arweave@2.9/peers?');
}
