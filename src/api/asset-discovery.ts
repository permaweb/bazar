import { collectionAsset, type AssetSummary, type Collection } from './collections';
import { PAGINATED_GRAPHQL } from 'helpers/config';
import {
  liveOrderOfAsset,
  listedBalanceOf,
  liquidBalanceOf,
  readAssetState,
  type AssetState,
  type ComputeResult,
} from './asset-marketplace';
import { fetchJsonWithDeadline } from './fetch-with-deadline';

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const GRAPHQL_PAGE_SIZE = 100;
const GRAPHQL_ID_BATCH_SIZE = 100;
const ARWEAVE_GRAPHQL_ID_BATCH_SIZE = 9;
const MAX_GRAPHQL_PAGES = 1_000;
const WALLET_HEAD_CATCH_UP_PAGES_PER_PASS = 20;
const ASSET_SUPPORT_CONCURRENCY = 2;
export const ASSET_RESOLUTION_CONCURRENCY = 8;

export type AssetCandidate = {
  processId: string;
  height: number;
  timestamp: number;
  activityIds?: string[];
  sources: Array<'initial-holder' | 'market-action' | 'transfer'>;
  device?: string;
  collection?: string;
  processDevice?: string;
  assetType?: string;
  swapDevice?: string;
  schedulerDevice?: string;
  schedulerMode?: string;
};

export type ResolvedAsset = {
  asset: AssetSummary;
  collection: Collection;
  state: AssetState;
  provider: string;
  activity: AssetCandidate;
};

export type AssetCandidateSupportResult = {
  supported: AssetCandidate[];
  unavailable: Array<{ candidate: AssetCandidate; error: unknown }>;
};

export type CollectionActivityEvent = {
  id: string;
  processId: string;
  action: 'make-offer' | 'register-interest' | 'transfer' | 'cancel-order';
  actor: string;
  height: number;
  timestamp: number;
  asking?: string;
  quantity?: string;
  orderId?: string;
  recipient?: string;
};

type GraphqlNode = {
  id: string;
  recipient?: string;
  tags?: Array<{ name: string; value: string }>;
  owner?: { address?: string };
  block?: { height?: number; timestamp?: number };
};

type GraphqlEdge = { cursor: string; node: GraphqlNode };
type GraphqlConnection = {
  pageInfo: { hasNextPage: boolean };
  edges: GraphqlEdge[];
};

type CandidateOptions = {
  fetch?: typeof fetch;
  signal?: AbortSignal;
  graphql?: string;
  requestTimeoutMs?: number;
  onPage?: (candidates: AssetCandidate[]) => void | Promise<void>;
};

export type WalletCandidateAlias = 'initiallyHeld' | 'marketActions' | 'receivedTransfers';

export type WalletCandidateScan = {
  address: string;
  graphql: string;
  active: Set<WalletCandidateAlias>;
  cursors: Record<WalletCandidateAlias, string | null>;
  visited: Record<WalletCandidateAlias, Set<string>>;
  found: Map<string, AssetCandidate>;
  heads: Record<WalletCandidateAlias, string | null | undefined>;
  catchUp?: {
    active: Set<WalletCandidateAlias>;
    cursors: Record<WalletCandidateAlias, string | null>;
    visited: Record<WalletCandidateAlias, Set<string>>;
    watermarks: Record<WalletCandidateAlias, string | null>;
    newHeads: Record<WalletCandidateAlias, string | null | undefined>;
  };
  caughtUp: boolean;
};

type WalletCandidateOptions = CandidateOptions & {
  scan?: WalletCandidateScan;
  catchUp?: boolean;
};

type MarketActivityOptions = CandidateOptions & {
  recipients?: string[];
  listingsOnly?: boolean;
  acceptProcessId?: (processId: string) => boolean;
};

type BatchedMarketActivityOptions = Omit<MarketActivityOptions, 'onPage' | 'recipients'> & {
  recipients: string[];
  batchSize?: number;
  concurrency?: number;
  onBatch?: (candidates: AssetCandidate[], recipients: string[]) => void | Promise<void>;
};

type CollectionActivityOptions = Omit<CandidateOptions, 'onPage'> & {
  recipients?: string[];
  limit?: number;
  acceptProcessId?: (processId: string) => boolean;
  requiredExecutionDevice?: string;
  onPage?: (events: CollectionActivityEvent[]) => void | Promise<void>;
};

type BatchedCollectionActivityOptions = Omit<CollectionActivityOptions, 'onPage' | 'recipients'> & {
  recipients: string[];
  batchSize?: number;
  concurrency?: number;
  onBatch?: (events: CollectionActivityEvent[], recipients: string[]) => void | Promise<void>;
};

type ResolutionOptions = {
  signal?: AbortSignal;
  concurrency?: number;
  read?: (processId: string, signal?: AbortSignal) => Promise<ComputeResult>;
  onSettled?: (result: ResolvedAsset | null, candidate: AssetCandidate, error?: unknown) => void;
};

