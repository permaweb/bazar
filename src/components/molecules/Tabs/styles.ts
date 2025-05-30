import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Container = styled.div`
	height: fit-content;
	margin: auto 0 0 0;
	position: relative;
`;

export const List = styled.div`
	display: flex;
	gap: 20px;

	@media (max-width: ${STYLING.cutoffs.secondary}) {
		overflow-x: auto;
		overflow-y: hidden;
	}
`;

export const Content = styled.div`
	height: calc(100% - 25px);
	position: relative;
`;

export const Tab = styled.div``;

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
		bottom: -12.5px;
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
	}
`;
