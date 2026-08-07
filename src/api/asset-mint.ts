import { createArweaveClient } from 'helpers/arweave';
import {
	isAudioContentType,
	isImageContentType,
	isSupportedAssetContentType,
	normalizeAssetContentType,
} from 'helpers/asset-media';
import { arweaveClientConfig, arweaveGatewayFromLocation } from 'helpers/config';

import type { AssetSummary, Collection } from './collections';

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const HIGH_COST_WINSTON = 100_000_000_000n;
const STORAGE_KEY = 'bazar-created-assets';
const DRAFT_PREFIX = 'bazar-mint-draft:';
const UDL_AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export const CREATED_COLLECTION_ID = 'created-assets';
export const CREATED_COLLECTION_NAME = 'Created on Bazar';
export const UDL_LICENSE_ID = 'dE0rmDfl9_OWjkDznNEXHaSO_JohJkRolvMzaCroUdw';

export type UdlFeeGrant = 'one-time' | 'monthly';
export type UdlDerivationGrant =
	| 'allowed'
	| 'credit'
	| 'indication'
	| 'license-passthrough'
	| 'revenue-share'
	| UdlFeeGrant;
export type UdlCommercialGrant = 'allowed' | 'credit' | 'revenue-share' | UdlFeeGrant;
export type UdlTrainingGrant = 'allowed' | UdlFeeGrant;

export type UdlTerms = {
	accessFee?: string;
	derivation?: { grant: UdlDerivationGrant; value?: string };
	commercialUse?: { grant: UdlCommercialGrant; value?: string };
	dataModelTraining?: { grant: UdlTrainingGrant; value?: string };
	unknownUsageRights?: 'excluded';
	expiry?: string;
	currency?: 'U' | 'AR';
	paymentAddress?: string;
	paymentMode?: 'random' | 'global';
};

export type MintInput = {
	name: string;
	description: string;
	file: File;
	artwork?: File;
	collection?: string;
	udl?: UdlTerms;
};

export type MintEstimate = {
	mediaReward: bigint;
	artworkReward: bigint;
	processReward: bigint;
	total: bigint;
	processBytes: number;
};

export type MintDraft = {
	owner: string;
	name: string;
	description: string;
	contentType: string;
	mediaId: string;
	artworkId?: string;
	createdAt: number;
	collection?: string;
	udl?: UdlTerms;
};

export type MintedAsset = AssetSummary & {
	description: string;
	mediaId: string;
	artworkId?: string;
	owner: string;
	createdAt: number;
};

export type MintResult = {
	asset: MintedAsset;
	mediaId: string;
	processId: string;
};

export type MintPhase =
	| 'signing-media'
	| 'uploading-media'
	| 'signing-artwork'
	| 'uploading-artwork'
	| 'signing-process'
	| 'creating-process';

export type CollectionMintInput = {
	name: string;
	description: string;
	files: File[];
	udl?: UdlTerms;
};

export type CollectionMintEstimate = {
	assetCount: number;
	total: bigint;
	transactionCount: number;
};

export type CollectionMintPhase =
	| { kind: 'asset'; index: number; total: number; phase: MintPhase }
	| { kind: 'manifest' | 'reference'; phase: 'signing' | 'uploading' };

export type MintedCollection = Collection & {
	manifestId: string;
	owner: string;
	createdAt: number;
};

