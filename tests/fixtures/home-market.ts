import { type AssetSummary, type Collection, HIDDEN_COLLECTION_IDS } from 'api/collections';
import type { AssetCandidate, ResolvedAsset } from 'api/discovery';
import { type AssetState, parseAssetState } from 'api/marketplace';

// Asset visibility resolves only once the hidden-collection index is loaded.
export const READY_HIDDEN_COLLECTION_INDEX: Record<string, string[]> = Object.fromEntries(
	HIDDEN_COLLECTION_IDS.map((id) => [id, []])
);

export const SELLER = '1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw';
export const ORDER_ID = 'qAhWNMSuX70lZpIRohKJn_SuVcymr_RmpGbltydjpwA';

export function assetId(letter: string) {
	return letter.repeat(43);
}

// A unique asset's live state, optionally listed for `asking` winston.
export function uniqueAssetState(asking?: string): AssetState {
	return parseAssetState({
		'execution-device': 'token@1.0',
		'total-supply': '1',
		balances: asking ? {} : { [SELLER]: '1' },
		orders: asking
			? {
					[ORDER_ID]: {
						'order-id': ORDER_ID,
						creator: SELLER,
						recipient: SELLER,
						asking,
						deadline: 1_000,
						'created-at': 100,
						quantity: 1,
						status: 'open',
					},
			  }
			: {},
		'swap-height': 100,
	});
}

export function imageCollection(id: string, assets: AssetSummary[]): Collection {
	return { id, name: `Collection ${id}`, description: '', kind: 'images', assets };
}

export function candidate(processId: string, height = 10, timestamp = 1_000): AssetCandidate {
	return { processId, height, timestamp, sources: ['market-action'] };
}

export function resolvedListing(asset: AssetSummary, collection: Collection, asking?: string): ResolvedAsset {
	return {
		asset,
		collection,
		state: uniqueAssetState(asking),
		provider: 'https://compute.example',
		activity: candidate(asset.id),
	};
}
