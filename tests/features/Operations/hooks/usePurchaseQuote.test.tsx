// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Operation } from 'api/operations';

import { usePurchaseQuote } from 'features/Operations/hooks/usePurchaseQuote';
import { appError } from 'helpers/app-error';

import { renderHook } from './renderHook';

const mocks = vi.hoisted(() => ({
	estimate: vi.fn(),
	balance: vi.fn(),
	runtimeLoads: 0,
}));

vi.mock('api/transactions', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/transactions')>()),
	loadAtomicTransactionRuntime: async () => {
		mocks.runtimeLoads += 1;
		return {
			AssetTransactionClient: class {
				estimatePurchaseCosts(...args: unknown[]) {
					return mocks.estimate(...args);
				}
				walletBalance(...args: unknown[]) {
					return mocks.balance(...args);
				}
			},
		};
	},
}));

const OWNER = 'O'.repeat(43);
const ASSET_ID = 'A'.repeat(43);
const ORDER = { orderId: 'D'.repeat(43), creator: 'S'.repeat(43), asking: '100', quantity: '1' } as any;
const ESTIMATE = {
	asking: '100',
	total: '120',
	registrationFee: '0',
	registrationNetworkReward: '0',
	paymentNetworkReward: '0',
};

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (cause: unknown) => void;
	const promise = new Promise<T>((onResolve, onReject) => {
		resolve = onResolve;
		reject = onReject;
	});
	return { promise, resolve, reject };
}

function quoteHook(operation: Operation) {
	return renderHook(
		(props: { operation: Operation }) => usePurchaseQuote({ ...props, assetId: ASSET_ID, owner: OWNER }),
		{
			operation,
		}
	);
}

beforeEach(() => {
	mocks.runtimeLoads = 0;
	mocks.estimate = vi.fn(() => Promise.resolve(ESTIMATE));
	mocks.balance = vi.fn(() => Promise.resolve(500n));
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('purchase quote', () => {
	it('checks the exact cost and wallet balance for a new purchase', async () => {
		const hook = quoteHook({ kind: 'buy', order: ORDER });
		expect(hook.result.current.state.status).toBe('loading');

		await hook.flush();
		expect(hook.result.current.state).toEqual({ status: 'success', data: { estimate: ESTIMATE, balance: 500n } });
		expect(mocks.estimate).toHaveBeenCalledWith(ORDER, ASSET_ID, expect.any(AbortSignal));
		expect(mocks.balance).toHaveBeenCalledWith(OWNER, expect.any(AbortSignal));
		hook.unmount();
	});

	it('never checks a purchase resuming saved signed work or another operation kind', async () => {
		const resuming = quoteHook({
			kind: 'buy',
			order: ORDER,
			resume: { registration: { id: 'G'.repeat(43), dispatched: true } },
		});
		await resuming.flush(2);
		expect(resuming.result.current.state.status).toBe('idle');
		resuming.unmount();

		const listing = quoteHook({ kind: 'sell' });
		await listing.flush(2);
		expect(listing.result.current.state.status).toBe('idle');
		expect(mocks.estimate).not.toHaveBeenCalled();
		listing.unmount();
	});

	it('normalizes a failed check into an application error', async () => {
		mocks.estimate = vi.fn(() => Promise.reject(appError('compute-unavailable')));
		const hook = quoteHook({ kind: 'buy', order: ORDER });
		await hook.flush();

		expect(hook.result.current.state).toMatchObject({ status: 'error' });
		expect(hook.result.current.state.status === 'error' && hook.result.current.state.error.reason).toBe(
			'compute-unavailable'
		);
		hook.unmount();
	});

	it('re-checks only after a finished check, from a clean slate', async () => {
		const hook = quoteHook({ kind: 'buy', order: ORDER });
		hook.act(() => hook.result.current.retry());
		expect(hook.result.current.state.status).toBe('loading');

		await hook.flush();
		expect(mocks.estimate).toHaveBeenCalledTimes(1);
		hook.act(() => hook.result.current.retry());
		expect(hook.result.current.state.status).toBe('loading');
		await hook.flush();
		expect(mocks.estimate).toHaveBeenCalledTimes(2);
		expect(hook.result.current.state.status).toBe('success');
		hook.unmount();
	});

	it('ignores a superseded check and cancels the one it replaced', async () => {
		const first = deferred<typeof ESTIMATE>();
		mocks.estimate = vi.fn(() => first.promise);
		const hook = quoteHook({ kind: 'buy', order: ORDER });
		await hook.flush(1);
		const firstSignal = mocks.estimate.mock.calls[0][2] as AbortSignal;

		const nextOrder = { ...ORDER, orderId: 'E'.repeat(43) };
		mocks.estimate = vi.fn(() => Promise.resolve({ ...ESTIMATE, total: '900' }));
		hook.rerender({ operation: { kind: 'buy', order: nextOrder } });
		expect(firstSignal.aborted).toBe(true);

		first.resolve({ ...ESTIMATE, total: '111' });
		await hook.flush();
		expect(hook.result.current.state).toMatchObject({ status: 'success', data: { estimate: { total: '900' } } });
		hook.unmount();
	});

	it('does not re-check when only the order object identity changes', async () => {
		const hook = quoteHook({ kind: 'buy', order: ORDER });
		await hook.flush();
		hook.rerender({ operation: { kind: 'buy', order: { ...ORDER } } });
		await hook.flush();

		expect(mocks.estimate).toHaveBeenCalledTimes(1);
		hook.unmount();
	});

	it('cancels an in-flight check when the dialog closes', async () => {
		mocks.estimate = vi.fn(() => new Promise(() => undefined));
		const hook = quoteHook({ kind: 'buy', order: ORDER });
		await hook.flush(1);
		const signal = mocks.estimate.mock.calls[0][2] as AbortSignal;

		hook.unmount();
		expect(signal.aborted).toBe(true);
	});
});
