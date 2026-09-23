import {
	type AssetSummary,
	type Collection,
	collectionAsset,
	collectionSearchAssets,
	interleaveCollectionAssets,
	isVisibleAssetId,
	isVisibleCollectionId,
	marketplaceAssetMatchesSearch,
} from 'api/collections';
import type { AssetCandidate, CollectionActivityEvent, ResolvedAsset } from 'api/discovery';

import { collectionActivityVersion, collectionAssetWindowDelta } from 'features/Activity';
import type { RequestFailureKind, RequestFailureSource } from 'helpers/app-error';
import { winstonToAr } from 'helpers/ar-units';

export type HomeMarketSummary =
	| { status: 'resolved'; value: string | null }
	| { status: 'unindexed' }
	| { status: 'unavailable'; source: RequestFailureSource; kind: RequestFailureKind };

export function retryableHomeSummaryKeys(visibleKeys: string[], summaries: Record<string, HomeMarketSummary>) {
	return visibleKeys.filter((key) => {
		const summary = summaries[key];
		return !summary || summary.status === 'unavailable';
	});
}

export function homeSummaryRequestKeys(
	visibleKeys: string[],
	summaries: Record<string, HomeMarketSummary>,
	inFlightKeys: Iterable<string>,
	retryKeys: ReadonlySet<string>
) {
	const inFlight = new Set(inFlightKeys);
	return visibleKeys.filter((key) => retryKeys.has(key) || (!summaries[key] && !inFlight.has(key)));
}

export type HomeActivityScan = {
	members: Set<string>;
	completed: Set<string>;
	candidates: Map<string, AssetCandidate>;
	indexComplete: boolean;
};

export function reconcileHomeActivityScan(
	current: HomeActivityScan | undefined,
	recipients: string[]
): HomeActivityScan {
	const uniqueRecipients = [...new Set(recipients)];
	const delta = collectionAssetWindowDelta(current?.members ?? [], uniqueRecipients);
	if (!current || delta.reset) {
		return {
			members: new Set(uniqueRecipients),
			completed: new Set(),
			candidates: new Map(),
			indexComplete: false,
		};
	}
	const rescan = current.indexComplete && delta.added.length > 0;
	return {
		members: new Set(uniqueRecipients),
		completed: rescan ? new Set() : new Set(current.completed),
		candidates: new Map(current.candidates),
		indexComplete: rescan ? false : current.indexComplete,
	};
}

export function commitHomeActivityBatch(scan: HomeActivityScan, candidates: AssetCandidate[], recipients: string[]) {
	const scope = new Set(recipients);
	if (candidates.some((candidate) => !scope.has(candidate.processId))) {
		throw new TypeError('home-activity-batch-out-of-scope');
	}
	for (const recipient of recipients) scan.completed.add(recipient);
	for (const candidate of candidates) scan.candidates.set(candidate.processId, candidate);
}

export function pendingHomeActivityRecipients(scan: HomeActivityScan, recipients: string[]) {
	return [...new Set(recipients)].filter((recipient) => !scan.completed.has(recipient));
}

export function completeHomeActivityScan(scan: HomeActivityScan, recipients: string[]) {
	if (pendingHomeActivityRecipients(scan, recipients).length) {
		throw new TypeError('incomplete-home-activity-scan');
	}
	scan.indexComplete = true;
}

export type HomeFloorScan = {
	scope: string;
	candidates: Map<string, string>;
	settled: Map<string, bigint | null>;
	failures: Map<string, RequestFailureKind>;
};

export function reconcileHomeFloorScan(
	current: HomeFloorScan | undefined,
	scope: string,
	candidateActivity: Array<Pick<AssetCandidate, 'processId' | 'height' | 'timestamp'>>
): HomeFloorScan {
	const candidates = new Map(
		candidateActivity.map((candidate) => [candidate.processId, `${candidate.height}:${candidate.timestamp}`])
	);
	if (!current || current.scope !== scope) {
		return { scope, candidates, settled: new Map(), failures: new Map() };
	}
	const unchanged = (processId: string) => current.candidates.get(processId) === candidates.get(processId);
	return {
		scope,
		candidates,
		settled: new Map([...current.settled].filter(([processId]) => unchanged(processId))),
		failures: new Map([...current.failures].filter(([processId]) => unchanged(processId))),
	};
}

export function pendingHomeFloorCandidates(scan: HomeFloorScan) {
	return [...scan.candidates.keys()].filter((processId) => !scan.settled.has(processId));
}

