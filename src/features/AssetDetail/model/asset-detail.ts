import { type AssetSummary, type Collection, FUNGIBLE_TOKEN_COLLECTION_ID, isVisibleAssetId } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';
import { type AssetState, DISPLAY_STATE_TIMEOUT_ERROR, servingNodeOrigin } from 'api/marketplace';
import { CREATED_COLLECTION_ID, type MintedAsset } from 'api/mint';

import { isArweaveId } from 'helpers/arweave-id';
import { bazarAoTransportUrl, usesPermawebOsAo } from 'helpers/config';
import { marketplaceErrorMessage as errorMessage, marketplaceRequestFailureMessage } from 'helpers/marketplace-error';

import type { TokenPricePoint } from '../components/organisms/TokenPriceChart';

export function assetDetailCanResolve({
	assetId,
	cachedAsset,
	indexedAsset,
	indexedMetadata,
	indexedCollection,
	directAtomicRoute,
	directFungibleRoute = false,
}: {
	assetId: string;
	cachedAsset?: AssetSummary;
	indexedAsset?: AssetSummary;
	indexedMetadata?: AssetSummary;
	indexedCollection?: Collection;
	directAtomicRoute: boolean;
	directFungibleRoute?: boolean;
}) {
	if (!isVisibleAssetId(assetId)) return false;
	return Boolean(
		directAtomicRoute ||
			directFungibleRoute ||
			indexedAsset ||
			(indexedMetadata?.id === assetId && isArweaveId(assetId)) ||
			(indexedCollection?.kind === 'tokens' && isArweaveId(assetId)) ||
			(cachedAsset?.id === assetId && isArweaveId(assetId))
	);
}

export function assetDetailMembershipVerified(
	collectionId: string | undefined,
	verifiedCollectionIds: ReadonlySet<string>,
	directAtomicAsset: boolean
) {
	return directAtomicAsset || Boolean(collectionId && verifiedCollectionIds.has(collectionId));
}

export function uniquePriceHistory(events: CollectionActivityEvent[]): TokenPricePoint[] {
	const ordered = [...events].sort(
		(left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id)
	);
	const listings = new Map<string, TokenPricePoint>();
	for (const event of ordered) {
		if (event.action !== 'make-offer' || !event.asking) continue;
		try {
			if (BigInt(event.asking) <= 0n) continue;
			listings.set(event.id, { id: event.id, timestamp: event.timestamp, value: event.asking });
		} catch {
			// Malformed indexed values are not price evidence.
		}
	}
	const openingListing = listings.values().next().value as TokenPricePoint | undefined;
	if (!openingListing) return [];
	const completedSales = ordered.flatMap((event) => {
		if (event.action !== 'register-interest' || !event.purchaseProof || !event.orderId) return [];
		const listing = listings.get(event.orderId);
		if (!listing || event.timestamp < listing.timestamp) return [];
		return [{ id: event.id, timestamp: event.timestamp, value: listing.value }];
	});
	return [openingListing, ...completedSales].sort(
		(left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id)
	);
}

export function mergeAssetActivityPages(
	current: CollectionActivityEvent[],
	older: CollectionActivityEvent[]
): CollectionActivityEvent[] {
	const events = new Map(current.map((event) => [event.id, event]));
	for (const event of older) events.set(event.id, event);
	return [...events.values()].sort(
		(left, right) =>
			right.height - left.height || right.timestamp - left.timestamp || left.id.localeCompare(right.id)
	);
}

export function verifiedAssetForDetail(
	collection: Collection | undefined,
	indexedAsset: AssetSummary | undefined,
	resolvedAsset: AssetSummary | null | undefined,
	state: AssetState | null
) {
	if (!collection) return undefined;
	return collection.kind === 'names'
		? state && ['carrier@1.0', 'name-token@1.0'].includes(state.device)
			? indexedAsset
			: null
		: resolvedAsset;
}

export function assetDetailLoadingPresentation(collection: Collection | undefined, collectionId: string) {
	const kind =
		collection?.kind ??
		(collectionId === FUNGIBLE_TOKEN_COLLECTION_ID
			? 'tokens'
			: collectionId === CREATED_COLLECTION_ID
			? 'images'
			: 'names');
	return { kind, device: kind === 'names' ? 'carrier@1.0' : 'token@1.0' } as const;
}

export function mergeAssetDetailMetadata(
	primary: AssetSummary | undefined,
	indexed: AssetSummary | undefined
): AssetSummary | undefined {
	if (!primary) return indexed;
	if (!indexed || primary.id !== indexed.id) return primary;
	const abbreviatedName = `${primary.id.slice(0, 7)}…${primary.id.slice(-6)}`;
	return {
		...primary,
		...indexed,
		name: !primary.name || primary.name === abbreviatedName ? indexed.name : primary.name,
	};
}

export function assetDetailErrorMessage(
	error: string | null,
	asset: Pick<AssetSummary, 'name'> | undefined,
	indexed: boolean
): string | null {
	if (!error || !asset || !indexed) return error;
	return `${asset.name} is published and indexed, but its ownership and market state are currently unavailable from the configured AO peers. Retry shortly.`;
}

type AssetStateRecoveryLocation = Pick<Location, 'hash' | 'hostname' | 'href' | 'port' | 'protocol' | 'search'>;

export function assetStateRecoveryUrl(
	error: string | null,
	location: AssetStateRecoveryLocation,
	scope: Pick<Window, 'aoFetch'> | undefined = globalThis.window
): string | null {
	return error && usesPermawebOsAo(location, scope) ? bazarAoTransportUrl(location.href) : null;
}

export function isFungiblePendingMint(asset: Pick<MintedAsset, 'contentType' | 'ticker'>, collectionId: string) {
	return (
		collectionId === FUNGIBLE_TOKEN_COLLECTION_ID ||
		asset.contentType === 'application/x.arweave-token' ||
		Boolean(asset.ticker)
	);
}

export function assetStateErrorMessage(error: unknown) {
	const value = error instanceof Error ? error.message : String(error);
	if (/^HTTP 429(?:\b|$)/i.test(value)) {
		return marketplaceRequestFailureMessage('compute', 'rate-limited');
	}
	if (/response[-\s]+quorum[-\s]+not[-\s]+met/i.test(value) || /^HTTP 5\d\d(?:\b|$)/i.test(value)) {
		return 'Live state could not be read through the configured AO peers. Retry shortly or review the AO Core settings in the header.';
	}
	if (value === DISPLAY_STATE_TIMEOUT_ERROR) {
		return 'The configured AO peers did not return live state within 45 seconds. Retry or review the AO Core settings in the header.';
	}
	if (['Failed to fetch', 'fetch failed', 'compute-provider-failed', 'compute-provider-timeout'].includes(value)) {
		let host = 'The selected AO peer';
		try {
			host = new URL(servingNodeOrigin(window.location)).host;
		} catch {
			// Keep the generic label if the selected origin cannot be parsed.
		}
		return `${host} could not be reached. Retry live state or review the AO Core settings in the header.`;
	}
	return errorMessage(error);
}
