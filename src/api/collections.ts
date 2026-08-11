import { arweaveGatewayFromLocation, arweaveGraphqlEndpoint, NAMES_NAMESPACE_ID } from 'helpers/config';

import type { AssetState } from './asset-marketplace';
import { fetchJsonWithDeadline, fetchTextWithDeadline } from './fetch-with-deadline';

const ARWEAVE_ID = /^[A-Za-z0-9_-]{43}$/;
const collectionAssetIndexes = new WeakMap<AssetSummary[], ReadonlyMap<string, AssetSummary>>();

export type AssetSummary = {
	id: string;
	name: string;
	contentType?: string;
	image?: string;
	media?: string;
	ticker?: string;
};

export type Collection = {
	id: string;
	name: string;
	description: string;
	kind: 'names' | 'images' | 'tokens';
	assets: AssetSummary[];
	total?: number;
	cursor?: string;
	cursorHistory?: string[];
	hasMore?: boolean;
	indexSource?: 'reference' | 'compiled-fallback';
	manifestId?: string;
	namespace?: NamesNamespaceIndex;
};

export type NamesNamespaceIndex = {
	manifestId: string;
	namesById: Readonly<Record<string, string>>;
};

function loadedCollectionAsset(assets: AssetSummary[], id: string) {
	let index = collectionAssetIndexes.get(assets);
	if (!index) {
		const loaded = new Map<string, AssetSummary>();
		for (const asset of assets) {
			if (!loaded.has(asset.id)) loaded.set(asset.id, asset);
		}
		index = loaded;
		collectionAssetIndexes.set(assets, index);
	}
	return index.get(id);
}

/** Return an indexed asset, or an exact live fungible process belonging to the token collection. */
export function collectionAsset(collection: Collection, id: string, state?: AssetState): AssetSummary | undefined {
	if (!ARWEAVE_ID.test(id)) return undefined;
	const loaded = loadedCollectionAsset(collection.assets, id);
	if (collection.kind === 'tokens') {
		if (!state) return loaded;
		const verified = fungibleAssetFromState(id, state);
		return verified ? loaded ?? verified : undefined;
	}
	if (collection.kind !== 'names') return loaded;
	const name = collection.namespace?.namesById[id];
	return name ? (loaded ? { ...loaded, name } : { id, name }) : undefined;
}

export function fungibleAssetFromState(id: string, state?: AssetState): AssetSummary | undefined {
	if (
		!ARWEAVE_ID.test(id) ||
		!state ||
		state.raw.device !== 'process@1.0' ||
		state.device !== 'token@1.0' ||
		state.raw['asset-type'] !== 'fungible' ||
		state.raw['swap-device'] !== 'arweave-swap@1.0' ||
		state.raw['scheduler-device'] !== 'arweave-scheduler@1.0' ||
		state.raw['scheduler-mode'] !== 'all'
	)
		return undefined;
	const logo = state.raw.logo;
	return {
		id,
		name: state.name || state.ticker || shortId(id),
		contentType: 'application/x.arweave-token',
		...(state.ticker ? { ticker: state.ticker } : {}),
		...(typeof logo === 'string' && ARWEAVE_ID.test(logo)
			? { image: `${arweaveGatewayFromLocation()}/${logo}` }
			: {}),
	};
}

type ImageManifest = {
	name: string;
	description?: string;
	assets: Array<{ id: string; name: string; contentType?: string; image?: string; media?: string }>;
};

type FungibleTokenConnection = {
	count: number | string;
	pageInfo: { hasNextPage: boolean };
	edges: Array<{
		cursor: string;
		node: { id: string; tags: Array<{ name: string; value: string }> };
	}>;
};

type FungibleTokenPage = {
	assets: AssetSummary[];
	cursor?: string;
	hasMore: boolean;
	total: number;
};

type CarrierPage = {
	edges: Array<{
		cursor: string;
		node: { id: string; tags: Array<{ name: string; value: string }> };
	}>;
	cursor?: string;
	hasMore: boolean;
};

