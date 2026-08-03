export const PROGRESS_COLOR_STOPS = [
  { at: 0, color: '#f4d985' },
  { at: 0.12, color: '#f2b500' },
  { at: 0.45, color: '#c9ea2d' },
  { at: 0.72, color: '#69d36d' },
  { at: 1, color: '#008f20' },
] as const;

export const PROGRESS_GRADIENT = `linear-gradient(90deg, ${PROGRESS_COLOR_STOPS.map(
  (stop) => `${stop.color} ${stop.at * 100}%`,
).join(', ')})`;

export function confirmationProgress(confirmations: number, target: number): number {
  if (!Number.isFinite(confirmations) || !Number.isFinite(target) || target <= 0) return 0;
  return (Math.min(target, Math.max(0, confirmations)) / target) * 100;
}

export function progressColorRgb(progress: number): { r: number; g: number; b: number } {
  const normalized = Math.min(1, Math.max(0, progress / 100));
  const stopIndex = Math.max(
    0,
    PROGRESS_COLOR_STOPS.findIndex((stop, index) => index > 0 && normalized <= stop.at) - 1,
  );
  const start = PROGRESS_COLOR_STOPS[stopIndex];
  const end = PROGRESS_COLOR_STOPS[Math.min(PROGRESS_COLOR_STOPS.length - 1, stopIndex + 1)];
  const mix = start === end ? 0 : Math.min(1, Math.max(0, (normalized - start.at) / (end.at - start.at)));
  const startRgb = hexToRgb(start.color);
  const endRgb = hexToRgb(end.color);
  return {
    r: startRgb.r + (endRgb.r - startRgb.r) * mix,
    g: startRgb.g + (endRgb.g - startRgb.g) * mix,
    b: startRgb.b + (endRgb.b - startRgb.b) * mix,
  };
}

export function progressColorCss(progress: number): string {
  const { r, g, b } = progressColorRgb(progress);
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}
