import { createArweaveClient } from 'helpers/arweave';
import {
	isAudioContentType,
	isImageContentType,
	isSupportedAssetContentType,
	normalizeAssetContentType,
} from 'helpers/asset-media';
import { mapConcurrent } from 'helpers/concurrency';
import {
	arweaveClientConfig,
	arweaveGatewayFromLocation,
	arweaveRawDataUrl,
	gatewayFromLocation,
} from 'helpers/config';

import { type AssetSummary, FUNGIBLE_TOKEN_COLLECTION_ID, FUNGIBLE_TOKEN_COLLECTION_NAME } from './collections';
import { acceptedMintActivity, upsertMintActivity } from './mint-activity';
import {
	CREATED_COLLECTION_ID,
	CREATED_COLLECTION_NAME,
	type MintedAsset,
	type MintedCollection,
	type StorageLike,
	storeMintedAsset,
	storeMintedCollection,
} from './minted-assets';

export type { MintedAsset, MintedCollection, StorageLike } from './minted-assets';
export {
	assetFromMintState,
	CREATED_COLLECTION_ID,
	CREATED_COLLECTION_NAME,
	createdCollection,
	loadMintedAssets,
	loadMintedCollections,
	storeMintedAsset,
	storeMintedCollection,
} from './minted-assets';

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
export const ORDINARY_MINT_COST_MAX_WINSTON = 100_000_000_000n;
const DRAFT_PREFIX = 'bazar-mint-draft:';
const UDL_AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

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
	artist?: string;
	album?: string;
	duration?: number;
	collection?: string;
	udl?: UdlTerms;
};

export type MintEstimate = {
	assetReward: bigint;
	artworkReward: bigint;
	total: bigint;
	assetBytes: number;
	artworkBytes: number;
	transactionCount: number;
};

export type MintDraft = {
	owner: string;
	name: string;
	description: string;
	contentType: string;
	mediaId: string;
	artworkId?: string;
	artist?: string;
	album?: string;
	duration?: number;
	createdAt: number;
	collection?: string;
	udl?: UdlTerms;
};

export type MintResult = {
	asset: MintedAsset;
	mediaId: string;
	processId: string;
};

export type MintPhase = 'signing-asset' | 'uploading-asset' | 'signing-artwork' | 'uploading-artwork';

export const MAX_FUNGIBLE_TICKER_LENGTH = 32;
/** Mirrors MAX_TOKEN_DENOMINATION in asset-marketplace.ts — parseAssetState rejects anything above it. */
export const MAX_FUNGIBLE_DENOMINATION = 255;

export type FungibleMintInput = {
	name: string;
	description: string;
	/** 1-32 printable characters, no surrounding whitespace (mirrors safeTicker in asset-marketplace.ts). */
	ticker: string;
	/** Positive integer count of whole tokens. Converted to atomic units exactly once when publishing. */
	wholeSupply: string;
	/** Fractional precision, 0-255. One whole token equals 10^denomination atomic units. */
	denomination: string;
	/** Optional 43-char Arweave transaction id rendered as the token logo. */
	logo?: string;
};

export type FungibleMintResult = {
	processId: string;
	logo?: string;
	owner: string;
	name: string;
	ticker: string;
	wholeSupply: string;
	atomicSupply: string;
	denomination: number;
	createdAt: number;
};

export type FungibleMintEstimate = {
	processReward: bigint;
	logoReward: bigint;
	reward: bigint;
	bytes: number;
	transactionCount: number;
};

export type FungibleMintPhase = 'signing-logo' | 'uploading-logo' | 'signing' | 'uploading';

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
	| { kind: 'manifest' | 'process'; phase: 'signing' | 'uploading' };

export type CollectionMintResult = {
	collection: MintedCollection;
	manifestId: string;
	processId: string;
};

export type CollectionAppendResult = {
	collection: MintedCollection;
	manifestId: string;
	updateId: string;
};

export type AssetMintClientOptions = {
	wallet?: Window['arweaveWallet'];
	fetch?: typeof fetch;
	arweave?: any;
	storage?: StorageLike;
	gateway?: string;
	computeGateway?: string;
};