const IMAGE_COLLECTIONS = [
	{
		reference: import.meta.env.VITE_COLLECTION_ONE_REFERENCE ?? 'A7TGD0bktXYkQSrz4UWfPqgcb8A4TAOEsKQU5_zAu7g',
		manifest: '8aITB5SF-jc9MXx9IuCe_RaAoOrUHkkvgsy0cmLNCQw',
	},
	{
		reference: import.meta.env.VITE_COLLECTION_TWO_REFERENCE ?? 'IMKioUfmOrqtTnrLO3_Jpg5zv8zg8PKjWYNVhD3xsZM',
		manifest: 'EK3bWZ0yvkYZ8btaPw0q-fNWsKLUeOeq3blqhRQlQJg',
	},
].filter((collection) => /^[A-Za-z0-9_-]{43}$/.test(collection.reference));

const MAX_INDEX_PAGES = 1_000;

export const IMAGE_COLLECTION_REFERENCES = IMAGE_COLLECTIONS.map((collection) => collection.reference);

export const FUNGIBLE_TOKEN_ID =
	import.meta.env.VITE_FUNGIBLE_TOKEN_ID ?? 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';

export type CollectionLoadResult = {
	collections: Collection[];
	unavailable: string[];
};

export function mergeCollectionSnapshots(
	current: Collection[],
	next: Collection[],
	canonicalOrder = false
): Collection[] {
	const source = canonicalOrder ? next : current;
	const additions = canonicalOrder ? current : next;
	const replacements = new Map(next.map((collection) => [collection.id, collection]));
	const retainedCollections = new Map(current.map((collection) => [collection.id, collection]));
	const sourceIds = new Set(source.map((collection) => collection.id));
	return [
		...source.map((collection) => {
			const replacement = replacements.get(collection.id);
			if (!replacement) return collection;
			if (replacement === collection && retainedCollections.get(collection.id) === collection) {
				return collection;
			}
			if (collection.kind === 'tokens' && replacement.kind === 'tokens') {
				const retained = retainedCollections.get(collection.id) ?? collection;
				if (retained.indexSource !== 'compiled-fallback' && replacement.indexSource === 'compiled-fallback')
					return retained;
				const refreshed = new Map(replacement.assets.map((asset) => [asset.id, asset]));
				const sameWindow = replacement.assets.every((asset, index) => retained.assets[index]?.id === asset.id);
				const currentIsAhead =
					sameWindow && (retained.cursorHistory?.length ?? 0) > (replacement.cursorHistory?.length ?? 0);
				const primary = sameWindow ? retained.assets : replacement.assets;
				const additions = sameWindow ? replacement.assets : retained.assets;
				const seen = new Set(primary.map((asset) => asset.id));
				return {
					...replacement,
					assets: [
						...primary.map((asset) => refreshed.get(asset.id) ?? asset),
						...additions.filter((asset) => !seen.has(asset.id)),
					],
					...(currentIsAhead
						? {
								cursor: retained.cursor,
								cursorHistory: retained.cursorHistory,
								hasMore: retained.hasMore,
						  }
						: {}),
					total: Math.max(retained.total ?? 0, replacement.total ?? 0),
				};
			}
			if (
				collection.kind !== 'names' ||
				replacement.kind !== 'names' ||
				collection.namespace?.manifestId !== replacement.namespace?.manifestId
			)
				return replacement;
			const seen = new Set(collection.assets.map((asset) => asset.id));
			return {
				...replacement,
				assets: [...collection.assets, ...replacement.assets.filter((asset) => !seen.has(asset.id))],
				cursor: collection.cursor ?? replacement.cursor,
				cursorHistory: collection.cursorHistory ?? replacement.cursorHistory,
				hasMore: collection.hasMore ?? replacement.hasMore,
				total: collection.total,
			};
		}),
		...additions.filter((collection) => !sourceIds.has(collection.id)),
	];
}

type CollectionSource = {
	label: string;
	load: (onProgress?: (collection: Collection) => void) => Promise<Collection>;
	fallback?: () => Collection;
};