export type CollectionMintResult = {
	collection: MintedCollection;
	manifestId: string;
	referenceId: string;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type AssetMintClientOptions = {
	wallet?: Window['arweaveWallet'];
	fetch?: typeof fetch;
	arweave?: any;
	storage?: StorageLike;
	gateway?: string;
};

export class AssetMintClient {
	#wallet?: Window['arweaveWallet'];
	#fetch: typeof fetch;
	#arweave?: any;
	#storage?: StorageLike;
	#gateway: string;

	constructor(options: AssetMintClientOptions = {}) {
		this.#wallet = options.wallet ?? globalThis.window?.arweaveWallet;
		this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
		this.#arweave = options.arweave;
		this.#storage = options.storage ?? globalThis.window?.localStorage;
		this.#gateway = options.gateway ?? arweaveGatewayFromLocation();
	}

	async estimate(input: MintInput, signal?: AbortSignal): Promise<MintEstimate> {
		validateMintInput(input);
		const placeholder = 'x'.repeat(43);
		const processBytes = byteLength(
			JSON.stringify(mintMetadata(input, placeholder, input.artwork ? placeholder : undefined))
		);
		const [mediaReward, artworkReward, processReward] = await Promise.all([
			this.#price(input.file.size, signal),
			input.artwork ? this.#price(input.artwork.size, signal) : 0n,
			this.#price(processBytes, signal),
		]);
		return {
			mediaReward,
			artworkReward,
			processReward,
			total: mediaReward + artworkReward + processReward,
			processBytes,
		};
	}

	async mint(
		input: MintInput,
		owner: string,
		options: { allowHighCost?: boolean; signal?: AbortSignal; onPhase?: (phase: MintPhase) => void } = {}
	): Promise<MintResult> {
		validateMintInput(input);
		assertAddress(owner, 'invalid-mint-owner');
		await this.#assertActiveSigner(owner);
		const estimate = await this.estimate(input, options.signal);
		if (estimate.total > HIGH_COST_WINSTON && !options.allowHighCost)
			throw new Error('mint-high-cost-confirmation-required');
		await this.#assertBalance(owner, estimate.total, options.signal);
		const arweave = await this.#getArweave();
		const contentType = requiredFileContentType(input.file);

		options.onPhase?.('signing-media');
		const media = await arweave.createTransaction(
			{ data: new Uint8Array(await input.file.arrayBuffer()) },
			'use_wallet'
		);
		media.addTag('Content-Type', contentType);
		media.addTag('App-Name', 'Bazar');
		media.addTag('App-Version', '2.0.0');
		media.addTag('Type', 'Asset-Media');
		for (const [name, value] of Object.entries(udlLicenseTags(input.udl))) media.addTag(name, value);
		const signedMedia = await this.#sign(media, owner, options.signal);
		options.onPhase?.('uploading-media');
		await this.#post(signedMedia, options.signal);

		let artworkId: string | undefined;
		if (input.artwork) {
			options.onPhase?.('signing-artwork');
			const artwork = await arweave.createTransaction(
				{ data: new Uint8Array(await input.artwork.arrayBuffer()) },
				'use_wallet'
			);
			artwork.addTag('Content-Type', requiredFileContentType(input.artwork));
			artwork.addTag('App-Name', 'Bazar');
			artwork.addTag('App-Version', '2.0.0');
			artwork.addTag('Type', 'Asset-Artwork');
			for (const [name, value] of Object.entries(udlLicenseTags(input.udl))) artwork.addTag(name, value);
			const signedArtwork = await this.#sign(artwork, owner, options.signal);
			options.onPhase?.('uploading-artwork');
			await this.#post(signedArtwork, options.signal);
			artworkId = signedArtwork.id;
		}

		const draft: MintDraft = {
			owner,
			name: input.name.trim(),
			description: input.description.trim(),
			contentType,
			mediaId: signedMedia.id,
			...(artworkId ? { artworkId } : {}),
			createdAt: Date.now(),
			...(input.collection ? { collection: input.collection.trim() } : {}),
			...(input.udl ? { udl: input.udl } : {}),
		};
		this.#storage?.setItem(`${DRAFT_PREFIX}${owner}`, JSON.stringify(draft));
		return this.resume(draft, owner, options);
	}

	async resume(
		draft: MintDraft,
		owner: string,
		options: { allowHighCost?: boolean; signal?: AbortSignal; onPhase?: (phase: MintPhase) => void } = {}
	): Promise<MintResult> {
		validateMintDraft(draft);
		assertAddress(owner, 'invalid-mint-owner');
		if (draft.owner !== owner) throw new Error('mint-draft-wallet-mismatch');
		await this.#assertActiveSigner(owner);
		const metadata = mintMetadata(draft, draft.mediaId, draft.artworkId);
		const processReward = await this.#price(byteLength(JSON.stringify(metadata)), options.signal);
		if (processReward > HIGH_COST_WINSTON && !options.allowHighCost)
			throw new Error('mint-high-cost-confirmation-required');
		await this.#assertBalance(owner, processReward, options.signal);
		const arweave = await this.#getArweave();

		options.onPhase?.('signing-process');
		const process = await arweave.createTransaction({ data: JSON.stringify(metadata) }, 'use_wallet');
		for (const [name, value] of Object.entries(mintProcessTags(draft, owner))) process.addTag(name, value);
		const signedProcess = await this.#sign(process, owner, options.signal);
		options.onPhase?.('creating-process');
		await this.#post(signedProcess, options.signal);

		const asset: MintedAsset = {
			id: signedProcess.id,
			name: draft.name,
			description: draft.description,
			contentType: draft.contentType,
			...(isAudioContentType(draft.contentType)
				? {
						media: `${this.#gateway}/${draft.mediaId}`,
						...(draft.artworkId ? { image: `${this.#gateway}/${draft.artworkId}` } : {}),
				  }
				: { image: `${this.#gateway}/${draft.mediaId}` }),
			mediaId: draft.mediaId,
			...(draft.artworkId ? { artworkId: draft.artworkId } : {}),
			owner,
			createdAt: draft.createdAt,
		};
		storeMintedAsset(asset, this.#storage);
		this.#storage?.removeItem(`${DRAFT_PREFIX}${owner}`);
		return { asset, mediaId: draft.mediaId, processId: signedProcess.id };
	}

	async publishData(
		data: string,
		tags: Record<string, string>,
		owner: string,
		options: { signal?: AbortSignal; onPhase?: (phase: 'signing' | 'uploading') => void } = {}
	): Promise<string> {
		assertAddress(owner, 'invalid-mint-owner');
		await this.#assertActiveSigner(owner);
		const reward = await this.#price(byteLength(data), options.signal);
		await this.#assertBalance(owner, reward, options.signal);
		const arweave = await this.#getArweave();
		options.onPhase?.('signing');
		const transaction = await arweave.createTransaction({ data }, 'use_wallet');
		for (const [name, value] of Object.entries(tags)) transaction.addTag(name, value);
		const signed = await this.#sign(transaction, owner, options.signal);
		options.onPhase?.('uploading');
		await this.#post(signed, options.signal);
		return signed.id;
	}

	async #price(bytes: number, signal?: AbortSignal): Promise<bigint> {
		const response = await this.#fetch(`${this.#gateway}/price/${bytes}`, { signal });
		if (!response.ok) throw new Error(`mint-price-${response.status}`);
		const value = (await response.text()).trim();
		if (!/^\d+$/.test(value)) throw new Error('mint-price-invalid');
		return BigInt(value);
	}

	async #sign(transaction: any, owner: string, signal?: AbortSignal): Promise<any> {
		if (!this.#wallet?.sign) throw new Error('wallet-sign-unavailable');
		signal?.throwIfAborted();
		await this.#assertActiveSigner(owner);
		const walletResult = (await this.#wallet.sign(transaction)) ?? transaction;
		let signed = walletResult;
		if (walletResult !== transaction && typeof transaction?.setSignature === 'function') {
			transaction.setSignature({
				id: walletResult.id,
				owner: walletResult.owner,
				reward: walletResult.reward,
				tags: walletResult.tags,
				signature: walletResult.signature,
			});
			signed = transaction;
		}
		if (!ADDRESS.test(signed?.id)) throw new Error('wallet-returned-unsigned-transaction');
		const signedOwner = String(signed.owner ?? '');
		const arweave = await this.#getArweave();
		if (!signedOwner || (await arweave.wallets.ownerToAddress(signedOwner)) !== owner) {
			throw new Error('wallet-account-changed');
		}
		return signed;
	}

	async #post(transaction: any, signal?: AbortSignal): Promise<void> {
		const arweave = await this.#getArweave();
		const chunks = transaction?.chunks?.chunks;
		if (Array.isArray(chunks) && chunks.length > 1 && arweave?.transactions?.getUploader) {
			const uploader = await arweave.transactions.getUploader(transaction);
			while (!uploader.isComplete) {
				signal?.throwIfAborted();
				await uploader.uploadChunk();
			}
			return;
		}

		const serializable =
			typeof transaction.toJSON === 'function' ? transaction.toJSON() : JSON.parse(JSON.stringify(transaction));
		serializable.id = transaction.id;
		for (let attempt = 1; attempt <= 3; attempt += 1) {
			const response = await this.#fetch(`${this.#gateway}/tx`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(serializable),
				signal,
			});
			if ([200, 202, 208].includes(response.status)) return;
			if (attempt === 3) throw new Error(`mint-upload-${response.status}`);
			await delay(attempt * 750, signal);
		}
	}

	async #assertActiveSigner(owner: string): Promise<void> {
		if (this.#wallet?.getActiveAddress && (await this.#wallet.getActiveAddress()) !== owner) {
			throw new Error('wallet-account-changed');
		}
	}

	async #getArweave() {
		this.#arweave ??= await createArweaveClient(arweaveClientConfig(this.#gateway));
		return this.#arweave;
	}

	async #assertBalance(owner: string, required: bigint, signal?: AbortSignal): Promise<void> {
		const response = await this.#fetch(`${this.#gateway}/wallet/${owner}/balance`, { signal });
		if (!response.ok) throw new Error(`wallet-balance-${response.status}`);
		const balance = BigInt((await response.text()).trim());
		if (balance < required) throw new Error('mint-insufficient-balance');
	}
}

