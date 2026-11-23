import { arweaveGraphqlEndpoints } from 'helpers/config';

import { fetchJsonWithDeadline } from './fetch-with-deadline';

const ARWEAVE_NET_ID_BATCH_SIZE = 9;

export type GraphqlResult<T> = {
	response: Response;
	body: T | undefined;
	endpoint: string;
	/** When no endpoint answered usably: the longest Retry-After any of them sent (capped, in ms). */
	retryAfterMs?: number;
};

/** The longest Retry-After sent by the endpoints behind a thrown postGraphql failure. */
const failureRetryAfterMs = new WeakMap<object, number>();

type GraphqlRequestOptions = {
	/** Deadline for each endpoint attempt; a fallback attempt starts only after the previous one ended. */
	timeoutMs?: number;
	timeoutError: string;
};

type Outcome<T> = { ok: true; value: GraphqlResult<T> } | { ok: false; error: unknown };

/** An explicit endpoint pins the request; otherwise the configured list is tried in preference order. */
export function graphqlEndpointList(graphql?: string | readonly string[]): string[] {
	if (typeof graphql === 'string') return [graphql];
	const endpoints = [...new Set(graphql?.length ? graphql : arweaveGraphqlEndpoints())];
	return endpoints.length ? endpoints : arweaveGraphqlEndpoints();
}

function isArweaveNetEndpoint(endpoint: string): boolean {
	try {
		const host = new URL(endpoint).hostname;
		return host === 'arweave.net' || host.endsWith('.arweave.net');
	} catch {
		return false;
	}
}

/**
 * Only arweave.net's index answers the TransactionConnection `count` extension.
 * AR.IO gateway GraphQL (for example ardrive.net) rejects the whole query with
 * 400 GRAPHQL_VALIDATION_FAILED when it is selected.
 */
export function graphqlSupportsCount(endpoint: string): boolean {
	return isArweaveNetEndpoint(endpoint);
}

/** arweave.net truncates `ids` filters beyond nine; a batch that may fall back must fit every endpoint. */
export function graphqlIdBatchSize(endpoints: readonly string[], generic = 100): number {
	return endpoints.some(isArweaveNetEndpoint) ? Math.min(generic, ARWEAVE_NET_ID_BATCH_SIZE) : generic;
}

/** A 2xx JSON GraphQL answer with data and no errors; anything else lets the next endpoint try. */
export function usableGraphqlPayload(result: Pick<GraphqlResult<unknown>, 'response' | 'body'>): boolean {
	const body = result.body as { data?: unknown; errors?: unknown } | undefined;
	return Boolean(
		result.response.ok &&
			body &&
			typeof body === 'object' &&
			body.data &&
			typeof body.data === 'object' &&
			!(Array.isArray(body.errors) && body.errors.length)
	);
}

/**
 * POST one read query to an ordered endpoint list, one endpoint at a time.
 *
 * The indexes do not hold the same data (ardrive.net lacks Bazar collections,
 * activity events and Account-0.3 profiles that arweave.net returns), so a
 * later endpoint is a failure fallback, never a faster substitute: it is tried
 * only after the previous one failed (network error, its deadline, a non-2xx
 * status, a non-JSON body, or a GraphQL answer without data or with errors).
 * A slow but usable preferred answer always wins.
 *
 * `timeoutMs` bounds each attempt, so the preferred endpoint keeps exactly the
 * deadline it had on its own and the whole call lasts at most `timeoutMs` per
 * endpoint attempted. A caller abort stops at once without trying the rest.
 * When no endpoint answers usably, the preferred endpoint's own outcome is
 * returned (or thrown) so callers keep their existing status and error handling;
 * the longest Retry-After any endpoint sent travels with it, so a retry waits for
 * a rate-limited fallback even when the preferred endpoint only timed out.
 *
 * Cursors are index-specific (arweave.net and AR.IO gateways encode them
 * differently), so pass the answering `endpoint` back as the only endpoint for
 * any follow-up page.
 */
