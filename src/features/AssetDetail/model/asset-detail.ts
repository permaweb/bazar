import {
	type AssetSummary,
	type Collection,
	collectionAsset,
	collectionDisplayName,
	FUNGIBLE_TOKEN_COLLECTION_ID,
	isVisibleAssetId,
} from 'api/collections';
import { bazarAtomicAssetFromState, type CollectionActivityEvent } from 'api/discovery';
import { type AssetState, DISPLAY_STATE_TIMEOUT_ERROR, servingNodeOrigin } from 'api/marketplace';
import { CREATED_COLLECTION_ID, CREATED_COLLECTION_NAME, type MintedAsset } from 'api/mint';

import { appErrorMessage, requestFailureMessage, toAppError } from 'helpers/app-error';
import { isArweaveId } from 'helpers/arweave-id';
import { bazarAoTransportUrl, usesPermawebOsAo } from 'helpers/config';

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

export type AssetDetailLoadingShellView = ReturnType<typeof assetDetailLoadingPresentation> & {
	detailClass: 'fungible-asset-page' | 'atomic-asset-page';
	collectionName: string;
};

/** Everything the loading shell shows before live state arrives: layout kind, device tag, page class, and title. */
export function assetDetailLoadingShellView(
	collection: Collection | undefined,
	collectionId: string
): AssetDetailLoadingShellView {
	const presentation = assetDetailLoadingPresentation(collection, collectionId);
	const kind = presentation.kind;
	const collectionName =
		(collection ? (kind === 'tokens' ? collectionDisplayName(collection) : collection.name) : undefined) ??
		(kind === 'tokens' ? 'Fungible tokens' : kind === 'images' ? CREATED_COLLECTION_NAME : 'Arweave names');
	return {
		...presentation,
		detailClass: kind === 'tokens' ? 'fungible-asset-page' : 'atomic-asset-page',
		collectionName,
	};
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

/** Asset-page copy for a failed live-state read, naming the selected AO peer when it could not be reached. */
export function assetStateErrorMessage(cause: unknown) {
	const error = toAppError(cause, 'compute-unavailable');
	if (error.code === 'rate-limited') return requestFailureMessage('compute', 'rate-limited');
	if (error.reason === DISPLAY_STATE_TIMEOUT_ERROR) {
		return 'The configured AO peers did not return live state within 45 seconds. Retry or review the AO Core settings in the header.';
	}
	if (error.code === 'offline' || error.code === 'timeout') {
		let host = 'The selected AO peer';
		try {
			host = new URL(servingNodeOrigin(window.location)).host;
		} catch {
			// Keep the generic label if the selected origin cannot be parsed.
		}
		return `${host} could not be reached. Retry live state or review the AO Core settings in the header.`;
	}
	if (error.code === 'unavailable') {
		return 'Live state could not be read through the configured AO peers. Retry shortly or review the AO Core settings in the header.';
	}
	return appErrorMessage(error);
}

export type IndexedAtomicAsset = { asset: AssetSummary; collection: Collection };

/** Whether the route may look up an indexed Bazar atomic asset for richer metadata and direct membership. */
export function assetDetailHasIndexedLookup(assetId: string, collectionId: string): boolean {
	return (
		isArweaveId(assetId) &&
		isVisibleAssetId(assetId) &&
		collectionId !== FUNGIBLE_TOKEN_COLLECTION_ID &&
		collectionId !== 'arweave-names'
	);
}

export type AssetDetailSources = {
	indexedCollection: Collection | undefined;
	indexedAsset: AssetSummary | undefined;
	indexedAtomic: IndexedAtomicAsset | null;
	cachedAsset: AssetSummary | undefined;
	directAtomicRoute: boolean;
	canResolveAsset: boolean;
};

/** What the route knows about an asset before its live state arrives: catalogue, cached shell, and index. */
export function assetDetailSources(input: {
	assetId: string;
	collectionId: string;
	collections: Collection[];
	cachedAsset: AssetSummary | undefined;
	indexedAtomic: IndexedAtomicAsset | null;
}): AssetDetailSources {
	const indexedCollection = input.collections.find((item) => item.id === input.collectionId);
	const indexedAsset = indexedCollection ? collectionAsset(indexedCollection, input.assetId) : undefined;
	const directAtomicRoute =
		input.collectionId === CREATED_COLLECTION_ID && isArweaveId(input.assetId) && isVisibleAssetId(input.assetId);
	const canResolveAsset = assetDetailCanResolve({
		assetId: input.assetId,
		cachedAsset: input.cachedAsset,
		indexedAsset,
		indexedMetadata: input.indexedAtomic?.asset,
		indexedCollection,
		directAtomicRoute,
		directFungibleRoute:
			input.collectionId === 'fungible-tokens' && isArweaveId(input.assetId) && isVisibleAssetId(input.assetId),
	});
	return {
		indexedCollection,
		indexedAsset,
		indexedAtomic: input.indexedAtomic,
		cachedAsset: input.cachedAsset,
		directAtomicRoute,
		canResolveAsset,
	};
}

export type AssetDetailResolution = {
	shellAsset: AssetSummary | undefined;
	collection: Collection | undefined;
	resolvedAsset: AssetSummary | undefined;
	membershipVerified: boolean;
	verifiedAsset: AssetSummary | null | undefined;
};

/** Combine the route's sources with live state into the collection and asset the page may present as verified. */
export function resolveAssetDetail(
	sources: AssetDetailSources,
	input: { assetId: string; state: AssetState | null; verifiedCollectionIds: ReadonlySet<string> }
): AssetDetailResolution {
	const directAtomicAsset =
		sources.directAtomicRoute && input.state ? bazarAtomicAssetFromState(input.assetId, input.state) : null;
	const indexedMetadata = sources.indexedAtomic?.asset;
	const shellAsset = mergeAssetDetailMetadata(sources.indexedAsset ?? sources.cachedAsset, indexedMetadata);
	const collection =
		sources.indexedCollection ??
		directAtomicAsset?.collection ??
		(sources.directAtomicRoute ? sources.indexedAtomic?.collection : undefined);
	const resolvedAsset =
		directAtomicAsset?.asset ??
		mergeAssetDetailMetadata(
			sources.indexedCollection && input.state
				? collectionAsset(sources.indexedCollection, input.assetId, input.state)
				: sources.indexedAsset ?? sources.cachedAsset,
			indexedMetadata
		);
	const membershipVerified = assetDetailMembershipVerified(
		sources.indexedCollection?.id,
		input.verifiedCollectionIds,
		Boolean(directAtomicAsset || (sources.directAtomicRoute && sources.indexedAtomic))
	);
	const verifiedAsset = membershipVerified
		? verifiedAssetForDetail(collection, sources.indexedAsset, resolvedAsset, input.state)
		: undefined;
	return { shellAsset, collection, resolvedAsset, membershipVerified, verifiedAsset };
}

/** Which retry an error or loading screen offers: re-read live state, or reload the market catalogue. */
export type AssetDetailRetry = 'state' | 'market';

export type AssetDetailScreen =
	| {
			kind: 'loading';
			asset: AssetSummary | undefined;
			collection: Collection | undefined;
			error: string | null;
			retry: AssetDetailRetry;
			/** Offer the Bazar-peer recovery action alongside the retry. */
			recoverable: boolean;
	  }
	| {
			kind: 'unavailable';
			collection: Collection | undefined;
			message: string;
			retry: AssetDetailRetry;
			recoverable: boolean;
	  }
	| { kind: 'collection-not-found' }
	| { kind: 'asset-not-found'; collection: Collection }
	| { kind: 'fungible'; asset: AssetSummary; collection: Collection; state: AssetState }
	| { kind: 'unique'; asset: AssetSummary; collection: Collection; state: AssetState };

/** Choose the asset route's screen from catalogue, resolution, and live-state progress. */
export function assetDetailScreen(input: {
	market: { loading: boolean; error: string | null; notice: string | null };
	directAtomicRoute: boolean;
	resolution: AssetDetailResolution;
	live: { state: AssetState | null; loading: boolean; error: string | null };
	detailError: string | null;
}): AssetDetailScreen {
	const { market, resolution, live, detailError } = input;
	const collection = resolution.collection;
	if (!collection && (market.loading || (input.directAtomicRoute && live.loading))) {
		return {
			kind: 'loading',
			asset: resolution.shellAsset,
			collection: undefined,
			error: detailError,
			retry: 'state',
			recoverable: Boolean(detailError),
		};
	}
	if (!collection && market.error) {
		return {
			kind: 'unavailable',
			collection: undefined,
			message: market.error,
			retry: 'market',
			recoverable: false,
		};
	}
	if (!collection && input.directAtomicRoute && live.error) {
		return {
			kind: 'unavailable',
			collection: undefined,
			message: detailError ?? live.error,
			retry: 'state',
			recoverable: true,
		};
	}
	if (!collection) return { kind: 'collection-not-found' };
	if (!resolution.membershipVerified) {
		return {
			kind: 'loading',
			asset: resolution.shellAsset,
			collection,
			error: market.loading
				? detailError
				: market.notice ?? 'Current collection membership could not be verified.',
			retry: market.loading ? 'state' : 'market',
			recoverable: market.loading && Boolean(detailError),
		};
	}
	const asset = resolution.verifiedAsset;
	if (!asset && live.error) {
		return {
			kind: 'unavailable',
			collection,
			message: detailError ?? live.error,
			retry: 'state',
			recoverable: true,
		};
	}
	if (!asset && !live.loading) return { kind: 'asset-not-found', collection };
	if (!asset) {
		return {
			kind: 'loading',
			asset: resolution.shellAsset,
			collection,
			error: null,
			retry: 'state',
			recoverable: false,
		};
	}
	if (!live.state) {
		return { kind: 'loading', asset, collection, error: detailError, retry: 'state', recoverable: true };
	}
	const kind = live.state.totalSupply !== '1' || live.state.denomination > 0 ? 'fungible' : 'unique';
	return { kind, asset, collection, state: live.state };
}