export class CollectionMintClient {
	#assetClient: AssetMintClient;
	#fetch: typeof fetch;
	#gateway: string;
	#storage?: StorageLike;

	constructor(options: AssetMintClientOptions = {}) {
		this.#assetClient = new AssetMintClient(options);
		this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
		this.#gateway = options.gateway ?? arweaveGatewayFromLocation();
		this.#storage = options.storage ?? globalThis.window?.localStorage;
	}

	async estimate(input: CollectionMintInput, signal?: AbortSignal): Promise<CollectionMintEstimate> {
		validateCollectionMintInput(input);
		const placeholder = 'x'.repeat(43);
		const assets = input.files.map((file, index) => ({
			id: placeholder,
			name: fileAssetName(file, index),
			contentType: requiredFileContentType(file),
			image: `${this.#gateway}/${placeholder}`,
			mediaId: placeholder,
		}));
		const processSizes = input.files.map((file, index) =>
			byteLength(
				JSON.stringify(
					mintMetadata(
						{
							name: fileAssetName(file, index),
							description: input.description,
							contentType: requiredFileContentType(file),
							collection: input.name,
							udl: input.udl,
						},
						placeholder
					)
				)
			)
		);
		const manifest = collectionManifest(input, assets);
		const sizes = [
			...input.files.map((file) => file.size),
			...processSizes,
			byteLength(JSON.stringify(manifest)),
			byteLength('Bazar collection index'),
		];
		const rewards = await Promise.all(sizes.map((size) => this.#price(size, signal)));
		return {
			assetCount: input.files.length,
			total: rewards.reduce((total, reward) => total + reward, 0n),
			transactionCount: input.files.length * 2 + 2,
		};
	}

	async mint(
		input: CollectionMintInput,
		owner: string,
		options: {
			allowHighCost?: boolean;
			signal?: AbortSignal;
			onPhase?: (phase: CollectionMintPhase) => void;
		} = {}
	): Promise<CollectionMintResult> {
		validateCollectionMintInput(input);
		const estimate = await this.estimate(input, options.signal);
		if (isHighMintCost(estimate.total) && !options.allowHighCost) {
			throw new Error('mint-high-cost-confirmation-required');
		}
		const assets: MintedAsset[] = [];
		for (const [index, file] of input.files.entries()) {
			const result = await this.#assetClient.mint(
				{
					file,
					name: fileAssetName(file, index),
					description: input.description,
					collection: input.name.trim(),
					udl: input.udl,
				},
				owner,
				{
					allowHighCost: options.allowHighCost,
					signal: options.signal,
					onPhase: (phase) => options.onPhase?.({ kind: 'asset', index, total: input.files.length, phase }),
				}
			);
			assets.push(result.asset);
		}
		const manifestData = JSON.stringify(collectionManifest(input, assets));
		const manifestId = await this.#assetClient.publishData(
			manifestData,
			{
				'Content-Type': 'application/json',
				'App-Name': 'Bazar',
				'App-Version': '2.0.0',
				type: 'Collection-Manifest',
				name: input.name.trim(),
			},
			owner,
			{ signal: options.signal, onPhase: (phase) => options.onPhase?.({ kind: 'manifest', phase }) }
		);
		const referenceId = await this.#assetClient.publishData(
			'Bazar collection index',
			{
				'Content-Type': 'application/x.ao-message',
				'App-Name': 'Bazar',
				'App-Version': '2.0.0',
				device: 'reference@1.0',
				'reference-value': manifestId,
				type: 'Collection-Index',
				name: input.name.trim(),
			},
			owner,
			{ signal: options.signal, onPhase: (phase) => options.onPhase?.({ kind: 'reference', phase }) }
		);
		const collection: MintedCollection = {
			id: referenceId,
			name: input.name.trim(),
			description: input.description.trim() || 'A permanent Arweave collection created on Bazar.',
			kind: 'images',
			assets,
			total: assets.length,
			manifestId,
			owner,
			createdAt: Date.now(),
		};
		storeMintedCollection(collection, this.#storage);
		return { collection, manifestId, referenceId };
	}

