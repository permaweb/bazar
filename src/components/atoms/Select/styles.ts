import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	height: fit-content;
	width: 100%;
	position: relative;
`;

export const Label = styled.div<{ disabled: boolean }>`
	margin: 0 0 5px 0;
	span {
		color: ${(props) =>
			props.disabled ? props.theme.colors.button.primary.disabled.color : props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		line-height: 1.5;
	}
`;

export const Dropdown = styled.button<{ active: boolean }>`
	height: 32.5px;
	width: 100%;
	text-align: left;
	padding: 0 12.5px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: ${(props) =>
		props.active ? props.theme.colors.button.primary.active.background : props.theme.colors.button.primary.background};
	border: 1px solid ${(props) => (props.active ? props.theme.colors.border.primary : props.theme.colors.border.primary)};
	border-radius: ${STYLING.dimensions.radius.primary};
	transition: all 75ms;
	&:hover {
		background: ${(props) => props.theme.colors.button.primary.active.background};
		border: 1px solid ${(props) => props.theme.colors.button.primary.active.border};
		span {
			color: ${(props) => props.theme.colors.font.light1} !important;
		}
		svg {
			fill: ${(props) => props.theme.colors.font.light1} !important;
		}
	}
	&:focus {
		background: ${(props) => props.theme.colors.button.primary.active.background};
		border: 1px solid ${(props) => props.theme.colors.button.primary.active.border};
		span {
			color: ${(props) => props.theme.colors.font.light1} !important;
		}
		svg {
			fill: ${(props) => props.theme.colors.font.light1} !important;
		}
	}
	&:disabled {
		background: ${(props) => props.theme.colors.button.primary.disabled.background};
		border: 1px solid ${(props) => props.theme.colors.button.primary.disabled.border};
		span {
			color: ${(props) => props.theme.colors.button.primary.disabled.color} !important;
		}
		svg {
			fill: ${(props) => props.theme.colors.button.primary.disabled.color} !important;
		}
	}

	span {
		width: fit-content;
		text-overflow: ellipsis;
		overflow: hidden;
		font-size: ${(props) => props.theme.typography.size.xSmall} !important;
		font-weight: ${(props) => props.theme.typography.weight.bold} !important;
		color: ${(props) =>
			props.active ? props.theme.colors.font.light1 : props.theme.colors.button.primary.color} !important;
	}

	svg {
		height: 12.5px;
		width: 12.5px;
		margin: 0 0 0 12.5px;
		fill: ${(props) =>
			props.active ? props.theme.colors.font.light1 : props.theme.colors.button.primary.color} !important;
	}
`;

export const Options = styled.ul`
	width: 100%;
	position: absolute;
	top: 40px;
	z-index: 2;
	padding: 10px 0;
`;

export const Option = styled.li<{ active: boolean }>`
	text-align: center;
	height: 37.5px;
	display: flex;
	align-items: center;
	cursor: ${(props) => (props.active ? 'default' : 'pointer')};
	pointer-events: ${(props) => (props.active ? 'none' : 'all')};
	color: ${(props) => props.theme.colors.font.primary};
	font-size: ${(props) => props.theme.typography.size.xSmall};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	background: ${(props) =>
		props.active ? props.theme.colors.container.primary.active : props.theme.colors.container.primary.background};
	border: 1px solid transparent;
	padding: 0 15px;
	transition: all 75ms;
	&:hover {
		background: ${(props) => props.theme.colors.container.primary.active};
	}
`;
