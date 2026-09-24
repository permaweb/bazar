import React from 'react';

import type { CollectionActivityEvent } from 'api/discovery';

import { Loading } from 'components/atoms/Loading';
import { VisuallyHidden } from 'components/atoms/VisuallyHidden';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { ACTIVITY_MESSAGES, type ActivityMessages } from '../../../messages';
import {
	type ActivityChartPeriod,
	chartHoverIndex,
	formatActivityChartDate,
	formatActivityChartValue,
	type GlobalActivityChartStats,
	globalActivityChartStats,
} from '../../../model/activity-chart';

import * as S from './styles';

function useChartInteraction(values: number[], label: string, description: string, starts: number[]) {
	const messages = useMessages(ACTIVITY_MESSAGES);
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
					? formatMessage(messages.chartOverview, { label })
					: formatMessage(messages.chartValue, {
							date: formatActivityChartDate(selectedDate),
							value: selectedValue.toLocaleString(),
							label: description,
					  }),
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
		<S.ChartTooltip
			aria-hidden="true"
			className={`global-activity-chart-tooltip${edgeClass}`}
			style={{ left: `${(props.x / 300) * 100}%`, top: `${props.y}px` }}
		>
			<span>{formatActivityChartDate(props.date)}</span>
			<strong>
				{props.value.toLocaleString()} {props.unit}
			</strong>
		</S.ChartTooltip>
	);
}

