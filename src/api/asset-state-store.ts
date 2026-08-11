import { type ComputeResult, readAssetState, servingNodeOrigins } from './asset-marketplace';

const DEFAULT_STATE_TTL_MS = 20_000;
const MAX_STATE_ENTRIES = 256;
const PREFETCH_CONCURRENCY = 2;

export const DISPLAY_STATE_CACHE = {
	maxAge: 30,
	staleWhileRevalidate: 86_400,
} as const;

type CacheEntry = {
	expiresAt: number;
	result: ComputeResult;
};

type SharedRequest = {
	controller: AbortController;
	consumers: number;
	promise: Promise<ComputeResult>;
	settled: boolean;
};

type Prefetch = {
	controller: AbortController;
	settled: boolean;
	waiters: Array<(result: ComputeResult | undefined) => void>;
};

type CachedReadOptions = {
	cacheTtlMs?: number;
	fetch?: typeof fetch;
	force?: boolean;
	maxAge?: number;
	maxAttempts?: number;
	onRevalidated?: (result: ComputeResult) => void;
	retryBaseDelay?: number;
	signal?: AbortSignal;
	staleWhileRevalidate?: number;
};

const results = new Map<string, CacheEntry>();
const requests = new Map<string, SharedRequest>();
const queuedPrefetches: string[] = [];
const prefetches = new Map<string, Prefetch>();
let activePrefetches = 0;

function rememberResult(key: string, result: ComputeResult, cacheTtlMs: number) {
	results.delete(key);
	results.set(key, { expiresAt: Date.now() + cacheTtlMs, result });
	while (results.size > MAX_STATE_ENTRIES) results.delete(results.keys().next().value!);
}

function cacheKey(processId: string) {
	const provider =
		typeof window !== 'undefined' && ['http:', 'https:'].includes(window.location.protocol)
			? servingNodeOrigins(window.location).join(',')
			: '';
	return `${provider}:${processId}`;
}

function requestKey(key: string, options: CachedReadOptions) {
	return [key, options.force ? 'force' : 'reuse', options.maxAge ?? '', options.staleWhileRevalidate ?? ''].join(
		'\0'
	);
}

function waitForConsumer<Result>(promise: Promise<Result>, signal?: AbortSignal): Promise<Result> {
	if (!signal) return promise;
	if (signal.aborted) return Promise.reject(signal.reason);

	return new Promise<Result>((resolve, reject) => {
		const abort = () => reject(signal.reason);
		signal.addEventListener('abort', abort, { once: true });
		promise.then(
			(value) => {
				signal.removeEventListener('abort', abort);
				resolve(value);
			},
			(cause) => {
				signal.removeEventListener('abort', abort);
				reject(cause);
			}
		);
	});
}

async function consumeSharedRequest(request: SharedRequest, signal?: AbortSignal) {
	request.consumers += 1;
	try {
		return await waitForConsumer(request.promise, signal);
	} finally {
		request.consumers -= 1;
		if (!request.settled && request.consumers === 0) request.controller.abort(signal?.reason);
	}
}

export function cachedAssetState(processId: string): ComputeResult | undefined {
	const key = cacheKey(processId);
	const cached = results.get(key);
	if (cached) {
		results.delete(key);
		results.set(key, cached);
	}
	return cached?.result;
}

