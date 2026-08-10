import { describe, expect, it, vi } from 'vitest';

import {
	assetFromMintState,
	AssetMintClient,
	CollectionMintClient,
	CREATED_COLLECTION_ID,
	createdCollection,
	getMintDraft,
	isBazarMintTags,
	loadMintedAssets,
	loadMintedCollections,
	mintMetadata,
	mintProcessTags,
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
	it('creates a discoverable one-of-one process whose transaction body is the asset media', () => {
		const tags = mintProcessTags(
			{ name: 'Signal #1', description: 'Permanent', contentType: 'image/png', createdAt: 123 },
			owner
		);

		expect(tags).toMatchObject({
			'App-Name': 'Bazar',
			'Asset-Type': 'image/png',
			'Content-Type': 'image/png',
			Creator: owner,
			'Date-Created': '123',
			Description: 'Permanent',
			Implements: 'ANS-110',
			Title: 'Signal #1',
			Type: 'Process',
			type: 'Process',
			'execution-device': 'token@1.0',
			'swap-device': 'arweave-swap@1.0',
			'initial-holder': owner,
			'total-supply': '1',
		});
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

		expect(udlLicenseTags({})).toEqual({ License: UDL_LICENSE_ID });
		expect(udlLicenseTags(terms)).toEqual({
			License: UDL_LICENSE_ID,
			'Access-Fee': 'One-Time-1.5',
			Derivation: 'Allowed-With-RevenueShare-12.5%',
			'Commercial-Use': 'Allowed-With-Fee-One-Time-20',
			'Data-Model-Training': 'Allowed-With-Fee-Monthly-3',
			'Unknown-Usage-Rights': 'Excluded',
			Expiry: '5',
			Currency: 'AR',
			'Payment-Address': owner,
			'Payment-Mode': 'Global-Distribution',
		});
		expect(
			mintProcessTags({ name: 'Signal #1', contentType: 'image/png', mediaId, udl: terms }, owner)
		).toMatchObject({
			License: UDL_LICENSE_ID,
			'Data-Model-Training': 'Allowed-With-Fee-Monthly-3',
		});
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

	it('persists a minted collection by its permanent reference transaction', () => {
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

	it('prices one atomic transaction per collection asset plus the manifest and index', async () => {
		const fetchMock = vi.fn(async () => new Response('2'));
		const estimate = await new CollectionMintClient({ fetch: fetchMock as typeof fetch }).estimate({
			name: 'Signal set',
			description: '',
			files: [new File([new Uint8Array([1])], 'signal.png', { type: 'image/png' })],
		});

		expect(estimate).toEqual({ assetCount: 1, total: 6n, transactionCount: 3 });
		expect(fetchMock).toHaveBeenCalledTimes(3);
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
		expect(asset.addTag).toHaveBeenCalledWith('Content-Type', 'image/png');
		expect(asset.addTag).toHaveBeenCalledWith('device', 'process@1.0');
		expect(asset.addTag).toHaveBeenCalledWith('License', UDL_LICENSE_ID);
		expect(asset.addTag).toHaveBeenCalledWith('Data-Model-Training', 'Allowed');
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
			owner
		);

		expect(artwork.addTag).toHaveBeenCalledWith('Type', 'Asset-Artwork');
		expect(asset.addTag).toHaveBeenCalledWith('Content-Type', 'audio/mpeg');
		expect(asset.addTag).toHaveBeenCalledWith('asset-artwork', artworkId);
		expect(asset.addTag).toHaveBeenCalledWith('artist', 'Kite Array');
		expect(asset.addTag).toHaveBeenCalledWith('album', 'Long Orbit');
		expect(asset.addTag).toHaveBeenCalledWith('duration', '125');
		expect(asset.addTag).not.toHaveBeenCalledWith('asset-data', expect.anything());
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
