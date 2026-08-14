import { createArweaveClient } from 'helpers/arweave';
import { arweaveClientConfig, arweaveDataUrl, arweaveGatewayFromLocation } from 'helpers/config';

import { type AssetUploadData, type AssetUploadOptions } from './asset-uploader';

const ARWEAVE_ID = /^[A-Za-z0-9_-]{43}$/;
export const ACCOUNT_PROFILE_PROTOCOL = 'Account-0.3';
export const PROFILE_AVATAR_CONTENT_TYPES: ReadonlyArray<string> = [
	'image/gif',
	'image/jpeg',
	'image/png',
	'image/webp',
];
export const PROFILE_AVATAR_MAX_BYTES = 10 * 1024 * 1024;

export type AccountProfile = {
	address: string;
	transactionId: string;
	handle: string;
	name: string;
	bio: string;
	avatar: string;
};

export type ProfileReadOptions = {
	fetch?: typeof fetch;
	gateway?: string;
	signal?: AbortSignal;
};

export type ProfileClientOptions = {
	wallet?: Window['arweaveWallet'];
	fetch?: typeof fetch;
	arweave?: any;
	publish?: (
		data: AssetUploadData,
		tags: ReadonlyArray<{ name: string; value: string }>,
		owner: string,
		options: AssetUploadOptions
	) => Promise<string>;
	gateway?: string;
};

export type ProfileUpdate = {
	displayName?: string;
	avatar?: string;
};

const cached = new Map<string, AccountProfile | null>();
const inflight = new Map<string, Promise<AccountProfile | null>>();
const profileQueue: Array<() => void> = [];
let activeProfileReads = 0;

export function profileDisplayName(profile: AccountProfile | null | undefined): string | undefined {
	return profile?.handle || profile?.name || undefined;
}

export function profileAvatarUrl(profile: AccountProfile | null | undefined, gateway = arweaveGatewayFromLocation()) {
	if (!profile?.avatar) return undefined;
	if (!profile.avatar.startsWith('ar://')) return profile.avatar;
	const id = profile.avatar.slice(5);
	return ARWEAVE_ID.test(id) ? arweaveDataUrl(id, gateway) : undefined;
}

export async function readAccountProfile(
	address: string,
	options: ProfileReadOptions = {}
): Promise<AccountProfile | null> {
	assertId(address, 'invalid-profile-address');
	if (cached.has(address)) return aborted(options.signal, Promise.resolve(cached.get(address) ?? null));
	const pending = inflight.get(address);
	if (pending) return aborted(options.signal, pending);
	const request = limitedProfileRead(() => fetchAccountProfile(address, { ...options, signal: undefined })).then(
		(profile) => {
			cached.set(address, profile);
			return profile;
		}
	);
	inflight.set(address, request);
	try {
		return await aborted(options.signal, request);
	} finally {
		inflight.delete(address);
	}
}

function limitedProfileRead<T>(read: () => Promise<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		const start = () => {
			activeProfileReads += 1;
			void read()
				.then(resolve, reject)
				.finally(() => {
					activeProfileReads -= 1;
					profileQueue.shift()?.();
				});
		};
		if (activeProfileReads < 6) start();
		else profileQueue.push(start);
	});
}

function aborted<T>(signal: AbortSignal | undefined, promise: Promise<T>): Promise<T> {
	if (!signal) return promise;
	if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
	return new Promise((resolve, reject) => {
		const abort = () => reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
		signal.addEventListener('abort', abort, { once: true });
		promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
	});
}

export async function readAccountProfiles(
	addresses: readonly string[],
	options: ProfileReadOptions & { concurrency?: number } = {}
): Promise<ReadonlyMap<string, AccountProfile | null>> {
	const unique = [...new Set(addresses)];
	const results = new Map<string, AccountProfile | null>();
	let cursor = 0;
	const concurrency = Math.max(1, Math.min(options.concurrency ?? 6, unique.length));
	await Promise.all(
		Array.from({ length: concurrency }, async () => {
			while (cursor < unique.length) {
				const address = unique[cursor++];
				results.set(address, await readAccountProfile(address, options));
			}
		})
	);
	return results;
}

