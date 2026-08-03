import type { AssetSummary, Collection } from './collections';
import {
	liveOrderOfAsset,
	listedBalanceOf,
	liquidBalanceOf,
	readAssetState,
	type AssetState,
	type ComputeResult,
} from './asset-marketplace';

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const GRAPHQL_PAGE_SIZE = 100;
export const ASSET_RESOLUTION_CONCURRENCY = 8;

export type AssetCandidate = {
	processId: string;
	height: number;
	timestamp: number;
	sources: Array<'initial-holder' | 'market-action' | 'transfer'>;
	device?: string;
	collection?: string;
};

export type ResolvedAsset = {
	asset: AssetSummary;
	collection: Collection;
	state: AssetState;
	provider: string;
	activity: AssetCandidate;
};

export type CollectionActivityEvent = {
	id: string;
	processId: string;
	action: 'make-offer' | 'register-interest' | 'transfer' | 'cancel-order';
	actor: string;
	height: number;
	timestamp: number;
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
	pageInfo?: { hasNextPage?: boolean };
	edges?: GraphqlEdge[];
};

type CandidateOptions = {
	fetch?: typeof fetch;
	signal?: AbortSignal;
	graphql?: string;
	onPage?: (candidates: AssetCandidate[]) => void | Promise<void>;
};

type MarketActivityOptions = CandidateOptions & {
	recipients?: string[];
	listingsOnly?: boolean;
};

type CollectionActivityOptions = Omit<CandidateOptions, 'onPage'> & {
	recipients: string[];
	limit?: number;
	onPage?: (events: CollectionActivityEvent[]) => void | Promise<void>;
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
	) {
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
	) {
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
	) {
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

export async function discoverWalletAssetCandidates(
	address: string,
	options: CandidateOptions = {}
): Promise<AssetCandidate[]> {
	if (!ADDRESS.test(address)) throw new TypeError('invalid-wallet-address');
	const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
	const graphql = options.graphql ?? 'https://arweave.net/graphql';
	const found = new Map<string, AssetCandidate>();
	const cursors: Record<'initiallyHeld' | 'marketActions' | 'receivedTransfers', string | null> = {
		initiallyHeld: null,
		marketActions: null,
		receivedTransfers: null,
	};
	const active = new Set(Object.keys(cursors) as Array<keyof typeof cursors>);

	while (active.size) {
		options.signal?.throwIfAborted();
		const response = await fetcher(graphql, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				query: WALLET_CANDIDATES_QUERY,
				variables: {
					initialCursor: cursors.initiallyHeld,
					marketCursor: cursors.marketActions,
					transferCursor: cursors.receivedTransfers,
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
		});
		if (!response.ok) throw new Error(`asset-discovery-graphql-${response.status}`);
		const payload = await response.json();
		if (payload?.errors?.length) throw new Error('asset-discovery-graphql-error');

		const pageCandidates: AssetCandidate[] = [];
		for (const alias of active) {
			const connection = payload?.data?.[alias] as GraphqlConnection | undefined;
			const edges = Array.isArray(connection?.edges) ? connection.edges : [];
			for (const edge of edges) {
				const candidate =
					alias === 'initiallyHeld'
						? candidateFromNode(edge.node, 'initial-holder', address, false)
						: alias === 'marketActions'
							? candidateFromNode(edge.node, 'market-action', address, true)
							: candidateFromNode(edge.node, 'transfer', address, false);
				if (!candidate) continue;
				mergeCandidate(found, candidate);
				pageCandidates.push(candidate);
			}
			const nextCursor = edges.at(-1)?.cursor;
			if (!connection?.pageInfo?.hasNextPage || !edges.length) {
				active.delete(alias);
			} else if (!nextCursor || nextCursor === cursors[alias]) {
				throw new Error('asset-discovery-pagination-stalled');
			} else {
				cursors[alias] = nextCursor;
			}
		}
		await options.onPage?.(
			sortCandidates([...new Map(pageCandidates.map((item) => [item.processId, item])).values()])
		);
	}

	return sortCandidates([...found.values()]);
}

export async function discoverMarketActivity(options: MarketActivityOptions = {}): Promise<AssetCandidate[]> {
	const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
	const graphql = options.graphql ?? 'https://arweave.net/graphql';
	const found = new Map<string, AssetCandidate>();
	const recipients = [...new Set((options.recipients ?? []).filter((id) => ADDRESS.test(id)))];
	let cursor: string | null = null;

	while (true) {
		options.signal?.throwIfAborted();
		const response = await fetcher(graphql, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				query: MARKET_ACTIVITY_QUERY,
				variables: {
					cursor,
					recipients: recipients.length ? recipients : null,
					tags: [{
						name: 'action',
						values: options.listingsOnly
							? ['make-offer']
							: ['make-offer', 'register-interest', 'transfer', 'cancel-order'],
					}],
				},
			}),
			signal: options.signal,
		});
		if (!response.ok) throw new Error(`asset-activity-graphql-${response.status}`);
		const payload = await response.json();
		if (payload?.errors?.length) throw new Error('asset-activity-graphql-error');
		const connection = payload?.data?.transactions as GraphqlConnection | undefined;
		const edges = Array.isArray(connection?.edges) ? connection.edges : [];
		const pageCandidates = edges.flatMap((edge) => {
			const candidate = candidateFromNode(edge.node, 'market-action');
			if (!candidate) return [];
			mergeCandidate(found, candidate);
			return [candidate];
		});
		await options.onPage?.(sortCandidates(pageCandidates));
		if (!connection?.pageInfo?.hasNextPage || !edges.length) return sortCandidates([...found.values()]);
		const nextCursor = edges.at(-1)?.cursor;
		if (!nextCursor || nextCursor === cursor) throw new Error('asset-activity-pagination-stalled');
		cursor = nextCursor;
	}
}

