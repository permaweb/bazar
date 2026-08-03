import { DEFAULT_GATEWAY } from 'helpers/config';

export type AssetSummary = {
	id: string;
	name: string;
	contentType?: string;
	image?: string;
};

export type Collection = {
	id: string;
	name: string;
	description: string;
	kind: 'names' | 'images' | 'tokens';
	assets: AssetSummary[];
	total?: number;
	cursor?: string;
	hasMore?: boolean;
};

type ImageManifest = {
	name: string;
	description?: string;
	assets: Array<{ id: string; name: string; contentType?: string; image?: string }>;
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

export const IMAGE_COLLECTION_REFERENCES = IMAGE_COLLECTIONS.map((collection) => collection.reference);

export const FUNGIBLE_TOKEN_ID =
	import.meta.env.VITE_FUNGIBLE_TOKEN_ID ?? 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';

export async function loadCollections(signal?: AbortSignal): Promise<Collection[]> {
	const [names, fungible, ...images] = await Promise.allSettled([
		loadNames(signal),
		loadFungibleTokens(signal),
		...IMAGE_COLLECTIONS.map(({ reference, manifest }) => loadImageCollection(reference, manifest, signal)),
	]);
	return [
		...(names.status === 'fulfilled' ? [names.value] : []),
		...(fungible.status === 'fulfilled' && fungible.value.assets.length
			? [fungible.value]
			: [fungibleTokenCollection([defaultFungibleToken()])]),
		...images.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
	];
}

async function loadFungibleTokens(signal?: AbortSignal): Promise<Collection> {
	const response = await fetch(`${DEFAULT_GATEWAY}/graphql`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			query: `query FungibleTokens {
				transactions(
					first: 100
					sort: HEIGHT_DESC
					tags: [
						{ name: "execution-device", values: ["token@1.0"] }
						{ name: "swap-device", values: ["arweave-swap@1.0"] }
						{ name: "scheduler-device", values: ["arweave-scheduler@1.0"] }
						{ name: "asset-type", values: ["fungible"] }
					]
				) {
					count
					edges { node { id tags { name value } } }
				}
			}`,
		}),
		signal,
	});
	if (!response.ok) throw new Error(`fungible-index-${response.status}`);
	const payload = await response.json();
	if (payload.errors?.length) throw new Error('fungible-index-query');
	const edges: Array<{
		node: { id: string; tags: Array<{ name: string; value: string }> };
	}> = payload.data.transactions.edges;
	const assets: AssetSummary[] = edges.map(({ node }) => {
		const tags = Object.fromEntries(node.tags.map((tag) => [tag.name.toLowerCase(), tag.value]));
		return {
			id: node.id,
			name: tags.name ?? tags.ticker ?? shortId(node.id),
			contentType: 'application/x.arweave-token',
			...(tags.logo && /^[A-Za-z0-9_-]{43}$/.test(tags.logo)
				? { image: `${DEFAULT_GATEWAY}/${tags.logo}` }
				: {}),
		};
	});
	if (/^[A-Za-z0-9_-]{43}$/.test(FUNGIBLE_TOKEN_ID) && !assets.some((asset) => asset.id === FUNGIBLE_TOKEN_ID)) {
		assets.unshift(defaultFungibleToken());
	}
	return fungibleTokenCollection(assets, Number(payload.data.transactions.count));
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
	};
}

async function loadNames(signal?: AbortSignal): Promise<Collection> {
	const page = await loadCarrierPage(undefined, signal);
	return {
		id: 'arweave-names',
		name: 'Arweave names',
		description: `${page.total.toLocaleString()} carrier names owned and traded directly on Arweave.`,
		kind: 'names',
		assets: page.assets,
		total: page.total,
		cursor: page.cursor,
		hasMore: page.hasMore,
	};
}

