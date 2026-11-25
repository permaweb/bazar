import { createConcurrencyLimit } from 'helpers/concurrency';

import { operationWithDeadline } from './fetch-with-deadline';
import {
	GRAPHQL_RETRY_DELAYS_MS,
	graphqlIdBatchSize,
	isArweaveNetEndpoint,
	postGraphql,
	retryTransientGraphql,
	usableGraphqlPayload,
} from './graphql';

export type IndexedTransaction = { cursor: string; node: { id: string } };
export type TransactionBlock = { height: number; timestamp: number };
export type TransactionIndexFilters = {
	tags: Array<{ name: string; values: string[] }>;
	owners?: string[];
	recipients?: string[] | null;
};
export type TransactionIndexPage = {
	edges: readonly unknown[];
	after: string | null;
	filters: TransactionIndexFilters;
};
type BlockResult = TransactionBlock | null;
type BlockEdge = { cursor?: string; node?: { id?: string; block?: BlockResult } };
type BlockResponse = {
	data?: Record<string, { edges?: BlockEdge[] }>;
};

const BLOCK_QUERY = `query TransactionBlocks($ids: [ID!]!, $first: Int!) {
	transactions(ids: $ids, first: $first, sort: HEIGHT_DESC) {
		edges { cursor node { id block { height timestamp } } }
	}
}`;
const PLACEMENT_QUERY = `query TransactionBlockPlacements(
	$after: String, $first: Int!, $tags: [TagFilter!]!, $owners: [String!], $recipients: [String!]
) {
	transactions(after: $after, first: $first, sort: HEIGHT_DESC, tags: $tags, owners: $owners, recipients: $recipients) {
		edges { cursor node { id block { height timestamp } } }
	}
}`;
const CACHE_LIMIT = 4_096;
const CACHE_RECENT_MS = 60_000;
const CACHE_SETTLED_MS = 30 * 60_000;
const BLOCK_BATCH_SIZE = 24;
const ARWEAVE_NET_FILTERS_PER_REQUEST = 3;
const BLOCK_RETRY_DELAYS_MS = GRAPHQL_RETRY_DELAYS_MS.slice(0, 1);
const runBlockLookup = createConcurrencyLimit(2);
const caches = new WeakMap<typeof fetch, Map<string, { block: TransactionBlock; until: number }>>();

/** arweave.net's scan uses member keys, while an exact-ID read uses offset cursors. */
function position(cursor: string | undefined, id: string): string | undefined {
	if (typeof cursor !== 'string') return undefined;
	if (cursor === `pending=${id}` || cursor.startsWith(`member=infinity${id}`)) return 'pending';
	if (cursor === `ephemeral=${id}` || cursor.startsWith(`member=-1${id}`)) return 'unindexed';
	const member = /^member=(\d{20})(?:([\w-]{43})\S*)?$/.exec(cursor);
	const offset = /^offset=(\d+)(?:-\d+)?$/.exec(cursor);
	const digits = member && (!member[2] || member[2] === id) ? member[1] : offset?.[1];
	return digits === undefined ? undefined : BigInt(digits).toString();
}

/** A matched weave position can bound the following pages of a descending index scan. */
export function arweaveTransactionOffset(endpoint: string, { cursor, node }: IndexedTransaction): bigint | undefined {
	const matched = isArweaveNetEndpoint(endpoint) ? position(cursor, node.id) : undefined;
	if (matched === undefined || matched === 'pending' || matched === 'unindexed') return undefined;
	return BigInt(matched);
}

function validBlock(block: BlockResult | undefined): block is BlockResult {
	if (block === null) return true;
	return (
		block !== undefined &&
		Number.isSafeInteger(block.height) &&
		block.height >= 0 &&
		Number.isSafeInteger(block.timestamp) &&
		block.timestamp >= 0
	);
}

function sameBlock(left: BlockResult, right: BlockResult): boolean {
	return left?.height === right?.height && left?.timestamp === right?.timestamp;
}

