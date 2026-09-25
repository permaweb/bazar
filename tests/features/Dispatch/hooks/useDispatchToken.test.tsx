// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDispatchToken } from 'features/Dispatch/hooks/useDispatchToken';

import { flushPromises, renderHook } from '../../../test-utils/render-hook';

const api = vi.hoisted(() => ({
	readAssetStateWithDeadline: vi.fn(),
	fetchTransferReward: vi.fn(),
}));

vi.mock('api/marketplace', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/marketplace')>()),
	readAssetStateWithDeadline: api.readAssetStateWithDeadline,
}));
vi.mock('api/dispatch', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/dispatch')>()),
	fetchTransferReward: api.fetchTransferReward,
}));

const PROCESS = 'P'.repeat(43);
const firstState = { ticker: 'SIG', denomination: 0 };
const secondState = { ticker: 'SIG2', denomination: 0 };

beforeEach(() => {
	api.readAssetStateWithDeadline.mockReset();
	api.fetchTransferReward.mockReset();
});

afterEach(() => {
	document.body.innerHTML = '';
});

describe('useDispatchToken', () => {
	it('reads fresh token state, then quotes the per-transfer reward', async () => {
		api.readAssetStateWithDeadline.mockResolvedValue({ state: firstState });
		api.fetchTransferReward.mockResolvedValue(7n);
		const hook = renderHook((processId: string) => useDispatchToken(processId), PROCESS);

		expect(hook.current().token.status).toBe('loading');
		expect(api.readAssetStateWithDeadline).toHaveBeenCalledWith(PROCESS, {
			signal: expect.any(AbortSignal),
			maxAge: 0,
		});
		await flushPromises();
		expect(hook.current().token).toEqual({ status: 'success', data: firstState });
		expect(api.fetchTransferReward).toHaveBeenCalledWith(
			expect.any(String),
			PROCESS,
			undefined,
			expect.any(AbortSignal)
		);
		expect(hook.current().transferReward).toEqual({ status: 'success', data: 7n });
		hook.unmount();
	});

	it('keeps the last readable state through a failed retry and refetches the reward only for new state', async () => {
		api.readAssetStateWithDeadline
			.mockResolvedValueOnce({ state: firstState })
			.mockRejectedValueOnce(new Error('timeout'))
			.mockResolvedValueOnce({ state: secondState });
		api.fetchTransferReward.mockResolvedValue(7n);
		const hook = renderHook((processId: string) => useDispatchToken(processId), PROCESS);
		await flushPromises();

		React.act(() => hook.current().retry());
		expect(hook.current().token).toEqual({ status: 'refreshing', data: firstState });
		await flushPromises();
		const stale = hook.current().token;
		expect(stale.status).toBe('stale');
		expect(stale.status === 'stale' ? stale.data : null).toBe(firstState);
		expect(api.fetchTransferReward).toHaveBeenCalledTimes(1);

		React.act(() => hook.current().retry());
		await flushPromises();
		expect(hook.current().token).toEqual({ status: 'success', data: secondState });
		expect(api.fetchTransferReward).toHaveBeenCalledTimes(2);
		hook.unmount();
	});

	it('records an unreadable token and an unavailable reward without throwing', async () => {
		api.readAssetStateWithDeadline.mockResolvedValueOnce({ state: firstState });
		api.fetchTransferReward.mockRejectedValue(new Error('gateway down'));
		const hook = renderHook((processId: string) => useDispatchToken(processId), PROCESS);
		await flushPromises();
		expect(hook.current().transferReward.status).toBe('error');

		api.readAssetStateWithDeadline.mockRejectedValueOnce(new Error('not sequenced'));
		const fresh = renderHook((processId: string) => useDispatchToken(processId), 'Q'.repeat(43));
		await flushPromises();
		const failed = fresh.current().token;
		expect(failed.status === 'error' ? failed.error.code : null).toBe('unavailable');
		expect(fresh.current().transferReward.status).toBe('idle');
		hook.unmount();
		fresh.unmount();
	});

	it('aborts in-flight reads on unmount', () => {
		api.readAssetStateWithDeadline.mockReturnValue(new Promise(() => undefined));
		const hook = renderHook((processId: string) => useDispatchToken(processId), PROCESS);
		const signal: AbortSignal = api.readAssetStateWithDeadline.mock.calls[0][1].signal;
		hook.unmount();
		expect(signal.aborted).toBe(true);
	});
});
