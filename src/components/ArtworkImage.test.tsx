import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	acquireArtworkSlot,
	advanceArtworkLoad,
	ARTWORK_CANDIDATE_TIMEOUT_MS,
	ARTWORK_HOST_CONCURRENCY,
	ARTWORK_PRELOAD_MARGIN,
	ARTWORK_RETRY_DELAY_MS,
	type ArtworkCandidateImage,
	artworkFailurePlan,
	artworkFetchPriority,
	artworkHasStarted,
	ArtworkImage,
	artworkInViewport,
	type ArtworkLoadEvent,
	artworkLoadIsEmpty,
	type ArtworkLoadState,
	type ArtworkRacers,
	artworkSlotHost,
	type ArtworkSlotQueues,
	type ArtworkStartState,
	artworkVisibleSrc,
	artworkWantsSlot,
	cancelArtworkRacers,
	initialArtworkLoadState,
	observeArtworkNearness,
	settleArtworkImage,
	startArtworkCandidate,
	startArtworkCandidateTimer,
	syncArtworkRacers,
} from './ArtworkImage';

function fakeImage(size = { naturalWidth: 640, naturalHeight: 480 }, decodes = true) {
	const image = {
		...size,
		decoding: 'auto',
		src: '',
		onload: null,
		onerror: null,
		decode: vi.fn(() => (decodes ? Promise.resolve() : Promise.reject(new Error('EncodingError')))),
		removeAttribute: vi.fn((name: string) => {
			if (name === 'src') image.src = '';
		}),
	} as unknown as ArtworkCandidateImage & { onload: () => void; onerror: () => void };
	return image;
}

function reduce(state: ArtworkLoadState, ...events: ArtworkLoadEvent[]) {
	return events.reduce(advanceArtworkLoad, state);
}

afterEach(() => {
	vi.useRealTimers();
});

