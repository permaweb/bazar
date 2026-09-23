import { operationWithDeadline } from 'api/network/deadline';

import type { AppErrorReason } from 'helpers/app-error';
import { aoRoutingScopeFromLocation } from 'helpers/config';

import { type ComputeResult, readAssetState } from './adapter';

const DEFAULT_STATE_TTL_MS = 20_000;
const MAX_STATE_ENTRIES = 256;
const PREFETCH_CONCURRENCY = 2;

export const DISPLAY_STATE_TIMEOUT_MS = 45_000;
export const DISPLAY_STATE_TIMEOUT_ERROR = 'asset-state-read-timeout' satisfies AppErrorReason;

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
	processId: string;
	controller: AbortController;
	settled: boolean;
	waiters: Array<(result: ComputeResult | undefined) => void>;
};

type CachedReadOptions = {
	cacheTtlMs?: number;
	fetch?: typeof fetch;
	force?: boolean;
	includeBalances?: boolean;
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
const activeRevalidations = new Map<AbortController, string>();
let activePrefetches = 0;

type AssetStateReadOptions = NonNullable<Parameters<typeof readAssetState>[1]>;

export function readAssetStateWithDeadline(
	processId: string,
	options: AssetStateReadOptions = {}
): Promise<ComputeResult> {
	return operationWithDeadline((signal) => readAssetState(processId, { ...options, signal }), options.signal, {
		timeoutMs: DISPLAY_STATE_TIMEOUT_MS,
		timeoutError: DISPLAY_STATE_TIMEOUT_ERROR,
		timeoutReason: DISPLAY_STATE_TIMEOUT_ERROR,
	});
}

function sharedStateOperationWithDeadline<Result>(
	operation: (signal: AbortSignal) => Promise<Result>,
	controller: AbortController
): Promise<Result> {
	return operationWithDeadline(
		(deadlineSignal) => {
			const abortRequest = () => controller.abort(deadlineSignal.reason);
			deadlineSignal.addEventListener('abort', abortRequest, { once: true });
			if (deadlineSignal.aborted) abortRequest();
			return operation(controller.signal).finally(() =>
				deadlineSignal.removeEventListener('abort', abortRequest)
			);
		},
		controller.signal,
		{
			timeoutMs: DISPLAY_STATE_TIMEOUT_MS,
			timeoutError: DISPLAY_STATE_TIMEOUT_ERROR,
			timeoutReason: DISPLAY_STATE_TIMEOUT_ERROR,
		}
	);
}

function boundRevalidation(
	result: ComputeResult,
	controller: AbortController,
	key: string,
	cacheTtlMs: number
): ComputeResult {
	if (!result.revalidation) return result;
	activeRevalidations.set(controller, key);
	const revalidation = sharedStateOperationWithDeadline(() => result.revalidation!, controller);
	void revalidation
		.then(
			(fresh) => rememberResult(key, fresh, cacheTtlMs),
			() => undefined
		)
		.finally(() => activeRevalidations.delete(controller));
	return { ...result, revalidation };
}

function rememberResult(key: string, result: ComputeResult, cacheTtlMs: number) {
	results.delete(key);
	results.set(key, { expiresAt: Date.now() + cacheTtlMs, result });
	while (results.size > MAX_STATE_ENTRIES) results.delete(results.keys().next().value!);
}

function cacheKey(processId: string, includeBalances = true) {
	const routingScope =
		typeof window !== 'undefined' && ['http:', 'https:'].includes(window.location.protocol)
			? aoRoutingScopeFromLocation(window.location)
			: '';
	return `${routingScope}:${processId}${includeBalances ? '' : ':orders'}`;
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
	const key = cacheKey(processId, options.includeBalances);
	let cached = results.get(key);
	// Full state can satisfy a market read, but market-only state must never
	// satisfy a wallet or asset-detail balance read.
	if (options.includeBalances === false && (!cached || cached.expiresAt <= Date.now())) {
		cached = results.get(cacheKey(processId));
	}
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
		const promise = sharedStateOperationWithDeadline(
			(signal) =>
				readAssetState(processId, {
					fetch: options.fetch,
					includeBalances: options.includeBalances,
					maxAge: options.maxAge ?? 60,
					maxAttempts: options.maxAttempts,
					retryBaseDelay: options.retryBaseDelay,
					signal,
					staleWhileRevalidate: options.staleWhileRevalidate,
				}),
			controller
		).then((result) => {
			controller.signal.throwIfAborted();
			const bounded = boundRevalidation(result, controller, key, cacheTtlMs);
			rememberResult(key, bounded, cacheTtlMs);
			return bounded;
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
	const keys = new Set([cacheKey(processId), cacheKey(processId, false)]);
	for (const key of keys) results.delete(key);
	for (const [controller, activeKey] of activeRevalidations) {
		if (keys.has(activeKey)) controller.abort();
	}
}

function drainPrefetchQueue() {
	while (activePrefetches < PREFETCH_CONCURRENCY && queuedPrefetches.length) {
		const key = queuedPrefetches.shift()!;
		const prefetch = prefetches.get(key);
		if (!prefetch || prefetch.settled) continue;
		if (cacheKey(prefetch.processId) !== key) {
			settlePrefetch(key, prefetch);
			continue;
		}
		activePrefetches += 1;
		const request = [...requests.entries()].find(([pendingKey]) => pendingKey.startsWith(`${key}\0`))?.[1];
		void (
			request
				? consumeSharedRequest(request, prefetch.controller.signal)
				: readAssetStateCached(prefetch.processId, {
						...DISPLAY_STATE_CACHE,
						cacheTtlMs: 30_000,
						maxAttempts: 1,
						signal: prefetch.controller.signal,
				  })
		)
			.then(
				(result) => settlePrefetch(key, prefetch, result),
				() => settlePrefetch(key, prefetch)
			)
			.finally(() => {
				activePrefetches -= 1;
				drainPrefetchQueue();
			});
	}
}

function settlePrefetch(key: string, prefetch: Prefetch, result?: ComputeResult) {
	if (prefetch.settled) return;
	prefetch.settled = true;
	if (prefetches.get(key) === prefetch) prefetches.delete(key);
	prefetch.waiters.forEach((resolve) => resolve(result));
}

export function prefetchAssetState(processId: string) {
	const key = cacheKey(processId);
	const cached = results.get(key);
	if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.result);
	return new Promise<ComputeResult | undefined>((resolve) => {
		const prefetch = prefetches.get(key);
		if (prefetch) {
			prefetch.waiters.push(resolve);
			return;
		}
		prefetches.set(key, {
			processId,
			controller: new AbortController(),
			settled: false,
			waiters: [resolve],
		});
		queuedPrefetches.push(key);
		drainPrefetchQueue();
	});
}

export function prioritizeAssetStatePrefetch(processId: string) {
	const key = cacheKey(processId);
	for (const [otherKey, prefetch] of prefetches) {
		if (otherKey === key) continue;
		prefetch.controller.abort(new DOMException('Another asset was opened', 'AbortError'));
		settlePrefetch(otherKey, prefetch);
	}
	queuedPrefetches.splice(0, queuedPrefetches.length, ...queuedPrefetches.filter((queuedKey) => queuedKey === key));
	return prefetchAssetState(processId);
}

export function clearAssetStateCache() {
	results.clear();
	for (const [key, prefetch] of prefetches) {
		prefetch.controller.abort();
		settlePrefetch(key, prefetch);
	}
	for (const request of requests.values()) request.controller.abort();
	for (const controller of activeRevalidations.keys()) controller.abort();
	requests.clear();
	activeRevalidations.clear();
	queuedPrefetches.splice(0);
}
