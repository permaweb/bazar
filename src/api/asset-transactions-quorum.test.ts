import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
	active: 1,
	guard: true,
	handlers: new Map<string, (value?: unknown) => void>(),
}));

vi.mock('./asset-observers', () => ({
	acquireAssetObserverNetwork: () => ({
		network: {
			active: () =>
				Array.from({ length: state.active }, (_, index) => ({ url: `https://observer-${index}.example` })),
			watch: () => ({
				on: (event: string, handler: (value?: unknown) => void) => state.handlers.set(event, handler),
				start: vi.fn(),
				stop: vi.fn(),
				views: () => [],
			}),
		},
		ready: Promise.resolve(),
		quorumGuard: state.guard,
		release: vi.fn(),
	}),
}));

import { confirmTransactionId, dispatchAndConfirm } from './asset-transactions';
import { ARWEAVE_OBSERVER_QUORUM_CHECK_MS, ARWEAVE_OBSERVER_QUORUM_GRACE_MS } from './observer-policy';

const txId = 'mmCw1cw9Y94I7V4VUwB9_BMhYw7tEy0D8rpJIaJ_V4I';

beforeEach(() => {
	vi.useFakeTimers();
	state.handlers.clear();
	state.active = 1;
	state.guard = true;
});

afterEach(() => vi.useRealTimers());

describe('transaction watch observer quorum', () => {
	it('says it cannot verify, instead of waiting, when only one observer is reachable', async () => {
		state.active = 1;
		const confirmed = confirmTransactionId(txId);
		const outcome = expect(confirmed).rejects.toThrow('transaction-observers-unavailable');

		await vi.advanceTimersByTimeAsync(ARWEAVE_OBSERVER_QUORUM_GRACE_MS + ARWEAVE_OBSERVER_QUORUM_CHECK_MS);

		await outcome;
	});

	it('keeps watching when enough observers are reachable', async () => {
		state.active = 3;
		const confirmed = confirmTransactionId(txId);
		let settled = false;
		void confirmed.then(() => (settled = true));

		await vi.advanceTimersByTimeAsync(ARWEAVE_OBSERVER_QUORUM_GRACE_MS * 2);
		expect(settled).toBe(false);
		state.handlers.get('settled')?.();

		await expect(confirmed).resolves.toBeUndefined();
	});

	it('waits for a lasting shortfall, not a single low reading', async () => {
		state.active = 1;
		const confirmed = confirmTransactionId(txId);
		let failed = false;
		void confirmed.catch(() => (failed = true));

		await vi.advanceTimersByTimeAsync(ARWEAVE_OBSERVER_QUORUM_GRACE_MS - 2_000);
		state.active = 3;
		await vi.advanceTimersByTimeAsync(3_000);
		state.active = 1;
		await vi.advanceTimersByTimeAsync(ARWEAVE_OBSERVER_QUORUM_GRACE_MS - 2_000);
		expect(failed).toBe(false);
		await vi.advanceTimersByTimeAsync(3_000);
		await expect(confirmed).rejects.toThrow('transaction-observers-unavailable');
	});

	it('does not report a shortfall on a PermawebOS host', async () => {
		state.guard = false;
		const confirmed = confirmTransactionId(txId);
		let settled = false;
		void confirmed.then(
			() => (settled = true),
			() => (settled = true)
		);

		await vi.advanceTimersByTimeAsync(ARWEAVE_OBSERVER_QUORUM_GRACE_MS * 3);
		expect(settled).toBe(false);
		state.handlers.get('settled')?.();
		await expect(confirmed).resolves.toBeUndefined();
	});

	it('lets a pending dispatch finish before reporting a shortfall', async () => {
		state.active = 1;
		let dispatchSignal: AbortSignal | undefined;
		let finishDispatch: () => void = () => undefined;
		const transaction = {
			id: txId,
			dispatch: vi.fn(
				(signal: AbortSignal) =>
					new Promise<void>((resolve) => {
						dispatchSignal = signal;
						finishDispatch = resolve;
					})
			),
		};
		const confirmed = dispatchAndConfirm(transaction as never);
		let failed = false;
		void confirmed.catch(() => (failed = true));

		await vi.advanceTimersByTimeAsync(ARWEAVE_OBSERVER_QUORUM_GRACE_MS * 2);
		expect(failed).toBe(false);
		expect(dispatchSignal?.aborted).toBe(false);
		finishDispatch();
		await expect(confirmed).rejects.toThrow('transaction-observers-unavailable');
	});

	it('does not report a shortfall that recovered while a dispatch was still running', async () => {
		state.active = 1;
		let finishDispatch: () => void = () => undefined;
		const transaction = {
			id: txId,
			dispatch: vi.fn(() => new Promise<void>((resolve) => (finishDispatch = resolve))),
		};
		const confirmed = dispatchAndConfirm(transaction as never);
		let failed = false;
		void confirmed.catch(() => (failed = true));

		await vi.advanceTimersByTimeAsync(ARWEAVE_OBSERVER_QUORUM_GRACE_MS * 2);
		state.active = 3;
		await vi.advanceTimersByTimeAsync(ARWEAVE_OBSERVER_QUORUM_CHECK_MS * 2);
		finishDispatch();
		await vi.advanceTimersByTimeAsync(ARWEAVE_OBSERVER_QUORUM_CHECK_MS * 2);
		expect(failed).toBe(false);
		state.handlers.get('settled')?.();
		await expect(confirmed).resolves.toBeUndefined();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('surfaces a dispatch error rather than a shortfall', async () => {
		state.active = 1;
		const rejected = Object.assign(new Error('dispatch-rejected'), { code: 'transaction-dispatch-rejected' });
		const transaction = { id: txId, dispatch: vi.fn(async () => Promise.reject(rejected)) };
		const confirmed = dispatchAndConfirm(transaction as never);
		const outcome = expect(confirmed).rejects.toThrow('dispatch-rejected');

		await vi.advanceTimersByTimeAsync(ARWEAVE_OBSERVER_QUORUM_GRACE_MS * 2);
		await outcome;
		expect(vi.getTimerCount()).toBe(0);
	});
});
