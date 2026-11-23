import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../app/useDialogFocus', () => ({ useDialogFocus: () => ({ current: null }) }));

import {
	FungibleMintDialog,
	MintEstimateFailureNotice,
	messageAfterEstimateStart,
	mintEstimateFailure,
	mintEstimateStatus,
	scheduleEstimate,
	withMintEstimateFailure,
} from './CreateRoute';

describe('fungible mint presentation', () => {
	it('uses the marketplace operation side drawer for a completed token mint', () => {
		const markup = renderToStaticMarkup(
			React.createElement(FungibleMintDialog, {
				confirmations: 5,
				consensus: null,
				error: null,
				logoPreview: 'blob:token-logo',
				name: 'Signal',
				onClearError: () => undefined,
				onNavigate: () => undefined,
				onVisibleChange: () => undefined,
				phase: null,
				phaseLabel: '',
				progressButton: React.createRef<HTMLButtonElement>(),
				ready: true,
				result: {
					processId: 'P'.repeat(43),
					logo: 'L'.repeat(43),
					owner: 'W'.repeat(43),
					name: 'Signal',
					ticker: 'SIG',
					wholeSupply: '1000000',
					atomicSupply: '1000000000000000000',
					denomination: 12,
					createdAt: 1,
				},
				ticker: 'SIG',
				views: [],
				visible: true,
			})
		);

		expect(markup).toContain('operation-panel-backdrop');
		expect(markup).toContain('operation-side-panel');
		expect(markup).toContain('Token live on Bazar');
		expect(markup).toContain('Token logo transaction');
		expect(markup).not.toContain('mint-success');
	});
});

describe('mint cost estimate lifecycle', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	const deferred = () => {
		let resolve!: () => void;
		const promise = new Promise<void>((done) => {
			resolve = done;
		});
		return { promise, resolve };
	};

	it('waits for the debounce, then reports checking until the request settles', async () => {
		const request = deferred();
		const flags: boolean[] = [];
		const run = vi.fn(() => request.promise);
		scheduleEstimate(run, (next) => flags.push(next));

		await vi.advanceTimersByTimeAsync(249);
		expect(run).not.toHaveBeenCalled();
		expect(flags).toEqual([]);

		await vi.advanceTimersByTimeAsync(1);
		expect(run).toHaveBeenCalledTimes(1);
		expect(flags).toEqual([true]);

		request.resolve();
		await vi.runAllTimersAsync();
		expect(flags).toEqual([true, false]);
	});

	it('clears checking when an in-flight estimate is cancelled (tab switch or cleared name)', async () => {
		const request = deferred();
		const flags: boolean[] = [];
		let signal: AbortSignal | undefined;
		const cleanup = scheduleEstimate(
			(next) => {
				signal = next;
				return request.promise;
			},
			(next) => flags.push(next)
		);
		await vi.advanceTimersByTimeAsync(250);
		expect(flags.at(-1)).toBe(true);

		cleanup();
		expect(signal?.aborted).toBe(true);
		expect(flags.at(-1)).toBe(false);

		// The cancelled request settling later does not touch the flag again.
		request.resolve();
		await vi.runAllTimersAsync();
		expect(flags).toEqual([true, false]);
	});

	it('never starts a request cancelled during the debounce', async () => {
		const flags: boolean[] = [];
		const run = vi.fn(() => Promise.resolve());
		const cleanup = scheduleEstimate(run, (next) => flags.push(next));
		await vi.advanceTimersByTimeAsync(100);
		cleanup();
		await vi.runAllTimersAsync();
		expect(run).not.toHaveBeenCalled();
		expect(flags).not.toContain(true);
	});

	it('does not let a cancelled request clear the flag of the newer request', async () => {
		const first = deferred();
		const second = deferred();
		let estimating = false;
		const set = (next: boolean) => {
			estimating = next;
		};
		const cancelFirst = scheduleEstimate(() => first.promise, set);
		await vi.advanceTimersByTimeAsync(250);
		cancelFirst();
		scheduleEstimate(() => second.promise, set);
		await vi.advanceTimersByTimeAsync(250);
		expect(estimating).toBe(true);

		first.resolve();
		await vi.advanceTimersByTimeAsync(0);
		expect(estimating).toBe(true);

		second.resolve();
		await vi.advanceTimersByTimeAsync(0);
		expect(estimating).toBe(false);
	});
});

