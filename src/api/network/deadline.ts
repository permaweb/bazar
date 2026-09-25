import { appError, type AppErrorReason } from 'helpers/app-error';

import { transportFailure } from './errors';

const DEFAULT_TIMEOUT_MS = 15_000;

type DeadlineOptions = {
	timeoutMs?: number;
	/** Diagnostic message of the timeout `AppError`. */
	timeoutError: string;
	/** Reason of the timeout `AppError`; defaults to `timeout`. */
	timeoutReason?: AppErrorReason;
};

export async function operationWithDeadline<T>(
	operation: (signal: AbortSignal) => Promise<T>,
	signal: AbortSignal | null | undefined,
	options: DeadlineOptions
): Promise<T> {
	signal?.throwIfAborted();
	const controller = new AbortController();
	const timeoutMs = Math.max(1, Math.floor(options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
	const forwardAbort = () => controller.abort(signal?.reason);
	signal?.addEventListener('abort', forwardAbort, { once: true });
	const timer = setTimeout(
		() => controller.abort(appError(options.timeoutReason ?? 'timeout', { message: options.timeoutError })),
		timeoutMs
	);
	let rejectAbort!: (reason: unknown) => void;
	const aborted = new Promise<never>((_resolve, reject) => {
		rejectAbort = reject;
	});
	const rejectWhenAborted = () => rejectAbort(controller.signal.reason);
	controller.signal.addEventListener('abort', rejectWhenAborted, { once: true });
	try {
		return await Promise.race([operation(controller.signal), aborted]);
	} finally {
		clearTimeout(timer);
		signal?.removeEventListener('abort', forwardAbort);
		controller.signal.removeEventListener('abort', rejectWhenAborted);
	}
}

export async function fetchWithDeadline(
	fetcher: typeof fetch,
	input: RequestInfo | URL,
	init: RequestInit,
	options: DeadlineOptions
): Promise<Response> {
	return requestWithDeadline(fetcher, input, init, options, (response) => Promise.resolve(response));
}

export async function fetchJsonWithDeadline<T = unknown>(
	fetcher: typeof fetch,
	input: RequestInfo | URL,
	init: RequestInit,
	options: DeadlineOptions
): Promise<{ response: Response; body: T | undefined }> {
	return requestWithDeadline(fetcher, input, init, options, async (response) => ({
		response,
		body: response.ok ? ((await response.json()) as T) : undefined,
	}));
}

export async function fetchTextWithDeadline(
	fetcher: typeof fetch,
	input: RequestInfo | URL,
	init: RequestInit,
	options: DeadlineOptions
): Promise<{ response: Response; body: string | undefined }> {
	return requestWithDeadline(fetcher, input, init, options, async (response) => ({
		response,
		body: response.ok ? await response.text() : undefined,
	}));
}

async function requestWithDeadline<T>(
	fetcher: typeof fetch,
	input: RequestInfo | URL,
	init: RequestInit,
	options: DeadlineOptions,
	read: (response: Response) => Promise<T>
): Promise<T> {
	// Label transport failures after the request's timeout code, e.g. `asset-index-graphql-unreachable`.
	const operation = options.timeoutError.replace(/-timeout$/, '');
	return operationWithDeadline(
		(signal) =>
			fetcher(input, { ...init, signal })
				.then(read)
				.catch((cause: unknown) => {
					throw signal.aborted ? cause : transportFailure(cause, operation);
				}),
		init.signal,
		options
	);
}
