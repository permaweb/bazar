import { aoWrangler, type AoWranglerClient, createAoWrangler } from 'ao-wrangler';

export function aoClient(node?: string): AoWranglerClient {
	return aoWrangler(node ? { nodes: [{ url: node, rateLimit: 'discover' }] } : {});
}

export function aoFetch(node: string, override?: typeof fetch): typeof fetch {
	if (override) return createAoWrangler({}, override).fetch;
	return aoClient(node).fetch;
}