describe('mint cost estimate failure', () => {
	it('offers Retry for a transient price failure but not for an input validation code', () => {
		expect(mintEstimateFailure(new Error('mint-price-503'))).toEqual({
			message: 'mint price 503',
			retryable: true,
		});
		expect(mintEstimateFailure(new TypeError('Failed to fetch')).retryable).toBe(true);
		expect(mintEstimateFailure(new TypeError('mint-name-invalid'))).toEqual({
			message: 'Enter a name between 1 and 80 characters.',
			retryable: false,
		});
		expect(mintEstimateFailure(new TypeError('mint-file-type-unsupported')).retryable).toBe(false);
	});

	it('walks idle -> checking -> ready or failed, and back to checking on retry', () => {
		const failure = { message: 'mint price 503', retryable: true };
		expect(mintEstimateStatus({ estimating: false, hasEstimate: false, failure: null })).toBe('idle');
		expect(mintEstimateStatus({ estimating: true, hasEstimate: false, failure: null })).toBe('checking');
		expect(mintEstimateStatus({ estimating: false, hasEstimate: true, failure: null })).toBe('ready');
		expect(mintEstimateStatus({ estimating: false, hasEstimate: false, failure })).toBe('failed');
		expect(mintEstimateStatus({ estimating: true, hasEstimate: false, failure })).toBe('checking');
	});

	it("keeps each mode's failure in its own slot", () => {
		const failure = { message: 'mint price 503', retryable: true };
		const failed = withMintEstimateFailure({}, 'asset', failure);
		expect(failed).toEqual({ asset: failure });
		expect(withMintEstimateFailure(failed, 'collection', null)).toBe(failed);
		expect(withMintEstimateFailure(failed, 'asset', failure)).toBe(failed);
		expect(withMintEstimateFailure(failed, 'asset', null)).toEqual({});
	});

	it('keeps a selection message through a new estimate and drops a stale submit message', () => {
		const truncated = { text: 'Collections support up to 10 images at a time.', origin: 'selection' as const };
		expect(messageAfterEstimateStart(truncated)).toBe(truncated);
		expect(
			messageAfterEstimateStart({
				text: 'Complete the token name, ticker, total supply, and decimal places to continue.',
				origin: 'submit',
			})
		).toBeNull();
		expect(messageAfterEstimateStart(null)).toBeNull();
	});

	it('renders a Retry cost check button described by the failure for a network failure', () => {
		const markup = renderToStaticMarkup(
			React.createElement(MintEstimateFailureNotice, {
				failure: { message: 'mint price 503', retryable: true },
				id: 'estimate-failure',
				onRetry: () => undefined,
			})
		);
		expect(markup).toContain('Could not check the network cost (mint price 503).');
		expect(markup).toContain('Retry cost check');
		expect(markup).toContain('aria-describedby="estimate-failure"');
		expect(markup).toContain('id="estimate-failure"');
	});

	it('shows a validation message without Retry', () => {
		const markup = renderToStaticMarkup(
			React.createElement(MintEstimateFailureNotice, {
				failure: { message: 'Enter a name between 1 and 80 characters.', retryable: false },
				id: 'estimate-failure',
				onRetry: () => undefined,
			})
		);
		expect(markup).toContain('Enter a name between 1 and 80 characters.');
		expect(markup).not.toContain('Retry');
		expect(markup).not.toContain('<button');
	});
});
