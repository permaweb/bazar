// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAudioWaveformPlayer } from 'features/AssetDetail/hooks/useAudioWaveformPlayer';

import { renderHook, settle } from './render-hook';

const src: string = 'https://arweave.net/audio-one';
const otherSrc: string = 'https://arweave.net/audio-two';

const fetchAudioBytes = vi.fn();

vi.mock('api/media', () => ({
	fetchAudioBytes: (source: string, signal: AbortSignal) => fetchAudioBytes(source, signal),
}));

class FakeAudioContext {
	static decoded: { duration: number; numberOfChannels: number; channel: Float32Array } = {
		duration: 30,
		numberOfChannels: 1,
		channel: new Float32Array([0, 0.5, -1, 0.25]),
	};
	closed = false;
	decodeAudioData() {
		const decoded = FakeAudioContext.decoded;
		return Promise.resolve({
			duration: decoded.duration,
			numberOfChannels: decoded.numberOfChannels,
			getChannelData: () => decoded.channel,
		} as unknown as AudioBuffer);
	}
	close() {
		this.closed = true;
		return Promise.resolve();
	}
}

function playableAudio(): HTMLAudioElement {
	const audio = document.createElement('audio');
	Object.defineProperty(audio, 'paused', { value: true, configurable: true });
	audio.play = () => Promise.resolve();
	audio.pause = () => undefined;
	return audio;
}

beforeEach(() => {
	fetchAudioBytes.mockReset().mockResolvedValue(new ArrayBuffer(8));
	(globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext;
});

afterEach(() => vi.restoreAllMocks());

describe('audio waveform player', () => {
	it('waits for playback before fetching the waveform', async () => {
		const harness = renderHook(useAudioWaveformPlayer, src);
		await settle();
		expect(harness.current().status).toBe('idle');
		expect(fetchAudioBytes).not.toHaveBeenCalled();
		harness.unmount();
	});

	it('decodes peaks and the playable duration after the first play', async () => {
		const harness = renderHook(useAudioWaveformPlayer, src);
		Object.defineProperty(harness.current().audioRef, 'current', { value: playableAudio(), writable: true });
		await React.act(async () => {
			harness.current().togglePlayback();
			await Promise.resolve();
		});
		await settle(3);
		expect(fetchAudioBytes).toHaveBeenCalledWith(src, expect.anything());
		expect(harness.current().status).toBe('ready');
		expect(harness.current().peaks.length).toBeGreaterThan(0);
		expect(harness.current().duration).toBe(30);
		expect(harness.current().ticks).toEqual([0, 15, 30]);
		harness.unmount();
	});

	it('reports an unreadable waveform without breaking playback', async () => {
		fetchAudioBytes.mockRejectedValue(new Error('gateway refused the range request'));
		const harness = renderHook(useAudioWaveformPlayer, src);
		Object.defineProperty(harness.current().audioRef, 'current', { value: playableAudio(), writable: true });
		await React.act(async () => {
			harness.current().togglePlayback();
			await Promise.resolve();
		});
		await settle(3);
		expect(harness.current().status).toBe('unavailable');
		expect(harness.current().peaks).toEqual([]);
		harness.unmount();
	});

	it('starts a newly selected source over instead of leaving the previous waveform loading', async () => {
		const harness = renderHook(useAudioWaveformPlayer, src);
		Object.defineProperty(harness.current().audioRef, 'current', { value: playableAudio(), writable: true });
		await React.act(async () => {
			harness.current().togglePlayback();
			await Promise.resolve();
		});
		await settle(3);
		expect(harness.current().status).toBe('ready');
		harness.rerender(otherSrc);
		await settle(2);
		expect(harness.current().status).toBe('idle');
		expect(harness.current().currentTime).toBe(0);
		expect(harness.current().playing).toBe(false);
		expect(fetchAudioBytes).toHaveBeenCalledTimes(1);
		harness.unmount();
	});

	it('aborts an in-flight waveform fetch when the player unmounts', async () => {
		let signal: AbortSignal | undefined;
		fetchAudioBytes.mockImplementation((_source: string, abortSignal: AbortSignal) => {
			signal = abortSignal;
			return new Promise(() => undefined);
		});
		const harness = renderHook(useAudioWaveformPlayer, src);
		Object.defineProperty(harness.current().audioRef, 'current', { value: playableAudio(), writable: true });
		await React.act(async () => {
			harness.current().togglePlayback();
			await Promise.resolve();
		});
		expect(signal?.aborted).toBe(false);
		harness.unmount();
		expect(signal?.aborted).toBe(true);
	});
});