export async function loadCollections(
	signal?: AbortSignal,
	onProgress?: (collections: Collection[]) => void
): Promise<CollectionLoadResult> {
	const sources: CollectionSource[] = [
		{ label: 'Arweave names', load: (progress) => loadNames(signal, progress) },
		{
			label: 'Fungible token discovery',
			load: () => loadFungibleTokens(signal),
			fallback: () => ({
				...fungibleTokenCollection([defaultFungibleToken()]),
				indexSource: 'compiled-fallback',
			}),
		},
		...IMAGE_COLLECTIONS.map(({ reference, manifest }, index) => ({
			label: `Permanent artwork collection ${index + 1}`,
			load: () => loadImageCollection(reference, manifest, signal),
		})),
	];
	const collections = new Array<Collection | undefined>(sources.length);
	const successes = new Array<boolean>(sources.length).fill(false);
	const failures = new Array<boolean>(sources.length).fill(false);
	await Promise.all(
		sources.map(async (source, index) => {
			let settled = false;
			try {
				collections[index] = await source.load((collection) => {
					if (settled || signal?.aborted) return;
					collections[index] = collection;
					if (successes.some(Boolean)) {
						onProgress?.(collections.filter((item): item is Collection => Boolean(item)));
					}
				});
				settled = true;
				throwIfAborted(signal);
				successes[index] = true;
				failures[index] = collections[index]?.indexSource === 'compiled-fallback';
			} catch (cause) {
				settled = true;
				throwIfAborted(signal);
				failures[index] = true;
				collections[index] = source.fallback?.();
			}
			if (successes.some(Boolean)) {
				onProgress?.(collections.filter((item): item is Collection => Boolean(item)));
			}
		})
	);
	const loaded = collections.filter((item): item is Collection => Boolean(item));
	if (!successes.some(Boolean)) throw new Error('collection-indexes-unavailable');
	return {
		collections: loaded,
		unavailable: sources
			.map((source, index) => (failures[index] ? collections[index]?.name ?? source.label : undefined))
			.filter((label): label is string => Boolean(label)),
	};
}

function throwIfAborted(signal?: AbortSignal) {
	if (!signal?.aborted) return;
	throw signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError');
}

async function loadFungibleTokens(signal?: AbortSignal): Promise<Collection> {
	const page = await loadFungibleTokenPage(undefined, signal);
	const assets = [...page.assets];
	if (ARWEAVE_ID.test(FUNGIBLE_TOKEN_ID) && !assets.some((asset) => asset.id === FUNGIBLE_TOKEN_ID)) {
		assets.unshift(defaultFungibleToken());
	}
	return {
		...fungibleTokenCollection(assets, page.total),
		cursor: page.cursor,
		cursorHistory: page.cursor ? [page.cursor] : [],
		hasMore: page.hasMore,
	};
}

export async function loadMoreFungibleTokens(collection: Collection, signal?: AbortSignal): Promise<Collection> {
	if (collection.kind !== 'tokens' || !collection.hasMore) return collection;
	const page = await loadFungibleTokenPage(collection.cursor, signal);
	const cursorHistory = collection.cursorHistory ?? (collection.cursor ? [collection.cursor] : []);
	if (page.cursor && (cursorHistory.includes(page.cursor) || cursorHistory.length >= MAX_INDEX_PAGES)) {
		throw new Error('fungible-index-pagination-stalled');
	}
	const replacements = new Map(page.assets.map((asset) => [asset.id, asset]));
	const seen = new Set(collection.assets.map((asset) => asset.id));
	const assets = [
		...collection.assets.map((asset) => replacements.get(asset.id) ?? asset),
		...page.assets.filter((asset) => !seen.has(asset.id)),
	];
	return {
		...collection,
		assets,
		cursor: page.cursor,
		cursorHistory: page.cursor ? [...cursorHistory, page.cursor] : cursorHistory,
		hasMore: page.hasMore,
		total: Math.max(page.total, assets.length),
	};
}

