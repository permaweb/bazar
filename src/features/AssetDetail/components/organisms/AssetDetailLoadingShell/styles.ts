import styled, { css } from 'styled-components';

import { SegmentedTabsBox } from 'components/atoms/SegmentedTabs';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { StateVerificationLine } from 'components/molecules/StateVerification';

import { AtomicPage, FungiblePage } from '../../../styles/asset-page';
import { CommerceCard, MarketStats } from '../../../styles/commerce';
import { FungibleTable } from '../../../styles/orderbook';
import { MarketPanel, Tabs } from '../../../styles/panels';
import { Chart } from '../../../styles/price-chart';

export {
	CommerceColumn,
	Details,
	HeroMedia,
	Identity,
	Kicker,
	Layout,
	OwnerLine,
	TokenBalance,
	TokenHeader,
	TokenIdentity,
	TokenMeta,
	TokenName,
	TokenTitle,
	VisualColumn,
} from '../../../styles/asset-page';
export { CollectionLink } from '../../../styles/asset-page';
export { MarketStats } from '../../../styles/commerce';
export { TradeSwitcher } from '../../../styles/commerce';
export { Head, Row } from '../../../styles/orderbook';
export { TokenTags } from '../../../styles/panels';
export { Heading } from '../../../styles/price-chart';

const placeholder = css`
	display: block;
	border-radius: 4px;
	background: var(--surface);
`;

const tokenAvatar = css`
	--token-avatar-size: 68px;
	width: 68px;
	height: 68px;
	border-radius: 50%;
	background: var(--transparent);

	@media (max-width: 760px) {
		--token-avatar-size: 58px;
		width: 58px;
		height: 58px;
		grid-row: 1 / span 2;
	}
`;

export const Placeholder = styled.span`
	${placeholder}
`;

export const PlaceholderTitle = styled.span`
	${placeholder}
	width: min(420px, 72%);
	height: clamp(2.1rem, 3vw, 3.3rem);
	margin: 15px 0 12px;
`;

export const TokenAvatarFrame = styled(TokenAvatar)`
	${tokenAvatar}
`;

export const AvatarPlaceholder = styled.span`
	${placeholder}
	${tokenAvatar}
`;

export const FungibleShell = styled(FungiblePage)`
	.asset-owner-line {
		min-height: 20px;
	}

	.asset-commerce-card-loading {
		min-height: 270px;
	}
`;

export const AtomicShell = styled(AtomicPage)`
	.asset-owner-line {
		min-height: 20px;
	}

	.asset-commerce-card-loading {
		min-height: 214px;
		margin-top: 40px;
	}
`;

// The shared verification line is a paragraph; the loading shell keeps its own div so the markup is unchanged.
export const LoadingVerification = styled(StateVerificationLine).attrs({ as: 'div' })`
	> span {
		width: 8px;
		height: 8px;
		flex: 0 0 auto;
		border: 1px solid var(--line-dark);
		border-top-color: var(--positive);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
`;

export const CommerceCardLoading = styled(CommerceCard)`
	min-height: 205px;
	display: grid;
	align-content: start;
	gap: 18px;
`;

export const StatGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 14px;

	.layout-placeholder {
		height: 32px;
	}
`;

export const SummaryPlaceholder = styled(Placeholder)`
	width: 42%;
	height: 40px;
	margin-top: 2px;
`;

export const ActionPlaceholder = styled(Placeholder)`
	width: 100%;
	height: 45px;
`;

export const BalancePlaceholder = styled(Placeholder)`
	width: 112px;
	height: 18px;
`;

export const LoadingMarketStats = styled(MarketStats)`
	.layout-placeholder {
		width: min(100%, 112px);
		height: 18px;
	}

	i {
		display: block;
	}
`;

export const LoadingTradeTabs = styled(SegmentedTabsBox)`
	span {
		min-width: 0;
		min-height: 34px;
		padding: 0 14px;
		flex: 1 1 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		color: var(--muted-subtle);
		font-size: var(--type-body);
	}

	span:first-child {
		background: var(--paper);
		color: var(--ink);
		box-shadow: 0 1px 3px var(--shadow-tiny);
	}
`;

export const LoadingTradeComposer = styled.div`
	display: grid;

	> div {
		min-height: 112px;
		padding: 15px 16px;
		display: grid;
		align-content: space-between;
		gap: 10px;
		border: 1px solid var(--line-dark);
	}

	> div:first-child {
		border-radius: 10px 10px 0 0;
	}

	> div:last-child {
		border-top: 0;
		border-radius: 0 0 10px 10px;
		background: var(--panel);
	}

	> div > span {
		color: var(--muted);
		font-size: var(--type-small);
	}

	i {
		display: block;
		width: 54%;
		height: 28px;
	}

	small {
		display: block;
		width: 38%;
		height: 10px;
	}
`;

export const LoadingMarketPanel = styled(MarketPanel)`
	gap: 16px;
`;

export const LoadingChart = styled(Chart)`
	min-height: 300px;
`;

export const LoadingChartQuote = styled.div`
	min-width: 0;
	display: grid;
	gap: 8px;
	color: var(--muted);
	font-size: var(--type-small);

	.layout-placeholder {
		width: 170px;
		height: 26px;
	}
`;

export const LoadingChartRanges = styled.div`
	display: flex;
	gap: 5px;

	.layout-placeholder {
		width: 38px;
		height: 30px;
		border-radius: 7px;
	}
`;

export const LoadingChartPlot = styled.div`
	height: 180px;
	margin: 0 18px 18px;
	display: grid;
	align-content: space-around;
	border-top: 1px solid var(--line);

	span {
		display: block;
		border-top: 1px solid var(--line);
	}
`;

export const LoadingOrderbook = styled(FungibleTable)`
	.orderbook-row .layout-placeholder {
		width: 82%;
		height: 12px;
	}
`;

export const LoadingActivity = styled.section`
	margin-top: 20px;
	padding-top: 14px;
	border-top: 1px solid var(--line);

	h2 {
		margin: 0 0 10px;
		font-size: var(--type-body);
		font-weight: 500;
	}

	> div {
		min-height: 34px;
		display: grid;
		grid-template-columns: minmax(120px, 1fr) minmax(90px, 0.7fr) minmax(72px, 0.45fr);
		align-items: center;
		gap: 14px;
		border-top: 1px solid var(--line);
	}

	.layout-placeholder {
		width: 84%;
		height: 10px;
	}
`;

export const ArtworkPlaceholder = styled(Placeholder)`
	width: 34%;
	aspect-ratio: 1;
	border-radius: 50%;
	background: var(--surface);
`;

export const LoadingTabs = styled(Tabs)`
	span {
		padding: 13px 0;
		color: var(--muted);
		font-size: var(--type-body);
		font-weight: 400;
	}

	span:first-child {
		color: var(--ink);
		box-shadow: inset 0 -2px 0 var(--ink);
	}
`;

export const LoadingPanel = styled.div`
	min-height: 220px;
	padding: 22px 18px;
	display: grid;
	align-content: start;
	gap: 16px;
	border: 1px solid var(--line-dark);
	border-radius: 9px;
	background: var(--paper);

	.layout-placeholder {
		width: 100%;
		height: 13px;
	}

	.layout-placeholder:nth-child(2) {
		width: 86%;
	}

	.layout-placeholder:nth-child(3) {
		width: 64%;
	}
`;
