import React from 'react';

import type { CollectionActivityEvent } from 'api/discovery';

import { Loading } from 'components/atoms/Loading';
import { VisuallyHidden } from 'components/atoms/VisuallyHidden';

import {
	chartHoverIndex,
	formatActivityChartDate,
	formatActivityChartValue,
	type GlobalActivityChartStats,
	globalActivityChartStats,
} from '../../../model/activity-chart';

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
				selectedDate === undefined || selectedValue === undefined
					? `${label} over time. Focus and use arrow keys to inspect values.`
					: `${formatActivityChartDate(
							selectedDate
					  )}: ${selectedValue.toLocaleString()} ${label.toLowerCase()}.`,
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

function ChartTooltip(props: { x: number; y: number; date: number; value: number; unit: string }) {
	const edgeClass = props.x < 40 ? ' is-left' : '';
	return (
		<div
			aria-hidden="true"
			className={`global-activity-chart-tooltip${edgeClass}`}
			style={{ left: `${(props.x / 300) * 100}%`, top: `${props.y}px` }}
		>
			<span>{formatActivityChartDate(props.date)}</span>
			<strong>
				{props.value.toLocaleString()} {props.unit}
			</strong>
		</div>
	);
}

function BarChart(props: { values: number[]; starts: number[]; label: string; unit: string }) {
	const max = Math.max(1, ...props.values);
	const gap = 3;
	const width = props.values.length ? (300 - gap * (props.values.length - 1)) / props.values.length : 300;
	const heights = props.values.map((value) => (value ? Math.max(3, (value / max) * 88) : 1));
	const { hoveredIndex, selectedDate, selectedValue, interactionProps } = useChartInteraction(
		props.values,
		props.label,
		props.starts
	);
	const crosshairX = hoveredIndex === null ? undefined : hoveredIndex * (width + gap) + width / 2;
	const selectedBarTop = hoveredIndex === null ? undefined : 96 - heights[hoveredIndex];
	return (
		<div className="global-activity-chart-shell" {...interactionProps}>
			<svg aria-hidden="true" className="global-activity-chart" preserveAspectRatio="none" viewBox="0 0 300 96">
				{props.values.map((value, index) => {
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
				<ChartTooltip
					date={selectedDate}
					unit={props.unit}
					value={selectedValue}
					x={crosshairX}
					y={selectedBarTop}
				/>
			) : null}
		</div>
	);
}

function LineChart(props: { values: number[]; starts: number[]; label: string; unit: string }) {
	const points = props.values.length ? props.values : [0];
	const max = Math.max(1, ...points);
	const coordinates = points.map((value, index) => {
		const x = points.length === 1 ? 150 : (index / (points.length - 1)) * 300;
		const y = 92 - (value / max) * 84;
		return { x, y };
	});
	const area = `0,96 ${coordinates.map(({ x, y }) => `${x},${y}`).join(' ')} 300,96`;
	const { hoveredIndex, selectedDate, selectedValue, interactionProps } = useChartInteraction(
		props.values,
		props.label,
		props.starts
	);
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
						unit={props.unit}
						value={selectedValue}
						x={selectedPoint.x}
						y={selectedPoint.y}
					/>
				</>
			) : null}
		</div>
	);
}

function RollingCounter(props: { value: number }) {
	const formatted = formatActivityChartValue(props.value);
	return (
		<strong className="global-activity-counter" title={props.value.toLocaleString()}>
			<span aria-hidden="true" className="global-activity-counter-visual">
				<span className="global-activity-counter-value" key={formatted}>
					{formatted}
				</span>
			</span>
			<VisuallyHidden>{formatted}</VisuallyHidden>
		</strong>
	);
}

function StatCard(props: React.PropsWithChildren<{ label: string; value: number; meta: string }>) {
	return (
		<article className="global-activity-stat">
			<div className="global-activity-stat-copy">
				<h3>{props.label}</h3>
				<RollingCounter value={props.value} />
				<p>{props.meta}</p>
			</div>
			{props.children}
		</article>
	);
}

export default function GlobalActivityCharts(props: {
	events?: CollectionActivityEvent[];
	/** A summary read independently of the row feed; row filters never change these totals. */
	stats?: GlobalActivityChartStats;
	loading?: boolean;
	unavailable?: boolean;
}) {
	const stats = React.useMemo(
		() => props.stats ?? globalActivityChartStats(props.events ?? []),
		[props.events, props.stats]
	);
	const latest = stats.buckets.at(-1);
	const starts = stats.buckets.map((bucket) => bucket.start);
	if (props.loading || props.unavailable)
		return (
			<section aria-label="Global market statistics" className="global-activity-stats">
				{['Events', 'Listings submitted', 'Market participants'].map((label) => (
					<article className="global-activity-stat global-activity-stat-pending" key={label}>
						<div className="global-activity-stat-copy">
							<h3>{label}</h3>
						</div>
						{props.loading ? <Loading label={`Loading ${label.toLowerCase()}…`} /> : <p>Unavailable</p>}
					</article>
				))}
			</section>
		);
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
