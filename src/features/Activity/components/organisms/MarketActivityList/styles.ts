import styled, { css } from 'styled-components';

import { Tooltip } from 'components/atoms/Tooltip';

export const List = styled.ul`
	margin: 0;
	padding: 0;
	display: grid;
	gap: 8px;
	list-style: none;

	&.compact {
		gap: 0;
	}
`;

export const Row = styled.li`
	padding: 14px 16px;
	display: grid;
	grid-template-columns: 38px minmax(180px, 1fr) minmax(324px, 1.3fr);
	align-items: center;
	gap: 14px;
	border: 1px solid var(--line);
	border-radius: 10px;
	background: var(--paper);
	transition: background 0.1s ease, border-color 0.1s ease;

	@media (max-width: 760px) {
		grid-template-columns: 36px minmax(0, 1fr);
		gap: 8px 12px;
	}

	/* The compact variant keeps the row class, so its overrides carry both. */
	&.activity-row-compact {
		min-height: 40px;
		padding: 7px 2px;
		grid-template-columns:
			24px minmax(140px, 1fr) minmax(86px, 0.48fr) minmax(96px, 0.52fr)
			minmax(88px, auto) 24px;
		gap: 8px;
		border: 0;
		border-radius: 0;
		background: var(--transparent);

		.activity-icon {
			width: 24px;
			height: 24px;
		}

		.activity-icon .ui-icon {
			width: 12px;
			height: 12px;
		}

		@media (max-width: 640px) {
			grid-template-columns: 24px minmax(0, 1fr) minmax(76px, auto) 24px;
			grid-template-rows: auto auto;
			gap: 1px 8px;
		}
	}

	/* Declared after the compact block so the hover border colour still outranks its border reset,
	 * exactly as the two rules ordered themselves in the stylesheet. */
	&:hover {
		border-color: var(--line-dark);
		background: var(--panel);
		transform: none;
	}

	&.activity-row-compact:hover {
		background: var(--surface-subtle);
	}
`;

export const ActionIcon = styled.span`
	width: 34px;
	height: 34px;
	display: grid;
	place-items: center;
	border-radius: 50%;
	background: var(--surface);

	&.action-make-offer {
		color: var(--event-purple);
		background: var(--event-purple-surface);
	}

	&.action-register-interest {
		color: var(--event-orange);
		background: var(--event-orange-surface);
	}

	&.action-transfer {
		color: var(--event-blue);
		background: var(--event-blue-surface);
	}

	&.action-cancel-order {
		color: var(--event-pink);
		background: var(--event-pink-surface);
	}
`;

const stackedCell = css`
	min-width: 0;
	display: grid;
	gap: 3px;
`;

