import { type AssetSummary, type Collection, collectionAsset } from 'api/collections';
import { type AssetState, bestAskOfAsset } from 'api/marketplace';

import { orderPriceLabel } from 'features/Catalogue';
import type { RequestFailureKind } from 'helpers/app-error';

import {
	type HomeListingActivity,
	type HomeMarketSummary,
	publishHomeListingResult,
	reconcileHomeListingAssets,
} from './home-market';

/**
 * Live market summaries shared by Discover and Collections: per-asset prices and artwork, per-collection floors, and
 * the listings those floor scans verified. Absence of a key means its summary is still pending.
 */
export type HomeMarketSummaries = {
	assetPrices: Record<string, HomeMarketSummary>;
	assetImages: Record<string, string>;
	collectionFloors: Record<string, HomeMarketSummary>;
	verifiedListings: Record<string, AssetSummary[]>;
	verifiedActivity: Record<string, HomeListingActivity>;
};

export type HomeMarketSummaryEvent =
	| { type: 'assets-retained'; assetIds: ReadonlySet<string> }
	| { type: 'asset-price-resolved'; assetId: string; price: string | null; image?: string }
	| { type: 'asset-price-failed'; assetId: string; kind: RequestFailureKind }
	| { type: 'collections-retained'; collectionIds: ReadonlySet<string>; changedCollectionIds: ReadonlySet<string> }
	| {
			type: 'listing-resolved';
			collectionId: string;
			asset: AssetSummary;
			listing: { price: string; activity: HomeListingActivity } | null;
	  }
	| {
			type: 'collection-floor-resolved';
			collection: Collection;
			listingIds: string[];
			activity: Record<string, HomeListingActivity>;
			floor: HomeMarketSummary;
	  }
	| { type: 'collection-floor-failed'; collectionId: string; kind: RequestFailureKind };

export const EMPTY_HOME_MARKET_SUMMARIES: HomeMarketSummaries = {
	assetPrices: {},
	assetImages: {},
	collectionFloors: {},
	verifiedListings: {},
	verifiedActivity: {},
};

export function homeMarketSummariesReducer(
	state: HomeMarketSummaries,
	event: HomeMarketSummaryEvent
): HomeMarketSummaries {
	switch (event.type) {
		case 'assets-retained':
			return {
				...state,
				assetPrices: retainKeys(state.assetPrices, (assetId) => event.assetIds.has(assetId)),
				assetImages: retainKeys(state.assetImages, (assetId) => event.assetIds.has(assetId)),
			};
		case 'asset-price-resolved':
			return {
				...state,
				assetPrices: { ...state.assetPrices, [event.assetId]: { status: 'resolved', value: event.price } },
				assetImages:
					event.image && state.assetImages[event.assetId] !== event.image
						? { ...state.assetImages, [event.assetId]: event.image }
						: state.assetImages,
			};
		case 'asset-price-failed':
			return {
				...state,
				assetPrices: {
					...state.assetPrices,
					[event.assetId]: { status: 'unavailable', source: 'compute', kind: event.kind },
				},
			};
		case 'collections-retained':
			return {
				...state,
				collectionFloors: retainKeys(
					state.collectionFloors,
					(collectionId) =>
						event.collectionIds.has(collectionId) && !event.changedCollectionIds.has(collectionId)
				),
			};
		case 'listing-resolved': {
			const verifiedListings = publishHomeListingResult(
				state.verifiedListings,
				event.collectionId,
				event.asset,
				Boolean(event.listing)
			);
			if (!event.listing) {
				return verifiedListings === state.verifiedListings ? state : { ...state, verifiedListings };
			}
			return {
				...state,
				verifiedListings,
				assetPrices: {
					...state.assetPrices,
					[event.asset.id]: { status: 'resolved', value: event.listing.price },
				},
				verifiedActivity: { ...state.verifiedActivity, [event.asset.id]: event.listing.activity },
			};
		}
		case 'collection-floor-resolved': {
			const previous = state.verifiedListings[event.collection.id] ?? [];
			const listings = reconcileHomeListingAssets(previous, event.listingIds, event.collection);
			const unchanged =
				previous.length === listings.length && previous.every((asset, index) => asset === listings[index]);
			return {
				...state,
				verifiedActivity: { ...state.verifiedActivity, ...event.activity },
				verifiedListings: unchanged
					? state.verifiedListings
					: { ...state.verifiedListings, [event.collection.id]: listings },
				collectionFloors: { ...state.collectionFloors, [event.collection.id]: event.floor },
			};
		}
		case 'collection-floor-failed':
			return {
				...state,
				collectionFloors: {
					...state.collectionFloors,
					[event.collectionId]: { status: 'unavailable', source: 'index', kind: event.kind },
				},
			};
	}
}

// The price and artwork one asset state contributes to the market summaries.
export function homeAssetStateSummary(collection: Collection, assetId: string, state: AssetState) {
	const order = bestAskOfAsset(state);
	return {
		price: order ? orderPriceLabel(order, state) : null,
		image: collectionAsset(collection, assetId, state)?.image,
	};
}

function retainKeys<T>(record: Record<string, T>, keep: (key: string) => boolean): Record<string, T> {
	return Object.fromEntries(Object.entries(record).filter(([key]) => keep(key)));
}
