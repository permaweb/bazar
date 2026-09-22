import { type AppError, appError, type AppErrorReason, isAppError } from 'helpers/app-error';

/** Map an HTTP status to the application taxonomy. Submissions treat 400 and 422 as definitive rejections. */
export function httpStatusReason(status: number, options: { submission?: boolean } = {}): AppErrorReason {
	if (status === 429) return 'rate-limited';
	if (status === 404 || status === 410) return 'not-found';
	if (status === 401 || status === 403) return 'unauthorized';
	if (status === 408) return 'timeout';
	if (options.submission && (status === 400 || status === 422)) return 'rejected';
	return 'unavailable';
}

/**
 * A non-success HTTP response as an `AppError`. The diagnostic message keeps Bazar's established
 * `<operation>-<status>` spelling so logs stay comparable across releases.
 */
export function httpStatusError(
	operation: string,
	status: number,
	options: { submission?: boolean; cause?: unknown } = {}
): AppError {
	return appError(httpStatusReason(status, options), {
		message: `${operation}-${status}`,
		...(options.cause === undefined ? {} : { cause: options.cause }),
	});
}

function errorName(cause: unknown): string {
	if (!cause || typeof cause !== 'object') return '';
	const name = (cause as { name?: unknown }).name;
	return typeof name === 'string' ? name : '';
}

/**
 * A rejected `fetch` (or fetch-compatible transport) as an `AppError`. Browsers report an unreachable host only as a
 * `TypeError`; response bodies that are not JSON surface as a `SyntaxError`. Callers that must preserve a caller's own
 * abort reason check their signal before calling this.
 */
export function transportFailure(cause: unknown, operation: string): AppError {
	if (isAppError(cause)) return cause;
	const name = errorName(cause);
	if (name === 'AbortError') return appError('cancelled', { cause, message: `${operation}-aborted` });
	if (name === 'TimeoutError') return appError('timeout', { cause, message: `${operation}-timeout` });
	if (name === 'SyntaxError') return appError('invalid-response', { cause, message: `${operation}-invalid-json` });
	if (name === 'TypeError') return appError('offline', { cause, message: `${operation}-unreachable` });
	return appError('unavailable', { cause, message: `${operation}-failed` });
}

/**
 * Collapse several independent read failures into one: any rate limit makes the whole batch rate-limited, so callers
 * can advise waiting rather than retrying immediately.
 */
export function batchFailure(failures: readonly unknown[], operation: string): AppError {
	const errors = failures.map((failure) => transportFailure(failure, operation));
	const reason: AppErrorReason = errors.some((error) => error.code === 'rate-limited')
		? 'rate-limited'
		: 'unavailable';
	return appError(reason, {
		message: `${operation}-batch-failed: ${errors
			.map((error) => error.message)
			.sort()
			.join('; ')}`,
		cause: new AggregateError(failures, `${operation}-batch-failed`),
	});
}
