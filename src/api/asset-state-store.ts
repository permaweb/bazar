import { type AssetStateReadMode, type ComputeResult, readAssetState, servingNodeOrigin } from './asset-marketplace';

const DEFAULT_STATE_TTL_MS = 20_000;
const PREFETCH_CONCURRENCY = 2;

type CacheEntry = {
	expiresAt: number;
	result: ComputeResult;
};

type CachedReadOptions = {
	cacheTtlMs?: number;
	fetch?: typeof fetch;
	force?: boolean;
	maxAge?: number;
	maxAttempts?: number;
	mode?: AssetStateReadMode;
	retryBaseDelay?: number;
	signal?: AbortSignal;
	waitTimeoutMs?: number;
};

const results = new Map<string, CacheEntry>();
const requests = new Map<string, Promise<ComputeResult>>();
const queuedPrefetches: string[] = [];
const prefetchWaiters = new Map<string, Array<(result: ComputeResult | undefined) => void>>();
let activePrefetches = 0;

function cacheKey(processId: string, mode: AssetStateReadMode = 'now') {
	const provider =
		typeof window !== 'undefined' && ['http:', 'https:'].includes(window.location.protocol)
			? servingNodeOrigin(window.location)
			: '';
	return `${provider}:${mode}:${processId}`;
}

function waitForConsumer<Result>(
	promise: Promise<Result>,
	signal?: AbortSignal,
	waitTimeoutMs?: number
): Promise<Result> {
	if (!signal && waitTimeoutMs === undefined) return promise;
	if (signal?.aborted) return Promise.reject(signal.reason);

	return new Promise<Result>((resolve, reject) => {
		let settled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const finish = (settle: () => void) => {
			if (settled) return;
			settled = true;
			if (timer !== undefined) clearTimeout(timer);
			signal?.removeEventListener('abort', abort);
			settle();
		};
		const abort = () => finish(() => reject(signal?.reason));
		signal?.addEventListener('abort', abort, { once: true });
		if (waitTimeoutMs !== undefined) {
			timer = setTimeout(
				() => finish(() => reject(new Error('asset-state-read-timeout'))),
				Math.max(1, Math.floor(waitTimeoutMs))
			);
		}
		promise.then(
			(value) => finish(() => resolve(value)),
			(cause) => finish(() => reject(cause))
		);
	});
}

export function cachedAssetState(processId: string): ComputeResult | undefined {
	return results.get(cacheKey(processId))?.result;
}

export async function readAssetStateCached(processId: string, options: CachedReadOptions = {}): Promise<ComputeResult> {
	const key = cacheKey(processId, options.mode);
	const cached = results.get(key);
	if (!options.force && cached && cached.expiresAt > Date.now()) return cached.result;

	let request = requests.get(key);
	if (!request) {
		const cacheTtlMs = Math.max(0, Math.floor(options.cacheTtlMs ?? DEFAULT_STATE_TTL_MS));
		request = readAssetState(processId, {
			fetch: options.fetch,
			maxAge: options.maxAge ?? Math.ceil(cacheTtlMs / 1000),
			maxAttempts: options.maxAttempts,
			mode: options.mode,
			retryBaseDelay: options.retryBaseDelay,
		}).then((result) => {
			results.set(key, { expiresAt: Date.now() + cacheTtlMs, result });
			return result;
		});
		requests.set(key, request);
		const cleanup = () => {
			if (requests.get(key) === request) requests.delete(key);
		};
		void request.then(cleanup, cleanup);
	}

	return waitForConsumer(request, options.signal, options.waitTimeoutMs);
}

export function invalidateAssetState(processId: string) {
	results.delete(cacheKey(processId, 'now'));
	results.delete(cacheKey(processId, 'compute'));
}

function drainPrefetchQueue() {
	while (activePrefetches < PREFETCH_CONCURRENCY && queuedPrefetches.length) {
		const processId = queuedPrefetches.shift()!;
		activePrefetches += 1;
		void readAssetStateCached(processId, { cacheTtlMs: 30_000, maxAge: 30, maxAttempts: 1 })
			.then(
				(result) => prefetchWaiters.get(processId)?.forEach((resolve) => resolve(result)),
				() => prefetchWaiters.get(processId)?.forEach((resolve) => resolve(undefined))
			)
			.finally(() => {
				prefetchWaiters.delete(processId);
				activePrefetches -= 1;
				drainPrefetchQueue();
			});
	}
}

export function prefetchAssetState(processId: string) {
	const key = cacheKey(processId);
	const cached = results.get(key);
	if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.result);
	const request = requests.get(key);
	if (request) return request.catch(() => undefined);
	return new Promise<ComputeResult | undefined>((resolve) => {
		const waiters = prefetchWaiters.get(processId);
		if (waiters) {
			waiters.push(resolve);
			return;
		}
		prefetchWaiters.set(processId, [resolve]);
		queuedPrefetches.push(processId);
		drainPrefetchQueue();
	});
}

export function clearAssetStateCache() {
	results.clear();
	queuedPrefetches.splice(0);
	for (const waiters of prefetchWaiters.values()) waiters.forEach((resolve) => resolve(undefined));
	prefetchWaiters.clear();
}