async function loadFungibleTokenPage(after?: string, signal?: AbortSignal): Promise<FungibleTokenPage> {
	const result = await fetchJsonWithDeadline<any>(
		fetch,
		arweaveGraphqlEndpoint(),
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				query: `query FungibleTokens($after: String) {
				transactions(
					after: $after
					first: 100
					sort: HEIGHT_DESC
					tags: [
						{ name: "device", values: ["process@1.0"] }
						{ name: "execution-device", values: ["token@1.0"] }
						{ name: "swap-device", values: ["arweave-swap@1.0"] }
						{ name: "scheduler-device", values: ["arweave-scheduler@1.0"] }
						{ name: "asset-type", values: ["fungible"] }
						{ name: "scheduler-mode", values: ["all"] }
					]
				) {
					count
					pageInfo { hasNextPage }
					edges { cursor node { id tags { name value } } }
				}
			}`,
				variables: { after: after ?? null },
			}),
			signal,
		},
		{
			timeoutError: 'fungible-index-timeout',
		}
	);
	const response = result.response;
	const payload: any = result.body;
	if (!response.ok) throw new Error(`fungible-index-${response.status}`);
	if (!payload) throw new Error('fungible-index-empty');
	if (payload.errors?.length) throw new Error('fungible-index-query');
	const connection = payload.data?.transactions as FungibleTokenConnection | undefined;
	const count = collectionCount(connection?.count);
	if (
		!connection ||
		typeof connection !== 'object' ||
		count === null ||
		typeof connection.pageInfo?.hasNextPage !== 'boolean' ||
		!Array.isArray(connection.edges) ||
		connection.edges.some(
			(edge: any) =>
				!edge ||
				typeof edge.cursor !== 'string' ||
				!edge.cursor ||
				!ARWEAVE_ID.test(edge.node?.id) ||
				!Array.isArray(edge.node?.tags) ||
				edge.node.tags.some((tag: any) => !tag || typeof tag.name !== 'string' || typeof tag.value !== 'string')
		)
	)
		throw new Error('fungible-index-schema');
	const assets = new Map<string, AssetSummary>();
	for (const { node } of connection.edges) {
		const tags = Object.fromEntries(node.tags.map((tag) => [tag.name.toLowerCase(), tag.value]));
		assets.set(node.id, {
			id: node.id,
			name: tags.name ?? tags.ticker ?? shortId(node.id),
			contentType: 'application/x.arweave-token',
			...(tags.ticker ? { ticker: tags.ticker } : {}),
			...(tags.logo && ARWEAVE_ID.test(tags.logo)
				? { image: `${arweaveGatewayFromLocation()}/${tags.logo}` }
				: {}),
		});
	}
	const cursor = connection.edges.at(-1)?.cursor;
	if (connection.pageInfo.hasNextPage && (!cursor || cursor === after)) {
		throw new Error('fungible-index-pagination-stalled');
	}
	return {
		assets: [...assets.values()],
		cursor,
		hasMore: connection.pageInfo.hasNextPage,
		total: count,
	};
}

function collectionCount(value: unknown): number | null {
	if (typeof value === 'number') {
		return Number.isSafeInteger(value) && value >= 0 ? value : null;
	}
	if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/.test(value)) return null;
	const count = Number(value);
	return Number.isSafeInteger(count) ? count : null;
}

function fungibleTokenCollection(assets: AssetSummary[], count = 0): Collection {
	return {
		id: 'fungible-tokens',
		name: '[TEST] Bazar Fungible Tokens',
		description: 'Arweave-native fungible tokens with direct wallet ownership and native AR settlement.',
		kind: 'tokens',
		assets,
		total: Math.max(count, assets.length),
	};
}

function defaultFungibleToken(): AssetSummary {
	return {
		id: FUNGIBLE_TOKEN_ID,
		name: '[TEST] Weave Credit',
		contentType: 'application/x.arweave-token',
		ticker: 'WEAVE',
	};
}

async function loadNames(signal?: AbortSignal, onProgress?: (collection: Collection) => void): Promise<Collection> {
	const namespaceRequest = loadNamesNamespace(signal).then((namespace) => {
		throwIfAborted(signal);
		onProgress?.(namesNamespaceCollection(namespace));
		return namespace;
	});
	const [namespace, page] = await Promise.all([namespaceRequest, loadCarrierPage(undefined, signal)]);
	const assets = carrierAssets(page, namespace);
	return {
		...namesNamespaceCollection(namespace),
		assets,
		total: page.hasMore ? undefined : assets.length,
		cursor: page.cursor,
		cursorHistory: page.cursor ? [page.cursor] : [],
		hasMore: page.hasMore,
	};
}

function namesNamespaceCollection(namespace: NamesNamespaceIndex): Collection {
	return {
		id: 'arweave-names',
		name: 'Arweave names',
		description: 'Current carrier names owned and traded directly on Arweave.',
		kind: 'names',
		assets: [],
		manifestId: namespace.manifestId,
		namespace,
		indexSource: 'reference',
	};
}

