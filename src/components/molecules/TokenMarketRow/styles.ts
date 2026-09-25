import { Link } from 'react-router-dom';
import styled from 'styled-components';

export const Row = styled(Link)`
	min-width: 0;
	min-height: 76px;
	padding: 12px 14px;
	display: grid;
	grid-template-columns: 48px minmax(150px, 1.15fr) minmax(130px, 1fr) minmax(105px, auto) minmax(120px, 22ch) auto 18px;
	align-items: center;
	gap: 14px;
	border-bottom: 1px solid var(--line);
	color: var(--ink);
	background: var(--paper);
	transition: background 100ms ease;

	&:hover {
		background: var(--button-accent);
	}

	.token-market-arrow {
		grid-column: 7;
		color: var(--muted);
	}

	/* A compact list trades the context and secondary metric columns for a tighter row. */
	.token-market-list.compact & {
		min-height: 66px;
		padding: 8px 10px;
		grid-template-columns: 44px minmax(130px, 1fr) minmax(110px, 0.8fr) 0 minmax(0, 0) 0 18px;
	}

	@media (max-width: 760px) {
		grid-template-columns: 44px minmax(0, 1fr) minmax(96px, auto) 18px;
		gap: 10px;
		padding: 10px 6px;

		.token-market-arrow {
			grid-column: 4;
		}

		.token-market-list.compact & {
			grid-template-columns: 44px minmax(0, 1fr) minmax(96px, auto) 18px;
			gap: 10px;
			padding: 10px 6px;
		}
	}
`;

export const Logo = styled.span`
	grid-column: 1;
	width: 48px;
	height: 48px;
	display: grid;
	place-items: center;
	overflow: hidden;
	border: 1px solid var(--line);
	border-radius: 50%;
	background: var(--surface);

	.token-avatar {
		--token-avatar-size: 100%;
		border: 0;
	}

	.token-market-list.compact & {
		width: 44px;
		height: 44px;
	}

	@media (max-width: 760px) {
		width: 44px;
		height: 44px;

		.token-market-list.compact & {
			width: 44px;
			height: 44px;
		}
	}
`;

export const Identity = styled.span`
	grid-column: 2;
	min-width: 0;
	display: grid;
	gap: 3px;

	strong,
	small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		font-size: var(--type-body);
		font-weight: 400;
	}

	small {
		color: var(--muted);
		font-size: var(--type-small);
		font-weight: 400;
	}

	@media (max-width: 760px) {
		grid-column: 2;
	}
`;

export const Context = styled.span`
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	color: var(--muted);
	font-size: var(--type-small);
	font-weight: 400;
	grid-column: 3;
	text-align: left;

	@media (max-width: 760px) {
		display: none;
	}
`;

export const Metric = styled.span`
	grid-column: 5;
	min-width: 0;
	display: grid;
	justify-items: end;
	gap: 3px;
	font-variant-numeric: tabular-nums;

	small {
		color: var(--muted);
		font-size: var(--type-small);
		font-weight: 400;
	}

	strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 22ch;
		font-size: var(--type-body);
		font-weight: 400;
	}

	&.secondary {
		grid-column: 4;
	}

	&.positive strong {
		color: var(--positive-text);
	}

	&.negative strong {
		color: var(--negative);
	}

	&.muted strong {
		color: var(--muted);
	}

	@media (max-width: 760px) {
		grid-column: 3;

		&.secondary {
			display: none;
		}
	}
`;

export const Badge = styled.span`
	grid-column: 6;
	padding: 4px 7px;
	border: 1px solid var(--line-dark);
	color: var(--muted);
	font-size: var(--type-small);
	white-space: nowrap;

	@media (max-width: 760px) {
		display: none;
	}
`;
