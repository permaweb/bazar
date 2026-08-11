import { aoWrangler, type AoWranglerClient, createAoWrangler, type RateLimit } from 'ao-wrangler';

type Nodes = string | readonly string[];

function nodeList(nodes?: Nodes): string[] {
	return typeof nodes === 'string' ? [nodes] : [...(nodes ?? [])];
}

export function aoClient(nodes?: Nodes): AoWranglerClient {
	const peers = nodeList(nodes);
	return aoWrangler({
		nodes: peers.map((prefix) => ({ prefix, 'rate-limit': 'discover' })),
	});
}

export function aoFetch(nodes: Nodes, override?: typeof fetch): typeof fetch {
	const peers = nodeList(nodes);
	const client = override
		? createAoWrangler({ nodes: peers.map((prefix) => ({ prefix, 'rate-limit': false })) }, override)
		: aoClient(peers);
	return routedClientFetch(client, peers);
}

export function createAoFetch(nodes: Nodes, rateLimit: RateLimit, override?: typeof fetch): typeof fetch {
	const peers = nodeList(nodes);
	const client = createAoWrangler({ nodes: peers.map((prefix) => ({ prefix, 'rate-limit': rateLimit })) }, override);
	return routedClientFetch(client, peers);
}

function routedClientFetch(client: AoWranglerClient, peers: string[]): typeof fetch {
	const origins = new Set(peers.map((peer) => new URL(peer).origin));
	return (input, init) => client.fetch(routeDefaultPeerRequest(input, origins), init);
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
