// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MINT_ESTIMATE_DEBOUNCE_MS, useMintEstimate } from 'features/Create/hooks/useMintEstimate';
import type { AppError } from 'helpers/app-error';

import { renderHook } from '../../../test-utils/hook-renderer';

type Request = { id: string };

let run: ReturnType<typeof vi.fn>;
let onStart: ReturnType<typeof vi.fn>;
let onError: ReturnType<typeof vi.fn>;

function render(request: Request | null) {
	return renderHook(
		(current: Request | null) =>
			useMintEstimate(
				current,
				run as (request: Request, signal: AbortSignal) => Promise<number>,
				onStart,
				onError
			),
		request
	);
}

async function advanceDebounce() {
	await React.act(async () => {
		await vi.advanceTimersByTimeAsync(MINT_ESTIMATE_DEBOUNCE_MS);
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	run = vi.fn();
	onStart = vi.fn();
	onError = vi.fn();
});

afterEach(() => {
	vi.useRealTimers();
	document.body.innerHTML = '';
});

describe('useMintEstimate', () => {
	it('stays idle without complete inputs', async () => {
		const hook = render(null);
		await advanceDebounce();
		expect(hook.current().estimate).toEqual({ status: 'idle' });
		expect(run).not.toHaveBeenCalled();
		hook.unmount();
	});

	it('debounces the request and reports success', async () => {
		run.mockResolvedValue(42);
		const hook = render({ id: 'a' });
		expect(run).not.toHaveBeenCalled();
		expect(hook.current().estimate).toEqual({ status: 'idle' });

		await advanceDebounce();
		expect(run).toHaveBeenCalledTimes(1);
		expect(onStart).toHaveBeenCalledTimes(1);
		expect(hook.current().estimate).toEqual({ status: 'success', data: 42 });
		hook.unmount();
	});

	it('restarts the debounce for new inputs and aborts the superseded request', async () => {
		run.mockResolvedValue(1);
		const hook = render({ id: 'a' });
		await advanceDebounce();
		const firstSignal: AbortSignal = run.mock.calls[0][1];

		run.mockResolvedValue(2);
		hook.rerender({ id: 'b' });
		expect(firstSignal.aborted).toBe(true);
		expect(run).toHaveBeenCalledTimes(1);
		// The last estimate stays on screen while the new one is debounced.
		expect(hook.current().estimate).toEqual({ status: 'success', data: 1 });

		await advanceDebounce();
		expect(hook.current().estimate).toEqual({ status: 'success', data: 2 });
		hook.unmount();
	});

	it('ignores a stale response that resolves after its request was superseded', async () => {
		let resolveFirst: (value: number) => void = () => undefined;
		run.mockImplementationOnce(() => new Promise<number>((resolve) => (resolveFirst = resolve)));
		const hook = render({ id: 'a' });
		await advanceDebounce();

		run.mockResolvedValueOnce(9);
		hook.rerender({ id: 'b' });
		await advanceDebounce();
		expect(hook.current().estimate).toEqual({ status: 'success', data: 9 });

		await React.act(async () => {
			resolveFirst(1);
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(hook.current().estimate).toEqual({ status: 'success', data: 9 });
		hook.unmount();
	});

	it('keeps the last estimate and reports the failure when a refresh fails', async () => {
		run.mockResolvedValueOnce(5).mockRejectedValueOnce(new Error('gateway down'));
		const hook = render({ id: 'a' });
		await advanceDebounce();
		hook.rerender({ id: 'b' });
		await advanceDebounce();

		expect(hook.current().estimate).toMatchObject({ status: 'stale', data: 5 });
		const reported: AppError = onError.mock.calls[0][0];
		expect(reported.code).toBe('unknown');
		hook.unmount();
	});

	it('forgets the estimate on discard but keeps a request in flight pending', async () => {
		run.mockResolvedValue(3);
		const hook = render({ id: 'a' });
		await advanceDebounce();
		React.act(() => hook.current().discard());
		expect(hook.current().estimate).toEqual({ status: 'idle' });

		let resolveSecond: (value: number) => void = () => undefined;
		run.mockImplementationOnce(() => new Promise<number>((resolve) => (resolveSecond = resolve)));
		hook.rerender({ id: 'b' });
		await advanceDebounce();
		expect(hook.current().estimate).toEqual({ status: 'loading' });
		React.act(() => hook.current().discard());
		expect(hook.current().estimate).toEqual({ status: 'loading' });

		await React.act(async () => {
			resolveSecond(4);
			await vi.advanceTimersByTimeAsync(0);
		});
		expect(hook.current().estimate).toEqual({ status: 'success', data: 4 });
		hook.unmount();
	});

	it('cancels a pending request and its debounce on unmount', async () => {
		run.mockReturnValue(new Promise(() => undefined));
		const hook = render({ id: 'a' });
		await advanceDebounce();
		const signal: AbortSignal = run.mock.calls[0][1];
		hook.unmount();
		expect(signal.aborted).toBe(true);

		const pending = render({ id: 'b' });
		pending.unmount();
		await vi.advanceTimersByTimeAsync(MINT_ESTIMATE_DEBOUNCE_MS);
		expect(run).toHaveBeenCalledTimes(1);
	});
});
