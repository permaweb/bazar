import React from 'react';
import { type CandlestickData, ColorType, createChart, CrosshairMode, type UTCTimestamp } from 'lightweight-charts';

import { TooltipSurface } from 'components/Tooltip';
import { themes } from 'helpers/theme';
import { useTheme } from 'providers/ThemeProvider';

export type TokenPricePoint = {
	id: string;
	timestamp: number;
	value: string;
};

export type TokenPriceRange = '24h' | '7d' | '30d' | 'all';

type TokenPriceCoordinate = {
	x: number;
	y: number;
};

const PRICE_RANGE_OPTIONS: Array<{ label: string; value: TokenPriceRange }> = [
	{ label: '24H', value: '24h' },
	{ label: '7D', value: '7d' },
	{ label: '30D', value: '30d' },
	{ label: 'All', value: 'all' },
];

const PRICE_RANGE_CONTEXT_LABELS: Record<TokenPriceRange, string> = {
	'24h': '24H',
	'7d': '7D',
	'30d': '30D',
	all: 'all indexed asks',
};

const PRICE_RANGE_MS: Record<Exclude<TokenPriceRange, 'all'>, number> = {
	'24h': 24 * 60 * 60 * 1_000,
	'7d': 7 * 24 * 60 * 60 * 1_000,
	'30d': 30 * 24 * 60 * 60 * 1_000,
};

const PRICE_CANDLE_INTERVAL_SECONDS: Record<Exclude<TokenPriceRange, 'all'>, number> = {
	'24h': 60 * 60,
	'7d': 6 * 60 * 60,
	'30d': 24 * 60 * 60,
};

const ALL_RANGE_CANDLE_INTERVALS = [
	60,
	5 * 60,
	15 * 60,
	30 * 60,
	60 * 60,
	2 * 60 * 60,
	4 * 60 * 60,
	12 * 60 * 60,
	24 * 60 * 60,
	7 * 24 * 60 * 60,
	14 * 24 * 60 * 60,
	30 * 24 * 60 * 60,
];

function timestampMilliseconds(timestamp: number) {
	return timestamp < 1_000_000_000_000 ? timestamp * 1_000 : timestamp;
}

export function tokenPricePointsForRange(points: TokenPricePoint[], range: TokenPriceRange, now = Date.now()) {
	const ordered = [...points].sort(
		(left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id)
	);
	if (range === 'all') return ordered;
	const threshold = now - PRICE_RANGE_MS[range];
	return ordered.filter((point) => timestampMilliseconds(point.timestamp) >= threshold);
}

function tokenPriceCandleInterval(points: TokenPricePoint[], range: TokenPriceRange) {
	if (range !== 'all') return PRICE_CANDLE_INTERVAL_SECONDS[range];
	if (points.length < 2) return ALL_RANGE_CANDLE_INTERVALS[0];
	const first = timestampMilliseconds(points[0].timestamp) / 1_000;
	const last = timestampMilliseconds(points.at(-1)!.timestamp) / 1_000;
	const targetCandleCount = Math.min(48, Math.max(8, Math.ceil(points.length / 3)));
	const targetInterval = Math.max(1, (last - first) / targetCandleCount);
	return (
		ALL_RANGE_CANDLE_INTERVALS.find((interval) => interval >= targetInterval) ?? ALL_RANGE_CANDLE_INTERVALS.at(-1)!
	);
}

export type TokenPriceCandle = CandlestickData<UTCTimestamp> & {
	openPoint: TokenPricePoint;
	highPoint: TokenPricePoint;
	lowPoint: TokenPricePoint;
	closePoint: TokenPricePoint;
};

export function tokenPriceCandlestickSeries(points: TokenPricePoint[], range: TokenPriceRange = 'all') {
	const ordered = tokenPricePointsForRange(points, 'all');
	const interval = tokenPriceCandleInterval(ordered, range);
	const candles = new Map<number, TokenPriceCandle>();
	for (const point of ordered) {
		const seconds = Math.floor(timestampMilliseconds(point.timestamp) / 1_000);
		const time = Math.floor(seconds / interval) * interval;
		const value = Number(point.value) / 1_000_000_000_000;
		const candle = candles.get(time);
		if (!candle) {
			candles.set(time, {
				time: time as UTCTimestamp,
				open: value,
				high: value,
				low: value,
				close: value,
				openPoint: point,
				highPoint: point,
				lowPoint: point,
				closePoint: point,
			});
			continue;
		}
		candle.close = value;
		candle.closePoint = point;
		if (BigInt(point.value) > BigInt(candle.highPoint.value)) {
			candle.high = value;
			candle.highPoint = point;
		}
		if (BigInt(point.value) < BigInt(candle.lowPoint.value)) {
			candle.low = value;
			candle.lowPoint = point;
		}
	}
	return [...candles.values()];
}

