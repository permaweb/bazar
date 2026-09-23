import React from 'react';

import { fetchAudioBytes } from 'api/media';

import { toAppError } from 'helpers/app-error';
import { type AsyncState, IDLE, LOADING } from 'helpers/async-state';

import {
	type AudioWaveformStatus,
	audioWaveformStatus,
	sampleWaveformPeaks,
	timelineTicks,
	WAVEFORM_PEAK_COUNT,
} from '../model/audio-waveform';

const NO_PEAKS: number[] = [];

export type AudioWaveformPlayerState = {
	audioRef: React.RefObject<HTMLAudioElement>;
	status: AudioWaveformStatus;
	/** Normalized waveform peaks, empty until the waveform is ready. */
	peaks: number[];
	/** The playable duration, or 0 while it is unknown. */
	duration: number;
	currentTime: number;
	playing: boolean;
	/** Played fraction of the timeline, between 0 and 1. */
	progress: number;
	ticks: number[];
	/** Media element handlers; spread onto the `audio` element. */
	mediaEvents: Required<
		Pick<
			React.AudioHTMLAttributes<HTMLAudioElement>,
			'onDurationChange' | 'onEnded' | 'onPause' | 'onPlay' | 'onTimeUpdate'
		>
	>;
	togglePlayback(): void;
	seek(value: number): void;
};

/**
 * Playback and waveform state for one audio source. The waveform is decoded only after the first play, from bytes
 * fetched once per source; a new source starts over and cancels any decode still running.
 */
export function useAudioWaveformPlayer(src: string): AudioWaveformPlayerState {
	const audioRef = React.useRef<HTMLAudioElement>(null);
	const [requestedSrc, setRequestedSrc] = React.useState<string | null>(null);
	const [waveform, setWaveform] = React.useState<{ src: string; read: AsyncState<number[]> }>({ src, read: IDLE });
	const [duration, setDuration] = React.useState(0);
	const [currentTime, setCurrentTime] = React.useState(0);
	const [playing, setPlaying] = React.useState(false);
	const requested = requestedSrc === src;

	React.useEffect(() => {
		setCurrentTime(0);
		setPlaying(false);
	}, [src]);

	React.useEffect(() => {
		if (!requested) return;
		const controller = new AbortController();
		let context: AudioContext | null = null;
		setWaveform({ src, read: LOADING });

		void fetchAudioBytes(src, controller.signal)
			.then(async (bytes) => {
				if (controller.signal.aborted) return;
				context = new AudioContext();
				const buffer = await context.decodeAudioData(bytes);
				if (controller.signal.aborted) return;
				const decodedDuration = Number.isFinite(buffer.duration) ? buffer.duration : 0;
				const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
					buffer.getChannelData(index)
				);
				setDuration((current) => current || decodedDuration);
				setWaveform({
					src,
					read: { status: 'success', data: sampleWaveformPeaks(channels, WAVEFORM_PEAK_COUNT) },
				});
			})
			.catch((cause) => {
				const error = toAppError(cause, 'unavailable');
				if (!controller.signal.aborted && error.code !== 'cancelled') {
					setWaveform({ src, read: { status: 'error', error } });
				}
			})
			.finally(() => void context?.close().catch(() => undefined));

		return () => {
			controller.abort();
			void context?.close().catch(() => undefined);
		};
	}, [requested, src]);

	React.useEffect(() => {
		if (!playing) return;
		let frame = 0;
		const update = () => {
			if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
			frame = window.requestAnimationFrame(update);
		};
		frame = window.requestAnimationFrame(update);
		return () => window.cancelAnimationFrame(frame);
	}, [playing]);

	const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
	const read = waveform.src === src ? waveform.read : IDLE;

	const togglePlayback = () => {
		const audio = audioRef.current;
		if (!audio) return;
		if (audio.paused) {
			setRequestedSrc(src);
			void audio.play().catch(() => setPlaying(false));
		} else audio.pause();
	};

	const seek = (value: number) => {
		const audio = audioRef.current;
		if (!audio || !safeDuration) return;
		const next = Math.max(0, Math.min(safeDuration, value));
		audio.currentTime = next;
		setCurrentTime(next);
	};

	return {
		audioRef,
		status: audioWaveformStatus(read),
		peaks: read.status === 'success' ? read.data : NO_PEAKS,
		duration: safeDuration,
		currentTime,
		playing,
		progress: safeDuration ? Math.min(1, currentTime / safeDuration) : 0,
		ticks: timelineTicks(safeDuration),
		mediaEvents: {
			onDurationChange: (event) => {
				const next = event.currentTarget.duration;
				if (Number.isFinite(next) && next > 0) setDuration(next);
			},
			onEnded: () => setPlaying(false),
			onPause: () => setPlaying(false),
			onPlay: () => setPlaying(true),
			onTimeUpdate: (event) => setCurrentTime(event.currentTarget.currentTime),
		},
		togglePlayback,
		seek,
	};
}
