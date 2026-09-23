import {
	assetMatchesCollectionQuery,
	type AssetSummary,
	type Collection,
	collectionSearchAssets,
} from 'api/collections';
import { type AssetCandidate, isLiveListing, type ResolvedAsset } from 'api/discovery';
import { bestAskOfAsset, formatTokenAmount, liveOrdersOfAsset } from 'api/marketplace';
import type { CollectionMintPhase } from 'api/mint';

import { orderPriceLabel } from 'features/Catalogue';
import { type AppError, appError, type RequestFailureKind, requestFailureKind } from 'helpers/app-error';
import { winstonToAr } from 'helpers/ar-units';
import { formatMessage } from 'helpers/i18n';

import type { CollectionMessages } from '../messages';

export type CollectionCardPrice =
	| { status: 'resolved'; label: string | null }
	| { status: 'unindexed' }
	| { status: 'unavailable'; kind: RequestFailureKind };

export type CollectionCardPrices = Readonly<Record<string, CollectionCardPrice>>;

export type CollectionSort = 'recent' | 'price-low' | 'price-high' | 'name';

export type CollectionViewMode = 'comfortable' | 'compact' | 'list';

export type CollectionLiveListingRow = {
	asset: AssetSummary;
	depth: number;
	price: string;
	priceValue: number;
	quantity: string;
	quantityValue: number;
	total: string;
};

export type CollectionIdentity = {
	name: string;
	eyebrow: string;
	monogram: string;
};

