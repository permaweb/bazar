import styled from 'styled-components';

import { Button } from 'components/atoms/Button';

// The grid "table" shared by the unique asset orderbook, the fungible orderbook and the fungible holder table.
// Rules stay in their original stylesheet order inside each block so the last declaration still wins.

export const Table = styled.div`
	border: 1px solid var(--line);
	border-radius: 10px;
	overflow: hidden;

	@media (max-width: 760px) {
		&:not(.fungible-orderbook) .orderbook-row {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 12px 18px;
		}

		&:not(.fungible-orderbook) .orderbook-row > :nth-child(3) {
			grid-column: 1;
		}

		&:not(.fungible-orderbook) .orderbook-row > :nth-child(4) {
			grid-column: 2;
		}
	}
`;

export const Head = styled.div`
	display: grid;
	grid-template-columns: 1.2fr 0.7fr 1fr 0.65fr;
	gap: 12px;
	align-items: center;
	padding: 9px 13px;
	background: var(--panel);
	color: var(--muted-subtle);
	font: 400 var(--type-small) 'DM Sans', sans-serif;

	@media (max-width: 760px) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
`;

export const Row = styled.div`
	display: grid;
	grid-template-columns: 1.2fr 0.7fr 1fr 0.65fr;
	gap: 12px;
	align-items: center;
	padding: 16px 13px;
	font-size: var(--type-body);

	> strong {
		font-family: 'DM Sans', sans-serif;
		font-size: var(--type-body);
	}

	> [role='cell'] > a {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	@media (max-width: 760px) {
		> [data-label] {
			min-width: 0;
			display: grid;
			gap: 2px;
			overflow-wrap: anywhere;
		}

		> [data-label]::before {
			content: attr(data-label);
			color: var(--muted);
			font-size: var(--type-small);
			font-weight: 400;
		}
	}
`;

export const Status = styled.span`
	width: fit-content;
	padding: 4px 7px;
	border-radius: 5px;
	background: var(--positive-surface);
	color: var(--positive-text);
	font: 400 var(--type-small) 'DM Sans', sans-serif;

	&.reserved {
		background: var(--warning-surface);
		color: var(--warning-text);
	}
`;

export const Empty = styled.div`
	padding: 28px 18px;
	display: grid;
	gap: 5px;
	text-align: center;

	strong {
		font-family: 'DM Sans', sans-serif;
	}

	span {
		color: var(--muted-subtle);
		font-size: var(--type-body);
	}
`;

export const EmptyCell = styled.div`
	display: grid;
	gap: 5px;
`;

export const MarketNote = styled.p`
	margin: 14px 0 0;
	color: var(--muted);
	font-size: var(--type-small);
	line-height: 1.5;

	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
`;

export const OrderAction = styled(Button)`
	min-height: 30px;
	padding: 5px 9px;
	border: 1px solid var(--line-dark);
	border-radius: 5px;
	background: var(--paper);
	cursor: pointer;
	color: var(--ink);
	font-size: var(--type-small);
	font-weight: 400;

	&:hover {
		border-color: var(--line-dark);
		background: var(--panel);
	}

	/* Kept from the shared narrow-screen touch-target rule that still lists other features' controls. */
	@media (max-width: 480px) {
		min-height: 44px;
	}
`;

export const ActionCell = styled.span`
	display: flex;
	justify-content: flex-end;
`;

export const Reveal = styled.div`
	margin-top: 12px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;

	p {
		margin: 0;
		color: var(--muted);
		font-size: var(--type-body);
	}

	p:focus-visible {
		border-radius: 4px;
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}

	button {
		min-height: 44px;
	}
`;

