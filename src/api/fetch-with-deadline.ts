const DEFAULT_TIMEOUT_MS = 15_000;

type DeadlineOptions = {
	timeoutMs?: number;
	timeoutError: string;
};

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
	init.signal?.throwIfAborted();
	const controller = new AbortController();
	const timeoutMs = Math.max(1, Math.floor(options.timeoutMs ?? DEFAULT_TIMEOUT_MS));
	const forwardAbort = () => controller.abort(init.signal?.reason);
	init.signal?.addEventListener('abort', forwardAbort, { once: true });
	const timer = setTimeout(() => controller.abort(new Error(options.timeoutError)), timeoutMs);
	let rejectAbort!: (reason: unknown) => void;
	const aborted = new Promise<never>((_resolve, reject) => {
		rejectAbort = reject;
	});
	const rejectWhenAborted = () => rejectAbort(controller.signal.reason);
	controller.signal.addEventListener('abort', rejectWhenAborted, { once: true });
	try {
		return await Promise.race([fetcher(input, { ...init, signal: controller.signal }).then(read), aborted]);
	} finally {
		clearTimeout(timer);
		init.signal?.removeEventListener('abort', forwardAbort);
		controller.signal.removeEventListener('abort', rejectWhenAborted);
	}
}
