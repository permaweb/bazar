import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
	margin: 10px 0;
	display: flex;
	flex-direction: column;
	position: relative;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		max-width: none;
	}
`;

export const Label = styled.label`
	color: ${(props) => props.theme.colors.font.alt1};
	font-size: ${(props) => props.theme.typography.size.xSmall};
	font-weight: ${(props) => props.theme.typography.weight.bold};
`;

export const TextArea = styled.textarea<{
	disabled: boolean;
	invalid: boolean;
}>`
	height: 165px;
	color: ${(props) => props.theme.colors.font.primary};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-size: ${(props) => props.theme.typography.size.base};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	margin: 7.5px 0 0 0;
	background: ${(props) => props.theme.colors.form.background};
	border: 1px solid
		${(props) => (props.invalid ? props.theme.colors.form.invalid.outline : props.theme.colors.form.border)};
	border-radius: ${STYLING.dimensions.radius.alt2};
	&:focus {
		outline: 0;
		border: 1px solid
			${(props) => (props.invalid ? props.theme.colors.form.invalid.outline : props.theme.colors.form.valid.outline)};
		transition: box-shadow, border 225ms ease-in-out;
	}
	&:disabled {
		background: ${(props) => props.theme.colors.form.disabled.background};
		color: ${(props) => props.theme.colors.form.disabled.label};
		box-shadow: none;
		border: 1px solid ${(props) => props.theme.colors.form.border};
	}
	scrollbar-color: transparent transparent;

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

export const ErrorContainer = styled.div`
	margin: 7.5px 0 0 0;
	height: 25px;
	overflow-x: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

export const Error = styled.span`
	font-size: ${(props) => props.theme.typography.size.xSmall};
	font-weight: ${(props) => props.theme.typography.weight.regular};
	border-left: 2.75px solid ${(props) => props.theme.colors.warning.primary};
	padding-left: 5px;
`;
