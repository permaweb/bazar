import { arweaveGatewayFromLocation, gatewaysFromLocation, normalizeComputeGateways } from 'helpers/config';

import { aoCacheMetadata as cacheMetadata, type AoCacheStatus, aoFetch, aoPrimaryPeer } from './ao';
import { currentArweaveHeight } from './arweave-height';

export type SwapOrderStatus = 'open' | 'reserved' | 'settled' | 'cancelled' | 'expired';

export type SwapOrder = {
	orderId: string;
	creator: string;
	recipient: string;
	asking: string;
	deposit: string;
	minimumFee: string;
	deadline: number;
	createdAt: number;
	quantity: string;
	status: SwapOrderStatus;
	buyer?: string;
	reservedUntil?: number;
	paymentTx?: string;
};

export type AssetState = {
	device: string;
	name: string;
	ticker: string;
	denomination: number;
	totalSupply: string;
	balances: Record<string, string>;
	orders: Record<string, SwapOrder>;
	swapHeight: number;
	value: unknown;
	raw: Record<string, unknown>;
};

export type ComputeResult = {
	state: AssetState;
	provider: string;
	verifiedAt?: number;
	maxAge?: number;
	cacheStatus?: AoCacheStatus;
	revalidation?: Promise<ComputeResult>;
};

export type ProcessAssignment = {
	slot: number;
	blockHeight: number;
	transactionIds: string[];
	raw: Record<string, unknown>;
};

export type ComputeRetryProgress = {
	attempt: number;
	total: number;
	delayMs: number;
};

export type LicenseProperty = {
	key: string;
	label: string;
	value: string;
};

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const UNSIGNED_INTEGER = /^(?:0|[1-9]\d*)$/;
const LIVE_ORDER = new Set<SwapOrderStatus>(['open', 'reserved']);
const ASSET_PROCESS_DEVICES = new Set(['carrier@1.0', 'name-token@1.0', 'token@1.0']);
const MAX_TOKEN_DENOMINATION = 255;
const COMPUTE_RETRY_BASE_DELAY = 1_000;
const COMPUTE_RETRY_MAX_DELAY = 8_000;
const PASSIVE_STATE_MAX_AGES = [30, 60, 120] as const;
const LINKED_STATE_TABLES = ['balances', 'orders'] as const;
const LICENSE_FIELDS = [
	['license', 'License'],
	['access', 'Access'],
	['access-fee', 'Access fee'],
	['derivation', 'Derivatives'],
	['derivation-fee', 'Derivative fee'],
	['unknown-usage-rights', 'Unknown usage rights'],
	['commercial-use', 'Commercial use'],
	['commercial-use-fee', 'Commercial fee'],
	['data-model-training', 'AI model training'],
	['expiry', 'License term'],
	['payment-mode', 'Payment mode'],
	['payment-address', 'Payment address'],
	['currency', 'Currency'],
] as const;
const UDL_LICENSE_ID = 'dE0rmDfl9_OWjkDznNEXHaSO_JohJkRolvMzaCroUdw';
const UDL_DEFAULTS = new Map<string, string>([
	['access', 'Free'],
	['derivation', 'Non-commercial only'],
	['unknown-usage-rights', 'Included where available'],
	['commercial-use', 'Not allowed'],
	['data-model-training', 'Not allowed'],
	['expiry', 'Unlimited'],
	['currency', '$U'],
]);

function isValidServingNodeHostname(hostname: string): boolean {
	const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
	if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.includes(':')) return true;

	const labels = normalized.replace(/\.$/, '').split('.');
	return labels.length >= 2 && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

export function normalizeServingNodeOrigin(value: string, defaultProtocol = 'https:'): string | null {
	return normalizeServingNodeOrigins(value, defaultProtocol)?.[0] ?? null;
}

export function normalizeServingNodeOrigins(value: string, defaultProtocol = 'https:'): string[] | null {
	const origins = normalizeComputeGateways(value, defaultProtocol);
	return origins?.every((origin) => isValidServingNodeHostname(new URL(origin).hostname)) ? origins : null;
}

export function servingNodeOrigin(location: {
	protocol: string;
	hostname: string;
	port?: string;
	search?: string;
	hash?: string;
}): string {
	return servingNodeOrigins(location)[0] ?? '';
}

