import styled from 'styled-components';

import { fadeIn2, open } from 'helpers/animations';
import { STYLING } from 'helpers/config';

export const NWrapper = styled.div`
	height: calc(100vh - 40px);
	width: 300px;
	animation: ${open} ${fadeIn2};
	@media (max-width: ${STYLING.cutoffs.initial}) {
		height: auto;
		width: 100%;
		position: absolute;
	}
`;

export const NContent = styled.div`
	max-height: calc(100vh - 160px);
	width: 100%;
	position: sticky;
	z-index: 1;
	top: 105px;
	overflow: auto;
	margin: 10.5px 0 0 0;
	padding: 15px 20px 0 20px;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		position: relative;
		top: auto;
		padding: 0 15px;
		max-height: none;
	}
`;

export const NTitle = styled.div`
	width: 100%;
	display: flex;
	justify-content: flex-start;
	align-items: center;
	margin: 0 0 10px 0;
	p {
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: 22px !important;
		font-weight: ${(props) => props.theme.typography.weight.bold} !important;
		color: ${(props) => props.theme.colors.font.primary} !important;
	}
`;

export const NTitleMobile = styled.button<{ open: boolean }>`
	height: 50px;
	width: 100%;
	display: flex;
	justify-content: space-between;
	align-items: center;
	&:hover {
		cursor: pointer;
	}

	&:focus {
		outline: 0;
	}
	@media (max-width: ${STYLING.cutoffs.initial}) {
		height: 40px;
	}
	p {
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.small} !important;
		font-weight: ${(props) => props.theme.typography.weight.bold} !important;
		color: ${(props) => props.theme.colors.font.primary} !important;
	}
	svg {
		height: 12.5px;
		width: 12.5px;
		margin: 3.5px 0 0 0;
		transform: rotate(${(props) => (props.open ? '90deg' : '270deg')});
		fill: ${(props) => props.theme.colors.font.primary};
	}
`;

export const NList = styled.ul`
	width: 100%;
	overflow: auto;
	a {
		width: fit-content;
		text-decoration: none;
		display: block;
		&:hover {
			color: ${(props) => props.theme.colors.font.alt1} !important;
		}
	}
`;

export const NListItem = styled.li<{ disabled: boolean; active: boolean }>`
	pointer-events: ${(props) => (props.disabled ? 'none' : 'default')};
	text-align: center;
	display: flex;
	align-items: center;
	cursor: pointer;
	font-size: ${(props) => props.theme.typography.size.small};
	color: ${(props) => (props.active ? props.theme.colors.font.alt5 : props.theme.colors.font.primary)};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	margin: 0 0 7.5px 0;
	line-height: 1.75;
	text-align: left;
	border-radius: ${STYLING.dimensions.radius.primary};
	background: transparent;

	&:hover {
		color: ${(props) => (props.active ? props.theme.colors.font.alt5 : props.theme.colors.font.alt1)};
	}
`;

export const NGroup = styled.div`
	margin: 12.5px 0 20px 0;
`;

export const NSubHeader = styled(NTitle)`
	height: auto;
	justify-content: flex-start;
	font-size: ${(props) => props.theme.typography.size.small};
	border-top-left-radius: 0;
	border-top-right-radius: 0;
	margin: 0 0 10px 0;
	p {
		font-size: ${(props) => props.theme.typography.size.small} !important;
		color: ${(props) => props.theme.colors.font.alt1} !important;
	}
`;

export const NSubList = styled.div`
	padding: 0 0 0 15px;
	border-left: 1px solid ${(props) => props.theme.colors.border.primary};
`;