export const COLLECTION_ALPHABET = ['all', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

function collectionEyebrowCopy(kind: Collection['kind'], messages: CollectionMessages): string {
	if (kind === 'names') return messages.collectionEyebrowNames;
	if (kind === 'tokens') return messages.collectionEyebrowTokens;
	return messages.collectionEyebrowImages;
}

export function collectionIdentity(collection: Collection, messages: CollectionMessages): CollectionIdentity {
	const name = collection.kind === 'tokens' ? messages.collectionTokensName : collection.name;
	return { name, eyebrow: collectionEyebrowCopy(collection.kind, messages), monogram: name.slice(0, 1) };
}

/** The description a collection page shows: its own manifest text, or this feature's wording for a built-in code. */
export function collectionDescriptionText(collection: Collection, messages: CollectionMessages) {
	if (collection.descriptionCode === 'fungible-tokens') return messages.collectionDescriptionFungibleTokens;
	if (collection.descriptionCode === 'arweave-names') return messages.collectionDescriptionArweaveNames;
	if (collection.descriptionCode === 'permanent-collection') return messages.collectionDescriptionPermanent;
	return collection.description;
}

export function collectionPriceValue(price?: CollectionCardPrice): number | null {
	if (price?.status !== 'resolved' || !price.label) return null;
	const value = Number.parseFloat(price.label.replace(/,/g, ''));
	return Number.isFinite(value) ? value : null;
}

export function cumulativeCollectionDepth(quantities: number[]): number[] {
	const normalized = quantities.map((quantity) => (Number.isFinite(quantity) && quantity > 0 ? quantity : 0));
	const total = normalized.reduce((sum, quantity) => sum + quantity, 0);
	let cumulative = 0;
	return normalized.map((quantity, index) => {
		cumulative += quantity;
		return total ? (cumulative / total) * 100 : ((index + 1) / normalized.length) * 100;
	});
}

export function pendingCollectionPriceAssets(
	assets: AssetSummary[],
	resolvedIds: Iterable<string>,
	primaryListingsLoading: boolean
) {
	if (primaryListingsLoading) return [];
	const resolved = new Set(resolvedIds);
	return assets.filter((asset) => !resolved.has(asset.id));
}

export function collectionRecipientsWithoutListingCandidates(
	completedRecipients: Iterable<string>,
	candidates: Pick<AssetCandidate, 'processId'>[]
) {
	const candidateIds = new Set(candidates.map((candidate) => candidate.processId));
	return [...completedRecipients].filter((processId) => !candidateIds.has(processId));
}

export type FailedListingCandidate = {
	candidate: AssetCandidate;
	kind: RequestFailureKind;
};

export type ListingResolutionOutcome = {
	processId: string;
	result: ResolvedAsset | null;
};

export type CollectionListingPublication = {
	outcome: ListingResolutionOutcome;
	price: CollectionCardPrice;
	resolved: number;
	failures: number;
	rateLimited: number;
};

export function collectionDefaultsToListed(collectionId: string) {
	return collectionId === 'arweave-names';
}

export function compareCollectionAssetNames(a: AssetSummary, b: AssetSummary) {
	return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

export type ListingAnnouncementProgress = {
	scope: string;
	resolved: number;
	failures: number;
};

export function nextListingAnnouncementProgress(
	previous: ListingAnnouncementProgress,
	current: ListingAnnouncementProgress & { total: number; loading: boolean }
): ListingAnnouncementProgress {
	const reset = previous.scope !== current.scope || current.resolved < previous.resolved;
	const baseline = reset ? { scope: current.scope, resolved: 0, failures: 0 } : previous;
	if (!current.loading) {
		return { scope: current.scope, resolved: current.resolved, failures: current.failures };
	}
	const milestone = Math.max(10, Math.ceil(current.total / 10));
	const resolved = Math.floor(current.resolved / milestone) * milestone;
	return resolved > baseline.resolved ? { scope: current.scope, resolved, failures: current.failures } : baseline;
}

export function mergeResolvedListingBatch(current: ResolvedAsset[], outcomes: Iterable<ListingResolutionOutcome>) {
	const byProcessId = new Map(current.map((result) => [result.asset.id, result]));
	for (const { processId, result } of outcomes) {
		byProcessId.delete(processId);
		if (result && isLiveListing(result)) byProcessId.set(processId, result);
	}
	return [...byProcessId.values()];
}

export function collectionAppendPhaseLabel(phase: CollectionMintPhase, messages: CollectionMessages) {
	if (phase.kind === 'asset') {
		return formatMessage(
			phase.phase.startsWith('signing') ? messages.appendPhaseAssetSigning : messages.appendPhaseAssetUploading,
			{ index: phase.index + 1, total: phase.total }
		);
	}
	if (phase.kind === 'manifest')
		return phase.phase === 'signing' ? messages.appendPhaseManifestSigning : messages.appendPhaseManifestPublishing;
	return phase.phase === 'signing' ? messages.appendPhaseCarrierSigning : messages.appendPhaseCarrierUpdating;
}

export function alphabetFilterIndex(key: string, current: number, count: number): number | null {
	if (count < 1) return null;
	if (key === 'Home') return 0;
	if (key === 'End') return count - 1;
	if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % count;
	if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + count) % count;
	return null;
}

export function alphabetBrowseIndex(direction: 'previous' | 'next', visible: number[], count: number) {
	if (count < 1) return -1;
	if (!visible.length) return direction === 'previous' ? 0 : count - 1;
	return direction === 'previous'
		? Math.max(0, visible[0] - 5)
		: Math.min(count - 1, visible[visible.length - 1] + 5);
}

/** The Arweave index failed: rate limiting versus any other unavailability, each with its own retry copy. */
export function collectionIndexFailure(cause: unknown): AppError {
	return appError(requestFailureKind(cause) === 'rate-limited' ? 'index-rate-limited' : 'index-unavailable', {
		cause,
	});
}

/** Identifies which loaded assets a window of listing or activity requests covers. */
export function collectionAssetWindowVersion(assets: readonly AssetSummary[] | undefined): string {
	return assets?.map((asset) => asset.id).join('.') ?? '';
}

/** The assets a view searches before filtering: live listings, a name-index search, or every loaded asset. */
export function collectionSearchScope(
	collection: Collection | undefined,
	listed: ResolvedAsset[],
	listedOnly: boolean,
	query: string
): AssetSummary[] {
	if (listedOnly) return listed.map((result) => result.asset);
	return collection && query.trim()
		? collectionSearchAssets(collection, query.trim().toLowerCase())
		: collection?.assets ?? [];
}

export function collectionCandidateIndex(candidates: AssetCandidate[]): ReadonlyMap<string, AssetCandidate> {
	return new Map(candidates.map((candidate) => [candidate.processId, candidate]));
}

/** Loaded position of each asset; name collections sort alphabetically instead. */
export function collectionDefaultOrder(collection: Collection | undefined): ReadonlyMap<string, number> | null {
	return collection?.kind === 'names'
		? null
		: new Map((collection?.assets ?? []).map((asset, index) => [asset.id, index]));
}

export function filterCollectionAssets(
	assets: AssetSummary[],
	options: {
		query: string;
		initial: string;
		sort: CollectionSort;
		kind: Collection['kind'] | undefined;
		prices: CollectionCardPrices;
		candidates: ReadonlyMap<string, AssetCandidate>;
		defaultOrder: ReadonlyMap<string, number> | null;
	}
): AssetSummary[] {
	return assets
		.filter(
			(asset) =>
				assetMatchesCollectionQuery(asset, options.query) &&
				(options.initial === 'all' || asset.name.trim().toLowerCase().startsWith(options.initial.toLowerCase()))
		)
		.sort((a, b) => {
			if (options.sort === 'name') return compareCollectionAssetNames(a, b);
			if (options.sort === 'price-low' || options.sort === 'price-high') {
				const priceA = collectionPriceValue(options.prices[a.id]);
				const priceB = collectionPriceValue(options.prices[b.id]);
				if (priceA !== null || priceB !== null) {
					if (priceA === null) return 1;
					if (priceB === null) return -1;
					if (priceA !== priceB) return options.sort === 'price-low' ? priceA - priceB : priceB - priceA;
				}
			}
			if (options.initial !== 'all') return compareCollectionAssetNames(a, b);
			const activityA = options.candidates.get(a.id);
			const activityB = options.candidates.get(b.id);
			if (activityA || activityB) {
				return (
					(activityB?.height ?? 0) - (activityA?.height ?? 0) ||
					(activityB?.timestamp ?? 0) - (activityA?.timestamp ?? 0) ||
					compareCollectionAssetNames(a, b)
				);
			}
			if (options.kind === 'names') return compareCollectionAssetNames(a, b);
			return (
				(options.defaultOrder?.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
					(options.defaultOrder?.get(b.id) ?? Number.MAX_SAFE_INTEGER) || compareCollectionAssetNames(a, b)
			);
		});
}

/** Every live order across the listed assets, cheapest first, with cumulative order-book depth. */
export function collectionLiveListingRows(listed: ResolvedAsset[]): CollectionLiveListingRow[] {
	const rows = listed
		.flatMap((result) =>
			liveOrdersOfAsset(result.state).map((order) => {
				const price = orderPriceLabel(order, result.state);
				const quantity = formatTokenAmount(order.quantity, result.state.denomination);
				return {
					asset: result.asset,
					depth: 0,
					price,
					priceValue: Number.parseFloat(price.replace(/,/g, '')),
					quantity,
					quantityValue: Number.parseFloat(quantity.replace(/,/g, '')) || 0,
					total: `${winstonToAr(order.asking)} AR`,
				};
			})
		)
		.sort((a, b) => a.priceValue - b.priceValue || a.asset.name.localeCompare(b.asset.name));
	const depths = cumulativeCollectionDepth(rows.map((row) => row.quantityValue));
	return rows.map((row, index) => ({ ...row, depth: depths[index] }));
}

/** A card's price from live asset state, or the failure that kept its state from being read. */
export function collectionListingPrice(
	result: ResolvedAsset | null,
	failureKind?: RequestFailureKind
): CollectionCardPrice {
	if (failureKind) return { status: 'unavailable', kind: failureKind };
	const order = result ? bestAskOfAsset(result.state) : null;
	return { status: 'resolved', label: order && result ? orderPriceLabel(order, result.state) : null };
}

export function collectionCardPriceLabel(
	price: CollectionCardPrice | undefined,
	checkFailed: boolean,
	messages: CollectionMessages
): string {
	if (price?.status === 'unavailable') return messages.priceUnavailable;
	if (price?.status === 'unindexed') return messages.priceUnlisted;
	if (price?.status === 'resolved') return price.label ?? messages.priceNotListed;
	return checkFailed ? messages.priceUnavailable : messages.priceChecking;
}

export function collectionCardPriceListed(price: CollectionCardPrice | undefined): boolean {
	return price?.status === 'resolved' && Boolean(price.label);
}

export function collectionUnavailablePriceCount(assets: AssetSummary[], prices: CollectionCardPrices): number {
	return assets.filter((asset) => prices[asset.id]?.status === 'unavailable').length;
}

/** Cards whose live state could not be read, which a price retry reads again. */
export function unavailableCollectionPriceIds(prices: CollectionCardPrices): string[] {
	return Object.entries(prices).flatMap(([processId, price]) => (price.status === 'unavailable' ? [processId] : []));
}