export const FungibleTable = styled(Table)`
	--orderbook-surface: var(--paper);
	--orderbook-surface-raised: var(--panel);
	--orderbook-text: var(--ink);
	--orderbook-muted: var(--muted-subtle);
	--orderbook-ask: var(--positive);
	overflow-x: auto;
	overscroll-behavior-inline: contain;
	border-color: var(--line-dark);
	border-radius: 7px;
	background: var(--orderbook-surface);
	color: var(--orderbook-text);

	.orderbook-head,
	.orderbook-row {
		grid-template-columns: 1.2fr 1fr 0.9fr 0.85fr 0.65fr 0.62fr;
	}

	.orderbook-head {
		font-size: var(--type-small);
	}

	.orderbook-row {
		font-size: var(--type-body);
	}

	.orderbook-row + .orderbook-row {
		border-top: 1px solid var(--line);
	}

	@media (max-width: 760px) {
		.orderbook-head {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}

		.orderbook-row {
			grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.9fr) minmax(0, 0.8fr) auto;
			gap: 10px 14px;
		}

		.orderbook-row > :nth-child(4) {
			grid-column: 1 / span 2;
		}

		.orderbook-row > :nth-child(5) {
			grid-column: 3;
		}

		.orderbook-action-cell {
			grid-column: 4;
			grid-row: 1 / span 2;
		}
	}

	@media (max-width: 480px) {
		.orderbook-row {
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 10px 14px;
			align-items: center;
		}

		.orderbook-row > :nth-child(1),
		.orderbook-row > :nth-child(2),
		.orderbook-row > :nth-child(3),
		.orderbook-row > :nth-child(4),
		.orderbook-row > :nth-child(5) {
			min-width: 0;
			display: grid;
			grid-column: 1;
			gap: 2px;
			overflow-wrap: anywhere;
		}

		.orderbook-action-cell {
			grid-column: 2;
			grid-row: 1 / span 5;
		}

		.orderbook-action-cell:empty {
			display: none;
		}

		.order-action {
			min-width: 74px;
		}

		.orderbook-row > strong {
			font-size: var(--type-body);
		}
	}

	.orderbook-head,
	.orderbook-row {
		min-width: 570px;
		grid-template-columns:
			minmax(112px, 1fr) minmax(84px, 0.72fr) minmax(84px, 0.72fr) minmax(102px, 0.82fr)
			minmax(64px, 0.48fr);
		gap: 10px;
	}

	.orderbook-head {
		position: static;
		width: auto;
		height: auto;
		padding: 10px 12px 8px;
		overflow: visible;
		clip: auto;
		white-space: nowrap;
		border: 0;
		border-bottom: 1px solid var(--line);
		background: var(--orderbook-surface-raised);
		color: var(--orderbook-muted);
		font-size: 0.68rem;
	}

	.orderbook-head > :nth-child(2),
	.orderbook-head > :nth-child(3),
	.orderbook-head > :nth-child(4),
	.orderbook-head > :nth-child(5) {
		text-align: right;
	}

	.orderbook-head > :nth-child(6) {
		display: none;
	}

	.orderbook-row > [role='cell'] {
		position: relative;
		z-index: 1;
		min-width: 0;
		display: block;
		grid-column: auto;
		grid-row: auto;
		overflow: hidden;
		overflow-wrap: normal;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.orderbook-row {
		min-height: 32px;
		padding: 6px 12px;
		border: 0;
		font-size: 0.74rem;
		line-height: 1.25;
	}

	.orderbook-row + .orderbook-row {
		border-top: 0;
	}

	.orderbook-row > :nth-child(1) {
		color: var(--orderbook-ask);
		font-weight: 400;
	}

	.orderbook-row > :nth-child(2),
	.orderbook-row > :nth-child(3),
	.orderbook-row > :nth-child(4) {
		text-align: right;
	}

	.orderbook-depth-row {
		position: relative;
		isolation: isolate;
	}

	.orderbook-depth-row::before {
		position: absolute;
		inset: 0 auto 0 0;
		z-index: 0;
		width: var(--orderbook-depth, 0%);
		border-right: 1px solid color-mix(in srgb, var(--orderbook-ask) 18%, var(--transparent));
		background: linear-gradient(
			270deg,
			color-mix(in srgb, var(--orderbook-ask) 18%, var(--transparent)),
			color-mix(in srgb, var(--orderbook-ask) 10%, var(--transparent))
		);
		content: '';
		pointer-events: none;
	}

	.wallet-address {
		max-width: 100%;
		min-height: 24px;
		padding: 2px 0;
		justify-content: flex-start;
		gap: 5px;
		border: 0;
		border-radius: 3px;
		color: var(--orderbook-muted);
	}

	.orderbook-row > .order-status {
		grid-column: 5;
		justify-self: end;
		padding: 0;
		background: var(--transparent);
		color: var(--positive-text);
		font-size: 0.68rem;
	}

	.orderbook-row > .order-status.reserved {
		background: var(--transparent);
		color: var(--warning-text);
	}

	.orderbook-row > [data-label]::before {
		display: none;
		content: none;
	}

	.orderbook-action-cell {
		grid-column: 5;
		width: max-content;
		display: flex;
		justify-self: start;
	}

	.orderbook-action-cell:empty {
		display: none;
	}

	@media (max-width: 640px) {
		.orderbook-head,
		.orderbook-row {
			min-width: 0;
			grid-template-columns: minmax(78px, 1fr) minmax(64px, 0.8fr) minmax(64px, 0.8fr) auto;
			gap: 8px;
		}

		.orderbook-head > :nth-child(4),
		.orderbook-row > :nth-child(4) {
			display: none;
		}

		.orderbook-head > :nth-child(5),
		.orderbook-row > :nth-child(5) {
			grid-column: 4;
		}

		.orderbook-action-cell {
			grid-column: 4;
		}
	}
`;

export const HolderTable = styled(Table)`
	.orderbook-head,
	.orderbook-row {
		grid-template-columns: minmax(200px, 1.35fr) minmax(150px, 0.8fr) minmax(70px, 0.35fr) minmax(130px, 0.7fr);
	}

	.wallet-address {
		max-width: 100%;
		justify-content: flex-start;
	}
`;

export const HolderShare = styled.span`
	color: var(--muted);
	font-variant-numeric: tabular-nums;
`;
