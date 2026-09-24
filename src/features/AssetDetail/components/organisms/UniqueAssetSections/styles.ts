import styled from 'styled-components';

import { TabPanel } from '../../../styles/panels';

export { MarketNote } from '../../../styles/asset-page';
export { Empty, EmptyCell, Head, Row, Status, Table } from '../../../styles/orderbook';
export {
	BlockchainDetails,
	Description,
	EmptyCopy,
	Facts,
	LicenseProperties,
	MarketActivityFooter,
	TabPanel,
	TokenTags,
} from '../../../styles/panels';

// The orders tab is both a tab panel and the stacked `.atomic-market-panel` grid.
export const MarketTabPanel = styled(TabPanel)`
	display: grid;
	gap: 16px;
`;

export const ActivityTabPanel = styled(TabPanel)`
	display: grid;
	gap: 12px;

	.activity-list {
		gap: 7px;
	}

	.activity-row {
		grid-template-columns: 36px minmax(0, 1fr);
		padding: 12px 13px;
	}

	.activity-main .activity-amount {
		max-width: 32ch;
		font-size: var(--type-body);
		line-height: 1.35;
		letter-spacing: 0;
	}

	.activity-meta {
		grid-column: 1 / -1;
		grid-template-columns: minmax(0, 1fr) auto;
		padding-top: 7px;
		border-top: 1px solid var(--line);
		gap: 10px;
	}

	.activity-actor {
		display: grid;
		align-items: start;
		gap: 3px;
		text-align: left;
	}

	.activity-mobile-time,
	.activity-time-only {
		display: inline;
	}

	.activity-desktop-time,
	.activity-transaction-long {
		display: none;
	}

	.activity-transaction-short {
		display: inline;
	}
`;

export const HistoryCurrent = styled.div`
	padding: 13px 14px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 18px;
	border: 1px solid var(--line);
	border-radius: 7px;
	background: var(--panel);
	font-size: var(--type-body);
`;

export const LicenseEmpty = styled.div`
	min-height: 120px;
	padding: 21px;
	display: flex;
	align-items: center;
	gap: 15px;
	border: 1px dashed var(--line-dark);
	border-radius: 10px;
	background: var(--panel);

	> span {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border: 1px solid var(--line-dark);
		border-radius: 50%;
	}

	strong {
		font-family: 'DM Sans', sans-serif;
	}

	p {
		margin: 5px 0 0;
		color: var(--muted-subtle);
		font-size: var(--type-body);
		line-height: 1.45;
	}
`;

export const MoreGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: var(--asset-grid-gap);

	a {
		min-width: 0;
	}

	img,
	a > span,
	.artwork-fallback {
		width: 100%;
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		object-fit: cover;
		border: 1px solid var(--line);
		border-radius: 7px;
		background: var(--panel);
		font-size: var(--type-display);
	}

	.artwork-fallback {
		font-size: var(--type-small);
	}

	strong {
		margin-top: 6px;
		display: block;
		overflow: hidden;
		font-size: var(--type-small);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 480px) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
`;
