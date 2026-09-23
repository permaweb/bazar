// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ loadMore: vi.fn() }));

vi.mock('providers/MarketProvider', () => ({ useMarketProvider: () => ({ loadMore: mocks.loadMore }) }));

import { useCollectionMoreRecords } from 'features/Collection/hooks/useCollectionMoreRecords';
import { appError } from 'helpers/app-error';

import { assetSummary, collectionFixture } from '../../../fixtures/collection';
import { deferred, renderHook, settle } from '../../../test-utils/render-hook';

const collection = collectionFixture([assetSummary(1)], { hasMore: true });

function render(gateway = 'https://gateway.example') {
	return renderHook(
		(props: { gateway: string }) => useCollectionMoreRecords(collection.id, collection, props.gateway),
		{ gateway }
	);
}

beforeEach(() => {
	mocks.loadMore.mockReset();
});

describe('useCollectionMoreRecords', () => {
	it('requests the next page once at a time and reports how many records it added', async () => {
		const request = deferred<number>();
		mocks.loadMore.mockReturnValue(request.promise);
		const harness = render();
		expect(harness.current().state).toEqual({ status: 'idle' });

		let started = false;
		await settle(() => {
			started = harness.current().loadMore();
		});
		expect(started).toBe(true);
		expect(harness.current().state).toEqual({ status: 'loading' });
		expect(harness.current().loadMore()).toBe(false);
		expect(mocks.loadMore).toHaveBeenCalledTimes(1);
		expect(mocks.loadMore).toHaveBeenCalledWith(collection.id, expect.any(AbortSignal));

		await settle(async () => {
			request.resolve(12);
			await request.promise;
		});
		expect(harness.current().state).toEqual({ status: 'success', data: 12 });
		harness.unmount();
	});

	it('normalizes a failed page into an index error and allows another attempt', async () => {
		const request = deferred<number>();
		void request.promise.catch(() => undefined);
		mocks.loadMore.mockReturnValue(request.promise);
		const harness = render();
		await settle(() => void harness.current().loadMore());
		await settle(() => request.reject(appError('rate-limited')));

		const state = harness.current().state;
		expect(state.status).toBe('error');
		expect(state.status === 'error' && state.error.reason).toBe('index-rate-limited');
		await settle(() => expect(harness.current().loadMore()).toBe(true));
		await settle();
		expect(mocks.loadMore).toHaveBeenCalledTimes(2);
		harness.unmount();
	});

	it('abandons an in-flight page when the gateway changes', async () => {
		const request = deferred<number>();
		mocks.loadMore.mockReturnValue(request.promise);
		const harness = render();
		await settle(() => void harness.current().loadMore());
		const signal = mocks.loadMore.mock.calls[0][1] as AbortSignal;

		harness.rerender({ gateway: 'https://other.example' });
		expect(signal.aborted).toBe(true);
		expect(harness.current().state).toEqual({ status: 'idle' });

		await settle(async () => {
			request.resolve(5);
			await request.promise;
		});
		expect(harness.current().state).toEqual({ status: 'idle' });
		await settle(() => expect(harness.current().loadMore()).toBe(true));
		harness.unmount();
	});

	it('aborts the request it started when the page unmounts', async () => {
		const request = deferred<number>();
		mocks.loadMore.mockReturnValue(request.promise);
		const harness = render();
		await settle(() => void harness.current().loadMore());
		const signal = mocks.loadMore.mock.calls[0][1] as AbortSignal;

		harness.unmount();
		expect(signal.aborted).toBe(true);
		await settle(async () => {
			request.resolve(1);
			await request.promise;
		});
	});
});
