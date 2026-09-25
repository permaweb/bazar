import { type AssetSummary, type Collection, HIDDEN_COLLECTION_IDS } from 'api/collections';
import type { AssetCandidate, CollectionActivityEvent, ResolvedAsset } from 'api/discovery';
import type { AssetState, SwapOrder } from 'api/marketplace';

/** Marks the hidden-collection index complete so fixture asset IDs count as visible. */
export const READY_HIDDEN_COLLECTION_INDEX: Record<string, string[]> = Object.fromEntries(
	HIDDEN_COLLECTION_IDS.map((id) => [id, []])
);

/** A syntactically valid, visible Arweave process ID for fixture `index`. */
export function processId(index: number): string {
	return `${String(index).padStart(42, '0')}A`;
}

export function assetSummary(index: number, name = `Asset ${index}`): AssetSummary {
	return { id: processId(index), name };
}

export function collectionFixture(assets: AssetSummary[], overrides: Partial<Collection> = {}): Collection {
	return {
		id: 'collection-a',
		name: 'Collection A',
		description: '',
		kind: 'images',
		assets,
		manifestId: 'manifest-a',
		...overrides,
	};
}

export function candidateFixture(index: number, height = index): AssetCandidate {
	return { processId: processId(index), height, timestamp: height, sources: ['market-action'] };
}

export function orderFixture(overrides: Partial<SwapOrder> = {}): SwapOrder {
	return {
		orderId: 'order-1',
		creator: 'creator',
		recipient: 'recipient',
		asking: '1000000000000',
		deposit: '0',
		minimumFee: '0',
		deadline: 0,
		createdAt: 1,
		quantity: '1',
		status: 'open',
		...overrides,
	};
}

export function assetStateFixture(orders: SwapOrder[], overrides: Partial<AssetState> = {}): AssetState {
	return {
		device: 'token@1.0',
		name: 'Asset',
		ticker: 'ATOMIC',
		denomination: 0,
		totalSupply: '1',
		balances: {},
		orders: Object.fromEntries(orders.map((order) => [order.orderId, order])),
		swapHeight: 0,
		value: null,
		raw: {},
		...overrides,
	};
}

/** A resolved asset; it is a live listing unless `orders` holds no open or reserved order. */
export function resolvedFixture(
	asset: AssetSummary,
	collection: Collection,
	orders: SwapOrder[] = [orderFixture()]
): ResolvedAsset {
	return {
		asset,
		collection,
		state: assetStateFixture(orders),
		provider: 'fixture',
		activity: { processId: asset.id, height: 1, timestamp: 1, sources: ['market-action'] },
	};
}

export function activityEventFixture(index: number, height = index): CollectionActivityEvent {
	return {
		id: `event-${index}`,
		processId: processId(index),
		action: 'make-offer',
		actor: 'actor',
		height,
		timestamp: height,
	};
}
