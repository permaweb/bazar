import { aoWrangler, type AoWranglerClient, createAoWrangler, type RateLimit } from 'ao-wrangler';

type Nodes = string | readonly string[];

export type AoPeerFetch = typeof fetch & {
	invalidate(input: RequestInfo | URL, init?: RequestInit): Promise<void>;
};

function nodeList(nodes?: Nodes): string[] {
	return typeof nodes === 'string' ? [nodes] : [...(nodes ?? [])];
}

export function aoClient(nodes?: Nodes): AoWranglerClient {
	const peers = nodeList(nodes);
	return aoWrangler(peerConfig(peers, 'discover'));
}

export function aoFetch(nodes: Nodes, override?: typeof fetch): AoPeerFetch {
	const peers = nodeList(nodes);
	const client = override ? createAoWrangler(peerConfig(peers, false), override) : aoClient(peers);
	return routedClientFetch(client, peers);
}

export function createAoFetch(nodes: Nodes, rateLimit: RateLimit, override?: typeof fetch): AoPeerFetch {
	const peers = nodeList(nodes);
	const client = createAoWrangler(peerConfig(peers, rateLimit), override);
	return routedClientFetch(client, peers);
}

function routedClientFetch(client: AoWranglerClient, peers: string[]): AoPeerFetch {
	const origins = new Set(peers.map((peer) => new URL(peer).origin));
	const routed = ((input, init) => client.fetch(routeDefaultPeerRequest(input, origins), init)) as AoPeerFetch;
	routed.invalidate = (input, init) => client.invalidate(routeDefaultPeerRequest(input, origins), init);
	return routed;
}

function peerConfig(peers: string[], rateLimit: RateLimit) {
	const nodes = peers.map((prefix) => ({ prefix, 'rate-limit': rateLimit } as const));
	const readRoute = (method: 'GET' | 'HEAD') => ({
		template: { method },
		nodes,
		strategy: 'By-Base' as const,
		choose: nodes.length,
		'admissible-status': [200, 201, 202, 204, 206, 304],
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

function routeDefaultPeerRequest(input: RequestInfo | URL, origins: ReadonlySet<string>): RequestInfo | URL {
	if (input instanceof Request) return input;
	try {
		const url = new URL(String(input));
		return origins.has(url.origin) ? `${url.pathname}${url.search}${url.hash}` : input;
	} catch {
		return input;
	}
}
