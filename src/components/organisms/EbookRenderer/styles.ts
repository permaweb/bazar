import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
	min-height: 600px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 20px;
	background: ${(props) => props.theme.colors.container.primary.background};
	border-radius: ${STYLING.dimensions.radius.primary};
`;

export const BookContainer = styled.div`
	width: 100%;
	max-width: 800px;
	display: flex;
	justify-content: center;
	margin-bottom: 30px;
`;

export const Page = styled.div`
	width: 100%;
	background: ${(props) => props.theme.colors.container.alt1.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${STYLING.dimensions.radius.primary};
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	padding: 40px;
	height: 700px;
	max-height: 80vh;
	display: flex;
	flex-direction: column;
	position: relative;
	overflow: hidden;
`;

export const PageContent = styled.div`
	flex: 1;
	overflow-y: auto;
	overflow-x: hidden;
	padding-right: 10px;

	/* Custom scrollbar styling */
	&::-webkit-scrollbar {
		width: 8px;
	}

	&::-webkit-scrollbar-track {
		background: ${(props) => props.theme.colors.container.primary.background};
		border-radius: 4px;
	}

	&::-webkit-scrollbar-thumb {
		background: ${(props) => props.theme.colors.border.alt1};
		border-radius: 4px;

		&:hover {
			background: ${(props) => props.theme.colors.border.alt2};
		}
	}
`;

export const PageText = styled.div`
	font-size: ${(props) => props.theme.typography.size.base};
	line-height: 1.8;
	color: ${(props) => props.theme.colors.font.primary};
	white-space: pre-wrap;
	text-align: left;
	font-family: ${(props) => props.theme.typography.family.primary};
	word-wrap: break-word;
	overflow-wrap: break-word;
`;

export const PageNumber = styled.div`
	position: absolute;
	bottom: 15px;
	right: 20px;
	font-size: ${(props) => props.theme.typography.size.small};
	color: ${(props) => props.theme.colors.font.alt1};
	font-weight: ${(props) => props.theme.typography.weight.medium};
`;

export const Controls = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 20px;
	width: 100%;
	max-width: 800px;
`;

export const ControlButton = styled.button<{ disabled: boolean }>`
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 20px;
	background: ${(props) =>
		props.disabled
			? props.theme.colors.button.primary.disabled.background
			: props.theme.colors.button.primary.background};
	border: 1px solid
		${(props) =>
			props.disabled ? props.theme.colors.button.primary.disabled.border : props.theme.colors.button.primary.border};
	border-radius: ${STYLING.dimensions.radius.primary};
	color: ${(props) =>
		props.disabled ? props.theme.colors.button.primary.disabled.color : props.theme.colors.font.primary};
	cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
	font-size: ${(props) => props.theme.typography.size.small};
	font-weight: ${(props) => props.theme.typography.weight.medium};
	transition: all 100ms;

	&:hover:not(:disabled) {
		background: ${(props) => props.theme.colors.button.primary.active.background};
		border-color: ${(props) => props.theme.colors.button.primary.active.border};
	}

	svg {
		width: 16px;
		height: 16px;
		fill: ${(props) =>
			props.disabled ? props.theme.colors.button.primary.disabled.color : props.theme.colors.font.primary};
	}
`;

export const PageInputWrapper = styled.div`
	display: flex;
	align-items: center;
	gap: 5px;

	input {
		width: 60px;
		padding: 8px;
		text-align: center;
		background: ${(props) => props.theme.colors.container.alt1.background};
		border: 1px solid ${(props) => props.theme.colors.border.primary};
		border-radius: ${STYLING.dimensions.radius.alt2};
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.small};

		&:focus {
			outline: none;
			border-color: ${(props) => props.theme.colors.border.alt2};
		}
	}

	span {
		font-size: ${(props) => props.theme.typography.size.small};
		color: ${(props) => props.theme.colors.font.alt1};
	}
`;

export const Loader = styled.div`
	padding: 40px;
	text-align: center;
	color: ${(props) => props.theme.colors.font.alt1};
	font-size: ${(props) => props.theme.typography.size.base};
`;

export const Error = styled.div`
	padding: 40px;
	text-align: center;
	color: ${(props) => props.theme.colors.warning};
	font-size: ${(props) => props.theme.typography.size.base};
`;

export const PdfContainer = styled.div`
	width: 100%;
	height: 800px;
	min-height: 600px;
	display: flex;
	justify-content: center;
	align-items: center;
	background: ${(props) => props.theme.colors.container.alt1.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${STYLING.dimensions.radius.primary};
	overflow: hidden;
	margin-bottom: 20px;
`;

export const PdfFrame = styled.iframe`
	width: 100%;
	height: 100%;
	border: none;
	background: ${(props) => props.theme.colors.container.primary.background};
`;

export const PdfInfo = styled.div`
	text-align: center;
	padding: 10px;

	span {
		font-size: ${(props) => props.theme.typography.size.small};
		color: ${(props) => props.theme.colors.font.alt1};
		font-style: italic;
	}
`;