const WALLET_CANDIDATES_QUERY = `query WalletAssetCandidates(
	$initialCursor: String
	$marketCursor: String
	$transferCursor: String
	$includeInitial: Boolean!
	$includeMarket: Boolean!
	$includeTransfers: Boolean!
	$owners: [String!]!
	$initialTags: [TagFilter!]!
	$marketTags: [TagFilter!]!
	$transferTags: [TagFilter!]!
) {
	initiallyHeld: transactions(
		first: ${GRAPHQL_PAGE_SIZE}
		after: $initialCursor
		sort: HEIGHT_DESC
		tags: $initialTags
	) @include(if: $includeInitial) {
		pageInfo { hasNextPage }
		edges {
			cursor
			node { id recipient tags { name value } owner { address } block { height timestamp } }
		}
	}
	marketActions: transactions(
		first: ${GRAPHQL_PAGE_SIZE}
		after: $marketCursor
		sort: HEIGHT_DESC
		owners: $owners
		tags: $marketTags
	) @include(if: $includeMarket) {
		pageInfo { hasNextPage }
		edges {
			cursor
			node { id recipient tags { name value } owner { address } block { height timestamp } }
		}
	}
	receivedTransfers: transactions(
		first: ${GRAPHQL_PAGE_SIZE}
		after: $transferCursor
		sort: HEIGHT_DESC
		tags: $transferTags
	) @include(if: $includeTransfers) {
		pageInfo { hasNextPage }
		edges {
			cursor
			node { id recipient tags { name value } owner { address } block { height timestamp } }
		}
	}
}`;

const MARKET_ACTIVITY_QUERY = `query AssetMarketActivity(
	$cursor: String
	$recipients: [String!]
	$tags: [TagFilter!]!
) {
	transactions(
		first: ${GRAPHQL_PAGE_SIZE}
		after: $cursor
		sort: HEIGHT_DESC
		recipients: $recipients
		tags: $tags
	) {
		pageInfo { hasNextPage }
		edges {
			cursor
			node { id recipient tags { name value } owner { address } block { height timestamp } }
		}
	}
}`;

const VERIFY_PROCESS_DEVICES_QUERY = `query VerifyAssetProcesses(
	$cursor: String
	$ids: [ID!]!
	$devices: [String!]!
) {
	transactions(
		first: ${GRAPHQL_PAGE_SIZE}
		after: $cursor
		ids: $ids
		tags: [{ name: "execution-device", values: $devices }]
	) {
		pageInfo { hasNextPage }
		edges { cursor node { id } }
	}
}`;

const VERIFY_FUNGIBLE_PROCESSES_QUERY = `query VerifyFungibleProcesses(
	$cursor: String
	$ids: [ID!]!
) {
	transactions(
		first: ${GRAPHQL_PAGE_SIZE}
		after: $cursor
		ids: $ids
		tags: [
			{ name: "device", values: ["process@1.0"] }
			{ name: "execution-device", values: ["token@1.0"] }
			{ name: "swap-device", values: ["arweave-swap@1.0"] }
			{ name: "scheduler-device", values: ["arweave-scheduler@1.0"] }
			{ name: "asset-type", values: ["fungible"] }
			{ name: "scheduler-mode", values: ["all"] }
		]
	) {
		pageInfo { hasNextPage }
		edges { cursor node { id } }
	}
}`;

export function createWalletCandidateScan(address: string, graphql = PAGINATED_GRAPHQL): WalletCandidateScan {
  if (!ADDRESS.test(address)) throw new TypeError('invalid-wallet-address');
  return {
    address,
    graphql,
    active: new Set<WalletCandidateAlias>(['initiallyHeld', 'marketActions', 'receivedTransfers']),
    cursors: { initiallyHeld: null, marketActions: null, receivedTransfers: null },
    visited: {
      initiallyHeld: new Set(),
      marketActions: new Set(),
      receivedTransfers: new Set(),
    },
    found: new Map(),
    heads: { initiallyHeld: undefined, marketActions: undefined, receivedTransfers: undefined },
    caughtUp: false,
  };
}