export function tokenPriceCoordinates(points: TokenPricePoint[], width = 640, height = 180) {
	if (!points.length) return [];
	const values = points.map((point) => BigInt(point.value));
	const minimum = values.reduce((current, value) => (value < current ? value : current));
	const maximum = values.reduce((current, value) => (value > current ? value : current));
	const range = maximum - minimum;
	return values.map((value, index) => {
		const x = points.length === 1 ? width / 2 : (index * width) / (points.length - 1);
		const normalized = range === 0n ? 500n : ((value - minimum) * 1_000n) / range;
		const y = height - (Number(normalized) / 1_000) * height;
		return { x, y };
	});
}

export function tokenPricePolyline(points: TokenPricePoint[], width = 640, height = 180) {
	return tokenPriceCoordinates(points, width, height)
		.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`)
		.join(' ');
}

export function tokenPriceChangePercent(points: TokenPricePoint[]) {
	if (points.length < 2) return null;
	const first = BigInt(points[0].value);
	const last = BigInt(points.at(-1)!.value);
	if (first === 0n) return null;
	return Number(((last - first) * 10_000n) / first) / 100;
}

function formattedTimestamp(timestamp: number) {
	return new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(new Date(timestampMilliseconds(timestamp)));
}

function changeLabel(change: number | null) {
	if (change === null) return 'Not enough data';
	if (change === 0) return 'No change';
	return `${change > 0 ? '+' : ''}${change.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function TokenPriceChart({
	points,
	ticker,
	loading,
	error,
	formatValue,
}: {
	points: TokenPricePoint[];
	ticker: string;
	loading: boolean;
	error: string | null;
	formatValue(value: string): string;
}) {
	const { resolvedTheme } = useTheme();
	const [range, setRange] = React.useState<TokenPriceRange>('all');
	const [activePointId, setActivePointId] = React.useState<string | null>(null);
	const [activeCandleTime, setActiveCandleTime] = React.useState<UTCTimestamp | null>(null);
	const [activeChartCoordinate, setActiveChartCoordinate] = React.useState<TokenPriceCoordinate | null>(null);
	const chartContainerRef = React.useRef<HTMLDivElement>(null);
	const visiblePoints = React.useMemo(() => tokenPricePointsForRange(points, range), [points, range]);
	const candlestickSeries = React.useMemo(
		() => tokenPriceCandlestickSeries(visiblePoints, range),
		[range, visiblePoints]
	);
	const activeIndex = Math.max(
		0,
		activePointId ? visiblePoints.findIndex((point) => point.id === activePointId) : visiblePoints.length - 1
	);
	const activePoint = visiblePoints[activeIndex] ?? null;
	const activeCandle =
		candlestickSeries.find((candle) => candle.time === activeCandleTime) ?? candlestickSeries.at(-1) ?? null;
	const change = tokenPriceChangePercent(visiblePoints);
	const direction = change === null || change === 0 ? 'flat' : change > 0 ? 'up' : 'down';

	React.useEffect(() => {
		const container = chartContainerRef.current;
		if (!container || !candlestickSeries.length) return;

		const chartTheme = themes[resolvedTheme];
		const paper = chartTheme.colors.container.primary.background;
		const muted = chartTheme.colors.font.alt1;
		const line = chartTheme.colors.border.primary;
		const crosshairLabel = chartTheme.colors.container.alt2.background;
		const positive = chartTheme.colors.indicator.primary;
		const negative = chartTheme.colors.global.negative;

		const chart = createChart(container, {
			autoSize: true,
			layout: {
				attributionLogo: false,
				background: { color: paper, type: ColorType.Solid },
				fontFamily: chartTheme.typography.family.primary,
				textColor: muted,
			},
			grid: {
				horzLines: { color: line },
				vertLines: { color: line },
			},
			crosshair: {
				mode: CrosshairMode.Magnet,
				horzLine: { color: muted, labelBackgroundColor: crosshairLabel },
				vertLine: { color: muted, labelBackgroundColor: crosshairLabel },
			},
			rightPriceScale: {
				borderColor: line,
				scaleMargins: { bottom: 0.18, top: 0.12 },
			},
			timeScale: {
				borderColor: line,
				rightOffset: 4,
				secondsVisible: false,
				timeVisible: true,
			},
		});
		const series = chart.addCandlestickSeries({
			borderDownColor: negative,
			borderUpColor: positive,
			downColor: negative,
			priceFormat: { minMove: 0.000000000001, precision: 12, type: 'price' },
			upColor: positive,
			wickDownColor: negative,
			wickUpColor: positive,
		});
		series.setData(candlestickSeries.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
		const candleByTime = new Map(candlestickSeries.map((candle) => [candle.time, candle]));
		chart.subscribeCrosshairMove((event) => {
			if (typeof event.time !== 'number' || !event.point) {
				setActiveChartCoordinate(null);
				return;
			}
			const candle = candleByTime.get(event.time as UTCTimestamp);
			if (!candle) return;
			setActivePointId(candle.closePoint.id);
			setActiveCandleTime(candle.time);
			setActiveChartCoordinate({
				x: (event.point.x / Math.max(1, container.clientWidth)) * 100,
				y: (event.point.y / Math.max(1, container.clientHeight)) * 100,
			});
		});
		chart.timeScale().fitContent();

		return () => chart.remove();
	}, [candlestickSeries, resolvedTheme]);

	return (
		<section className="token-price-chart" aria-busy={loading} aria-label={`${ticker} indexed ask history`}>
			<div className="token-price-chart-heading">
				<div className="token-price-quote" aria-live="polite">
					<strong>{activePoint ? formatValue(activePoint.value) : 'No indexed asks'}</strong>
					<small>
						{activePoint
							? formattedTimestamp(activePoint.timestamp)
							: `No ${ticker} listings in this range`}
					</small>
				</div>
				<div aria-label="Ask history range" className="token-price-ranges" role="group">
					{PRICE_RANGE_OPTIONS.map((option) => (
						<button
							aria-pressed={range === option.value}
							key={option.value}
							onClick={() => {
								setRange(option.value);
								setActivePointId(null);
								setActiveCandleTime(null);
								setActiveChartCoordinate(null);
							}}
							type="button"
						>
							{option.label}
						</button>
					))}
				</div>
			</div>

			{visiblePoints.length ? (
				<>
					<div className="token-price-context">
						<span data-direction={direction}>{changeLabel(change)}</span>
						<small>across {PRICE_RANGE_CONTEXT_LABELS[range]}</small>
					</div>
					<div aria-label={`${ticker} candlestick ask price chart`} className="token-price-plot" role="img">
						<div className="token-price-tradingview" ref={chartContainerRef} />
						{activeCandle && activeChartCoordinate ? (
							<TooltipSurface
								className="token-price-tooltip"
								data-placement={activeChartCoordinate.y < 50 ? 'below' : 'above'}
								style={
									{
										'--token-price-tooltip-x': `${activeChartCoordinate.x}%`,
										top: `${Math.min(84, Math.max(16, activeChartCoordinate.y))}%`,
									} as React.CSSProperties
								}
								visible
							>
								<strong>{formatValue(activeCandle.closePoint.value)}</strong>
								<span>{formattedTimestamp(activeCandle.closePoint.timestamp)}</span>
								<dl className="token-price-candle-values">
									<div>
										<dt>O</dt>
										<dd>{formatValue(activeCandle.openPoint.value)}</dd>
									</div>
									<div>
										<dt>H</dt>
										<dd>{formatValue(activeCandle.highPoint.value)}</dd>
									</div>
									<div>
										<dt>L</dt>
										<dd>{formatValue(activeCandle.lowPoint.value)}</dd>
									</div>
									<div>
										<dt>C</dt>
										<dd>{formatValue(activeCandle.closePoint.value)}</dd>
									</div>
								</dl>
							</TooltipSurface>
						) : null}
					</div>
				</>
			) : loading ? (
				<p className="token-price-empty">Reading indexed asks…</p>
			) : error ? (
				<p className="token-price-empty">Ask history is temporarily unavailable.</p>
			) : (
				<p className="token-price-empty">No indexed asks in this range.</p>
			)}
		</section>
	);
}
