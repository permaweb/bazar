import { isSupportedAssetContentType } from 'helpers/asset-media';
import { arweaveGraphqlEndpoint } from 'helpers/config';

import {
	type AssetState,
	assetStateSlot,
	type ComputeResult,
	liquidBalanceOf,
	listedBalanceOf,
	liveOrderOfAsset,
	type ProcessAssignment,
	readAssetState,
	readAssetStateAtSlot,
	readProcessAssignments,
} from './asset-marketplace';
import { type AssetSummary, assetUiStyle, type Collection, collectionAsset, isVisibleAssetId } from './collections';
import { fetchJsonWithDeadline } from './fetch-with-deadline';
import { assetFromMintState, CREATED_COLLECTION_ID, CREATED_COLLECTION_NAME } from './minted-assets';

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const GRAPHQL_PAGE_SIZE = 100;
const GRAPHQL_ID_BATCH_SIZE = 100;
const ARWEAVE_GRAPHQL_ID_BATCH_SIZE = 9;
const MAX_GRAPHQL_PAGES = 1_000;
const WALLET_HEAD_CATCH_UP_PAGES_PER_PASS = 20;
const WALLET_SCAN_CACHE_VERSION = 1;
const WALLET_SCAN_CACHE_PREFIX = 'bazar.wallet-candidate-scan';
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
	purchaseProof?: {
		transactionId: string;
		height: number;
	};
};

type PurchaseProofOptions = {
	signal?: AbortSignal;
	maxScheduleSlots?: number;
	readCurrent?: (processId: string, signal?: AbortSignal) => Promise<ComputeResult>;
	readAssignments?: (
		processId: string,
		fromSlot: number,
		toSlot: number,
		options?: { signal?: AbortSignal }
	) => Promise<ProcessAssignment[]>;
	readAtSlot?: (processId: string, slot: number, options?: { signal?: AbortSignal }) => Promise<ComputeResult>;
};

export async function confirmPurchaseActivity(
	events: CollectionActivityEvent[],
	options: PurchaseProofOptions = {}
): Promise<CollectionActivityEvent[]> {
	const purchases = events.filter(
		(event) =>
			event.action === 'register-interest' &&
			!event.purchaseProof &&
			ADDRESS.test(event.actor) &&
			ADDRESS.test(event.orderId ?? '')
	);
	if (!purchases.length) return events;
	const readCurrent = options.readCurrent ?? ((processId, signal) => readAssetState(processId, { signal }));
	const readAssignments = options.readAssignments ?? readProcessAssignments;
	const readAtSlot = options.readAtSlot ?? readAssetStateAtSlot;
	const maxScheduleSlots = Math.max(100, Math.floor(options.maxScheduleSlots ?? 1_000));
	const { purchaseAppliedAtSlot } = await import('./asset-transactions');
	const proofs = new Map<string, CollectionActivityEvent['purchaseProof']>();
	const groups = new Map<string, CollectionActivityEvent[]>();
	for (const event of purchases) groups.set(event.processId, [...(groups.get(event.processId) ?? []), event]);

	const pendingGroups = [...groups.entries()];
	let nextGroup = 0;
	const verifyGroup = async (processId: string, processEvents: CollectionActivityEvent[]) => {
		options.signal?.throwIfAborted();
		const current = await readCurrent(processId, options.signal);
		const currentSlot = assetStateSlot(current.state);
		if (currentSlot === null) return;
		const firstSlot = Math.max(0, currentSlot - maxScheduleSlots + 1);
		const assignments: ProcessAssignment[] = [];
		const earliestRegistrationHeight = Math.min(
			...processEvents.map((event) => event.height).filter((height) => height > 0)
		);
		for (let toSlot = currentSlot; toSlot >= firstSlot; toSlot -= 100) {
			const fromSlot = Math.max(firstSlot, toSlot - 99);
			const window = await readAssignments(processId, fromSlot, toSlot, {
				signal: options.signal,
			});
			assignments.unshift(...window);
			if (
				Number.isFinite(earliestRegistrationHeight) &&
				window.some((assignment) => assignment.blockHeight <= earliestRegistrationHeight)
			)
				break;
		}
		for (const event of processEvents) {
			const candidates = assignments.filter((assignment) => {
				const body = assignment.raw.body as Record<string, unknown> | undefined;
				if (assignment.raw.process !== processId || body?.['order-id'] !== event.orderId) return false;
				return assignment.transactionIds.some((transactionId) => {
					if (transactionId === event.id) return false;
					const commitment = (body?.commitments as Record<string, Record<string, unknown>> | undefined)?.[
						transactionId
					];
					return commitment?.['commitment-device'] === 'tx@1.0' && commitment.committer === event.actor;
				});
			});
			for (const assignment of candidates) {
				if (assignment.slot < 1) continue;
				const before = await readAtSlot(processId, assignment.slot - 1, { signal: options.signal });
				const expected = before.state.orders[event.orderId!];
				if (!expected) continue;
				const after = await readAtSlot(processId, assignment.slot, { signal: options.signal });
				const paymentId = assignment.transactionIds.find((transactionId) => transactionId !== event.id)!;
				try {
					if (
						purchaseAppliedAtSlot(
							before.state,
							after.state,
							assignment,
							processId,
							paymentId,
							event.actor,
							expected
						)
					) {
						proofs.set(event.id, { transactionId: paymentId, height: assignment.blockHeight });
						break;
					}
				} catch {
					// A schedule record that does not prove this exact transition remains a submission only.
				}
			}
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(3, pendingGroups.length) }, async () => {
			while (nextGroup < pendingGroups.length) {
				const group = pendingGroups[nextGroup++];
				await verifyGroup(...group);
			}
		})
	);
	const seenPayments = new Set<string>();
	return events
		.map((event) => (proofs.has(event.id) ? { ...event, purchaseProof: proofs.get(event.id) } : event))
		.filter((event) => {
			const paymentId = event.purchaseProof?.transactionId;
			if (!paymentId) return true;
			if (seenPayments.has(paymentId)) return false;
			seenPayments.add(paymentId);
			return true;
		});
}

export type PendingAssetOffer = Pick<
	CollectionActivityEvent,
	'id' | 'actor' | 'height' | 'timestamp' | 'asking' | 'quantity'