export async function postGraphql<T = unknown>(
	fetcher: typeof fetch,
	endpoints: readonly string[],
	init: RequestInit | ((endpoint: string) => RequestInit),
	options: GraphqlRequestOptions
): Promise<GraphqlResult<T>> {
	const list = [...new Set(endpoints)];
	if (!list.length) throw new TypeError('graphql-endpoints-empty');
	const requestFor = typeof init === 'function' ? init : () => init;
	const deadline = { timeoutMs: options.timeoutMs, timeoutError: options.timeoutError };
	let preferred: Outcome<T> | undefined;
	let retryAfter: number | undefined;
	for (const endpoint of list) {
		const request = requestFor(endpoint);
		request.signal?.throwIfAborted();
		let outcome: Outcome<T>;
		try {
			const result = await fetchJsonWithDeadline<T>(fetcher, endpoint, request, deadline);
			const value = { ...result, endpoint };
			if (list.length === 1 || usableGraphqlPayload(result)) return value;
			const wait = retryAfterMs(result.response);
			if (wait !== undefined) retryAfter = Math.max(retryAfter ?? 0, wait);
			outcome = { ok: true, value };
		} catch (error) {
			if (request.signal?.aborted || list.length === 1) throw error;
			outcome = { ok: false, error };
		}
		preferred ??= outcome;
	}
	if (preferred!.ok)
		return retryAfter === undefined ? preferred!.value : { ...preferred!.value, retryAfterMs: retryAfter };
	const failure = preferred!.error;
	if (retryAfter !== undefined && failure && typeof failure === 'object')
		failureRetryAfterMs.set(failure, retryAfter);
	throw failure;
}

/** Delays before each retry of a transient index failure. */
export const GRAPHQL_RETRY_DELAYS_MS: readonly number[] = [1_000, 3_000];
const GRAPHQL_RETRY_AFTER_MAX_MS = 10_000;

/**
 * Run one index request, retrying it after `retryDelaysMs` while it fails transiently: a network
 * error or deadline, a 429 (waiting for its Retry-After, capped at 10 s, or the longest one a
 * postGraphql fallback endpoint sent) or a 5xx. Any other answer
 * is returned as is. Once the retries are spent, the last answer is returned or its error thrown,
 * so callers keep their status and error handling. A caller abort stops at once.
 */
export async function retryTransientGraphql<R extends { response: Response; retryAfterMs?: number }>(
	request: () => Promise<R>,
	retryDelaysMs: readonly number[],
	signal?: AbortSignal
): Promise<R> {
	for (let attempt = 0; ; attempt += 1) {
		let result: R | undefined;
		let failure: unknown;
		try {
			result = await request();
		} catch (error) {
			throwIfAborted(signal);
			failure = error;
		}
		const status = result?.response.status ?? 0;
		const transient = !result || status === 429 || status >= 500;
		if (!transient || attempt >= retryDelaysMs.length) {
			if (result) return result;
			throw failure;
		}
		const sentRetryAfter = result
			? result.retryAfterMs ?? retryAfterMs(result.response)
			: failure && typeof failure === 'object'
			? failureRetryAfterMs.get(failure)
			: undefined;
		await waitBeforeRetry(sentRetryAfter ?? retryDelaysMs[attempt], signal);
	}
}

function retryAfterMs(response: Response | undefined): number | undefined {
	const seconds = Number(response?.headers.get('retry-after') ?? NaN);
	return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1_000, GRAPHQL_RETRY_AFTER_MAX_MS) : undefined;
}

function waitBeforeRetry(ms: number, signal?: AbortSignal): Promise<void> {
	throwIfAborted(signal);
	return new Promise((resolve, reject) => {
		const onAbort = () => {
			clearTimeout(timer);
			try {
				throwIfAborted(signal);
			} catch (error) {
				reject(error);
			}
		};
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

function throwIfAborted(signal?: AbortSignal) {
	if (!signal?.aborted) return;
	throw signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError');
}