export async function discoverWalletAssetCandidates(
  address: string,
  options: WalletCandidateOptions = {},
): Promise<AssetCandidate[]> {
  if (!ADDRESS.test(address)) throw new TypeError('invalid-wallet-address');
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const graphql = options.graphql ?? PAGINATED_GRAPHQL;
  const scan = options.scan ?? createWalletCandidateScan(address, graphql);
  if (scan.address !== address || scan.graphql !== graphql) {
    throw new TypeError('wallet-candidate-scan-scope-mismatch');
  }
  const requestPage = async (
    active: Set<WalletCandidateAlias>,
    cursors: Record<WalletCandidateAlias, string | null>,
  ) => {
    const requestedAliases = [...active];
    const { response, body: payload } = await fetchJsonWithDeadline<any>(
      fetcher,
      graphql,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: WALLET_CANDIDATES_QUERY,
          variables: {
            initialCursor: cursors.initiallyHeld,
            marketCursor: cursors.marketActions,
            transferCursor: cursors.receivedTransfers,
            includeInitial: active.has('initiallyHeld'),
            includeMarket: active.has('marketActions'),
            includeTransfers: active.has('receivedTransfers'),
            owners: [address],
            initialTags: [{ name: 'initial-holder', values: [address] }],
            marketTags: [{ name: 'action', values: ['register-interest', 'make-offer'] }],
            transferTags: [
              { name: 'action', values: ['transfer'] },
              { name: 'recipient', values: [address] },
            ],
          },
        }),
        signal: options.signal,
      },
      {
        timeoutMs: options.requestTimeoutMs,
        timeoutError: 'asset-discovery-graphql-timeout',
      },
    );
    if (!response.ok) throw new Error(`asset-discovery-graphql-${response.status}`);
    if (!payload) throw new Error('asset-discovery-graphql-empty');
    if (payload?.errors?.length) throw new Error('asset-discovery-graphql-error');
    return {
      requestedAliases,
      connections: new Map(
        requestedAliases.map((alias) => [
          alias,
          decodeGraphqlConnection(payload, alias, 'asset-discovery-graphql-schema'),
        ]),
      ),
    };
  };
  const pageUpdates = (
    requestedAliases: WalletCandidateAlias[],
    connections: Map<WalletCandidateAlias, GraphqlConnection>,
  ) => {
    const processIds = new Set<string>();
    const updates = new Map<string, AssetCandidate>();
    for (const alias of requestedAliases) {
      for (const edge of connections.get(alias)!.edges) {
        const candidate =
          alias === 'initiallyHeld'
            ? candidateFromNode(edge.node, 'initial-holder', address, false)
            : alias === 'marketActions'
              ? candidateFromNode(edge.node, 'market-action', address, true)
              : candidateFromNode(edge.node, 'transfer', address, false);
        if (!candidate) continue;
        if (!updates.has(candidate.processId)) {
          const existing = scan.found.get(candidate.processId);
          if (existing) updates.set(candidate.processId, existing);
        }
        mergeCandidate(updates, candidate);
        processIds.add(candidate.processId);
      }
    }
    return { processIds, updates };
  };

  while (scan.active.size) {
    options.signal?.throwIfAborted();
    const { requestedAliases, connections } = await requestPage(scan.active, scan.cursors);
    const nextActive = new Set(scan.active);
    const nextCursors = { ...scan.cursors };
    const nextVisited = {
      initiallyHeld: new Set(scan.visited.initiallyHeld),
      marketActions: new Set(scan.visited.marketActions),
      receivedTransfers: new Set(scan.visited.receivedTransfers),
    };
    for (const alias of requestedAliases) {
      const connection = connections.get(alias)!;
      if (!connection.pageInfo.hasNextPage) {
        nextActive.delete(alias);
      } else {
        nextCursors[alias] = advanceGraphqlCursor(connection, nextVisited[alias], 'asset-discovery-pagination-stalled');
      }
    }

    const page = pageUpdates(requestedAliases, connections);
    await options.onPage?.(sortCandidates([...page.processIds].map((processId) => page.updates.get(processId)!)));
    options.signal?.throwIfAborted();
    for (const [processId, candidate] of page.updates) scan.found.set(processId, candidate);
    for (const alias of requestedAliases) {
      if (scan.heads[alias] === undefined) {
        scan.heads[alias] = connections.get(alias)!.edges[0]?.node.id ?? null;
      }
    }
    scan.active = nextActive;
    scan.cursors = nextCursors;
    scan.visited = nextVisited;
  }

  if (options.catchUp && !scan.caughtUp) {
    let pagesThisPass = 0;
    while (!scan.caughtUp) {
      if (!scan.catchUp) {
        scan.catchUp = {
          active: new Set<WalletCandidateAlias>(['initiallyHeld', 'marketActions', 'receivedTransfers']),
          cursors: { initiallyHeld: null, marketActions: null, receivedTransfers: null },
          visited: {
            initiallyHeld: new Set(),
            marketActions: new Set(),
            receivedTransfers: new Set(),
          },
          watermarks: {
            initiallyHeld: scan.heads.initiallyHeld ?? null,
            marketActions: scan.heads.marketActions ?? null,
            receivedTransfers: scan.heads.receivedTransfers ?? null,
          },
          newHeads: { initiallyHeld: undefined, marketActions: undefined, receivedTransfers: undefined },
        };
      }
      while (scan.catchUp.active.size) {
        options.signal?.throwIfAborted();
        if (pagesThisPass >= WALLET_HEAD_CATCH_UP_PAGES_PER_PASS) {
          throw new Error('asset-discovery-head-catch-up-incomplete');
        }
        pagesThisPass += 1;
        const catchUp = scan.catchUp;
        const { requestedAliases, connections } = await requestPage(catchUp.active, catchUp.cursors);
        const nextActive = new Set(catchUp.active);
        const nextCursors = { ...catchUp.cursors };
        const nextVisited = {
          initiallyHeld: new Set(catchUp.visited.initiallyHeld),
          marketActions: new Set(catchUp.visited.marketActions),
          receivedTransfers: new Set(catchUp.visited.receivedTransfers),
        };
        const nextHeads = { ...catchUp.newHeads };
        for (const alias of requestedAliases) {
          const connection = connections.get(alias)!;
          if (nextHeads[alias] === undefined) nextHeads[alias] = connection.edges[0]?.node.id ?? null;
          const watermark = catchUp.watermarks[alias];
          const reachedWatermark = watermark !== null && connection.edges.some(({ node }) => node.id === watermark);
          if (reachedWatermark || (watermark === null && !connection.pageInfo.hasNextPage)) {
            nextActive.delete(alias);
          } else if (!connection.pageInfo.hasNextPage) {
            throw new Error('asset-discovery-head-watermark-missing');
          } else {
            nextCursors[alias] = advanceGraphqlCursor(
              connection,
              nextVisited[alias],
              'asset-discovery-head-pagination-stalled',
            );
          }
        }
        const page = pageUpdates(requestedAliases, connections);
        await options.onPage?.(sortCandidates([...page.processIds].map((processId) => page.updates.get(processId)!)));
        options.signal?.throwIfAborted();
        for (const [processId, candidate] of page.updates) scan.found.set(processId, candidate);
        catchUp.active = nextActive;
        catchUp.cursors = nextCursors;
        catchUp.visited = nextVisited;
        catchUp.newHeads = nextHeads;
      }
      const aliases: WalletCandidateAlias[] = ['initiallyHeld', 'marketActions', 'receivedTransfers'];
      const stable = aliases.every((alias) => scan.catchUp!.newHeads[alias] === scan.catchUp!.watermarks[alias]);
      scan.heads = { ...scan.catchUp.newHeads };
      scan.catchUp = undefined;
      scan.caughtUp = stable;
    }
  }

  return sortCandidates([...scan.found.values()]);
}

