import React from 'react';

import type { CollectionActivityEvent } from 'api/asset-discovery';

const MAX_BUCKETS = 30;
const NATURAL_INTERVALS = [60 * 60, 6 * 60 * 60, 24 * 60 * 60, 7 * 24 * 60 * 60, 30 * 24 * 60 * 60];

type ActivityBucket = {
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

export function globalActivityChartStats(events: CollectionActivityEvent[]): GlobalActivityChartStats {
	const dated = events
		.map((event) => ({ event, timestamp: eventTimestamp(event) }))
		.filter(({ timestamp }) => Number.isFinite(timestamp) && timestamp >= 0)
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
	const last = dated.at(-1)!.timestamp;
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
		period: `${formatDate(first)} – ${formatDate(last)}`,
	};
}

function formatDate(timestamp: number) {
	return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
		new Date(timestamp * 1000)
	);
}

function formatValue(value: number) {
	return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function chartHoverIndex(clientX: number, left: number, width: number, count: number) {
	if (!Number.isFinite(clientX) || !Number.isFinite(left) || width <= 0 || count <= 0) return null;
	const position = Math.max(0, Math.min(1, (clientX - left) / width));
	return Math.min(count - 1, Math.floor(position * count));
}

function useChartInteraction(values: number[], label: string, starts: number[]) {
	const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
	const selectedValue = hoveredIndex === null ? undefined : values[hoveredIndex];
	const selectedDate = hoveredIndex === null ? undefined : starts[hoveredIndex];
	const selectPointer = (event: React.PointerEvent<HTMLDivElement>) => {
		const bounds = event.currentTarget.getBoundingClientRect();
		setHoveredIndex(chartHoverIndex(event.clientX, bounds.left, bounds.width, values.length));
	};
	return {
		hoveredIndex,
		selectedValue,
		selectedDate,
		interactionProps: {
			'aria-label':
				hoveredIndex === null
					? `${label} over time. Focus and use arrow keys to inspect values.`
					: `${formatDate(selectedDate!)}: ${selectedValue!.toLocaleString()} ${label.toLowerCase()}.`,
			onBlur: () => setHoveredIndex(null),
			onFocus: () => {
				if (values.length) {
					setHoveredIndex(values.length - 1);
				}
			},
			onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
				if (!values.length) return;
				if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
				event.preventDefault();
				if (event.key === 'Home') return setHoveredIndex(0);
				if (event.key === 'End') return setHoveredIndex(values.length - 1);
				setHoveredIndex((current) => {
					const index = current ?? values.length - 1;
					return event.key === 'ArrowLeft' ? Math.max(0, index - 1) : Math.min(values.length - 1, index + 1);
				});
			},
			onPointerDown: selectPointer,
			onPointerLeave: () => setHoveredIndex(null),
			onPointerMove: selectPointer,
			role: 'img' as const,
			tabIndex: values.length ? 0 : -1,
		},
	};
}

function ChartTooltip({
	x,
	y,
	date,
	value,
	unit,
}: {
	x: number;
	y: number;
	date: number;
	value: number;
	unit: string;
}) {
	const edgeClass = x < 40 ? ' is-left' : '';
	return (
		<div
			aria-hidden="true"
			className={`global-activity-chart-tooltip${edgeClass}`}
			style={{ left: `${(x / 300) * 100}%`, top: `${y}px` }}
		>
			<span>{formatDate(date)}</span>
			<strong>
				{value.toLocaleString()} {unit}
			</strong>
		</div>
	);
}

function BarChart({
	values,
	starts,
	label,
	unit,
}: {
	values: number[];
	starts: number[];
	label: string;
	unit: string;
}) {
	const max = Math.max(1, ...values);
	const gap = 3;
	const width = values.length ? (300 - gap * (values.length - 1)) / values.length : 300;
	const heights = values.map((value) => (value ? Math.max(3, (value / max) * 88) : 1));
	const { hoveredIndex, selectedDate, selectedValue, interactionProps } = useChartInteraction(values, label, starts);
	const crosshairX = hoveredIndex === null ? undefined : hoveredIndex * (width + gap) + width / 2;
	const selectedBarTop = hoveredIndex === null ? undefined : 96 - heights[hoveredIndex];
	return (
		<div className="global-activity-chart-shell" {...interactionProps}>
			<svg aria-hidden="true" className="global-activity-chart" preserveAspectRatio="none" viewBox="0 0 300 96">
				{values.map((value, index) => {
					const height = heights[index];
					return (
						<rect
							className={`global-activity-chart-bar${hoveredIndex === index ? ' is-active' : ''}`}
							height={height}
							key={index}
							width={Math.max(1, width)}
							x={index * (width + gap)}
							y={96 - height}
						/>
					);
				})}
				{crosshairX !== undefined ? (
					<line className="global-activity-chart-crosshair" x1={crosshairX} x2={crosshairX} y1="0" y2="96" />
				) : null}
			</svg>
			{crosshairX !== undefined &&
			selectedBarTop !== undefined &&
			selectedDate !== undefined &&
			selectedValue !== undefined ? (
				<ChartTooltip date={selectedDate} unit={unit} value={selectedValue} x={crosshairX} y={selectedBarTop} />
			) : null}
		</div>
	);
}