	async #price(bytes: number, signal?: AbortSignal): Promise<bigint> {
		const response = await this.#fetch(`${this.#gateway}/price/${bytes}`, { signal });
		if (!response.ok) throw new Error(`mint-price-${response.status}`);
		return BigInt((await response.text()).trim());
	}
}

export function validateMintInput(input: MintInput): void {
	const name = input.name.trim();
	const description = input.description.trim();
	if (!name || name.length > 80) throw new TypeError('mint-name-invalid');
	if (description.length > 600) throw new TypeError('mint-description-invalid');
	if (!(input.file instanceof File)) throw new TypeError('mint-file-required');
	if (!normalizeAssetContentType(input.file.type, input.file.name)) throw new TypeError('mint-file-type-unsupported');
	const fileContentType = normalizeAssetContentType(input.file.type, input.file.name);
	const maxFileBytes = isAudioContentType(fileContentType ?? undefined) ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
	if (!input.file.size || input.file.size > maxFileBytes) throw new TypeError('mint-file-size-invalid');
	if (input.artwork !== undefined) {
		if (
			!(input.artwork instanceof File) ||
			!isImageContentType(normalizeAssetContentType(input.artwork.type, input.artwork.name) ?? undefined)
		) {
			throw new TypeError('mint-artwork-type-unsupported');
		}
		if (!input.artwork.size || input.artwork.size > MAX_IMAGE_BYTES)
			throw new TypeError('mint-artwork-size-invalid');
		if (!isAudioContentType(normalizeAssetContentType(input.file.type, input.file.name) ?? undefined)) {
			throw new TypeError('mint-artwork-audio-only');
		}
	}
	validateUdlTerms(input.udl);
}

