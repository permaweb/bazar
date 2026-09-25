import { describe, expect, it } from 'vitest';

import { batchFailure, httpStatusError, transportFailure } from 'api/network/errors';

import { appError } from 'helpers/app-error';

describe('HTTP status mapping', () => {
	it.each([
		[429, 'rate-limited'],
		[404, 'not-found'],
		[410, 'not-found'],
		[401, 'unauthorized'],
		[403, 'unauthorized'],
		[408, 'timeout'],
		[500, 'unavailable'],
		[502, 'unavailable'],
		[503, 'unavailable'],
		[504, 'unavailable'],
		[400, 'unavailable'],
		[422, 'unavailable'],
	] as const)('maps a read that returned %i to %s', (status, code) => {
		const error = httpStatusError('asset-index-graphql', status);
		expect(error).toMatchObject({ code, reason: code, message: `asset-index-graphql-${status}` });
	});

	it('treats 400 and 422 as definitive rejections only for submissions', () => {
		for (const status of [400, 422]) {
			expect(httpStatusError('mint-upload', status, { submission: true })).toMatchObject({
				code: 'rejected',
				retryable: false,
			});
		}
		expect(httpStatusError('mint-upload', 503, { submission: true }).code).toBe('unavailable');
		expect(httpStatusError('mint-upload', 429, { submission: true }).code).toBe('rate-limited');
	});
});

describe('transport failures', () => {
	it('maps browser fetch failures by their standard error class', () => {
		expect(transportFailure(new TypeError('Failed to fetch'), 'wallet-balance')).toMatchObject({
			code: 'offline',
			message: 'wallet-balance-unreachable',
		});
		expect(transportFailure(new DOMException('Aborted', 'AbortError'), 'wallet-balance').code).toBe('cancelled');
		expect(transportFailure(new DOMException('Timed out', 'TimeoutError'), 'wallet-balance').code).toBe('timeout');
		expect(transportFailure(new SyntaxError('Unexpected token <'), 'profile-read')).toMatchObject({
			code: 'invalid-response',
			message: 'profile-read-invalid-json',
		});
		expect(transportFailure(new Error('socket hang up'), 'profile-read')).toMatchObject({
			code: 'unavailable',
			message: 'profile-read-failed',
		});
	});

	it('keeps an application error from a nested adapter', () => {
		const nested = appError('rate-limited', { message: 'compute-429' });
		expect(transportFailure(nested, 'wallet-balance')).toBe(nested);
	});

	it('marks a batch rate-limited when any independent read was rate limited', () => {
		const failure = batchFailure(
			[
				appError('unavailable', { message: 'asset-activity-graphql-503' }),
				appError('rate-limited', { message: 'asset-activity-graphql-429' }),
			],
			'asset-activity'
		);
		expect(failure).toMatchObject({
			code: 'rate-limited',
			message: 'asset-activity-batch-failed: asset-activity-graphql-429; asset-activity-graphql-503',
		});
		expect(failure.cause).toBeInstanceOf(AggregateError);
		expect(batchFailure([new Error('window failed')], 'collection-activity').code).toBe('unavailable');
	});
});