export class ProfileClient {
	#fetch: typeof fetch;
	#gateway: string;
	#publish: NonNullable<ProfileClientOptions['publish']>;

	constructor(options: ProfileClientOptions = {}) {
		this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
		this.#gateway = options.gateway ?? arweaveGatewayFromLocation();
		if (options.publish) {
			this.#publish = options.publish;
			return;
		}
		const wallet = options.wallet ?? globalThis.window?.arweaveWallet;
		let arweave = options.arweave;
		const getArweave = async () => {
			arweave ??= await createArweaveClient(arweaveClientConfig(this.#gateway));
			return arweave;
		};
		this.#publish = async (data, tags, owner, uploadOptions) => {
			if (!wallet?.sign) throw new Error('wallet-sign-unavailable');
			if (wallet.getActiveAddress && (await wallet.getActiveAddress()) !== owner) {
				throw new Error('wallet-account-changed');
			}
			uploadOptions.signal?.throwIfAborted();
			uploadOptions.onPhase?.('signing');
			const arweaveClient = await getArweave();
			const transaction = await arweaveClient.createTransaction({ data }, 'use_wallet');
			for (const tag of tags) transaction.addTag(tag.name, tag.value);
			const walletResult = (await wallet.sign(transaction)) ?? transaction;
			if (walletResult !== transaction && typeof transaction.setSignature === 'function') {
				transaction.setSignature({
					id: walletResult.id,
					owner: walletResult.owner,
					reward: walletResult.reward,
					tags: walletResult.tags,
					signature: walletResult.signature,
				});
			}
			if (!ARWEAVE_ID.test(transaction.id)) throw new Error('wallet-returned-unsigned-transaction');
			if ((await arweaveClient.wallets.ownerToAddress(transaction.owner)) !== owner) {
				throw new Error('wallet-account-changed');
			}
			uploadOptions.onTransaction?.(transaction.id);
			uploadOptions.onPhase?.('uploading');
			const serializable =
				typeof transaction.toJSON === 'function'
					? transaction.toJSON()
					: JSON.parse(JSON.stringify(transaction));
			serializable.id = transaction.id;
			const response = await this.#fetch(`${this.#gateway}/tx`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(serializable),
				signal: uploadOptions.signal,
			});
			if (![200, 202, 208].includes(response.status)) throw new Error(`profile-upload-${response.status}`);
			return transaction.id;
		};
	}

	read(address: string, signal?: AbortSignal) {
		return readAccountProfile(address, { fetch: this.#fetch, gateway: this.#gateway, signal });
	}

	async uploadAvatar(
		owner: string,
		data: Uint8Array,
		contentType: string,
		options: AssetUploadOptions = {}
	): Promise<string> {
		assertId(owner, 'invalid-profile-address');
		if (!PROFILE_AVATAR_CONTENT_TYPES.includes(contentType)) {
			throw new TypeError('invalid-profile-avatar-type');
		}
		if (!data.byteLength || data.byteLength > PROFILE_AVATAR_MAX_BYTES) {
			throw new TypeError('invalid-profile-avatar-size');
		}
		return this.#publish(
			data,
			[
				{ name: 'Content-Type', value: contentType },
				{ name: 'App-Name', value: 'Bazar' },
				{ name: 'Type', value: 'Profile-Avatar' },
			],
			owner,
			options
		);
	}

	async update(owner: string, update: ProfileUpdate, options: AssetUploadOptions = {}): Promise<AccountProfile> {
		assertId(owner, 'invalid-profile-address');
		if (update.displayName === undefined && update.avatar === undefined) {
			throw new TypeError('empty-profile-update');
		}
		const existing = await limitedProfileRead(() =>
			fetchAccountProfile(owner, {
				fetch: this.#fetch,
				gateway: this.#gateway,
				signal: options.signal,
			})
		);
		const displayName = update.displayName?.trim();
		const avatar = update.avatar?.trim();
		const body = {
			handle: displayName ?? existing?.handle ?? '',
			name: existing?.name ?? '',
			bio: existing?.bio ?? '',
			avatar: avatar === undefined ? existing?.avatar ?? '' : avatar ? normalizeAvatar(avatar) : '',
		};
		const transactionId = await this.#publish(
			JSON.stringify(body),
			[
				{ name: 'Content-Type', value: 'application/json' },
				{ name: 'Protocol-Name', value: ACCOUNT_PROFILE_PROTOCOL },
				{ name: 'App-Name', value: 'Bazar' },
				{ name: 'handle', value: body.handle },
			],
			owner,
			options
		);
		const profile = { address: owner, transactionId, ...body };
		cached.set(owner, profile);
		return profile;
	}

	async setAvatar(owner: string, avatar: string, options: AssetUploadOptions = {}): Promise<AccountProfile> {
		assertId(owner, 'invalid-profile-address');
		const avatarUrl = normalizeAvatar(avatar);
		const existing = await limitedProfileRead(() =>
			fetchAccountProfile(owner, {
				fetch: this.#fetch,
				gateway: this.#gateway,
				signal: options.signal,
			})
		);
		const body = {
			handle: existing?.handle ?? '',
			name: existing?.name ?? '',
			bio: existing?.bio ?? '',
			avatar: avatarUrl,
		};
		const transactionId = await this.#publish(
			JSON.stringify(body),
			[
				{ name: 'Content-Type', value: 'application/json' },
				{ name: 'Protocol-Name', value: ACCOUNT_PROFILE_PROTOCOL },
				{ name: 'App-Name', value: 'Bazar' },
				{ name: 'handle', value: body.handle },
			],
			owner,
			options
		);
		const profile = { address: owner, transactionId, ...body };
		cached.set(owner, profile);
		return profile;
	}
}