export function validateCollectionMintInput(input: CollectionMintInput): void {
	if (!input.name.trim() || input.name.trim().length > 80) throw new TypeError('mint-collection-name-invalid');
	if (input.description.trim().length > 600) throw new TypeError('mint-description-invalid');
	if (!Array.isArray(input.files) || input.files.length < 1 || input.files.length > 10) {
		throw new TypeError('mint-collection-size-invalid');
	}
	for (const file of input.files) {
		if (!isImageContentType(normalizeAssetContentType(file.type, file.name) ?? undefined)) {
			throw new TypeError('mint-file-type-unsupported');
		}
		validateMintInput({
			name: fileAssetName(file, 0),
			description: input.description,
			file,
			collection: input.name,
			udl: input.udl,
		});
	}
}

export function mintMetadata(
	input: Pick<MintInput, 'name' | 'description' | 'collection' | 'udl'> & { contentType?: string; file?: File },
	mediaId: string,
	artworkId?: string
) {
	const contentType = normalizeAssetContentType(input.contentType ?? input.file?.type, input.file?.name) ?? '';
	return {
		name: input.name.trim(),
		description: input.description.trim(),
		contentType,
		...(isAudioContentType(contentType)
			? { audio: mediaId, ...(artworkId ? { image: artworkId } : {}) }
			: { image: mediaId }),
		collection: input.collection?.trim() || CREATED_COLLECTION_NAME,
	};
}