export class AssetMintClient {
	#wallet?: Window['arweaveWallet'];
	#fetch: typeof fetch;
	#arweave?: any;
	#storage?: StorageLike;
	#gateway: string;
	#computeGateway: string;

	constructor(options: AssetMintClientOptions = {}) {
		this.#wallet = options.wallet ?? globalThis.window?.arweaveWallet;
		this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
		this.#arweave = options.arweave;
		this.#storage = options.storage ?? globalThis.window?.localStorage;
		this.#gateway = options.gateway ?? arweaveGatewayFromLocation();
		this.#computeGateway = options.computeGateway ?? (typeof window === 'undefined' ? '' : gatewayFromLocation());
	}

	async estimate(input: MintInput, signal?: AbortSignal): Promise<MintEstimate> {
		validateMintInput(input);
		const [assetReward, artworkReward] = await Promise.all([
			this.#price(input.file.size, signal),
			input.artwork ? this.#price(input.artwork.size, signal) : 0n,
		]);
		return {
			assetReward,
			artworkReward,
			total: assetReward + artworkReward,
			assetBytes: input.file.size,
			artworkBytes: input.artwork?.size ?? 0,
			transactionCount: input.artwork ? 2 : 1,
		};
	}

	async mint(
		input: MintInput,
		owner: string,
		options: {
			allowHighCost?: boolean;
			signal?: AbortSignal;
			onPhase?: (phase: MintPhase) => void;
			onTransaction?: (transaction: MintUploadTransaction) => void;
		} = {}
	): Promise<MintResult> {
		validateMintInput(input);
		assertAddress(owner, 'invalid-mint-owner');
		await this.#assertActiveSigner(owner);
		const estimate = await this.estimate(input, options.signal);
		if (estimate.total > ORDINARY_MINT_COST_MAX_WINSTON && !options.allowHighCost)
			throw new Error('mint-high-cost-confirmation-required');
		await this.#assertBalance(owner, estimate.total, options.signal);
		const arweave = await this.#getArweave();
		const contentType = requiredFileContentType(input.file);

		let artworkId: string | undefined;
		if (input.artwork) {
			options.onPhase?.('signing-artwork');
			const artwork = await arweave.createTransaction(
				{ data: new Uint8Array(await input.artwork.arrayBuffer()) },
				'use_wallet'
			);
			for (const [name, value] of Object.entries(
				normalizeUploadTags({
					'content-type': requiredFileContentType(input.artwork),
					'app-name': 'Bazar',
					'app-version': '2.0.0',
					type: 'Asset-Artwork',
					...udlLicenseTags(input.udl),
				})
			)) {
				artwork.addTag(name, value);
			}
			const signedArtwork = await this.#sign(artwork, owner, options.signal);
			options.onTransaction?.({ id: signedArtwork.id, label: 'Artwork transaction' });
			options.onPhase?.('uploading-artwork');
			await this.#post(signedArtwork, options.signal);
			artworkId = signedArtwork.id;
		}

		const createdAt = Date.now();
		const assetInput = {
			name: input.name.trim(),
			description: input.description.trim(),
			contentType,
			...(artworkId ? { artworkId } : {}),
			...(input.artist?.trim() ? { artist: input.artist.trim() } : {}),
			...(input.album?.trim() ? { album: input.album.trim() } : {}),
			...(input.duration && input.duration > 0 ? { duration: input.duration } : {}),
			createdAt,
			...(input.collection ? { collection: input.collection.trim() } : {}),
			...(input.udl ? { udl: input.udl } : {}),
		};
		const data = new Uint8Array(await input.file.arrayBuffer());
		return this.#publishAtomicAsset(data, assetInput, owner, options);
	}

