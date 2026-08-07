import type { WeaveNetworkOptions } from 'weave-wrangler';

import { AO_MAINNET, arweaveGatewayFromLocation, gatewayFromLocation } from 'helpers/config';

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

	return {
		node: arweaveGatewayFromLocation(location),
		minObservers: 3,
		syncTolerance: 2,
		maxObservers: ARWEAVE_OBSERVER_HEALTHY_TARGET,
		...(isLocalDevelopment && !hasSelectedRelay
			? { pageProtocol: location.protocol }
			: { 'relay-with': hasSelectedRelay ? gatewayFromLocation(location) : AO_MAINNET.app1 }),
	};
}

function observerNetworkKey(options: WeaveNetworkOptions): string {
	return JSON.stringify(
		Object.entries(options)
			.filter(([, value]) => value !== undefined)
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