export const Main = styled.div`
	${stackedCell}

	&.has-amount {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		column-gap: 20px;
	}

	.activity-amount {
		max-width: 19ch;
		overflow: hidden;
		color: var(--ink);
		font: 400 clamp(1.2rem, 1.8vw, 1.55rem) / 1.1 'DM Sans', sans-serif;
		letter-spacing: -0.04em;
		text-align: right;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

export const MainCopy = styled.div`
	${stackedCell}

	> strong {
		font: 400 var(--type-body) 'DM Sans', sans-serif;
	}

	/* On a phone the activity rows become tap targets inside the collection and home activity pages. */
	@media (max-width: 480px) {
		.collection-activity-page & > a,
		.home-activity-panel & > a {
			min-height: 44px;
			display: inline-flex;
			align-items: center;
		}
	}

	> a,
	> span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--type-body);
	}

	> a {
		text-decoration: none;
	}

	> small {
		overflow: hidden;
		color: var(--muted);
		font-size: var(--type-small);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

export const ReservationExpired = styled.span`
	color: var(--negative);
	filter: brightness(0.82);
`;

export const Meta = styled.div`
	min-width: 0;
	display: grid;
	grid-template-columns: minmax(130px, 0.6fr) minmax(180px, 0.7fr);
	align-items: start;
	gap: 14px;

	@media (max-width: 760px) {
		grid-column: 1 / -1;
		grid-template-columns: minmax(0, 1fr) auto;
		padding-top: 4px;
		border-top: 1px solid var(--line);
		gap: 10px;
	}
`;

export const Actor = styled.div`
	min-width: 0;
	display: grid;
	align-items: start;
	gap: 3px;
	text-align: left;

	/* On a phone the activity rows become tap targets inside the collection and home activity pages. */
	@media (max-width: 480px) {
		.collection-activity-page & a,
		.home-activity-panel & a {
			min-height: 44px;
			display: inline-flex;
			align-items: center;
		}
	}

	/* On a phone the activity rows become tap targets inside the collection and home activity pages. */
	@media (max-width: 480px) {
		.collection-activity-page & .wallet-address,
		.home-activity-panel & .wallet-address {
			min-height: 44px;
			display: inline-flex;
			align-items: center;
		}
	}

	.wallet-address {
		min-width: 0;
		min-height: 0;
		padding: 0;
	}

	span {
		color: var(--muted);
		font-size: var(--type-small);
	}

	> span {
		color: var(--ink);
		font-size: var(--type-body);
		line-height: 1.35;
	}

	strong,
	a,
	.wallet-address {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--type-body);
	}

	@media (max-width: 760px) {
		display: grid;
		align-items: start;
		gap: 3px;
		text-align: left;
	}
`;

export const Block = styled.div`
	${stackedCell}
	text-align: right;

	/* On a phone the activity rows become tap targets inside the collection and home activity pages. */
	@media (max-width: 480px) {
		.collection-activity-page & a,
		.home-activity-panel & a {
			min-height: 44px;
			display: inline-flex;
			align-items: center;
		}
	}

	@media (max-width: 480px) {
		.collection-activity-page & a,
		.home-activity-panel & a {
			justify-content: flex-end;
		}
	}

	span {
		color: var(--muted);
		font-size: var(--type-small);
	}

	a {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--type-body);
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 4px;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.activity-desktop-time {
		justify-self: end;
	}

	@media (max-width: 760px) {
		text-align: right;
	}
`;

// The compact row's cells all clip to one line at the same size.
const compactCell = css`
	min-width: 0;
	overflow: hidden;
	font-size: 0.72rem;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

export const CompactSummary = styled.div`
	${compactCell}
	grid-column: 2;
	display: flex;
	align-items: baseline;
	gap: 7px;

	strong {
		flex: 0 0 auto;
		font-weight: 500;
	}

	small {
		min-width: 0;
		overflow: hidden;
		color: var(--muted);
		font-size: 0.68rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		grid-column: 2;
		grid-row: 1;

		small {
			display: none;
		}
	}
`;

export const CompactActor = styled.div`
	${compactCell}
	grid-column: 4;

	.wallet-address {
		min-width: 0;
		min-height: 0;
		padding: 0;
		font-size: 0.72rem;
	}

	@media (max-width: 640px) {
		display: none;
	}
`;

export const CompactTimeWrap = styled(Tooltip)`
	${compactCell}
	grid-column: 5;

	@media (max-width: 640px) {
		grid-column: 2 / 4;
		grid-row: 2;
	}
`;

export const CompactTime = styled.time`
	${compactCell}
	color: var(--muted);
	font-size: 0.68rem;

	@media (max-width: 640px) {
		width: 100%;
	}
`;

export const CompactTransaction = styled.a`
	grid-column: 6;
	width: 24px;
	height: 24px;
	display: grid;
	place-items: center;
	border-radius: 4px;
	color: var(--muted);

	&:hover {
		color: var(--ink);
		background: var(--surface);
	}

	@media (max-width: 640px) {
		grid-column: 4;
		grid-row: 1 / 3;
	}
`;
