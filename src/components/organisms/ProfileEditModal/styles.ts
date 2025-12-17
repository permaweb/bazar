import styled from 'styled-components';
import { STYLING } from 'helpers/config';

export const Overlay = styled.div`
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.75);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1000;
	padding: 20px;
`;

export const Modal = styled.div`
	background: ${(props) => props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${STYLING.dimensions.borderRadiusWrapper};
	max-width: 600px;
	width: 100%;
	max-height: 90vh;
	overflow-y: auto;
	box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
`;

export const Header = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 20px 25px;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
`;

export const Title = styled.h2`
	font-size: ${(props) => props.theme.typography.size.lg};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
	margin: 0;
`;

export const Content = styled.div`
	padding: 25px;
	display: flex;
	flex-direction: column;
	gap: 20px;
`;

export const TextAreaWrapper = styled.div`
	position: relative;
`;

export const CharCount = styled.div`
	text-align: right;
	font-size: ${(props) => props.theme.typography.size.xSmall};
	color: ${(props) => props.theme.colors.font.alt1};
	margin-top: 5px;
`;

export const Footer = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: 15px;
	padding: 20px 25px;
	border-top: 1px solid ${(props) => props.theme.colors.border.primary};
`;
