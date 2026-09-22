import { signedTransactionSignerAddress } from 'api/arweave/signature';
import { httpStatusError, transportFailure } from 'api/network/errors';

import { appError, isAppError } from 'helpers/app-error';
import { isArweaveId } from 'helpers/arweave-id';

export type AssetUploadData = string | Uint8Array;
export type AssetUploadPhase = 'signing' | 'uploading';

export type AssetUploadRequest = {
	data: AssetUploadData;
	tags: Record<string, string>;
	target?: string;
};

export type AtomicAssetUploadRequest = Omit<AssetUploadRequest, 'target'>;

export type AssetUploadOptions = {
	signal?: AbortSignal;
	/** The caller already priced this item and checked an aggregate balance. */
	preflighted?: boolean;
	onPhase?: (phase: AssetUploadPhase) => void;
	onTransaction?: (transactionId: string) => void;
};

export type AssetUploadSignContext = {
	owner: string;
	signal?: AbortSignal;
};

export type ArweaveChunkUploader = {
	isComplete: boolean;
	uploadChunk(): Promise<unknown>;
};

/**
 * Runtime adapter for the Arweave transaction primitives used by the uploader.
 *
 * The browser supplies a wallet-extension signer; a CLI can supply the same
 * hooks with a JWK signer without importing any UI, File, or storage code.
 */
export type ArweaveUploadAdapter = {
	createTransaction(attributes: Record<string, unknown>): Promise<any>;
	signTransaction(transaction: any, context: AssetUploadSignContext): Promise<any>;
	ownerToAddress(owner: string): Promise<string>;
	verifyTransaction?: (transaction: any) => Promise<boolean>;
	getActiveAddress?: () => Promise<string>;
	getUploader?: (transaction: any) => Promise<ArweaveChunkUploader | undefined>;
};

export type AtomicAssetUploaderOptions = {
	adapter: ArweaveUploadAdapter;
	fetch?: typeof fetch;
	gateway: string;
	maxUploadAttempts?: number;
};

/**
 * Shared transaction publisher for every Bazar asset upload path.
 *
 * `uploadAtomicAsset` enforces the one-identifier invariant: the asset payload
 * and its token process declaration are signed and published as one item. The
 * lower-level `upload` method remains available for supporting transactions
 * such as artwork, collection manifests, and carrier updates.
 */
export class AtomicAssetUploader {
	#adapter: ArweaveUploadAdapter;
	#fetch: typeof fetch;
	#gateway: string;
	#maxUploadAttempts: number;

	constructor(options: AtomicAssetUploaderOptions) {
		this.#adapter = options.adapter;
		this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
		this.#gateway = options.gateway.replace(/\/$/, '');
		this.#maxUploadAttempts = options.maxUploadAttempts ?? 3;
		if (!Number.isSafeInteger(this.#maxUploadAttempts) || this.#maxUploadAttempts < 1) {
			throw appError('invalid-input', { message: 'upload-attempts-invalid' });
		}
	}

	get gateway(): string {
		return this.#gateway;
	}

	async price(bytes: number, signal?: AbortSignal, target?: string): Promise<bigint> {
		if (!Number.isSafeInteger(bytes) || bytes < 0) {
			throw appError('invalid-input', { message: 'upload-byte-length-invalid' });
		}
		if (target) assertAddress(target, 'invalid-upload-target');
		const response = await this.#read(
			`${this.#gateway}/price/${bytes}${target ? `/${target}` : ''}`,
			'mint-price',
			signal
		);
		if (!response.ok) throw httpStatusError('mint-price', response.status);
		const value = (await response.text()).trim();
		if (!/^\d+$/.test(value)) throw appError('invalid-response', { message: 'mint-price-invalid' });
		return BigInt(value);
	}

	async assertOwner(owner: string): Promise<void> {
		assertAddress(owner, 'invalid-mint-owner');
		if (this.#adapter.getActiveAddress && (await this.#adapter.getActiveAddress()) !== owner) {
			throw appError('mint-wallet-account-changed');
		}
	}

	async assertBalance(owner: string, required: bigint, signal?: AbortSignal): Promise<void> {
		assertAddress(owner, 'invalid-mint-owner');
		const response = await this.#read(`${this.#gateway}/wallet/${owner}/balance`, 'wallet-balance', signal);
		if (!response.ok) throw httpStatusError('wallet-balance', response.status);
		const value = (await response.text()).trim();
		if (!/^\d+$/.test(value)) throw appError('invalid-response', { message: 'wallet-balance-invalid' });
		if (BigInt(value) < required) throw appError('mint-insufficient-balance');
	}

