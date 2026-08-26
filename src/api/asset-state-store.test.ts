import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ readAssetState: vi.fn() }));

vi.mock('./asset-marketplace', () => ({
	readAssetState: mocks.readAssetState,
}));

import { aoRoutingScopeFromLocation } from 'helpers/config';

import { warmAoFetch } from './ao';
import {
	cachedAssetState,
	clearAssetStateCache,
	DISPLAY_STATE_TIMEOUT_ERROR,
	DISPLAY_STATE_TIMEOUT_MS,
	prefetchAssetState,
	prioritizeAssetStatePrefetch,
	readAssetStateCached,
	readAssetStateWithDeadline,
} from './asset-state-store';

const processId = 'P'.repeat(43);
const result = {
	state: { raw: {}, totalSupply: '1' },
	provider: 'https://node.example',
	verifiedAt: 1,
	maxAge: 20,
} as any;

function stubPolicyScope(initialFingerprint: string) {
	let fingerprint = initialFingerprint;
	const providers = [{ url: 'https://andee.example', ownership: 'personal' as const }];
	const aoFetch = vi.fn(async () => new Response()) as unknown as PermawebOsAoFetch;
	aoFetch.invalidate = vi.fn(async () => undefined);
	aoFetch.cacheMetadata = vi.fn(() => undefined);
	Object.defineProperty(aoFetch, 'peers', { value: ['https://hosted.example'] });
	aoFetch.ready = vi.fn(async () => aoFetch.peers);
	aoFetch.networkPolicy = vi.fn(async () => ({
		version: 1 as const,
		fingerprint,
		arweaveGateway: { url: 'https://gateway.example', ownership: 'default' as const },
		permanentContent: { url: 'https://content.example', ownership: 'community' as const },
		publishing: { url: 'https://upload.example', ownership: 'default' as const },
		ao: {
			processReads: providers,
			scheduleReads: providers,
			linkedStateReads: providers,
			observerRelay: { url: 'https://hosted.example', ownership: 'default' as const },
			fallbackMode: 'custom' as const,
		},
	}));
	const scope = Object.assign(new EventTarget(), {
		aoFetch,
		location: {
			protocol: 'https:',
			hostname: 'bazar.example',
			port: '',
			search: '',
			hash: '',
		},
	});
	vi.stubGlobal('window', scope);
	return {
		stop: warmAoFetch(),
		update(nextFingerprint: string) {
			fingerprint = nextFingerprint;
			scope.dispatchEvent(new Event('aoFetchLoaded'));
		},
	};
}

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

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
		expect(mocks.readAssetState).toHaveBeenCalledWith(processId, expect.objectContaining({ maxAge: 60 }));
	});

	it('does not reuse cached state after an opaque route fingerprint changes', async () => {
		const policy = stubPolicyScope('custom-routes-one');

		await vi.waitFor(() => expect(aoRoutingScopeFromLocation()).toBe('custom-routes-one'));
		await readAssetStateCached(processId);
		expect(cachedAssetState(processId)).toBe(result);

		policy.update('custom-routes-two');
		await vi.waitFor(() => expect(aoRoutingScopeFromLocation()).toBe('custom-routes-two'));

		expect(cachedAssetState(processId)).toBeUndefined();
		await readAssetStateCached(processId);
		expect(mocks.readAssetState).toHaveBeenCalledTimes(2);
		policy.stop();
	});

	it('does not join an active prefetch from an obsolete route fingerprint', async () => {
		const policy = stubPolicyScope('custom-routes-one');
		const pending: Array<(value: typeof result) => void> = [];
		mocks.readAssetState.mockImplementation(
			() =>
				new Promise((resolve) => {
					pending.push(resolve);
				})
		);
		await vi.waitFor(() => expect(aoRoutingScopeFromLocation()).toBe('custom-routes-one'));

		const oldPrefetch = prefetchAssetState(processId);
		await vi.waitFor(() => expect(pending).toHaveLength(1));
		policy.update('custom-routes-two');
		await vi.waitFor(() => expect(aoRoutingScopeFromLocation()).toBe('custom-routes-two'));
		const newPrefetch = prefetchAssetState(processId);
		await vi.waitFor(() => expect(pending).toHaveLength(2));

		const oldResult = { ...result, provider: 'https://old.example' };
		const newResult = { ...result, provider: 'https://new.example' };
		pending[1]!(newResult);
		await expect(newPrefetch).resolves.toBe(newResult);
		pending[0]!(oldResult);
		await expect(oldPrefetch).resolves.toBe(oldResult);
		expect(cachedAssetState(processId)).toBe(newResult);
		policy.stop();
	});

	it('drops queued prefetch work from an obsolete route fingerprint', async () => {
		const policy = stubPolicyScope('custom-routes-one');
		const blockerIds = ['A', 'B'].map((letter) => letter.repeat(43));
		const pending = new Map<string, (value: typeof result) => void>();
		mocks.readAssetState.mockImplementation(
			(id) =>
				new Promise((resolve) => {
					pending.set(id, resolve);
				})
		);
		await vi.waitFor(() => expect(aoRoutingScopeFromLocation()).toBe('custom-routes-one'));

		const blockers = blockerIds.map(prefetchAssetState);
		await vi.waitFor(() => expect(mocks.readAssetState).toHaveBeenCalledTimes(2));
		const oldPrefetch = prefetchAssetState(processId);
		policy.update('custom-routes-two');
		await vi.waitFor(() => expect(aoRoutingScopeFromLocation()).toBe('custom-routes-two'));
		const newPrefetch = prefetchAssetState(processId);

		for (const id of blockerIds) pending.get(id)!(result);
		await expect(oldPrefetch).resolves.toBeUndefined();
		await vi.waitFor(() => expect(pending.has(processId)).toBe(true));
		const newResult = { ...result, provider: 'https://new.example' };
		pending.get(processId)!(newResult);
		await expect(newPrefetch).resolves.toBe(newResult);
		await expect(Promise.all(blockers)).resolves.toEqual([result, result]);
		policy.stop();
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

	it('does not cache a late result after its only consumer leaves', async () => {
		let release!: (value: typeof result) => void;
		mocks.readAssetState.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					release = resolve;
				})
		);
		const controller = new AbortController();
		const pending = readAssetStateCached(processId, { signal: controller.signal });

		controller.abort(new DOMException('Route changed', 'AbortError'));
		await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
		release(result);
		await Promise.resolve();
		await Promise.resolve();

		expect(cachedAssetState(processId)).toBeUndefined();
	});

	it('bounds a shared foreground read even when the transport ignores abort', async () => {
		vi.useFakeTimers();
		let requestSignal!: AbortSignal;
		mocks.readAssetState.mockImplementationOnce(
			(_processId, options) =>
				new Promise(() => {
					requestSignal = options.signal;
				})
		);
		const pending = readAssetStateCached(processId);
		const rejected = expect(pending).rejects.toThrow(DISPLAY_STATE_TIMEOUT_ERROR);

		await vi.advanceTimersByTimeAsync(DISPLAY_STATE_TIMEOUT_MS);
		await rejected;

		expect(requestSignal.aborted).toBe(true);
		mocks.readAssetState.mockResolvedValueOnce(result);
		await readAssetStateCached(processId);
		expect(mocks.readAssetState).toHaveBeenCalledTimes(2);
	});

	it('separately bounds stale revalidation without replacing the cached state after timeout', async () => {
		vi.useFakeTimers();
		let requestSignal!: AbortSignal;
		let resolveRevalidation!: (value: typeof result) => void;
		const fresh = { ...result, verifiedAt: 2 };
		mocks.readAssetState.mockImplementationOnce((_processId, options) => {
			requestSignal = options.signal;
			return Promise.resolve({
				...result,
				cacheStatus: 'stale',
				revalidation: new Promise<typeof result>((resolve) => {
					resolveRevalidation = resolve;
				}),
			});
		});

		const stale = await readAssetStateCached(processId);
		const rejected = expect(stale.revalidation).rejects.toThrow(DISPLAY_STATE_TIMEOUT_ERROR);
		await vi.advanceTimersByTimeAsync(DISPLAY_STATE_TIMEOUT_MS);
		await rejected;

		expect(requestSignal.aborted).toBe(true);
		resolveRevalidation(fresh);
		await Promise.resolve();
		expect(cachedAssetState(processId)?.verifiedAt).toBe(result.verifiedAt);
	});

	it('bounds direct foreground preflight reads with the caller abort signal', async () => {
		vi.useFakeTimers();
		let requestSignal!: AbortSignal;
		mocks.readAssetState.mockImplementationOnce(
			(_processId, options) =>
				new Promise(() => {
					requestSignal = options.signal;
				})
		);
		const prepareOrDispatch = vi.fn();
		const pending = readAssetStateWithDeadline(processId, { maxAge: 0 }).then(prepareOrDispatch);
		const rejected = expect(pending).rejects.toThrow(DISPLAY_STATE_TIMEOUT_ERROR);

		await vi.advanceTimersByTimeAsync(DISPLAY_STATE_TIMEOUT_MS);
		await rejected;

		expect(requestSignal.aborted).toBe(true);
		expect(prepareOrDispatch).not.toHaveBeenCalled();
		expect(mocks.readAssetState).toHaveBeenCalledWith(
			processId,
			expect.objectContaining({ maxAge: 0, signal: requestSignal })
		);
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