export async function discoverMarketActivity(options: MarketActivityOptions = {}): Promise<AssetCandidate[]> {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const graphql = options.graphql ?? PAGINATED_GRAPHQL;
  const found = new Map<string, AssetCandidate>();
  const recipients = [...new Set((options.recipients ?? []).filter((id) => ADDRESS.test(id)))];
  let cursor: string | null = null;
  const visited = new Set<string>();

  while (true) {
    options.signal?.throwIfAborted();
    const { response, body: payload } = await fetchJsonWithDeadline<any>(
      fetcher,
      graphql,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: MARKET_ACTIVITY_QUERY,
          variables: {
            cursor,
            recipients: recipients.length ? recipients : null,
            tags: [
              {
                name: 'action',
                values: options.listingsOnly
                  ? ['make-offer']
                  : ['make-offer', 'register-interest', 'transfer', 'cancel-order'],
              },
            ],
          },
        }),
        signal: options.signal,
      },
      {
        timeoutMs: options.requestTimeoutMs,
        timeoutError: 'asset-activity-graphql-timeout',
      },
    );
    if (!response.ok) throw new Error(`asset-activity-graphql-${response.status}`);
    if (!payload) throw new Error('asset-activity-graphql-empty');
    if (payload?.errors?.length) throw new Error('asset-activity-graphql-error');
    const connection = decodeGraphqlConnection(payload, 'transactions', 'asset-activity-graphql-schema');
    const edges = connection.edges;
    const pageCandidates = edges.flatMap((edge) => {
      const candidate = candidateFromNode(edge.node, 'market-action');
      if (!candidate || (options.acceptProcessId && !options.acceptProcessId(candidate.processId))) return [];
      const firstOccurrence = !found.has(candidate.processId);
      mergeCandidate(found, candidate);
      return firstOccurrence ? [candidate] : [];
    });
    await options.onPage?.(sortCandidates(pageCandidates));
    if (!connection.pageInfo.hasNextPage) return sortCandidates([...found.values()]);
    cursor = advanceGraphqlCursor(connection, visited, 'asset-activity-pagination-stalled');
  }
}

export async function discoverMarketActivityBatched(options: BatchedMarketActivityOptions): Promise<AssetCandidate[]> {
  const recipients = [...new Set(options.recipients.filter((id) => ADDRESS.test(id)))];
  const batchSize = Math.max(1, Math.min(100, Math.floor(options.batchSize ?? 100)));
  const concurrency = Math.max(1, Math.min(4, Math.floor(options.concurrency ?? 2)));
  const batches = Array.from({ length: Math.ceil(recipients.length / batchSize) }, (_, index) =>
    recipients.slice(index * batchSize, (index + 1) * batchSize),
  );
  const found = new Map<string, AssetCandidate>();
  let nextBatch = 0;
  const failures: unknown[] = [];

  await Promise.all(
    Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
      while (!failures.length) {
        options.signal?.throwIfAborted();
        const batch = batches[nextBatch++];
        if (!batch) return;
        try {
          const candidates = await discoverMarketActivity({
            ...options,
            recipients: batch,
            onPage: undefined,
          });
          options.signal?.throwIfAborted();
          for (const candidate of candidates) mergeCandidate(found, candidate);
          await options.onBatch?.(candidates, batch);
        } catch (cause) {
          failures.push(cause);
        }
      }
    }),
  );
  options.signal?.throwIfAborted();
  if (failures.length) {
    const messages = failures.map((failure) => (failure instanceof Error ? failure.message : String(failure))).sort();
    throw new AggregateError(failures, `asset-activity-batch-failed: ${messages.join('; ')}`);
  }
  return sortCandidates([...found.values()]);
}

