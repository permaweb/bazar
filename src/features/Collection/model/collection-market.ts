import type { AssetSummary } from 'api/collections';
import { type AssetCandidate, isLiveListing, type ResolvedAsset } from 'api/discovery';
import type { CollectionMintPhase } from 'api/mint';

import type { MarketplaceFailureKind } from 'helpers/marketplace-error';

export type CollectionCardPrice =
	| { status: 'resolved'; label: string | null }
	| { status: 'unindexed' }
	| { status: 'unavailable'; kind: MarketplaceFailureKind };

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
	kind: MarketplaceFailureKind;
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

export function collectionAppendPhaseLabel(phase: CollectionMintPhase) {
	if (phase.kind === 'asset') {
		const action = phase.phase.startsWith('signing') ? 'Approve in your wallet' : 'Uploading to Arweave';
		return `Asset ${phase.index + 1} of ${phase.total} · ${action}`;
	}
	if (phase.kind === 'manifest')
		return phase.phase === 'signing' ? 'Approve the new manifest' : 'Publishing manifest';
	return phase.phase === 'signing' ? 'Approve the collection update' : 'Updating collection carrier';
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