export function homeFloorCandidateNeedsResolution(
	scan: HomeFloorScan | undefined,
	scope: string,
	candidate: Pick<AssetCandidate, 'processId' | 'height' | 'timestamp'>
) {
	return !(
		scan?.scope === scope &&
		scan.candidates.get(candidate.processId) === `${candidate.height}:${candidate.timestamp}` &&
		scan.settled.has(candidate.processId)
	);
}

export function commitHomeFloorResult(
	scan: HomeFloorScan,
	processId: string,
	value: bigint | null,
	failure?: RequestFailureKind
) {
	if (!scan.candidates.has(processId)) throw new TypeError('home-floor-result-out-of-scope');
	if (failure) {
		scan.settled.delete(processId);
		scan.failures.set(processId, failure);
		return;
	}
	scan.failures.delete(processId);
	scan.settled.set(processId, value);
}

export function publishHomeListingResult(
	current: Record<string, AssetSummary[]>,
	collectionId: string,
	asset: AssetSummary,
	listed: boolean
) {
	const previous = current[collectionId] ?? [];
	const existing = previous.findIndex((candidate) => candidate.id === asset.id);
	if (listed && existing >= 0) {
		if (previous[existing] === asset) return current;
		return {
			...current,
			[collectionId]: [...previous.slice(0, existing), asset, ...previous.slice(existing + 1)],
		};
	}
	if (!listed && existing < 0) return current;
	return {
		...current,
		[collectionId]: listed
			? [...previous, asset]
			: [...previous.slice(0, existing), ...previous.slice(existing + 1)],
	};
}

export function reconcileHomeListingAssets(previous: AssetSummary[], assetIds: string[], collection: Collection) {
	const previousById = new Map(previous.map((asset) => [asset.id, asset]));
	return assetIds.flatMap((assetId) => {
		const asset = previousById.get(assetId) ?? collectionAsset(collection, assetId);
		return asset ? [asset] : [];
	});
}

export function homeFloorScanSummary(scan: HomeFloorScan): HomeMarketSummary {
	if (!scan.candidates.size) return { status: 'unindexed' };
	if (scan.failures.size) {
		return {
			status: 'unavailable',
			source: 'compute',
			kind: [...scan.failures.values()].includes('rate-limited') ? 'rate-limited' : 'unavailable',
		};
	}
	if ([...scan.candidates.keys()].some((processId) => !scan.settled.has(processId))) {
		throw new TypeError('incomplete-home-floor-scan');
	}
	let floor: bigint | null = null;
	for (const asking of scan.settled.values()) {
		if (asking !== null && (floor === null || asking < floor)) floor = asking;
	}
	return { status: 'resolved', value: floor === null ? null : `${winstonToAr(floor.toString())} AR` };
}

export type HomeSummaryRetryGroup = 'assets' | 'collections';

export type HomeSummaryRetryRun = {
	token: number;
	pending: Set<HomeSummaryRetryGroup>;
};

// The next retry run over every group with failures, or null when nothing failed.
export function startHomeSummaryRetry(
	run: HomeSummaryRetryRun,
	failedAssetIds: string[],
	failedCollectionIds: string[]
): HomeSummaryRetryRun | null {
	const pending = new Set<HomeSummaryRetryGroup>();
	if (failedAssetIds.length) pending.add('assets');
	if (failedCollectionIds.length) pending.add('collections');
	return pending.size ? { token: run.token + 1, pending } : null;
}

export function completeHomeSummaryRetryGroup(
	run: HomeSummaryRetryRun,
	token: number,
	group: HomeSummaryRetryGroup,
	activeRequests: number
) {
	if (run.token !== token || activeRequests > 0 || !run.pending.has(group)) return false;
	run.pending.delete(group);
	return run.pending.size === 0;
}

export function homeMarketSummaryLabel(
	summary: HomeMarketSummary | undefined,
	emptyLabel: string,
	unindexedLabel = emptyLabel
) {
	if (!summary) return 'Checking…';
	if (summary.status === 'unavailable') return 'Unavailable';
	if (summary.status === 'unindexed') return unindexedLabel;
	return summary.value ?? emptyLabel;
}

export function homeMarketSummaryListed(summary: HomeMarketSummary | undefined) {
	return summary?.status === 'resolved' && Boolean(summary.value);
}

export function homeCollectionAssetCountLabel(collection: Collection) {
	if (collection.kind === 'names' && collection.hasMore && collection.assets.length === 0) return 'N/A';
	return (collection.total ?? collection.assets.length).toLocaleString();
}

