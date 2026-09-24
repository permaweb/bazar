import styled, { keyframes } from 'styled-components';

const counterRoll = keyframes`
	from {
		opacity: 0.35;
		transform: translateY(0.5em) rotateX(-70deg);
	}
	to {
		opacity: 1;
		transform: translateY(0) rotateX(0);
	}
`;

export const Stats = styled.section`
	margin: 0 0 12px;
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 10px;

	@media (max-width: 900px) {
		grid-template-columns: repeat(3, minmax(260px, 82vw));
		overflow-x: auto;
		scroll-snap-type: x proximity;
	}
`;

export const Stat = styled.article`
	min-width: 0;
	min-height: 190px;
	padding: 14px 14px 0;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	overflow: hidden;
	border: 1px solid var(--line);
	border-radius: 10px;
	background: var(--paper);
	font-family: inherit;
	font-weight: 400;

	h3,
	p {
		margin: 0;
	}

	h3 {
		color: var(--muted);
		font-size: var(--type-body);
		font-weight: 400;
		line-height: 1.3;
	}

	p {
		margin-top: 6px;
		overflow: hidden;
		color: var(--muted);
		font-size: var(--type-small);
		font-weight: 400;
		line-height: 1.35;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&.global-activity-stat-pending {
		min-height: 190px;
	}

	&.global-activity-stat-pending > .loading,
	&.global-activity-stat-pending > p {
		margin: auto;
		padding: 24px;
	}

	&.global-activity-stat-pending .loading {
		min-height: 0;
		font-size: 12px;
	}

	@media (max-width: 900px) {
		scroll-snap-align: start;
	}
`;

export const StatCopy = styled.div`
	position: relative;
	z-index: 1;
`;

export const Counter = styled.strong`
	margin-top: 3px;
	display: block;
	font-size: var(--type-display);
	font-weight: 400;
	font-variant-numeric: tabular-nums;
	line-height: 1;
`;

export const CounterVisual = styled.span`
	height: 1em;
	display: inline-block;
	overflow: hidden;
	perspective: 4em;
	vertical-align: top;
`;

export const CounterValue = styled.span`
	display: block;
	line-height: 1;
	transform-origin: center bottom;
	animation: ${counterRoll} 480ms cubic-bezier(0.22, 0.8, 0.24, 1);

	@media (prefers-reduced-motion: reduce) {
		animation: none;
	}
`;

export const ChartShell = styled.div`
	position: relative;
	width: calc(100% + 28px);
	height: 96px;
	margin-left: -14px;
	overflow: visible;
	cursor: crosshair;
	outline: none;
	touch-action: pan-x pan-y;

	&:focus-visible {
		box-shadow: inset 0 0 0 2px var(--event-blue);
	}
`;

export const Chart = styled.svg`
	width: 100%;
	height: 100%;
	display: block;
`;

export const ChartBar = styled.rect`
	fill: var(--activity-chart-bar);
	opacity: 1;
	transition: fill 120ms ease;

	&.is-active {
		fill: var(--activity-chart-bar-hover);
	}
`;

export const ChartArea = styled.polygon`
	fill: var(--event-blue-surface);
	opacity: 0.72;
`;

export const ChartLine = styled.polyline`
	fill: none;
	stroke: var(--event-blue);
	stroke-linecap: round;
	stroke-linejoin: round;
	stroke-width: 2;
	opacity: 0.82;
	vector-effect: non-scaling-stroke;
`;

export const ChartCrosshair = styled.line`
	stroke: var(--event-blue);
	stroke-dasharray: 3 3;
	stroke-width: 1;
	vector-effect: non-scaling-stroke;
`;

export const ChartPoint = styled.span`
	position: absolute;
	z-index: 1;
	width: 8px;
	height: 8px;
	transform: translate(-50%, -50%);
	border: 2px solid var(--event-blue);
	border-radius: 50%;
	background: var(--paper);
	pointer-events: none;
`;

export const ChartTooltip = styled.div`
	position: absolute;
	z-index: 2;
	min-width: max-content;
	padding: 5px 7px;
	transform: translate(calc(-100% - 7px), calc(-100% - 7px));
	border: 1px solid var(--tooltip-border);
	border-radius: 6px;
	color: var(--contrast-text);
	background: var(--tooltip-background);
	box-shadow: 0 4px 12px var(--shadow-floating);
	font-family: inherit;
	font-size: var(--type-small);
	font-weight: 400;
	line-height: 1.35;
	pointer-events: none;

	&.is-left {
		transform: translate(7px, calc(-100% - 7px));
	}

	span,
	strong {
		display: block;
	}

	span {
		opacity: 0.72;
	}

	strong {
		margin-top: 1px;
		font-size: inherit;
		font-weight: 400;
		font-variant-numeric: tabular-nums;
	}
`;
