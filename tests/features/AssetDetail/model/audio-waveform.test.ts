import { describe, expect, it } from 'vitest';

import {
	audioTimelineKeyTarget,
	audioWaveformStatus,
	formatAudioTime,
	sampleWaveformPeaks,
	timelineTicks,
} from 'features/AssetDetail/model/audio-waveform';
import { appError } from 'helpers/app-error';

describe('audio waveform player', () => {
	it('formats short and long timeline positions', () => {
		expect(formatAudioTime(9.8)).toBe('0:09');
		expect(formatAudioTime(3_661)).toBe('1:01:01');
		expect(formatAudioTime(Number.NaN)).toBe('0:00');
	});

	it('samples and normalizes real channel amplitude into visible peaks', () => {
		const peaks = sampleWaveformPeaks([new Float32Array([0, 0.1, -0.5, 1, 0.25, 0, -0.25, 0.5])], 4);
		expect(peaks).toHaveLength(4);
		expect(peaks.every((peak) => peak >= 0.08 && peak <= 1)).toBe(true);
		expect(Math.max(...peaks)).toBe(1);
	});

	it('keeps silent and empty sources visible at the floor amplitude', () => {
		expect(sampleWaveformPeaks([], 3)).toEqual([0.08, 0.08, 0.08]);
		expect(sampleWaveformPeaks([new Float32Array([0, 0, 0, 0])], 2)).toEqual([0.08, 0.08]);
	});

	it('places timeline ticks only for a known duration', () => {
		expect(timelineTicks(120)).toEqual([0, 60, 120]);
		expect(timelineTicks(0)).toEqual([]);
		expect(timelineTicks(Number.POSITIVE_INFINITY)).toEqual([]);
	});

	it('labels waveform progress from its async state', () => {
		expect(audioWaveformStatus({ status: 'idle' })).toBe('idle');
		expect(audioWaveformStatus({ status: 'loading' })).toBe('loading');
		expect(audioWaveformStatus({ status: 'success', data: [0.5] })).toBe('ready');
		expect(audioWaveformStatus({ status: 'error', error: appError('unavailable') })).toBe('unavailable');
	});

	it('maps seek keys to timeline positions and ignores other keys', () => {
		const timeline = { currentTime: 60, duration: 180 };
		expect(audioTimelineKeyTarget({ key: 'ArrowRight', shiftKey: false, ...timeline })).toBe(65);
		expect(audioTimelineKeyTarget({ key: 'ArrowLeft', shiftKey: true, ...timeline })).toBe(45);
		expect(audioTimelineKeyTarget({ key: 'PageUp', shiftKey: false, ...timeline })).toBe(90);
		expect(audioTimelineKeyTarget({ key: 'Home', shiftKey: false, ...timeline })).toBe(0);
		expect(audioTimelineKeyTarget({ key: 'End', shiftKey: false, ...timeline })).toBe(180);
		expect(audioTimelineKeyTarget({ key: 'Enter', shiftKey: false, ...timeline })).toBeUndefined();
	});
});
