import React from 'react';
import { ImageOff } from 'lucide-react';

import { aoRoutingScopeFromLocation, arweaveDataFallbackUrls } from 'helpers/config';

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'onLoad'> & {
	src: string;
	fallback?: React.ReactNode;
};

/** How long a visible candidate may load alone before the next fallback URL starts racing it. */
export const ARTWORK_CANDIDATE_TIMEOUT_MS = 8_000;

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

/** Lazy images are not fetched until near the viewport, so the candidate clock starts on visibility. */
export function observeArtworkVisibility(
	element: Element,
	onVisible: () => void,
	Observer: typeof IntersectionObserver | undefined = globalThis.IntersectionObserver
): () => void {
	if (typeof Observer !== 'function') {
		onVisible();
		return () => undefined;
	}
	const observer = new Observer((entries) => {
		if (entries.some((entry) => entry.isIntersecting)) {
			observer.disconnect();
			onVisible();
		}
	});
	observer.observe(element);
	return () => observer.disconnect();
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
	const [visible, setVisible] = React.useState(false);
	const imageRef = React.useRef<HTMLImageElement>(null);
	const racersRef = React.useRef<ArtworkRacers>(new Map());
	const routingScope = aoRoutingScopeFromLocation();
	const sources = React.useMemo(() => arweaveDataFallbackUrls(src), [routingScope, src]);
	const sourceCount = sources.length;
	const racerKey = pending
		.filter((index) => index !== sourceIndex)
		.map((index) => `${index}\n${sources[index]}`)
		.join('\n');

	React.useEffect(() => {
		dispatch({ type: 'reset' });
	}, [routingScope, src]);

	React.useEffect(() => {
		const image = imageRef.current;
		if (visible || !image) return;
		return observeArtworkVisibility(image, () => setVisible(true));
	}, [visible, status]);

	React.useEffect(() => {
		if (!visible) return;
		return startArtworkCandidateTimer({ nextIndex, status }, sourceCount, dispatch);
	}, [visible, status, nextIndex, sourceCount, sources]);

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

	if (status === 'error') {
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

	return (
		<img
			{...props}
			{...(fetchPriority ? { fetchpriority: fetchPriority } : {})}
			ref={imageRef}
			alt={alt}
			className={`artwork-image is-${status}${className ? ` ${className}` : ''}`}
			decoding={decoding}
			loading={loading}
			src={sources[sourceIndex]}
			onError={() => dispatch({ type: 'failed', sourceIndex, sourceCount })}
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
