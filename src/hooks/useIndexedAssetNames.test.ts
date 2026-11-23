import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	HIDDEN_ASSET_IDS,
	HIDDEN_COLLECTION_IDS,
	type IndexedAssetName,
	replaceHiddenCollectionAssetIndex,
} from 'api/collections';

import {
	createIndexedAssetNameBatcher,
	INDEXED_ASSET_NAME_COALESCE_MS,
	indexedAssetNameRequestKey,
} from './useIndexedAssetNames';

const ids = Array.from({ length: 24 }, (_, index) => index.toString(36).padStart(43, 'V'));
const named = (list: readonly string[]) =>
	new Map<string, IndexedAssetName>(list.map((id, index) => [id, { id, name: `${index + 1}` }]));

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	replaceHiddenCollectionAssetIndex({});
});

describe('indexed asset name request keys', () => {
	const short = (id: string) => ({ id, name: `${id.slice(0, 7)}…${id.slice(-6)}` });

	it('waits for hidden-catalogue membership before asking for any ID', () => {
		replaceHiddenCollectionAssetIndex({});
		expect(indexedAssetNameRequestKey([short(ids[0])])).toBe('');
	});

	it('keys visible placeholders only, independent of card order', () => {
		replaceHiddenCollectionAssetIndex(Object.fromEntries(HIDDEN_COLLECTION_IDS.map((id) => [id, []])));
		const assets = [short(ids[1]), { id: ids[2], name: '88' }, short(ids[0]), short(HIDDEN_ASSET_IDS[0])];

		expect(indexedAssetNameRequestKey(assets)).toBe(`${ids[0]},${ids[1]}`);
		expect(indexedAssetNameRequestKey([...assets].reverse())).toBe(`${ids[0]},${ids[1]}`);
	});
});

describe('indexed asset name batching', () => {
	it('sends one request for a page whose cards arrive over several renders', async () => {
		const load = vi.fn(async (list: readonly string[]) => named(list));
		const remember = vi.fn();
		const batcher = createIndexedAssetNameBatcher(load, remember);

		batcher.request(ids.slice(0, 4));
		batcher.request(ids.slice(0, 8));
		batcher.request(ids.slice(4, 12));
		await vi.advanceTimersByTimeAsync(INDEXED_ASSET_NAME_COALESCE_MS);

		expect(load).toHaveBeenCalledTimes(1);
		expect(load.mock.calls[0][0]).toEqual(ids.slice(0, 12));
		expect(remember).toHaveBeenCalledTimes(1);
		expect(remember.mock.calls[0][0].size).toBe(12);
	});

	it('asks only for newly revealed IDs on the next page', async () => {
		const load = vi.fn(async (list: readonly string[]) => named(list));
		const batcher = createIndexedAssetNameBatcher(load, vi.fn());

		batcher.request(ids.slice(0, 12));
		await vi.advanceTimersByTimeAsync(INDEXED_ASSET_NAME_COALESCE_MS);
		batcher.request(ids.slice(0, 24));
		await vi.advanceTimersByTimeAsync(INDEXED_ASSET_NAME_COALESCE_MS);
		batcher.request(ids.slice(0, 24));
		await vi.advanceTimersByTimeAsync(INDEXED_ASSET_NAME_COALESCE_MS);

		expect(load.mock.calls.map(([list]) => list)).toEqual([ids.slice(0, 12), ids.slice(12, 24)]);
	});

	it('does not re-ask IDs the index does not know and skips empty results', async () => {
		const load = vi.fn(async () => new Map<string, IndexedAssetName>());
		const remember = vi.fn();
		const batcher = createIndexedAssetNameBatcher(load, remember);

		batcher.request(ids.slice(0, 3));
		await vi.advanceTimersByTimeAsync(INDEXED_ASSET_NAME_COALESCE_MS);
		batcher.request(ids.slice(0, 3));
		await vi.advanceTimersByTimeAsync(INDEXED_ASSET_NAME_COALESCE_MS);

		expect(load).toHaveBeenCalledTimes(1);
		expect(remember).not.toHaveBeenCalled();
	});

	it('releases IDs after a failed lookup so a later visibility change retries them', async () => {
		const load = vi
			.fn<(list: readonly string[]) => Promise<ReadonlyMap<string, IndexedAssetName>>>()
			.mockRejectedValueOnce(new Error('asset-name-index-429'))
			.mockImplementation(async (list) => named(list));
		const remember = vi.fn();
		const batcher = createIndexedAssetNameBatcher(load, remember);

		batcher.request(ids.slice(0, 2));
		await vi.advanceTimersByTimeAsync(INDEXED_ASSET_NAME_COALESCE_MS);
		batcher.request(ids.slice(0, 2));
		await vi.advanceTimersByTimeAsync(INDEXED_ASSET_NAME_COALESCE_MS);

		expect(load).toHaveBeenCalledTimes(2);
		expect(remember).toHaveBeenCalledTimes(1);
	});

	it('drops an unsent window on cancel and asks again after remounting', async () => {
		const load = vi.fn(async (list: readonly string[]) => named(list));
		const batcher = createIndexedAssetNameBatcher(load, vi.fn());

		batcher.request(ids.slice(0, 2));
		batcher.cancel();
		await vi.advanceTimersByTimeAsync(INDEXED_ASSET_NAME_COALESCE_MS);
		expect(load).not.toHaveBeenCalled();

		batcher.request(ids.slice(0, 2));
		await vi.advanceTimersByTimeAsync(INDEXED_ASSET_NAME_COALESCE_MS);
		expect(load).toHaveBeenCalledTimes(1);
	});
});
