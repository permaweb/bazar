import styled from 'styled-components';

import { fadeIn1, open } from 'helpers/animations';
import { STYLING } from 'helpers/config';

export const Wrapper = styled.div<{ top: number; noHeader: boolean }>`
	min-height: 100vh;
	height: 100%;
	width: 100%;
	position: fixed;
	z-index: 15;
	top: 0;
	left: 0;
	background: ${(props) => props.theme.colors.overlay.primary};
	backdrop-filter: blur(2.5px);
	animation: ${open} ${fadeIn1};
`;

export const Container = styled.div<{
	noHeader: boolean;
}>`
	width: 650px;
	max-width: ${(props) => (props.noHeader ? '100%' : '90vw')};
	background: ${(props) => (props.noHeader ? 'transparent' : props.theme.colors.container.primary.background)};
	border-radius: ${STYLING.dimensions.radius.primary};
	margin: 20px auto;
`;

export const Header = styled.div`
	height: 65px;
	width: 100%;
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 0 20px;
`;

export const LT = styled.div`
	max-width: 75%;
	display: flex;
	align-items: center;
`;

export const Title = styled.p`
	color: ${(props) => props.theme.colors.font.primary};
	font-size: ${(props) => props.theme.typography.size.lg};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	line-height: calc(${(props) => props.theme.typography.size.lg} + 5px);
	font-family: ${(props) => props.theme.typography.family.alt1};
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	margin: 2.5px 0 0 0;
`;

export const Close = styled.div`
	padding: 2.5px 0 0 0;
`;

export const Body = styled.div`
	max-height: calc(100dvh - 100px);
	width: 100%;
	overflow-y: auto;
	scrollbar-color: transparent transparent;
	padding: 0 0 0 20px 0;

	::-webkit-scrollbar-track {
		background: ${(props) => props.theme.colors.view.background};
		padding: 0 5px;
	}

	::-webkit-scrollbar {
		width: 15.5px;
	}

	scrollbar-color: ${(props) => props.theme.colors.scrollbar.thumb} transparent;

	::-webkit-scrollbar-thumb {
		background-color: ${(props) => props.theme.colors.scrollbar.thumb};
		border-radius: 36px;
		border: 3.5px solid transparent;
		background-clip: padding-box;
	}
`;
