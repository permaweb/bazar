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
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
	> * {
		&:not(:last-child) {
			margin: 0 30px 0 0;
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

export const View = styled.div`
	height: 100%;
	width: 100%;
	position: relative;
	margin: 25px 0 0 0;
`;
