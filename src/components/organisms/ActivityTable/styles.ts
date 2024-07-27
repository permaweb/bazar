import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	margin: 22.5px 0 0 0;
	scroll-margin-top: 150px;
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
	margin: 0 0 7.5px 0;
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
	}
	> :last-child {
		justify-content: flex-end;
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
		flex: 1;
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
	background: ${(props) => props.theme.colors.container.primary.active};
	> :not(:last-child) {
		border-bottom: 1px solid ${(props) => props.theme.colors.border.alt4};
	}
	> :first-child {
		border-top: 1px solid ${(props) => props.theme.colors.border.primary};
	}
`;

export const TableRow = styled.div`
	height: 50px;
	display: flex;
	align-items: center;
	padding: 0 15px;
	> * {
		flex: 1;
	}
	> :last-child {
		justify-content: flex-end;
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
		flex: 1;
		justify-content: center;
		p {
			text-align: center;
		}
	}
`;

export const TableRowValue = styled.div`
	display: flex;
	align-items: center;
	overflow: hidden;
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
		flex: 1;
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
	min-width: 165px;
`;

export const QuantityWrapper = styled(TableRowValue)`
	min-width: 75px;
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

export const EventWrapper = styled(TableRowValue)`
	flex: none;
	min-width: 0;
	width: 105px;
`;

export const Event = styled.div<{ type: 'Listed' | 'Sold' }>`
	display: flex;
	align-items: center;
	gap: 7.5px;
	overflow: hidden;
	padding: 0 7.5px;
	background: ${(props) =>
		props.type === 'Sold' ? props.theme.colors.indicator.active : props.theme.colors.indicator.neutral};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${STYLING.dimensions.radius.alt2};
	p {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.light1};
		line-height: 1;
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
	display: flex;
	align-items: center;
	background: ${(props) => (props.type === 'UCM' ? props.theme.colors.stats.alt5 : props.theme.colors.stats.primary)};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
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
	padding: 20px 0;
	margin: 22.5px 0 0 0;
`;

export const SelectWrapper = styled.div``;