export function servingNodeOrigins(location: {
	protocol: string;
	hostname: string;
	port?: string;
	search?: string;
	hash?: string;
}): string[] {
	return gatewaysFromLocation(location as Location);
}

export async function readAssetState(
	processId: string,
	options: {
		fetch?: typeof fetch;
		signal?: AbortSignal;
		provider?: string;
		maxAttempts?: number;
		maxAge?: number;
		staleWhileRevalidate?: number;
		retryBaseDelay?: number;
		onRetry?: (progress: ComputeRetryProgress) => void;
		currentHeight?: number;
		heightFetch?: typeof fetch;
		heightGateway?: string;
	} = {}
): Promise<ComputeResult> {
	if (!ADDRESS.test(processId)) throw new TypeError('invalid-asset-process-id');
	const provider = aoPrimaryPeer() || options.provider || '';
	const fetcher = aoFetch(options.fetch);
	const readReservationHeight = () =>
		options.currentHeight === undefined
			? currentArweaveHeight({
					fetch: options.heightFetch,
					gateway: options.heightGateway ?? arweaveGatewayFromLocation(),
					signal: options.signal,
			  })
			: Promise.resolve(options.currentHeight);
	const read = await readState(processId, provider, fetcher, { ...options, readReservationHeight });
	const result = {
		state: read.state,
		provider: read.provider,
		verifiedAt: Date.now() - (read.cacheAge ?? 0) * 1_000,
		maxAge: Math.max(0, Math.floor(options.maxAge ?? 60)),
		...(read.cacheStatus ? { cacheStatus: read.cacheStatus } : {}),
	};
	return {
		...result,
		...(read.revalidation
			? {
					revalidation: read.revalidation.then((fresh) => ({
						...result,
						...fresh,
						verifiedAt: Date.now(),
						cacheStatus: 'miss' as const,
					})),
			  }
			: {}),
	};
}

/** Read the immutable process state immediately after one exact schedule slot. */
export async function readAssetStateAtSlot(
	processId: string,
	slot: number,
	options: { fetch?: typeof fetch; signal?: AbortSignal } = {}
): Promise<ComputeResult> {
	if (!ADDRESS.test(processId) || !Number.isSafeInteger(slot) || slot < 0) {
		throw new TypeError('invalid-process-slot');
	}
	const provider = aoPrimaryPeer();
	const fetcher = aoFetch(options.fetch);
	const read = await readState(processId, provider, fetcher, {
		...options,
		slot,
		maxAge: 0,
	});
	if (assetStateSlot(read.state) !== slot) throw new Error('historical-state-slot-mismatch');
	return {
		state: read.state,
		provider: read.provider,
		verifiedAt: Date.now() - (read.cacheAge ?? 0) * 1_000,
		maxAge: 0,
		...(read.cacheStatus ? { cacheStatus: read.cacheStatus } : {}),
	};
}