export async function discoverCollectionActivity(
  options: CollectionActivityOptions,
): Promise<CollectionActivityEvent[]> {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const graphql = options.graphql ?? PAGINATED_GRAPHQL;
  const recipients = [...new Set((options.recipients ?? []).filter((id) => ADDRESS.test(id)))];
  const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 100)));
  const events: CollectionActivityEvent[] = [];
  const seen = new Set<string>();
  const deviceMatches = new Map<string, boolean>();
  let cursor: string | null = null;
  const visited = new Set<string>();

  if (options.recipients !== undefined && !recipients.length) return [];
  while (events.length < limit) {
    options.signal?.throwIfAborted();
    const { response, body: payload } = await fetchJsonWithDeadline<any>(
      fetcher,
      graphql,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: MARKET_ACTIVITY_QUERY,
          variables: {
            cursor,
            recipients: options.recipients === undefined ? null : recipients,
            tags: [
              {
                name: 'action',
                values: ['make-offer', 'register-interest', 'transfer', 'cancel-order'],
              },
            ],
          },
        }),
        signal: options.signal,
      },
      {
        timeoutMs: options.requestTimeoutMs,
        timeoutError: 'collection-activity-graphql-timeout',
      },
    );
    if (!response.ok) throw new Error(`collection-activity-graphql-${response.status}`);
    if (!payload) throw new Error('collection-activity-graphql-empty');
    if (payload?.errors?.length) throw new Error('collection-activity-graphql-error');
    const connection = decodeGraphqlConnection(payload, 'transactions', 'collection-activity-graphql-schema');
    const edges = connection.edges;
    let page = edges.flatMap((edge) => {
      if (seen.has(edge.node.id)) return [];
      const event = activityEventFromNode(edge.node);
      if (!event) return [];
      seen.add(event.id);
      if (options.acceptProcessId && !options.acceptProcessId(event.processId)) return [];
      return [event];
    });
    if (options.requiredExecutionDevice && page.length) {
      const processIds = [...new Set(page.map((event) => event.processId))];
      const unchecked = processIds.filter((id) => !deviceMatches.has(id));
      if (unchecked.length) {
        const verified = await verifyProcessDevices(
          unchecked,
          options.requiredExecutionDevice,
          fetcher,
          graphql,
          options,
        );
        for (const id of unchecked) deviceMatches.set(id, verified.has(id));
      }
      page = page.filter((event) => deviceMatches.get(event.processId) === true);
    }
    const remaining = limit - events.length;
    const accepted = page.slice(0, remaining);
    events.push(...accepted);
    await options.onPage?.(accepted);
    if (events.length >= limit || !connection.pageInfo.hasNextPage) {
      return events;
    }
    cursor = advanceGraphqlCursor(connection, visited, 'collection-activity-pagination-stalled');
  }
  return events;
}

export async function discoverCollectionActivityBatched(
  options: BatchedCollectionActivityOptions,
): Promise<CollectionActivityEvent[]> {
  const recipients = [...new Set(options.recipients.filter((id) => ADDRESS.test(id)))];
  const batchSize = Math.max(1, Math.min(100, Math.floor(options.batchSize ?? 100)));
  const concurrency = Math.max(1, Math.min(4, Math.floor(options.concurrency ?? 2)));
  const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 100)));
  const batches = Array.from({ length: Math.ceil(recipients.length / batchSize) }, (_, index) =>
    recipients.slice(index * batchSize, (index + 1) * batchSize),
  );
  const found = new Map<string, CollectionActivityEvent>();
  let nextBatch = 0;
  const failures: unknown[] = [];

  await Promise.all(
    Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
      while (!failures.length) {
        options.signal?.throwIfAborted();
        const batch = batches[nextBatch++];
        if (!batch) return;
        try {
          const events = await discoverCollectionActivity({
            ...options,
            recipients: batch,
            limit,
            onPage: undefined,
          });
          options.signal?.throwIfAborted();
          for (const event of events) found.set(event.id, event);
          await options.onBatch?.(events, batch);
        } catch (cause) {
          failures.push(cause);
        }
      }
    }),
  );
  options.signal?.throwIfAborted();
  if (failures.length) {
    const messages = failures.map((failure) => (failure instanceof Error ? failure.message : String(failure))).sort();
    throw new AggregateError(failures, `collection-activity-batch-failed: ${messages.join('; ')}`);
  }
  return sortCollectionActivity([...found.values()]).slice(0, limit);
}

function sortCollectionActivity(events: CollectionActivityEvent[]) {
  return events.sort((a, b) => b.height - a.height || b.timestamp - a.timestamp || a.id.localeCompare(b.id));
}

async function verifyProcessDevices(
  ids: string[],
  device: string,
  fetcher: typeof fetch,
  graphql: string,
  options: Pick<CollectionActivityOptions, 'requestTimeoutMs' | 'signal'>,
): Promise<Set<string>> {
  if (!device.trim() || ids.some((id) => !ADDRESS.test(id))) {
    throw new TypeError('invalid-collection-activity-device-filter');
  }
  const requested = new Set(ids);
  const verified = new Set<string>();
  let cursor: string | null = null;
  const visited = new Set<string>();
  while (true) {
    options.signal?.throwIfAborted();
    const { response, body: payload } = await fetchJsonWithDeadline<any>(
      fetcher,
      graphql,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: VERIFY_PROCESS_DEVICES_QUERY,
          variables: { cursor, ids, devices: [device] },
        }),
        signal: options.signal,
      },
      {
        timeoutMs: options.requestTimeoutMs,
        timeoutError: 'collection-activity-device-graphql-timeout',
      },
    );
    if (!response.ok) throw new Error(`collection-activity-device-graphql-${response.status}`);
    if (!payload) throw new Error('collection-activity-device-graphql-empty');
    if (payload?.errors?.length) throw new Error('collection-activity-device-graphql-error');
    const connection = decodeGraphqlConnection(payload, 'transactions', 'collection-activity-device-graphql-schema');
    for (const edge of connection.edges) {
      if (!requested.has(edge.node.id)) throw new Error('collection-activity-device-graphql-schema');
      verified.add(edge.node.id);
    }
    if (!connection.pageInfo.hasNextPage) return verified;
    cursor = advanceGraphqlCursor(connection, visited, 'collection-activity-device-pagination-stalled');
  }
}