>;

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

type StoredWalletCandidate = Array<string | number | string[] | null>;

type StoredWalletCandidateScan = {
	v: number;
	a: string;
	g: string;
	h: Array<string | null>;
	c: StoredWalletCandidate[];
};

type WalletCandidateOptions = CandidateOptions & {
	scan?: WalletCandidateScan;
	catchUp?: boolean;
};

type MarketActivityOptions = CandidateOptions & {
	recipients?: string[];
	listingsOnly?: boolean;
	acceptProcessId?: (processId: string) => boolean;
	maxPages?: number;
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
	actions?: CollectionActivityEvent['action'][];
	acceptProcessId?: (processId: string) => boolean;
	requiredExecutionDevice?: string;
	onPage?: (events: CollectionActivityEvent[]) => void | Promise<void>;
};

export type CollectionActivityPage = {
	events: CollectionActivityEvent[];
	cursor: string | null;
	hasNextPage: boolean;
	totalCount: number | null;
};

export type CollectionActivityPageOptions = Omit<CollectionActivityOptions, 'limit' | 'onPage'> & {
	cursor?: string | null;
	pageSize?: number;
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
	onRevalidated?: (result: ResolvedAsset | null, candidate: AssetCandidate, error?: unknown) => void;
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

const COLLECTION_ACTIVITY_PAGE_QUERY = `query CollectionActivityPage(
	$first: Int!
	$recipients: [String!]
	$tags: [TagFilter!]!
) {
	transactions(
		first: $first
		sort: HEIGHT_DESC
		recipients: $recipients
		tags: $tags
	) {
		count
		pageInfo { hasNextPage }
		edges {
			cursor
			node { id recipient tags { name value } owner { address } block { height timestamp } }
		}
	}
}`;

const COLLECTION_ACTIVITY_CURSOR_PAGE_QUERY = `query CollectionActivityCursorPage(
	$cursor: String!
	$first: Int!
	$recipients: [String!]
	$tags: [TagFilter!]!
) {
	transactions(
		first: $first
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

const VERIFY_ASSET_PROCESSES_QUERY = `query VerifyAssetProcesses(
	$ids: [ID!]!
) {
	fungible: transactions(
		first: ${GRAPHQL_PAGE_SIZE}
		ids: $ids
		tags: [
			{ name: "device", values: ["process@1.0"] }
			{ name: "execution-device", values: ["token@1.0"] }
			{ name: "swap-device", values: ["arweave-swap@1.0"] }
			{ name: "scheduler-device", values: ["arweave-scheduler@1.0"] }
			{ name: "hint-ui-style", values: ["fungible"] }
			{ name: "scheduler-mode", values: ["all"] }
		]
	) {
		pageInfo { hasNextPage }
		edges { cursor node { id } }
	}
	legacyFungibleHintStyle: transactions(
		first: ${GRAPHQL_PAGE_SIZE}
		ids: $ids
		tags: [
			{ name: "device", values: ["process@1.0"] }
			{ name: "execution-device", values: ["token@1.0"] }
			{ name: "swap-device", values: ["arweave-swap@1.0"] }
			{ name: "scheduler-device", values: ["arweave-scheduler@1.0"] }
			{ name: "hint-style", values: ["fungible"] }
			{ name: "scheduler-mode", values: ["all"] }
		]
	) {
		pageInfo { hasNextPage }
		edges { cursor node { id } }
	}
	legacyFungibleAssetType: transactions(
		first: ${GRAPHQL_PAGE_SIZE}
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
	atomic: transactions(
		first: ${GRAPHQL_PAGE_SIZE}
		ids: $ids
		tags: [
			{ name: "device", values: ["process@1.0"] }
			{ name: "execution-device", values: ["token@1.0"] }
			{ name: "swap-device", values: ["arweave-swap@1.0"] }
			{ name: "scheduler-device", values: ["arweave-scheduler@1.0"] }
			{ name: "hint-ui-style", values: ["non-fungible"] }
			{ name: "scheduler-mode", values: ["all"] }
			{ name: "total-supply", values: ["1"] }
			{ name: "denomination", values: ["0"] }
			{ name: "ticker", values: ["ASSET"] }
		]
	) {
		pageInfo { hasNextPage }
		edges { cursor node { id tags { name value } } }
	}
}`;

const SEARCH_BAZAR_ATOMIC_ASSETS_QUERY = `query SearchBazarAtomicAssets($names: [String!]!) {
	transactions(
		first: 20
		sort: HEIGHT_DESC
		tags: [
			{ name: "name", values: $names }
			{ name: "device", values: ["process@1.0"] }
			{ name: "execution-device", values: ["token@1.0"] }
			{ name: "swap-device", values: ["arweave-swap@1.0"] }
			{ name: "scheduler-device", values: ["arweave-scheduler@1.0"] }
			{ name: "hint-ui-style", values: ["non-fungible"] }
			{ name: "scheduler-mode", values: ["all"] }
			{ name: "total-supply", values: ["1"] }
			{ name: "denomination", values: ["0"] }
			{ name: "ticker", values: ["ASSET"] }
		]
	) {
		pageInfo { hasNextPage }
		edges { cursor node { id tags { name value } } }
	}
}`;

const BAZAR_ATOMIC_ASSET_BY_ID_QUERY = `query BazarAtomicAssetById($id: ID!) {
	transaction(id: $id) {
		id
		tags { name value }
	}
}`;

type AtomicAssetSearchOptions = Pick<CandidateOptions, 'fetch' | 'graphql' | 'requestTimeoutMs' | 'signal'>;

export async function loadBazarAtomicAssetById(
	processId: string,
	options: AtomicAssetSearchOptions = {}
): Promise<{ asset: AssetSummary; collection: Collection } | null> {
	if (!ADDRESS.test(processId)) throw new TypeError('invalid-asset-process-id');
	if (!isVisibleAssetId(processId)) return null;
	const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
	const graphql = options.graphql ?? arweaveGraphqlEndpoint();
	const { response, body: payload } = await fetchJsonWithDeadline<any>(
		fetcher,
		graphql,
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query: BAZAR_ATOMIC_ASSET_BY_ID_QUERY, variables: { id: processId } }),
			signal: options.signal,
		},
		{
			timeoutMs: options.requestTimeoutMs,
			timeoutError: 'asset-index-graphql-timeout',
		}
	);
	if (!response.ok) throw new Error(`asset-index-graphql-${response.status}`);
	if (!payload) throw new Error('asset-index-graphql-empty');
	if (payload.errors?.length) throw new Error('asset-index-graphql-error');
	const node: unknown = payload.data?.transaction;
	if (node === null) return null;
	if (
		!node ||
		typeof node !== 'object' ||
		(node as GraphqlNode).id !== processId ||
		!Array.isArray((node as GraphqlNode).tags) ||
		(node as GraphqlNode).tags!.some((tag) => !tag || typeof tag.name !== 'string' || typeof tag.value !== 'string')
	) {
		throw new Error('asset-index-graphql-schema');
	}
	return bazarAtomicAssetFromNode(node as GraphqlNode);
}

export async function searchBazarAtomicAssetsByName(
	query: string,
	options: AtomicAssetSearchOptions = {}
): Promise<Array<{ asset: AssetSummary; collection: Collection }>> {
	const name = query.trim();
	if (!name) return [];
	const titleCaseName = name.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
	const names = [...new Set([name, name.toLowerCase(), titleCaseName, name.toUpperCase()])];
	const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
	const graphql = options.graphql ?? arweaveGraphqlEndpoint();
	const { response, body: payload } = await fetchJsonWithDeadline<any>(
		fetcher,
		graphql,
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query: SEARCH_BAZAR_ATOMIC_ASSETS_QUERY, variables: { names } }),
			signal: options.signal,
		},
		{
			timeoutMs: options.requestTimeoutMs,
			timeoutError: 'asset-search-graphql-timeout',
		}
	);
	if (!response.ok) throw new Error(`asset-search-graphql-${response.status}`);
	if (!payload) throw new Error('asset-search-graphql-empty');
	if (payload?.errors?.length) throw new Error('asset-search-graphql-error');
	const connection = decodeGraphqlConnection(payload, 'transactions', 'asset-search-graphql-schema');
	return connection.edges.flatMap(({ node }) => {
		const result = bazarAtomicAssetFromNode(node);
		return result?.asset.name.toLowerCase() === name.toLowerCase() ? [result] : [];
	});
}

export function createWalletCandidateScan(address: string, graphql = arweaveGraphqlEndpoint()): WalletCandidateScan {
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

export function resumeCompletedWalletCandidateScan(
	scan: WalletCandidateScan | undefined,
	address: string,
	graphql = arweaveGraphqlEndpoint()
): WalletCandidateScan | undefined {
	if (
		!scan ||
		scan.address !== address ||
		scan.graphql !== graphql ||
		scan.active.size ||
		scan.catchUp ||
		!scan.caughtUp
	)
		return undefined;
	return restoredWalletCandidateScan(address, graphql, scan.heads, scan.found);
}

export function loadCompletedWalletCandidateScan(
	storage: Pick<Storage, 'getItem'>,
	address: string,
	graphql = arweaveGraphqlEndpoint()
): WalletCandidateScan | undefined {
	if (!ADDRESS.test(address)) return undefined;
	try {
		const value = storage.getItem(walletCandidateScanKey(address, graphql));
		if (!value) return undefined;
		const stored = JSON.parse(value) as StoredWalletCandidateScan;
		if (
			stored?.v !== WALLET_SCAN_CACHE_VERSION ||
			stored.a !== address ||
			stored.g !== graphql ||
			!Array.isArray(stored.h) ||
			stored.h.length !== 3 ||
			stored.h.some((head) => head !== null && !ADDRESS.test(head)) ||
			!Array.isArray(stored.c)
		)
			return undefined;
		const found = new Map<string, AssetCandidate>();
		for (const value of stored.c) {
			const candidate = decodeStoredWalletCandidate(value);
			if (!candidate || found.has(candidate.processId)) return undefined;
			found.set(candidate.processId, candidate);
		}
		return restoredWalletCandidateScan(
			address,
			graphql,
			{
				initiallyHeld: stored.h[0]!,
				marketActions: stored.h[1]!,
				receivedTransfers: stored.h[2]!,
			},
			found
		);
	} catch {
		return undefined;
	}
}

export function storeCompletedWalletCandidateScan(
	storage: Pick<Storage, 'setItem'>,
	scan: WalletCandidateScan
): boolean {
	if (scan.active.size || scan.catchUp || !scan.caughtUp) return false;
	const stored: StoredWalletCandidateScan = {
		v: WALLET_SCAN_CACHE_VERSION,
		a: scan.address,
		g: scan.graphql,
		h: [scan.heads.initiallyHeld ?? null, scan.heads.marketActions ?? null, scan.heads.receivedTransfers ?? null],
		c: [...scan.found.values()].map(encodeStoredWalletCandidate),
	};
	try {
		storage.setItem(walletCandidateScanKey(scan.address, scan.graphql), JSON.stringify(stored));
		return true;
	} catch {
		return false;
	}
}

export function clearCompletedWalletCandidateScan(
	storage: Pick<Storage, 'removeItem'>,
	address: string,
	graphql = arweaveGraphqlEndpoint()
) {
	try {
		storage.removeItem(walletCandidateScanKey(address, graphql));
	} catch {
		// Browser storage is optional; a fresh in-memory scan still proceeds.
	}
}

function walletCandidateScanKey(address: string, graphql: string) {
	return `${WALLET_SCAN_CACHE_PREFIX}:v${WALLET_SCAN_CACHE_VERSION}:${address}:${encodeURIComponent(graphql)}`;
}

function restoredWalletCandidateScan(
	address: string,
	graphql: string,
	heads: WalletCandidateScan['heads'],
	found: Map<string, AssetCandidate>
): WalletCandidateScan {
	const scan = createWalletCandidateScan(address, graphql);
	scan.active.clear();
	scan.found = new Map(found);
	scan.heads = { ...heads };
	return scan;
}

function encodeStoredWalletCandidate(candidate: AssetCandidate): StoredWalletCandidate {
	const stored: StoredWalletCandidate = [
		candidate.processId,
		candidate.height,
		candidate.timestamp,
		(candidate.sources.includes('initial-holder') ? 1 : 0) |
			(candidate.sources.includes('market-action') ? 2 : 0) |
			(candidate.sources.includes('transfer') ? 4 : 0),
		candidate.activityIds?.length === 1 && candidate.activityIds[0] === candidate.processId
			? 0
			: candidate.activityIds ?? null,
		candidate.device ?? null,
		candidate.collection ?? null,
		candidate.processDevice ?? null,
		candidate.assetType ?? null,
		candidate.swapDevice ?? null,
		candidate.schedulerDevice ?? null,
		candidate.schedulerMode ?? null,
	];
	while (stored.at(-1) === null) stored.pop();
	return stored;
}

function decodeStoredWalletCandidate(value: StoredWalletCandidate): AssetCandidate | undefined {
	if (!Array.isArray(value) || value.length < 4 || value.length > 12) return undefined;
	const [
		processId,
		height,
		timestamp,
		sourceMask,
		activity,
		device,
		collection,
		processDevice,
		assetType,
		swapDevice,
		schedulerDevice,
		schedulerMode,
	] = value;
	if (
		typeof processId !== 'string' ||
		!ADDRESS.test(processId) ||
		typeof height !== 'number' ||
		!Number.isSafeInteger(height) ||
		height < 0 ||
		typeof timestamp !== 'number' ||
		!Number.isSafeInteger(timestamp) ||
		timestamp < 0 ||
		typeof sourceMask !== 'number' ||
		!Number.isSafeInteger(sourceMask) ||
		sourceMask < 1 ||
		sourceMask > 7 ||
		(activity !== undefined &&
			activity !== null &&
			activity !== 0 &&
			(!Array.isArray(activity) || activity.some((id) => typeof id !== 'string' || !ADDRESS.test(id)))) ||
		[device, collection, processDevice, assetType, swapDevice, schedulerDevice, schedulerMode].some(
			(item) => item !== undefined && item !== null && typeof item !== 'string'
		)
	)
		return undefined;
	return {
		processId,
		height,
		timestamp,
		...(activity === 0 ? { activityIds: [processId] } : Array.isArray(activity) ? { activityIds: activity } : {}),
		sources: [
			...(sourceMask & 1 ? (['initial-holder'] as const) : []),
			...(sourceMask & 2 ? (['market-action'] as const) : []),
			...(sourceMask & 4 ? (['transfer'] as const) : []),
		],
		...(typeof device === 'string' ? { device } : {}),
		...(typeof collection === 'string' ? { collection } : {}),
		...(typeof processDevice === 'string' ? { processDevice } : {}),
		...(typeof assetType === 'string' ? { assetType } : {}),
		...(typeof swapDevice === 'string' ? { swapDevice } : {}),
		...(typeof schedulerDevice === 'string' ? { schedulerDevice } : {}),
		...(typeof schedulerMode === 'string' ? { schedulerMode } : {}),
	};
}

export async function discoverWalletAssetCandidates(
	address: string,
	options: WalletCandidateOptions = {}
): Promise<AssetCandidate[]> {
	if (!ADDRESS.test(address)) throw new TypeError('invalid-wallet-address');
	const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
	const graphql = options.graphql ?? arweaveGraphqlEndpoint();
	const scan = options.scan ?? createWalletCandidateScan(address, graphql);
	if (scan.address !== address || scan.graphql !== graphql) {
		throw new TypeError('wallet-candidate-scan-scope-mismatch');
	}
	const requestPage = async (
		active: Set<WalletCandidateAlias>,
		cursors: Record<WalletCandidateAlias, string | null>
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
			}
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
				])
			),
		};
	};
	const pageUpdates = (
		requestedAliases: WalletCandidateAlias[],
		connections: Map<WalletCandidateAlias, GraphqlConnection>
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
				nextCursors[alias] = advanceGraphqlCursor(
					connection,
					nextVisited[alias],
					'asset-discovery-pagination-stalled'
				);
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
					const reachedWatermark =
						watermark !== null && connection.edges.some(({ node }) => node.id === watermark);
					if (reachedWatermark || (watermark === null && !connection.pageInfo.hasNextPage)) {
						nextActive.delete(alias);
					} else if (!connection.pageInfo.hasNextPage) {
						throw new Error('asset-discovery-head-watermark-missing');
					} else {
						nextCursors[alias] = advanceGraphqlCursor(
							connection,
							nextVisited[alias],
							'asset-discovery-head-pagination-stalled'
						);
					}
				}
				const page = pageUpdates(requestedAliases, connections);
				await options.onPage?.(
					sortCandidates([...page.processIds].map((processId) => page.updates.get(processId)!))
				);
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
	const graphql = options.graphql ?? arweaveGraphqlEndpoint();
	const found = new Map<string, AssetCandidate>();
	const recipients = [...new Set((options.recipients ?? []).filter((id) => ADDRESS.test(id)))];
	let cursor: string | null = null;
	let pages = 0;
	const visited = new Set<string>();
	const maxPages = Math.max(1, Math.floor(options.maxPages ?? MAX_GRAPHQL_PAGES));

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
			}
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
		pages += 1;
		if (pages >= maxPages || !connection.pageInfo.hasNextPage) return sortCandidates([...found.values()]);
		cursor = advanceGraphqlCursor(connection, visited, 'asset-activity-pagination-stalled');
	}
}

export async function discoverMarketActivityBatched(options: BatchedMarketActivityOptions): Promise<AssetCandidate[]> {
	const recipients = [...new Set(options.recipients.filter((id) => ADDRESS.test(id)))];
	const batchSize = Math.max(1, Math.min(100, Math.floor(options.batchSize ?? 100)));
	const concurrency = Math.max(1, Math.min(4, Math.floor(options.concurrency ?? 2)));
	const batches = Array.from({ length: Math.ceil(recipients.length / batchSize) }, (_, index) =>
		recipients.slice(index * batchSize, (index + 1) * batchSize)
	);
	const found = new Map<string, AssetCandidate>();
	let nextBatch = 0;
	const failures: unknown[] = [];

	await Promise.all(
		Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
			while (true) {
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
		})
	);
	options.signal?.throwIfAborted();
	if (failures.length) {
		const messages = failures
			.map((failure) => (failure instanceof Error ? failure.message : String(failure)))
			.sort();
		throw new AggregateError(failures, `asset-activity-batch-failed: ${messages.join('; ')}`);
	}
	return sortCandidates([...found.values()]);
}

export async function discoverCollectionActivityPage(
	options: CollectionActivityPageOptions = {}
): Promise<CollectionActivityPage> {
	const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
	const graphql = options.graphql ?? arweaveGraphqlEndpoint();
	const recipients = [...new Set((options.recipients ?? []).filter((id) => ADDRESS.test(id)))];
	const actions = [
		...new Set(
			(options.actions ?? ['make-offer', 'register-interest', 'transfer', 'cancel-order']).filter((action) =>
				['make-offer', 'register-interest', 'transfer', 'cancel-order'].includes(action)
			)
		),
	];
	const cursor = options.cursor?.trim() || null;
	const pageSize = Math.max(1, Math.min(GRAPHQL_PAGE_SIZE, Math.floor(options.pageSize ?? GRAPHQL_PAGE_SIZE)));

	if (options.recipients !== undefined && !recipients.length) {
		return { events: [], cursor: null, hasNextPage: false, totalCount: 0 };
	}
	if (!actions.length) return { events: [], cursor: null, hasNextPage: false, totalCount: 0 };

	options.signal?.throwIfAborted();
	const includeCount = !cursor;
	const { response, body: payload } = await fetchJsonWithDeadline<any>(
		fetcher,
		graphql,
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				query: includeCount ? COLLECTION_ACTIVITY_PAGE_QUERY : COLLECTION_ACTIVITY_CURSOR_PAGE_QUERY,
				variables: {
					...(cursor ? { cursor } : {}),
					first: pageSize,
					recipients: options.recipients === undefined ? null : recipients,
					tags: [{ name: 'action', values: actions }],
				},
			}),
			signal: options.signal,
		},
		{
			timeoutMs: options.requestTimeoutMs,
			timeoutError: 'collection-activity-graphql-timeout',
		}
	);
	if (!response.ok) throw new Error(`collection-activity-graphql-${response.status}`);
	if (!payload) throw new Error('collection-activity-graphql-empty');
	if (payload?.errors?.length) throw new Error('collection-activity-graphql-error');
	const connection = decodeGraphqlConnection(payload, 'transactions', 'collection-activity-graphql-schema');
	let events = connection.edges.flatMap((edge) => {
		const event = activityEventFromNode(edge.node);
		if (!event || (options.acceptProcessId && !options.acceptProcessId(event.processId))) return [];
		return [event];
	});
	if (options.requiredExecutionDevice && events.length) {
		const processIds = [...new Set(events.map((event) => event.processId))];
		const verified = await verifyProcessDevices(
			processIds,
			options.requiredExecutionDevice,
			fetcher,
			graphql,
			options
		);
		events = events.filter((event) => verified.has(event.processId));
	}
	const rawCount = includeCount ? payload?.data?.transactions?.count : undefined;
	const parsedCount = typeof rawCount === 'string' && /^\d+$/.test(rawCount) ? Number(rawCount) : rawCount;
	const totalCount =
		typeof parsedCount === 'number' && Number.isSafeInteger(parsedCount) && parsedCount >= 0 ? parsedCount : null;
	const nextCursor = connection.pageInfo.hasNextPage ? connection.edges.at(-1)?.cursor ?? null : null;
	if (connection.pageInfo.hasNextPage && !nextCursor) {
		throw new Error('collection-activity-pagination-stalled');
	}
	return {
		events,
		cursor: nextCursor,
		hasNextPage: connection.pageInfo.hasNextPage,
		totalCount,
	};
}

export async function discoverCollectionActivity(
	options: CollectionActivityOptions
): Promise<CollectionActivityEvent[]> {
	const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
	const graphql = options.graphql ?? arweaveGraphqlEndpoint();
	const recipients = [...new Set((options.recipients ?? []).filter((id) => ADDRESS.test(id)))];
	const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 100)));
	const actions = [
		...new Set(
			(options.actions ?? ['make-offer', 'register-interest', 'transfer', 'cancel-order']).filter((action) =>
				['make-offer', 'register-interest', 'transfer', 'cancel-order'].includes(action)
			)
		),
	];
	const events: CollectionActivityEvent[] = [];
	const seen = new Set<string>();
	const deviceMatches = new Map<string, boolean>();
	let cursor: string | null = null;
	const visited = new Set<string>();

	if (options.recipients !== undefined && !recipients.length) return [];
	if (!actions.length) return [];
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
								values: actions,
							},
						],
					},
				}),
				signal: options.signal,
			},
			{
				timeoutMs: options.requestTimeoutMs,
				timeoutError: 'collection-activity-graphql-timeout',
			}
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
					options
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

export function pendingAssetOffersFromActivity(
	state: AssetState,
	events: CollectionActivityEvent[]
): PendingAssetOffer[] {
	return events
		.filter(
			(event) =>
				event.action === 'make-offer' &&
				ADDRESS.test(event.actor) &&
				event.quantity === '1' &&
				/^[1-9]\d*$/.test(event.asking ?? '') &&
				// An indexed offer is pending only while the process scheduler remains
				// behind its block. Once the scheduler passes it, live orders are the
				// sole acceptance record, even when the transaction itself was mined.
				event.height > state.swapHeight &&
				!Object.prototype.hasOwnProperty.call(state.orders, event.id)
		)
		.map(({ id, actor, height, timestamp, asking, quantity }) => ({
			id,
			actor,
			height,
			timestamp,
			...(asking ? { asking } : {}),
			...(quantity ? { quantity } : {}),
		}))
		.sort(
			(left, right) =>
				right.height - left.height || right.timestamp - left.timestamp || left.id.localeCompare(right.id)
		);
}

export async function discoverPendingAssetOffers(
	processId: string,
	state: AssetState,
	options: Pick<CandidateOptions, 'fetch' | 'graphql' | 'requestTimeoutMs' | 'signal'> & { limit?: number } = {}
): Promise<PendingAssetOffer[]> {
	if (!ADDRESS.test(processId)) throw new TypeError('invalid-asset-process-id');
	const events = await discoverCollectionActivity({
		...options,
		recipients: [processId],
		actions: ['make-offer'],
		limit: options.limit ?? 24,
	});
	return pendingAssetOffersFromActivity(state, events);
}

export async function discoverCollectionActivityBatched(
	options: BatchedCollectionActivityOptions
): Promise<CollectionActivityEvent[]> {
	const recipients = [...new Set(options.recipients.filter((id) => ADDRESS.test(id)))];
	const batchSize = Math.max(1, Math.min(100, Math.floor(options.batchSize ?? 100)));
	const concurrency = Math.max(1, Math.min(4, Math.floor(options.concurrency ?? 2)));
	const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 100)));
	const batches = Array.from({ length: Math.ceil(recipients.length / batchSize) }, (_, index) =>
		recipients.slice(index * batchSize, (index + 1) * batchSize)
	);
	const found = new Map<string, CollectionActivityEvent>();
	let nextBatch = 0;
	const failures: unknown[] = [];

	await Promise.all(
		Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
			while (true) {
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
		})
	);
	options.signal?.throwIfAborted();
	if (failures.length) {
		const messages = failures
			.map((failure) => (failure instanceof Error ? failure.message : String(failure)))
			.sort();
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
	options: Pick<CollectionActivityOptions, 'requestTimeoutMs' | 'signal'>
): Promise<Set<string>> {
	if (!device.trim() || ids.some((id) => !ADDRESS.test(id))) {
		throw new TypeError('invalid-collection-activity-device-filter');
	}
	const verified = new Set<string>();
	const graphqlHost = new URL(graphql).hostname;
	const batchSize =
		graphqlHost === 'arweave.net' || graphqlHost.endsWith('.arweave.net')
			? ARWEAVE_GRAPHQL_ID_BATCH_SIZE
			: GRAPHQL_ID_BATCH_SIZE;
	const batches = Array.from({ length: Math.ceil(ids.length / batchSize) }, (_, index) =>
		ids.slice(index * batchSize, (index + 1) * batchSize)
	);
	for (const batch of batches) {
		const requested = new Set(batch);
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
						variables: { cursor, ids: batch, devices: [device] },
					}),
					signal: options.signal,
				},
				{
					timeoutMs: options.requestTimeoutMs,
					timeoutError: 'collection-activity-device-graphql-timeout',
				}
			);
			if (!response.ok) throw new Error(`collection-activity-device-graphql-${response.status}`);
			if (!payload) throw new Error('collection-activity-device-graphql-empty');
			if (payload?.errors?.length) throw new Error('collection-activity-device-graphql-error');
			const connection = decodeGraphqlConnection(
				payload,
				'transactions',
				'collection-activity-device-graphql-schema'
			);
			for (const edge of connection.edges) {
				if (!requested.has(edge.node.id)) throw new Error('collection-activity-device-graphql-schema');
				verified.add(edge.node.id);
			}
			if (!connection.pageInfo.hasNextPage) break;
			cursor = advanceGraphqlCursor(connection, visited, 'collection-activity-device-pagination-stalled');
		}
	}
	return verified;
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
				!ADDRESS.test(edge.node.id)
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
	options: ResolutionOptions = {}
): Promise<ResolvedAsset[]> {
	const resolver = createAssetCandidateResolver(collections, options);
	resolver.enqueue(candidates);
	return resolver.finish();
}

export function createAssetCandidateResolver(collections: Collection[], options: ResolutionOptions = {}) {
	const pending: AssetCandidate[] = [];
	const resolved: ResolvedAsset[] = [];
	const concurrency = Math.max(1, Math.min(16, Math.floor(options.concurrency ?? ASSET_RESOLUTION_CONCURRENCY)));
	const read = options.read ?? ((processId: string, signal?: AbortSignal) => readAssetState(processId, { signal }));
	let active = 0;
	let sealed = false;
	let failure: unknown;
	let finishPromise: Promise<ResolvedAsset[]> | undefined;
	let resolveFinish: ((value: ResolvedAsset[]) => void) | undefined;
	let rejectFinish: ((reason?: unknown) => void) | undefined;

	const settle = () => {
		if (!finishPromise) return;
		if (failure !== undefined) {
			rejectFinish?.(failure);
		} else if (sealed && active === 0 && pending.length === 0) {
			resolveFinish?.(resolved.sort((a, b) => compareActivity(a.activity, b.activity)));
		} else {
			return;
		}
		resolveFinish = undefined;
		rejectFinish = undefined;
		options.signal?.removeEventListener('abort', onAbort);
	};
	const fail = (reason: unknown) => {
		failure ??= reason ?? new DOMException('Aborted', 'AbortError');
		pending.length = 0;
		settle();
	};
	const onAbort = () => fail(options.signal?.reason);
	const resolveCandidate = async (candidate: AssetCandidate) => {
		if (!isVisibleAssetId(candidate.processId)) {
			options.onSettled?.(null, candidate);
			return;
		}
		let computed: ComputeResult;
		let result: ResolvedAsset | null;
		try {
			computed = await read(candidate.processId, options.signal);
			options.signal?.throwIfAborted();
			result = supportedAsset(candidate, computed, collections);
		} catch (error) {
			if (options.signal?.aborted) throw options.signal.reason ?? error;
			options.onSettled?.(null, candidate, error);
			return;
		}
		if (result) resolved.push(result);
		options.onSettled?.(result, candidate);
		if (computed.revalidation && options.onRevalidated) {
			void computed.revalidation.then(
				(fresh) => {
					if (!options.signal?.aborted && isVisibleAssetId(candidate.processId)) {
						options.onRevalidated?.(supportedAsset(candidate, fresh, collections), candidate);
					}
				},
				(error) => {
					if (!options.signal?.aborted) options.onRevalidated?.(null, candidate, error);
				}
			);
		}
	};
	const pump = () => {
		while (failure === undefined && active < concurrency && pending.length) {
			active += 1;
			void resolveCandidate(pending.shift()!)
				.catch(fail)
				.finally(() => {
					active -= 1;
					pump();
					settle();
				});
		}
	};

	options.signal?.addEventListener('abort', onAbort, { once: true });
	if (options.signal?.aborted) onAbort();
	return {
		enqueue(candidates: AssetCandidate[]) {
			if (sealed) throw new Error('asset-candidate-resolver-finished');
			if (failure !== undefined) throw failure;
			pending.push(...candidates.filter((candidate) => isVisibleAssetId(candidate.processId)));
			pending.sort(compareActivity);
			pump();
		},
		finish() {
			sealed = true;
			finishPromise ??= new Promise<ResolvedAsset[]>((resolve, reject) => {
				resolveFinish = resolve;
				rejectFinish = reject;
			});
			settle();
			return finishPromise;
		},
	};
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
		if (!isVisibleAssetId(candidate.processId)) return false;
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
			index.tokens && (candidateMatchesFungibleContract(candidate) || candidateMatchesAtomicContract(candidate))
		);
	});
}

export function restrictAssetCandidates(candidates: AssetCandidate[], collections: Collection[]): AssetCandidate[] {
	return restrictAssetCandidatesWithIndex(candidates, candidateCollectionIndex(collections));
}

export async function verifyAssetCandidateSupport(
	candidates: AssetCandidate[],
	collections: Collection[],
	options: Pick<CandidateOptions, 'fetch' | 'graphql' | 'requestTimeoutMs' | 'signal'> & {
		onVerified?: (candidates: AssetCandidate[]) => void | Promise<void>;
	} = {}
): Promise<AssetCandidateSupportResult> {
	const { supported, unverified: unindexed } = partitionAssetCandidateSupport(candidates, collections);
	if (!unindexed.length) return { supported, unavailable: [] };
	const verified = new Set<string>();
	const unavailable = new Map<string, unknown>();
	const ids = [...new Set(unindexed.map((candidate) => candidate.processId))];
	const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
	const graphql = options.graphql ?? arweaveGraphqlEndpoint();
	const graphqlHost = new URL(graphql).hostname;
	const batchSize =
		graphqlHost === 'arweave.net' || graphqlHost.endsWith('.arweave.net')
			? ARWEAVE_GRAPHQL_ID_BATCH_SIZE
			: GRAPHQL_ID_BATCH_SIZE;
	const chunks = Array.from({ length: Math.ceil(ids.length / batchSize) }, (_, index) =>
		ids.slice(index * batchSize, (index + 1) * batchSize)
	);
	let nextChunk = 0;
	const verifyChunk = async (chunk: string[]) => {
		const requested = new Set(chunk);
		const verifiedChunk = new Set<string>();
		options.signal?.throwIfAborted();
		const { response, body: payload } = await fetchJsonWithDeadline<any>(
			fetcher,
			graphql,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: VERIFY_ASSET_PROCESSES_QUERY, variables: { ids: chunk } }),
				signal: options.signal,
			},
			{
				timeoutMs: options.requestTimeoutMs,
				timeoutError: 'asset-support-graphql-timeout',
			}
		);
		if (!response.ok) throw new Error(`asset-support-graphql-${response.status}`);
		if (!payload) throw new Error('asset-support-graphql-empty');
		if (payload.errors?.length) throw new Error('asset-support-graphql-error');
		// `transactions` keeps older callers and focused mocks compatible while deployed
		// GraphQL responses use the two explicit contract aliases.
		const fungible = decodeGraphqlConnection(
			payload,
			payload.data?.fungible ? 'fungible' : 'transactions',
			'asset-support-graphql-schema'
		);
		const legacyFungible = ['legacyFungibleHintStyle', 'legacyFungibleAssetType']
			.filter((key) => payload.data?.[key])
			.map((key) => decodeGraphqlConnection(payload, key, 'asset-support-graphql-schema'));
		const atomic = payload.data?.atomic
			? decodeGraphqlConnection(payload, 'atomic', 'asset-support-graphql-schema')
			: { pageInfo: { hasNextPage: false }, edges: [] };
		if (
			fungible.pageInfo.hasNextPage ||
			legacyFungible.some((connection) => connection.pageInfo.hasNextPage) ||
			atomic.pageInfo.hasNextPage
		) {
			throw new Error('asset-support-pagination-stalled');
		}
		for (const edge of [fungible, ...legacyFungible].flatMap((connection) => connection.edges)) {
			if (!requested.has(edge.node.id)) throw new Error('asset-support-graphql-schema');
			verified.add(edge.node.id);
			verifiedChunk.add(edge.node.id);
		}
		for (const edge of atomic.edges) {
			if (!requested.has(edge.node.id) || !atomicProcessNode(edge.node)) {
				throw new Error('asset-support-graphql-schema');
			}
			verified.add(edge.node.id);
			verifiedChunk.add(edge.node.id);
		}
		return restrictAssetCandidates(
			unindexed.filter((candidate) => verifiedChunk.has(candidate.processId)),
			collections
		);
	};
	const workers = Array.from({ length: Math.min(ASSET_SUPPORT_CONCURRENCY, chunks.length) }, async () => {
		while (nextChunk < chunks.length) {
			options.signal?.throwIfAborted();
			const chunk = chunks[nextChunk++];
			let verifiedCandidates: AssetCandidate[];
			try {
				verifiedCandidates = await verifyChunk(chunk);
			} catch (error) {
				if (options.signal?.aborted) throw options.signal.reason ?? error;
				for (const processId of chunk) unavailable.set(processId, error);
				continue;
			}
			if (verifiedCandidates.length) await options.onVerified?.(verifiedCandidates);
		}
	});
	await Promise.all(workers);
	const verifiedCandidates = unindexed.filter((candidate) => verified.has(candidate.processId));
	const verifiedIds = new Set(verifiedCandidates.map((candidate) => candidate.processId));
	const supportedIds = new Set(supported.map((candidate) => candidate.processId));
	return {
		supported: restrictAssetCandidates(candidates, collections).filter(
			(candidate) => supportedIds.has(candidate.processId) || verifiedIds.has(candidate.processId)
		),
		unavailable: unindexed
			.filter((candidate) => unavailable.has(candidate.processId))
			.map((candidate) => ({ candidate, error: unavailable.get(candidate.processId) })),
	};
}

export function partitionAssetCandidateSupport(
	candidates: AssetCandidate[],
	collections: Collection[]
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

function candidateMatchesAtomicContract(candidate: AssetCandidate): boolean {
	return (
		candidate.processDevice === 'process@1.0' &&
		candidate.device === 'token@1.0' &&
		candidate.assetType === 'non-fungible' &&
		candidate.swapDevice === 'arweave-swap@1.0' &&
		candidate.schedulerDevice === 'arweave-scheduler@1.0' &&
		candidate.schedulerMode === 'all'
	);
}

function atomicProcessNode(node: GraphqlNode): boolean {
	const tags = Object.fromEntries((node.tags ?? []).map(({ name, value }) => [name.toLowerCase(), value]));
	return (
		ADDRESS.test(node.id) &&
		tags.device === 'process@1.0' &&
		tags['execution-device'] === 'token@1.0' &&
		tags['hint-ui-style'] === 'non-fungible' &&
		tags['swap-device'] === 'arweave-swap@1.0' &&
		tags['scheduler-device'] === 'arweave-scheduler@1.0' &&
		tags['scheduler-mode'] === 'all' &&
		tags['total-supply'] === '1' &&
		tags.denomination === '0' &&
		tags.ticker === 'ASSET' &&
		ADDRESS.test(tags['initial-holder'] ?? '') &&
		(!tags['asset-data'] || ADDRESS.test(tags['asset-data'])) &&
		isSupportedAssetContentType(tags['asset-content-type'] ?? tags['content-type']) &&
		(!tags['asset-artwork'] || ADDRESS.test(tags['asset-artwork'])) &&
		Boolean(tags.name?.trim())
	);
}

function bazarAtomicAssetFromNode(node: GraphqlNode): { asset: AssetSummary; collection: Collection } | null {
	if (!isVisibleAssetId(node.id) || !atomicProcessNode(node)) return null;
	const tags = Object.fromEntries(
		(node.tags ?? []).map(({ name: tagName, value }) => [tagName.toLowerCase(), value])
	);
	const asset = assetFromMintState(node.id, tags);
	if (!asset) return null;
	const collectionName = String(tags['base-collection'] ?? '').trim() || CREATED_COLLECTION_NAME;
	return {
		asset,
		collection: {
			id: CREATED_COLLECTION_ID,
			name: collectionName,
			description: 'One-of-one media discovered from its permanent Bazar creation record.',
			kind: 'images',
			assets: [asset],
			total: 1,
		},
	};
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
		(collection) => collection.kind !== 'names' && Boolean(collectionAsset(collection, activity.processId))
	);
	if (indexedCollection) {
		if (computed.state.device !== 'token@1.0') return null;
		const asset = collectionAsset(indexedCollection, activity.processId, computed.state);
		const liveAtomicAsset = bazarAtomicAssetFromState(activity.processId, computed.state, computed.provider)?.asset;
		return asset
			? {
					asset: liveAtomicAsset
						? {
								...asset,
								name:
									asset.name === `${asset.id.slice(0, 7)}…${asset.id.slice(-6)}`
										? liveAtomicAsset.name
										: asset.name,
								...(liveAtomicAsset.image ? { image: liveAtomicAsset.image } : {}),
								...(liveAtomicAsset.media ? { media: liveAtomicAsset.media } : {}),
						  }
						: asset,
					collection: indexedCollection,
					state: computed.state,
					provider: computed.provider,
					activity,
			  }
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

	const atomicAsset = bazarAtomicAssetFromState(activity.processId, computed.state, computed.provider);
	if (atomicAsset) {
		return { ...atomicAsset, state: computed.state, provider: computed.provider, activity };
	}

	if (!['carrier@1.0', 'name-token@1.0'].includes(computed.state.device)) return null;
	const names = collections.find((collection) => collection.kind === 'names');
	if (!names) return null;
	const asset = collectionAsset(names, activity.processId);
	if (!asset) return null;
	return { asset, collection: names, state: computed.state, provider: computed.provider, activity };
}

export function bazarAtomicAssetFromState(
	processId: string,
	state: AssetState,
	provider?: string
): { asset: AssetSummary; collection: Collection } | null {
	if (
		!isVisibleAssetId(processId) ||
		state.device !== 'token@1.0' ||
		state.totalSupply !== '1' ||
		state.denomination !== 0 ||
		state.raw.device !== 'process@1.0' ||
		state.raw['execution-device'] !== 'token@1.0' ||
		state.raw['hint-ui-style'] !== 'non-fungible' ||
		state.raw['swap-device'] !== 'arweave-swap@1.0' ||
		state.raw['scheduler-device'] !== 'arweave-scheduler@1.0' ||
		state.raw['scheduler-mode'] !== 'all' ||
		state.raw.ticker !== 'ASSET'
	) {
		return null;
	}
	const asset = assetFromMintState(processId, state.raw, '', provider);
	if (!asset) return null;
	const name = String(state.raw['base-collection'] ?? '').trim() || CREATED_COLLECTION_NAME;
	return {
		asset,
		collection: {
			id: CREATED_COLLECTION_ID,
			name,
			description: 'One-of-one media discovered from its live Arweave process.',
			kind: 'images',
			assets: [asset],
			total: 1,
		},
	};
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
		activityIds: [node.id],
		sources: [source],
		...(source === 'initial-holder'
			? {
					processDevice: tags.device,
					device: tags['execution-device'] ?? tags.device,
					collection: tags['base-collection'],
					assetType: assetUiStyle(tags),
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
		...(['make-offer', 'register-interest', 'transfer'].includes(action) &&
		/^[1-9]\d*$/.test(
			action === 'make-offer'
				? tags['offer-quantity'] ?? ''
				: action === 'register-interest'
				? tags['fill-quantity'] ?? ''
				: tags.quantity ?? tags['token-quantity'] ?? ''
		)
			? {
					quantity:
						action === 'make-offer'
							? tags['offer-quantity']
							: action === 'register-interest'
							? tags['fill-quantity']
							: tags.quantity ?? tags['token-quantity'],
			  }
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