export function mintProcessTags(
	input: {
		name: string;
		contentType: string;
		mediaId: string;
		artworkId?: string;
		collection?: string;
		udl?: UdlTerms;
	},
	owner: string
): Record<string, string> {
	assertAddress(owner, 'invalid-mint-owner');
	assertAddress(input.mediaId, 'invalid-mint-media-id');
	if (input.artworkId) assertAddress(input.artworkId, 'invalid-mint-artwork-id');
	return {
		'Content-Type': 'application/json',
		'App-Name': 'Bazar',
		'App-Version': '2.0.0',
		device: 'process@1.0',
		type: 'Process',
		'execution-device': 'token@1.0',
		'swap-device': 'arweave-swap@1.0',
		'scheduler-device': 'arweave-scheduler@1.0',
		'scheduler-mode': 'all',
		'initial-holder': owner,
		'total-supply': '1',
		denomination: '0',
		ticker: 'ASSET',
		name: input.name.trim(),
		collection: input.collection?.trim() || CREATED_COLLECTION_NAME,
		'asset-content-type': normalizeAssetContentType(input.contentType) ?? input.contentType,
		'asset-data': input.mediaId,
		...(input.artworkId ? { 'asset-artwork': input.artworkId } : {}),
		...udlLicenseTags(input.udl),
	};
}

export function udlLicenseTags(terms?: UdlTerms): Record<string, string> {
	if (!terms) return {};
	validateUdlTerms(terms);
	const tags: Record<string, string> = { License: UDL_LICENSE_ID };
	if (terms.accessFee) tags['Access-Fee'] = `One-Time-${terms.accessFee}`;
	if (terms.derivation) tags.Derivation = udlGrantValue(terms.derivation);
	if (terms.commercialUse) tags['Commercial-Use'] = udlGrantValue(terms.commercialUse);
	if (terms.dataModelTraining) tags['Data-Model-Training'] = udlGrantValue(terms.dataModelTraining);
	if (terms.unknownUsageRights === 'excluded') tags['Unknown-Usage-Rights'] = 'Excluded';
	if (terms.expiry) tags.Expiry = terms.expiry;
	if (terms.currency && terms.currency !== 'U') tags.Currency = terms.currency;
	if (terms.paymentAddress) tags['Payment-Address'] = terms.paymentAddress;
	if (terms.paymentMode) {
		tags['Payment-Mode'] = terms.paymentMode === 'random' ? 'Random-Distribution' : 'Global-Distribution';
	}
	return tags;
}

export function getMintDraft(
	owner: string,
	storage: StorageLike | undefined = globalThis.window?.localStorage
): MintDraft | null {
	if (!ADDRESS.test(owner) || !storage) return null;
	try {
		const draft = JSON.parse(storage.getItem(`${DRAFT_PREFIX}${owner}`) ?? 'null');
		validateMintDraft(draft);
		return draft.owner === owner ? draft : null;
	} catch {
		return null;
	}
}

export function discardMintDraft(
	owner: string,
	storage: StorageLike | undefined = globalThis.window?.localStorage
): void {
	if (ADDRESS.test(owner)) storage?.removeItem(`${DRAFT_PREFIX}${owner}`);
}

export function loadMintedAssets(storage: StorageLike | undefined = globalThis.window?.localStorage): MintedAsset[] {
	if (!storage) return [];
	try {
		const assets = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
		if (!Array.isArray(assets)) return [];
		return assets.filter(isMintedAsset).sort((a, b) => b.createdAt - a.createdAt);
	} catch {
		return [];
	}
}

export function storeMintedAsset(
	asset: MintedAsset,
	storage: StorageLike | undefined = globalThis.window?.localStorage
): void {
	if (!storage || !isMintedAsset(asset)) return;
	storage.setItem(
		STORAGE_KEY,
		JSON.stringify([asset, ...loadMintedAssets(storage).filter((item) => item.id !== asset.id)])
	);
}

export function loadMintedCollections(
	storage: StorageLike | undefined = globalThis.window?.localStorage
): MintedCollection[] {
	if (!storage) return [];
	try {
		const collections = JSON.parse(storage.getItem(`${STORAGE_KEY}:collections`) ?? '[]');
		return Array.isArray(collections)
			? collections.filter(isMintedCollection).sort((a, b) => b.createdAt - a.createdAt)
			: [];
	} catch {
		return [];
	}
}

export function storeMintedCollection(
	collection: MintedCollection,
	storage: StorageLike | undefined = globalThis.window?.localStorage
): void {
	if (!storage || !isMintedCollection(collection)) return;
	storage.setItem(
		`${STORAGE_KEY}:collections`,
		JSON.stringify([collection, ...loadMintedCollections(storage).filter((item) => item.id !== collection.id)])
	);
}

export function createdCollection(assets: AssetSummary[] = loadMintedAssets()): Collection {
	return {
		id: CREATED_COLLECTION_ID,
		name: CREATED_COLLECTION_NAME,
		description: 'One-of-one media minted permanently through Bazar.',
		kind: 'images',
		assets,
		total: assets.length,
	};
}

