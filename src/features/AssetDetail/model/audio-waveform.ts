import type { AsyncState } from 'helpers/async-state';

export const WAVEFORM_PEAK_COUNT = 128;

/** Waveform progress as the player labels and styles it. */
export type AudioWaveformStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

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

export function timelineTicks(duration: number): number[] {
	if (!Number.isFinite(duration) || duration <= 0) return [];
	return [0, duration / 2, duration];
}

export function audioWaveformStatus(waveform: AsyncState<number[]>): AudioWaveformStatus {
	switch (waveform.status) {
		case 'idle':
			return 'idle';
		case 'loading':
		case 'refreshing':
			return 'loading';
		case 'error':
			return 'unavailable';
		case 'success':
		case 'stale':
			return 'ready';
	}
}

/** The timeline position a keyboard seek moves to, or undefined when the key does not seek. */
export function audioTimelineKeyTarget(input: {
	key: string;
	shiftKey: boolean;
	currentTime: number;
	duration: number;
}): number | undefined {
	const smallStep = input.shiftKey ? 15 : 5;
	return {
		ArrowLeft: input.currentTime - smallStep,
		ArrowDown: input.currentTime - smallStep,
		ArrowRight: input.currentTime + smallStep,
		ArrowUp: input.currentTime + smallStep,
		Home: 0,
		End: input.duration,
		PageDown: input.currentTime - 30,
		PageUp: input.currentTime + 30,
	}[input.key];
}
