import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	height: 100%;
	width: 100%;
`;

export const TabsHeader = styled.div<{ useFixed: boolean }>`
	width: 100%;
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		position: relative;
		top: auto;
	}
`;

export const Tabs = styled.div`
	display: flex;
	align-items: center;
	padding: 0 0 10px 0;
	overflow-x: auto;
	> * {
		&:not(:last-child) {
			margin: 0 20px 0 0;
		}
		&:last-child {
			margin: 0;
		}
	}
`;

export const Content = styled.div``;

export const Tab = styled.div<{ active: boolean }>`
	display: flex;
	justify-content: center;
	align-items: center;
	position: relative;
	button {
		position: relative;
		color: ${(props) => (props.active ? props.theme.colors.tabs.active.color : props.theme.colors.tabs.color)};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		&:hover {
			cursor: pointer;
			color: ${(props) => props.theme.colors.tabs.active.color};
		}
		&:before {
			content: '';
			position: absolute;
			bottom: -10px;
			height: 3.5px;
			width: 100%;
			background: ${(props) => props.theme.colors.tabs.active.background};
			border-radius: ${STYLING.dimensions.radius.primary};
			opacity: ${(props) => (props.active ? 1 : 0)};
			pointer-events: none;
			transition: all 200ms;
		}
	}
`;

export const AltTab = styled.div`
	position: relative;
	display: flex;
	justify-content: center;
`;

export const AltTabAction = styled.button<{ active: boolean; icon: boolean }>`
	padding: ${(props) => (props.icon ? '8.15px 25px 8.15px 22.5px' : '8.15px 25px')};
	font-size: ${(props) => props.theme.typography.size.small};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	border-radius: ${STYLING.dimensions.radius.primary};
	color: ${(props) => props.theme.colors.font.primary};
	cursor: pointer;
	background: ${(props) =>
		props.active ? props.theme.colors.container.primary.active : props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	&:hover {
		background: ${(props) => props.theme.colors.container.primary.active};
	}

	display: flex;
	justify-content: center;
	align-items: center;

	&:after {
		display: block;
		content: '';
		position: absolute;
		left: 50%;
		transform: translate(-50%, 0);
		bottom: -9.5px;
		background: ${(props) =>
			props.active ? props.theme.colors.tabs.active.background : props.theme.colors.transparent};
		height: 3.5px;
		border-radius: ${STYLING.dimensions.radius.primary};
		width: 100%;
	}
`;

export const Icon = styled.div<{ active: boolean }>`
	svg {
		height: 23.5px;
		width: 23.5px;
		padding: 3.5px 0 0 0;
		margin: 0 12.5px 0 0;
		color: ${(props) => props.theme.colors.font.primary};
		fill: ${(props) => props.theme.colors.font.primary};
	}
`;

export const View = styled.div`
	height: 100%;
	width: 100%;
	position: relative;
	margin: 25px 0 0 0;
`;