	async resume(
		draft: MintDraft,
		owner: string,
		options: {
			allowHighCost?: boolean;
			signal?: AbortSignal;
			onPhase?: (phase: MintPhase) => void;
			onTransaction?: (transaction: MintUploadTransaction) => void;
		} = {}
	): Promise<MintResult> {
		validateMintDraft(draft);
		assertAddress(owner, 'invalid-mint-owner');
		if (draft.owner !== owner) throw new Error('mint-draft-wallet-mismatch');
		await this.#assertActiveSigner(owner);
		const response = await this.#fetch(arweaveRawDataUrl(draft.mediaId, this.#gateway), { signal: options.signal });
		if (!response.ok) throw new Error(`mint-media-unavailable-${response.status}`);
		const data = new Uint8Array(await response.arrayBuffer());
		const maxBytes = isAudioContentType(draft.contentType) ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
		if (!data.byteLength || data.byteLength > maxBytes) throw new Error('mint-media-invalid');
		const assetReward = await this.#price(data.byteLength, options.signal);
		if (assetReward > ORDINARY_MINT_COST_MAX_WINSTON && !options.allowHighCost)
			throw new Error('mint-high-cost-confirmation-required');
		await this.#assertBalance(owner, assetReward, options.signal);
		const assetInput = {
			name: draft.name,
			description: draft.description,
			contentType: draft.contentType,
			...(draft.artworkId ? { artworkId: draft.artworkId } : {}),
			...(draft.artist ? { artist: draft.artist } : {}),
			...(draft.album ? { album: draft.album } : {}),
			...(draft.duration ? { duration: draft.duration } : {}),
			createdAt: draft.createdAt,
			...(draft.collection ? { collection: draft.collection } : {}),
			...(draft.udl ? { udl: draft.udl } : {}),
		};
		return this.#publishAtomicAsset(data, assetInput, owner, options);
	}