function blockRequest(ids: string[], filterSize: number) {
	if (ids.length <= filterSize) {
		return { aliases: ['transactions'], query: BLOCK_QUERY, variables: { ids, first: filterSize } };
	}
	// Keep each filter inside the gateway's ID cap while sharing one HTTP request.
	const index = Array.from({ length: Math.ceil(ids.length / filterSize) }, (_, i) => i);
	const aliases = index.map((i) => `batch${i}`);
	const filters = index.map((i) => `$ids${i}: [ID!]!`).join(', ');
	const fields = index.map(
		(i) => `${aliases[i]}: transactions(ids: $ids${i}, first: $first, sort: HEIGHT_DESC) {
		edges { cursor node { id block { height timestamp } } }
	}`
	);
	const variables = Object.fromEntries(
		index.map((i) => [`ids${i}`, ids.slice(i * filterSize, (i + 1) * filterSize)])
	);
	return {
		aliases,
		query: `query TransactionBlocks(${filters}, $first: Int!) { ${fields.join('\n')} }`,
		variables: { ...variables, first: filterSize },
	};
}

type BlockReadOptions = {
	signal?: AbortSignal;
	requestTimeoutMs?: number;
	priority?: RequestPriority;
	indexPages?: readonly TransactionIndexPage[];
};

async function readBlockConnections(
	fetcher: typeof fetch,
	endpoint: string,
	{ aliases, query, variables }: { aliases: string[]; query: string; variables: object },
	options: BlockReadOptions
) {
	const deadline = { timeoutMs: options.requestTimeoutMs, timeoutError: 'transaction-blocks-timeout' };
	const request: RequestInit = {
		method: 'POST',
		priority: options.priority,
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ query, variables }),
	};
	const lookup = await retryTransientGraphql(
		() =>
			operationWithDeadline(
				(signal) =>
					runBlockLookup(() =>
						postGraphql<BlockResponse>(fetcher, [endpoint], { ...request, signal }, deadline)
					),
				options.signal,
				deadline
			),
		BLOCK_RETRY_DELAYS_MS,
		options.signal
	);
	if (!lookup.response.ok) throw new Error(`transaction-blocks-${lookup.response.status}`);
	if (!usableGraphqlPayload(lookup)) throw new Error('transaction-blocks-schema');
	return aliases.flatMap((alias) => {
		const rows = lookup.body?.data?.[alias]?.edges;
		if (!Array.isArray(rows)) throw new Error('transaction-blocks-schema');
		return rows;
	});
}

function consistentBlock(rows: BlockEdge[], matches: (row: BlockEdge) => boolean): BlockResult | undefined {
	const blocks = rows.flatMap((row) => {
		const block = row?.node?.block;
		return row && matches(row) && validBlock(block) ? [block] : [];
	});
	const block = blocks[0];
	if (block === undefined || blocks.some((candidate) => !sameBlock(candidate, block))) return undefined;
	return block && { height: block.height, timestamp: block.timestamp };
}

function indexCursor(edge: unknown): string | undefined {
	if (!edge || typeof edge !== 'object' || !('cursor' in edge)) return undefined;
	return typeof edge.cursor === 'string' && edge.cursor ? edge.cursor : undefined;
}

