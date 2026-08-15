import { arweaveGatewayFromLocation } from 'helpers/config';

import { fetchJsonWithDeadline } from './fetch-with-deadline';

const DEFAULT_MAX_AGE_MS = 10_000;
const REQUEST_TIMEOUT_MS = 4_000;

type HeightCacheEntry = {
	height?: number;
	observedAt?: number;
	pending?: Promise<number>;
};

type CurrentArweaveHeightOptions = {
	fetch?: typeof fetch;
	gateway?: string;
	maxAgeMs?: number;
	signal?: AbortSignal;
};

const heights = new Map<string, HeightCacheEntry>();

/** One fresh, shared L1 height from Bazar's selected Arweave gateway. */
export async function currentArweaveHeight(options: CurrentArweaveHeightOptions = {}): Promise<number> {
	options.signal?.throwIfAborted();
	const gateway = options.gateway ?? arweaveGatewayFromLocation();
	const maxAgeMs = Math.max(0, Math.floor(options.maxAgeMs ?? DEFAULT_MAX_AGE_MS));
	const cached = heights.get(gateway);
	if (cached?.height !== undefined && Date.now() - (cached.observedAt ?? 0) <= maxAgeMs) {
		return cached.height;
	}

	let pending = cached?.pending;
	if (!pending) {
		const entry = cached ?? {};
		pending = readHeight(gateway, options.fetch ?? globalThis.fetch.bind(globalThis)).then(
			(height) => {
				entry.height = height;
				entry.observedAt = Date.now();
				delete entry.pending;
				return height;
			},
			(cause) => {
				delete entry.pending;
				throw cause;
			}
		);
		entry.pending = pending;
		heights.set(gateway, entry);
	}
	return waitForCaller(pending, options.signal);
}

async function readHeight(gateway: string, fetcher: typeof fetch): Promise<number> {
	const { response, body } = await fetchJsonWithDeadline<Record<string, unknown>>(
		fetcher,
		`${gateway}/info`,
		{ cache: 'no-store' },
		{ timeoutMs: REQUEST_TIMEOUT_MS, timeoutError: 'network-info-timeout' }
	);
	if (!response.ok) throw new Error(`network-info-${response.status}`);
	if (body?.network !== undefined && body.network !== 'arweave.N.1') throw new Error('invalid-network');
	const height = Number(body?.height ?? body?.blocks);
	if (!Number.isSafeInteger(height) || height < 0) throw new Error('invalid-network-height');
	return height;
}

function waitForCaller<Result>(promise: Promise<Result>, signal?: AbortSignal): Promise<Result> {
	if (!signal) return promise;
	if (signal.aborted) return Promise.reject(signal.reason);
	return new Promise<Result>((resolve, reject) => {
		const aborted = () => reject(signal.reason);
		signal.addEventListener('abort', aborted, { once: true });
		promise.then(
			(value) => {
				signal.removeEventListener('abort', aborted);
				resolve(value);
			},
			(cause) => {
				signal.removeEventListener('abort', aborted);
				reject(cause);
			}
		);
	});
}

export function clearArweaveHeightCache() {
	heights.clear();
}