	async #publishAtomicAsset(
		data: Uint8Array,
		input: Omit<MintDraft, 'owner' | 'mediaId'>,
		owner: string,
		options: {
			signal?: AbortSignal;
			onPhase?: (phase: MintPhase) => void;
			onTransaction?: (transaction: MintUploadTransaction) => void;
		}
	): Promise<MintResult> {
		const arweave = await this.#getArweave();
		options.onPhase?.('signing-asset');
		const process = await arweave.createTransaction({ data }, 'use_wallet');
		for (const [name, value] of Object.entries(normalizeUploadTags(mintProcessTags(input, owner)))) {
			process.addTag(name, value);
		}
		const signedProcess = await this.#sign(process, owner, options.signal);
		options.onTransaction?.({ id: signedProcess.id, label: 'Asset transaction' });
		options.onPhase?.('uploading-asset');
		await this.#post(signedProcess, options.signal);

		const asset: MintedAsset = {
			id: signedProcess.id,
			name: input.name,
			description: input.description,
			contentType: input.contentType,
			...(input.artist ? { artist: input.artist } : {}),
			...(input.album ? { album: input.album } : {}),
			...(input.duration ? { duration: input.duration } : {}),
			...(isAudioContentType(input.contentType)
				? {
						media: arweaveRawDataUrl(signedProcess.id, this.#gateway),
						...(input.artworkId ? { image: arweaveRawDataUrl(input.artworkId, this.#gateway) } : {}),
				  }
				: { image: arweaveRawDataUrl(signedProcess.id, this.#gateway) }),
			mediaId: signedProcess.id,
			...(input.artworkId ? { artworkId: input.artworkId } : {}),
			owner,
			createdAt: input.createdAt,
		};
		storeMintedAsset(asset, this.#storage);
		if (this.#storage) {
			upsertMintActivity(
				this.#storage,
				acceptedMintActivity({
					owner,
					asset,
					collectionId: CREATED_COLLECTION_ID,
					transactionIds: [input.artworkId, signedProcess.id].filter((id): id is string => Boolean(id)),
					arweaveGateway: this.#gateway,
					computeGateway: this.#computeGateway,
				})
			);
		}
		this.#storage?.removeItem(`${DRAFT_PREFIX}${owner}`);
		return { asset, mediaId: signedProcess.id, processId: signedProcess.id };
	}

	async estimateFungible(input: FungibleMintInput, logo?: File, signal?: AbortSignal): Promise<FungibleMintEstimate> {
		validateFungibleMintInput(input);
		if (logo) validateFungibleLogo(logo);
		const processBytes = byteLength(fungibleMintData(input));
		const logoBytes = input.logo ? 0 : logo?.size ?? 0;
		const [processReward, logoReward] = await Promise.all([
			this.#price(processBytes, signal),
			logoBytes ? this.#price(logoBytes, signal) : 0n,
		]);
		return {
			processReward,
			logoReward,
			reward: processReward + logoReward,
			bytes: processBytes + logoBytes,
			transactionCount: logoBytes ? 2 : 1,
		};
	}

	/**
	 * Publish a fungible token process minting the whole supply to `owner`.
	 *
	 * The supply is minted through the `initial-holder` tag alone. Do NOT
	 * attach a balances+link structure at creation: deployed nodes 502 on
	 * init when one is present (verified 2026-08-11). The tag set mirrors
	 * scripts/publish_fungible_token.mjs; `asset-type: fungible` is required
	 * for discovery (collections.ts fungible GraphQL filter and
	 * fungibleAssetFromState both demand it).
	 */
	async mintFungible(
		input: FungibleMintInput,
		owner: string,
		options: {
			logo?: File;
			signal?: AbortSignal;
			onLogoUploaded?: (transactionId: string) => void;
			onPhase?: (phase: FungibleMintPhase) => void;
		} = {}
	): Promise<FungibleMintResult> {
		validateFungibleMintInput(input);
		assertAddress(owner, 'invalid-mint-owner');
		let logoId = input.logo;
		if (!logoId && options.logo) {
			validateFungibleLogo(options.logo);
			const contentType = requiredFileContentType(options.logo);
			logoId = await this.publishData(
				new Uint8Array(await options.logo.arrayBuffer()),
				{
					'Content-Type': contentType,
					'App-Name': 'Bazar',
					'App-Version': '2.0.0',
					Type: 'Token-Logo',
				},
				owner,
				{
					signal: options.signal,
					onPhase: (phase) => options.onPhase?.(phase === 'signing' ? 'signing-logo' : 'uploading-logo'),
				}
			);
			options.onLogoUploaded?.(logoId);
		}
		const processInput = logoId ? { ...input, logo: logoId } : input;
		const processId = await this.publishData(
			fungibleMintData(processInput),
			fungibleMintProcessTags(processInput, owner),
			owner,
			{ signal: options.signal, onPhase: options.onPhase }
		);
		const createdAt = Date.now();
		// Record the mint in the shared activity notifier the same as an atomic
		// mint. The App-level watcher advances it accepted → mined → applied →
		// complete by polling readAssetState(processId) — which is exactly the
		// scheduler-sequencing / process-state-readable signal a fungible token
		// waits on — then self-removes and fires bazar:mint-live.
		if (this.#storage) {
			const asset: MintedAsset = {
				id: processId,
				name: input.name.trim(),
				ticker: input.ticker,
				contentType: 'application/x.arweave-token',
				description: input.description?.trim() ?? '',
				...(logoId ? { image: `${this.#gateway}/${logoId}` } : {}),
				mediaId: processId,
				owner,
				createdAt,
			};
			upsertMintActivity(
				this.#storage,
				acceptedMintActivity({
					owner,
					asset,
					collectionId: FUNGIBLE_TOKEN_COLLECTION_ID,
					transactionIds: [logoId, processId].filter((id): id is string => Boolean(id)),
					arweaveGateway: this.#gateway,
					computeGateway: this.#computeGateway,
				})
			);
		}
		return {
			processId,
			...(logoId ? { logo: logoId } : {}),
			owner,
			name: input.name.trim(),
			ticker: input.ticker,
			wholeSupply: input.wholeSupply,
			atomicSupply: fungibleAtomicSupply(input.wholeSupply, input.denomination),
			denomination: Number(input.denomination),
			createdAt,
		};
	}

	async publishData(
		data: string | Uint8Array,
		tags: Record<string, string>,
		owner: string,
		options: {
			signal?: AbortSignal;
			target?: string;
			onPhase?: (phase: 'signing' | 'uploading') => void;
			onTransaction?: (transactionId: string) => void;
		} = {}
	): Promise<string> {
		assertAddress(owner, 'invalid-mint-owner');
		if (options.target) assertAddress(options.target, 'invalid-mint-target');
		await this.#assertActiveSigner(owner);
		const reward = await this.#price(byteLength(data), options.signal, options.target);
		await this.#assertBalance(owner, reward, options.signal);
		const arweave = await this.#getArweave();
		options.onPhase?.('signing');
		const transaction = await arweave.createTransaction(
			options.target ? { data, target: options.target, quantity: '1' } : { data },
			'use_wallet'
		);
		for (const [name, value] of Object.entries(normalizeUploadTags(tags))) transaction.addTag(name, value);
		const signed = await this.#sign(transaction, owner, options.signal);
		options.onTransaction?.(signed.id);
		options.onPhase?.('uploading');
		await this.#post(signed, options.signal);
		return signed.id;
	}

	async #price(bytes: number, signal?: AbortSignal, target?: string): Promise<bigint> {
		const response = await this.#fetch(`${this.#gateway}/price/${bytes}${target ? `/${target}` : ''}`, {
			signal,
		});
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
		const manifest = collectionManifest(input, assets);
		const sizes = [
			...input.files.map((file) => file.size),
			byteLength(JSON.stringify(manifest)),
			byteLength('Bazar collection process'),
		];
		const uniqueSizes = [...new Set(sizes)];
		const uniqueRewards = await mapConcurrent(uniqueSizes, 8, (size) => this.#price(size, signal));
		const rewards = new Map(uniqueSizes.map((size, index) => [size, uniqueRewards[index]]));
		return {
			assetCount: input.files.length,
			total: sizes.reduce((total, size) => total + rewards.get(size)!, 0n),
			transactionCount: input.files.length + 2,
		};
	}

	async mint(
		input: CollectionMintInput,
		owner: string,
		options: {
			allowHighCost?: boolean;
			signal?: AbortSignal;
			onPhase?: (phase: CollectionMintPhase) => void;
			onTransaction?: (transaction: MintUploadTransaction) => void;
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
					onTransaction: (transaction) =>
						options.onTransaction?.({
							...transaction,
							label: `Asset ${index + 1} of ${input.files.length}`,
						}),
				}
			);
			assets.push(result.asset);
		}
		const manifestData = JSON.stringify(collectionManifest(input, assets));
		const manifestId = await this.#assetClient.publishData(
			manifestData,
			{
				'content-type': 'application/json',
				'app-name': 'Bazar',
				'app-version': '2.0.0',
				type: 'Collection-Manifest',
				name: input.name.trim(),
			},
			owner,
			{
				signal: options.signal,
				onPhase: (phase) => options.onPhase?.({ kind: 'manifest', phase }),
				onTransaction: (id) => options.onTransaction?.({ id, label: 'Collection manifest' }),
			}
		);
		const processId = await this.#assetClient.publishData(
			'Bazar collection process',
			collectionProcessTags(input.name, manifestId, owner),
			owner,
			{
				signal: options.signal,
				onPhase: (phase) => options.onPhase?.({ kind: 'process', phase }),
				onTransaction: (id) => options.onTransaction?.({ id, label: 'Collection process' }),
			}
		);
		const collection: MintedCollection = {
			id: processId,
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
		return { collection, manifestId, processId };
	}

	async estimateAppend(
		collection: MintedCollection,
		files: File[],
		signal?: AbortSignal
	): Promise<CollectionMintEstimate> {
		validateCollectionMintInput({ name: collection.name, description: collection.description, files });
		const placeholder = 'x'.repeat(43);
		const additions = files.map((file, index) => ({
			id: placeholder,
			name: fileAssetName(file, collection.assets.length + index),
			contentType: requiredFileContentType(file),
		}));
		const sizes = [
			...files.map((file) => file.size),
			byteLength(JSON.stringify(collectionManifest(collection, [...collection.assets, ...additions]))),
		];
		const uniqueSizes = [...new Set(sizes)];
		const [uniqueRewards, updateReward] = await Promise.all([
			mapConcurrent(uniqueSizes, 8, (size) => this.#price(size, signal)),
			this.#price(0, signal, collection.id),
		]);
		const rewards = new Map(uniqueSizes.map((size, index) => [size, uniqueRewards[index]]));
		return {
			assetCount: files.length,
			total: sizes.reduce((total, size) => total + rewards.get(size)!, updateReward),
			transactionCount: files.length + 2,
		};
	}

	async append(
		collection: MintedCollection,
		files: File[],
		owner: string,
		options: {
			allowHighCost?: boolean;
			signal?: AbortSignal;
			onPhase?: (phase: CollectionMintPhase) => void;
			onTransaction?: (transaction: MintUploadTransaction) => void;
		} = {}
	): Promise<CollectionAppendResult> {
		assertAddress(collection.id, 'invalid-collection-process-id');
		if (collection.owner !== owner) throw new Error('collection-owner-mismatch');
		const estimate = await this.estimateAppend(collection, files, options.signal);
		if (isHighMintCost(estimate.total) && !options.allowHighCost) {
			throw new Error('mint-high-cost-confirmation-required');
		}
		const additions: MintedAsset[] = [];
		for (const [index, file] of files.entries()) {
			const result = await this.#assetClient.mint(
				{
					file,
					name: fileAssetName(file, collection.assets.length + index),
					description: collection.description,
					collection: collection.name,
					udl: {},
				},
				owner,
				{
					allowHighCost: options.allowHighCost,
					signal: options.signal,
					onPhase: (phase) => options.onPhase?.({ kind: 'asset', index, total: files.length, phase }),
					onTransaction: (transaction) =>
						options.onTransaction?.({ ...transaction, label: `Asset ${index + 1} of ${files.length}` }),
				}
			);
			additions.push(result.asset);
		}
		const assets = [...collection.assets, ...additions];
		const manifestId = await this.#assetClient.publishData(
			JSON.stringify(collectionManifest(collection, assets)),
			{
				'content-type': 'application/json',
				'app-name': 'Bazar',
				'app-version': '2.0.0',
				type: 'Collection-Manifest',
				name: collection.name,
			},
			owner,
			{
				signal: options.signal,
				onPhase: (phase) => options.onPhase?.({ kind: 'manifest', phase }),
				onTransaction: (id) => options.onTransaction?.({ id, label: 'Collection manifest' }),
			}
		);
		const updateId = await this.#assetClient.publishData(
			'',
			{
				'content-type': 'application/x.ao-message',
				'app-name': 'Bazar',
				'app-version': '2.0.0',
				action: 'set',
				'reference-value': manifestId,
				type: 'Collection-Update',
				name: collection.name,
			},
			owner,
			{
				target: collection.id,
				signal: options.signal,
				onPhase: (phase) => options.onPhase?.({ kind: 'process', phase }),
				onTransaction: (id) => options.onTransaction?.({ id, label: 'Collection update' }),
			}
		);
		const updated = { ...collection, assets, total: assets.length, manifestId };
		storeMintedCollection(updated, this.#storage);
		return { collection: updated, manifestId, updateId };
	}

	async #price(bytes: number, signal?: AbortSignal, target?: string): Promise<bigint> {
		const response = await this.#fetch(`${this.#gateway}/price/${bytes}${target ? `/${target}` : ''}`, {
			signal,
		});
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
	if (input.artist !== undefined && input.artist.trim().length > 160) throw new TypeError('mint-artist-invalid');
	if (input.album !== undefined && input.album.trim().length > 160) throw new TypeError('mint-album-invalid');
	if (input.duration !== undefined && (!Number.isFinite(input.duration) || input.duration <= 0)) {
		throw new TypeError('mint-duration-invalid');
	}
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
	input: Pick<MintInput, 'name' | 'description' | 'collection' | 'udl' | 'artist' | 'album' | 'duration'> & {
		contentType?: string;
		file?: File;
	},
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
		...(input.artist?.trim() ? { artist: input.artist.trim() } : {}),
		...(input.album?.trim() ? { album: input.album.trim() } : {}),
		...(input.duration && input.duration > 0 ? { duration: input.duration } : {}),
	};
}

