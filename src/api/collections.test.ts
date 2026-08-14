import { afterEach, describe, expect, it, vi } from 'vitest';

import { NAMES_NAMESPACE_ID } from 'helpers/config';

import { parseAssetState } from './asset-marketplace';
import {
	carrierManifestId,
	type Collection,
	collectionAsset,
	discoverBazarCollections,
	enrichImageCollectionAssetMetadata,
	FUNGIBLE_TOKEN_ID,
	loadCollections,
	loadImageCollection,
	loadMoreCarrierNames,
	loadMoreFungibleTokens,
	mergeCollectionSnapshots,
	parseNamesNamespace,
} from './collections';

const encodeJson = (value: unknown) =>
	btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const encodeUtf8Json = (value: unknown) =>
	btoa(Array.from(new TextEncoder().encode(JSON.stringify(value)), (byte) => String.fromCharCode(byte)).join(''))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replaceAll('=', '');

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('collection index loading', () => {
	it('batch-enriches ID-only manifests with permanent Atomic Asset names', async () => {
		const owner = 'O'.repeat(43);
		const ids = Array.from({ length: 205 }, (_, index) => index.toString(36).padStart(43, 'A'));
		const collection: Collection = {
			id: 'C'.repeat(43),
			name: 'HTML Colors',
			description: '',
			kind: 'images',
			assets: ids.map((id) => ({
				id,
				name: `${id.slice(0, 7)}…${id.slice(-6)}`,
				image: `https://arweave.net/${id}`,
			})),
		};
		const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			const request = JSON.parse(String(init?.body));
			const offset = request.variables.after ? Number(request.variables.after) + 1 : 0;
			const page = ids.slice(offset, offset + 100);
			return Response.json({
				data: {
					transactions: {
						pageInfo: { hasNextPage: offset + page.length < ids.length },
						edges: page.map((id: string, index) => ({
							cursor: String(offset + index),
							node: {
								id,
								tags: [
									{ name: 'device', value: 'process@1.0' },
									{ name: 'execution-device', value: 'token@1.0' },
									{ name: 'swap-device', value: 'arweave-swap@1.0' },
									{ name: 'scheduler-device', value: 'arweave-scheduler@1.0' },
									{ name: 'scheduler-mode', value: 'all' },
									{ name: 'initial-holder', value: owner },
									{ name: 'total-supply', value: '1' },
									{ name: 'denomination', value: '0' },
									{ name: 'ticker', value: 'ASSET' },
									{ name: 'name', value: `Color ${ids.indexOf(id) + 1}` },
									{ name: 'hint-ui-style', value: 'non-fungible' },
									{ name: 'content-type', value: 'image/png' },
								],
							},
						})),
					},
				},
			});
		});

		const enriched = await enrichImageCollectionAssetMetadata(collection, undefined, fetcher as typeof fetch);

		expect(enriched.assets[0].name).toBe('Color 1');
		expect(enriched.assets[204].name).toBe('Color 205');
		expect(enriched.assets[0].image).toBe(`https://arweave.net/${ids[0]}`);
		expect(fetcher).toHaveBeenCalledTimes(3);
		expect(fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).variables)).toEqual([
			{ collection: ['HTML Colors'], after: null },
			{ collection: ['HTML Colors'], after: '99' },
			{ collection: ['HTML Colors'], after: '199' },
		]);
	});

	it('falls back to exact IDs when a collection name is not indexed on every asset', async () => {
		const owner = 'O'.repeat(43);
		const ids = ['A'.repeat(43), 'B'.repeat(43)];
		const collection: Collection = {
			id: 'C'.repeat(43),
			name: 'Legacy collection',
			description: '',
			kind: 'images',
			assets: ids.map((id) => ({ id, name: `${id.slice(0, 7)}…${id.slice(-6)}` })),
		};
		const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			const request = JSON.parse(String(init?.body));
			if (request.query.includes('BazarAtomicAssetsByCollection')) {
				return Response.json({
					data: { transactions: { pageInfo: { hasNextPage: false }, edges: [] } },
				});
			}
			return Response.json({
				data: {
					transactions: {
						edges: request.variables.ids.map((id: string) => ({
							node: {
								id,
								tags: [
									{ name: 'device', value: 'process@1.0' },
									{ name: 'execution-device', value: 'token@1.0' },
									{ name: 'swap-device', value: 'arweave-swap@1.0' },
									{ name: 'scheduler-device', value: 'arweave-scheduler@1.0' },
									{ name: 'scheduler-mode', value: 'all' },
									{ name: 'initial-holder', value: owner },
									{ name: 'total-supply', value: '1' },
									{ name: 'denomination', value: '0' },
									{ name: 'ticker', value: 'ASSET' },
									{ name: 'name', value: `Legacy ${ids.indexOf(id) + 1}` },
									{ name: 'hint-ui-style', value: 'non-fungible' },
									{ name: 'content-type', value: 'image/png' },
								],
							},
						})),
					},
				},
			});
		});

		const enriched = await enrichImageCollectionAssetMetadata(collection, undefined, fetcher as typeof fetch);

		expect(enriched.assets.map((asset) => asset.name)).toEqual(['Legacy 1', 'Legacy 2']);
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).variables.ids).toEqual(ids);
	});

	it('does not fan out exact-ID fallbacks when the collection index request fails', async () => {
		const collection: Collection = {
			id: 'C'.repeat(43),
			name: 'Unavailable collection',
			description: '',
			kind: 'images',
			assets: Array.from({ length: 100 }, (_, index) => {
				const id = index.toString(36).padStart(43, 'A');
				return { id, name: `${id.slice(0, 7)}…${id.slice(-6)}` };
			}),
		};
		const fetcher = vi.fn(async () => new Response('unavailable', { status: 503 }));

		await expect(
			enrichImageCollectionAssetMetadata(collection, undefined, fetcher as typeof fetch)
		).resolves.toEqual(collection);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('discovers scheduled carrier collections by the COLLECTION ticker without an app tag', async () => {
		const currentId = 'C'.repeat(43);
		const currentManifest = 'M'.repeat(43);
		const assetId = 'A'.repeat(43);
		const edge = (
			id: string,
			manifestId: string,
			height: number,
			tags: Array<{ name: string; value: string }>,
			manifestTag = 'initial-value'
		) => ({
			cursor: `${id.slice(0, 1)}-cursor`,
			node: {
				id,
				block: { height, timestamp: height * 10 },
				tags: [
					{ name: 'device', value: 'process@1.0' },
					{ name: 'execution-device', value: 'carrier@1.0' },
					{ name: 'type', value: 'Process' },
					{ name: manifestTag, value: manifestId },
					...tags,
				],
			},
		});
		const encodeManifest = (name: string) =>
			encodeUtf8Json({ name, description: `${name} description`, assets: [assetId] });
		const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
			if (body?.query?.includes('BazarCollections')) {
				return Response.json({
					data: {
						transactions: {
							pageInfo: { hasNextPage: false },
							edges: [
								edge(currentId, currentManifest, 20, [
									{ name: 'scheduler-device', value: 'arweave-scheduler@1.0' },
									{ name: 'scheduler-mode', value: 'all' },
									{ name: 'ticker', value: 'COLLECTION' },
								]),
							],
						},
					},
				});
			}
			if (String(input).includes(currentId) && String(input).includes('/compute')) {
				return Response.json(
					{
						'execution-device': 'carrier@1.0',
						'total-supply': '1',
						denomination: 0,
						balances: { ['O'.repeat(43)]: '1' },
						orders: {},
						value: currentManifest,
						'at-slot': 1,
					},
					{ headers: { 'codec-device': 'json@1.0' } }
				);
			}
			if (String(input).includes(`/tx/${currentManifest}/data`)) return new Response(encodeManifest('Current'));
			return new Response('unavailable', { status: 503 });
		});
		vi.stubGlobal('fetch', fetcher);
		const progress: string[] = [];

		const collections = await discoverBazarCollections(undefined, (collection) => progress.push(collection.id));

		expect(
			collections.map(({ id, name, createdHeight, indexSource }) => ({
				id,
				name,
				createdHeight,
				indexSource,
			}))
		).toEqual([{ id: currentId, name: 'Current', createdHeight: 20, indexSource: 'carrier' }]);
		expect(progress).toEqual([currentId]);
		const discoveryBody = fetcher.mock.calls.find(
			([, init]) => typeof init?.body === 'string' && init.body.includes('BazarCollections')
		)?.[1]?.body;
		const discoveryQuery = JSON.parse(String(discoveryBody)).query;
		expect(discoveryQuery).toContain('sort: HEIGHT_DESC');
		expect(discoveryQuery).toContain('{ name: "ticker", values: ["COLLECTION"] }');
		expect(discoveryQuery).not.toContain('{ name: "app-name"');
		expect(
			fetcher.mock.calls.some(
				([, init]) => typeof init?.body === 'string' && init.body.includes('BazarAtomicAssetsByIds')
			)
		).toBe(false);
		expect(collections[0].assets[0].name).toBe('AAAAAAA…AAAAAA');
	});

	it('retains enriched image metadata when the same immutable manifest is republished', () => {
		const collectionId = 'C'.repeat(43);
		const manifestId = 'M'.repeat(43);
		const assetId = 'A'.repeat(43);
		const placeholder = `${assetId.slice(0, 7)}…${assetId.slice(-6)}`;
		const current: Collection = {
			id: collectionId,
			name: 'Colors',
			description: '',
			kind: 'images',
			manifestId,
			assets: [{ id: assetId, name: 'AliceBlue', image: `https://arweave.net/${assetId}` }],
		};
		const replacement: Collection = {
			...current,
			assets: [{ id: assetId, name: placeholder, image: `https://arweave.net/${assetId}` }],
		};

		expect(mergeCollectionSnapshots([current], [replacement])[0].assets[0].name).toBe('AliceBlue');
	});

	it('skips tagged collection candidates whose live carrier or immutable manifest is invalid', async () => {
		const carrierId = 'C'.repeat(43);
		const manifestId = 'M'.repeat(43);
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
				const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
				if (body?.query?.includes('BazarCollections')) {
					return Response.json({
						data: {
							transactions: {
								pageInfo: { hasNextPage: false },
								edges: [
									{
										cursor: 'candidate',
										node: {
											id: carrierId,
											block: { height: 2, timestamp: 3 },
											tags: [
												{ name: 'device', value: 'process@1.0' },
												{ name: 'execution-device', value: 'carrier@1.0' },
												{ name: 'scheduler-device', value: 'arweave-scheduler@1.0' },
												{ name: 'scheduler-mode', value: 'all' },
												{ name: 'ticker', value: 'COLLECTION' },
												{ name: 'type', value: 'Process' },
												{ name: 'initial-value', value: manifestId },
											],
										},
									},
								],
							},
						},
					});
				}
				return new Response('carrier unavailable', { status: 502 });
			})
		);

		await expect(discoverBazarCollections()).resolves.toEqual([]);
	});

	it('reads the current manifest from a carrier value', () => {
		const manifestId = 'M'.repeat(43);
		expect(carrierManifestId({ value: manifestId })).toBe(manifestId);
		expect(carrierManifestId({ value: { target: manifestId } })).toBe(manifestId);
		expect(carrierManifestId({ value: { target: 'invalid' } })).toBeUndefined();
	});
	it('indexes each immutable collection snapshot once for repeated exact lookups', () => {
		const indexedAssets = Array.from({ length: 1_000 }, (_, index) => ({
			id: index.toString(36).padStart(43, 'A'),
			name: `Asset ${index}`,
		}));
		let numericReads = 0;
		const assets = new Proxy(indexedAssets, {
			get(target, property, receiver) {
				if (/^\d+$/.test(String(property))) numericReads += 1;
				return Reflect.get(target, property, receiver);
			},
		});
		const collection: Collection = {
			id: 'images',
			name: 'Images',
			description: 'Images',
			kind: 'images',
			assets,
		};

		for (const asset of indexedAssets) {
			expect(collectionAsset(collection, asset.id)).toBe(asset);
		}
		expect(numericReads).toBe(indexedAssets.length);
	});

	it('builds a fresh exact-asset index for a replacement collection snapshot', () => {
		const retained = { id: 'R'.repeat(43), name: 'Retained' };
		const removed = { id: 'X'.repeat(43), name: 'Removed' };
		const added = { id: 'A'.repeat(43), name: 'Added' };
		const original: Collection = {
			id: 'images',
			name: 'Images',
			description: 'Images',
			kind: 'images',
			assets: [retained, removed],
		};
		const replacement = { ...original, assets: [retained, added] };

		expect(collectionAsset(original, removed.id)).toBe(removed);
		expect(collectionAsset(replacement, removed.id)).toBeUndefined();
		expect(collectionAsset(replacement, added.id)).toBe(added);
	});

	it('recognizes an unloaded fungible token only from its exact live process contract', () => {
		const processId = 'T'.repeat(43);
		const logoId = 'L'.repeat(43);
		const tokens: Collection = {
			id: 'fungible-tokens',
			name: 'Tokens',
			description: 'Tokens',
			kind: 'tokens',
			assets: [],
		};
		const state = parseAssetState({
			device: 'process@1.0',
			'execution-device': 'token@1.0',
			'hint-ui-style': 'fungible',
			'swap-device': 'arweave-swap@1.0',
			'scheduler-device': 'arweave-scheduler@1.0',
			'scheduler-mode': 'all',
			name: 'Unloaded Token',
			ticker: 'NEW',
			logo: logoId,
			'total-supply': '1000000000000',
			denomination: 12,
			balances: { ['W'.repeat(43)]: '1000000000000' },
			orders: {},
		});

		expect(collectionAsset(tokens, processId, state)).toEqual({
			id: processId,
			name: 'Unloaded Token',
			ticker: 'NEW',
			contentType: 'application/x.arweave-token',
			image: `https://arweave.net/${logoId}`,
		});
		expect(
			collectionAsset(
				{
					...tokens,
					assets: [
						{
							id: processId,
							name: 'Indexed Token',
							contentType: 'application/x.arweave-token',
							ticker: 'NEW',
						},
					],
				},
				processId,
				state
			)
		).toEqual({
			id: processId,
			name: 'Indexed Token',
			ticker: 'NEW',
			contentType: 'application/x.arweave-token',
			image: `https://arweave.net/${logoId}`,
		});
		expect(
			collectionAsset(tokens, processId, {
				...state,
				raw: { ...state.raw, 'scheduler-mode': 'local' },
			})
		).toBeUndefined();
		for (const legacyTag of ['hint-style', 'asset-type']) {
			const raw = { ...state.raw, [legacyTag]: 'fungible' };
			delete raw['hint-ui-style'];
			expect(collectionAsset(tokens, processId, { ...state, raw })).toMatchObject({
				id: processId,
				name: 'Unloaded Token',
			});
		}
		expect(
			collectionAsset(tokens, processId, {
				...state,
				raw: { ...state.raw, 'hint-ui-style': 'non-fungible', 'asset-type': 'fungible' },
			})
		).toBeUndefined();
	});

	it('retains loaded token pages when a refresh returns only page one or its fallback', () => {
		const token = (id: string): Collection => ({
			id: 'fungible-tokens',
			name: 'Tokens',
			description: 'Tokens',
			kind: 'tokens',
			assets: Array.from({ length: Number(id) }, (_, index) => ({
				id: String(index).padStart(43, 'A'),
				name: `Token ${index}`,
			})),
			total: 250,
			cursor: `cursor-${id}`,
			cursorHistory: Array.from({ length: Number(id) / 100 }, (_, index) => `cursor-${index}`),
			hasMore: true,
		});
		const current = token('200');
		const firstPage = token('100');
		const fallback = {
			...token('1'),
			indexSource: 'compiled-fallback' as const,
		};

		const refreshed = mergeCollectionSnapshots([current], [firstPage])[0];
		expect(refreshed.assets).toHaveLength(200);
		expect(refreshed.cursor).toBe('cursor-200');
		expect(refreshed.cursorHistory).toHaveLength(2);
		expect(mergeCollectionSnapshots([current], [firstPage], true)[0].assets).toHaveLength(200);
		expect(mergeCollectionSnapshots([current], [fallback])).toEqual([current]);
	});

	it('restarts token pagination when a refreshed first page contains newly indexed records', async () => {
		const asset = (prefix: string, index: number) => ({
			id: `${prefix}${index.toString(36).padStart(42, '0')}`,
			name: `${prefix} ${index}`,
		});
		const base = (assets: Collection['assets']): Collection => ({
			id: 'fungible-tokens',
			name: 'Tokens',
			description: 'Tokens',
			kind: 'tokens',
			assets,
			total: 350,
		});
		const oldAssets = Array.from({ length: 200 }, (_, index) => asset('O', index));
		const firstNewPage = Array.from({ length: 100 }, (_, index) => asset('N', index));
		const current: Collection = {
			...base(oldAssets),
			cursor: 'old-200',
			cursorHistory: ['old-100', 'old-200'],
			hasMore: false,
		};
		const replacement: Collection = {
			...base(firstNewPage),
			cursor: 'new-100',
			cursorHistory: ['new-100'],
			hasMore: true,
		};
		const refreshed = mergeCollectionSnapshots([current], [replacement], true)[0];

		expect(refreshed.assets).toHaveLength(300);
		expect(refreshed.assets.slice(0, 100)).toEqual(firstNewPage);
		expect(refreshed.cursor).toBe('new-100');
		expect(refreshed.cursorHistory).toEqual(['new-100']);
		expect(refreshed.hasMore).toBe(true);

		vi.stubGlobal(
			'fetch',
			vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
				const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
				expect(body.variables.after).toBe('new-100');
				return Response.json({
					data: {
						transactions: {
							count: '350',
							pageInfo: { hasNextPage: false },
							edges: Array.from({ length: 50 }, (_, index) => ({
								cursor: `new-${101 + index}`,
								node: {
									id: asset('N', 100 + index).id,
									tags: [{ name: 'Name', value: `N ${100 + index}` }],
								},
							})),
						},
					},
				});
			})
		);

		const complete = await loadMoreFungibleTokens(refreshed);
		expect(complete.assets).toHaveLength(350);
		expect(complete.hasMore).toBe(false);
	});

	it('preserves verified positions during progress and can reconcile canonical final order', () => {
		const collection = (id: string, name: string): Collection => ({
			id,
			name,
			description: name,
			kind: 'images',
			assets: [],
		});

		expect(
			mergeCollectionSnapshots(
				[collection('names', 'Names'), collection('art', 'Old art')],
				[collection('art', 'Fresh art'), collection('token', 'Token')]
			).map(({ id, name }) => ({ id, name }))
		).toEqual([
			{ id: 'names', name: 'Names' },
			{ id: 'art', name: 'Fresh art' },
			{ id: 'token', name: 'Token' },
		]);
		expect(
			mergeCollectionSnapshots(
				[collection('names', 'Names'), collection('art', 'Old art')],
				[collection('art', 'Fresh art'), collection('token', 'Token')],
				true
			).map(({ id, name }) => ({ id, name }))
		).toEqual([
			{ id: 'art', name: 'Fresh art' },
			{ id: 'token', name: 'Token' },
			{ id: 'names', name: 'Names' },
		]);
	});

	it('preserves unchanged collection identities as other sources arrive', () => {
		const stable: Collection = {
			id: 'stable',
			name: 'Stable collection',
			description: 'Already loaded',
			kind: 'images',
			assets: [],
		};
		const arrived: Collection = {
			id: 'arrived',
			name: 'Later collection',
			description: 'Loaded independently',
			kind: 'images',
			assets: [],
		};

		expect(mergeCollectionSnapshots([stable], [stable, arrived])[0]).toBe(stable);
	});

	it('settles in the same canonical order regardless of source completion timing', () => {
		const collection = (id: string): Collection => ({
			id,
			name: id,
			description: id,
			kind: 'images',
			assets: [],
		});
		const canonical = ['names', 'token', 'art-one', 'art-two'].map(collection);
		const finish = (snapshots: Collection[][]) => {
			const progress = snapshots
				.slice(0, -1)
				.reduce((current, next) => mergeCollectionSnapshots(current, next), []);
			return mergeCollectionSnapshots(progress, snapshots.at(-1) ?? [], true);
		};

		expect(
			finish([
				[canonical[3]],
				[canonical[1], canonical[3]],
				[canonical[0], canonical[1], canonical[3]],
				canonical,
			]).map(({ id }) => id)
		).toEqual(canonical.map(({ id }) => id));
		expect(
			finish([
				[canonical[0]],
				[canonical[0], canonical[2]],
				[canonical[0], canonical[2], canonical[3]],
				canonical,
			]).map(({ id }) => id)
		).toEqual(canonical.map(({ id }) => id));
	});

	it('does not replace a paginated names snapshot with a stale first page', () => {
		const first = 'A'.repeat(43);
		const second = 'B'.repeat(43);
		const namespace = {
			manifestId: NAMES_NAMESPACE_ID,
			namesById: { [first]: 'alice', [second]: 'bob' },
		};
		const current: Collection = {
			id: 'arweave-names',
			name: 'Names before refresh',
			description: 'Old metadata',
			kind: 'names',
			assets: [
				{ id: first, name: 'alice' },
				{ id: second, name: 'bob' },
			],
			cursor: 'second-page-cursor',
			hasMore: true,
			namespace,
		};
		const incoming: Collection = {
			...current,
			name: 'Current names',
			description: 'Refreshed metadata',
			assets: [{ id: first, name: 'alice' }],
			cursor: 'first-page-cursor',
		};

		expect(mergeCollectionSnapshots([current], [incoming])).toEqual([
			{
				...incoming,
				assets: current.assets,
				cursor: 'second-page-cursor',
				hasMore: true,
				total: undefined,
			},
		]);
	});

	it('publishes successful sources progressively and reports partial failures', async () => {
		const nameId = 'N'.repeat(43);
		const imageManifest = encodeJson({
			name: '[TEST] Progressive images',
			assets: [{ id: 'I'.repeat(43), name: 'Image one' }],
		});
		const namesNamespace = encodeJson({
			manifest: 'arweave/paths',
			version: '0.2.0',
			paths: { alice: { id: nameId } },
		});
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const body = typeof init?.body === 'string' ? init.body : '';
				if (body.includes('CarrierAssets')) {
					return Response.json({
						data: {
							transactions: {
								count: 1,
								pageInfo: { hasNextPage: false },
								edges: [
									{
										cursor: 'carrier-cursor',
										node: { id: nameId, tags: [{ name: 'name', value: 'alice' }] },
									},
								],
							},
						},
					});
				}
				if (String(input).includes(`/tx/${NAMES_NAMESPACE_ID}/data`)) return new Response(namesNamespace);
				if (String(input).includes('/tx/8aITB5SF-jc9MXx9IuCe_RaAoOrUHkkvgsy0cmLNCQw/data')) {
					await new Promise((resolve) => setTimeout(resolve, 5));
					return new Response(imageManifest);
				}
				return new Response('unavailable', { status: 503 });
			})
		);
		const progress: string[][] = [];

		const result = await loadCollections(undefined, (collections) => {
			progress.push(collections.map((collection) => collection.id));
		});

		expect(result.collections.map((collection) => collection.id)).toEqual([
			'arweave-names',
			'fungible-tokens',
			'A7TGD0bktXYkQSrz4UWfPqgcb8A4TAOEsKQU5_zAu7g',
		]);
		expect(result.unavailable).toEqual([
			'[TEST] Bazar Fungible Tokens',
			'[TEST] Progressive images',
			'Permanent artwork collection 2',
			'Bazar collection discovery',
		]);
		expect(result.collections.find((collection) => collection.name === '[TEST] Progressive images')).toMatchObject({
			indexSource: 'compiled-fallback',
			manifestId: '8aITB5SF-jc9MXx9IuCe_RaAoOrUHkkvgsy0cmLNCQw',
		});
		expect(progress.at(-1)).toEqual([
			'arweave-names',
			'fungible-tokens',
			'A7TGD0bktXYkQSrz4UWfPqgcb8A4TAOEsKQU5_zAu7g',
		]);
		expect(progress.some((ids) => ids.length === 2)).toBe(true);
	});

	it('publishes exact namespace membership before the first carrier page settles', async () => {
		const controller = new AbortController();
		const reason = new Error('test-complete');
		const nameId = 'N'.repeat(43);
		const namespace = encodeJson({
			manifest: 'arweave/paths',
			version: '0.2.0',
			paths: { alice: { id: nameId } },
		});
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const body = typeof init?.body === 'string' ? init.body : '';
				if (body.includes('CarrierAssets')) {
					return new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
					});
				}
				if (body.includes('FungibleTokens')) {
					return Response.json({
						data: { transactions: { count: 0, pageInfo: { hasNextPage: false }, edges: [] } },
					});
				}
				if (String(input).includes(`/tx/${NAMES_NAMESPACE_ID}/data`)) return new Response(namespace);
				return new Response('unavailable', { status: 503 });
			})
		);
		let resolveNames!: (collection: Collection) => void;
		const namesProgress = new Promise<Collection>((resolve) => {
			resolveNames = resolve;
		});
		const loading = loadCollections(controller.signal, (collections) => {
			const names = collections.find((collection) => collection.kind === 'names');
			if (names) resolveNames(names);
		});

		const names = await namesProgress;
		expect(names.assets).toEqual([]);
		expect(collectionAsset(names, nameId)?.name).toBe('alice');
		controller.abort(reason);
		await expect(loading).rejects.toBe(reason);
	});

	it('starts carrier discovery while the namespace manifest is still loading', async () => {
		const controller = new AbortController();
		const reason = new Error('test-complete');
		const requests: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const body = typeof init?.body === 'string' ? init.body : '';
				if (body.includes('CarrierAssets')) {
					requests.push('carrier');
					return new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
					});
				}
				if (String(input).includes(`/tx/${NAMES_NAMESPACE_ID}/data`)) {
					requests.push('namespace');
					return new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
					});
				}
				return new Response('unavailable', { status: 503 });
			})
		);

		const loading = loadCollections(controller.signal);
		await vi.waitFor(() => expect(requests).toEqual(expect.arrayContaining(['namespace', 'carrier'])));
		controller.abort(reason);
		await expect(loading).rejects.toBe(reason);
	});

	it('discovers every fungible token across GraphQL pages without duplicate assets', async () => {
		const tokenIds = [
			FUNGIBLE_TOKEN_ID,
			...Array.from({ length: 100 }, (_, index) => `${index.toString(36).padStart(42, '0')}A`),
		];
		const tokenEdge = (id: string, index: number) => ({
			cursor: `token-${index}`,
			node: { id, tags: [{ name: 'Name', value: `Token ${index}` }] },
		});
		const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
			if (!body.query?.includes('FungibleTokens')) return new Response('unavailable', { status: 503 });
			const secondPage = body.variables.after === 'token-99';
			return Response.json({
				data: {
					transactions: {
						count: '101',
						pageInfo: { hasNextPage: !secondPage },
						edges: secondPage
							? [tokenEdge(tokenIds[100], 100), tokenEdge(tokenIds[100], 101)]
							: tokenIds.slice(0, 100).map(tokenEdge),
					},
				},
			});
		});
		vi.stubGlobal('fetch', fetcher);

		const result = await loadCollections();
		const firstPage = result.collections.find((collection) => collection.kind === 'tokens');
		expect(firstPage?.assets).toHaveLength(100);
		expect(firstPage?.hasMore).toBe(true);
		const tokens = await loadMoreFungibleTokens(firstPage!);

		expect(tokens?.assets).toHaveLength(101);
		expect(tokens?.assets.at(-1)?.id).toBe(tokenIds[100]);
		expect(tokens?.total).toBe(101);
		expect(
			fetcher.mock.calls.filter(
				([, init]) => typeof init?.body === 'string' && init.body.includes('FungibleTokens')
			)
		).toHaveLength(2);
	});

	it('includes fungible tokens indexed under immutable legacy marker names', async () => {
		const legacyId = 'L'.repeat(43);
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
				const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
				if (!body.query?.includes('FungibleTokens')) return new Response('unavailable', { status: 503 });
				return Response.json({
					data: {
						transactions: { count: 0, pageInfo: { hasNextPage: false }, edges: [] },
						legacyHintStyle: { count: 0, pageInfo: { hasNextPage: false }, edges: [] },
						legacyAssetType: {
							count: 1,
							pageInfo: { hasNextPage: false },
							edges: [
								{
									cursor: 'legacy-token',
									node: {
										id: legacyId,
										tags: [
											{ name: 'asset-type', value: 'fungible' },
											{ name: 'name', value: 'Legacy Token' },
											{ name: 'ticker', value: 'OLD' },
										],
									},
								},
							],
						},
					},
				});
			})
		);

		const result = await loadCollections();
		const tokens = result.collections.find((collection) => collection.kind === 'tokens');

		expect(tokens?.assets).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: legacyId, name: 'Legacy Token', ticker: 'OLD' })])
		);
		expect(tokens?.total).toBe(2);
	});

	it('retains loaded fungible tokens when a later page is unavailable', async () => {
		const tokenIds = Array.from({ length: 100 }, (_, index) => `${index.toString(36).padStart(42, '0')}T`);
		let page = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
				const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
				if (!body.query?.includes('FungibleTokens')) return new Response('unavailable', { status: 503 });
				page += 1;
				if (page > 1) return new Response('unavailable', { status: 503 });
				return Response.json({
					data: {
						transactions: {
							count: 101,
							pageInfo: { hasNextPage: true },
							edges: tokenIds.map((id, index) => ({
								cursor: `token-${index}`,
								node: { id, tags: [{ name: 'Name', value: `Token ${index}` }] },
							})),
						},
					},
				});
			})
		);

		const result = await loadCollections();
		const firstPage = result.collections.find((collection) => collection.kind === 'tokens')!;
		const ids = firstPage.assets.map((asset) => asset.id);

		await expect(loadMoreFungibleTokens(firstPage)).rejects.toThrow('fungible-index-503');
		expect(firstPage.assets.map((asset) => asset.id)).toEqual(ids);
		expect(firstPage.hasMore).toBe(true);
	});

	it('rejects a recurring fungible cursor across on-demand pages', async () => {
		const cursors = ['cursor-a', 'cursor-b', 'cursor-a'];
		let page = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
				const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
				if (!body.query?.includes('FungibleTokens')) return new Response('unavailable', { status: 503 });
				const cursor = cursors[page];
				const id = `${page.toString(36).padStart(42, '0')}C`;
				page += 1;
				return Response.json({
					data: {
						transactions: {
							count: 3,
							pageInfo: { hasNextPage: true },
							edges: [{ cursor, node: { id, tags: [{ name: 'Name', value: `Token ${page}` }] } }],
						},
					},
				});
			})
		);

		const result = await loadCollections();
		const firstPage = result.collections.find((collection) => collection.kind === 'tokens')!;
		const secondPage = await loadMoreFungibleTokens(firstPage);

		await expect(loadMoreFungibleTokens(secondPage)).rejects.toThrow('fungible-index-pagination-stalled');
		expect(page).toBe(3);
	});

	it('keeps only namespace carriers, uses manifest names, and advances the raw cursor', async () => {
		const first = 'A'.repeat(43);
		const second = 'B'.repeat(43);
		const stale = 'S'.repeat(43);
		const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
			expect(String(input)).toBe('https://arweave.net/graphql');
			expect(body.variables.after).toBe('first-cursor');
			return Response.json({
				data: {
					transactions: {
						pageInfo: { hasNextPage: false },
						edges: [
							{
								cursor: 'second-cursor',
								node: { id: second, tags: [{ name: 'name', value: 'wrong-name' }] },
							},
							{
								cursor: 'stale-cursor',
								node: { id: stale, tags: [{ name: 'name', value: 'stale' }] },
							},
						],
					},
				},
			});
		});
		vi.stubGlobal('fetch', fetcher);

		const updated = await loadMoreCarrierNames({
			id: 'arweave-names',
			name: 'Arweave names',
			description: 'Names',
			kind: 'names',
			assets: [{ id: first, name: 'first' }],
			cursor: 'first-cursor',
			hasMore: true,
			namespace: {
				manifestId: NAMES_NAMESPACE_ID,
				namesById: { [first]: 'first', [second]: 'canonical-second' },
			},
		});

		expect(updated.assets.map(({ id }) => id)).toEqual([first, second]);
		expect(updated.assets[1].name).toBe('canonical-second');
		expect(updated.cursor).toBe('stale-cursor');
		expect(updated.hasMore).toBe(false);
		expect(updated.total).toBe(2);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('advances through a carrier page with no current namespace matches', async () => {
		const first = 'A'.repeat(43);
		const stale = 'S'.repeat(43);
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				Response.json({
					data: {
						transactions: {
							pageInfo: { hasNextPage: true },
							edges: [
								{
									cursor: 'next-raw-cursor',
									node: { id: stale, tags: [{ name: 'name', value: 'stale' }] },
								},
							],
						},
					},
				})
			)
		);

		const updated = await loadMoreCarrierNames({
			id: 'arweave-names',
			name: 'Arweave names',
			description: 'Names',
			kind: 'names',
			assets: [{ id: first, name: 'first' }],
			cursor: 'first-cursor',
			hasMore: true,
			namespace: { manifestId: NAMES_NAMESPACE_ID, namesById: { [first]: 'first' } },
		});

		expect(updated.assets).toEqual([{ id: first, name: 'first' }]);
		expect(updated.cursor).toBe('next-raw-cursor');
		expect(updated.hasMore).toBe(true);
		expect(updated.total).toBeUndefined();
	});

	it('strictly parses the names namespace without treating every path as a carrier', () => {
		const carrier = 'C'.repeat(43);
		const reference = 'R'.repeat(43);
		const parsed = parseNamesNamespace(NAMES_NAMESPACE_ID, {
			manifest: 'arweave/paths',
			version: '0.2.0',
			paths: {
				alice: { id: carrier },
				bob: { id: reference },
			},
		});

		expect(parsed).toEqual({
			manifestId: NAMES_NAMESPACE_ID,
			namesById: { [carrier]: 'alice', [reference]: 'bob' },
		});
	});

	it('resolves direct name routes only from the current namespace', () => {
		const current = 'C'.repeat(43);
		const stale = 'S'.repeat(43);
		const collection: Collection = {
			id: 'arweave-names',
			name: 'Arweave names',
			description: 'Names',
			kind: 'names',
			assets: [{ id: current, name: 'untrusted-loaded-name' }],
			namespace: {
				manifestId: NAMES_NAMESPACE_ID,
				namesById: { [current]: 'current-name' },
			},
		};

		expect(collectionAsset(collection, current)).toEqual({ id: current, name: 'current-name' });
		expect(collectionAsset(collection, stale)).toBeUndefined();
	});

	it.each([
		[
			'wrong manifest',
			{ manifest: 'arweave/transactions', version: '0.2.0', paths: { alice: { id: 'A'.repeat(43) } } },
		],
		['wrong version', { manifest: 'arweave/paths', version: '0.1.0', paths: { alice: { id: 'A'.repeat(43) } } }],
		['empty paths', { manifest: 'arweave/paths', version: '0.2.0', paths: {} }],
		['empty name', { manifest: 'arweave/paths', version: '0.2.0', paths: { '': { id: 'A'.repeat(43) } } }],
		['invalid id', { manifest: 'arweave/paths', version: '0.2.0', paths: { alice: { id: 'invalid' } } }],
		[
			'duplicate id',
			{
				manifest: 'arweave/paths',
				version: '0.2.0',
				paths: { alice: { id: 'A'.repeat(43) }, bob: { id: 'A'.repeat(43) } },
			},
		],
	])('rejects a names namespace with %s', (_label, manifest) => {
		expect(() => parseNamesNamespace(NAMES_NAMESPACE_ID, manifest)).toThrow('names-namespace-schema');
	});

	it('records the manifest resolved through a live reference', async () => {
		const referenceId = 'R'.repeat(43);
		const manifestId = 'M'.repeat(43);
		const fallbackId = 'F'.repeat(43);
		const encode = (value: string) => btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
		const manifest = encodeUtf8Json({
			name: 'Referenced collection — café 🐈',
			assets: [{ id: 'A'.repeat(43), name: 'Asset one' }],
		});
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.endsWith(`/tx/${referenceId}`)) {
					return Response.json({
						data: '',
						tags: [{ name: encode('reference-value'), value: encode(manifestId) }],
					});
				}
				if (url.endsWith(`/tx/${manifestId}/data`)) return new Response(manifest);
				return new Response('unexpected', { status: 500 });
			})
		);

		await expect(loadImageCollection(referenceId, fallbackId)).resolves.toMatchObject({
			name: 'Referenced collection — café 🐈',
			indexSource: 'reference',
			manifestId,
		});
	});

	it.each([
		['pending', 'Accepted'],
		['malformed', encodeJson({ name: 'Broken collection', assets: [{ id: 'invalid', name: 'Broken' }] })],
	])('retains the published manifest when the live reference target is %s', async (_label, liveBody) => {
		const referenceId = 'R'.repeat(43);
		const manifestId = 'M'.repeat(43);
		const fallbackId = 'F'.repeat(43);
		const encode = (value: string) => btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
		const fallback = encodeJson({
			name: 'Published collection',
			assets: [{ id: 'A'.repeat(43), name: 'Asset one' }],
		});
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.endsWith(`/tx/${referenceId}`)) {
				return Response.json({
					tags: [{ name: encode('reference-value'), value: encode(manifestId) }],
				});
			}
			if (url.endsWith(`/tx/${manifestId}/data`)) return new Response(liveBody);
			if (url.endsWith(`/tx/${fallbackId}/data`)) return new Response(fallback);
			return new Response('unexpected', { status: 500 });
		});
		vi.stubGlobal('fetch', fetcher);

		await expect(loadImageCollection(referenceId, fallbackId)).resolves.toMatchObject({
			name: 'Published collection',
			indexSource: 'compiled-fallback',
			manifestId: fallbackId,
		});
		expect(fetcher).toHaveBeenCalledTimes(3);
	});

	it('waits for the live image reference before loading an index', async () => {
		const referenceId = 'A7TGD0bktXYkQSrz4UWfPqgcb8A4TAOEsKQU5_zAu7g';
		const publishedManifestId = '8aITB5SF-jc9MXx9IuCe_RaAoOrUHkkvgsy0cmLNCQw';
		const liveManifestId = 'L'.repeat(43);
		const encode = (value: string) => btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
		const live = encodeJson({
			name: 'Live collection',
			assets: [{ id: 'B'.repeat(43), name: 'Live asset' }],
		});
		let resolveReference!: (response: Response) => void;
		const reference = new Promise<Response>((resolve) => {
			resolveReference = resolve;
		});
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.endsWith(`/tx/${referenceId}`)) return reference;
			if (url.endsWith(`/tx/${liveManifestId}/data`)) return new Response(live);
			return new Response('unavailable', { status: 503 });
		});
		vi.stubGlobal('fetch', fetcher);
		let settled = false;
		const loading = loadImageCollection(referenceId, publishedManifestId);
		void loading.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
			expect.stringContaining(`/tx/${referenceId}`),
		]);

		resolveReference(Response.json({ tags: [{ name: encode('reference-value'), value: encode(liveManifestId) }] }));
		const result = await loading;

		expect(result).toMatchObject({
			name: 'Live collection',
			manifestId: liveManifestId,
			indexSource: 'reference',
		});
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
			expect.stringContaining(`/tx/${referenceId}`),
			expect.stringContaining(`/tx/${liveManifestId}/data`),
		]);
	});

	it('does not start a fallback image request after abort', async () => {
		const controller = new AbortController();
		const reason = new Error('gateway-changed');
		const referenceId = 'R'.repeat(43);
		const publishedManifestId = 'F'.repeat(43);
		const pending = new Promise<Response>(() => undefined);
		const fetcher = vi.fn(async () => pending);
		vi.stubGlobal('fetch', fetcher);
		const loading = loadImageCollection(referenceId, publishedManifestId, controller.signal);

		expect(fetcher).toHaveBeenCalledTimes(1);
		controller.abort(reason);

		await expect(loading).rejects.toBe(reason);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('does not turn an aborted load into fallback marketplace content', async () => {
		const controller = new AbortController();
		const reason = new Error('gateway-changed');
		vi.stubGlobal(
			'fetch',
			vi.fn(
				(_input: RequestInfo | URL, init?: RequestInit) =>
					new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
					})
			)
		);
		const progress = vi.fn();
		const loading = loadCollections(controller.signal, progress);

		controller.abort(reason);

		await expect(loading).rejects.toBe(reason);
		expect(progress).not.toHaveBeenCalled();
	});

	it('does not present a configured fallback as a successful marketplace bootstrap', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('unavailable', { status: 503 }))
		);
		const progress = vi.fn();

		await expect(loadCollections(undefined, progress)).rejects.toThrow('collection-indexes-unavailable');
		expect(progress).not.toHaveBeenCalled();
	});
});
