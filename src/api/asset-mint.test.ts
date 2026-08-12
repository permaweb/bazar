import { describe, expect, it, vi } from 'vitest';

import {
	assetFromMintState,
	AssetMintClient,
	collectionManifest,
	CollectionMintClient,
	collectionProcessTags,
	CREATED_COLLECTION_ID,
	createdCollection,
	getMintDraft,
	isBazarMintTags,
	loadMintedAssets,
	loadMintedCollections,
	mintMetadata,
	mintProcessTags,
	normalizeUploadTags,
	storeMintedAsset,
	storeMintedCollection,
	UDL_LICENSE_ID,
	udlLicenseTags,
	validateCollectionMintInput,
	validateMintInput,
} from './asset-mint';
import { loadMintActivities } from './mint-activity';

const owner = 'W'.repeat(43);
const mediaId = 'M'.repeat(43);
const processId = 'P'.repeat(43);

function storage() {
	const held = new Map<string, string>();
	return {
		getItem: (key: string) => held.get(key) ?? null,
		setItem: (key: string, value: string) => void held.set(key, value),
		removeItem: (key: string) => void held.delete(key),
	};
}

describe('asset mint contract', () => {
	it('deduplicates collection price sizes while retaining every transaction in the total', async () => {
		const calls: string[] = [];
		const file = new File([new Uint8Array([1, 2, 3])], 'same.png', { type: 'image/png' });
		const estimate = await new CollectionMintClient({
			gateway: 'https://gateway.example',
			fetch: vi.fn(async (input) => {
				calls.push(String(input));
				return new Response('7');
			}),
		}).estimate({ name: 'Repeated sizes', description: '', files: Array(10).fill(file) });

		expect(estimate).toMatchObject({ assetCount: 10, transactionCount: 12, total: 84n });
		expect(new Set(calls).size).toBe(calls.length);
		expect(calls.length).toBeLessThan(12);
	});

	it('bounds distinct collection price lookups to eight at a time', async () => {
		let active = 0;
		let maxActive = 0;
		let calls = 0;
		const files = Array.from(
			{ length: 10 },
			(_, index) =>
				new File([new Uint8Array(index + 1)], `asset-${index}-${'x'.repeat(index)}.png`, { type: 'image/png' })
		);
		const estimate = await new CollectionMintClient({
			gateway: 'https://gateway.example',
			fetch: vi.fn(async () => {
				calls += 1;
				active += 1;
				maxActive = Math.max(maxActive, active);
				await new Promise((resolve) => setTimeout(resolve, 5));
				active -= 1;
				return new Response('1');
			}),
		}).estimate({ name: 'Distinct sizes', description: '', files });

		expect(estimate.total).toBe(12n);
		expect(calls).toBeGreaterThan(8);
		expect(maxActive).toBe(8);
	});

	it('creates a discoverable one-of-one process whose transaction body is the asset media', () => {
		const tags = mintProcessTags(
			{ name: 'Signal #1', description: 'Permanent', contentType: 'image/png', createdAt: 123 },
			owner
		);

		expect(tags).toMatchObject({
			'app-name': 'Bazar',
			'asset-type': 'image/png',
			'content-type': 'image/png',
			creator: owner,
			'date-created': '123',
			description: 'Permanent',
			implements: 'ANS-110',
			title: 'Signal #1',
			type: 'Process',
			'execution-device': 'token@1.0',
			'swap-device': 'arweave-swap@1.0',
			'initial-holder': owner,
			'total-supply': '1',
		});
		expect(Object.keys(tags)).toEqual(Object.keys(tags).map((tag) => tag.toLowerCase()));
		expect(new Set(Object.keys(tags)).size).toBe(Object.keys(tags).length);
		expect(tags).not.toHaveProperty('asset-data');
		expect(
			mintProcessTags(
				{
					name: 'Signal #1',
					contentType: 'image/png',
					mediaId,
					collection: 'Signal set',
				},
				owner
			).collection
		).toBe('Signal set');
		expect(
			isBazarMintTags(Object.fromEntries(Object.entries(tags).map(([key, value]) => [key.toLowerCase(), value])))
		).toBe(true);
		expect(assetFromMintState(processId, { name: 'Signal #1', 'asset-content-type': 'image/png' })).toEqual({
			id: processId,
			name: 'Signal #1',
			contentType: 'image/png',
			image: `https://arweave.net/${processId}`,
		});
		expect(
			mintMetadata({ name: ' Signal #1 ', description: ' Permanent ', contentType: 'image/png' }, mediaId)
		).toEqual({
			name: 'Signal #1',
			description: 'Permanent',
			contentType: 'image/png',
			image: mediaId,
			collection: 'Created on Bazar',
		});
	});

	it('accepts MP3 and WAV assets with optional immutable album artwork', () => {
		const artworkId = 'A'.repeat(43);
		const mp3 = new File([new Uint8Array([1])], 'signal.mp3', { type: 'audio/mpeg' });
		const wav = new File([new Uint8Array([1])], 'signal.wav', { type: 'audio/x-wav' });
		const artwork = new File([new Uint8Array([1])], 'cover.png', { type: 'image/png' });

		expect(() => validateMintInput({ name: 'Signal', description: '', file: mp3, artwork })).not.toThrow();
		expect(() => validateMintInput({ name: 'Signal', description: '', file: wav })).not.toThrow();
		expect(() => validateCollectionMintInput({ name: 'Audio collection', description: '', files: [mp3] })).toThrow(
			'mint-file-type-unsupported'
		);
		expect(
			mintProcessTags({ name: 'Signal', contentType: 'audio/x-wav', mediaId, artworkId }, owner)
		).toMatchObject({
			'asset-content-type': 'audio/wav',
			'asset-data': mediaId,
			'asset-artwork': artworkId,
		});
		expect(
			mintMetadata({ name: 'Signal', description: '', contentType: 'audio/mpeg' }, mediaId, artworkId)
		).toEqual({
			name: 'Signal',
			description: '',
			contentType: 'audio/mpeg',
			audio: mediaId,
			image: artworkId,
			collection: 'Created on Bazar',
		});
		expect(
			assetFromMintState(processId, {
				name: 'Signal',
				'asset-data': mediaId,
				'asset-artwork': artworkId,
				'asset-content-type': 'audio/mpeg',
				artist: 'Kite Array',
				album: 'Long Orbit',
				duration: '125',
			})
		).toEqual({
			id: processId,
			name: 'Signal',
			contentType: 'audio/mpeg',
			media: `https://arweave.net/${mediaId}`,
			image: `https://arweave.net/${artworkId}`,
			artist: 'Kite Array',
			album: 'Long Orbit',
			duration: 125,
		});
	});

	it('encodes Universal Data License 0.2 terms with canonical tags', () => {
		const terms = {
			accessFee: '1.5',
			derivation: { grant: 'revenue-share' as const, value: '12.5' },
			commercialUse: { grant: 'one-time' as const, value: '20' },
			dataModelTraining: { grant: 'monthly' as const, value: '3' },
			unknownUsageRights: 'excluded' as const,
			expiry: '5',
			currency: 'AR' as const,
			paymentAddress: owner,
			paymentMode: 'global' as const,
		};

		expect(udlLicenseTags({})).toEqual({ license: UDL_LICENSE_ID });
		expect(udlLicenseTags(terms)).toEqual({
			license: UDL_LICENSE_ID,
			'access-fee': 'One-Time-1.5',
			derivation: 'Allowed-With-RevenueShare-12.5%',
			'commercial-use': 'Allowed-With-Fee-One-Time-20',
			'data-model-training': 'Allowed-With-Fee-Monthly-3',
			'unknown-usage-rights': 'Excluded',
			expiry: '5',
			currency: 'AR',
			'payment-address': owner,
			'payment-mode': 'Global-Distribution',
		});
		expect(
			mintProcessTags({ name: 'Signal #1', contentType: 'image/png', mediaId, udl: terms }, owner)
		).toMatchObject({
			license: UDL_LICENSE_ID,
			'data-model-training': 'Allowed-With-Fee-Monthly-3',
		});
		expect(() => normalizeUploadTags({ License: 'one', license: 'two' })).toThrow('duplicate-upload-tag-license');
		expect(() => udlLicenseTags({ commercialUse: { grant: 'one-time', value: '0' } })).toThrow(
			'mint-udl-fee-invalid'
		);
	});

	it('keeps UDL terms in a recoverable mint draft', () => {
		const store = storage();
		store.setItem(
			`bazar-mint-draft:${owner}`,
			JSON.stringify({
				owner,
				mediaId,
				name: 'Recoverable signal',
				description: '',
				contentType: 'image/png',
				createdAt: 1,
				udl: { commercialUse: { grant: 'credit' }, dataModelTraining: { grant: 'allowed' } },
			})
		);

		expect(getMintDraft(owner, store)?.udl).toEqual({
			commercialUse: { grant: 'credit' },
			dataModelTraining: { grant: 'allowed' },
		});
	});

	it('restores locally indexed minted assets without accepting malformed entries', () => {
		const store = storage();
		storeMintedAsset(
			{
				id: processId,
				name: 'Signal #1',
				description: 'Permanent',
				contentType: 'image/png',
				image: `https://arweave.net/${mediaId}`,
				mediaId,
				owner,
				createdAt: 1,
			},
			store
		);

		expect(loadMintedAssets(store)).toHaveLength(1);
		expect(createdCollection(loadMintedAssets(store))).toMatchObject({
			id: CREATED_COLLECTION_ID,
			total: 1,
		});
		expect(
			assetFromMintState(processId, {
				name: 'Signal #1',
				'asset-data': mediaId,
				'asset-content-type': 'image/png',
			})
		).toEqual({
			id: processId,
			name: 'Signal #1',
			contentType: 'image/png',
			image: `https://arweave.net/${mediaId}`,
		});
	});

	it('persists a minted collection by its permanent carrier process', () => {
		const store = storage();
		const asset = {
			id: processId,
			name: 'Signal #1',
			description: 'Permanent',
			contentType: 'image/png',
			image: `https://arweave.net/${mediaId}`,
			mediaId,
			owner,
			createdAt: 1,
		};
		storeMintedCollection(
			{
				id: 'R'.repeat(43),
				manifestId: 'N'.repeat(43),
				owner,
				createdAt: 2,
				name: 'Signal set',
				description: 'A collection',
				kind: 'images',
				assets: [asset],
				total: 1,
			},
			store
		);

		expect(loadMintedCollections(store)).toMatchObject([
			{
				id: 'R'.repeat(43),
				manifestId: 'N'.repeat(43),
				name: 'Signal set',
				total: 1,
			},
		]);
	});

	it('creates an ID-only manifest and a carrier process that points to it', () => {
		const manifestId = 'N'.repeat(43);
		const asset = {
			id: processId,
			name: 'Signal #1',
			contentType: 'image/png',
			image: `https://arweave.net/${processId}`,
		};

		expect(collectionManifest({ name: ' Signal set ', description: '' }, [asset])).toMatchObject({
			name: 'Signal set',
			assets: [processId],
		});
		expect(collectionProcessTags('Signal set', manifestId, owner)).toEqual({
			'content-type': 'application/x.ao-message',
			'app-name': 'Bazar',
			'app-version': '2.0.0',
			device: 'process@1.0',
			'execution-device': 'carrier@1.0',
			'scheduler-device': 'arweave-scheduler@1.0',
			'scheduler-mode': 'all',
			'initial-holder': owner,
			'initial-value': manifestId,
			'reference-value': manifestId,
			'total-supply': '1',
			denomination: '0',
			ticker: 'COLLECTION',
			type: 'Process',
			name: 'Signal set',
		});
	});

	it('prices one atomic transaction per collection asset plus the manifest and carrier process', async () => {
		const fetchMock = vi.fn(async () => new Response('2'));
		const estimate = await new CollectionMintClient({ fetch: fetchMock as typeof fetch }).estimate({
			name: 'Signal set',
			description: '',
			files: [new File([new Uint8Array([1])], 'signal.png', { type: 'image/png' })],
		});

		expect(estimate).toEqual({ assetCount: 1, total: 6n, transactionCount: 3 });
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('appends assets by targeting a signed carrier set update', async () => {
		const store = storage();
		const ids = ['A', 'B', 'M', 'U'].map((prefix) => prefix.repeat(43));
		const transactions = ids.map((id) => {
			const transaction: any = { id: '', owner: '', chunks: { chunks: [{}] }, addTag: vi.fn() };
			transaction.setSignature = vi.fn((signature) => Object.assign(transaction, signature));
			transaction.toJSON = () => ({ id: transaction.id, owner: transaction.owner, tags: [] });
			return transaction;
		});
		const createTransaction = vi.fn(async () => transactions.shift());
		let signed = 0;
		const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
			String(input).includes('/wallet/') ? new Response('1000') : new Response('1')
		) as typeof fetch;
		const client = new CollectionMintClient({
			arweave: {
				createTransaction,
				transactions: {},
				wallets: { ownerToAddress: vi.fn(async () => owner) },
			},
			fetch: fetchMock,
			storage: store,
			wallet: {
				getActiveAddress: vi.fn(async () => owner),
				sign: vi.fn(async () => ({
					id: ids[signed++],
					owner: 'signed-owner',
					tags: [],
					signature: 'signed',
				})),
			} as any,
		});
		const collection = {
			id: 'C'.repeat(43),
			manifestId: 'O'.repeat(43),
			owner,
			createdAt: 1,
			name: 'Happy agents',
			description: 'A collection',
			kind: 'images' as const,
			assets: [],
			total: 0,
		};

		const result = await client.append(
			collection,
			[
				new File([new Uint8Array([1])], 'one.png', { type: 'image/png' }),
				new File([new Uint8Array([2])], 'two.png', { type: 'image/png' }),
			],
			owner,
			{ allowHighCost: true }
		);

		expect(result).toMatchObject({
			manifestId: ids[2],
			updateId: ids[3],
			collection: { id: collection.id, manifestId: ids[2], total: 2 },
		});
		expect(createTransaction).toHaveBeenLastCalledWith(
			{ data: '', target: collection.id, quantity: '1' },
			'use_wallet'
		);
		expect(fetchMock).toHaveBeenCalledWith(`https://arweave.net/price/0/${collection.id}`, {
			signal: undefined,
		});
		const update = await createTransaction.mock.results.at(-1)?.value;
		expect(update.addTag).toHaveBeenCalledWith('action', 'set');
		expect(update.addTag).toHaveBeenCalledWith('reference-value', ids[2]);
		expect(loadMintedCollections(store)[0]).toMatchObject({ id: collection.id, manifestId: ids[2], total: 2 });
	});

	it('explains the bytes and transaction count in a single-asset quote', async () => {
		const fetchMock = vi.fn(async () => new Response('3'));
		const estimate = await new AssetMintClient({ fetch: fetchMock as typeof fetch }).estimate({
			name: 'Signal',
			description: '',
			file: new File([new Uint8Array(4)], 'signal.mp3', { type: 'audio/mpeg' }),
			artwork: new File([new Uint8Array(2)], 'cover.png', { type: 'image/png' }),
		});

		expect(estimate).toEqual({
			assetReward: 3n,
			artworkReward: 3n,
			total: 6n,
			assetBytes: 4,
			artworkBytes: 2,
			transactionCount: 2,
		});
	});

	it('uploads one atomic process transaction through the chunk uploader', async () => {
		const makeTransaction = (chunkCount: number) => {
			const transaction: any = {
				id: '',
				owner: '',
				data: new Uint8Array(1),
				chunks: { chunks: Array.from({ length: chunkCount }, () => ({})) },
				addTag: vi.fn(),
			};
			transaction.setSignature = vi.fn((signature) => Object.assign(transaction, signature));
			transaction.toJSON = () => ({ id: transaction.id, owner: transaction.owner, data: '' });
			return transaction;
		};
		const asset = makeTransaction(2);
		let uploadComplete = false;
		const uploadChunk = vi.fn(async () => {
			uploadComplete = true;
		});
		const getUploader = vi.fn(async () => ({
			get isComplete() {
				return uploadComplete;
			},
			uploadChunk,
		}));
		const posted: string[] = [];
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.includes('/price/')) return new Response('1');
			if (url.includes('/wallet/')) return new Response('100');
			if (init?.method === 'POST') posted.push(url);
			return new Response('', { status: 200 });
		});
		const client = new AssetMintClient({
			arweave: {
				createTransaction: vi.fn().mockResolvedValueOnce(asset),
				transactions: { getUploader },
				wallets: { ownerToAddress: vi.fn(async () => owner) },
			},
			fetch: fetchMock as typeof fetch,
			storage: storage(),
			wallet: {
				getActiveAddress: vi.fn(async () => owner),
				sign: vi.fn().mockResolvedValueOnce({
					id: processId,
					owner: 'signed-owner',
					reward: '1',
					tags: [],
					signature: 'asset',
				}),
			} as any,
		});

		const result = await client.mint(
			{
				name: 'Large signal',
				description: '',
				file: new File([new Uint8Array(300_000)], 'large-signal.png', { type: 'image/png' }),
				udl: { dataModelTraining: { grant: 'allowed' } },
			},
			owner
		);

		expect(getUploader).toHaveBeenCalledWith(asset);
		expect(asset.addTag).toHaveBeenCalledWith('content-type', 'image/png');
		expect(asset.addTag).toHaveBeenCalledWith('device', 'process@1.0');
		expect(asset.addTag).toHaveBeenCalledWith('license', UDL_LICENSE_ID);
		expect(asset.addTag).toHaveBeenCalledWith('data-model-training', 'Allowed');
		expect(asset.addTag).not.toHaveBeenCalledWith('asset-data', expect.anything());
		expect(asset.setSignature).toHaveBeenCalledWith(expect.objectContaining({ id: processId, signature: 'asset' }));
		expect(uploadChunk).toHaveBeenCalledOnce();
		expect(posted).toEqual([]);
		expect(result).toMatchObject({ mediaId: processId, processId, asset: { id: processId, mediaId: processId } });
	});

	it('finishes a legacy split-upload draft as a self-contained atomic asset', async () => {
		const asset: any = { id: '', owner: '', chunks: { chunks: [{}] }, addTag: vi.fn() };
		asset.setSignature = vi.fn((signature) => Object.assign(asset, signature));
		asset.toJSON = () => ({ id: asset.id, owner: asset.owner, tags: [] });
		const createTransaction = vi.fn(async () => asset);
		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url === `https://arweave.net/${mediaId}`) return new Response(new Uint8Array([7, 8, 9]));
			if (url.includes('/price/')) return new Response('1');
			if (url.includes('/wallet/')) return new Response('100');
			if (init?.method === 'POST') return new Response('', { status: 200 });
			return new Response('', { status: 404 });
		});
		const client = new AssetMintClient({
			arweave: {
				createTransaction,
				transactions: {},
				wallets: { ownerToAddress: vi.fn(async () => owner) },
			},
			fetch: fetchMock as typeof fetch,
			storage: storage(),
			wallet: {
				getActiveAddress: vi.fn(async () => owner),
				sign: vi.fn(async () => ({
					id: processId,
					owner: 'signed-owner',
					tags: [],
					signature: 'asset',
				})),
			} as any,
		});

		const result = await client.resume(
			{
				owner,
				name: 'Recovered signal',
				description: '',
				contentType: 'image/png',
				mediaId,
				createdAt: 123,
			},
			owner
		);

		expect(createTransaction).toHaveBeenCalledWith({ data: new Uint8Array([7, 8, 9]) }, 'use_wallet');
		expect(asset.addTag).not.toHaveBeenCalledWith('asset-data', expect.anything());
		expect(result).toMatchObject({ mediaId: processId, processId, asset: { id: processId, mediaId: processId } });
	});

	it('uploads album artwork and records its transaction on the audio asset process', async () => {
		const artworkId = 'A'.repeat(43);
		const transaction = () => {
			const held: any = { id: '', owner: '', chunks: { chunks: [{}] }, addTag: vi.fn() };
			held.setSignature = vi.fn((signature) => Object.assign(held, signature));
			held.toJSON = () => ({ id: held.id, owner: held.owner, tags: [] });
			return held;
		};
		const artwork = transaction();
		const asset = transaction();
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes('/price/')) return new Response('1');
			if (url.includes('/wallet/')) return new Response('100');
			return new Response('', { status: 200 });
		});
		const store = storage();
		const onTransaction = vi.fn();
		const client = new AssetMintClient({
			arweave: {
				createTransaction: vi.fn().mockResolvedValueOnce(artwork).mockResolvedValueOnce(asset),
				transactions: {},
				wallets: { ownerToAddress: vi.fn(async () => owner) },
			},
			fetch: fetchMock as typeof fetch,
			storage: store,
			computeGateway: 'https://compute.example',
			wallet: {
				getActiveAddress: vi.fn(async () => owner),
				sign: vi
					.fn()
					.mockResolvedValueOnce({ id: artworkId, owner: 'signed-owner', tags: [], signature: 'artwork' })
					.mockResolvedValueOnce({ id: processId, owner: 'signed-owner', tags: [], signature: 'asset' }),
			} as any,
		});

		const result = await client.mint(
			{
				name: 'Permanent signal',
				description: '',
				file: new File([new Uint8Array([1])], 'signal.mp3', { type: 'audio/mpeg' }),
				artwork: new File([new Uint8Array([2])], 'cover.jpg', { type: 'image/jpeg' }),
				artist: 'Kite Array',
				album: 'Long Orbit',
				duration: 125,
			},
			owner,
			{ onTransaction }
		);

		expect(artwork.addTag).toHaveBeenCalledWith('type', 'Asset-Artwork');
		expect(asset.addTag).toHaveBeenCalledWith('content-type', 'audio/mpeg');
		expect(asset.addTag).toHaveBeenCalledWith('asset-artwork', artworkId);
		expect(asset.addTag).toHaveBeenCalledWith('artist', 'Kite Array');
		expect(asset.addTag).toHaveBeenCalledWith('album', 'Long Orbit');
		expect(asset.addTag).toHaveBeenCalledWith('duration', '125');
		expect(asset.addTag).not.toHaveBeenCalledWith('asset-data', expect.anything());
		expect(onTransaction.mock.calls).toEqual([
			[{ id: artworkId, label: 'Artwork transaction' }],
			[{ id: processId, label: 'Asset transaction' }],
		]);
		expect(result.asset).toMatchObject({
			contentType: 'audio/mpeg',
			media: `https://arweave.net/${processId}`,
			mediaId: processId,
			image: `https://arweave.net/${artworkId}`,
			artworkId,
			artist: 'Kite Array',
			album: 'Long Orbit',
			duration: 125,
		});
		expect(loadMintActivities(store, owner)).toMatchObject([
			{
				phase: 'accepted',
				transactionIds: [artworkId, processId],
				arweaveGateway: 'https://arweave.net',
				computeGateway: 'https://compute.example',
			},
		]);
	});
});
