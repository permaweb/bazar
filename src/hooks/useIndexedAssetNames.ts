import React from 'react';

import {
	type AssetSummary,
	type IndexedAssetName,
	isPlaceholderAssetName,
	isVisibleAssetId,
	loadIndexedAssetNames,
} from 'api/collections';

/**
 * Cards for one page mount over a few renders (sorting, reveal, streamed rows). One short
 * window collects them, so a page costs one name request instead of one per render or card.
 */
export const INDEXED_ASSET_NAME_COALESCE_MS = 150;

type LoadIndexedAssetNames = (ids: readonly string[]) => Promise<ReadonlyMap<string, IndexedAssetName>>;

/**
 * Collects visible placeholder IDs into one lookup per coalescing window. Each ID is asked
 * once per batcher; IDs the index does not know keep their short-ID title. A failed lookup
 * releases its IDs, so the next change in what is visible asks for them again.
 *
 * `cancel` drops only the window that has not been sent yet. A request already in flight
 * still lands, because its result goes to the app-wide market store, not to one view.
 */
export function createIndexedAssetNameBatcher(
	load: LoadIndexedAssetNames,
	remember: (indexed: ReadonlyMap<string, IndexedAssetName>) => void,
	coalesceMs = INDEXED_ASSET_NAME_COALESCE_MS
) {
	const requested = new Set<string>();
	let queued: string[] = [];
	let timer: ReturnType<typeof setTimeout> | undefined;
	const flush = () => {
		timer = undefined;
		const ids = queued;
		queued = [];
		if (!ids.length) return;
		void load(ids).then(
			(found) => {
				if (found.size) remember(found);
			},
			() => {
				for (const id of ids) requested.delete(id);
			}
		);
	};
	return {
		request(ids: readonly string[]) {
			for (const id of ids) {
				if (requested.has(id)) continue;
				requested.add(id);
				queued.push(id);
			}
			if (queued.length && timer === undefined) timer = setTimeout(flush, coalesceMs);
		},
		cancel() {
			if (timer !== undefined) clearTimeout(timer);
			timer = undefined;
			for (const id of queued) requested.delete(id);
			queued = [];
		},
	};
}

/**
 * The placeholder-titled IDs worth asking for, sorted so reordering the same cards (activity or
 * price sorts settling) asks for nothing. Until hidden-catalogue membership settles every ID
 * counts as invisible; the key then changes on the re-render that settlement causes.
 */
export function indexedAssetNameRequestKey(assets: readonly Pick<AssetSummary, 'id' | 'name'>[]): string {
	const ids = new Set<string>();
	for (const asset of assets) {
		if (isPlaceholderAssetName(asset) && isVisibleAssetId(asset.id)) ids.add(asset.id);
	}
	return [...ids].sort().join(',');
}

/** Name the placeholder-titled assets a view is showing, through the market store. */
export function useIndexedAssetNames(
	assets: readonly Pick<AssetSummary, 'id' | 'name'>[],
	remember: (indexed: ReadonlyMap<string, IndexedAssetName>) => void
) {
	const rememberRef = React.useRef(remember);
	rememberRef.current = remember;
	const [batcher] = React.useState(() =>
		createIndexedAssetNameBatcher(
			(ids) => loadIndexedAssetNames(ids),
			(indexed) => rememberRef.current(indexed)
		)
	);
	const placeholderKey = indexedAssetNameRequestKey(assets);
	React.useEffect(() => {
		if (placeholderKey) batcher.request(placeholderKey.split(','));
	}, [batcher, placeholderKey]);
	React.useEffect(() => () => batcher.cancel(), [batcher]);
}