	async uploadAtomicAsset(
		request: AtomicAssetUploadRequest,
		owner: string,
		options: AssetUploadOptions = {}
	): Promise<string> {
		assertAtomicAssetTags(request.tags);
		return this.upload(request, owner, options);
	}

	async upload(request: AssetUploadRequest, owner: string, options: AssetUploadOptions = {}): Promise<string> {
		await this.assertOwner(owner);
		if (request.target) assertAddress(request.target, 'invalid-mint-target');
		const tags = normalizeUploadTags(request.tags);
		if (!options.preflighted) {
			const reward = await this.price(byteLength(request.data), options.signal, request.target);
			await this.assertBalance(owner, reward, options.signal);
		}
		options.signal?.throwIfAborted();
		options.onPhase?.('signing');
		const transaction = await this.#adapter.createTransaction(
			request.target ? { data: request.data, target: request.target, quantity: '1' } : { data: request.data }
		);
		for (const [name, value] of Object.entries(tags)) transaction.addTag(name, value);
		const signed = await this.#adapter.signTransaction(transaction, { owner, signal: options.signal });
		if (!isArweaveId(signed?.id)) {
			throw appError('wallet-response-invalid', { message: 'wallet-returned-unsigned-transaction' });
		}
		let signerAddress: string;
		try {
			signerAddress = await signedTransactionSignerAddress(signed, {
				ownerToAddress: this.#adapter.ownerToAddress,
				verifyRsa: this.#adapter.verifyTransaction,
			});
		} catch (cause) {
			throw appError('wallet-response-invalid', { message: 'wallet-returned-invalid-signature', cause });
		}
		if (signerAddress !== owner) {
			throw appError('mint-wallet-account-changed');
		}
		options.onTransaction?.(signed.id);
		options.onPhase?.('uploading');
		try {
			await this.#post(signed, options.signal);
		} catch (cause) {
			// The signed transaction may already have reached the gateway. Report it for reconciliation rather than
			// inviting an automatic replacement.
			if (options.signal?.aborted || isAppError(cause)) throw cause;
			throw appError('unknown-outcome', {
				message: 'mint-upload-unconfirmed',
				cause,
				detail: { transactionId: signed.id },
			});
		}
		return signed.id;
	}

	async #read(url: string, operation: string, signal?: AbortSignal): Promise<Response> {
		try {
			return await this.#fetch(url, { signal });
		} catch (cause) {
			throw signal?.aborted ? cause : transportFailure(cause, operation);
		}
	}

	async #post(transaction: any, signal?: AbortSignal): Promise<void> {
		const chunks = transaction?.chunks?.chunks;
		if (Array.isArray(chunks) && chunks.length > 1 && this.#adapter.getUploader) {
			const uploader = await this.#adapter.getUploader(transaction);
			if (uploader) {
				while (!uploader.isComplete) {
					signal?.throwIfAborted();
					await uploader.uploadChunk();
				}
				return;
			}
		}

		const serializable =
			typeof transaction.toJSON === 'function' ? transaction.toJSON() : JSON.parse(JSON.stringify(transaction));
		serializable.id = transaction.id;
		for (let attempt = 1; attempt <= this.#maxUploadAttempts; attempt += 1) {
			const response = await this.#fetch(`${this.#gateway}/tx`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(serializable),
				signal,
			});
			if ([200, 202, 208].includes(response.status)) return;
			if (attempt === this.#maxUploadAttempts) {
				throw httpStatusError('mint-upload', response.status, { submission: true });
			}
			await delay(attempt * 750, signal);
		}
	}
}

export function normalizeUploadTags(tags: Record<string, string>): Record<string, string> {
	const normalized: Record<string, string> = {};
	for (const [rawName, value] of Object.entries(tags)) {
		const name = rawName.trim().toLowerCase();
		if (!name) throw appError('invalid-input', { message: 'upload-tag-name-invalid' });
		if (Object.prototype.hasOwnProperty.call(normalized, name)) {
			throw appError('invalid-input', { message: `duplicate-upload-tag-${name}` });
		}
		normalized[name] = value;
	}
	return normalized;
}

export function assertAtomicAssetTags(tags: Record<string, string>): void {
	const normalized = normalizeUploadTags(tags);
	if (
		normalized.device !== 'process@1.0' ||
		normalized.type !== 'Process' ||
		normalized['execution-device'] !== 'token@1.0' ||
		!['fungible', 'non-fungible'].includes(normalized['hint-ui-style']) ||
		!normalized['content-type']
	) {
		throw appError('invalid-input', { message: 'atomic-asset-tags-invalid' });
	}
}

function assertAddress(value: string, error: string): void {
	if (!isArweaveId(value)) throw appError('invalid-input', { message: error });
}

function byteLength(value: AssetUploadData): number {
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
