import type { ObserverView } from 'weave-wrangler';

export type RaceTimelineEvent = {
  state: ObserverView['state'];
  confirmations: number;
  updatedAt: number;
  blockId?: string;
  blockHeight?: number;
  httpStatus?: number;
  error?: string;
};

export type RaceTimelineLayout = {
  positions: number[];
  progressEnd: number;
};

/** A slightly conservative display midpoint around Arweave's 126-second average. */
export const EXPECTED_BLOCK_TIME_MS = 140_000;
export const MAX_VISIBLE_MINOR_EVENT_MARKERS = 36;
export const MINOR_EVENT_MARKER_SPACING = 0.22;
const MINOR_EVENT_SPACING_RHYTHM = [0.62, 1.28, 0.78, 1.35, 0.9, 1.12, 0.7, 1.25, 0.84, 1.42, 0.74];

/**
 * Keeps frequent observer responses visible when their time-derived positions
 * would otherwise render on top of one another.
 */
export function minorEventMarkerPositions(
  positions: number[],
  phaseStart: number,
  limit = MAX_VISIBLE_MINOR_EVENT_MARKERS,
  spacing = MINOR_EVENT_MARKER_SPACING,
): number[] {
  const recent = positions.slice(-Math.max(0, limit));
  const placed: number[] = [];
  let nextPosition = Number.POSITIVE_INFINITY;

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const position = Math.min(recent[index], nextPosition);
    if (position < phaseStart) break;
    placed.unshift(position);
    const rhythmIndex = Math.abs(index + Math.round(recent[index] * 10)) % MINOR_EVENT_SPACING_RHYTHM.length;
    nextPosition = position - Math.max(0, spacing) * MINOR_EVENT_SPACING_RHYTHM[rhythmIndex];
  }

  return placed;
}

export function transitionKey(event: RaceTimelineEvent): string {
  return [event.state, event.confirmations, event.blockId, event.blockHeight, event.httpStatus, event.error].join(':');
}

export function phaseIsComplete(event: RaceTimelineEvent | undefined, target: number): boolean {
  return Boolean(event && event.state === 'confirmed' && event.confirmations >= target);
}

export function timelineLayout(
  events: RaceTimelineEvent[],
  observedAt: number,
  phaseStart: number,
  phaseEnd: number,
  target: number,
  complete = false,
): RaceTimelineLayout {
  if (!events.length || phaseEnd <= phaseStart) return { positions: [], progressEnd: phaseStart };

  const positions = [phaseStart];
  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1];
    positions.push(
      advanceTowardNextEvent(
        positions[index - 1],
        events[index].updatedAt - previous.updatedAt,
        previous,
        phaseEnd,
        target,
      ),
    );
  }

  const latestEvent = events[events.length - 1];
  const latestPosition = positions[positions.length - 1];
  const progressEnd = complete
    ? phaseEnd
    : advanceTowardNextEvent(latestPosition, observedAt - latestEvent.updatedAt, latestEvent, phaseEnd, target);

  return { positions, progressEnd };
}

/**
 * A fast-starting, slow-finishing clock for one expected event.
 *
 * The first 140 seconds use a cubic ease-out to cover 90% of the available
 * step. The final 10% is an asymptotic long tail, so unusually slow blocks
 * continue moving without the UI predicting when the event will arrive.
 */
export function expectedEventProgress(milliseconds: number): number {
  const ratio = Math.max(0, milliseconds) / EXPECTED_BLOCK_TIME_MS;
  if (ratio <= 1) return 0.9 * (1 - Math.pow(1 - ratio, 3));
  return 0.9 + 0.1 * ((ratio - 1) / ratio);
}

function advanceTowardNextEvent(
  position: number,
  milliseconds: number,
  event: RaceTimelineEvent,
  phaseEnd: number,
  target: number,
): number {
  const remainingDistance = Math.max(0, phaseEnd - position);
  const nextEventBudget = remainingDistance / remainingEventCount(event, target);
  return Math.min(phaseEnd, position + nextEventBudget * expectedEventProgress(milliseconds));
}

function remainingEventCount(event: RaceTimelineEvent, target: number): number {
  if (event.state === 'pending') return Math.max(1, target);
  if (event.state === 'confirmed') return Math.max(1, target - event.confirmations);
  return Math.max(1, target + 1);
}

export function elapsedLabel(milliseconds: number): string {
  const seconds = Math.max(0, milliseconds) / 1_000;
  if (seconds < 60) return `+${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `+${minutes}m ${remainingSeconds}s`;
}

export function stadiumPoint(
  inset: number,
  width: number,
  height: number,
  percentage: number,
): { x: number; y: number } {
  const radius = height / 2;
  const straight = Math.max(0, width - height);
  const perimeter = straight * 2 + Math.PI * height;
  let distance = (Math.min(100, Math.max(0, percentage)) / 100) * perimeter;

  if (distance <= straight) return { x: inset + radius + distance, y: inset };
  distance -= straight;
  if (distance <= Math.PI * radius) {
    const angle = -Math.PI / 2 + distance / radius;
    return {
      x: inset + width - radius + Math.cos(angle) * radius,
      y: inset + radius + Math.sin(angle) * radius,
    };
  }
  distance -= Math.PI * radius;
  if (distance <= straight) return { x: inset + width - radius - distance, y: inset + height };
  distance -= straight;
  const angle = Math.PI / 2 + distance / radius;
  return {
    x: inset + radius + Math.cos(angle) * radius,
    y: inset + radius + Math.sin(angle) * radius,
  };
}