export type HomeTab = 'discover' | 'collections' | 'activity';

export type HomeAssetView = 'all' | 'listed' | 'price-low' | 'price-high';

export type HomeCollectionSort = 'recent' | 'newest' | 'oldest';

const HOME_TABS = new Set<HomeTab>(['discover', 'collections', 'activity']);

export function homeTabFromPathname(pathname: string): HomeTab {
	const tab = pathname.replace(/^\/+|\/+$/g, '');
	return HOME_TABS.has(tab as HomeTab) ? (tab as HomeTab) : 'discover';
}

export function homeTabPath(tab: HomeTab) {
	return `/${tab}`;
}

export function homeRouteSearch(search: string) {
	const params = new URLSearchParams(search);
	params.delete('tab');
	const value = params.toString();
	return value ? `?${value}` : '';
}

export type HomeListingActivity = Pick<AssetCandidate, 'processId' | 'height' | 'timestamp'>;

export function compareHomeCollections(
	left: Collection,
	right: Collection,
	sort: HomeCollectionSort,
	activityByCollection: ReadonlyMap<string, HomeListingActivity>
) {
	const leftActivity = activityByCollection.get(left.id);
	const rightActivity = activityByCollection.get(right.id);
	if (sort === 'recent') {
		const point = (collection: Collection, activity: HomeListingActivity | undefined) => {
			const created = collection.createdAt
				? { height: collection.createdHeight ?? 0, timestamp: Math.floor(collection.createdAt / 1_000) }
				: collection.createdHeight === undefined
				? undefined
				: { height: collection.createdHeight, timestamp: 0 };
			if (!created || (activity && activity.timestamp >= created.timestamp)) return activity;
			return created;
		};
		const leftPoint = point(left, leftActivity);
		const rightPoint = point(right, rightActivity);
		if (leftPoint && !rightPoint) return -1;
		if (!leftPoint && rightPoint) return 1;
		if (leftPoint && rightPoint) {
			const activityOrder = rightPoint.timestamp - leftPoint.timestamp || rightPoint.height - leftPoint.height;
			if (activityOrder) return activityOrder;
		}
	}
	const leftCreated = left.createdHeight ?? (left.createdAt ? Math.floor(left.createdAt / 1_000) : undefined);
	const rightCreated = right.createdHeight ?? (right.createdAt ? Math.floor(right.createdAt / 1_000) : undefined);
	if (leftCreated !== undefined && rightCreated === undefined) return -1;
	if (leftCreated === undefined && rightCreated !== undefined) return 1;
	if (leftCreated !== undefined && rightCreated !== undefined && leftCreated !== rightCreated) {
		return sort === 'oldest' ? leftCreated - rightCreated : rightCreated - leftCreated;
	}
	return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

export function compareHomeListingRecency(
	leftAssetId: string,
	rightAssetId: string,
	activityByAsset: ReadonlyMap<string, HomeListingActivity>
) {
	const left = activityByAsset.get(leftAssetId);
	const right = activityByAsset.get(rightAssetId);
	if (left && !right) return -1;
	if (!left && right) return 1;
	if (!left || !right) return 0;
	return (
		right.height - left.height || right.timestamp - left.timestamp || left.processId.localeCompare(right.processId)
	);
}

export const HOME_ASSET_PAGE_SIZE = 9;

export const HOME_DISCOVER_TOKEN_PAGE_SIZE = 5;

export const HOME_LISTING_ASSET_LIMIT = HOME_ASSET_PAGE_SIZE * 4;

export const HOME_STATE_MAX_AGE = 30;

export const HOME_STATE_STALE_WHILE_REVALIDATE = 86_400;

export const HOME_LISTING_SNAPSHOT_MAX_AGE_MS = 60_000;

export function homeAssetPage<T>(items: T[], requestedPage: number, pageSize = HOME_ASSET_PAGE_SIZE) {
	const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
	const page = Math.min(Math.max(1, requestedPage), pageCount);
	const start = (page - 1) * pageSize;
	return { items: items.slice(start, start + pageSize), page, pageCount };
}

export function homeAssetVisibleForView(summary: HomeMarketSummary | undefined, view: HomeAssetView) {
	return view === 'all' || homeMarketSummaryListed(summary);
}

export function homeMarketPriceValue(value: string | null | undefined) {
	if (!value) return Number.POSITIVE_INFINITY;
	const match = value.replace(/,/g, '').match(/^([0-9]+(?:\.[0-9]+)?)\s+AR(?:\s*\/|$)/);
	const parsed = Number(match?.[1]);
	return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function homeTokenPriceChangePercent(
	events: CollectionActivityEvent[],
	now = Date.now(),
	windowComplete = true
) {
	if (!windowComplete) return null;
	const threshold = now - 24 * 60 * 60 * 1_000;
	const asks = events
		.flatMap((event) => {
			if (
				event.action !== 'make-offer' ||
				!event.asking ||
				!event.quantity ||
				(event.timestamp < 1_000_000_000_000 ? event.timestamp * 1_000 : event.timestamp) < threshold
			)
				return [];
			try {
				const asking = BigInt(event.asking);
				const quantity = BigInt(event.quantity);
				return asking > 0n && quantity > 0n ? [{ ...event, asking, quantity }] : [];
			} catch {
				return [];
			}
		})
		.sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
	if (asks.length < 2) return null;
	const first = asks[0];
	const last = asks.at(-1)!;
	const baseline = first.asking * last.quantity;
	const delta = last.asking * first.quantity - baseline;
	const scaled = (delta * 10_000n) / baseline;
	if (scaled > BigInt(Number.MAX_SAFE_INTEGER) || scaled < BigInt(Number.MIN_SAFE_INTEGER)) return null;
	return Number(scaled) / 100;
}

export type HomeTokenPriceChange = number | null | 'unavailable';

export const HOME_TOKEN_PRICE_EVENT_LIMIT = 200;

// Each token's 24-hour ask change from one shared read of recent listings. A read that hit its event limit may have
// missed older listings in the window, so it reports no change rather than a misleading one.
export function homeTokenPriceChanges(
	tokenIds: string[],
	events: CollectionActivityEvent[],
	now: number
): Record<string, HomeTokenPriceChange> {
	const windowComplete = events.length < HOME_TOKEN_PRICE_EVENT_LIMIT;
	return Object.fromEntries(
		tokenIds.map((tokenId) => [
			tokenId,
			homeTokenPriceChangePercent(
				events.filter((event) => event.processId === tokenId),
				now,
				windowComplete
			),
		])
	);
}

export function homeTokenPriceChangeLabel(change: HomeTokenPriceChange) {
	if (change === null || change === 'unavailable' || !Number.isFinite(change)) return '—';
	return `${change > 0 ? '+' : ''}${change.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function homeMarketSummariesReady(
	loading: boolean,
	keys: string[],
	summaries: Record<string, HomeMarketSummary>
) {
	return !loading && keys.every((key) => Boolean(summaries[key]));
}

export function homeMarketHasPending(loading: boolean, keys: string[], summaries: Record<string, HomeMarketSummary>) {
	return loading || keys.some((key) => !summaries[key]);
}

export function homeMarketShowsInitialLoader(pending: boolean, visibleAssetCount: number) {
	return pending && visibleAssetCount === 0;
}

export function homeListingComputeFailure<T>(failure: T | undefined, attempts: number, failures: number) {
	return failure !== undefined && attempts > 0 && failures === attempts ? failure : undefined;
}

export type HomeListingComputeCircuit = {
	scope: string;
	consecutiveFailures: number;
	failure?: unknown;
};

export function recordHomeListingComputeResult(circuit: HomeListingComputeCircuit, scope: string, failure?: unknown) {
	if (circuit.scope !== scope) {
		circuit.scope = scope;
		circuit.consecutiveFailures = 0;
		circuit.failure = undefined;
	}
	if (failure === undefined) {
		if (circuit.failure === undefined) circuit.consecutiveFailures = 0;
		return circuit.failure;
	}
	circuit.consecutiveFailures += 1;
	if (circuit.consecutiveFailures >= HOME_LISTING_ASSET_LIMIT) circuit.failure ??= failure;
	return circuit.failure;
}

export function homeMarketShellLoading(loading: boolean, collectionCount: number) {
	return loading && collectionCount === 0;
}

export function shouldLoadHomeCollectionSummaries(tab: HomeTab) {
	return tab === 'collections';
}

export function shouldLoadHomeAssetSummaries(tab: HomeTab) {
	return tab === 'discover';
}

export function homeListingSupportVersion(collections: Collection[]) {
	return collections
		.map((collection) => `${collection.id}:${collectionActivityVersion(collection)}`)
		.sort()
		.join('|');
}

export function homeScrollIndicatorMetrics(
	scrollTop: number,
	scrollHeight: number,
	clientHeight: number,
	trackHeight = clientHeight
) {
	const scrollRange = Math.max(0, scrollHeight - clientHeight);
	if (!scrollRange || clientHeight <= 0 || trackHeight <= 0) {
		return { visible: false, size: Math.max(0, trackHeight), offset: 0 };
	}
	const size = Math.min(trackHeight, Math.max(44, trackHeight * (clientHeight / scrollHeight) * 0.5));
	const offsetRange = Math.max(0, trackHeight - size);
	const progress = Math.min(1, Math.max(0, scrollTop / scrollRange));
	return { visible: true, size, offset: offsetRange * progress };
}

export type HomeAssetType = 'all' | 'tokens' | 'atomic';

export function homeAssetTypeMatches(collection: Collection, assetType: HomeAssetType): boolean {
	if (assetType === 'all') return true;
	return assetType === 'tokens' ? collection.kind === 'tokens' : collection.kind !== 'tokens';
}

export function homeDiscoveryAssets(
	collections: Collection[],
	verifiedListings: Record<string, AssetSummary[]>,
	fallbackLimit: number,
	portableListings: Array<Pick<ResolvedAsset, 'asset' | 'collection'> & { activity?: HomeListingActivity }> = []
) {
	const collectionsById = new Map(collections.map((collection) => [collection.id, collection]));
	const verified = interleaveCollectionAssets(
		collections.map((collection) => ({
			...collection,
			assets: verifiedListings[collection.id] ?? [],
		})),
		Number.POSITIVE_INFINITY
	).map(({ asset, collection }) => ({ asset, collection: collectionsById.get(collection.id)! }));
	const fallback = interleaveCollectionAssets(
		collections,
		fallbackLimit,
		(asset, collection) => Boolean(asset.image || asset.media) || collection.kind === 'tokens'
	);
	// The preview budget only bounds speculative reads. Known listings and
	// indexed tokens must survive until the view filters and pagination run.
	const tokens = collections
		.filter((collection) => collection.kind === 'tokens')
		.flatMap((collection) => collection.assets.map((asset) => ({ asset, collection })));
	const verifiedAssets = new Map(
		Object.values(verifiedListings)
			.flat()
			.map((asset) => [asset.id, asset])
	);
	const seen = new Set<string>();
	const portable = [...portableListings]
		.sort((left, right) => {
			if (!left.activity || !right.activity) return 0;
			return right.activity.height - left.activity.height || right.activity.timestamp - left.activity.timestamp;
		})
		.map((listing) => {
			const asset = verifiedAssets.get(listing.asset.id);
			return asset ? { ...listing, asset } : listing;
		});
	return [...portable, ...verified, ...tokens, ...fallback]
		.filter(({ asset, collection }) => isVisibleCollectionId(collection.id) && isVisibleAssetId(asset.id))
		.filter(({ asset }) => {
			if (seen.has(asset.id)) return false;
			seen.add(asset.id);
			return true;
		});
}

export function homeAllAssets(
	collections: Collection[],
	limit: number,
	portableListings: Array<Pick<ResolvedAsset, 'asset' | 'collection'>> = []
) {
	const indexed = interleaveCollectionAssets(
		collections,
		limit,
		(asset, collection) => Boolean(asset.image || asset.media) || collection.kind === 'tokens'
	);
	const seen = new Set<string>();
	return [...indexed, ...portableListings]
		.filter(({ asset, collection }) => isVisibleCollectionId(collection.id) && isVisibleAssetId(asset.id))
		.filter(({ asset }) => {
			if (seen.has(asset.id)) return false;
			seen.add(asset.id);
			return true;
		})
		.slice(0, limit);
}

export function homeSearchAssets(
	collections: Collection[],
	portableListings: Array<Pick<ResolvedAsset, 'asset' | 'collection'>>,
	query: string,
	limit: number,
	matches?: ReadonlyMap<Collection, AssetSummary[]>
) {
	const indexed = collections.flatMap((collection) =>
		(matches?.get(collection) ?? collectionSearchAssets(collection, query))
			.filter(
				(asset) => asset.image || asset.media || collection.kind === 'tokens' || collection.kind === 'names'
			)
			.map((asset) => ({ asset, collection }))
	);
	const seen = new Set<string>();
	return [...portableListings, ...indexed]
		.filter(({ asset, collection }) => marketplaceAssetMatchesSearch(asset, collection, query))
		.filter(({ asset }) => {
			if (seen.has(asset.id)) return false;
			seen.add(asset.id);
			return true;
		})
		.slice(0, limit);
}
