import React from 'react';
import { ImageOff } from 'lucide-react';

import { aoRoutingScopeFromLocation, arweaveDataFallbackUrls } from 'helpers/config';
import { createKeyedTaskQueue } from 'helpers/keyed-task-queue';

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'onLoad'> & {
	src: string;
	fallback?: React.ReactNode;
};

/** How long a visible candidate may load alone before the next fallback URL starts racing it. */
export const ARTWORK_CANDIDATE_TIMEOUT_MS = 8_000;
/**
 * Lazy artwork downloads in flight per host. A grid would otherwise start every card at once
 * (25 concurrent arweave.net/raw requests per Dumdumz page), and rate-limited gateways answer
 * the burst with 429s.
 */
export const ARTWORK_HOST_CONCURRENCY = 6;
/** Lazy artwork starts this close to the viewport; Chrome's native lazy margin is 1250-2500 px. */
export const ARTWORK_PRELOAD_MARGIN = '200px';
/** After every candidate fails (a 429 burst, a gateway blip), the artwork tries once more after this. */
export const ARTWORK_RETRY_DELAY_MS = 5_000;

export type ArtworkLoadState = {
	/** Candidate rendered by the visible image. */
	sourceIndex: number;
	/** Candidates still downloading: the visible one until it fails, plus detached racers. */
	pending: readonly number[];
	/** Next candidate a timeout may start. */
	nextIndex: number;
	status: 'loading' | 'loaded' | 'error';
};
export type ArtworkLoadEvent =
	| { type: 'reset' }
	| { type: 'loaded' | 'failed'; sourceIndex: number; sourceCount: number }
	| { type: 'timeout'; nextIndex: number; sourceCount: number };
export type ArtworkLoadOutcome = 'loaded' | 'failed';

export const initialArtworkLoadState: ArtworkLoadState = {
	sourceIndex: 0,
	pending: [0],
	nextIndex: 1,
	status: 'loading',
};

/**
 * Race fallback candidates without cancelling one that may still be downloading. A timeout starts
 * the next candidate beside the pending ones; the first candidate to load is shown and the others
 * are dropped. A candidate that fails is removed; when none is pending, the next one is shown.
 */
export function advanceArtworkLoad(state: ArtworkLoadState, event: ArtworkLoadEvent): ArtworkLoadState {
	if (event.type === 'reset') return initialArtworkLoadState;
	if (state.status !== 'loading') return state;
	if (event.type === 'timeout') {
		if (event.nextIndex !== state.nextIndex || state.nextIndex >= event.sourceCount) return state;
		return { ...state, pending: [...state.pending, state.nextIndex], nextIndex: state.nextIndex + 1 };
	}
	if (!state.pending.includes(event.sourceIndex)) return state;
	if (event.type === 'loaded') {
		if (event.sourceIndex === state.sourceIndex) return { ...state, pending: [], status: 'loaded' };
		return { ...state, sourceIndex: event.sourceIndex, pending: [event.sourceIndex] };
	}
	const pending = state.pending.filter((index) => index !== event.sourceIndex);
	if (pending.length) return { ...state, pending };
	if (state.nextIndex < event.sourceCount) {
		return {
			sourceIndex: state.nextIndex,
			pending: [state.nextIndex],
			nextIndex: state.nextIndex + 1,
			status: 'loading',
		};
	}
	return { ...state, pending: [], status: 'error' };
}

/**
 * Gateways can answer 200 with an empty body; a browser may still fire load for it. Such an image
 * is broken, so decode() rejects and it has no size. An SVG without intrinsic size can also report
 * 0x0, but it decodes, so it is kept.
 */
export function artworkLoadIsEmpty(
	image: Pick<HTMLImageElement, 'naturalHeight' | 'naturalWidth'>,
	decoded: boolean
): boolean {
	return !decoded && image.naturalWidth === 0 && image.naturalHeight === 0;
}

type ArtworkDecodableImage = Pick<HTMLImageElement, 'decode' | 'naturalHeight' | 'naturalWidth'>;

export function settleArtworkImage(image: ArtworkDecodableImage): Promise<ArtworkLoadOutcome> {
	return image
		.decode()
		.then(
			() => true,
			() => false
		)
		.then((decoded) => (artworkLoadIsEmpty(image, decoded) ? 'failed' : 'loaded'));
}

export type ArtworkCandidateImage = ArtworkDecodableImage &
	Pick<HTMLImageElement, 'decoding' | 'onerror' | 'onload' | 'removeAttribute' | 'src'>;