export async function readAssetStateCached(processId: string, options: CachedReadOptions = {}): Promise<ComputeResult> {
	options.signal?.throwIfAborted();
	const key = cacheKey(processId);
	const cached = results.get(key);
	if (!options.force && cached && cached.expiresAt > Date.now()) {
		results.delete(key);
		results.set(key, cached);
		return observeRevalidation(cached.result, options);
	}

	const pendingKey = requestKey(key, options);
	let request = requests.get(pendingKey);
	if (!request) {
		const cacheTtlMs = Math.max(0, Math.floor(options.cacheTtlMs ?? DEFAULT_STATE_TTL_MS));
		const controller = new AbortController();
		const promise = readAssetState(processId, {
			fetch: options.fetch,
			maxAge: options.maxAge ?? Math.ceil(cacheTtlMs / 1000),
			maxAttempts: options.maxAttempts,
			retryBaseDelay: options.retryBaseDelay,
			signal: controller.signal,
			staleWhileRevalidate: options.staleWhileRevalidate,
		}).then((result) => {
			rememberResult(key, result, cacheTtlMs);
			if (result.revalidation) {
				void result.revalidation.then(
					(fresh) => rememberResult(key, fresh, cacheTtlMs),
					() => undefined
				);
			}
			return result;
		});
		const shared = { controller, consumers: 0, promise, settled: false };
		request = shared;
		requests.set(pendingKey, shared);
		const cleanup = () => {
			if (requests.get(pendingKey) === shared) requests.delete(pendingKey);
			shared.settled = true;
		};
		void promise.then(cleanup, cleanup);
	}

	return observeRevalidation(await consumeSharedRequest(request, options.signal), options);
}

function observeRevalidation(result: ComputeResult, options: CachedReadOptions) {
	if (result.revalidation && options.onRevalidated) {
		void result.revalidation.then(options.onRevalidated, () => undefined);
	}
	return result;
}

export function invalidateAssetState(processId: string) {
	results.delete(cacheKey(processId));
}

function drainPrefetchQueue() {
	while (activePrefetches < PREFETCH_CONCURRENCY && queuedPrefetches.length) {
		const processId = queuedPrefetches.shift()!;
		const prefetch = prefetches.get(processId);
		if (!prefetch || prefetch.settled) continue;
		activePrefetches += 1;
		const key = cacheKey(processId);
		const request = [...requests.entries()].find(([pendingKey]) => pendingKey.startsWith(`${key}\0`))?.[1];
		void (
			request
				? consumeSharedRequest(request, prefetch.controller.signal)
				: readAssetStateCached(processId, {
						...DISPLAY_STATE_CACHE,
						cacheTtlMs: 30_000,
						maxAttempts: 1,
						signal: prefetch.controller.signal,
				  })
		)
			.then(
				(result) => settlePrefetch(processId, prefetch, result),
				() => settlePrefetch(processId, prefetch)
			)
			.finally(() => {
				activePrefetches -= 1;
				drainPrefetchQueue();
			});
	}
}

function settlePrefetch(processId: string, prefetch: Prefetch, result?: ComputeResult) {
	if (prefetch.settled) return;
	prefetch.settled = true;
	if (prefetches.get(processId) === prefetch) prefetches.delete(processId);
	prefetch.waiters.forEach((resolve) => resolve(result));
}

export function prefetchAssetState(processId: string) {
	const key = cacheKey(processId);
	const cached = results.get(key);
	if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.result);
	return new Promise<ComputeResult | undefined>((resolve) => {
		const prefetch = prefetches.get(processId);
		if (prefetch) {
			prefetch.waiters.push(resolve);
			return;
		}
		prefetches.set(processId, {
			controller: new AbortController(),
			settled: false,
			waiters: [resolve],
		});
		queuedPrefetches.push(processId);
		drainPrefetchQueue();
	});
}

export function prioritizeAssetStatePrefetch(processId: string) {
	for (const [otherId, prefetch] of prefetches) {
		if (otherId === processId) continue;
		prefetch.controller.abort(new DOMException('Another asset was opened', 'AbortError'));
		settlePrefetch(otherId, prefetch);
	}
	queuedPrefetches.splice(
		0,
		queuedPrefetches.length,
		...queuedPrefetches.filter((queuedId) => queuedId === processId)
	);
	return prefetchAssetState(processId);
}

export function clearAssetStateCache() {
	results.clear();
	for (const [processId, prefetch] of prefetches) {
		prefetch.controller.abort();
		settlePrefetch(processId, prefetch);
	}
	for (const request of requests.values()) request.controller.abort();
	requests.clear();
	queuedPrefetches.splice(0);
}
