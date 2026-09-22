import type { WeaveNetworkOptions } from 'weave-wrangler';

import { aoFetch } from 'api/ao/adapter';

import { appError } from 'helpers/app-error';
import { arweaveGatewayFromLocation, observerRelayFromLocation } from 'helpers/config';

import { ArweaveObserverNetwork } from './network';
import { ARWEAVE_OBSERVER_HEALTHY_TARGET } from './policy';

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
	const relay = observerRelayFromLocation(location);
	if (!relay) throw appError('ao-peer-missing');

	return {
		node: arweaveGatewayFromLocation(location),
		minObservers: 3,
		syncTolerance: 2,
		maxObservers: ARWEAVE_OBSERVER_HEALTHY_TARGET,
		fetch: aoFetch(),
		'relay-with': relay,
	};
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
