import styled from 'styled-components';

export const Receipts = styled.div`
	margin-top: 9px;
	display: grid;
	gap: 8px;

	a {
		grid-row: 1;
		grid-column: 1;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		color: var(--positive-text);
		font-size: var(--type-small);
		text-decoration: none;
	}

	a:hover span {
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	svg {
		width: 13px;
		height: 13px;
	}
`;

export const Receipt = styled.div`
	min-width: 0;
	display: grid;
	grid-template-columns: auto minmax(0, 1fr);
	align-items: center;
	gap: 4px 8px;

	.tx-address {
		min-width: 0;
	}

	.tx-address-link {
		min-width: 0;
		overflow-wrap: anywhere;
	}
`;
