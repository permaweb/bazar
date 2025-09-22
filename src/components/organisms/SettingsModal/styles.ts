import styled from 'styled-components';

import { fadeIn1 } from 'helpers/animations';
import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	height: auto;
	max-height: 90vh;
	width: 500px;
	max-width: 90vw;
	position: fixed;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	background: ${(props) => props.theme.colors.container.primary.background};
	border-radius: ${STYLING.dimensions.radius.primary};
	animation: ${fadeIn1} 200ms;
	overflow: hidden;
`;

export const Content = styled.div`
	display: flex;
	flex-direction: column;
	height: 100%;
`;

export const Header = styled.div`
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20px;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};

	h3 {
		font-size: ${(props) => props.theme.typography.size.lg};
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		color: ${(props) => props.theme.colors.font.primary};
		margin: 0;
	}

	svg {
		fill: ${(props) => props.theme.colors.icon.primary.fill};
	}
`;

export const Form = styled.div`
	padding: 20px;
	display: flex;
	flex-direction: column;
	gap: 20px;
	max-height: 60vh;
	overflow-y: auto;
`;

export const FormGroup = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;
`;

export const Label = styled.label`
	font-size: ${(props) => props.theme.typography.size.small};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
	font-family: ${(props) => props.theme.typography.family.primary};
`;

export const Input = styled.input`
	height: 40px;
	padding: 0 12px;
	background: ${(props) => props.theme.colors.form.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${STYLING.dimensions.radius.primary};
	color: ${(props) => props.theme.colors.font.primary};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-size: ${(props) => props.theme.typography.size.small};
	transition: all 0.2s ease;

	&:focus {
		outline: none;
		border-color: ${(props) => props.theme.colors.border.active};
		background: ${(props) => props.theme.colors.form.active};
	}

	&::placeholder {
		color: ${(props) => props.theme.colors.font.alt1};
	}
`;

export const StatusWrapper = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 10px;
	background: ${(props) => props.theme.colors.container.alt4.background};
	border-radius: ${STYLING.dimensions.radius.primary};
	border: 1px solid ${(props) => props.theme.colors.border.alt4};
`;

export const StatusText = styled.span`
	font-size: ${(props) => props.theme.typography.size.xSmall};
	font-weight: ${(props) => props.theme.typography.weight.medium};
	color: ${(props) => props.theme.colors.font.alt1};
	font-family: ${(props) => props.theme.typography.family.primary};
`;

export const Actions = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20px;
	border-top: 1px solid ${(props) => props.theme.colors.border.primary};
	gap: 15px;
`;

export const ActionGroup = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;
`;