export async function discoverCollectionActivity(
	options: CollectionActivityOptions
): Promise<CollectionActivityEvent[]> {
	const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
	const graphql = options.graphql ?? 'https://arweave.net/graphql';
	const recipients = [...new Set(options.recipients.filter((id) => ADDRESS.test(id)))];
	const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 100)));
	const events: CollectionActivityEvent[] = [];
	const seen = new Set<string>();
	let cursor: string | null = null;

	if (!recipients.length) return [];
	while (events.length < limit) {
		options.signal?.throwIfAborted();
		const response = await fetcher(graphql, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				query: MARKET_ACTIVITY_QUERY,
				variables: {
					cursor,
					recipients,
					tags: [{
						name: 'action',
						values: ['make-offer', 'register-interest', 'transfer', 'cancel-order'],
					}],
				},
			}),
			signal: options.signal,
		});
		if (!response.ok) throw new Error(`collection-activity-graphql-${response.status}`);
		const payload = await response.json();
		if (payload?.errors?.length) throw new Error('collection-activity-graphql-error');
		const connection = payload?.data?.transactions as GraphqlConnection | undefined;
		const edges = Array.isArray(connection?.edges) ? connection.edges : [];
		const page = edges.flatMap((edge) => {
			if (seen.has(edge.node.id)) return [];
			const event = activityEventFromNode(edge.node);
			if (!event) return [];
			seen.add(event.id);
			return [event];
		});
		const remaining = limit - events.length;
		const accepted = page.slice(0, remaining);
		events.push(...accepted);
		await options.onPage?.(accepted);
		if (
			events.length >= limit ||
			!connection?.pageInfo?.hasNextPage ||
			!edges.length
		) {
			return events;
		}
		const nextCursor = edges.at(-1)?.cursor;
		if (!nextCursor || nextCursor === cursor) throw new Error('collection-activity-pagination-stalled');
		cursor = nextCursor;
	}
	return events;
}

