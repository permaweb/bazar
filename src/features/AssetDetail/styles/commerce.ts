import styled from 'styled-components';

// The commerce card shared by the unique asset card, the fungible trade card and the loading shell.

export const CommerceCard = styled.div`
	margin-top: var(--space-5);
	padding: var(--space-4);
	border: 1px solid var(--line-dark);
	border-radius: 10px;
	background: var(--paper);

	@media (max-width: 480px) {
		margin-top: 18px;
		padding: 14px;
	}
`;

export const MarketStats = styled.div`
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: var(--space-3);

	> div {
		min-width: 0;
		display: grid;
		gap: 4px;
	}

	span {
		color: var(--muted);
		font-size: var(--type-small);
		font-weight: 400;
	}

	strong {
		overflow: hidden;
		color: var(--ink);
		font-size: var(--type-body);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 760px) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		row-gap: 16px;
	}
`;

export const BuySummary = styled.div`
	margin-top: var(--space-4);
	padding-top: var(--space-4);
	display: grid;
	gap: 5px;
	border-top: 1px solid var(--line);

	span {
		color: var(--muted);
		font-size: var(--type-small);
		font-weight: 400;
	}

	strong {
		font-size: var(--type-display);
		line-height: 1.05;
		letter-spacing: -0.025em;
	}

	small {
		color: var(--muted);
		font-size: var(--type-small);
		line-height: 1.35;
	}
`;

export const BuySummaryEmpty = styled(BuySummary)`
	gap: 9px;

	h1 {
		margin: 0;
		font-size: var(--type-page-title);
		font-weight: 400;
		line-height: 1.12;
		letter-spacing: 0.005em;
	}

	small {
		font-size: var(--type-body);
		line-height: 1.5;
	}
`;

export const CommerceActions = styled.div`
	margin-top: var(--space-4);
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: var(--space-2);

	button {
		min-height: 45px;
		border-radius: 7px;
	}

	.ui-button--primary {
		width: 100%;
	}

	.asset-buy-now {
		color: var(--paper);
		border-color: var(--ink);
		background: var(--ink);
	}

	.asset-buy-now:hover:not(:disabled):not([aria-disabled='true']) {
		color: var(--paper);
		border-color: var(--accent-dark);
		background: var(--accent-dark);
	}

	.asset-buy-now:disabled,
	.asset-buy-now[aria-disabled='true'] {
		color: var(--muted-subtle);
		border-color: var(--line);
		background: var(--surface);
	}

	@media (max-width: 760px) {
		grid-template-columns: 1fr;
	}
`;

export const TradeSwitcher = styled.div`
	.fungible-trade-tabs {
		width: 100%;
		margin: 18px 0 9px;
	}

	.fungible-trade-tabs button {
		min-width: 0;
		flex: 1 1 0;
	}
`;

export const TradePanel = styled.div`
	min-width: 0;
`;
