import styled, { keyframes } from 'styled-components';

const radar = keyframes`
	0% {
		opacity: 0.62;
		transform: scale(0.45);
	}
	100% {
		opacity: 0;
		transform: scale(1.65);
	}
`;

export { Chart, Heading } from '../../../styles/price-chart';

export const Quote = styled.div`
	min-width: 0;
	display: grid;
	gap: 5px;

	> small {
		color: var(--muted);
		font-size: var(--type-small);
		font-weight: 500;
		letter-spacing: 0.02em;
	}

	> strong {
		overflow: hidden;
		font-size: clamp(1.8rem, 4vw, 2.65rem);
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.045em;
		line-height: 1;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 760px) {
		> strong {
			font-size: clamp(1.55rem, 7vw, 2.25rem);
		}
	}
`;

export const Ranges = styled.div`
	padding: 12px 18px 16px;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 5px;

	button {
		min-width: 44px;
		height: 36px;
		padding: 0 10px;
		border: 0;
		border-radius: 9px;
		background: var(--transparent);
		cursor: pointer;
		color: var(--muted);
		font-size: var(--type-small);
		font-weight: 600;
		transition: background 120ms ease, color 120ms ease, box-shadow 120ms ease;
	}

	button:hover {
		color: var(--ink);
		background: var(--surface-hover);
	}

	button[aria-pressed='true'] {
		color: var(--ink);
		background: var(--surface-subtle);
		box-shadow: inset 0 0 0 1px var(--line);
	}

	button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	@media (max-width: 760px) {
		width: 100%;
		padding: 10px 8px 14px;
		gap: 3px;

		button {
			min-width: 40px;
			padding-inline: 7px;
			flex: 0 1 48px;
		}
	}
`;

export const HistoryFooter = styled.div`
	min-height: 48px;
	padding: 0 18px 14px;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 12px;

	.ui-button {
		flex: 0 0 auto;
	}
`;

export const Context = styled.div`
	padding: 2px 0 0;
	display: flex;
	align-items: center;
	gap: 8px;
	color: var(--muted);

	> span {
		color: var(--muted);
		font-size: var(--type-body);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	> span[data-direction='up'] {
		color: var(--positive-text);
	}

	> span[data-direction='down'] {
		color: var(--negative);
	}
`;

export const Plot = styled.div`
	--token-price-left-bleed: clamp(28px, 7vw, 56px);
	position: relative;
	height: 285px;
	margin: 0;
	overflow: hidden;
	cursor: crosshair;
	touch-action: pan-y;

	@media (max-width: 760px) {
		height: 245px;
	}
`;

export const TradingView = styled.div`
	position: absolute;
	inset: 0 0 0 calc(var(--token-price-left-bleed) * -1);
	width: calc(100% + var(--token-price-left-bleed));
	height: 100%;
`;

export const CurrentMarker = styled.div`
	--token-price-marker-color: var(--positive-text);
	z-index: 2;
	position: absolute;
	display: flex;
	align-items: center;
	transform: translate(-4px, -50%);
	pointer-events: none;
	color: var(--token-price-marker-color);
	font-variant-numeric: tabular-nums;

	&[data-direction='down'] {
		--token-price-marker-color: var(--negative);
	}

	> strong {
		max-width: 24ch;
		margin-left: 9px;
		padding: 4px 8px;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--token-price-marker-color) 45%, var(--line));
		border-radius: 7px;
		background: color-mix(in srgb, var(--token-price-marker-color) 9%, var(--paper));
		box-shadow: 0 2px 8px color-mix(in srgb, var(--ink) 10%, var(--transparent));
		color: var(--ink);
		font-size: var(--type-small);
		font-weight: 600;
		line-height: 1.2;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

export const CurrentDot = styled.span`
	position: relative;
	width: 8px;
	height: 8px;
	flex: 0 0 auto;
	border: 2px solid var(--paper);
	border-radius: 999px;
	background: var(--token-price-marker-color);
	box-shadow: 0 0 0 1px var(--token-price-marker-color);

	&::before,
	&::after {
		position: absolute;
		inset: -6px;
		border: 1px solid var(--token-price-marker-color);
		border-radius: inherit;
		content: '';
		animation: ${radar} 1.8s ease-out infinite;
	}

	&::after {
		animation-delay: 0.9s;
	}
`;

export const Empty = styled.p`
	min-height: 285px;
	margin: 0;
	display: grid;
	place-items: center;
	color: var(--muted);

	@media (max-width: 760px) {
		min-height: 245px;
	}
`;
