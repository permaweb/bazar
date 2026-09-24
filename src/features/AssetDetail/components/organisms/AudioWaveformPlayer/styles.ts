import styled, { keyframes } from 'styled-components';

import { Button } from 'components/atoms/Button';
import { RangeInput } from 'components/atoms/RangeInput';

const waveformLoading = keyframes`
	to {
		background-position: -180% 0;
	}
`;

export const Player = styled.div`
	width: 100%;
	min-width: 0;
	padding: 11px;
	display: grid;
	grid-template-columns: 52px minmax(0, 1fr);
	align-items: center;
	gap: 12px;
	border: 1px solid var(--line);
	border-radius: 9px;
	background: var(--paper);
	color: var(--ink);
	font-family: 'DM Sans', sans-serif;

	> audio {
		display: none;
	}
`;

export const PlayButton = styled(Button)`
	width: 52px;
	height: 52px;
	padding: 0;
	display: grid;
	place-items: center;
	border: 1px solid var(--line-dark);
	border-radius: 50%;
	background: var(--ink);
	color: var(--paper);
	cursor: pointer;

	&:hover {
		background: var(--fixed-ink);
	}

	&:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 3px;
	}

	svg {
		width: 19px;
		height: 19px;
		fill: currentColor;
		stroke-width: 1.4;
	}

	svg.lucide-play {
		transform: translateX(1px);
	}
`;

export const Main = styled.div`
	min-width: 0;
`;

export const Meta = styled.div`
	min-height: 20px;
	margin-bottom: 3px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	color: var(--muted);
	font-size: var(--type-small);
	line-height: 1;

	span {
		color: var(--ink);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	small {
		overflow: hidden;
		color: var(--muted-subtle);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

export const Viewport = styled.div`
	width: 100%;
	min-width: 0;
	overflow: hidden;
`;

export const Track = styled.div`
	position: relative;
	width: 100%;
	max-width: 100%;
	height: 75px;
	min-width: 0;
	touch-action: none;

	&:focus-within {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
		border-radius: 4px;
	}
`;

export const Bars = styled.div`
	position: absolute;
	inset: 2px 0 auto;
	height: 48px;
	display: flex;
	align-items: center;
	gap: 0.25%;
	pointer-events: none;

	i {
		min-width: 0;
		height: 8%;
		flex: 1 1 0;
		border-radius: 1px;
		background: var(--line-dark);
	}

	&.is-played {
		z-index: 1;
	}

	&.is-played i {
		background: var(--ink);
	}
`;

export const Playhead = styled.span`
	position: absolute;
	z-index: 2;
	top: 0;
	bottom: 22px;
	width: 1px;
	background: var(--accent);
	pointer-events: none;
	transform: translateX(-0.5px);

	&::before {
		content: '';
		position: absolute;
		top: 0;
		left: 50%;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent);
		transform: translate(-50%, -1px);
	}
`;

export const Timeline = styled(RangeInput)`
	position: absolute;
	z-index: 3;
	inset: 0 0 22px;
	width: 100%;
	height: auto;
	margin: 0;
	opacity: 0;
	cursor: ew-resize;

	&:disabled {
		cursor: wait;
	}
`;

export const Ticks = styled.div`
	position: absolute;
	inset: auto 0 1px;
	height: 18px;
	border-top: 1px solid var(--line);
	color: var(--muted-subtle);
	font-size: 10px;
	pointer-events: none;

	span {
		position: absolute;
		top: 5px;
		line-height: 1;
		white-space: nowrap;
		transform: translateX(-50%);
	}

	span:first-child {
		transform: none;
	}

	span:last-child {
		transform: translateX(-100%);
	}
`;

export const Placeholder = styled.div`
	position: absolute;
	inset: 5px 0 auto;
	height: 42px;
	border-radius: 3px;
	background: linear-gradient(90deg, var(--surface-subtle), var(--line), var(--surface-subtle));
	background-size: 180% 100%;

	&.is-loading {
		animation: ${waveformLoading} 1.2s linear infinite;
	}

	&.is-unavailable {
		height: 1px;
		top: 25px;
		background: var(--line-dark);
	}
`;