/** Load one candidate in a detached image. The returned function drops it and aborts its fetch. */
export function startArtworkCandidate(
	src: string,
	onSettled: (outcome: ArtworkLoadOutcome) => void,
	createImage: () => ArtworkCandidateImage = () => new Image()
): () => void {
	const image = createImage();
	let active = true;
	image.decoding = 'async';
	image.onload = () => {
		void settleArtworkImage(image).then((outcome) => {
			if (active) onSettled(outcome);
		});
	};
	image.onerror = () => {
		if (active) onSettled('failed');
	};
	image.src = src;
	return () => {
		if (!active) return;
		active = false;
		image.onload = null;
		image.onerror = null;
		image.removeAttribute('src');
	};
}

export type ArtworkRacers = Map<number, { src: string; cancel: () => void }>;

/** Start racers that are new and drop ones no longer wanted, leaving running racers untouched. */
export function syncArtworkRacers(
	racers: ArtworkRacers,
	wanted: ReadonlyArray<{ index: number; src: string }>,
	start: (index: number, src: string) => () => void
): void {
	for (const [index, racer] of racers) {
		if (!wanted.some((candidate) => candidate.index === index && candidate.src === racer.src)) {
			racer.cancel();
			racers.delete(index);
		}
	}
	for (const { index, src } of wanted) {
		if (!racers.has(index)) racers.set(index, { src, cancel: start(index, src) });
	}
}

export function cancelArtworkRacers(racers: ArtworkRacers): void {
	syncArtworkRacers(racers, [], () => () => undefined);
}

/**
 * Report whether the element is within `rootMargin` of the viewport, each time that changes, until
 * the returned function runs (near at once without IntersectionObserver). Artwork watches only
 * until its download starts, so a card scrolled past while queued can leave the queue.
 */
export function observeArtworkNearness(
	element: Element,
	onChange: (near: boolean) => void,
	Observer: typeof IntersectionObserver | undefined = globalThis.IntersectionObserver,
	rootMargin?: string
): () => void {
	if (typeof Observer !== 'function') {
		onChange(true);
		return () => undefined;
	}
	const observer = new Observer(
		(entries) => {
			const latest = entries[entries.length - 1];
			if (latest) onChange(latest.isIntersecting);
		},
		rootMargin ? { rootMargin } : undefined
	);
	observer.observe(element);
	return () => observer.disconnect();
}

/** The host whose download budget a candidate spends; data: and blob: URLs spend none. */
export function artworkSlotHost(src: string, base: string | undefined = globalThis.location?.href): string | undefined {
	try {
		const url = new URL(src, base);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.host : undefined;
	} catch {
		return undefined;
	}
}

export type ArtworkSlotQueues = Map<string, ReturnType<typeof createKeyedTaskQueue>>;
const artworkSlotQueues: ArtworkSlotQueues = new Map();
let artworkSlotSequence = 0;

/**
 * Wait for one of `limit` download slots on the candidate's host, first come first served. The
 * slot is held until the returned function runs (the candidate settled, moved on or unmounted) or
 * `maxHoldMs` passes, so a stalled download cannot hold the queue; it keeps downloading meanwhile.
 * Calling the returned function before the grant leaves the queue.
 */
export function acquireArtworkSlot(
	src: string,
	onGranted: () => void,
	{
		queues = artworkSlotQueues,
		limit = ARTWORK_HOST_CONCURRENCY,
		maxHoldMs = ARTWORK_CANDIDATE_TIMEOUT_MS,
	}: { queues?: ArtworkSlotQueues; limit?: number; maxHoldMs?: number } = {}
): () => void {
	const host = artworkSlotHost(src);
	if (!host) {
		onGranted();
		return () => undefined;
	}
	let queue = queues.get(host);
	if (!queue) {
		queue = createKeyedTaskQueue(limit);
		queues.set(host, queue);
	}
	const key = String((artworkSlotSequence += 1));
	let release!: () => void;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	let waiting = true;
	void queue.enqueue(key, () => {
		if (!waiting) return Promise.resolve();
		const timer = setTimeout(release, maxHoldMs);
		void held.then(() => clearTimeout(timer));
		onGranted();
		return held;
	});
	return () => {
		if (!waiting) return;
		waiting = false;
		queue!.cancel(key);
		release();
	};
}

