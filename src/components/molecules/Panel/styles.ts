import styled from 'styled-components';

import { fadeIn1, open, openRight } from 'helpers/animations';
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
	width?: number;
}>`
	height: calc(100dvh - 20px);
	min-width: ${(props) => (props.width ? `${props.width.toString()}px` : '425px')};
	width: ${(props) => (props.width ? `${props.width.toString()}px` : '425px')};
	max-width: calc(100vw - 30px);
	position: fixed;
	overflow: hidden;
	top: 10px;
	right: 10px;
	transition: width 50ms ease-out;
	animation: ${openRight} 200ms;
	background: ${(props) => props.theme.colors.container.primary.background};
	box-shadow: 0 0 0.25rem 0.0625rem ${(props) => props.theme.colors.shadow.alt3},
		0 0.0625rem 0.0625rem ${(props) => props.theme.colors.shadow.alt3};
	border: 1px solid ${(props) => props.theme.colors.border.alt4};
	border-radius: ${STYLING.dimensions.radius.primary};
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		min-width: 82.5vw;
	}
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
	height: calc(100% - 65px);
	width: 100%;
	overflow-y: auto;
	scrollbar-color: transparent transparent;
	position: relative;
`;
