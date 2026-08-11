import { DEFAULT_COMPUTE_GATEWAY, gatewaysFromLocation, normalizeComputeGateways } from 'helpers/config';

import { aoFetch } from './ao';

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
};

export type AssetStateReadMode = 'now' | 'compute';

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
	return servingNodeOrigins(location)[0] ?? DEFAULT_COMPUTE_GATEWAY;
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

function currentServingNodes(): string[] {
	return typeof window !== 'undefined' && ['http:', 'https:'].includes(window.location.protocol)
		? servingNodeOrigins(window.location)
		: [DEFAULT_COMPUTE_GATEWAY];
}

export async function readAssetState(
	processId: string,
	options: {
		fetch?: typeof fetch;
		signal?: AbortSignal;
		provider?: string;
		maxAttempts?: number;
		maxAge?: number;
		mode?: AssetStateReadMode;
		retryBaseDelay?: number;
		onRetry?: (progress: ComputeRetryProgress) => void;
	} = {}
): Promise<ComputeResult> {
	if (!ADDRESS.test(processId)) throw new TypeError('invalid-asset-process-id');
	const nodes = options.provider ? [options.provider] : currentServingNodes();
	const provider = nodes[0];
	const fetcher = aoFetch(nodes, options.fetch);
	const state = await readState(processId, provider, fetcher, options);
	return {
		state,
		provider,
		verifiedAt: Date.now(),
		maxAge: Math.max(0, Math.floor(options.maxAge ?? 60)),
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
	const nodes = currentServingNodes();
	const provider = nodes[0];
	const fetcher = aoFetch(nodes, options.fetch);
	const state = await readState(processId, provider, fetcher, { ...options, slot });
	if (assetStateSlot(state) !== slot) throw new Error('historical-state-slot-mismatch');
	return { state, provider, verifiedAt: Date.now(), maxAge: 0 };
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
	const nodes = currentServingNodes();
	const provider = nodes[0];
	const fetcher = aoFetch(nodes, options.fetch);
	const base = provider ? `${provider}/` : '/';
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
	} = {}
): Promise<ComputeResult> {
	const nodes = options.provider ? [options.provider] : currentServingNodes();
	const provider = nodes[0];
	const fetcher = aoFetch(nodes, options.fetch);
	const startedAt = Date.now();
	const timeout = options.timeout ?? 180_000;
	let attempt = 0;

	while (Date.now() - startedAt < timeout) {
		if (options.signal?.aborted) throw options.signal.reason;
		attempt += 1;
		options.onAttempt?.(provider, attempt, 1);
		try {
			const result = await readAssetState(processId, {
				fetch: fetcher,
				signal: options.signal,
				provider: options.provider,
				maxAge: 0,
			});
			if (await accept(result.state)) return result;
		} catch (error) {
			if (options.signal?.aborted) throw error;
		}
		await delay(options.interval ?? 4000, options.signal);
	}

	throw new Error('asset-state-timeout');
}

export function parseAssetState(value: unknown): AssetState {
	const raw = unwrapState(value);
	const device = text(raw['execution-device'] ?? raw.device);
	const totalSupply = amount(raw['total-supply']);
	const denomination = raw.denomination === undefined ? 0 : integer(raw.denomination);
	const ticker = raw.ticker === undefined ? '' : safeTicker(raw.ticker);
	const balances = stringRecord(raw.balances);
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
	if (isRecord(raw.orders)) {
		for (const [id, held] of Object.entries(raw.orders)) {
			const order = parseSwapOrder(id, held);
			if (order) orders[id] = order;
		}
	}

	return {
		device,
		name: text(raw.name),
		ticker,
		denomination,
		totalSupply,
		balances,
		orders,
		swapHeight: integer(raw['swap-height']) ?? 0,
		value: raw.value ?? raw['initial-value'],
		raw,
	};
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
		mode?: AssetStateReadMode;
		retryBaseDelay?: number;
		onRetry?: (progress: ComputeRetryProgress) => void;
		slot?: number;
	}
): Promise<AssetState> {
	const base = servingNode ? `${servingNode}/` : '/';
	const maxAge = Math.max(0, Math.floor(options.maxAge ?? 60));
	const endpoint =
		options.slot !== undefined
			? `compute?slot=${options.slot}`
			: options.mode === 'compute'
			? 'compute'
			: `now&max-age=${maxAge}`;
	const separator = endpoint.includes('?') ? '&' : '?';
	const paths = [
		`${base}${processId}~process@1.0/${endpoint}${separator}require-codec=json%401.0&accept-bundle=true`,
		`${base}${processId}~process@1.0/${endpoint}${separator}require-codec=application%2Fjson&accept-bundle=true`,
	];
	const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 1));
	const retryBaseDelay = Math.max(0, options.retryBaseDelay ?? COMPUTE_RETRY_BASE_DELAY);
	let lastError: unknown;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		let rateLimited = false;
		for (const path of paths) {
			try {
				const response = await fetcher(path, {
					...(options.slot === undefined && maxAge === 0 ? { cache: 'no-store' as const } : {}),
					headers: {
						accept: 'application/json',
						'require-codec': 'application/json',
						'accept-bundle': 'true',
					},
					signal: options.signal,
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				return parseAssetState(parseLosslessJson(await response.text()));
			} catch (error) {
				lastError = error;
				rateLimited = error instanceof Error && /^HTTP 429(?:\b|$)/i.test(error.message);
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
