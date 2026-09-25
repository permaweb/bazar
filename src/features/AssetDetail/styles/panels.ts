import styled from 'styled-components';

import { Button } from 'components/atoms/Button';

// The tab strip and tab panel bodies shared by the unique asset sections and the fungible token panels.

export const Tabs = styled.div`
	width: 100%;
	margin: 0 0 var(--space-4);
	/* The strip carries .home-market-tabs, whose layout used to come from the global sheet; Home owns that rule now. */
	display: flex;
	align-items: center;
	gap: 5px;
	flex-wrap: wrap;

	@media (max-width: 760px) {
		padding-bottom: 3px;
		flex-wrap: nowrap;
		overflow-x: auto;
		scrollbar-width: thin;
	}
`;

export const Tab = styled(Button)`
	min-height: 36px;
	padding-inline: 8px;
	gap: 5px;

	/* Matches the sizing .home-market-tab .ui-icon gave these icons while that rule was global. */
	.ui-icon {
		width: 13px;
		height: 13px;
	}

	&:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	&[aria-disabled='true'] {
		cursor: not-allowed;
		opacity: 0.5;
	}

	@media (max-width: 760px) {
		min-height: 40px;
		flex: none;
	}
`;

export const TabPanel = styled.section`
	min-height: 210px;
	padding: 0;
	border: 0;
	border-radius: 0;
	background: var(--transparent);

	&:focus {
		outline: none;
	}

	&:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	> .asset-description {
		margin-bottom: var(--space-4);
	}

	@media (max-width: 760px) {
		min-height: 180px;
	}
`;

export const MarketPanel = styled.div`
	display: grid;
	gap: 16px;
`;

export const Description = styled.p`
	max-width: 62ch;
	margin: 0 0 17px;
	color: var(--muted-subtle);
	font-size: var(--type-body);
	line-height: 1.6;
	white-space: pre-line;
`;

export const EmptyCopy = styled.p`
	color: var(--muted);
	margin: 0;
	font-size: var(--type-body);
`;

export const Facts = styled.div`
	margin: 0;
	display: grid;

	> div {
		padding: 11px 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		border-top: 1px solid var(--line);
		font-size: var(--type-body);
	}

	span {
		color: var(--muted);
	}

	@media (max-width: 480px) {
		> div {
			gap: 10px;
		}
	}
`;

export const BlockchainDetails = styled.dl`
	margin: 0;
	display: grid;

	> div {
		padding: 11px 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		border-top: 1px solid var(--line);
		font-size: var(--type-body);
	}

	dt {
		color: var(--muted);
	}

	dd {
		margin: 0;
		max-width: 65%;
		color: var(--ink);
		font-weight: 400;
		text-align: right;
	}

	a {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}

	@media (max-width: 480px) {
		> div {
			gap: 10px;
		}

		> div:first-child {
			padding-block: 0;
		}

		> div:first-child a {
			min-height: 44px;
		}
	}
`;

export const LicenseProperties = styled.dl`
	margin: 0;
	display: grid;

	> div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 18px;
		padding: 11px 0;
		border-bottom: 1px solid var(--line);
	}

	dt {
		color: var(--muted-subtle);
		font-size: var(--type-body);
	}

	dd {
		min-width: 0;
		margin: 0;
		overflow-wrap: anywhere;
		text-align: right;
		font: 400 var(--type-body) 'DM Sans', sans-serif;
	}

	a {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 4px;
		font-weight: 500;
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	@media (max-width: 480px) {
		> div {
			align-items: flex-start;
			flex-direction: column;
			gap: 5px;
		}

		dd {
			width: 100%;
			text-align: left;
		}
	}
`;

export const MarketActivityFooter = styled.div`
	min-height: 34px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;

	.market-note {
		margin-top: 8px;
	}

	.ui-button {
		flex: 0 0 auto;
	}

	@media (max-width: 640px) {
		align-items: flex-start;
		flex-direction: column;
	}
`;

export const TokenTags = styled.div`
	margin-top: var(--space-4);
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);

	span {
		padding: 4px 7px;
		border: 1px solid var(--line-dark);
		border-radius: 4px;
		color: var(--muted-subtle);
		background: var(--paper);
		font-size: var(--type-small);
		font-weight: 400;
		letter-spacing: 0.035em;
	}
`;
