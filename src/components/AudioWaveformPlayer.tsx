import React from 'react';
import { Pause, Play } from 'lucide-react';

import { Button } from './Button';

const WAVEFORM_PEAK_COUNT = 128;

type WaveformStatus = 'loading' | 'ready' | 'unavailable';

export function formatAudioTime(value: number): string {
	if (!Number.isFinite(value) || value < 0) return '0:00';
	const seconds = Math.floor(value);
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainder = seconds % 60;
	return hours
		? `${hours}:${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`
		: `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export function sampleWaveformPeaks(channels: Float32Array[], peakCount: number): number[] {
	const samples = channels.filter((channel) => channel.length > 0).slice(0, 2);
	const count = Math.max(1, Math.floor(peakCount));
	if (!samples.length) return Array.from({ length: count }, () => 0.08);
	const sampleCount = Math.min(...samples.map((channel) => channel.length));
	const peaks = Array.from({ length: count }, (_, index) => {
		const start = Math.floor((index * sampleCount) / count);
		const end = Math.max(start + 1, Math.floor(((index + 1) * sampleCount) / count));
		const stride = Math.max(1, Math.floor((end - start) / 96));
		let peak = 0;
		for (const channel of samples) {
			for (let sample = start; sample < end; sample += stride)
				peak = Math.max(peak, Math.abs(channel[sample] ?? 0));
		}
		return peak;
	});
	const maximum = Math.max(...peaks, 0.001);
	return peaks.map((peak) => Math.max(0.08, Math.min(1, Math.sqrt(peak / maximum))));
}

function timelineTicks(duration: number): number[] {
	if (!Number.isFinite(duration) || duration <= 0) return [];
	return [0, duration / 2, duration];
}

export function AudioWaveformPlayer({ name, src }: { name: string; src: string }) {
	const audioRef = React.useRef<HTMLAudioElement>(null);
	const draggingRef = React.useRef(false);
	const [status, setStatus] = React.useState<WaveformStatus>('loading');
	const [peaks, setPeaks] = React.useState<number[]>([]);
	const [playbackSrc, setPlaybackSrc] = React.useState(src);
	const [duration, setDuration] = React.useState(0);
	const [currentTime, setCurrentTime] = React.useState(0);
	const [playing, setPlaying] = React.useState(false);

	React.useEffect(() => {
		const controller = new AbortController();
		let context: AudioContext | null = null;
		let playbackObjectUrl = '';
		setStatus('loading');
		setPeaks([]);
		setPlaybackSrc(src);
		setCurrentTime(0);
		setPlaying(false);

		void fetch(src, { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) throw new Error(`waveform-fetch-${response.status}`);
				return {
					bytes: await response.arrayBuffer(),
					contentType: response.headers.get('content-type') ?? 'audio/mpeg',
				};
			})
			.then(async ({ bytes, contentType }) => {
				if (controller.signal.aborted) return;
				playbackObjectUrl = URL.createObjectURL(new Blob([bytes], { type: contentType }));
				setPlaybackSrc(playbackObjectUrl);
				context = new AudioContext();
				const buffer = await context.decodeAudioData(bytes);
				if (controller.signal.aborted) return;
				const decodedDuration = Number.isFinite(buffer.duration) ? buffer.duration : 0;
				const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
					buffer.getChannelData(index)
				);
				setDuration((current) => current || decodedDuration);
				setPeaks(sampleWaveformPeaks(channels, WAVEFORM_PEAK_COUNT));
				setStatus('ready');
			})
			.catch((error) => {
				if (!controller.signal.aborted && (error as Error)?.name !== 'AbortError') setStatus('unavailable');
			})
			.finally(() => void context?.close().catch(() => undefined));

		return () => {
			controller.abort();
			if (playbackObjectUrl) URL.revokeObjectURL(playbackObjectUrl);
			void context?.close().catch(() => undefined);
		};
	}, [src]);

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
	const progress = safeDuration ? Math.min(1, currentTime / safeDuration) : 0;
	const ticks = timelineTicks(safeDuration);
	const togglePlayback = () => {
		const audio = audioRef.current;
		if (!audio) return;
		if (audio.paused) void audio.play().catch(() => setPlaying(false));
		else audio.pause();
	};
	const seek = (value: number) => {
		const audio = audioRef.current;
		if (!audio || !safeDuration) return;
		const next = Math.max(0, Math.min(safeDuration, value));
		audio.currentTime = next;
		setCurrentTime(next);
	};
	const seekFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!safeDuration) return;
		const bounds = event.currentTarget.getBoundingClientRect();
		if (!bounds.width) return;
		seek(((event.clientX - bounds.left) / bounds.width) * safeDuration);
	};
	const seekFromClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (!safeDuration) return;
		const bounds = event.currentTarget.getBoundingClientRect();
		if (!bounds.width) return;
		seek(((event.clientX - bounds.left) / bounds.width) * safeDuration);
	};

	return (
		<div className="audio-waveform-player">
			<audio
				aria-hidden="true"
				onDurationChange={(event) => {
					const next = event.currentTarget.duration;
					if (Number.isFinite(next) && next > 0) setDuration(next);
				}}
				onEnded={() => setPlaying(false)}
				onPause={() => setPlaying(false)}
				onPlay={() => setPlaying(true)}
				onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
				preload="metadata"
				ref={audioRef}
				src={playbackSrc}
			/>
			<Button
				aria-label={`${playing ? 'Pause' : 'Play'} ${name}`}
				className="audio-waveform-play"
				onClick={togglePlayback}
				size="custom"
			>
				{playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
			</Button>
			<div className="audio-waveform-main">
				<div className="audio-waveform-meta">
					<span>
						{formatAudioTime(currentTime)} / {formatAudioTime(safeDuration)}
					</span>
					<small aria-live="polite">
						{status === 'loading'
							? 'Reading waveform…'
							: status === 'unavailable'
							? 'Waveform unavailable'
							: 'Drag to seek'}
					</small>
				</div>
				<div className="audio-waveform-viewport">
					<div
						className="audio-waveform-track"
						onClick={seekFromClick}
						onPointerDown={(event) => {
							if (!safeDuration) return;
							draggingRef.current = true;
							event.currentTarget.setPointerCapture(event.pointerId);
							seekFromPointer(event);
						}}
						onPointerMove={(event) => {
							if (draggingRef.current) seekFromPointer(event);
						}}
						onPointerUp={(event) => {
							draggingRef.current = false;
							if (event.currentTarget.hasPointerCapture(event.pointerId)) {
								event.currentTarget.releasePointerCapture(event.pointerId);
							}
						}}
					>
						{status === 'ready' ? (
							<>
								<div aria-hidden="true" className="audio-waveform-bars">
									{peaks.map((peak, index) => (
										<i key={index} style={{ height: `${Math.round(peak * 100)}%` }} />
									))}
								</div>
								<div
									aria-hidden="true"
									className="audio-waveform-bars is-played"
									style={{ clipPath: `inset(0 ${Math.max(0, (1 - progress) * 100)}% 0 0)` }}
								>
									{peaks.map((peak, index) => (
										<i key={index} style={{ height: `${Math.round(peak * 100)}%` }} />
									))}
								</div>
							</>
						) : (
							<div aria-hidden="true" className={`audio-waveform-placeholder is-${status}`} />
						)}
						<span
							aria-hidden="true"
							className="audio-waveform-playhead"
							style={{ left: `${progress * 100}%` }}
						/>
						<input
							aria-label={`${name} timeline`}
							aria-valuetext={`${formatAudioTime(currentTime)} of ${formatAudioTime(safeDuration)}`}
							className="audio-waveform-range"
							disabled={!safeDuration}
							max={safeDuration || 1}
							min={0}
							onChange={(event) => seek(Number(event.target.value))}
							onMouseDown={(event) => {
								const bounds = event.currentTarget.getBoundingClientRect();
								if (bounds.width) seek(((event.clientX - bounds.left) / bounds.width) * safeDuration);
							}}
							onKeyDown={(event) => {
								const smallStep = event.shiftKey ? 15 : 5;
								const next = {
									ArrowLeft: currentTime - smallStep,
									ArrowDown: currentTime - smallStep,
									ArrowRight: currentTime + smallStep,
									ArrowUp: currentTime + smallStep,
									Home: 0,
									End: safeDuration,
									PageDown: currentTime - 30,
									PageUp: currentTime + 30,
								}[event.key];
								if (next === undefined) return;
								event.preventDefault();
								seek(next);
							}}
							step="0.01"
							type="range"
							value={Math.min(currentTime, safeDuration || 1)}
						/>
						<div aria-hidden="true" className="audio-waveform-ticks">
							{ticks.map((tick) => (
								<span key={tick} style={{ left: `${(tick / safeDuration) * 100}%` }}>
									{formatAudioTime(tick)}
								</span>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
