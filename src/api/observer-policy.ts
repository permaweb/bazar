import type { WatchOptions } from 'weave-wrangler';

export const ARWEAVE_OBSERVER_HEALTHY_TARGET = 7;
export const ARWEAVE_OBSERVER_PENDING_INTERVAL_MS = 9_000;

/**
 * HTTPS gateways that answer `/info`, `/peers` and `/tx/<id>/status` with CORS
 * `*`, so a page asks them directly. WeaveNetwork also adds its default seed,
 * arweave.net. Checked from a browser origin on 2026-11-23 (all in sync at
 * height 2048188); ardrive.net and ar-io.dev share an operator with
 * arweave.net, so the clear-http nodes below add operator diversity.
 */
export const ARWEAVE_OBSERVER_GATEWAY_SEEDS: readonly string[] = Object.freeze([
	'https://ardrive.net',
	'https://ar-io.dev',
	'https://vilenarios.com',
	'https://frostor.xyz',
]);

/**
 * Named Arweave nodes. They serve clear http only, so an https page reaches
 * them through the AO peer's `~relay@1.0`; a relay that only admits named
 * hosts (for example `hosts-allowed: [".arweave.xyz"]`) can still reach them,
 * whereas the bare `ip:port` peers that `/peers` lists would be refused.
 */
export const ARWEAVE_OBSERVER_RELAYED_NODE_SEEDS: readonly string[] = Object.freeze([
	'http://tip-1.arweave.xyz:1984',
	'http://tip-2.arweave.xyz:1984',
	'http://tip-3.arweave.xyz:1984',
	'http://tip-4.arweave.xyz:1984',
	'http://chain-1.arweave.xyz:1984',
	'http://chain-2.arweave.xyz:1984',
	'http://chain-3.arweave.xyz:1984',
]);

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