export function mintProcessTags(
	input: {
		name: string;
		description?: string;
		contentType: string;
		mediaId?: string;
		artworkId?: string;
		artist?: string;
		album?: string;
		duration?: number;
		createdAt?: number;
		collection?: string;
		udl?: UdlTerms;
	},
	owner: string
): Record<string, string> {
	assertAddress(owner, 'invalid-mint-owner');
	if (input.mediaId) assertAddress(input.mediaId, 'invalid-mint-media-id');
	if (input.artworkId) assertAddress(input.artworkId, 'invalid-mint-artwork-id');
	const contentType = normalizeAssetContentType(input.contentType) ?? input.contentType;
	return normalizeUploadTags({
		'content-type': contentType,
		'app-name': 'Bazar',
		'app-version': '2.0.0',
		'asset-type': contentType,
		creator: owner,
		'date-created': String(input.createdAt ?? Date.now()),
		description: input.description?.trim() ?? '',
		implements: 'ANS-110',
		title: input.name.trim(),
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
		'asset-content-type': contentType,
		...(input.artist?.trim() ? { artist: input.artist.trim() } : {}),
		...(input.album?.trim() ? { album: input.album.trim() } : {}),
		...(input.duration && input.duration > 0 ? { duration: String(input.duration) } : {}),
		...(input.mediaId ? { 'asset-data': input.mediaId } : {}),
		...(input.artworkId ? { 'asset-artwork': input.artworkId } : {}),
		...udlLicenseTags(input.udl),
	});
}