export async function loadMoreCarrierNames(collection: Collection, signal?: AbortSignal): Promise<Collection> {
	if (collection.kind !== 'names' || !collection.hasMore) return collection;
	const page = await loadCarrierPage(collection.cursor, signal);
	const seen = new Set(collection.assets.map((asset) => asset.id));
	return {
		...collection,
		assets: [...collection.assets, ...page.assets.filter((asset) => !seen.has(asset.id))],
		cursor: page.cursor,
		hasMore: page.hasMore,
		total: page.total,
	};
}

async function loadCarrierPage(after?: string, signal?: AbortSignal) {
	const response = await fetch(`${DEFAULT_GATEWAY}/graphql`, {
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
					count
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
	});
	if (!response.ok) throw new Error(`carrier-index-${response.status}`);
	const payload = await response.json();
	if (payload.errors?.length) throw new Error('carrier-index-query');
	const connection = payload.data.transactions;
	const edges: Array<{
		cursor: string;
		node: { id: string; tags: Array<{ name: string; value: string }> };
	}> = connection.edges;
	return {
		assets: edges.map(({ node }) => ({
			id: node.id,
			name: node.tags.find((tag) => tag.name === 'name')?.value ?? shortId(node.id),
		})),
		total: Number(connection.count),
		cursor: edges.at(-1)?.cursor,
		hasMore: Boolean(connection.pageInfo.hasNextPage),
	};
}

async function loadImageCollection(
	referenceId: string,
	publishedManifestId: string,
	signal?: AbortSignal
): Promise<Collection> {
	let value = publishedManifestId;
	try {
		const transaction = await fetchJson<{
			tags?: Array<{ name: string; value: string }>;
		}>(`tx/${referenceId}`, signal, true);
		const tags = Object.fromEntries(
			(transaction.tags ?? []).map((tag) => [decodeBase64Url(tag.name), decodeBase64Url(tag.value)])
		);
		if (tags['reference-value']) value = tags['reference-value'];
	} catch {
		// A just-published reference can remain pending after its immutable
		// manifest is readable. The compiled manifest ID is the same signed
		// value and keeps first load deterministic during that window.
	}
	if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error('collection-reference-unavailable');
	const manifest = await fetchJson<ImageManifest>(value, signal);
	return {
		id: referenceId,
		name: manifest.name,
		description: manifest.description ?? 'A permanent Arweave collection.',
		kind: 'images',
		assets: manifest.assets.map((asset) => ({
			...asset,
			image: asset.image ?? `${DEFAULT_GATEWAY}/${asset.id}`,
		})),
	};
}

async function fetchJson<T>(path: string, signal?: AbortSignal, process = false): Promise<T> {
	if (!process && /^[A-Za-z0-9_-]{43}$/.test(path)) {
		const response = await fetch(`${DEFAULT_GATEWAY}/tx/${path}/data`, { signal });
		if (!response.ok) throw new Error(`collection-fetch-${response.status}`);
		const body = (await response.text()).trim();
		if (!/^[A-Za-z0-9_-]+$/.test(body) || body === 'Accepted') {
			throw new Error('collection-data-pending');
		}
		const encoded = body.replaceAll('-', '+').replaceAll('_', '/');
		const json = decodeURIComponent(
			Array.from(atob(encoded), (byte) => `%${byte.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')
		);
		return JSON.parse(json) as T;
	}
	const url = process && path.startsWith('http') ? path : `${DEFAULT_GATEWAY}/${path}`;
	const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
	if (!response.ok) throw new Error(`collection-fetch-${response.status}`);
	const body = await response.json();
	return ((body as any)?.data ?? body) as T;
}

function decodeBase64Url(value: string): string {
	const encoded = value.replaceAll('-', '+').replaceAll('_', '/');
	return decodeURIComponent(
		Array.from(atob(encoded), (byte) => `%${byte.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')
	);
}

function shortId(value: string) {
	return `${value.slice(0, 7)}…${value.slice(-6)}`;
}