function BarChart(props: { values: number[]; starts: number[]; label: string; description: string; unit: string }) {
	const max = Math.max(1, ...props.values);
	const gap = 3;
	const width = props.values.length ? (300 - gap * (props.values.length - 1)) / props.values.length : 300;
	const heights = props.values.map((value) => (value ? Math.max(3, (value / max) * 88) : 1));
	const { hoveredIndex, selectedDate, selectedValue, interactionProps } = useChartInteraction(
		props.values,
		props.label,
		props.description,
		props.starts
	);
	const crosshairX = hoveredIndex === null ? undefined : hoveredIndex * (width + gap) + width / 2;
	const selectedBarTop = hoveredIndex === null ? undefined : 96 - heights[hoveredIndex];
	return (
		<S.ChartShell className="global-activity-chart-shell" {...interactionProps}>
			<S.Chart aria-hidden="true" className="global-activity-chart" preserveAspectRatio="none" viewBox="0 0 300 96">
				{props.values.map((value, index) => {
					const height = heights[index];
					return (
						<S.ChartBar
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
					<S.ChartCrosshair
						className="global-activity-chart-crosshair"
						x1={crosshairX}
						x2={crosshairX}
						y1="0"
						y2="96"
					/>
				) : null}
			</S.Chart>
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
		</S.ChartShell>
	);
}

function LineChart(props: { values: number[]; starts: number[]; label: string; description: string; unit: string }) {
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
		props.description,
		props.starts
	);
	const selectedPoint = hoveredIndex === null ? undefined : coordinates[hoveredIndex];
	return (
		<S.ChartShell className="global-activity-chart-shell" {...interactionProps}>
			<S.Chart aria-hidden="true" className="global-activity-chart" preserveAspectRatio="none" viewBox="0 0 300 96">
				<S.ChartArea className="global-activity-chart-area" points={area} />
				<S.ChartLine
					className="global-activity-chart-line"
					points={coordinates.map(({ x, y }) => `${x},${y}`).join(' ')}
				/>
				{selectedPoint ? (
					<S.ChartCrosshair
						className="global-activity-chart-crosshair"
						x1={selectedPoint.x}
						x2={selectedPoint.x}
						y1="0"
						y2="96"
					/>
				) : null}
			</S.Chart>
			{selectedPoint && selectedDate !== undefined && selectedValue !== undefined ? (
				<>
					<S.ChartPoint
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
		</S.ChartShell>
	);
}

function RollingCounter(props: { value: number }) {
	const formatted = formatActivityChartValue(props.value);
	return (
		<S.Counter className="global-activity-counter" title={props.value.toLocaleString()}>
			<S.CounterVisual aria-hidden="true" className="global-activity-counter-visual">
				<S.CounterValue className="global-activity-counter-value" key={formatted}>
					{formatted}
				</S.CounterValue>
			</S.CounterVisual>
			<VisuallyHidden>{formatted}</VisuallyHidden>
		</S.Counter>
	);
}

function StatCard(props: React.PropsWithChildren<{ label: string; value: number; meta: string }>) {
	return (
		<S.Stat className="global-activity-stat">
			<S.StatCopy className="global-activity-stat-copy">
				<h3>{props.label}</h3>
				<RollingCounter value={props.value} />
				<p>{props.meta}</p>
			</S.StatCopy>
			{props.children}
		</S.Stat>
	);
}

export default function GlobalActivityCharts(props: {
	events?: CollectionActivityEvent[];
	/** A summary read independently of the row feed; row filters never change these totals. */
	stats?: GlobalActivityChartStats;
	loading?: boolean;
	unavailable?: boolean;
}) {
	const messages = useMessages(ACTIVITY_MESSAGES);
	const stats = React.useMemo(
		() => props.stats ?? globalActivityChartStats(props.events ?? []),
		[props.events, props.stats]
	);
	const latest = stats.buckets.at(-1);
	const starts = stats.buckets.map((bucket) => bucket.start);
	const period = activityChartPeriodLabel(stats.period, messages);
	if (props.loading || props.unavailable)
		return (
			<S.Stats aria-label={messages.globalStats} className="global-activity-stats">
				{[
					{ label: messages.statEvents, loading: messages.statEventsLoading },
					{ label: messages.statListings, loading: messages.statListingsLoading },
					{ label: messages.statParticipants, loading: messages.statParticipantsLoading },
				].map((stat) => (
					<S.Stat className="global-activity-stat global-activity-stat-pending" key={stat.label}>
						<S.StatCopy className="global-activity-stat-copy">
							<h3>{stat.label}</h3>
						</S.StatCopy>
						{props.loading ? <Loading label={stat.loading} /> : <p>{messages.statUnavailable}</p>}
					</S.Stat>
				))}
			</S.Stats>
		);
	return (
		<S.Stats aria-label={messages.globalStats} className="global-activity-stats">
			<StatCard
				label={messages.statEvents}
				meta={formatMessage(messages.statLatestInterval, {
					count: latest?.events.toLocaleString() ?? 0,
					period,
				})}
				value={stats.events}
			>
				<BarChart
					description={messages.statEventsDescription}
					label={messages.statEvents}
					starts={starts}
					unit={messages.statEventsUnit}
					values={stats.buckets.map((bucket) => bucket.events)}
				/>
			</StatCard>
			<StatCard
				label={messages.statListings}
				meta={formatMessage(messages.statLatestInterval, {
					count: latest?.listings.toLocaleString() ?? 0,
					period,
				})}
				value={stats.listings}
			>
				<BarChart
					description={messages.statListingsDescription}
					label={messages.statListings}
					starts={starts}
					unit={messages.statListingsUnit}
					values={stats.buckets.map((bucket) => bucket.listings)}
				/>
			</StatCard>
			<StatCard
				label={messages.statParticipants}
				meta={formatMessage(messages.statParticipantsMeta, { period })}
				value={stats.participants}
			>
				<LineChart
					description={messages.statParticipantsDescription}
					label={messages.statParticipants}
					starts={starts}
					unit={messages.statParticipantsUnit}
					values={stats.buckets.map((bucket) => bucket.participants)}
				/>
			</StatCard>
		</S.Stats>
	);
}

/** The summary's covered span, formatted for display; the model keeps it as timestamps. */
function activityChartPeriodLabel(period: ActivityChartPeriod, messages: ActivityMessages) {
	if (!period) return messages.chartPeriodUndated;
	return formatMessage(messages.chartPeriodRange, {
		from: formatActivityChartDate(period.from),
		to: formatActivityChartDate(period.to),
	});
}