export type ArtworkStartState = Pick<ArtworkLoadState, 'nextIndex' | 'sourceIndex' | 'status'> & {
	/** Lazy artwork: waits to be near the viewport and for a host slot before it gets a src. */
	scheduled: boolean;
	/** Lazy artwork was granted its slot (or eager artwork was rendered). */
	started: boolean;
	/** Within the preload margin of the viewport. */
	near: boolean;
};

/**
 * Whether the visible image is downloading. Eager and high-priority artwork always is. Priority is
 * not fixed at mount: grids key cards by ID and give the first cards priority, so a queued lazy card
 * that a re-sort, search or streamed-in row moves to the top must start at once, not wait for a
 * slot it has just given up.
 */
export function artworkHasStarted({ scheduled, started }: Pick<ArtworkStartState, 'scheduled' | 'started'>): boolean {
	return started || !scheduled;
}

/** The src the visible image renders: none while it waits for a slot or for its one retry. */
export function artworkVisibleSrc(
	state: Pick<ArtworkStartState, 'scheduled' | 'sourceIndex' | 'started' | 'status'>,
	sources: readonly string[]
): string | undefined {
	return artworkHasStarted(state) && state.status !== 'error' ? sources[state.sourceIndex] : undefined;
}

/**
 * Whether lazy artwork holds (or waits for) a slot on its first candidate's host. Waiting needs the
 * card near the viewport, so one scrolled past before its grant leaves the queue and on-screen
 * cards go first; once granted, the slot is kept until the candidate settles wherever the card is.
 * After the first candidate fails or a fallback races it, recovery moves to other gateways and is
 * not queued again.
 */
export function artworkWantsSlot({
	near,
	nextIndex,
	scheduled,
	sourceIndex,
	started,
	status,
}: ArtworkStartState): boolean {
	return scheduled && (near || started) && status === 'loading' && sourceIndex === 0 && nextIndex === 1;
}

/**
 * What a settled load shows: failed artwork is retried once after a pause, keeping its blank box
 * meanwhile, and shows the fallback only when the retry fails too. An image is not a fetch, so a
 * 429 is not visible to it; any total failure gets the one retry.
 */
export function artworkFailurePlan(
	status: ArtworkLoadState['status'],
	retried: boolean
): { show: 'image' | 'fallback'; retryInMs?: number } {
	if (status !== 'error') return { show: 'image' };
	return retried ? { show: 'fallback' } : { show: 'image', retryInMs: ARTWORK_RETRY_DELAY_MS };
}

/** Whether a box intersects the viewport itself rather than only the preload margin. */
export function artworkInViewport(rect: Pick<DOMRect, 'bottom' | 'top'>, viewportHeight: number): boolean {
	return rect.bottom > 0 && rect.top < viewportHeight;
}

/**
 * A lazy image that starts inside the preload margin is fetched at low priority so on-screen work
 * goes first; an explicit high or low hint from the caller always wins.
 */
export function artworkFetchPriority(
	requested: React.ImgHTMLAttributes<HTMLImageElement>['fetchPriority'],
	scheduled: boolean,
	startedInView: boolean
): 'high' | 'low' | 'auto' | undefined {
	if (requested === 'high' || requested === 'low') return requested;
	return scheduled && !startedInView ? 'low' : requested;
}

export function startArtworkCandidateTimer(
	state: Pick<ArtworkLoadState, 'nextIndex' | 'status'>,
	sourceCount: number,
	dispatch: (event: ArtworkLoadEvent) => void
): () => void {
	if (state.status !== 'loading' || state.nextIndex >= sourceCount) return () => undefined;
	const { nextIndex } = state;
	const timer = setTimeout(() => dispatch({ type: 'timeout', nextIndex, sourceCount }), ARTWORK_CANDIDATE_TIMEOUT_MS);
	return () => clearTimeout(timer);
}

