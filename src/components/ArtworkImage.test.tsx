import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	advanceArtworkLoad,
	ARTWORK_CANDIDATE_TIMEOUT_MS,
	type ArtworkCandidateImage,
	ArtworkImage,
	type ArtworkLoadEvent,
	artworkLoadIsEmpty,
	type ArtworkLoadState,
	type ArtworkRacers,
	cancelArtworkRacers,
	initialArtworkLoadState,
	observeArtworkVisibility,
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

	it('starts the candidate clock on intersection, or at once without IntersectionObserver', () => {
		const visible = vi.fn();
		const cleanup = observeArtworkVisibility({} as Element, visible, undefined);
		expect(visible).toHaveBeenCalledOnce();
		cleanup();

		let notify: IntersectionObserverCallback = () => undefined;
		const observe = vi.fn();
		const disconnect = vi.fn();
		class StubObserver {
			constructor(callback: IntersectionObserverCallback) {
				notify = callback;
			}
			observe = observe;
			disconnect = disconnect;
		}
		const element = {} as Element;
		const onVisible = vi.fn();
		const stop = observeArtworkVisibility(
			element,
			onVisible,
			StubObserver as unknown as typeof IntersectionObserver
		);
		expect(observe).toHaveBeenCalledWith(element);

		notify([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
		expect(onVisible).not.toHaveBeenCalled();
		notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
		expect(onVisible).toHaveBeenCalledOnce();
		expect(disconnect).toHaveBeenCalledOnce();
		stop();
		expect(disconnect).toHaveBeenCalledTimes(2);
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
});