export function assetFromMintState(
	processId: string,
	raw: Record<string, unknown>,
	fallbackName = ''
): AssetSummary | null {
	const mediaId = String(raw['asset-data'] ?? '');
	const contentType = normalizeAssetContentType(String(raw['asset-content-type'] ?? ''));
	const artworkId = String(raw['asset-artwork'] ?? '');
	const name = String(raw.name ?? fallbackName).trim();
	if (
		!ADDRESS.test(processId) ||
		!ADDRESS.test(mediaId) ||
		!contentType ||
		(artworkId && !ADDRESS.test(artworkId)) ||
		!name
	)
		return null;
	const gateway = arweaveGatewayFromLocation();
	return {
		id: processId,
		name,
		contentType,
		...(isAudioContentType(contentType)
			? { media: `${gateway}/${mediaId}`, ...(artworkId ? { image: `${gateway}/${artworkId}` } : {}) }
			: { image: `${gateway}/${mediaId}` }),
	};
}

export function isBazarMintTags(tags: Record<string, string>): boolean {
	return (
		tags['app-name'] === 'Bazar' &&
		tags.type === 'Process' &&
		tags['execution-device'] === 'token@1.0' &&
		tags['swap-device'] === 'arweave-swap@1.0' &&
		ADDRESS.test(tags['asset-data'] ?? '') &&
		isSupportedAssetContentType(tags['asset-content-type']) &&
		(!tags['asset-artwork'] || ADDRESS.test(tags['asset-artwork']))
	);
}

export function isHighMintCost(total: bigint): boolean {
	return total > HIGH_COST_WINSTON;
}

function validateMintDraft(value: unknown): asserts value is MintDraft {
	if (!value || typeof value !== 'object') throw new TypeError('mint-draft-invalid');
	const draft = value as MintDraft;
	if (
		!ADDRESS.test(draft.owner) ||
		!ADDRESS.test(draft.mediaId) ||
		!draft.name?.trim() ||
		draft.name.length > 80 ||
		!isSupportedAssetContentType(draft.contentType) ||
		(draft.artworkId !== undefined && !ADDRESS.test(draft.artworkId)) ||
		typeof draft.description !== 'string' ||
		draft.description.length > 600 ||
		!Number.isSafeInteger(draft.createdAt)
	)
		throw new TypeError('mint-draft-invalid');
	validateUdlTerms(draft.udl);
}

function validateUdlTerms(terms?: UdlTerms): void {
	if (terms === undefined) return;
	if (!terms || typeof terms !== 'object' || Array.isArray(terms)) throw new TypeError('mint-udl-invalid');
	if (terms.accessFee !== undefined && !isPositiveUdlAmount(terms.accessFee)) {
		throw new TypeError('mint-udl-access-fee-invalid');
	}
	validateUdlGrant(
		terms.derivation,
		new Set<UdlDerivationGrant>([
			'allowed',
			'credit',
			'indication',
			'license-passthrough',
			'revenue-share',
			'one-time',
			'monthly',
		])
	);
	validateUdlGrant(
		terms.commercialUse,
		new Set<UdlCommercialGrant>(['allowed', 'credit', 'revenue-share', 'one-time', 'monthly'])
	);
	validateUdlGrant(terms.dataModelTraining, new Set<UdlTrainingGrant>(['allowed', 'one-time', 'monthly']));
	if (terms.unknownUsageRights !== undefined && terms.unknownUsageRights !== 'excluded') {
		throw new TypeError('mint-udl-unknown-rights-invalid');
	}
	if (terms.expiry !== undefined && !/^[1-9]\d*$/.test(terms.expiry)) {
		throw new TypeError('mint-udl-expiry-invalid');
	}
	if (terms.currency !== undefined && !['U', 'AR'].includes(terms.currency)) {
		throw new TypeError('mint-udl-currency-invalid');
	}
	if (terms.paymentAddress !== undefined && !ADDRESS.test(terms.paymentAddress)) {
		throw new TypeError('mint-udl-payment-address-invalid');
	}
	if (terms.paymentMode !== undefined && !['random', 'global'].includes(terms.paymentMode)) {
		throw new TypeError('mint-udl-payment-mode-invalid');
	}
}