export async function loadMoreCarrierNames(collection: Collection, signal?: AbortSignal): Promise<Collection> {
	if (collection.kind !== 'names' || !collection.hasMore) return collection;
	if (!collection.namespace) throw new Error('carrier-namespace-missing');
	const page = await loadCarrierPage(collection.cursor, signal);
	const cursorHistory = collection.cursorHistory ?? (collection.cursor ? [collection.cursor] : []);
	if (page.cursor && (cursorHistory.includes(page.cursor) || cursorHistory.length >= MAX_INDEX_PAGES)) {
		throw new Error('carrier-index-pagination-stalled');
	}
	const seen = new Set(collection.assets.map((asset) => asset.id));
	const additions = carrierAssets(page, collection.namespace).filter((asset) => !seen.has(asset.id));
	const assets = [...collection.assets, ...additions];
	return {
		...collection,
		assets,
		cursor: page.cursor,
		cursorHistory: page.cursor ? [...cursorHistory, page.cursor] : cursorHistory,
		hasMore: page.hasMore,
		total: page.hasMore ? undefined : assets.length,
	};
}

async function loadCarrierPage(after?: string, signal?: AbortSignal): Promise<CarrierPage> {
	const { response, body: payload } = await fetchJsonWithDeadline<any>(
		fetch,
		arweaveGraphqlEndpoint(),
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				query: `query CarrierAssets($after: String) {
				transactions(
					first: 100
					after: $after
					sort: HEIGHT_DESC
					tags: [{ name: "execution-device", values: ["carrier@1.0"] }]
				) {
					pageInfo { hasNextPage }
					edges {
						cursor
						node { id tags { name value } }
					}
				}
			}`,
				variables: { after: after ?? null },
			}),
			signal,
		},
		{
			timeoutError: 'carrier-index-timeout',
		}
	);
	if (!response.ok) throw new Error(`carrier-index-${response.status}`);
	if (!payload) throw new Error('carrier-index-empty');
	if (payload.errors?.length) throw new Error('carrier-index-query');
	const connection = payload?.data?.transactions;
	if (!connection || !Array.isArray(connection.edges) || typeof connection.pageInfo?.hasNextPage !== 'boolean')
		throw new Error('carrier-index-schema');
	const edges: Array<{
		cursor: string;
		node: { id: string; tags: Array<{ name: string; value: string }> };
	}> = connection.edges;
	if (
		edges.some(
			({ cursor, node }) =>
				typeof cursor !== 'string' ||
				!cursor ||
				!/^[A-Za-z0-9_-]{43}$/.test(node?.id) ||
				!Array.isArray(node?.tags)
		)
	)
		throw new Error('carrier-index-schema');
	const cursor = edges.at(-1)?.cursor;
	if (connection.pageInfo.hasNextPage && (!cursor || cursor === after)) {
		throw new Error('carrier-index-pagination-stalled');
	}
	return {
		edges,
		cursor,
		hasMore: Boolean(connection.pageInfo.hasNextPage),
	};
}

function carrierAssets(page: CarrierPage, namespace: NamesNamespaceIndex): AssetSummary[] {
	return page.edges.flatMap(({ node }) => {
		const name = namespace.namesById[node.id];
		return name ? [{ id: node.id, name }] : [];
	});
}

async function loadNamesNamespace(signal?: AbortSignal): Promise<NamesNamespaceIndex> {
	const manifest = await fetchJson<unknown>(NAMES_NAMESPACE_ID, signal);
	return parseNamesNamespace(NAMES_NAMESPACE_ID, manifest);
}

export function parseNamesNamespace(manifestId: string, value: unknown): NamesNamespaceIndex {
	if (!ARWEAVE_ID.test(manifestId) || !value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('names-namespace-schema');
	}
	const manifest = value as Record<string, unknown>;
	if (
		manifest.manifest !== 'arweave/paths' ||
		manifest.version !== '0.2.0' ||
		!manifest.paths ||
		typeof manifest.paths !== 'object' ||
		Array.isArray(manifest.paths)
	)
		throw new Error('names-namespace-schema');
	const namesById: Record<string, string> = Object.create(null);
	const paths = Object.entries(manifest.paths as Record<string, unknown>);
	if (!paths.length) throw new Error('names-namespace-schema');
	for (const [name, entry] of paths) {
		if (
			!name.trim() ||
			!entry ||
			typeof entry !== 'object' ||
			Array.isArray(entry) ||
			!ARWEAVE_ID.test((entry as { id?: unknown }).id as string)
		)
			throw new Error('names-namespace-schema');
		const id = (entry as { id: string }).id;
		if (namesById[id] !== undefined) throw new Error('names-namespace-schema');
		namesById[id] = name;
	}
	return { manifestId, namesById };
}

