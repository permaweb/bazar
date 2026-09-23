import type { CollectionActivityEvent } from 'api/discovery';

const MAX_BUCKETS = 30;
const NATURAL_INTERVALS = [60 * 60, 6 * 60 * 60, 24 * 60 * 60, 7 * 24 * 60 * 60, 30 * 24 * 60 * 60];

export type ActivityBucket = {
	start: number;
	events: number;
	listings: number;
	participants: number;
};

export type GlobalActivityChartStats = {
	events: number;
	listings: number;
	participants: number;
	buckets: ActivityBucket[];
	period: string;
};

function eventTimestamp(event: CollectionActivityEvent) {
	return event.timestamp > 1_000_000_000_000 ? Math.floor(event.timestamp / 1000) : Math.floor(event.timestamp);
}

// Totals plus at most thirty chronological buckets on a natural interval, with cumulative participant counts.
export function globalActivityChartStats(events: CollectionActivityEvent[]): GlobalActivityChartStats {
	const dated = events
		.map((event) => ({ event, timestamp: eventTimestamp(event) }))
		.filter(({ timestamp }) => Number.isFinite(timestamp) && timestamp > 0)
		.sort((left, right) => left.timestamp - right.timestamp);
	const participants = new Set(events.map((event) => event.actor).filter(Boolean));
	const listings = events.filter((event) => event.action === 'make-offer').length;
	if (!dated.length) {
		return {
			events: events.length,
			listings,
			participants: participants.size,
			buckets: [],
			period: 'No dated activity',
		};
	}

	const first = dated[0].timestamp;
	const last = dated[dated.length - 1].timestamp;
	const span = Math.max(1, last - first);
	const interval =
		NATURAL_INTERVALS.find((candidate) => Math.ceil(span / candidate) <= MAX_BUCKETS) ??
		Math.ceil(span / MAX_BUCKETS);
	const start = Math.floor(first / interval) * interval;
	const bucketCount = Math.max(1, Math.min(MAX_BUCKETS, Math.floor((last - start) / interval) + 1));
	const buckets: ActivityBucket[] = Array.from({ length: bucketCount }, (_, index) => ({
		start: start + index * interval,
		events: 0,
		listings: 0,
		participants: 0,
	}));
	const seenParticipants = new Set<string>();
	let eventIndex = 0;
	for (let bucketIndex = 0; bucketIndex < buckets.length; bucketIndex += 1) {
		const bucketEnd =
			bucketIndex === buckets.length - 1 ? Number.POSITIVE_INFINITY : buckets[bucketIndex].start + interval;
		while (eventIndex < dated.length && dated[eventIndex].timestamp < bucketEnd) {
			const event = dated[eventIndex].event;
			buckets[bucketIndex].events += 1;
			if (event.action === 'make-offer') buckets[bucketIndex].listings += 1;
			if (event.actor) seenParticipants.add(event.actor);
			eventIndex += 1;
		}
		buckets[bucketIndex].participants = seenParticipants.size;
	}
	return {
		events: events.length,
		listings,
		participants: participants.size,
		buckets,
		period: `${formatActivityChartDate(first)} – ${formatActivityChartDate(last)}`,
	};
}

export function formatActivityChartDate(timestamp: number) {
	return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
		new Date(timestamp * 1000)
	);
}

export function formatActivityChartValue(value: number) {
	return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

// The bucket under a pointer, clamped to the chart; null when the geometry cannot place it.
export function chartHoverIndex(clientX: number, left: number, width: number, count: number) {
	if (!Number.isFinite(clientX) || !Number.isFinite(left) || width <= 0 || count <= 0) return null;
	const position = Math.max(0, Math.min(1, (clientX - left) / width));
	return Math.min(count - 1, Math.floor(position * count));
}
