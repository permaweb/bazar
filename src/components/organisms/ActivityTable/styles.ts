import styled, { DefaultTheme } from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	margin: 22.5px 0 0 0;
	scroll-margin-top: 100px;
`;

export const Header = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: 20px;
	margin: 0 0 10px 0;
	h4 {
		font-size: ${(props) => props.theme.typography.size.xLg};
	}
`;

export const HeaderActions = styled.div`
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 20px;

	.filter-listings {
		svg {
			height: 17.5px;
			width: 17.5px;
			color: ${(props) => props.theme.colors.font.light1};
			margin: 3.5px 0 0 10px;
		}
	}
`;

export const HeaderPaginator = styled.div`
	display: flex;
	align-items: center;
	gap: 15px;

	.table-previous {
		transform: rotate(180deg);
		svg {
			margin: -2.5px 0 0 0;
		}
	}

	.table-next {
		svg {
			margin: 0 0 0 1.5px;
		}
	}
`;

export const SubHeader = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 15px;
	margin: 0 0 10px 0;
	p {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.alt1};
	}
`;

export const EmptyWrapper = styled.div`
	padding: 20px;
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
	}
`;

export const TableWrapper = styled.div`
	display: flex;
	flex-direction: column;
	overflow-x: auto;
	background: ${(props) => props.theme.colors.container.primary.active};
	border: 1px solid ${(props) => props.theme.colors.border.alt4};
	border-radius: ${STYLING.dimensions.radius.primary};
`;

export const TableHeader = styled.div`
	height: 50px;
	min-width: 100%;
	width: fit-content;
	display: flex;
	align-items: center;
	padding: 0 15px;
	> * {
		flex: 1;
		margin: 0 10px;
	}
	> :first-child {
		justify-content: flex-start;
		margin: 0 10px 0 0;
		p {
			text-align: left;
		}
	}
	> :last-child {
		justify-content: flex-end;
		margin: 0 0 0 10px;
		p {
			text-align: right;
		}
	}
	.end-value {
		flex: 1;
		justify-content: flex-end;
		p {
			text-align: right;
		}
	}
	.center-value {
		flex: 0;
		justify-content: center;
		p {
			text-align: center;
		}
	}
`;

export const TableHeaderValue = styled.div`
	min-width: 130px;
	p {
		font-size: ${(props) => props.theme.typography.size.base} !important;
		font-family: ${(props) => props.theme.typography.family.primary} !important;
		font-weight: ${(props) => props.theme.typography.weight.bold} !important;
		color: ${(props) => props.theme.colors.font.primary} !important;
	}
`;

export const TableBody = styled.div`
	min-width: 100%;
	width: fit-content;
	display: flex;
	flex-direction: column;
	> :not(:last-child) {
		border-bottom: 1px solid ${(props) => props.theme.colors.border.alt4};
	}
	> :first-child {
		border-top: 1px solid ${(props) => props.theme.colors.border.alt4};
	}
`;

export const TableRow = styled.div`
	height: 50px;
	display: flex;
	align-items: center;
	padding: 0 15px;
	background: ${(props) => props.theme.colors.container.primary.background};
	> * {
		flex: 1;
		margin: 0 10px;
	}
	> :first-child {
		justify-content: flex-start;
		margin: 0 10px 0 0;
		p {
			text-align: left;
		}
	}
	> :last-child {
		justify-content: flex-end;
		margin: 0 0 0 10px;
		p {
			text-align: right;
		}
	}
	.end-value {
		flex: 1;
		justify-content: flex-end;
		p {
			text-align: right;
		}
	}
	.center-value {
		flex: 0;
		justify-content: center;
		p {
			text-align: center;
		}
	}
	&:hover {
		background: ${(props) => props.theme.colors.container.primary.active};
	}
`;

export const TableRowLoader = styled(TableRow)`
	background: ${(props) => props.theme.colors.container.primary.active};
`;

export const TableRowValue = styled.div`
	display: flex;
	align-items: center;
	min-width: 130px;
	p {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
		max-width: 90%;
		white-space: nowrap;
		text-overflow: ellipsis;
		overflow: hidden;
	}
	.end-value {
		flex: 1;
		justify-content: flex-end;
		p {
			text-align: right;
		}
	}
	.center-value {
		flex: 0;
		justify-content: center;
		p {
			text-align: center;
		}
	}
`;

export const OwnerWrapper = styled(TableRowValue)`
	min-width: 175px;
`;

export const SenderWrapper = styled(OwnerWrapper)`
	min-width: 185px;
