import { describe, expect, it, vi } from 'vitest';

import {
	assetFromMintState,
	AssetMintClient,
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
	it('creates a one-of-one swap-enabled token process', () => {
		const tags = mintProcessTags({ name: 'Signal #1', contentType: 'image/png', mediaId }, owner);

		expect(tags).toMatchObject({
			'App-Name': 'Bazar',
			type: 'Process',
			'execution-device': 'token@1.0',
			'swap-device': 'arweave-swap@1.0',
			'initial-holder': owner,
			'total-supply': '1',
			'asset-data': mediaId,
		});
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
			})
		).toEqual({
			id: processId,
			name: 'Signal',
			contentType: 'audio/mpeg',
			media: `https://arweave.net/${mediaId}`,
			image: `https://arweave.net/${artworkId}`,
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

	it('uploads multi-chunk media through the Arweave chunk uploader', async () => {
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
		const media = makeTransaction(2);
		const process = makeTransaction(1);
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
				createTransaction: vi.fn().mockResolvedValueOnce(media).mockResolvedValueOnce(process),
				transactions: { getUploader },
				wallets: { ownerToAddress: vi.fn(async () => owner) },
			},
			fetch: fetchMock as typeof fetch,
			storage: storage(),
			wallet: {
				getActiveAddress: vi.fn(async () => owner),
				sign: vi
					.fn()
					.mockResolvedValueOnce({
						id: mediaId,
						owner: 'signed-owner',
						reward: '1',
						tags: [],
						signature: 'media',
					})
					.mockResolvedValueOnce({
						id: processId,
						owner: 'signed-owner',
						reward: '1',
						tags: [],
						signature: 'process',
					}),
			} as any,
		});

		await client.mint(
			{
				name: 'Large signal',
				description: '',
				file: new File([new Uint8Array(300_000)], 'large-signal.png', { type: 'image/png' }),
				udl: { dataModelTraining: { grant: 'allowed' } },
			},
			owner
		);

		expect(getUploader).toHaveBeenCalledWith(media);
		expect(media.addTag).toHaveBeenCalledWith('License', UDL_LICENSE_ID);
		expect(media.addTag).toHaveBeenCalledWith('Data-Model-Training', 'Allowed');
		expect(process.addTag).toHaveBeenCalledWith('License', UDL_LICENSE_ID);
		expect(process.addTag).toHaveBeenCalledWith('Data-Model-Training', 'Allowed');
		expect(media.setSignature).toHaveBeenCalledWith(expect.objectContaining({ id: mediaId, signature: 'media' }));
		expect(uploadChunk).toHaveBeenCalledOnce();
		expect(posted).toEqual(['https://arweave.net/tx']);
	});

	it('uploads album artwork and records its transaction on the audio asset process', async () => {
		const artworkId = 'A'.repeat(43);
		const transaction = () => {
			const held: any = { id: '', owner: '', chunks: { chunks: [{}] }, addTag: vi.fn() };
			held.setSignature = vi.fn((signature) => Object.assign(held, signature));
			held.toJSON = () => ({ id: held.id, owner: held.owner, tags: [] });
			return held;
		};
		const media = transaction();
		const artwork = transaction();
		const process = transaction();
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes('/price/')) return new Response('1');
			if (url.includes('/wallet/')) return new Response('100');
			return new Response('', { status: 200 });
		});
		const client = new AssetMintClient({
			arweave: {
				createTransaction: vi
					.fn()
					.mockResolvedValueOnce(media)
					.mockResolvedValueOnce(artwork)
					.mockResolvedValueOnce(process),
				transactions: {},
				wallets: { ownerToAddress: vi.fn(async () => owner) },
			},
			fetch: fetchMock as typeof fetch,
			storage: storage(),
			wallet: {
				getActiveAddress: vi.fn(async () => owner),
				sign: vi
					.fn()
					.mockResolvedValueOnce({ id: mediaId, owner: 'signed-owner', tags: [], signature: 'media' })
					.mockResolvedValueOnce({ id: artworkId, owner: 'signed-owner', tags: [], signature: 'artwork' })
					.mockResolvedValueOnce({ id: processId, owner: 'signed-owner', tags: [], signature: 'process' }),
			} as any,
		});

		const result = await client.mint(
			{
				name: 'Permanent signal',
				description: '',
				file: new File([new Uint8Array([1])], 'signal.mp3', { type: 'audio/mpeg' }),
				artwork: new File([new Uint8Array([2])], 'cover.jpg', { type: 'image/jpeg' }),
			},
			owner
		);

		expect(media.addTag).toHaveBeenCalledWith('Content-Type', 'audio/mpeg');
		expect(artwork.addTag).toHaveBeenCalledWith('Type', 'Asset-Artwork');
		expect(process.addTag).toHaveBeenCalledWith('asset-artwork', artworkId);
		expect(result.asset).toMatchObject({
			contentType: 'audio/mpeg',
			media: `https://arweave.net/${mediaId}`,
			image: `https://arweave.net/${artworkId}`,
			artworkId,
		});
	});
});