describe('ArtworkImage', () => {
	it('passes image fetch priority through React 18 as a native DOM attribute', () => {
		const markup = renderToStaticMarkup(
			<ArtworkImage alt="Priority artwork" fetchPriority="high" loading="eager" src="/artwork.png" />
		);

		expect(markup).toContain('fetchpriority="high"');
		expect(markup).not.toContain('fetchPriority');
	});

	it('lazy-loads and asynchronously decodes grid images by default and keeps explicit dimensions', () => {
		const markup = renderToStaticMarkup(<ArtworkImage height={240} src="/artwork.png" width={320} />);

		expect(markup).toContain('loading="lazy"');
		expect(markup).toContain('decoding="async"');
		expect(markup).toContain('width="320"');
		expect(markup).toContain('height="240"');
	});

	it('gives lazy artwork no src until it is near the viewport and holds a slot, and eager artwork one at once', () => {
		const lazy = renderToStaticMarkup(<ArtworkImage src="https://arweave.net/raw/lazy" />);
		const eager = renderToStaticMarkup(<ArtworkImage loading="eager" src="https://arweave.net/raw/eager" />);
		const high = renderToStaticMarkup(<ArtworkImage fetchPriority="high" src="https://arweave.net/raw/high" />);

		expect(lazy).not.toContain('src=');
		expect(lazy).toContain('is-loading');
		expect(eager).toContain('src="https://arweave.net/raw/eager"');
		expect(high).toContain('src="https://arweave.net/raw/high"');
		expect(high).toContain('fetchpriority="high"');
	});

	it('treats only an undecodable image without size as an empty load', () => {
		expect(artworkLoadIsEmpty({ naturalWidth: 0, naturalHeight: 0 }, false)).toBe(true);
		expect(artworkLoadIsEmpty({ naturalWidth: 0, naturalHeight: 0 }, true)).toBe(false);
		expect(artworkLoadIsEmpty({ naturalWidth: 1, naturalHeight: 1 }, false)).toBe(false);
	});

	it('keeps an SVG without intrinsic size that decodes', async () => {
		await expect(settleArtworkImage(fakeImage({ naturalWidth: 0, naturalHeight: 0 }))).resolves.toBe('loaded');
		await expect(settleArtworkImage(fakeImage({ naturalWidth: 0, naturalHeight: 0 }, false))).resolves.toBe(
			'failed'
		);
		await expect(settleArtworkImage(fakeImage(undefined, false))).resolves.toBe('loaded');
	});

	it('keeps the current candidate downloading when its timeout starts the next one', () => {
		const state = reduce(initialArtworkLoadState, { type: 'timeout', nextIndex: 1, sourceCount: 3 });
		expect(state).toEqual({ sourceIndex: 0, pending: [0, 1], nextIndex: 2, status: 'loading' });

		expect(reduce(state, { type: 'loaded', sourceIndex: 0, sourceCount: 3 })).toEqual({
			sourceIndex: 0,
			pending: [],
			nextIndex: 2,
			status: 'loaded',
		});
	});

	it('shows whichever racing candidate loads first and drops the rest', () => {
		const state = reduce(
			initialArtworkLoadState,
			{ type: 'timeout', nextIndex: 1, sourceCount: 3 },
			{ type: 'timeout', nextIndex: 2, sourceCount: 3 },
			{ type: 'loaded', sourceIndex: 1, sourceCount: 3 }
		);
		expect(state).toEqual({ sourceIndex: 1, pending: [1], nextIndex: 3, status: 'loading' });
		expect(reduce(state, { type: 'loaded', sourceIndex: 0, sourceCount: 3 })).toBe(state);
		expect(reduce(state, { type: 'failed', sourceIndex: 2, sourceCount: 3 })).toBe(state);
		expect(reduce(state, { type: 'loaded', sourceIndex: 1, sourceCount: 3 }).status).toBe('loaded');
	});

	it('waits on a racing candidate when the visible one fails, then moves on when none is left', () => {
		let state = reduce(
			initialArtworkLoadState,
			{ type: 'timeout', nextIndex: 1, sourceCount: 3 },
			{ type: 'failed', sourceIndex: 0, sourceCount: 3 }
		);
		expect(state).toEqual({ sourceIndex: 0, pending: [1], nextIndex: 2, status: 'loading' });

		state = reduce(state, { type: 'failed', sourceIndex: 1, sourceCount: 3 });
		expect(state).toEqual({ sourceIndex: 2, pending: [2], nextIndex: 3, status: 'loading' });

		expect(reduce(state, { type: 'timeout', nextIndex: 3, sourceCount: 3 })).toBe(state);
		expect(reduce(state, { type: 'failed', sourceIndex: 2, sourceCount: 3 })).toEqual({
			sourceIndex: 2,
			pending: [],
			nextIndex: 3,
			status: 'error',
		});
	});

	it('advances straight to the next candidate on a native failure with nothing racing', () => {
		expect(reduce(initialArtworkLoadState, { type: 'failed', sourceIndex: 0, sourceCount: 2 })).toEqual({
			sourceIndex: 1,
			pending: [1],
			nextIndex: 2,
			status: 'loading',
		});
		expect(reduce(initialArtworkLoadState, { type: 'failed', sourceIndex: 0, sourceCount: 1 }).status).toBe(
			'error'
		);
		expect(reduce(initialArtworkLoadState, { type: 'timeout', nextIndex: 1, sourceCount: 1 })).toBe(
			initialArtworkLoadState
		);
	});

	it('ignores stale timeouts and events after the image settles', () => {
		const racing = reduce(initialArtworkLoadState, { type: 'timeout', nextIndex: 1, sourceCount: 3 });
		expect(reduce(racing, { type: 'timeout', nextIndex: 1, sourceCount: 3 })).toBe(racing);

		const loaded = reduce(racing, { type: 'loaded', sourceIndex: 0, sourceCount: 3 });
		expect(reduce(loaded, { type: 'timeout', nextIndex: 2, sourceCount: 3 })).toBe(loaded);
		expect(reduce(loaded, { type: 'failed', sourceIndex: 0, sourceCount: 3 })).toBe(loaded);
		expect(reduce(loaded, { type: 'reset' })).toBe(initialArtworkLoadState);
	});

	it('loads a racing candidate in a detached image and aborts it when dropped', async () => {
		const image = fakeImage();
		const settled = vi.fn();
		const cancel = startArtworkCandidate('https://ardrive.net/raw/id', settled, () => image);
		expect(image.src).toBe('https://ardrive.net/raw/id');
		expect(image.decoding).toBe('async');

		image.onload();
		await vi.waitFor(() => expect(settled).toHaveBeenCalledWith('loaded'));

		const failing = fakeImage();
		const failed = vi.fn();
		startArtworkCandidate('https://arweave.net/raw/id', failed, () => failing);
		failing.onerror();
		expect(failed).toHaveBeenCalledWith('failed');

		cancel();
		expect(image.onload).toBeNull();
		expect(image.removeAttribute).toHaveBeenCalledWith('src');
		expect(image.src).toBe('');
	});

	it('reports nothing from a candidate dropped while it decodes', async () => {
		const image = fakeImage();
		const settled = vi.fn();
		const cancel = startArtworkCandidate('https://ardrive.net/raw/id', settled, () => image);
		const onload = image.onload;
		onload();
		cancel();
		await Promise.resolve();
		await Promise.resolve();
		expect(settled).not.toHaveBeenCalled();
	});

	it('starts new racers without restarting running ones', () => {
		const racers: ArtworkRacers = new Map();
		const cancels = new Map<number, ReturnType<typeof vi.fn>>();
		const start = vi.fn((index: number) => {
			const cancel = vi.fn();
			cancels.set(index, cancel);
			return cancel;
		});

		syncArtworkRacers(racers, [{ index: 1, src: 'b' }], start);
		syncArtworkRacers(
			racers,
			[
				{ index: 1, src: 'b' },
				{ index: 2, src: 'c' },
			],
			start
		);
		expect(start.mock.calls.map(([index]) => index)).toEqual([1, 2]);
		expect(cancels.get(1)).not.toHaveBeenCalled();

		syncArtworkRacers(racers, [{ index: 2, src: 'c' }], start);
		expect(cancels.get(1)).toHaveBeenCalledOnce();
		expect([...racers.keys()]).toEqual([2]);

		const replaced = cancels.get(2);
		syncArtworkRacers(racers, [{ index: 2, src: 'changed' }], start);
		expect(replaced).toHaveBeenCalledOnce();
		expect(start).toHaveBeenCalledTimes(3);

		cancelArtworkRacers(racers);
		expect(racers.size).toBe(0);
	});

	it('reports nearness each time it changes, or near at once without IntersectionObserver', () => {
		const visible = vi.fn();
		const cleanup = observeArtworkNearness({} as Element, visible, undefined);
		expect(visible).toHaveBeenCalledExactlyOnceWith(true);
		cleanup();

		let notify: IntersectionObserverCallback = () => undefined;
		const observe = vi.fn();
		const disconnect = vi.fn();
		const options: Array<IntersectionObserverInit | undefined> = [];
		class StubObserver {
			constructor(callback: IntersectionObserverCallback, init?: IntersectionObserverInit) {
				notify = callback;
				options.push(init);
			}
			observe = observe;
			disconnect = disconnect;
		}
		const element = {} as Element;
		const onChange = vi.fn();
		const stop = observeArtworkNearness(
			element,
			onChange,
			StubObserver as unknown as typeof IntersectionObserver,
			ARTWORK_PRELOAD_MARGIN
		);
		expect(observe).toHaveBeenCalledWith(element);
		expect(options).toEqual([{ rootMargin: '200px' }]);

		const entry = (isIntersecting: boolean) => ({ isIntersecting } as IntersectionObserverEntry);
		notify([entry(false)], {} as IntersectionObserver);
		notify([entry(true)], {} as IntersectionObserver);
		// A fast scroll can batch several records for one element; the latest one wins.
		notify([entry(true), entry(false)], {} as IntersectionObserver);
		expect(onChange.mock.calls).toEqual([[false], [true], [false]]);
		expect(disconnect).not.toHaveBeenCalled();
		stop();
		expect(disconnect).toHaveBeenCalledOnce();
	});

	it('starts queued lazy artwork at once when it becomes eager or high priority after mount', () => {
		const sources = ['https://arweave.net/raw/a', 'https://ardrive.net/raw/a'];
		const queued: ArtworkStartState = {
			...initialArtworkLoadState,
			scheduled: true,
			started: false,
			near: true,
		};
		expect(artworkHasStarted(queued)).toBe(false);
		expect(artworkVisibleSrc(queued, sources)).toBeUndefined();
		expect(artworkWantsSlot(queued)).toBe(true);

		// A re-sort moves the card to index 0: it gives up its place in the queue and gets a src.
		const promoted = { ...queued, scheduled: false };
		expect(artworkWantsSlot(promoted)).toBe(false);
		expect(artworkHasStarted(promoted)).toBe(true);
		expect(artworkVisibleSrc(promoted, sources)).toBe(sources[0]);

		// Once latched as started, moving back down keeps the download in flight.
		expect(artworkVisibleSrc({ ...queued, started: true }, sources)).toBe(sources[0]);
		// A fallback candidate is shown by index; the retry pause shows none.
		expect(artworkVisibleSrc({ ...promoted, sourceIndex: 1 }, sources)).toBe(sources[1]);
		expect(artworkVisibleSrc({ ...promoted, status: 'error' }, sources)).toBeUndefined();
	});

	it('leaves the slot queue when queued artwork scrolls out of the preload margin, not once granted', () => {
		const queued: ArtworkStartState = {
			...initialArtworkLoadState,
			scheduled: true,
			started: false,
			near: true,
		};
		expect(artworkWantsSlot(queued)).toBe(true);
		expect(artworkWantsSlot({ ...queued, near: false })).toBe(false);
		expect(artworkWantsSlot({ ...queued, near: false, started: true })).toBe(true);
		expect(artworkWantsSlot({ ...queued, nextIndex: 2 })).toBe(false);
		expect(artworkWantsSlot({ ...queued, sourceIndex: 1, nextIndex: 2 })).toBe(false);
		expect(artworkWantsSlot({ ...queued, status: 'loaded' })).toBe(false);
	});

	it('grants slots to on-screen artwork first once cards scrolled past have left the queue', async () => {
		const queues: ArtworkSlotQueues = new Map();
		const granted: number[] = [];
		const release = Array.from({ length: 10 }, (_, index) =>
			acquireArtworkSlot(`https://arweave.net/raw/${index}`, () => granted.push(index), { queues, limit: 2 })
		);
		await Promise.resolve();
		expect(granted).toEqual([0, 1]);
		// A fast scroll passed cards 2-7 while they were queued; they leave the queue.
		for (const index of [2, 3, 4, 5, 6, 7]) release[index]();
		release[0]();
		release[1]();
		await new Promise((resolve) => setTimeout(resolve));
		expect(granted).toEqual([0, 1, 8, 9]);
		release.forEach((done) => done());
	});

	it('races the next candidate after eight seconds while a slow first one keeps downloading', () => {
		vi.useFakeTimers();
		expect(ARTWORK_CANDIDATE_TIMEOUT_MS).toBe(8_000);
		const sourceCount = 3;
		let state = initialArtworkLoadState;
		const dispatch = (event: ArtworkLoadEvent) => {
			state = advanceArtworkLoad(state, event);
		};

		let stop = startArtworkCandidateTimer(state, sourceCount, dispatch);
		vi.advanceTimersByTime(7_999);
		expect(state).toBe(initialArtworkLoadState);
		vi.advanceTimersByTime(1);
		expect(state).toEqual({ sourceIndex: 0, pending: [0, 1], nextIndex: 2, status: 'loading' });

		stop = startArtworkCandidateTimer(state, sourceCount, dispatch);
		vi.advanceTimersByTime(4_000);
		dispatch({ type: 'loaded', sourceIndex: 0, sourceCount });
		stop();
		vi.advanceTimersByTime(8_000);
		expect(state).toEqual({ sourceIndex: 0, pending: [], nextIndex: 2, status: 'loaded' });
		expect(startArtworkCandidateTimer(state, sourceCount, dispatch)).toBeTypeOf('function');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('charges each host its own slot budget and grants waiting artwork in arrival order', () => {
		const queues: ArtworkSlotQueues = new Map();
		expect(ARTWORK_HOST_CONCURRENCY).toBe(6);
		const granted: string[] = [];
		const release = Array.from({ length: 8 }, (_, index) =>
			acquireArtworkSlot(`https://arweave.net/raw/${index}`, () => granted.push(`a${index}`), {
				queues,
				limit: 6,
			})
		);
		const other = acquireArtworkSlot('https://ardrive.net/raw/x', () => granted.push('ardrive'), {
			queues,
			limit: 6,
		});
		return Promise.resolve().then(async () => {
			expect(granted).toEqual(['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'ardrive']);
			// Leaving the queue before the grant gives up the place without spending a slot.
			release[6]();
			release[0]();
			await new Promise((resolve) => setTimeout(resolve));
			expect(granted).toEqual(['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'ardrive', 'a7']);
			release.forEach((done) => done());
			other();
		});
	});

	it('frees a slot held by a stalled download after the hold limit', async () => {
		vi.useFakeTimers();
		const queues: ArtworkSlotQueues = new Map();
		const granted: number[] = [];
		const first = acquireArtworkSlot('https://arweave.net/raw/a', () => granted.push(1), {
			queues,
			limit: 1,
			maxHoldMs: 8_000,
		});
		const second = acquireArtworkSlot('https://arweave.net/raw/b', () => granted.push(2), {
			queues,
			limit: 1,
			maxHoldMs: 8_000,
		});
		await vi.advanceTimersByTimeAsync(0);
		expect(granted).toEqual([1]);
		await vi.advanceTimersByTimeAsync(7_999);
		expect(granted).toEqual([1]);
		await vi.advanceTimersByTimeAsync(1);
		expect(granted).toEqual([1, 2]);
		first();
		second();
		await vi.advanceTimersByTimeAsync(8_000);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('spends no slot on data and blob URLs', () => {
		const queues: ArtworkSlotQueues = new Map();
		const onGranted = vi.fn();
		acquireArtworkSlot('data:image/svg+xml,%3csvg/%3e', onGranted, { queues, limit: 1 });
		expect(onGranted).toHaveBeenCalledOnce();
		expect(queues.size).toBe(0);
		expect(artworkSlotHost('https://arweave.net/raw/id')).toBe('arweave.net');
		expect(artworkSlotHost('/artwork.png', 'https://bazar.arweave.net/')).toBe('bazar.arweave.net');
		expect(artworkSlotHost('blob:https://bazar.arweave.net/1')).toBeUndefined();
	});

	it('fetches artwork started in the preload margin at low priority unless the caller asked otherwise', () => {
		expect(artworkInViewport({ top: 850, bottom: 1050 }, 900)).toBe(true);
		expect(artworkInViewport({ top: 950, bottom: 1150 }, 900)).toBe(false);
		expect(artworkFetchPriority('auto', true, false)).toBe('low');
		expect(artworkFetchPriority(undefined, true, true)).toBeUndefined();
		expect(artworkFetchPriority('auto', true, true)).toBe('auto');
		expect(artworkFetchPriority('high', false, false)).toBe('high');
		expect(artworkFetchPriority(undefined, false, false)).toBeUndefined();
	});

	it('retries failed artwork once after a pause before showing the fallback', () => {
		expect(ARTWORK_RETRY_DELAY_MS).toBe(5_000);
		expect(artworkFailurePlan('loading', false)).toEqual({ show: 'image' });
		expect(artworkFailurePlan('loaded', true)).toEqual({ show: 'image' });
		expect(artworkFailurePlan('error', false)).toEqual({ show: 'image', retryInMs: 5_000 });
		expect(artworkFailurePlan('error', true)).toEqual({ show: 'fallback' });
	});
});
