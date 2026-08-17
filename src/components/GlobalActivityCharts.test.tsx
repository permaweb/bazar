import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { CollectionActivityEvent } from 'api/asset-discovery';

import { chartHoverIndex, GlobalActivityCharts, globalActivityChartStats } from './GlobalActivityCharts';

const event = (
	id: string,
	action: CollectionActivityEvent['action'],
	actor: string,
	timestamp: number
): CollectionActivityEvent => ({
	id,
	processId: 'P'.repeat(43),
	action,
	actor,
	height: timestamp,
	timestamp,
});

describe('global activity chart statistics', () => {
	it('builds chronological bounded buckets and cumulative participant totals', () => {
		const stats = globalActivityChartStats([
			event('latest', 'transfer', 'wallet-b', 3 * 24 * 60 * 60),
			event('first', 'make-offer', 'wallet-a', 24 * 60 * 60),
			event('second', 'make-offer', 'wallet-a', 2 * 24 * 60 * 60),
		]);

		expect(stats).toMatchObject({ events: 3, listings: 2, participants: 2 });
		expect(stats.buckets.filter((bucket) => bucket.events).map((bucket) => bucket.events)).toEqual([1, 1, 1]);
		expect(stats.buckets.filter((bucket) => bucket.events).map((bucket) => bucket.listings)).toEqual([1, 1, 0]);
		expect(stats.buckets.at(-1)?.participants).toBe(2);
	});

	it('keeps long histories to a small renderable chart', () => {
		const events = Array.from({ length: 365 }, (_, index) =>
			event(String(index), 'transfer', `wallet-${index}`, index * 24 * 60 * 60)
		);

		const stats = globalActivityChartStats(events);

		expect(stats.events).toBe(365);
		expect(stats.participants).toBe(365);
		expect(stats.buckets.length).toBeLessThanOrEqual(30);
	});

	it('maps pointer positions to the nearest bounded chart bucket', () => {
		expect(chartHoverIndex(100, 100, 300, 3)).toBe(0);
		expect(chartHoverIndex(250, 100, 300, 3)).toBe(1);
		expect(chartHoverIndex(400, 100, 300, 3)).toBe(2);
		expect(chartHoverIndex(999, 100, 300, 3)).toBe(2);
		expect(chartHoverIndex(100, 100, 0, 3)).toBeNull();
	});

	it('renders keyboard-inspectable charts and naturally spaced rolling counters', () => {
		const markup = renderToStaticMarkup(
			<GlobalActivityCharts events={[event('listing', 'make-offer', 'wallet-a', 24 * 60 * 60)]} />
		);

		expect(markup.match(/role="img"/g)).toHaveLength(3);
		expect(markup).toContain('Focus and use arrow keys to inspect values.');
		expect(markup).toContain('global-activity-counter-value');
		expect(markup).not.toContain('global-activity-counter-digit');
	});
});
