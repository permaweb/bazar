import { describe, expect, it } from 'vitest';

import { formatAudioTime, sampleWaveformPeaks, waveformTimelineWidth } from './AudioWaveformPlayer';

describe('audio waveform player', () => {
  it('formats short and long timeline positions', () => {
    expect(formatAudioTime(9.8)).toBe('0:09');
    expect(formatAudioTime(3_661)).toBe('1:01:01');
    expect(formatAudioTime(Number.NaN)).toBe('0:00');
  });

  it('keeps short tracks fitted and gives long tracks a scrollable timeline', () => {
    expect(waveformTimelineWidth(54)).toBe(720);
    expect(waveformTimelineWidth(300)).toBe(2_400);
    expect(waveformTimelineWidth(10_000)).toBe(12_000);
  });

  it('samples and normalizes real channel amplitude into visible peaks', () => {
    const peaks = sampleWaveformPeaks([new Float32Array([0, 0.1, -0.5, 1, 0.25, 0, -0.25, 0.5])], 4);
    expect(peaks).toHaveLength(4);
    expect(peaks.every((peak) => peak >= 0.08 && peak <= 1)).toBe(true);
    expect(Math.max(...peaks)).toBe(1);
  });
});