/** The exact-ID index can collapse repeated inclusions. Recover through short windows in the original scan. */
async function recoverPlacements<Edge extends IndexedTransaction>(
	fetcher: typeof fetch,
	endpoint: string,
	unresolved: Set<Edge>,
	windowSize: number,
	options: BlockReadOptions
): Promise<Map<Edge, BlockResult>> {
	const recovered = new Map<Edge, BlockResult>();
	const wanted = new Map<unknown, Edge>([...unresolved].map((edge) => [edge, edge]));
	for (const page of options.indexPages ?? []) {
		let after = page.after;
		for (let index = 0; index < page.edges.length; index += 1) {
			const entry = page.edges[index];
			if (wanted.has(entry)) {
				const targets: Array<{ edge: Edge; count: number }> = [];
				for (let end = index; end < Math.min(index + windowSize, page.edges.length); end += 1) {
					const edge = wanted.get(page.edges[end]);
					if (edge) targets.push({ edge, count: end - index + 1 });
				}
				const first = targets.at(-1)!.count;
				const rows = await readBlockConnections(
					fetcher,
					endpoint,
					{
						aliases: ['transactions'],
						query: PLACEMENT_QUERY,
						variables: { ...page.filters, after, first },
					},
					options
				);
				for (const { edge } of targets) {
					const block = consistentBlock(
						rows,
						(row) => row.cursor === edge.cursor && row.node?.id === edge.node.id
					);
					if (block !== undefined) recovered.set(edge, block);
					wanted.delete(edge);
				}
				index += first - 1;
			}
			after = indexCursor(page.edges[index]) ?? after;
		}
	}
	return recovered;
}

/** Read only the placements a caller needs. Unknown metadata fails the read; null is explicit. */
export async function readTransactionBlocks<Edge extends IndexedTransaction>(
	fetcher: typeof fetch,
	endpoint: string,
	edges: readonly Edge[],
	options: BlockReadOptions = {}
): Promise<Map<Edge, BlockResult>> {
	options.signal?.throwIfAborted();
	const results = new Map<Edge, BlockResult>();
	if (!edges.length) return results;
	const native = isArweaveNetEndpoint(endpoint);
	const cache = caches.get(fetcher) ?? new Map<string, { block: TransactionBlock; until: number }>();
	caches.set(fetcher, cache);
	const keyFor = ({ cursor, node }: Edge) => JSON.stringify([endpoint, node.id, cursor]);
	const rememberBlock = (edge: Edge, block: BlockResult) => {
		results.set(edge, block);
		if (!block) return;
		const key = keyFor(edge);
		const now = Date.now();
		const settled = now - block.timestamp * 1_000 >= 24 * 60 * 60_000;
		cache.delete(key);
		cache.set(key, { block, until: now + (settled ? CACHE_SETTLED_MS : CACHE_RECENT_MS) });
		if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
	};
	const needed = new Map<string, Edge[]>();
	for (const edge of edges) {
		const { id } = edge.node;
		const key = keyFor(edge);
		const knownPosition = native ? position(edge.cursor, id) : undefined;
		const cached = cache.get(key);
		if (knownPosition === 'pending' || knownPosition === 'unindexed') results.set(edge, null);
		else if (cached && cached.until > Date.now()) results.set(edge, cached.block);
		else if (needed.has(id)) needed.get(id)!.push(edge);
		else needed.set(id, [edge]);
	}
	const ids = [...needed.keys()];
	const filterSize = graphqlIdBatchSize([endpoint], BLOCK_BATCH_SIZE);
	const requestSize = native ? filterSize * ARWEAVE_NET_FILTERS_PER_REQUEST : filterSize;
	const unresolved = new Set<Edge>();
	for (let offset = 0; offset < ids.length; offset += requestSize) {
		const batch = ids.slice(offset, offset + requestSize);
		const returned = await readBlockConnections(fetcher, endpoint, blockRequest(batch, filterSize), options);
		for (const id of batch) {
			for (const edge of needed.get(id)!) {
				const knownPosition = native ? position(edge.cursor, id) : undefined;
				const block = consistentBlock(
					returned,
					({ cursor, node }) =>
						node?.id === id &&
						(knownPosition === undefined ? cursor === edge.cursor : position(cursor, id) === knownPosition)
				);
				if (block === undefined || (block === null && knownPosition !== undefined)) unresolved.add(edge);
				else rememberBlock(edge, block);
			}
		}
	}
	if (unresolved.size) {
		const recovered = await recoverPlacements(fetcher, endpoint, unresolved, filterSize, options);
		if (recovered.size !== unresolved.size) throw new Error('transaction-blocks-incomplete');
		for (const [edge, block] of recovered) rememberBlock(edge, block);
	}
	return results;
}