function decodeGraphqlConnection(payload: any, key: string, errorCode: string): GraphqlConnection {
  const connection = payload?.data?.[key];
  if (
    !connection ||
    typeof connection !== 'object' ||
    !Array.isArray(connection.edges) ||
    typeof connection.pageInfo?.hasNextPage !== 'boolean' ||
    connection.edges.some(
      (edge: any) =>
        !edge ||
        typeof edge.cursor !== 'string' ||
        !edge.cursor ||
        !edge.node ||
        typeof edge.node !== 'object' ||
        !ADDRESS.test(edge.node.id),
    )
  ) {
    throw new Error(errorCode);
  }
  return connection as GraphqlConnection;
}

function advanceGraphqlCursor(connection: GraphqlConnection, visited: Set<string>, errorCode: string): string {
  const cursor = connection.edges.at(-1)?.cursor;
  if (!cursor || visited.has(cursor) || visited.size >= MAX_GRAPHQL_PAGES) throw new Error(errorCode);
  visited.add(cursor);
  return cursor;
}

export async function resolveAssetCandidates(
  candidates: AssetCandidate[],
  collections: Collection[],
  options: ResolutionOptions = {},
): Promise<ResolvedAsset[]> {
  const sorted = sortCandidates(candidates);
  const resolved: ResolvedAsset[] = [];
  const concurrency = Math.max(1, Math.min(16, Math.floor(options.concurrency ?? ASSET_RESOLUTION_CONCURRENCY)));
  const read = options.read ?? ((processId: string, signal?: AbortSignal) => readAssetState(processId, { signal }));
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, sorted.length) }, async () => {
    while (cursor < sorted.length) {
      options.signal?.throwIfAborted();
      const index = cursor;
      cursor += 1;
      const candidate = sorted[index];
      try {
        const computed = await read(candidate.processId, options.signal);
        const result = supportedAsset(candidate, computed, collections);
        if (result) resolved.push(result);
        options.onSettled?.(result, candidate);
      } catch (error) {
        if (options.signal?.aborted) throw error;
        options.onSettled?.(null, candidate, error);
      }
    }
  });
  await Promise.all(workers);
  return resolved.sort((a, b) => compareActivity(a.activity, b.activity));
}

type CandidateCollectionIndex = {
  byAssetId: Map<string, Collection>;
  tokens?: Collection;
};

const candidateCollectionIndexes = new WeakMap<Collection[], CandidateCollectionIndex>();

function candidateCollectionIndex(collections: Collection[]): CandidateCollectionIndex {
  const cached = candidateCollectionIndexes.get(collections);
  if (cached) return cached;
  const byAssetId = new Map<string, Collection>();
  let tokens: Collection | undefined;
  for (const collection of collections) {
    if (!tokens && collection.kind === 'tokens') tokens = collection;
    for (const asset of collection.assets) {
      if (!byAssetId.has(asset.id)) byAssetId.set(asset.id, collection);
    }
    if (collection.kind === 'names') {
      for (const processId of Object.keys(collection.namespace?.namesById ?? {})) {
        if (!byAssetId.has(processId)) byAssetId.set(processId, collection);
      }
    }
  }
  const index = { byAssetId, ...(tokens ? { tokens } : {}) };
  candidateCollectionIndexes.set(collections, index);
  return index;
}

function restrictAssetCandidatesWithIndex(candidates: AssetCandidate[], index: CandidateCollectionIndex) {
  return candidates.filter((candidate) => {
    const collection = index.byAssetId.get(candidate.processId);
    if (!candidate.device) return Boolean(collection || index.tokens);
    if (['carrier@1.0', 'name-token@1.0'].includes(candidate.device)) {
      return collection?.kind === 'names';
    }
    if (candidate.device !== 'token@1.0') return false;
    if (collection && collection.kind !== 'names') {
      return !candidate.collection || candidate.collection === collection.name;
    }
    return Boolean(
      index.tokens &&
      candidate.assetType === 'fungible' &&
      candidate.swapDevice === 'arweave-swap@1.0' &&
      candidate.schedulerDevice === 'arweave-scheduler@1.0',
    );
  });
}

export function restrictAssetCandidates(candidates: AssetCandidate[], collections: Collection[]): AssetCandidate[] {
  return restrictAssetCandidatesWithIndex(candidates, candidateCollectionIndex(collections));
}

