import { describe, expect, it } from 'vitest';

import { PROGRESS_GRADIENT, confirmationProgress, progressColorCss, progressColorRgb } from './progressColors';

describe('transaction progress colors', () => {
  it('uses one gradient definition for the progress bar', () => {
    expect(PROGRESS_GRADIENT).toBe(
      'linear-gradient(90deg, #f4d985 0%, #f2b500 12%, #c9ea2d 45%, #69d36d 72%, #008f20 100%)',
    );
  });

  it.each([
    [1, 20, 'rgb(232 194 11)'],
    [2, 40, 'rgb(207 226 38)'],
    [3, 60, 'rgb(148 221 81)'],
    [4, 80, 'rgb(75 192 87)'],
    [5, 100, 'rgb(0 143 32)'],
  ])('maps confirmation %i to the matching point on the gradient', (confirmation, progress, expected) => {
    expect(confirmationProgress(confirmation, 5)).toBe(progress);
    const { r, g, b } = progressColorRgb(progress);
    expect(`rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`).toBe(expected);
    expect(progressColorCss(progress)).toBe(expected);
  });

  it('clamps confirmation progress to the available range', () => {
    expect(confirmationProgress(-1, 5)).toBe(0);
    expect(confirmationProgress(8, 5)).toBe(100);
    expect(confirmationProgress(2, 0)).toBe(0);
  });
});
