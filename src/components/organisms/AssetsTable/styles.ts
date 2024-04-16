import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
	scroll-margin-top: 20px;
`;

export const Header = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin: 0 0 20px 0;
`;

export const HeaderActions = styled.div`
	display: flex;
	align-items: center;
	gap: 15px;

	.filter-listings {
		margin: 0 10px 0 0;
		svg {
			margin: 0 0 0 7.5px;
			padding: 3.5px 0 0 0;
		}
	}
`;

export const HeaderPaginator = styled.div`
	display: flex;
	align-items: center;
	gap: 15px;

	.table-previous {
		svg {
			margin: 0 1.5px 0 0;
		}
	}

	.table-next {
		svg {
			transform: rotate(180deg);
			margin: 0 0 0 1.5px;
		}
	}
`;

export const AssetsGridWrapper = styled.div`
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 30px;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		grid-template-columns: repeat(2, 1fr);
	}
	@media (max-width: ${STYLING.cutoffs.tabletSecondary}) {
		grid-template-columns: 1fr;
	}
`;

export const AssetGridElement = styled.div`
	position: relative;
	a {
		display: block;
		width: 100%;
	}
`;

export const AssetGridDataWrapper = styled.div<{ disabled: boolean }>`
	height: 400px;
	width: 100%;
	position: relative;

	${({ disabled, theme }) =>
		!disabled &&
		`
		::after {
			content: '';
			position: absolute;
			height: 100%;
			width: 100%;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background-color: ${theme.colors.overlay.alt1};
			border-radius: ${STYLING.dimensions.radius.primary};
			opacity: 0;
			transition: all 75ms;
		}
		&:hover::after, &:focus::after {
			opacity: 1;
		}
	`}

	&:hover {
		cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
	}
`;

export const AssetGridInfoWrapper = styled.div`
	width: 100%;
	padding: 20px 0 15px 0;
`;

export const AssetsListWrapper = styled.div`
	display: flex;
	justify-content: space-between;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		flex-direction: column;
	}
`;

export const AssetsListSection = styled.div`
	width: 49.15%;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		width: 100%;
	}
`;

export const AssetsListSectionHeader = styled.div`
	padding: 0 20px 7.5px 20px;
	margin: 0 0 20px 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
	span {
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: ${(props) => props.theme.typography.size.small};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const AssetsListSectionElements = styled.div`
	> * {
		&:not(:last-child) {
			margin: 0 0 20px 0;
		}
		&:last-child {
			margin: 0;
		}
	}
`;

export const AssetsListSectionElement = styled.button<{ disabled: boolean }>`
	height: 120px;
	width: 100%;
	overflow: hidden;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 20px;
	&:hover {
		cursor: pointer;
		background: ${(props) => props.theme.colors.container.primary.active};
	}
	&:disabled {
		cursor: default;
	}
`;

export const FlexElement = styled.div`
	display: flex;
	align-items: center;
`;

export const Index = styled.div`
	margin: 0 20px 0 0;
	p {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const Title = styled.div`
	p {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.xBold};
	}
`;

export const Description = styled.div`
	margin: 5px 0;
	p {
		max-width: 75%;
		overflow-x: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.alt1};
		line-height: 1.65;
	}
`;

export const Thumbnail = styled.div`
	height: 85px;
	width: 85px;
	margin: 0 20px 0 0;
	position: relative;
`;

export const Listings = styled.div`
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
	}
`;

export const NoListings = styled.span`
	color: ${(props) => props.theme.colors.font.alt1} !important;
`;

export const Footer = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin: 20px 0 0 0;
`;

export const SelectWrapper = styled.div`
	svg {
		transform: rotate(270deg);
		margin: 5px 0 0 50.5px;
	}
`;