export async function verifyAssetCandidateSupport(
  candidates: AssetCandidate[],
  collections: Collection[],
  options: Pick<CandidateOptions, 'fetch' | 'graphql' | 'requestTimeoutMs' | 'signal'> = {},
): Promise<AssetCandidateSupportResult> {
  const { supported, unverified: unindexed } = partitionAssetCandidateSupport(candidates, collections);
  if (!unindexed.length) return { supported, unavailable: [] };
  const verified = new Set<string>();
  const unavailable = new Map<string, unknown>();
  const ids = [...new Set(unindexed.map((candidate) => candidate.processId))];
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const graphql = options.graphql ?? PAGINATED_GRAPHQL;
  const graphqlHost = new URL(graphql).hostname;
  const batchSize =
    graphqlHost === 'arweave.net' || graphqlHost.endsWith('.arweave.net')
      ? ARWEAVE_GRAPHQL_ID_BATCH_SIZE
      : GRAPHQL_ID_BATCH_SIZE;
  const chunks = Array.from({ length: Math.ceil(ids.length / batchSize) }, (_, index) =>
    ids.slice(index * batchSize, (index + 1) * batchSize),
  );
  let nextChunk = 0;
  const verifyChunk = async (chunk: string[]) => {
    const requested = new Set(chunk);
    let cursor: string | null = null;
    const visited = new Set<string>();
    while (true) {
      options.signal?.throwIfAborted();
      const { response, body: payload } = await fetchJsonWithDeadline<any>(
        fetcher,
        graphql,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query: VERIFY_FUNGIBLE_PROCESSES_QUERY,
            variables: { cursor, ids: chunk },
          }),
          signal: options.signal,
        },
        {
          timeoutMs: options.requestTimeoutMs,
          timeoutError: 'asset-support-graphql-timeout',
        },
      );
      if (!response.ok) throw new Error(`asset-support-graphql-${response.status}`);
      if (!payload) throw new Error('asset-support-graphql-empty');
      if (payload.errors?.length) throw new Error('asset-support-graphql-error');
      const connection = decodeGraphqlConnection(payload, 'transactions', 'asset-support-graphql-schema');
      for (const edge of connection.edges) {
        if (!requested.has(edge.node.id)) throw new Error('asset-support-graphql-schema');
        verified.add(edge.node.id);
      }
      if (!connection.pageInfo.hasNextPage) break;
      cursor = advanceGraphqlCursor(connection, visited, 'asset-support-pagination-stalled');
    }
  };
  const workers = Array.from({ length: Math.min(ASSET_SUPPORT_CONCURRENCY, chunks.length) }, async () => {
    while (nextChunk < chunks.length) {
      options.signal?.throwIfAborted();
      const chunk = chunks[nextChunk++];
      try {
        await verifyChunk(chunk);
      } catch (error) {
        if (options.signal?.aborted) throw options.signal.reason ?? error;
        for (const processId of chunk) unavailable.set(processId, error);
      }
    }
  });
  await Promise.all(workers);
  const verifiedCandidates = unindexed.filter((candidate) => verified.has(candidate.processId));
  const verifiedIds = new Set(verifiedCandidates.map((candidate) => candidate.processId));
  const supportedIds = new Set(supported.map((candidate) => candidate.processId));
  return {
    supported: restrictAssetCandidates(candidates, collections).filter(
      (candidate) => supportedIds.has(candidate.processId) || verifiedIds.has(candidate.processId),
    ),
    unavailable: unindexed
      .filter((candidate) => unavailable.has(candidate.processId))
      .map((candidate) => ({ candidate, error: unavailable.get(candidate.processId) })),
  };
}

export function partitionAssetCandidateSupport(
  candidates: AssetCandidate[],
  collections: Collection[],
): { supported: AssetCandidate[]; unverified: AssetCandidate[] } {
  const supported: AssetCandidate[] = [];
  const unverified: AssetCandidate[] = [];
  const index = candidateCollectionIndex(collections);
  for (const candidate of restrictAssetCandidatesWithIndex(candidates, index)) {
    if (index.byAssetId.has(candidate.processId) || candidateMatchesFungibleContract(candidate)) {
      supported.push(candidate);
    } else {
      unverified.push(candidate);
    }
  }
  return { supported, unverified };
}

function candidateMatchesFungibleContract(candidate: AssetCandidate): boolean {
  return (
    candidate.processDevice === 'process@1.0' &&
    candidate.device === 'token@1.0' &&
    candidate.assetType === 'fungible' &&
    candidate.swapDevice === 'arweave-swap@1.0' &&
    candidate.schedulerDevice === 'arweave-scheduler@1.0' &&
    candidate.schedulerMode === 'all'
  );
}

export type WalletAssetGroup = 'owned' | 'listed';

export function walletAssetGroups(result: ResolvedAsset, address: string): WalletAssetGroup[] {
  const groups: WalletAssetGroup[] = [];
  if (BigInt(liquidBalanceOf(result.state, address)) > 0n) groups.push('owned');
  if (BigInt(listedBalanceOf(result.state, address)) > 0n) groups.push('listed');
  return groups;
}

export function walletAssetGroup(result: ResolvedAsset, address: string): 'owned' | 'listed' | null {
  const groups = walletAssetGroups(result, address);
  return groups.includes('listed') ? 'listed' : (groups[0] ?? null);
}

export function isLiveListing(result: ResolvedAsset): boolean {
  return Boolean(liveOrderOfAsset(result.state));
}

