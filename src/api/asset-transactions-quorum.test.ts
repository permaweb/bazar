import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ active: 1, handlers: new Map<string, (value?: unknown) => void>() }));

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
		release: vi.fn(),
	}),
}));

import { confirmTransactionId } from './asset-transactions';
import { ARWEAVE_OBSERVER_QUORUM_GRACE_MS } from './observer-policy';

const txId = 'mmCw1cw9Y94I7V4VUwB9_BMhYw7tEy0D8rpJIaJ_V4I';

beforeEach(() => {
	vi.useFakeTimers();
	state.handlers.clear();
});

afterEach(() => vi.useRealTimers());

describe('transaction watch observer quorum', () => {
	it('says it cannot verify, instead of waiting, when only one observer is reachable', async () => {
		state.active = 1;
		const confirmed = confirmTransactionId(txId);
		const outcome = expect(confirmed).rejects.toThrow('transaction-observers-unavailable');

		await vi.advanceTimersByTimeAsync(ARWEAVE_OBSERVER_QUORUM_GRACE_MS);

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
});
