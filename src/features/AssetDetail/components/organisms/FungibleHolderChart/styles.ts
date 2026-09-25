import styled, { css } from 'styled-components';

export const Card = styled.section`
	margin-bottom: 16px;
	padding: clamp(18px, 2.4vw, 26px);
	display: grid;
	grid-template-columns: minmax(190px, 0.72fr) minmax(280px, 1.28fr);
	align-items: center;
	gap: clamp(24px, 3.4vw, 46px);
	border: 1px solid var(--line-dark);
	border-radius: 16px;
	background: var(--paper);

	@media (max-width: 640px) {
		grid-template-columns: 1fr;
	}
`;

export const Visual = styled.div`
	width: min(100%, 244px);
	justify-self: center;

	svg {
		width: 100%;
		height: auto;
		display: block;
		overflow: visible;
	}

	text {
		font-family: 'DM Sans', sans-serif;
	}

	@media (max-width: 640px) {
		width: min(76vw, 230px);
	}
`;

const ring = css`
	fill: none;
	transform: rotate(-90deg);
	transform-origin: 120px 120px;
`;

export const Track = styled.circle`
	${ring}
	stroke: var(--surface-subtle);
	stroke-width: 34;
`;

export const Arc = styled.circle`
	${ring}
	stroke-width: 34;
	transition: filter 140ms ease, opacity 140ms ease, stroke-width 140ms ease;
`;

export const Hit = styled.circle`
	${ring}
	stroke: var(--transparent);
	stroke-width: 46;
`;

export const Slice = styled.g`
	cursor: default;
	outline: none;

	&:hover .fungible-holder-chart-arc,
	&.is-active .fungible-holder-chart-arc,
	&:focus-visible .fungible-holder-chart-arc {
		filter: saturate(1.08) drop-shadow(0 2px 3px var(--shadow-soft));
		stroke-width: 38;
	}

	&:focus-visible .fungible-holder-chart-hit {
		stroke: color-mix(in srgb, var(--focus-ring) 48%, var(--transparent));
		stroke-width: 50;
	}
`;

export const Value = styled.text`
	fill: var(--ink);
	font-size: 1.65rem;
	font-weight: 500;
	font-variant-numeric: tabular-nums;
	letter-spacing: -0.035em;
`;

export const Label = styled.text`
	fill: var(--muted);
	font-size: var(--type-small);
	letter-spacing: 0;
`;

export const Detail = styled.div`
	min-width: 0;
	display: grid;
	gap: 16px;

	header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}

	header > div {
		min-width: 0;
		display: grid;
		gap: 3px;
	}

	header h2,
	header p {
		margin: 0;
	}

	header h2 {
		font: 500 var(--type-body) 'DM Sans', sans-serif;
	}

	header p,
	header > span,
	dt {
		color: var(--muted);
		font-size: var(--type-small);
	}

	header p {
		line-height: 1.4;
	}

	header > span {
		flex: 0 0 auto;
		padding: 5px 8px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface-subtle);
		white-space: nowrap;
	}

	dl {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	dl div {
		min-width: 0;
		padding: 13px 14px;
		display: grid;
		gap: 5px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--surface-subtle);
	}

	dd {
		margin: 0;
		font-size: 1.3rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.025em;
		line-height: 1.1;
	}

	@media (max-width: 640px) {
		dl {
			grid-template-columns: minmax(0, 1fr);
		}
	}
`;

export const Identity = styled.div`
	min-width: 0;
	display: grid;
	gap: 3px;
	font-size: var(--type-body);

	> span {
		color: var(--muted);
		font-size: var(--type-small);
	}

	.wallet-address {
		width: fit-content;
		max-width: 100%;
		min-height: 26px;
		padding: 2px 0;
		font-size: var(--type-body);
	}

	> strong {
		font-weight: 500;
	}
`;

export const Balances = styled.div`
	padding-block: 1px;
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 10px;

	span {
		color: var(--muted);
		font-size: var(--type-small);
	}

	> div {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	strong {
		min-width: 0;
		overflow: hidden;
		font-size: var(--type-body);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		grid-template-columns: minmax(0, 1fr);
	}
`;

export const Legend = styled.div`
	display: flex;
	align-items: center;
	gap: 16px;
	color: var(--muted);
	font-size: var(--type-small);

	span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	i {
		width: 17px;
		height: 8px;
		display: inline-block;
		border-radius: 2px;
		background: var(--positive-text);
	}

	i.is-listed {
		background: repeating-linear-gradient(
			128deg,
			var(--positive-text) 0 4px,
			color-mix(in srgb, var(--positive-text) 30%, var(--panel)) 4px 7px
		);
	}
`;