export async function loadImageCollection(
	referenceId: string,
	publishedManifestId: string,
	signal?: AbortSignal
): Promise<Collection> {
	let value = publishedManifestId;
	let indexSource: Collection['indexSource'] = 'reference';
	try {
		const transaction = await fetchJson<{
			tags?: Array<{ name: string; value: string }>;
		}>(`tx/${referenceId}`, signal, true);
		const tags = Object.fromEntries(
			(transaction.tags ?? []).map((tag) => [decodeBase64Url(tag.name), decodeBase64Url(tag.value)])
		);
		const referencedManifest = tags['reference-value'];
		if (!referencedManifest || !/^[A-Za-z0-9_-]{43}$/.test(referencedManifest)) {
			throw new Error('collection-reference-invalid');
		}
		value = referencedManifest;
	} catch {
		throwIfAborted(signal);
		// A reference can remain pending after its bundled immutable manifest
		// is readable, so retain that manifest as the explicit fallback.
		indexSource = 'compiled-fallback';
	}
	if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error('collection-reference-unavailable');
	try {
		return imageCollection(referenceId, value, indexSource, await fetchJson<ImageManifest>(value, signal));
	} catch (cause) {
		throwIfAborted(signal);
		if (indexSource !== 'reference' || value === publishedManifestId || !ARWEAVE_ID.test(publishedManifestId)) {
			throw cause;
		}
		return imageCollection(
			referenceId,
			publishedManifestId,
			'compiled-fallback',
			await fetchJson<ImageManifest>(publishedManifestId, signal)
		);
	}
}

function imageCollection(
	referenceId: string,
	manifestId: string,
	indexSource: NonNullable<Collection['indexSource']>,
	manifest: ImageManifest
): Collection {
	if (
		!manifest ||
		typeof manifest !== 'object' ||
		Array.isArray(manifest) ||
		typeof manifest.name !== 'string' ||
		!manifest.name.trim() ||
		(manifest.description !== undefined && typeof manifest.description !== 'string') ||
		!Array.isArray(manifest.assets) ||
		manifest.assets.some(
			(asset) =>
				!asset ||
				typeof asset !== 'object' ||
				!ARWEAVE_ID.test(asset.id) ||
				typeof asset.name !== 'string' ||
				!asset.name.trim() ||
				(asset.contentType !== undefined && typeof asset.contentType !== 'string') ||
				(asset.image !== undefined && typeof asset.image !== 'string') ||
				(asset.media !== undefined && typeof asset.media !== 'string')
		)
	)
		throw new Error('collection-manifest-schema');
	return {
		id: referenceId,
		name: manifest.name,
		description: manifest.description ?? 'A permanent Arweave collection.',
		kind: 'images',
		indexSource,
		manifestId,
		assets: manifest.assets.map((asset) => ({
			...asset,
			...(!asset.image && !asset.media ? { image: `${arweaveGatewayFromLocation()}/${asset.id}` } : {}),
		})),
	};
}

async function fetchJson<T>(path: string, signal?: AbortSignal, process = false): Promise<T> {
	if (!process && /^[A-Za-z0-9_-]{43}$/.test(path)) {
		const { response, body: responseBody } = await fetchTextWithDeadline(
			fetch,
			`${arweaveGatewayFromLocation()}/tx/${path}/data`,
			{ signal },
			{
				timeoutError: 'collection-data-timeout',
			}
		);
		if (!response.ok) throw new Error(`collection-fetch-${response.status}`);
		const body = (responseBody ?? '').trim();
		if (!/^[A-Za-z0-9_-]+$/.test(body) || body === 'Accepted') {
			throw new Error('collection-data-pending');
		}
		return JSON.parse(decodeBase64Url(body)) as T;
	}
	const url = process && path.startsWith('http') ? path : `${arweaveGatewayFromLocation()}/${path}`;
	const { response, body } = await fetchJsonWithDeadline<any>(
		fetch,
		url,
		{ signal, headers: { accept: 'application/json' } },
		{
			timeoutError: 'collection-fetch-timeout',
		}
	);
	if (!response.ok) throw new Error(`collection-fetch-${response.status}`);
	if (body === undefined) throw new Error('collection-fetch-empty');
	return (process ? body : (body as any)?.data ?? body) as T;
}

function decodeBase64Url(value: string): string {
	const encoded = value.replaceAll('-', '+').replaceAll('_', '/');
	const binary = atob(encoded);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return new TextDecoder().decode(bytes);
}

function shortId(value: string) {
	return `${value.slice(0, 7)}…${value.slice(-6)}`;
}