export function validateFungibleMintInput(input: FungibleMintInput): void {
	const name = input.name.trim();
	const description = input.description.trim();
	if (!name || name.length > 80) throw new TypeError('mint-name-invalid');
	if (description.length > 600) throw new TypeError('mint-description-invalid');
	if (
		typeof input.ticker !== 'string' ||
		input.ticker.length < 1 ||
		input.ticker.length > MAX_FUNGIBLE_TICKER_LENGTH ||
		input.ticker.trim() !== input.ticker ||
		/[\u0000-\u001f\u007f-\u009f]/u.test(input.ticker)
	) {
		throw new TypeError('mint-ticker-invalid');
	}
	fungibleAtomicSupply(input.wholeSupply, input.denomination);
	if (input.logo !== undefined) assertAddress(input.logo, 'mint-logo-invalid');
}

/** Convert a creator-entered whole-token count into the protocol's exact atomic integer. */
export function fungibleAtomicSupply(wholeSupply: string, denomination: string): string {
	if (typeof wholeSupply !== 'string' || !/^[1-9]\d*$/.test(wholeSupply)) {
		throw new TypeError('mint-supply-invalid');
	}
	if (
		typeof denomination !== 'string' ||
		!/^(?:0|[1-9]\d*)$/.test(denomination) ||
		Number(denomination) > MAX_FUNGIBLE_DENOMINATION
	) {
		throw new TypeError('mint-denomination-invalid');
	}
	return (BigInt(wholeSupply) * 10n ** BigInt(denomination)).toString();
}

