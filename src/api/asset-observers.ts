import {
	DirectTransport,
	type HttpResult,
	type ObserverTransport,
	RelayTransport,
	type RequestOptions,
	type WeaveNetworkOptions,
} from 'weave-wrangler';

import { arweaveGatewayFromLocation, observerRelayFromLocation, prefersPermawebOsAo } from 'helpers/config';

import { aoFetch } from './ao';
import { ArweaveObserverNetwork } from './arweave-observers';
import {
	ARWEAVE_OBSERVER_HEALTHY_TARGET,
	ARWEAVE_OBSERVER_RELAY_ACCEPT,
	arweaveObserverNodes,
} from './observer-policy';

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

/**
 * Asks observers the page can reach itself directly (the selected gateway,
 * arweave.net by default) and sends only the ones it cannot (Arweave's own
 * clear-http nodes on an https page) through the AO peer's `~relay@1.0`. An AO
 * compute peer is not necessarily a relay: arweave.net does not serve the
 * device, and a node may admit only named hosts. Relaying every observer
 * through a peer that refuses left none reachable, so a posted transaction
 * was never seen and the watch timed out.
 */
export class GatewayFirstObserverTransport implements ObserverTransport {
	readonly #direct: DirectTransport;
	readonly #relay: RelayTransport | undefined;

	constructor(options: { fetch: typeof globalThis.fetch; relay?: string; pageProtocol?: string }) {
		this.#direct = new DirectTransport({ fetch: options.fetch, pageProtocol: options.pageProtocol });
		this.#relay = options.relay ? new RelayTransport(options.relay, { fetch: options.fetch }) : undefined;
	}

	canRequest(origin: string): boolean {
		return this.#direct.canRequest(origin) || this.#relay !== undefined;
	}

	get<T = unknown>(
		origin: string,
		path: string,
		options?: Omit<RequestOptions, 'fetch' | 'method'>
	): Promise<HttpResult<T>> {
		if (this.#direct.canRequest(origin) || !this.#relay) return this.#direct.get<T>(origin, path, options);
		return this.#relay.get<T>(origin, path, { ...options, accept: ARWEAVE_OBSERVER_RELAY_ACCEPT });
	}
}

/**
 * Observer discovery options. On a PermawebOS host the network policy assigns
 * the observer relay (falling back to the serving peer before a wallet
 * connects) and all observer traffic goes through it, failing closed without
 * one. Elsewhere observers are the selected gateway plus Arweave's own nodes,
 * asked through {@link GatewayFirstObserverTransport}: without a relay-capable
 * AO peer only the gateway is reachable, which cannot form a quorum, and the
 * watch says so (see `observerQuorumUnavailable`).
 */
export function assetObserverNetworkOptions(location: Location = window.location): WeaveNetworkOptions {
	const relay = observerRelayFromLocation(location);
	const base = {
		node: arweaveGatewayFromLocation(location),
		minObservers: 3,
		syncTolerance: 2,
		maxObservers: ARWEAVE_OBSERVER_HEALTHY_TARGET,
	};
	if (prefersPermawebOsAo(location)) {
		if (!relay) throw new Error('No AO peer is configured.');
		return { ...base, fetch: aoFetch(), 'relay-with': relay };
	}
	const fetch: typeof globalThis.fetch = (input, init) => globalThis.fetch(input, init);
	return {
		...base,
		seeds: arweaveObserverNodes(),
		// `/peers` lists bare `ip:port` miners: clear http, so unreachable from an
		// https page without a relay, and refused by a relay that admits only
		// named hosts. Probing them would only spend relay requests.
		spider: false,
		fetch,
		transport: new GatewayFirstObserverTransport({
			fetch,
			relay: relay || undefined,
			pageProtocol: location.protocol,
		}),
	};
}

function observerNetworkKey(options: WeaveNetworkOptions, relay: string): string {
	return JSON.stringify([
		relay,
		...Object.entries(options)
			.filter(([key, value]) => key !== 'ao' && key !== 'fetch' && key !== 'transport' && value !== undefined)
			.sort(([left], [right]) => left.localeCompare(right)),
	]);
}

/**
 * Shares observer discovery and transport between active operations using the
 * same selected gateway. Each operation retains its own transaction watcher
 * and releases only its lease when it finishes.
 */
export function acquireAssetObserverNetwork(location: Location = window.location): AssetObserverNetworkLease {
	const options = assetObserverNetworkOptions(location);
	const key = observerNetworkKey(options, observerRelayFromLocation(location));
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