export async function resolveAssetCandidates(
	candidates: AssetCandidate[],
	collections: Collection[],
	options: ResolutionOptions = {}
): Promise<ResolvedAsset[]> {
	const sorted = sortCandidates(candidates);
	const resolved: ResolvedAsset[] = [];
	const concurrency = Math.max(
		1,
		Math.min(16, Math.floor(options.concurrency ?? ASSET_RESOLUTION_CONCURRENCY))
	);
	const read =
		options.read ??
		((processId: string, signal?: AbortSignal) =>
			readAssetState(processId, { signal }));
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

export function restrictAssetCandidates(
	candidates: AssetCandidate[],
	collections: Collection[]
): AssetCandidate[] {
	const indexedAssets = new Map<string, string>();
	for (const collection of collections) {
		if (collection.kind === 'names') continue;
		for (const asset of collection.assets) indexedAssets.set(asset.id, collection.name);
	}
	const supportsNames = collections.some((collection) => collection.kind === 'names');
	return candidates.filter((candidate) => {
		if (!candidate.device) {
			return candidate.sources.some((source) => source !== 'initial-holder');
		}
		if (['carrier@1.0', 'name-token@1.0'].includes(candidate.device)) return supportsNames;
		if (candidate.device !== 'token@1.0') return false;
		const collection = indexedAssets.get(candidate.processId);
		return Boolean(collection && (!candidate.collection || candidate.collection === collection));
	});
}

export type WalletAssetGroup = 'owned' | 'listed';

export function walletAssetGroups(result: ResolvedAsset, address: string): WalletAssetGroup[] {
	const groups: WalletAssetGroup[] = [];
	if (BigInt(liquidBalanceOf(result.state, address)) > 0n) groups.push('owned');
	if (BigInt(listedBalanceOf(result.state, address)) > 0n) groups.push('listed');
	return groups;
}

export function walletAssetGroup(
	result: ResolvedAsset,
	address: string
): 'owned' | 'listed' | null {
	const groups = walletAssetGroups(result, address);
	return groups.includes('listed') ? 'listed' : groups[0] ?? null;
}

export function isLiveListing(result: ResolvedAsset): boolean {
	return Boolean(liveOrderOfAsset(result.state));
}

function supportedAsset(
	activity: AssetCandidate,
	computed: ComputeResult,
	collections: Collection[]
): ResolvedAsset | null {
	const indexedCollection = collections.find(
		(collection) =>
			collection.kind !== 'names' &&
			collection.assets.some((asset) => asset.id === activity.processId)
	);
	if (indexedCollection) {
		if (computed.state.device !== 'token@1.0') return null;
		const asset = indexedCollection.assets.find((item) => item.id === activity.processId);
		return asset
			? { asset, collection: indexedCollection, state: computed.state, provider: computed.provider, activity }
			: null;
	}

	if (!['carrier@1.0', 'name-token@1.0'].includes(computed.state.device)) return null;
	const names = collections.find((collection) => collection.kind === 'names');
	if (!names) return null;
	const indexed = names.assets.find((asset) => asset.id === activity.processId);
	const asset = indexed ?? {
		id: activity.processId,
		name: computed.state.name || shortId(activity.processId),
	};
	return { asset, collection: names, state: computed.state, provider: computed.provider, activity };
}

function candidateFromNode(
	node: GraphqlNode,
	source: AssetCandidate['sources'][number],
	wallet?: string,
	requireOwner = false
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
		sources: [source],
		...(source === 'initial-holder'
			? {
					device: tags['execution-device'] ?? tags.device,
					collection: tags.collection,
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
	};
}

function mergeCandidate(found: Map<string, AssetCandidate>, next: AssetCandidate): void {
	const current = found.get(next.processId);
	if (!current) {
		found.set(next.processId, next);
		return;
	}
	found.set(next.processId, {
		processId: next.processId,
		height: Math.max(current.height, next.height),
		timestamp: Math.max(current.timestamp, next.timestamp),
		sources: [...new Set([...current.sources, ...next.sources])],
		device: current.device ?? next.device,
		collection: current.collection ?? next.collection,
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

function shortId(value: string): string {
	return `${value.slice(0, 7)}…${value.slice(-6)}`;
}