export function validateFungibleLogo(logo: File): void {
	if (!(logo instanceof File) || !isImageContentType(normalizeAssetContentType(logo.type, logo.name) ?? undefined)) {
		throw new TypeError('mint-logo-type-unsupported');
	}
	if (!logo.size || logo.size > MAX_IMAGE_BYTES) throw new TypeError('mint-logo-size-invalid');
}

function fungibleMintData(input: FungibleMintInput): string {
	return JSON.stringify({
		name: input.name.trim(),
		ticker: input.ticker,
		description: input.description.trim(),
		collection: FUNGIBLE_TOKEN_COLLECTION_NAME,
	});
}

/**
 * Tag set for a fungible token process, mirroring
 * scripts/publish_fungible_token.mjs. The whole supply is minted to `owner`
 * via `initial-holder` — the only creation shape deployed nodes accept.
 */
export function fungibleMintProcessTags(input: FungibleMintInput, owner: string): Record<string, string> {
	validateFungibleMintInput(input);
	assertAddress(owner, 'invalid-mint-owner');
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
		'total-supply': fungibleAtomicSupply(input.wholeSupply, input.denomination),
		denomination: input.denomination,
		ticker: input.ticker,
		name: input.name.trim(),
		...(input.description.trim() ? { description: input.description.trim() } : {}),
		collection: FUNGIBLE_TOKEN_COLLECTION_NAME,
		'asset-type': 'fungible',
		...(input.logo ? { logo: input.logo } : {}),
	};
}

