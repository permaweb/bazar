import styled from 'styled-components';

import { fadeIn2, open } from 'helpers/animations';
import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	height: 100%;
	display: flex;
	position: relative;
	animation: ${open} ${fadeIn2};
`;

export const PWrapper = styled.div`
	display: flex;
	align-items: center;
`;

export const LAction = styled.button`
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		display: block;
		margin: 0 15px 0 0;
	}
	&:hover {
		span {
			color: ${(props) => props.theme.colors.font.alt1};
		}
	}
	@media (max-width: ${STYLING.cutoffs.initial}) {
		display: none;
	}
`;

export const FlexAction = styled.div`
	display: flex;
	align-items: center;
	svg {
		height: 25px;
		width: 20px;
		margin: 0 -2.5px 0 11.5px;
	}
`;

export const Dropdown = styled.ul`
	max-height: 75vh;
	width: 325px;
	max-width: 90vw;
	padding: 15px 0 10px 0;
	position: absolute;
	top: 45px;
	right: 0px;
	border-radius: ${STYLING.dimensions.radius.primary};
	box-shadow: none !important;
`;

export const DHeaderWrapper = styled.div`
	width: 100%;
	padding: 0 0 15px 0;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
`;

export const DHeaderFlex = styled.div`
	width: 100%;
	display: flex;
	align-items: center;
	padding: 0 15px;
`;

export const DHeader = styled.div`
	margin: 0 0 0 10px;
	p {
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		&:hover {
			color: ${(props) => props.theme.colors.font.alt1};
		}
	}
	span {
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: ${(props) => props.theme.typography.size.xxSmall};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		&:hover {
			color: ${(props) => props.theme.colors.font.primary};
		}
	}
	p,
	span {
		transition: all 100ms;
		&:hover {
			cursor: pointer;
		}
	}
`;

export const DBodyWrapper = styled.ul`
	width: 100%;
	padding: 10px 0;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
	li {
		text-align: center;
		height: 40px;
		display: flex;
		align-items: center;
		cursor: pointer;
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		border: 1px solid transparent;
		padding: 0 15px;
		transition: all 75ms;
		&:hover {
			color: ${(props) => props.theme.colors.button.primary.active.color};
			background: ${(props) => props.theme.colors.button.primary.active.background};
		}
	}
`;

export const DBodyHeader = styled.div`
	margin: 0 0 2.5px 0;
	padding: 0 15px;
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const BalanceLine = styled.div`
	height: 40px;
	padding: 0 15px;
	display: flex;
	align-items: center;
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
	}
	svg {
		height: 17.5px;
		width: 17.5px;
		margin: 5.5px 0 0 9.5px;
		fill: ${(props) => props.theme.colors.icon.alt2.fill};
	}
	img {
		margin: 5.5px 0 0 2.5px;
	}
	.pixl-icon {
		svg {
			fill: ${(props) => props.theme.colors.font.light1};
		}
	}
`;

export const DFooterWrapper = styled(DBodyWrapper)`
	padding: 10px 0 0 0;
	border-bottom: none;
`;
