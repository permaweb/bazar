// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SwapOrder } from 'api/marketplace';

import {
	type FungiblePurchaseQuote,
	useFungiblePurchaseQuote,
} from 'features/AssetDetail/hooks/useFungiblePurchaseQuote';
import { asyncData, type AsyncState } from 'helpers/async-state';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
	estimate: vi.fn(),
	balance: vi.fn(),
}));

vi.mock('api/transactions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('api/transactions')>();
	class MockClient {
		estimatePurchaseBatchCosts(orders: SwapOrder[], processId: string, signal: AbortSignal) {
			return mocks.estimate(orders, processId, signal);
		}
		walletBalance(owner: string, signal: AbortSignal) {
			return mocks.balance(owner, signal);
		}
	}
	return { ...actual, AssetTransactionClient: MockClient };
});

const ASSET_ID = 'a'.repeat(43);
const OWNER = 'o'.repeat(43);

function order(id: string, asking: string): SwapOrder {
	return {
		orderId: id.repeat(43).slice(0, 43),
		creator: 's'.repeat(43),
		recipient: 'q'.repeat(43),
		asking,
		deposit: '0',
		minimumFee: '0',
		deadline: 0,
		createdAt: 1,
		quantity: '10',
		status: 'open',
	};
}

const FIRST = order('a', '1000');
const SECOND = order('b', '2000');

let root: Root;
let host: HTMLElement;
let states: AsyncState<FungiblePurchaseQuote>[] = [];
let retry: () => void = () => undefined;

function Probe(props: { orders: SwapOrder[]; enabled: boolean }) {
	const quote = useFungiblePurchaseQuote({
		assetId: ASSET_ID,
		owner: OWNER,
		orders: props.orders,
		enabled: props.enabled,
	});
	states.push(quote.state);
	retry = quote.retry;
	return null;
}

function render(orders: SwapOrder[], enabled = true) {
	React.act(() => root.render(<Probe orders={orders} enabled={enabled} />));
}

function latest() {
	return states[states.length - 1];
}

async function advance(ms: number) {
	await React.act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	states = [];
	mocks.estimate.mockReset();
	mocks.balance.mockReset();
	mocks.estimate.mockResolvedValue([{ total: '1500' }]);
	mocks.balance.mockResolvedValue(10_000n);
	host = document.createElement('div');
	document.body.append(host);
	root = createRoot(host);
});

afterEach(() => {
	React.act(() => root.unmount());
	host.remove();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('useFungiblePurchaseQuote', () => {
	it('stays idle without matched orders or while a saved batch resumes', async () => {
		render([]);
		await advance(1000);
		expect(latest().status).toBe('idle');

		render([FIRST], false);
		await advance(1000);
		expect(latest().status).toBe('idle');
		expect(mocks.estimate).not.toHaveBeenCalled();
	});

	it('debounces the quote and reports whether the wallet can afford it', async () => {
		render([FIRST]);
		expect(latest().status).toBe('loading');
		await advance(200);
		expect(mocks.estimate).not.toHaveBeenCalled();
		await advance(100);
		expect(mocks.estimate).toHaveBeenCalledTimes(1);
		expect(latest().status).toBe('success');
		expect(asyncData(latest())).toEqual({ total: '1500', walletBalance: '10000', canAfford: true });
	});

	it('reports an unaffordable purchase without failing the quote', async () => {
		mocks.balance.mockResolvedValue(100n);
		render([FIRST]);
		await advance(300);
		expect(asyncData(latest())).toMatchObject({ canAfford: false });
	});

	it('requotes only when the matched lots change by value', async () => {
		render([FIRST]);
		await advance(300);
		expect(mocks.estimate).toHaveBeenCalledTimes(1);

		// A new array with the same lots is the same quote.
		render([{ ...FIRST }]);
		await advance(300);
		expect(mocks.estimate).toHaveBeenCalledTimes(1);
		expect(latest().status).toBe('success');

		render([FIRST, SECOND]);
		expect(latest().status).toBe('loading');
		await advance(300);
		expect(mocks.estimate).toHaveBeenCalledTimes(2);
		expect(mocks.estimate.mock.calls[1][0]).toHaveLength(2);
	});

	it('cancels a superseded quote so a late response cannot win', async () => {
		let resolveFirst: (costs: Array<{ total: string }>) => void = () => undefined;
		mocks.estimate.mockImplementationOnce(
			() =>
				new Promise<Array<{ total: string }>>((resolve) => {
					resolveFirst = resolve;
				})
		);
		render([FIRST]);
		await advance(300);
		const firstSignal = mocks.estimate.mock.calls[0][2] as AbortSignal;

		render([FIRST, SECOND]);
		expect(firstSignal.aborted).toBe(true);
		await advance(300);
		expect(latest().status).toBe('success');
		expect(asyncData(latest())).toMatchObject({ total: '1500' });

		React.act(() => resolveFirst([{ total: '999999' }]));
		await advance(0);
		expect(asyncData(latest())).toMatchObject({ total: '1500' });
	});

	it('surfaces a failed quote as a retryable application error', async () => {
		mocks.estimate.mockRejectedValueOnce(new Error('gateway down'));
		render([FIRST]);
		await advance(300);
		const failed = latest();
		expect(failed.status).toBe('error');
		expect(failed.status === 'error' && failed.error).toMatchObject({ code: 'unavailable', retryable: true });

		React.act(() => retry());
		expect(latest().status).toBe('loading');
		await advance(300);
		expect(latest().status).toBe('success');
	});

	it('abandons an in-flight quote when the dialog closes', async () => {
		render([FIRST]);
		await advance(300);
		const signal = mocks.estimate.mock.calls[0][2] as AbortSignal;
		expect(signal.aborted).toBe(false);
		React.act(() => root.unmount());
		expect(signal.aborted).toBe(true);
		root = createRoot(host);
	});
});
