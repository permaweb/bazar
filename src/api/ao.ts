import { ao, type AoCacheMetadata, type AoCacheStatus, type AoClient, cacheMetadata, createAo } from 'ao.js';

import {
	arweaveGatewayFromLocation,
	type EffectivePermawebNetworkPolicy,
	fallbackAoPeersFromLocation,
	gatewaysFromLocation,
	loadPermawebOsNetworkPolicy,
	PRODUCTION_COMPUTE_GATEWAYS,
	usesPermawebOsAo,
} from 'helpers/config';

export type { AoCacheMetadata, AoCacheStatus };

type Nodes = string | readonly string[];

export type AoPeerFetch = typeof fetch & {
	invalidate(input: RequestInfo | URL, init?: RequestInit): Promise<void>;
	cacheMetadata(response: Response): AoCacheMetadata | undefined;
	readonly peers: readonly string[];
	ready(): Promise<readonly string[]>;
	allowNotFound?(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
	networkPolicy?(): Promise<EffectivePermawebNetworkPolicy>;
};

type BazarAoPeerFetch = AoPeerFetch & {
	allowNotFound(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
	networkPolicy(): Promise<EffectivePermawebNetworkPolicy>;
};

let bazarTransport: { peers: string; fetcher: BazarAoPeerFetch } | undefined;

function nodeList(nodes?: Nodes): string[] {
	return typeof nodes === 'string' ? [nodes] : [...(nodes ?? [])];
}

function permawebOsAoFetch(): AoPeerFetch | undefined {
	return usesPermawebOsAo() ? globalThis.window?.aoFetch : undefined;
}

function directAoFetch(): BazarAoPeerFetch {
	const peers = fallbackAoPeersFromLocation();
	const signature = peers.join('\n');
	if (bazarTransport?.peers !== signature) {
		bazarTransport = { peers: signature, fetcher: createBazarAoFetch(peers) };
	}
	return bazarTransport.fetcher;
}

export function aoClient(nodes?: Nodes): AoClient {
	const peers = nodeList(nodes ?? fallbackAoPeersFromLocation());
	return ao(peerConfig(peers, 'discover'));
}

export function createBazarAoFetch(nodes: Nodes, override?: typeof fetch): BazarAoPeerFetch {
	const peers = Object.freeze(nodeList(nodes));
	const client = override ? createAo(peerConfig(peers, false), override) : aoClient(peers);
	const origins = new Set(peers.map((peer) => new URL(peer).origin));
	const routed = ((input, init) => client.fetch(routeDefaultPeerRequest(input, origins), init)) as BazarAoPeerFetch;
	let readiness: Promise<readonly string[]> | undefined;
	routed.invalidate = (input, init) => client.invalidate(routeDefaultPeerRequest(input, origins), init);
	routed.allowNotFound = (input, init) =>
		client.request(
			{
				path: requestPath(routeDefaultPeerRequest(input, origins)),
				method: init?.method ?? 'GET',
				'multirequest-admissible-status': [200, 201, 202, 204, 206, 304, 404],
			},
			init
		);
	routed.cacheMetadata = cacheMetadata;
	Object.defineProperty(routed, 'peers', { value: peers });
	routed.networkPolicy = async () => directNetworkPolicy(peers);
	routed.ready = () => {
		readiness ??= client
			.warm()
			.catch(() => undefined)
			.then(() => peers);
		return readiness;
	};
	return routed;
}

export function aoFetch(override?: typeof fetch): AoPeerFetch | typeof fetch {
	return override ?? permawebOsAoFetch() ?? directAoFetch();
}

export function aoPeers(): string[] {
	return gatewaysFromLocation();
}

export function aoPrimaryPeer(): string {
	return aoPeers()[0] ?? '';
}

export function aoCacheMetadata(response: Response): AoCacheMetadata | undefined {
	const readPermawebOsMetadata = permawebOsAoFetch()?.cacheMetadata;
	return (
		(typeof readPermawebOsMetadata === 'function' ? readPermawebOsMetadata(response) : undefined) ??
		cacheMetadata(response)
	);
}

export async function readyAoFetch(): Promise<readonly string[]> {
	const fetcher = permawebOsAoFetch() ?? directAoFetch();
	const currentPeers = Array.isArray(fetcher.peers)
		? fetcher.peers.filter((peer): peer is string => typeof peer === 'string')
		: [];
	if (typeof fetcher.ready !== 'function') return currentPeers;
	try {
		const peers = await fetcher.ready();
		return Array.isArray(peers) ? peers.filter((peer): peer is string => typeof peer === 'string') : currentPeers;
	} catch {
		return currentPeers;
	}
}

/** Start transport discovery without making otherwise independent application data wait for it. */
export function warmAoFetch(onNetworkPolicy?: () => void): void {
	void readyAoFetch().catch(() => undefined);
	if (permawebOsAoFetch()) {
		void loadPermawebOsNetworkPolicy().then((policy) => {
			if (policy) onNetworkPolicy?.();
		});
	}
}

function directNetworkPolicy(peers: readonly string[]): EffectivePermawebNetworkPolicy {
	const gateway = arweaveGatewayFromLocation();
	const provider = (url: string) => ({
		url,
		ownership: (PRODUCTION_COMPUTE_GATEWAYS as readonly string[]).includes(url)
			? ('default' as const)
			: ('community' as const),
	});
	const readProviders = peers.map(provider);
	const primary = readProviders[0];
	const arweave = { url: gateway, ownership: 'default' as const };
	return {
		version: 1,
		arweaveGateway: arweave,
		permanentContent: arweave,
		publishing: arweave,
		ao: {
			processReads: readProviders,
			scheduleReads: readProviders,
			linkedStateReads: readProviders,
			...(primary ? { observerRelay: primary, scheduleWrite: primary, directWrite: primary } : {}),
			fallbackMode: 'hosted',
		},
	};
}

function peerConfig(peers: readonly string[], rateLimit: 'discover' | false) {
	const nodes = peers.map((prefix) => ({ prefix, 'rate-limit': rateLimit } as const));
	const readRoute = (method: 'GET' | 'HEAD') => ({
		template: { method },
		nodes,
		strategy: 'By-Base' as const,
		choose: nodes.length,
		'admissible-status': [200, 201, 202, 204, 206, 304],
		'fallback-on-cooldown': true,
	});
	return {
		nodes,
		requestTimeoutMs: 4_000,
		...(nodes.length
			? {
					routes: [
						readRoute('GET'),
						readRoute('HEAD'),
						{ template: '*', nodes, strategy: 'By-Base' as const, choose: nodes.length },
					],
			  }
			: {}),
	};
}

function requestPath(input: RequestInfo | URL): string {
	return typeof input === 'string' || input instanceof URL ? String(input) : input.url;
}

function routeDefaultPeerRequest(input: RequestInfo | URL, origins: ReadonlySet<string>): RequestInfo | URL {
	if (input instanceof Request) return input;
	try {
		const url = new URL(String(input));
		return origins.has(url.origin) ? `${url.pathname}${url.search}${url.hash}` : input;
	} catch {
		return input;
	}
}
