import { describe, expect, it } from 'vitest';

import { MAX_VISIBLE_MINOR_EVENT_MARKERS, MINOR_EVENT_MARKER_SPACING, minorEventMarkerPositions } from './raceTimeline';

describe('minorEventMarkerPositions', () => {
	it('turns overlapping recent responses into a visible, naturally varied trail', () => {
		const positions = Array.from({ length: 60 }, () => 42);
		const placed = minorEventMarkerPositions(positions, 0);
		const gaps = placed.slice(1).map((position, index) => position - placed[index]);

		expect(placed).toHaveLength(MAX_VISIBLE_MINOR_EVENT_MARKERS);
		expect(placed.at(-1)).toBe(42);
		expect(gaps.every((gap) => gap > 0)).toBe(true);
		expect(Math.min(...gaps)).toBeLessThan(MINOR_EVENT_MARKER_SPACING);
		expect(Math.max(...gaps)).toBeGreaterThan(MINOR_EVENT_MARKER_SPACING);
		expect(new Set(gaps.map((gap) => gap.toFixed(3))).size).toBeGreaterThan(6);
	});

	it('never pushes a minor marker before its phase begins', () => {
		const placed = minorEventMarkerPositions(
			Array.from({ length: 20 }, () => 50.5),
			50
		);

		expect(placed.length).toBeGreaterThan(0);
		expect(placed.every((position) => position >= 50)).toBe(true);
	});
});
