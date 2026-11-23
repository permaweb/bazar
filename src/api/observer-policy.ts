import type { WatchOptions } from 'weave-wrangler';

export const ARWEAVE_OBSERVER_HEALTHY_TARGET = 7;
export const ARWEAVE_OBSERVER_PENDING_INTERVAL_MS = 9_000;

/**
 * Arweave's own named nodes, used as observers beside the selected gateway
 * (arweave.net by default, which WeaveNetwork also seeds). They serve clear
 * http only, so an https page reaches them through the AO peer's
 * `~relay@1.0`; a relay that admits only named hosts (for example
 * `hosts-allowed: [".arweave.xyz"]`) can reach them, whereas the bare
 * `ip:port` peers that `/peers` lists would be refused. A deployment replaces
 * the list with `VITE_ARWEAVE_OBSERVER_NODES` (comma-separated origins).
 */
export const DEFAULT_ARWEAVE_OBSERVER_NODES: readonly string[] = Object.freeze([
	'http://tip-1.arweave.xyz:1984',
	'http://tip-2.arweave.xyz:1984',
	'http://tip-3.arweave.xyz:1984',
	'http://tip-4.arweave.xyz:1984',
	'http://chain-1.arweave.xyz:1984',
	'http://chain-2.arweave.xyz:1984',
	'http://chain-3.arweave.xyz:1984',
]);

/** Parse an ordered, comma-separated observer origin list; unusable entries are skipped. */
export function parseArweaveObserverNodes(value: string | undefined): string[] {
	const nodes = new Set<string>();
	for (const entry of value?.split(',') ?? []) {
		const candidate = entry.trim();
		if (!candidate) continue;
		try {
			const url = new URL(candidate);
			if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) nodes.add(url.origin);
		} catch {
			// A malformed entry must not take observation down with it.
		}
	}
	return nodes.size ? [...nodes] : [...DEFAULT_ARWEAVE_OBSERVER_NODES];
}

const configuredObserverNodes = parseArweaveObserverNodes(import.meta.env.VITE_ARWEAVE_OBSERVER_NODES?.trim());

/** Observer nodes for this deployment, in preference order. */
export function arweaveObserverNodes(): string[] {
	return [...configuredObserverNodes];
}

/** A transaction watch needs at least this many reachable observers to form a quorum. */
export const ARWEAVE_OBSERVER_QUORUM_MINIMUM = 2;

/** How long a watch waits for enough observers to become reachable before saying it cannot verify. */
export const ARWEAVE_OBSERVER_QUORUM_GRACE_MS = 15_000;

/** True when the reachable observers cannot form a quorum for a transaction watch. */
export function observerQuorumUnavailable(activeObservers: number): boolean {
	return activeObservers < ARWEAVE_OBSERVER_QUORUM_MINIMUM;
}

/**
 * HyperBEAM's relay answers a multi-value `Accept` (weave-wrangler sends
 * `application/json, text/plain`) with the whole relayed message as JSON rather
 * than the peer's body; a single media type returns the body itself.
 */
export const ARWEAVE_OBSERVER_RELAY_ACCEPT = 'application/json';

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