/** Read a complete, bounded immutable window from a process's schedule. */
export async function readProcessAssignments(
	processId: string,
	fromSlot: number,
	toSlot: number,
	options: { fetch?: typeof fetch; signal?: AbortSignal } = {}
): Promise<ProcessAssignment[]> {
	if (
		!ADDRESS.test(processId) ||
		!Number.isSafeInteger(fromSlot) ||
		!Number.isSafeInteger(toSlot) ||
		fromSlot < 0 ||
		toSlot < fromSlot ||
		toSlot - fromSlot >= 100
	) {
		throw new TypeError('invalid-process-schedule-window');
	}
	const fetcher = aoFetch(options.fetch);
	const base = '/';
	const paths = [
		`${base}${processId}~process@1.0/schedule&from=${fromSlot}&to=${toSlot}/assignments?require-codec=json%401.0&accept-bundle=true`,
		`${base}${processId}~process@1.0/schedule&from=${fromSlot}&to=${toSlot}/assignments?require-codec=application%2Fjson&accept-bundle=true`,
	];
	let lastError: unknown;
	for (const path of paths) {
		try {
			const response = await fetcher(path, {
				headers: {
					accept: 'application/json',
					'require-codec': 'application/json',
					'accept-bundle': 'true',
				},
				signal: options.signal,
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return parseProcessAssignments(parseLosslessJson(await response.text()), fromSlot, toSlot);
		} catch (error) {
			lastError = error;
			if (error instanceof Error && /^HTTP 429(?:\b|$)/i.test(error.message)) break;
		}
	}
	throw lastError instanceof Error ? lastError : new Error('process-schedule-provider-failed');
}

export function assetStateSlot(state: AssetState): number | null {
	return integer(state.raw['at-slot']);
}

export async function waitForAssetState(
	processId: string,
	accept: (state: AssetState) => boolean | Promise<boolean>,
	options: {
		fetch?: typeof fetch;
		signal?: AbortSignal;
		provider?: string;
		interval?: number;
		timeout?: number;
		onAttempt?: (provider: string, attempt: number, total: number) => void;
		currentHeight?: () => number | undefined;
		heightFetch?: typeof fetch;
		heightGateway?: string;
	} = {}
): Promise<ComputeResult> {
	const provider = aoPrimaryPeer() || options.provider || '';
	const fetcher = aoFetch(options.fetch);
	const startedAt = Date.now();
	const timeout = options.timeout ?? 180_000;
	let attempt = 0;

	while (Date.now() - startedAt < timeout) {
		if (options.signal?.aborted) throw options.signal.reason;
		attempt += 1;
		options.onAttempt?.(provider, attempt, 1);
		try {
			const currentHeight = options.currentHeight?.();
			const result = await readAssetState(processId, {
				fetch: fetcher,
				signal: options.signal,
				provider: options.provider,
				maxAge: 0,
				...(currentHeight === undefined ? {} : { currentHeight }),
				heightFetch: options.heightFetch,
				heightGateway: options.heightGateway,
			});
			if (await accept(result.state)) return result;
		} catch (error) {
			if (options.signal?.aborted) throw error;
		}
		await delay(options.interval ?? 4000, options.signal);
	}

	throw new Error('asset-state-timeout');
}

export function parseAssetState(value: unknown, reservationHeight?: number): AssetState {
	const parsed = parseAssetStateValue(value);
	return reservationHeight === undefined
		? parsed.state
		: normalizeAssetStateReservations(parsed.state, reservationHeight);
}

function parseAssetStateValue(value: unknown): { state: AssetState; activeReservation: boolean } {
	const raw = unwrapState(value);
	const device = text(raw['execution-device'] ?? raw.device);
	const totalSupply = amount(raw['total-supply']);
	const denomination = raw.denomination === undefined ? 0 : integer(raw.denomination);
	const ticker = raw.ticker === undefined ? '' : safeTicker(raw.ticker);
	const balances = stringRecord(raw.balances);
	const swapHeight = integer(raw['swap-height']) ?? 0;
	if (
		!ASSET_PROCESS_DEVICES.has(device) ||
		totalSupply === null ||
		BigInt(totalSupply) < 1n ||
		denomination === null ||
		denomination > MAX_TOKEN_DENOMINATION ||
		ticker === null ||
		!balances
	) {
		throw new TypeError('invalid-asset-state');
	}

	const orders: Record<string, SwapOrder> = {};
	let activeReservation = false;
	if (isRecord(raw.orders)) {
		for (const [id, held] of Object.entries(raw.orders)) {
			const order = parseSwapOrder(id, held);
			if (!order) continue;
			const effective = orderWithoutExpiredReservation(order, swapHeight);
			orders[id] = effective;
			if (effective.status === 'reserved') activeReservation = true;
		}
	}

	return {
		activeReservation,
		state: {
			device,
			name: text(raw.name),
			ticker,
			denomination,
			totalSupply,
			balances,
			orders,
			swapHeight,
			value: raw.value ?? raw['initial-value'],
			raw,
		},
	};
}

/** A reservation remains exclusive through its absolute L1 block-height deadline. */
export function reservationIsActive(order: SwapOrder, height: number): boolean {
	return order.status === 'reserved' && order.reservedUntil !== undefined && height <= order.reservedUntil;
}

function orderWithoutExpiredReservation(order: SwapOrder, swapHeight: number): SwapOrder {
	if (order.status !== 'reserved' || reservationIsActive(order, swapHeight)) return order;
	const { buyer: _buyer, reservedUntil: _reservedUntil, ...unreserved } = order;
	return { ...unreserved, status: 'open' };
}

function normalizeAssetStateReservations(state: AssetState, height: number): AssetState {
	if (!Number.isSafeInteger(height) || height < 0) throw new TypeError('invalid-reservation-height');
	const reservationHeight = Math.max(state.swapHeight, height);
	let orders = state.orders;
	for (const [id, order] of Object.entries(state.orders)) {
		if (order.status !== 'reserved' || reservationIsActive(order, reservationHeight)) continue;
		if (orders === state.orders) orders = { ...state.orders };
		orders[id] = orderWithoutExpiredReservation(order, reservationHeight);
	}
	return orders === state.orders ? state : { ...state, orders };
}

export function parseSwapOrder(id: string, value: unknown): SwapOrder | null {
	if (!ADDRESS.test(id) || !isRecord(value)) return null;
	const orderId = text(value['order-id']);
	const creator = text(value.creator);
	const recipient = text(value.recipient);
	const asking = amount(value.asking);
	const deposit = amount(value.deposit) ?? '0';
	const minimumFee = amount(value['minimum-fee']) ?? '0';
	const deadline = integer(value.deadline);
	const createdAt = integer(value['created-at']) ?? 0;
	const quantity = amount(value.quantity);
	const status = text(value.status) as SwapOrderStatus;

	if (
		orderId !== id ||
		!ADDRESS.test(creator) ||
		!ADDRESS.test(recipient) ||
		asking === null ||
		BigInt(asking) < 1n ||
		deadline === null ||
		quantity === null ||
		BigInt(quantity) < 1n ||
		!['open', 'reserved', 'settled', 'cancelled', 'expired'].includes(status)
	) {
		return null;
	}

	const buyer = text(value.buyer);
	const reservedUntil = integer(value['reserved-until']);
	const paymentTx = text(value['payment-tx']);

	return {
		orderId,
		creator,
		recipient,
		asking,
		deposit,
		minimumFee,
		deadline,
		createdAt,
		quantity,
		status,
		...(ADDRESS.test(buyer) ? { buyer } : {}),
		...(reservedUntil === null ? {} : { reservedUntil }),
		...(ADDRESS.test(paymentTx) ? { paymentTx } : {}),
	};
}

export function ownerOfAsset(state: AssetState): string | null {
	if (state.totalSupply !== '1') return null;
	const holder = Object.entries(state.balances).find(([, balance]) => balance === '1');
	if (holder && ADDRESS.test(holder[0])) return holder[0];
	const escrowed = Object.values(state.orders).find(
		(order) => LIVE_ORDER.has(order.status) && order.quantity === '1'
	);
	return escrowed?.creator ?? null;
}

export function liveOrderOfAsset(state: AssetState): SwapOrder | null {
	return liveOrdersOfAsset(state)[0] ?? null;
}

/** Units still held directly by an address, excluding quantities in swap escrow. */
export function liquidBalanceOf(state: AssetState, address: string): string {
	return ADDRESS.test(address) ? state.balances[address] ?? '0' : '0';
}

/** Units currently held in open or reserved swap orders created by an address. */
export function listedBalanceOf(state: AssetState, address: string): string {
	if (!ADDRESS.test(address)) return '0';
	return Object.values(state.orders)
		.filter((order) => order.creator === address && LIVE_ORDER.has(order.status))
		.reduce((total, order) => total + BigInt(order.quantity), 0n)
		.toString();
}

/** All currently live orders, ordered by exact unit price and then stable age/id ties. */
export function liveOrdersOfAsset(state: AssetState): SwapOrder[] {
	return Object.values(state.orders)
		.filter((order) => LIVE_ORDER.has(order.status))
		.sort(compareOrderUnitPrice);
}

/** Open (claimable) orders in deterministic best-price order. */
export function openOrdersOfAsset(state: AssetState): SwapOrder[] {
	return Object.values(state.orders)
		.filter((order) => order.status === 'open')
		.sort(compareOrderUnitPrice);
}

export function bestAskOfAsset(state: AssetState): SwapOrder | null {
	return openOrdersOfAsset(state)[0] ?? null;
}

export type OrderUnitPrice = {
	numerator: string;
	denominator: string;
};

/** The exact price-per-unit fraction: total asking amount / offered atomic units. */
export function orderUnitPrice(order: SwapOrder): OrderUnitPrice {
	return { numerator: order.asking, denominator: order.quantity };
}

export function compareOrderUnitPrice(left: SwapOrder, right: SwapOrder): number {
	const difference = BigInt(left.asking) * BigInt(right.quantity) - BigInt(right.asking) * BigInt(left.quantity);
	if (difference !== 0n) return difference < 0n ? -1 : 1;
	if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
	return left.orderId < right.orderId ? -1 : left.orderId > right.orderId ? 1 : 0;
}

export function licenseProperties(state: AssetState): LicenseProperty[] {
	const normalized = new Map(
		Object.entries(state.raw).map(([key, value]) => [key.toLowerCase().replaceAll('_', '-'), value])
	);
	const udl = normalized.get('license') === UDL_LICENSE_ID;
	return LICENSE_FIELDS.flatMap(([key, label]) => {
		const held = normalized.get(key);
		const declared = ['string', 'number', 'boolean'].includes(typeof held);
		if (!declared && (!udl || !UDL_DEFAULTS.has(key))) return [];
		if (key === 'access' && !declared && normalized.has('access-fee')) return [];
		const raw = declared ? String(held) : '';
		const value = key === 'license' && udl ? 'Universal Data License 0.2' : raw || UDL_DEFAULTS.get(key)!;
		return [{ key, label, value }];
	});
}

async function readState(
	processId: string,
	servingNode: string,
	fetcher: typeof fetch,
	options: {
		signal?: AbortSignal;
		maxAttempts?: number;
		maxAge?: number;
		staleWhileRevalidate?: number;
		retryBaseDelay?: number;
		onRetry?: (progress: ComputeRetryProgress) => void;
		slot?: number;
		readReservationHeight?: () => Promise<number>;
	}
): Promise<{
	state: AssetState;
	provider: string;
	cacheStatus?: AoCacheStatus;
	cacheAge?: number;
	revalidation?: Promise<{ state: AssetState; provider: string }>;
}> {
	const base = '/';
	const maxAge = Math.max(0, Math.floor(options.maxAge ?? 60));
	const endpoint =
		options.slot === undefined
			? maxAge === 0
				? 'now'
				: `compute&max-age=${maxAge}`
			: `compute&slot=${options.slot}`;
	const paths = statePaths(base, processId, endpoint);
	const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 1));
	const retryBaseDelay = Math.max(0, options.retryBaseDelay ?? COMPUTE_RETRY_BASE_DELAY);
	let lastError: unknown;
	let invalidatedCurrent = false;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		let rateLimited = false;
		for (const path of paths) {
			let retryInvalidCachedResponse = true;
			const strictCurrent =
				options.slot === undefined && maxAge === 0 && options.staleWhileRevalidate === undefined;
			while (true) {
				let response: Response | undefined;
				const requestInit: RequestInit = {
					method: 'HEAD',
					signal: options.signal,
				};
				const invalidate = (
					fetcher as typeof fetch & {
						invalidate?(input: RequestInfo | URL, init?: RequestInit): Promise<void>;
					}
				).invalidate;
				try {
					if (strictCurrent && retryInvalidCachedResponse && invalidate) {
						if (!invalidatedCurrent) {
							invalidatedCurrent = true;
							await Promise.all(
								[
									...paths,
									...PASSIVE_STATE_MAX_AGES.flatMap((age) =>
										statePaths(base, processId, `compute&max-age=${age}`)
									),
								].map((candidate) => invalidate(candidate, requestInit).catch(() => undefined))
							);
						}
					}
					response = await fetcher(path, requestInit);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const state = await parseStateResponse(
						response,
						base,
						requestInit,
						fetcher,
						options.readReservationHeight
					);
					const cached = cacheMetadata(response);
					return {
						state,
						provider: responseProvider(response, cached?.origin ?? servingNode),
						...(cached ? { cacheStatus: cached.status, cacheAge: cached.age } : {}),
						...(cached?.revalidation
							? {
									revalidation: cached.revalidation.then((fresh) =>
										parseRevalidatedState(
											fresh,
											path,
											requestInit,
											fetcher,
											servingNode,
											options.readReservationHeight
										)
									),
							  }
							: {}),
					};
				} catch (error) {
					if (retryInvalidCachedResponse && response?.ok && cacheMetadata(response) && invalidate) {
						retryInvalidCachedResponse = false;
						await invalidate(path, requestInit).catch(() => undefined);
						continue;
					}
					lastError = error;
					rateLimited = error instanceof Error && /^HTTP 429(?:\b|$)/i.test(error.message);
				}
				break;
			}
			if (rateLimited) break;
		}

		if (options.signal?.aborted || attempt === maxAttempts) break;
		const delayMs = Math.min(retryBaseDelay * 2 ** (attempt - 1), COMPUTE_RETRY_MAX_DELAY);
		options.onRetry?.({ attempt: attempt + 1, total: maxAttempts, delayMs });
		await delay(delayMs, options.signal);
	}

	throw lastError instanceof Error ? lastError : new Error('compute-provider-failed');
}

