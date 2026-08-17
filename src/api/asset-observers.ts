import type { WeaveNetworkOptions } from 'weave-wrangler';

import { arweaveGatewayFromLocation, DEFAULT_COMPUTE_GATEWAYS, gatewaysFromLocation } from 'helpers/config';

import { aoClient } from './ao';
import { ArweaveObserverNetwork } from './arweave-observers';
import { ARWEAVE_OBSERVER_HEALTHY_TARGET } from './observer-policy';

type SharedObserverNetwork = {
	network: ArweaveObserverNetwork;
	ready: ReturnType<ArweaveObserverNetwork['ready']>;
	references: number;
};

export type AssetObserverNetworkLease = {
	network: ArweaveObserverNetwork;
	ready: ReturnType<ArweaveObserverNetwork['ready']>;
	release(): void;
};

const sharedObserverNetworks = new Map<string, SharedObserverNetwork>();

export function assetObserverNetworkOptions(location: Location = window.location): WeaveNetworkOptions {
	const hashQueryIndex = location.hash?.indexOf('?') ?? -1;
	const hashSearch = hashQueryIndex === -1 ? '' : location.hash.slice(hashQueryIndex);
	const hasSelectedRelay =
		new URLSearchParams(location.search).has('node') || new URLSearchParams(hashSearch).has('node');
	const isLocalDevelopment = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname);
	const relays = hasSelectedRelay ? gatewaysFromLocation(location) : DEFAULT_COMPUTE_GATEWAYS;
	const relay = relays[0];

	return {
		ao: aoClient(relays),
		node: arweaveGatewayFromLocation(location),
		minObservers: 3,
		syncTolerance: 2,
		maxObservers: ARWEAVE_OBSERVER_HEALTHY_TARGET,
		...(isLocalDevelopment && !hasSelectedRelay
			? { pageProtocol: location.protocol }
			: { fetch: observerRelayFetch(relays), 'relay-with': relay }),
	};
}

/**
 * Relay responses contain relay-specific commitments, so combining the same
 * logical observer request through AO Wrangler's response quorum can reject
 * otherwise valid answers as different. Try the selected relay origins in
 * order and return one complete HTTP response instead.
 */
export function observerRelayFetch(
	relays: readonly string[],
	fetcher: typeof fetch = globalThis.fetch.bind(globalThis)
) {
	const origins = [...new Set(relays.map((relay) => new URL(relay).origin))];
	return (async (input: RequestInfo | URL, init?: RequestInit) => {
		const source = input instanceof Request ? input.url : String(input);
		let requested: URL;
		try {
			requested = new URL(source);
		} catch {
			return fetcher(input, init);
		}
		if (!origins.includes(requested.origin)) return fetcher(input, init);
		const ordered = [requested.origin, ...origins.filter((origin) => origin !== requested.origin)];
		let lastResponse: Response | undefined;
		let lastError: unknown;
		for (const origin of ordered) {
			const target = `${origin}${requested.pathname}${requested.search}${requested.hash}`;
			try {
				const response = await fetcher(input instanceof Request ? new Request(target, input) : target, init);
				lastResponse = response;
				if (response.status !== 429 && response.status < 500) return response;
			} catch (error) {
				lastError = error;
			}
		}
		if (lastResponse) return lastResponse;
		throw lastError instanceof Error ? lastError : new Error('observer-relay-unavailable');
	}) as typeof fetch;
}

function observerNetworkKey(options: WeaveNetworkOptions): string {
	return JSON.stringify(
		Object.entries(options)
			.filter(([key, value]) => key !== 'ao' && key !== 'fetch' && value !== undefined)
			.sort(([left], [right]) => left.localeCompare(right))
	);
}

/**
 * Shares observer discovery and transport between active operations using the
 * same selected gateway. Each operation retains its own transaction watcher
 * and releases only its lease when it finishes.
 */
export function acquireAssetObserverNetwork(location: Location = window.location): AssetObserverNetworkLease {
	const options = assetObserverNetworkOptions(location);
	const key = observerNetworkKey(options);
	let shared = sharedObserverNetworks.get(key);
	if (!shared) {
		const network = new ArweaveObserverNetwork(options);
		shared = { network, ready: network.ready(), references: 0 };
		sharedObserverNetworks.set(key, shared);
	}
	const entry = shared;
	entry.references += 1;
	let released = false;
	return {
		network: entry.network,
		ready: entry.ready,
		release() {
			if (released) return;
			released = true;
			entry.references -= 1;
			if (entry.references > 0) return;
			if (sharedObserverNetworks.get(key) === entry) sharedObserverNetworks.delete(key);
			entry.network.stop();
		},
	};
}