`;

export const ReceiverWrapper = styled(OwnerWrapper)`
	min-width: 185px;
`;

export const QuantityWrapper = styled(TableRowValue)`
	flex: 0;
	p {
		font-family: ${(props) => props.theme.typography.family.alt1};
	}
	.header {
		font-family: ${(props) => props.theme.typography.family.primary} !important;
	}
`;

export const PriceWrapper = styled(TableRowValue)`
	min-width: 85px;
`;

export const AssetWrapper = styled(TableRowValue)`
	flex: 0;
	min-width: 200px;
	width: 200px;
	gap: 10px;
	margin: 0 20px 0 0;
	overflow: hidden;
	a {
		width: fit-content;
		max-width: calc(100% - 42.5px);
	}
	p {
		max-width: 100%;
		white-space: nowrap;
		text-overflow: ellipsis;
		display: block;
		overflow: hidden;
		&:hover {
			color: ${(props) => props.theme.colors.font.alt1};
		}
	}
`;

export const AssetDataWrapper = styled.div`
	min-height: 32.5px;
	min-width: 32.5px;
	height: 32.5px;
	width: 32.5px;
	position: relative;
	overflow: hidden;
	transition: all 100ms;
	a {
		width: 100%;
	}
	div {
		border-radius: ${STYLING.dimensions.radius.alt2} !important;
		img {
			border-radius: 0 !important;
		}
	}
	&:hover {
		opacity: 0.75;
	}
`;

export const EventWrapper = styled(TableRowValue)`
	flex: none;
	min-width: 0;
	width: 140px;
	margin: 0 20px;
`;

function getEventColor(theme: DefaultTheme, type: 'Listing' | 'Sale' | 'Purchase' | 'Unlisted') {
	switch (type) {
		case 'Listing':
			return theme.colors.stats.alt4;
		case 'Sale':
			return theme.colors.indicator.active;
		case 'Purchase':
			return theme.colors.stats.alt5;
		case 'Unlisted':
			return theme.colors.warning.primary;
	}
}

export const Event = styled.div<{ type: 'Listing' | 'Sale' | 'Purchase' | 'Unlisted' }>`
	width: 110px;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 7.5px;
	overflow: hidden;
	padding: 1.5px 7.5px;
	background: ${(props) => getEventColor(props.theme, props.type)};
	border: 1px solid ${(props) => props.theme.colors.border.alt4};
	border-radius: ${STYLING.dimensions.radius.alt2};
	p {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.light1};
		line-height: 1.5;
		max-width: 90%;
		white-space: nowrap;
		text-overflow: ellipsis;
		overflow: hidden;
	}

	svg {
		width: 15px;
		fill: ${(props) => props.theme.colors.font.light1};
		color: ${(props) => props.theme.colors.font.light1};
		margin: 6.5px 0 0 0;
	}
`;

export const Entity = styled.div<{ type: 'UCM' | 'User' }>`
	width: 110px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: ${(props) => (props.type === 'UCM' ? props.theme.colors.stats.primary : props.theme.colors.stats.alt5)};
	border: 1px solid ${(props) => props.theme.colors.border.alt4};
	border-radius: ${STYLING.dimensions.radius.alt2};
	padding: 1.5px 7.5px;
	p {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.light1};
		max-width: 100%;
	}
`;

export const Footer = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin: 20px 0 0 0;
`;

export const LoadingWrapper = styled.div`
	display: flex;
	flex-direction: column;
	gap: 12.5px;
`;

export const SelectWrapper = styled.div``;

export const DateValueWrapper = styled(TableRowValue)`
	gap: 10px;
	min-width: 150px;
`;

export const DateValueTooltip = styled.div`
	position: relative;
	.date-tooltip {
		display: none;
		position: absolute;
		top: -22.5px;
		right: 10px;
		padding: 2.5px 10px;
		border-radius: ${STYLING.dimensions.radius.alt2};
		p {
			max-width: 100%;
			font-size: ${(props) => props.theme.typography.size.xxSmall};
			font-family: ${(props) => props.theme.typography.family.primary};
			font-weight: ${(props) => props.theme.typography.weight.bold};
		}
	}
	svg {
		width: 15px;
		fill: ${(props) => props.theme.colors.font.alt1};
		color: ${(props) => props.theme.colors.font.alt1};
		margin: 6.5px 0 0 0;
		position: relative;
		transition: all 100ms;
	}

	&:hover {
		svg {
			fill: ${(props) => props.theme.colors.font.primary};
			color: ${(props) => props.theme.colors.font.primary};
		}
		.date-tooltip {
			display: block;
		}
	}
`;
