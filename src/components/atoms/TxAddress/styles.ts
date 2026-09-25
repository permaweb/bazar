import styled from 'styled-components';

export const Address = styled.span`
	min-width: 0;
	width: fit-content;
	padding: 4px 5px 4px 7px;
	display: inline-flex;
	align-items: center;
	gap: 5px;
	border-radius: 5px;
	color: var(--ink);
	background: var(--transparent);
	line-height: 1.2;
	transition: background 100ms ease;

	&:hover {
		background: var(--surface-hover);
	}

	> .ui-tooltip {
		min-width: 0;
	}

	&.is-wrapped .tx-address-link {
		overflow: visible;
		overflow-wrap: anywhere;
		text-overflow: clip;
		white-space: normal;
	}

	.tx-address-copy {
		width: 24px;
		min-width: 24px;
		min-height: 24px;
		padding: 0;
		display: inline-grid;
		place-items: center;
		align-self: center;
		border: 0;
		border-radius: 4px;
		background: var(--transparent);
		cursor: pointer;
	}

	.tx-address-copy:hover:not(:disabled) {
		border-color: var(--transparent);
		background: var(--button-accent-hover);
	}
`;

export const Link = styled.a`
	min-width: 0;
	overflow: hidden;
	cursor: pointer;
	text-overflow: ellipsis;
	white-space: nowrap;
`;
