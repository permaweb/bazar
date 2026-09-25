import styled, { keyframes } from 'styled-components';

const amountTicker = keyframes`
	to {
		transform: translate3d(var(--activity-ticker-shift), 0, 0);
	}
`;

export const Amount = styled.span`
	/* The compact row sizes every cell the same way before this component's own rules. */
	min-width: 0;
	overflow: hidden;
	font-size: 0.72rem;
	text-overflow: ellipsis;
	white-space: nowrap;
	grid-column: 3;
	position: relative;
	font-variant-numeric: tabular-nums;
	text-align: right;

	/* Hovering the compact row swaps the clipped value for the scrolling track. */
	.activity-row-compact:hover &.is-overflowing .activity-compact-amount-static {
		opacity: 0;
	}

	.activity-row-compact:hover &.is-overflowing .activity-compact-amount-track {
		opacity: 1;
		animation: ${amountTicker} var(--activity-ticker-duration) linear infinite;
	}

	@media (max-width: 640px) {
		grid-column: 3;
		grid-row: 1;
	}
`;

export const Static = styled.span`
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	transition: opacity 100ms ease;
`;

export const Track = styled.span`
	position: absolute;
	top: 0;
	left: 0;
	width: max-content;
	display: flex;
	gap: 24px;
	opacity: 0;
	pointer-events: none;
	text-align: left;
	will-change: transform;

	> span {
		flex: 0 0 auto;
	}
`;
