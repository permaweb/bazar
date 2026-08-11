import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ readAssetState: vi.fn() }));

vi.mock('./asset-marketplace', () => ({
	readAssetState: mocks.readAssetState,
	servingNodeOrigins: () => ['https://node.example'],
}));

import {
	cachedAssetState,
	clearAssetStateCache,
	prefetchAssetState,
	prioritizeAssetStatePrefetch,
	readAssetStateCached,
} from './asset-state-store';

const processId = 'P'.repeat(43);
const result = {
	state: { raw: {}, totalSupply: '1' },
	provider: 'https://node.example',
	verifiedAt: 1,
	maxAge: 20,
} as any;

describe('asset state store', () => {
	beforeEach(() => {
		clearAssetStateCache();
		mocks.readAssetState.mockReset();
		mocks.readAssetState.mockResolvedValue(result);
	});

	it('deduplicates concurrent reads and reuses a fresh result', async () => {
		await Promise.all([readAssetStateCached(processId), readAssetStateCached(processId)]);
		await readAssetStateCached(processId);
		expect(mocks.readAssetState).toHaveBeenCalledTimes(1);
	});

	it('can force a commerce-safe revalidation', async () => {
		await readAssetStateCached(processId);
		await readAssetStateCached(processId, { force: true, maxAge: 0 });
		expect(mocks.readAssetState).toHaveBeenCalledTimes(2);
		expect(mocks.readAssetState).toHaveBeenLastCalledWith(processId, expect.objectContaining({ maxAge: 0 }));
	});

	it('does not let a relaxed in-flight read suppress a stricter read', async () => {
		let release!: () => void;
		mocks.readAssetState.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					release = () => resolve(result);
				})
		);
		const relaxed = readAssetStateCached(processId, { maxAge: 30 });
		const strict = readAssetStateCached(processId, { force: true, maxAge: 0 });

		expect(mocks.readAssetState).toHaveBeenCalledTimes(2);
		release();
		await Promise.all([relaxed, strict]);
	});

	it('keeps shared work alive while another consumer still needs it', async () => {
		let release!: () => void;
		let sharedSignal!: AbortSignal;
		mocks.readAssetState.mockImplementationOnce(
			(_processId, options) =>
				new Promise((resolve) => {
					sharedSignal = options.signal;
					release = () => resolve(result);
				})
		);
		const leftController = new AbortController();
		const rightController = new AbortController();
		const left = readAssetStateCached(processId, { signal: leftController.signal });
		const right = readAssetStateCached(processId, { signal: rightController.signal });

		leftController.abort(new DOMException('Route changed', 'AbortError'));
		await expect(left).rejects.toMatchObject({ name: 'AbortError' });
		expect(sharedSignal.aborted).toBe(false);
		release();
		await expect(right).resolves.toBe(result);
	});

	it('aborts shared work when its final consumer leaves', async () => {
		let sharedSignal!: AbortSignal;
		mocks.readAssetState.mockImplementationOnce(
			(_processId, options) =>
				new Promise((_resolve, reject) => {
					sharedSignal = options.signal;
					sharedSignal.addEventListener('abort', () => reject(sharedSignal.reason), { once: true });
				})
		);
		const controller = new AbortController();
		const pending = readAssetStateCached(processId, { signal: controller.signal });

		controller.abort(new DOMException('Route changed', 'AbortError'));
		await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
		expect(sharedSignal.aborted).toBe(true);
	});

	it('counts a prefetch joining visible work as an active consumer', async () => {
		let release!: () => void;
		let sharedSignal!: AbortSignal;
		mocks.readAssetState.mockImplementationOnce(
			(_processId, options) =>
				new Promise((resolve) => {
					sharedSignal = options.signal;
					release = () => resolve(result);
				})
		);
		const controller = new AbortController();
		const visible = readAssetStateCached(processId, { signal: controller.signal });
		const prefetch = prefetchAssetState(processId);

		controller.abort(new DOMException('Route changed', 'AbortError'));
		await expect(visible).rejects.toMatchObject({ name: 'AbortError' });
		expect(sharedSignal.aborted).toBe(false);
		release();
		await expect(prefetch).resolves.toBe(result);
	});

	it('retires unrelated hover work when an asset is opened', async () => {
		const ids = ['A', 'B', 'C', 'D'].map((letter) => letter.repeat(43));
		const pending = new Map<string, { resolve: (value: typeof result) => void; signal: AbortSignal }>();
		mocks.readAssetState.mockImplementation(
			(id, options) =>
				new Promise((resolve, reject) => {
					pending.set(id, { resolve, signal: options.signal });
					options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
				})
		);
		const prefetches = ids.map(prefetchAssetState);

		expect(mocks.readAssetState.mock.calls.map(([id]) => id)).toEqual(ids.slice(0, 2));
		const opened = prioritizeAssetStatePrefetch(ids[2]);
		await vi.waitFor(() => expect(mocks.readAssetState.mock.calls.map(([id]) => id)).toContain(ids[2]));

		expect(pending.get(ids[0])!.signal.aborted).toBe(true);
		expect(pending.get(ids[1])!.signal.aborted).toBe(true);
		expect(mocks.readAssetState.mock.calls.map(([id]) => id)).not.toContain(ids[3]);
		pending.get(ids[2])!.resolve(result);
		await expect(opened).resolves.toBe(result);
		await expect(Promise.all(prefetches)).resolves.toEqual([undefined, undefined, result, undefined]);
	});

	it('keeps visible shared work alive while retiring its hover consumer', async () => {
		const ids = ['A', 'B', 'C', 'D'].map((letter) => letter.repeat(43));
		const pending = new Map<string, { resolve: (value: typeof result) => void; signal: AbortSignal }>();
		mocks.readAssetState.mockImplementation(
			(id, options) =>
				new Promise((resolve, reject) => {
					pending.set(id, { resolve, signal: options.signal });
					options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
				})
		);
		const visibleController = new AbortController();
		const visible = readAssetStateCached(ids[0], { signal: visibleController.signal });
		const hovered = prefetchAssetState(ids[0]);
		const otherPrefetches = ids.slice(1).map(prefetchAssetState);

		void prioritizeAssetStatePrefetch(ids[2]);
		await vi.waitFor(() => expect(mocks.readAssetState.mock.calls.map(([id]) => id)).toContain(ids[2]));

		expect(pending.get(ids[0])!.signal.aborted).toBe(false);
		expect(mocks.readAssetState.mock.calls.map(([id]) => id)).not.toContain(ids[3]);
		pending.get(ids[0])!.resolve(result);
		pending.get(ids[2])!.resolve(result);
		await expect(visible).resolves.toBe(result);
		await expect(hovered).resolves.toBeUndefined();
		await Promise.all(otherPrefetches);
	});

	it('publishes a persistent stale response immediately and reports its fresh replacement', async () => {
		const fresh = { ...result, verifiedAt: 2 };
		mocks.readAssetState.mockResolvedValue({
			...result,
			cacheStatus: 'stale',
			revalidation: Promise.resolve(fresh),
		});
		const onRevalidated = vi.fn();

		const stale = await readAssetStateCached(processId, {
			maxAge: 30,
			staleWhileRevalidate: 86_400,
			onRevalidated,
		});
		await vi.waitFor(() => expect(onRevalidated).toHaveBeenCalledWith(fresh));

		expect(stale.cacheStatus).toBe('stale');
		expect(mocks.readAssetState).toHaveBeenCalledWith(
			processId,
			expect.objectContaining({ maxAge: 30, staleWhileRevalidate: 86_400 })
		);
	});

	it('bounds parsed state retained while traversing large collections', async () => {
		const processIds = Array.from({ length: 257 }, (_, index) => index.toString(36).padStart(43, 'A'));
		for (const id of processIds) await readAssetStateCached(id);

		expect(cachedAssetState(processIds[0])).toBeUndefined();
		expect(cachedAssetState(processIds.at(-1)!)).toBe(result);
	});
});
