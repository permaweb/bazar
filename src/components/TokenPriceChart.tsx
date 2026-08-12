import React from 'react';

import { TooltipSurface } from 'components/Tooltip';

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
	const [range, setRange] = React.useState<TokenPriceRange>('all');
	const [activePointId, setActivePointId] = React.useState<string | null>(null);
	const visiblePoints = React.useMemo(() => tokenPricePointsForRange(points, range), [points, range]);
	const activeIndex = Math.max(
		0,
		activePointId ? visiblePoints.findIndex((point) => point.id === activePointId) : visiblePoints.length - 1
	);
	const activePoint = visiblePoints[activeIndex] ?? null;
	const coordinates = tokenPriceCoordinates(visiblePoints);
	const activeCoordinate = coordinates[activeIndex] ?? null;
	const polyline = tokenPricePolyline(visiblePoints);
	const area = polyline ? `${polyline} 640.00,180.00 0.00,180.00` : '';
	const change = tokenPriceChangePercent(visiblePoints);
	const direction = change === null || change === 0 ? 'flat' : change > 0 ? 'up' : 'down';
	const gradientId = `token-price-area-${React.useId().replace(/:/g, '')}`;

	const inspectNearestPoint = React.useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (!visiblePoints.length) return;
			const bounds = event.currentTarget.getBoundingClientRect();
			const progress = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
			const index = Math.round(progress * Math.max(0, visiblePoints.length - 1));
			setActivePointId(visiblePoints[index].id);
		},
		[visiblePoints]
	);

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
					<div
						className="token-price-plot"
						onPointerDown={inspectNearestPoint}
						onPointerMove={inspectNearestPoint}
					>
						<svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 640 180">
							<defs>
								<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
									<stop offset="0%" stopColor="var(--positive)" stopOpacity="0.22" />
									<stop offset="100%" stopColor="var(--positive)" stopOpacity="0" />
								</linearGradient>
							</defs>
							<line className="token-price-grid-line" x1="0" x2="640" y1="0" y2="0" />
							<line className="token-price-grid-line" x1="0" x2="640" y1="90" y2="90" />
							<line className="token-price-grid-line" x1="0" x2="640" y1="180" y2="180" />
							{visiblePoints.length > 1 ? (
								<>
									<polygon fill={`url(#${gradientId})`} points={area} />
									<polyline className="token-price-line" points={polyline} />
								</>
							) : null}
							{activeCoordinate ? (
								<>
									<line
										className="token-price-cursor"
										x1={activeCoordinate.x}
										x2={activeCoordinate.x}
										y1="0"
										y2="180"
									/>
									<circle
										className="token-price-active-point"
										cx={activeCoordinate.x}
										cy={activeCoordinate.y}
										r="5"
									/>
								</>
							) : null}
						</svg>
						<div className="token-price-hit-points">
							{coordinates.map((coordinate, index) => {
								const point = visiblePoints[index];
								return (
									<button
										aria-label={`${formattedTimestamp(point.timestamp)}, ${formatValue(
											point.value
										)}`}
										className={point.id === activePoint?.id ? 'is-active' : ''}
										key={point.id}
										onFocus={() => setActivePointId(point.id)}
										onMouseEnter={() => setActivePointId(point.id)}
										style={{
											left: `${(coordinate.x / 640) * 100}%`,
											top: `${(coordinate.y / 180) * 100}%`,
										}}
										type="button"
									/>
								);
							})}
						</div>
						{activePoint && activeCoordinate ? (
							<TooltipSurface
								className="token-price-tooltip"
								style={{
									left: `${Math.min(88, Math.max(12, (activeCoordinate.x / 640) * 100))}%`,
									top: `${Math.min(84, Math.max(16, (activeCoordinate.y / 180) * 100))}%`,
								}}
								visible
							>
								<strong>{formatValue(activePoint.value)}</strong>
								<span>{formattedTimestamp(activePoint.timestamp)}</span>
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