function LineChart({
	values,
	starts,
	label,
	unit,
}: {
	values: number[];
	starts: number[];
	label: string;
	unit: string;
}) {
	const points = values.length ? values : [0];
	const max = Math.max(1, ...points);
	const coordinates = points.map((value, index) => {
		const x = points.length === 1 ? 150 : (index / (points.length - 1)) * 300;
		const y = 92 - (value / max) * 84;
		return { x, y };
	});
	const area = `0,96 ${coordinates.map(({ x, y }) => `${x},${y}`).join(' ')} 300,96`;
	const { hoveredIndex, selectedDate, selectedValue, interactionProps } = useChartInteraction(values, label, starts);
	const selectedPoint = hoveredIndex === null ? undefined : coordinates[hoveredIndex];
	return (
		<div className="global-activity-chart-shell" {...interactionProps}>
			<svg aria-hidden="true" className="global-activity-chart" preserveAspectRatio="none" viewBox="0 0 300 96">
				<polygon className="global-activity-chart-area" points={area} />
				<polyline
					className="global-activity-chart-line"
					points={coordinates.map(({ x, y }) => `${x},${y}`).join(' ')}
				/>
				{selectedPoint ? (
					<line
						className="global-activity-chart-crosshair"
						x1={selectedPoint.x}
						x2={selectedPoint.x}
						y1="0"
						y2="96"
					/>
				) : null}
			</svg>
			{selectedPoint && selectedDate !== undefined && selectedValue !== undefined ? (
				<>
					<span
						aria-hidden="true"
						className="global-activity-chart-point"
						style={{ left: `${(selectedPoint.x / 300) * 100}%`, top: `${selectedPoint.y}px` }}
					/>
					<ChartTooltip
						date={selectedDate}
						unit={unit}
						value={selectedValue}
						x={selectedPoint.x}
						y={selectedPoint.y}
					/>
				</>
			) : null}
		</div>
	);
}

function RollingCounter({ value }: { value: number }) {
	const formatted = formatValue(value);
	return (
		<strong className="global-activity-counter" title={value.toLocaleString()}>
			<span aria-hidden="true" className="global-activity-counter-visual">
				<span className="global-activity-counter-value" key={formatted}>
					{formatted}
				</span>
			</span>
			<span className="sr-only">{formatted}</span>
		</strong>
	);
}

function StatCard({
	label,
	value,
	meta,
	children,
}: React.PropsWithChildren<{ label: string; value: number; meta: string }>) {
	return (
		<article className="global-activity-stat">
			<div className="global-activity-stat-copy">
				<h3>{label}</h3>
				<RollingCounter value={value} />
				<p>{meta}</p>
			</div>
			{children}
		</article>
	);
}

export function GlobalActivityCharts({ events }: { events: CollectionActivityEvent[] }) {
	const stats = React.useMemo(() => globalActivityChartStats(events), [events]);
	const latest = stats.buckets.at(-1);
	const starts = stats.buckets.map((bucket) => bucket.start);
	return (
		<section aria-label="Global market statistics" className="global-activity-stats">
			<StatCard
				label="Events"
				meta={`${latest?.events.toLocaleString() ?? 0} in the latest interval · ${stats.period}`}
				value={stats.events}
			>
				<BarChart
					label="Events"
					starts={starts}
					unit="events"
					values={stats.buckets.map((bucket) => bucket.events)}
				/>
			</StatCard>
			<StatCard
				label="Listings submitted"
				meta={`${latest?.listings.toLocaleString() ?? 0} in the latest interval · ${stats.period}`}
				value={stats.listings}
			>
				<BarChart
					label="Listings submitted"
					starts={starts}
					unit="listings"
					values={stats.buckets.map((bucket) => bucket.listings)}
				/>
			</StatCard>
			<StatCard
				label="Market participants"
				meta={`Unique signing wallets · ${stats.period}`}
				value={stats.participants}
			>
				<LineChart
					label="Market participants"
					starts={starts}
					unit="participants"
					values={stats.buckets.map((bucket) => bucket.participants)}
				/>
			</StatCard>
		</section>
	);
}
