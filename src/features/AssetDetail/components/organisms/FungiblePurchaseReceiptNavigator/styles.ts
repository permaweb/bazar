import styled from 'styled-components';

import { SettlementReceipt, SettlementReceiptLinks } from 'components/molecules/OperationOutcomeAnnouncement';

export const Receipts = styled.div`
	display: grid;
	gap: 10px;
	margin: 18px auto;

	.settlement-receipt {
		margin: 0 auto;
	}

	.result & {
		width: 100%;
		margin: 0;
	}
`;

export const Navigation = styled.div`
	width: min(520px, 100%);
	margin: 0 auto;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;

	> div {
		min-width: 0;
		flex: 1;
		display: grid;
		gap: 7px;
	}

	> div > strong {
		font-size: var(--type-body);
		font-weight: 500;
	}

	.market-select {
		min-width: 0;
		text-align: left;
	}

	.market-select-menu {
		width: 100%;
		max-height: min(320px, 45vh);
		overflow-y: auto;
	}
`;

export const Count = styled.span`
	flex: 0 0 auto;
	min-height: 28px;
	padding: 5px 9px;
	display: inline-flex;
	align-items: center;
	border: 1px solid var(--line);
	border-radius: 999px;
	background: var(--surface-subtle);
	color: var(--muted);
	font-size: var(--type-small);
`;

export const Paging = styled.div`
	width: min(440px, 100%);
	margin: 0 auto;
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;

	button {
		min-height: 44px;
	}
`;

// Composes the shared receipt block and keeps its own section element.
export const Receipt = styled(SettlementReceipt).attrs({ as: 'section' })`
	width: min(520px, 100%);
	padding: 0;
	gap: 0;
	overflow: hidden;
	background: var(--paper);

	.settlement-receipt-amount {
		padding: 14px 16px;
		align-items: center;
		border-bottom: 1px solid var(--line);
		color: var(--ink);
	}

	.settlement-receipt-amount span {
		color: var(--muted);
		font-size: var(--type-small);
	}

	.settlement-receipt-amount strong {
		font-size: var(--type-body);
		font-weight: 500;
	}

	@media (max-width: 480px) {
		padding: 0;
	}
`;

export const Facts = styled.dl`
	margin: 0;
	padding: 5px 16px;
	display: grid;

	> div {
		min-width: 0;
		padding: 8px 0;
		display: grid;
		grid-template-columns: minmax(110px, 0.45fr) minmax(0, 1fr);
		align-items: center;
		gap: 16px;
	}

	> div + div {
		border-top: 1px solid var(--line);
	}

	dt,
	dd {
		min-width: 0;
		margin: 0;
		font-size: var(--type-body);
	}

	dt {
		color: var(--muted);
	}

	dd {
		justify-self: end;
		overflow-wrap: anywhere;
		color: var(--ink);
		text-align: right;
	}

	.wallet-address {
		min-height: 0;
		padding: 0;
		text-decoration: none;
	}

	@media (max-width: 480px) {
		> div {
			grid-template-columns: minmax(0, 1fr);
			gap: 3px;
		}

		dd {
			justify-self: start;
			text-align: left;
		}
	}
`;

export const ProofLinks = styled(SettlementReceiptLinks)`
	margin: 0;
	padding: 12px 16px;
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
	background: var(--surface-subtle);

	a {
		min-width: 0;
		min-height: 42px;
		margin: 0;
		padding: 8px 10px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-rows: auto auto;
		align-items: center;
		gap: 1px 8px;
		border: 1px solid var(--line);
		border-radius: 7px;
		background: var(--paper);
		color: var(--ink);
		text-decoration: none;
	}

	a:hover {
		border-color: var(--line-dark);
		background: var(--surface-hover);
	}

	a > span,
	a > strong {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	a > span {
		color: var(--muted);
		font-size: var(--type-small);
	}

	a > strong {
		font-size: var(--type-small);
		font-weight: 400;
	}

	a > svg {
		grid-column: 2;
		grid-row: 1 / span 2;
	}

	@media (max-width: 480px) {
		grid-template-columns: minmax(0, 1fr);

		/* Narrow screens raise every receipt link to a 44px touch target; the grid layout above stays. */
		a {
			min-height: 44px;
			display: grid;
			align-items: center;
		}
	}
`;