export function udlLicenseTags(terms?: UdlTerms): Record<string, string> {
	if (!terms) return {};
	validateUdlTerms(terms);
	const tags: Record<string, string> = { license: UDL_LICENSE_ID };
	if (terms.accessFee) tags['access-fee'] = `One-Time-${terms.accessFee}`;
	if (terms.derivation) tags.derivation = udlGrantValue(terms.derivation);
	if (terms.commercialUse) tags['commercial-use'] = udlGrantValue(terms.commercialUse);
	if (terms.dataModelTraining) tags['data-model-training'] = udlGrantValue(terms.dataModelTraining);
	if (terms.unknownUsageRights === 'excluded') tags['unknown-usage-rights'] = 'Excluded';
	if (terms.expiry) tags.expiry = terms.expiry;
	if (terms.currency && terms.currency !== 'U') tags.currency = terms.currency;
	if (terms.paymentAddress) tags['payment-address'] = terms.paymentAddress;
	if (terms.paymentMode) {
		tags['payment-mode'] = terms.paymentMode === 'random' ? 'Random-Distribution' : 'Global-Distribution';
	}
	return normalizeUploadTags(tags);
}

export function normalizeUploadTags(tags: Record<string, string>): Record<string, string> {
	const normalized: Record<string, string> = {};
	for (const [rawName, value] of Object.entries(tags)) {
		const name = rawName.trim().toLowerCase();
		if (!name) throw new TypeError('upload-tag-name-invalid');
		if (Object.prototype.hasOwnProperty.call(normalized, name)) {
			throw new TypeError(`duplicate-upload-tag-${name}`);
		}
		normalized[name] = value;
	}
	return normalized;
}

export function collectionProcessTags(name: string, manifestId: string, owner: string): Record<string, string> {
	assertAddress(manifestId, 'invalid-collection-manifest-id');
	assertAddress(owner, 'invalid-mint-owner');
	return normalizeUploadTags({
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
		name: name.trim(),
	});
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

export function isBazarMintTags(tags: Record<string, string>): boolean {
	return (
		tags['app-name'] === 'Bazar' &&
		tags.type === 'Process' &&
		tags['execution-device'] === 'token@1.0' &&
		tags['swap-device'] === 'arweave-swap@1.0' &&
		(!tags['asset-data'] || ADDRESS.test(tags['asset-data'])) &&
		isSupportedAssetContentType(tags['asset-content-type']) &&
		(!tags['asset-artwork'] || ADDRESS.test(tags['asset-artwork']))
	);
}

export function isHighMintCost(total: bigint): boolean {
	return total > ORDINARY_MINT_COST_MAX_WINSTON;
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
		(draft.artist !== undefined && (typeof draft.artist !== 'string' || draft.artist.length > 160)) ||
		(draft.album !== undefined && (typeof draft.album !== 'string' || draft.album.length > 160)) ||
		(draft.duration !== undefined && (!Number.isFinite(draft.duration) || draft.duration <= 0)) ||
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

export function collectionManifest(
	input: Pick<CollectionMintInput, 'name' | 'description'>,
	assets: Array<AssetSummary & { mediaId?: string }>
) {
	return {
		version: 2,
		name: input.name.trim(),
		description: input.description.trim() || 'A permanent Arweave collection created on Bazar.',
		kind: 'arweave-native-token-assets',
		assetCount: assets.length,
		assets: assets.map((asset) => asset.id),
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

function requiredFileContentType(file: File): string {
	const contentType = normalizeAssetContentType(file.type, file.name);
	if (!contentType) throw new TypeError('mint-file-type-unsupported');
	return contentType;
}

function assertAddress(value: string, error: string): void {
	if (!ADDRESS.test(value)) throw new TypeError(error);
}

function byteLength(value: string | Uint8Array): number {
	return typeof value === 'string' ? new TextEncoder().encode(value).byteLength : value.byteLength;
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
