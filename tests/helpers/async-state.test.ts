import { describe, expect, it } from 'vitest';

import { appError } from 'helpers/app-error';
import {
	asyncData,
	asyncError,
	type AsyncState,
	beginLoad,
	failLoad,
	IDLE,
	isAsyncPending,
	LOADING,
} from 'helpers/async-state';

describe('async state', () => {
	const failure = appError('unavailable');

	it('starts a first load without data and refreshes while keeping data visible', () => {
		expect(beginLoad(IDLE)).toEqual(LOADING);
		expect(beginLoad({ status: 'error', error: failure })).toEqual(LOADING);
		expect(beginLoad({ status: 'success', data: [1] })).toEqual({ status: 'refreshing', data: [1] });
		expect(beginLoad({ status: 'stale', data: [1], error: failure })).toEqual({ status: 'refreshing', data: [1] });
	});

	it('keeps known-good data when a refresh fails', () => {
		expect(failLoad(LOADING, failure)).toEqual({ status: 'error', error: failure });
		expect(failLoad({ status: 'refreshing', data: 'cached' }, failure)).toEqual({
			status: 'stale',
			data: 'cached',
			error: failure,
		});
	});

	it('reads data, errors, and pending status from every state', () => {
		const states: AsyncState<string>[] = [
			IDLE,
			LOADING,
			{ status: 'refreshing', data: 'a' },
			{ status: 'success', data: 'b' },
			{ status: 'stale', data: 'c', error: failure },
			{ status: 'error', error: failure },
		];
		expect(states.map(asyncData)).toEqual([undefined, undefined, 'a', 'b', 'c', undefined]);
		expect(states.map(asyncError)).toEqual([undefined, undefined, undefined, undefined, failure, failure]);
		expect(states.map(isAsyncPending)).toEqual([false, true, true, false, false, false]);
	});
});