function supportedAsset(
  activity: AssetCandidate,
  computed: ComputeResult,
  collections: Collection[],
): ResolvedAsset | null {
  const indexedCollection = collections.find(
    (collection) => collection.kind !== 'names' && Boolean(collectionAsset(collection, activity.processId)),
  );
  if (indexedCollection) {
    if (computed.state.device !== 'token@1.0') return null;
    const asset = collectionAsset(indexedCollection, activity.processId, computed.state);
    return asset
      ? { asset, collection: indexedCollection, state: computed.state, provider: computed.provider, activity }
      : null;
  }
  const tokenCollection = collections.find((collection) => collection.kind === 'tokens');
  const fungibleAsset = tokenCollection
    ? collectionAsset(tokenCollection, activity.processId, computed.state)
    : undefined;
  if (tokenCollection && fungibleAsset) {
    return {
      asset: fungibleAsset,
      collection: tokenCollection,
      state: computed.state,
      provider: computed.provider,
      activity,
    };
  }

  if (!['carrier@1.0', 'name-token@1.0'].includes(computed.state.device)) return null;
  const names = collections.find((collection) => collection.kind === 'names');
  if (!names) return null;
  const asset = collectionAsset(names, activity.processId);
  if (!asset) return null;
  return { asset, collection: names, state: computed.state, provider: computed.provider, activity };
}

function candidateFromNode(
  node: GraphqlNode,
  source: AssetCandidate['sources'][number],
  wallet?: string,
  requireOwner = false,
): AssetCandidate | null {
  const tags = Object.fromEntries((node.tags ?? []).map((tag) => [tag.name.toLowerCase(), tag.value]));
  const processId = source === 'initial-holder' ? node.id : node.recipient;
  if (!processId || !ADDRESS.test(processId)) return null;
  if (source === 'initial-holder' && wallet && tags['initial-holder'] !== wallet) return null;
  if (source === 'market-action') {
    if (!['register-interest', 'make-offer', 'transfer', 'cancel-order'].includes(tags.action)) return null;
    if (requireOwner && node.owner?.address !== wallet) return null;
  }
  if (source === 'transfer' && (tags.action !== 'transfer' || tags.recipient !== wallet)) return null;
  return {
    processId,
    height: safeNumber(node.block?.height),
    timestamp: safeNumber(node.block?.timestamp),
    activityIds: [node.id],
    sources: [source],
    ...(source === 'initial-holder'
      ? {
          processDevice: tags.device,
          device: tags['execution-device'] ?? tags.device,
          collection: tags.collection,
          assetType: tags['asset-type'],
          swapDevice: tags['swap-device'],
          schedulerDevice: tags['scheduler-device'],
          schedulerMode: tags['scheduler-mode'],
        }
      : {}),
  };
}

function activityEventFromNode(node: GraphqlNode): CollectionActivityEvent | null {
  const tags = Object.fromEntries((node.tags ?? []).map((tag) => [tag.name.toLowerCase(), tag.value]));
  const action = tags.action;
  if (
    !ADDRESS.test(node.id) ||
    !node.recipient ||
    !ADDRESS.test(node.recipient) ||
    !['make-offer', 'register-interest', 'transfer', 'cancel-order'].includes(action)
  ) {
    return null;
  }
  return {
    id: node.id,
    processId: node.recipient,
    action: action as CollectionActivityEvent['action'],
    actor: ADDRESS.test(node.owner?.address ?? '') ? node.owner!.address! : '',
    height: safeNumber(node.block?.height),
    timestamp: safeNumber(node.block?.timestamp),
    ...(action === 'make-offer' && /^[1-9]\d*$/.test(tags.asking ?? '') ? { asking: tags.asking } : {}),
    ...(['make-offer', 'transfer'].includes(action) &&
    /^[1-9]\d*$/.test(action === 'make-offer' ? (tags['offer-quantity'] ?? '') : (tags.quantity ?? ''))
      ? { quantity: action === 'make-offer' ? tags['offer-quantity'] : tags.quantity }
      : {}),
    ...(['register-interest', 'cancel-order'].includes(action) && ADDRESS.test(tags['order-id'] ?? '')
      ? { orderId: tags['order-id'] }
      : {}),
    ...(action === 'transfer' && ADDRESS.test(tags.recipient ?? '') ? { recipient: tags.recipient } : {}),
  };
}

function mergeCandidate(found: Map<string, AssetCandidate>, next: AssetCandidate): void {
  const current = found.get(next.processId);
  if (!current) {
    found.set(next.processId, next);
    return;
  }
  const activity = compareActivity(current, next) <= 0 ? current : next;
  const sameActivity = current.height === next.height && current.timestamp === next.timestamp;
  found.set(next.processId, {
    processId: next.processId,
    height: activity.height,
    timestamp: activity.timestamp,
    activityIds: sameActivity
      ? [...new Set([...(current.activityIds ?? []), ...(next.activityIds ?? [])])]
      : activity.activityIds,
    sources: [...new Set([...current.sources, ...next.sources])],
    device: current.device ?? next.device,
    collection: current.collection ?? next.collection,
    processDevice: current.processDevice ?? next.processDevice,
    assetType: current.assetType ?? next.assetType,
    swapDevice: current.swapDevice ?? next.swapDevice,
    schedulerDevice: current.schedulerDevice ?? next.schedulerDevice,
    schedulerMode: current.schedulerMode ?? next.schedulerMode,
  });
}

function sortCandidates(candidates: AssetCandidate[]): AssetCandidate[] {
  return [...candidates].sort(compareActivity);
}

function compareActivity(a: AssetCandidate, b: AssetCandidate): number {
  return b.height - a.height || b.timestamp - a.timestamp || a.processId.localeCompare(b.processId);
}

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