function normalizeAvatar(value: string): string {
	if (ARWEAVE_ID.test(value)) return `ar://${value}`;
	if (value.startsWith('ar://') && ARWEAVE_ID.test(value.slice(5))) return value;
	try {
		const url = new URL(value);
		if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
	} catch {
		// Invalid values fail closed below.
	}
	throw new TypeError('invalid-profile-avatar');
}

async function fetchAccountProfile(address: string, options: ProfileReadOptions): Promise<AccountProfile | null> {
	const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
	const gateway = options.gateway ?? arweaveGatewayFromLocation();
	const response = await fetcher(`${gateway}/graphql`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			query: `query LatestAccountProfile($owners: [String!]) {
				transactions(owners: $owners, tags: [{ name: "Protocol-Name", values: ["Account-0.3"] }], sort: HEIGHT_DESC, first: 1) {
					edges { node { id } }
				}
			}`,
			variables: { owners: [address] },
		}),
		signal: options.signal,
	});
	if (!response.ok) throw new Error(`profile-index-${response.status}`);
	const payload = await response.json();
	const transactionId = payload?.data?.transactions?.edges?.[0]?.node?.id;
	if (!transactionId) return null;
	assertId(transactionId, 'invalid-profile-transaction');
	const data = await fetcher(arweaveDataUrl(transactionId, gateway), { signal: options.signal });
	if (!data.ok) throw new Error(`profile-data-${data.status}`);
	const body = await data.json();
	return {
		address,
		transactionId,
		handle: stringField(body?.handle),
		name: stringField(body?.name),
		bio: stringField(body?.bio),
		avatar: stringField(body?.avatar),
	};
}

function stringField(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function assertId(value: string, error: string): void {
	if (!ARWEAVE_ID.test(value)) throw new TypeError(error);
}