function validateUdlGrant<T extends string>(grant: { grant: T; value?: string } | undefined, allowed: Set<T>): void {
	if (grant === undefined) return;
	if (!grant || typeof grant !== 'object' || !allowed.has(grant.grant)) throw new TypeError('mint-udl-grant-invalid');
	if (['one-time', 'monthly'].includes(grant.grant)) {
		if (!isPositiveUdlAmount(grant.value)) throw new TypeError('mint-udl-fee-invalid');
	} else if (grant.grant === 'revenue-share') {
		const percentage = Number(grant.value);
		if (!isPositiveUdlAmount(grant.value) || percentage > 100) throw new TypeError('mint-udl-share-invalid');
	} else if (grant.value !== undefined) {
		throw new TypeError('mint-udl-value-unexpected');
	}
}

function isPositiveUdlAmount(value: unknown): value is string {
	return typeof value === 'string' && UDL_AMOUNT.test(value) && !/^0(?:\.0+)?$/.test(value);
}

function udlGrantValue(grant: { grant: string; value?: string }): string {
	switch (grant.grant) {
		case 'allowed':
			return 'Allowed';
		case 'credit':
			return 'Allowed-With-Credit';
		case 'indication':
			return 'Allowed-With-Indication';
		case 'license-passthrough':
			return 'Allowed-With-License-Passthrough';
		case 'revenue-share':
			return `Allowed-With-RevenueShare-${grant.value}%`;
		case 'one-time':
			return `Allowed-With-Fee-One-Time-${grant.value}`;
		case 'monthly':
			return `Allowed-With-Fee-Monthly-${grant.value}`;
		default:
			throw new TypeError('mint-udl-grant-invalid');
	}
}

function collectionManifest(
	input: Pick<CollectionMintInput, 'name' | 'description'>,
	assets: Array<AssetSummary & { mediaId?: string }>
) {
	return {
		version: 2,
		name: input.name.trim(),
		description: input.description.trim() || 'A permanent Arweave collection created on Bazar.',
		kind: 'arweave-native-token-assets',
		assetCount: assets.length,
		assets: assets.map((asset, index) => ({
			index: index + 1,
			id: asset.id,
			name: asset.name,
			contentType: asset.contentType,
			image: asset.image,
			media: asset.media,
			...(asset.mediaId ? { mediaId: asset.mediaId } : {}),
		})),
	};
}

function fileAssetName(file: File, index: number): string {
	return (
		file.name
			.replace(/\.[^.]+$/, '')
			.trim()
			.slice(0, 80) || `Asset ${index + 1}`
	);
}

function isMintedAsset(value: unknown): value is MintedAsset {
	if (!value || typeof value !== 'object') return false;
	const asset = value as MintedAsset;
	return (
		ADDRESS.test(asset.id) &&
		ADDRESS.test(asset.mediaId) &&
		ADDRESS.test(asset.owner) &&
		typeof asset.name === 'string' &&
		typeof asset.description === 'string' &&
		isSupportedAssetContentType(asset.contentType) &&
		(isAudioContentType(asset.contentType) ? typeof asset.media === 'string' : typeof asset.image === 'string') &&
		(asset.artworkId === undefined || ADDRESS.test(asset.artworkId)) &&
		Number.isSafeInteger(asset.createdAt)
	);
}

function requiredFileContentType(file: File): string {
	const contentType = normalizeAssetContentType(file.type, file.name);
	if (!contentType) throw new TypeError('mint-file-type-unsupported');
	return contentType;
}

function isMintedCollection(value: unknown): value is MintedCollection {
	if (!value || typeof value !== 'object') return false;
	const collection = value as MintedCollection;
	return (
		ADDRESS.test(collection.id) &&
		ADDRESS.test(collection.manifestId) &&
		ADDRESS.test(collection.owner) &&
		collection.kind === 'images' &&
		typeof collection.name === 'string' &&
		typeof collection.description === 'string' &&
		Array.isArray(collection.assets) &&
		collection.assets.every(isMintedAsset) &&
		Number.isSafeInteger(collection.createdAt)
	);
}

function assertAddress(value: string, error: string): void {
	if (!ADDRESS.test(value)) throw new TypeError(error);
}

function byteLength(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

function delay(duration: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(resolve, duration);
		signal?.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
			},
			{ once: true }
		);
	});
}