function statePaths(base: string, processId: string, endpoint: string): string[] {
	return [`${base}${processId}~process@1.0/${endpoint}`];
}

async function parseStateResponse(
	response: Response,
	base: string,
	requestInit: RequestInit,
	fetcher: typeof fetch,
	readReservationHeight?: () => Promise<number>
): Promise<AssetState> {
	const raw = await responseMessage(response);
	const linked = await Promise.all(
		LINKED_STATE_TABLES.flatMap((key) => {
			if (isRecord(raw[key])) return [];
			const id = raw[`${key}+link`];
			if (id === undefined) return [];
			if (typeof id !== 'string' || !ADDRESS.test(id)) throw new TypeError('invalid-asset-state-link');
			return [readLinkedStateTable(key, id, base, requestInit, fetcher)];
		})
	);
	const parsed = parseAssetStateValue({ ...raw, ...Object.fromEntries(linked) });
	return parsed.activeReservation && readReservationHeight
		? normalizeAssetStateReservations(parsed.state, await readReservationHeight())
		: parsed.state;
}

async function readLinkedStateTable(
	key: (typeof LINKED_STATE_TABLES)[number],
	id: string,
	base: string,
	requestInit: RequestInit,
	fetcher: typeof fetch
): Promise<[string, Record<string, unknown>]> {
	const messages = new Map<string, Promise<Record<string, unknown>>>();
	const read = (messageId: string): Promise<Record<string, unknown>> => {
		if (!ADDRESS.test(messageId)) return Promise.reject(new TypeError('invalid-asset-state-link'));
		if (messages.size >= 4096 && !messages.has(messageId)) {
			return Promise.reject(new TypeError('asset-state-link-limit'));
		}
		const existing = messages.get(messageId);
		if (existing) return existing;
		const serialized = key === 'balances';
		const pending = fetcher(`${base}${messageId}${serialized ? '~message@1.0/serialize~json@1.0' : ''}`, {
			...(serialized ? {} : { method: 'HEAD' as const }),
			signal: requestInit.signal,
		}).then(async (response) => {
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			return serialized ? unwrapState(parseLosslessJson(await response.text())) : responseMessage(response);
		});
		messages.set(messageId, pending);
		return pending;
	};
	const readScalar = async (messageId: string, field: string): Promise<string> => {
		const response = await fetcher(`${base}${messageId}~message@1.0/${field}`, {
			signal: requestInit.signal,
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return response.text();
	};
	const root = await read(id);
	return [
		key,
		root.device === 'trie@1.0' ? await flattenLinkedTrie(root, read) : await linkedRecord(root, read, readScalar),
	];
}

const HTTPSIG_TRANSPORT_HEADERS = new Set([
	'accept-ranges',
	'access-control-allow-headers',
	'access-control-allow-methods',
	'access-control-allow-origin',
	'access-control-expose-headers',
	'age',
	'cache-control',
	'connection',
	'content-digest',
	'content-length',
	'date',
	'etag',
	'keep-alive',
	'location',
	'server',
	'signature',
	'signature-input',
	'transfer-encoding',
	'vary',
	'via',
]);

const TRIE_RESERVED_KEYS = new Set([
	'ao-body-key',
	'ao-types',
	'commitments',
	'content-type',
	'device',
	'hashpath',
	'node-value',
	'priv',
	'status',
]);

async function responseMessage(response: Response): Promise<Record<string, unknown>> {
	if (response.headers.get('codec-device')?.toLowerCase() === 'json@1.0') {
		return unwrapState(parseLosslessJson(await response.text()));
	}
	const message: Record<string, unknown> = {};
	response.headers.forEach((value, encodedName) => {
		const name = decodeHttpsigHeaderName(encodedName);
		if (!HTTPSIG_TRANSPORT_HEADERS.has(name)) message[name] = value;
	});
	return message;
}

function decodeHttpsigHeaderName(name: string): string {
	try {
		return decodeURIComponent(name);
	} catch {
		return name;
	}
}

async function linkedRecord(
	message: Record<string, unknown>,
	read: (id: string) => Promise<Record<string, unknown>>,
	readScalar: (id: string, field: string) => Promise<string>
): Promise<Record<string, unknown>> {
	const entries = await Promise.all(
		Object.entries(message).flatMap(([name, value]) => {
			if (ADDRESS.test(name)) return [Promise.resolve<[string, unknown]>([name, value])];
			if (!name.endsWith('+link') || typeof value !== 'string') return [];
			const key = name.slice(0, -5);
			return ADDRESS.test(key) && ADDRESS.test(value)
				? [
						read(value).then(async (child): Promise<[string, unknown]> => {
							const status = child.status;
							const decoded =
								typeof child['order-id'] === 'string' && (!status || /^\d{3}$/.test(String(status)))
									? { ...child, status: await readScalar(value, 'status') }
									: child;
							const exactKey =
								typeof decoded['order-id'] === 'string' && ADDRESS.test(decoded['order-id'])
									? decoded['order-id']
									: key;
							return [exactKey, decoded];
						}),
				  ]
				: [];
		})
	);
	return Object.fromEntries(entries);
}

async function flattenLinkedTrie(
	root: Record<string, unknown>,
	read: (id: string) => Promise<Record<string, unknown>>
): Promise<Record<string, unknown>> {
	const balances: Record<string, unknown> = {};
	const visit = async (
		node: Record<string, unknown>,
		prefix: string,
		ancestors: ReadonlySet<string>
	): Promise<void> => {
		const nodeValue = node['node-value'];
		if (nodeValue !== undefined && ADDRESS.test(prefix)) balances[prefix] = nodeValue;
		await Promise.all(
			Object.entries(node).flatMap(([rawName, value]) => {
				const linked = rawName.endsWith('+link');
				const edge = linked ? rawName.slice(0, -5) : rawName;
				if (TRIE_RESERVED_KEYS.has(edge) || !/^[A-Za-z0-9_-]+$/.test(edge)) return [];
				const owner = `${prefix}${edge}`;
				if (!linked) {
					if (ADDRESS.test(owner)) balances[owner] = value;
					return [];
				}
				if (typeof value !== 'string' || !ADDRESS.test(value) || ancestors.has(value)) {
					throw new TypeError('invalid-asset-state-trie');
				}
				return [read(value).then((child) => visit(child, owner, new Set([...ancestors, value])))];
			})
		);
	};
	await visit(root, '', new Set());
	return balances;
}

async function parseRevalidatedState(
	response: Response,
	path: string,
	requestInit: RequestInit,
	fetcher: typeof fetch,
	servingNode: string,
	readReservationHeight?: () => Promise<number>,
	retry = true
): Promise<{ state: AssetState; provider: string }> {
	try {
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return {
			state: await parseStateResponse(
				response,
				servingNode ? `${servingNode}/` : '/',
				requestInit,
				fetcher,
				readReservationHeight
			),
			provider: responseProvider(response, cacheMetadata(response)?.origin ?? servingNode),
		};
	} catch (error) {
		const invalidate = (
			fetcher as typeof fetch & {
				invalidate?(input: RequestInfo | URL, init?: RequestInit): Promise<void>;
			}
		).invalidate;
		if (!retry || !response.ok || !invalidate) throw error;
		await invalidate(path, requestInit).catch(() => undefined);
		const replacement = await fetcher(path, { ...requestInit, cache: 'reload', signal: undefined });
		return parseRevalidatedState(
			replacement,
			path,
			requestInit,
			fetcher,
			servingNode,
			readReservationHeight,
			false
		);
	}
}

function responseProvider(response: Response, fallback: string): string {
	try {
		return response.url ? new URL(response.url).origin : fallback;
	} catch {
		return fallback;
	}
}

function parseProcessAssignments(value: unknown, fromSlot: number, toSlot: number): ProcessAssignment[] {
	if (!isRecord(value)) throw new TypeError('invalid-process-schedule');
	const assignments: ProcessAssignment[] = [];
	for (let slot = fromSlot; slot <= toSlot; slot += 1) {
		const raw = value[String(slot)];
		if (!isRecord(raw) || integer(raw.slot) !== slot || !isRecord(raw.body)) {
			throw new TypeError('incomplete-process-schedule');
		}
		const blockHeight = integer(raw['block-height']);
		const commitments = isRecord(raw.body.commitments) ? raw.body.commitments : {};
		const transactionIds = Object.entries(commitments).flatMap(([id, commitment]) =>
			ADDRESS.test(id) && isRecord(commitment) && commitment['commitment-device'] === 'tx@1.0' ? [id] : []
		);
		if (blockHeight === null || !transactionIds.length) {
			throw new TypeError('invalid-process-assignment');
		}
		assignments.push({ slot, blockHeight, transactionIds, raw });
	}
	return assignments;
}

function unwrapState(value: unknown): Record<string, unknown> {
	let held = value;
	for (let depth = 0; depth < 3; depth += 1) {
		if (typeof held === 'string') {
			held = parseLosslessJson(held);
			continue;
		}
		if (isRecord(held) && Object.keys(held).length <= 4 && 'body' in held) {
			held = held.body;
			continue;
		}
		break;
	}
	if (!isRecord(held)) throw new TypeError('invalid-asset-state');
	return held;
}

/** Preserve integer lexemes that JSON.parse cannot represent exactly. */
function parseLosslessJson(source: string): unknown {
	let normalized = '';
	let inString = false;
	let escaped = false;
	for (let index = 0; index < source.length; ) {
		const character = source[index];
		if (inString) {
			normalized += character;
			index += 1;
			if (escaped) escaped = false;
			else if (character === '\\') escaped = true;
			else if (character === '"') inString = false;
			continue;
		}
		if (character === '"') {
			inString = true;
			normalized += character;
			index += 1;
			continue;
		}
		if (character === '-' || (character >= '0' && character <= '9')) {
			const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(index))?.[0];
			if (number) {
				normalized += /^-?\d+$/.test(number) && !Number.isSafeInteger(Number(number)) ? `"${number}"` : number;
				index += number.length;
				continue;
			}
		}
		normalized += character;
		index += 1;
	}
	return JSON.parse(normalized);
}

function stringRecord(value: unknown): Record<string, string> | null {
	if (!isRecord(value)) return null;
	const result: Record<string, string> = {};
	for (const [key, held] of Object.entries(value)) {
		const parsed = amount(held);
		if (parsed !== null) result[key] = parsed;
	}
	return result;
}

function amount(value: unknown): string | null {
	if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
		return String(value);
	}
	if (typeof value !== 'string' || !UNSIGNED_INTEGER.test(value)) return null;
	return value;
}

function integer(value: unknown): number | null {
	const held = amount(value);
	if (held === null) return null;
	const parsed = Number(held);
	return Number.isSafeInteger(parsed) ? parsed : null;
}

function safeTicker(value: unknown): string | null {
	if (typeof value !== 'string' || value.length < 1 || value.length > 32) return null;
	return /[\u0000-\u001f\u007f-\u009f]/u.test(value) || value.trim() !== value ? null : value;
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function delay(duration: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const cleanup = () => signal?.removeEventListener('abort', abort);
		const abort = () => {
			if (timer) clearTimeout(timer);
			cleanup();
			reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
		};
		if (signal?.aborted) {
			abort();
			return;
		}
		signal?.addEventListener('abort', abort, { once: true });
		timer = setTimeout(() => {
			cleanup();
			resolve();
		}, duration);
	});
}