export function ArtworkImage({
	alt = '',
	className = '',
	decoding = 'async',
	fallback,
	fetchPriority,
	loading = 'lazy',
	src,
	...props
}: Props) {
	const [{ nextIndex, pending, sourceIndex, status }, dispatch] = React.useReducer(
		advanceArtworkLoad,
		initialArtworkLoadState
	);
	// Eager and high-priority artwork is wanted now; lazy artwork waits until near the viewport
	// and for a slot on its host before its first candidate gets a src.
	const scheduled = loading !== 'eager' && fetchPriority !== 'high';
	const [near, setNear] = React.useState(!scheduled);
	const [started, setStarted] = React.useState(!scheduled);
	const hasStarted = artworkHasStarted({ scheduled, started });
	const [startedInView, setStartedInView] = React.useState(true);
	const [retried, setRetried] = React.useState(false);
	const imageRef = React.useRef<HTMLImageElement>(null);
	const racersRef = React.useRef<ArtworkRacers>(new Map());
	const routingScope = aoRoutingScopeFromLocation();
	const sources = React.useMemo(() => arweaveDataFallbackUrls(src), [routingScope, src]);
	const sourceCount = sources.length;
	const racerKey = pending
		.filter((index) => index !== sourceIndex)
		.map((index) => `${index}\n${sources[index]}`)
		.join('\n');
	const waitsForSlot = artworkWantsSlot({ near, nextIndex, scheduled, sourceIndex, started, status });

	React.useEffect(() => {
		dispatch({ type: 'reset' });
		setRetried(false);
		setStarted(!scheduled);
	}, [routingScope, src]);

	// A card that becomes eager or high priority after mount (re-sorted to the top) has started;
	// latch it so moving back down later does not drop the src of a download in flight.
	React.useEffect(() => {
		if (!scheduled) setStarted(true);
	}, [scheduled]);

	React.useEffect(() => {
		const image = imageRef.current;
		if (hasStarted || !image) return;
		return observeArtworkNearness(image, setNear, undefined, ARTWORK_PRELOAD_MARGIN);
	}, [hasStarted, status]);

	React.useEffect(() => {
		if (!waitsForSlot || !sources[0]) return;
		return acquireArtworkSlot(sources[0], () => {
			const image = imageRef.current;
			setStartedInView(!image || artworkInViewport(image.getBoundingClientRect(), globalThis.innerHeight ?? 0));
			setStarted(true);
		});
	}, [waitsForSlot, sources]);

	React.useEffect(() => {
		if (!hasStarted) return;
		return startArtworkCandidateTimer({ nextIndex, status }, sourceCount, dispatch);
	}, [hasStarted, status, nextIndex, sourceCount, sources]);

	React.useEffect(() => {
		const wanted = pending
			.filter((index) => index !== sourceIndex && sources[index])
			.map((index) => ({ index, src: sources[index] }));
		syncArtworkRacers(racersRef.current, wanted, (index, candidate) =>
			startArtworkCandidate(candidate, (outcome) => dispatch({ type: outcome, sourceIndex: index, sourceCount }))
		);
	}, [racerKey, sourceCount]);

	React.useEffect(() => {
		const racers = racersRef.current;
		return () => cancelArtworkRacers(racers);
	}, []);

	const failure = artworkFailurePlan(status, retried);
	React.useEffect(() => {
		if (failure.retryInMs === undefined) return;
		const timer = setTimeout(() => {
			setRetried(true);
			setStarted(!scheduled);
			dispatch({ type: 'reset' });
		}, failure.retryInMs);
		return () => clearTimeout(timer);
	}, [failure.retryInMs]);

	if (failure.show === 'fallback') {
		if (fallback) return <>{fallback}</>;
		return (
			<span
				aria-hidden={alt ? undefined : 'true'}
				aria-label={alt || undefined}
				className={`artwork-fallback${className ? ` ${className}` : ''}`}
				role={alt ? 'img' : undefined}
			>
				<ImageOff aria-hidden="true" />
				<small>Artwork unavailable</small>
			</span>
		);
	}

	const priority = artworkFetchPriority(fetchPriority, scheduled, startedInView);
	// Waiting for a slot or for the one retry, the image keeps its box with no src (no request).
	const visibleSrc = artworkVisibleSrc({ scheduled, sourceIndex, started, status }, sources);
	return (
		<img
			{...props}
			{...(priority ? { fetchpriority: priority } : {})}
			ref={imageRef}
			alt={alt}
			className={`artwork-image is-${status === 'error' ? 'loading' : status}${className ? ` ${className}` : ''}`}
			decoding={decoding}
			loading={loading}
			src={visibleSrc}
			onError={() => {
				if (visibleSrc) dispatch({ type: 'failed', sourceIndex, sourceCount });
			}}
			onLoad={(event) => {
				const image = event.currentTarget;
				const loadedIndex = sourceIndex;
				void settleArtworkImage(image).then((outcome) => {
					if (image.isConnected) dispatch({ type: outcome, sourceIndex: loadedIndex, sourceCount });
				});
			}}
		/>
	);
}
