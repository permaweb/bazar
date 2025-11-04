import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div<{ sm: boolean | undefined }>`
	width: 100%;
	margin: 10px 0;
	display: flex;
	flex-direction: column;
	position: relative;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		max-width: none;
	}
`;

export const TWrapper = styled.div`
	width: 100%;
	display: flex;
	justify-content: space-between;
	align-items: center;
	button {
		svg {
			margin: 0 0 1.5px 0;
		}
	}
`;

export const Label = styled.label`
	color: ${(props) => props.theme.colors.font.alt1};
	font-size: ${(props) => props.theme.typography.size.xSmall};
	font-weight: ${(props) => props.theme.typography.weight.bold};
`;

export const Tooltip = styled.div`
	padding: 0 20px 20px 20px;
	p {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		line-height: 1.5;
		color: ${(props) => props.theme.colors.font.primary};
	}
`;

export const Input = styled.input<{
	sm: boolean | undefined;
	disabled: boolean;
	invalid: boolean;
}>`
	height: ${(props) => (props.sm ? STYLING.dimensions.form.small : STYLING.dimensions.form.max)};
	color: ${(props) =>
		props.disabled ? props.theme.colors.button.primary.disabled.color : props.theme.colors.font.primary};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-size: ${(props) => props.theme.typography.size.base};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	margin: 10px 0 0 0;
	background: ${(props) => props.theme.colors.form.background};
	border: 1px solid
		${(props) => (props.invalid ? props.theme.colors.form.invalid.outline : props.theme.colors.form.border)};
	border-radius: ${STYLING.dimensions.radius.alt2};
	&:focus {
		outline: 0;
		border: 1px solid
			${(props) => (props.invalid ? props.theme.colors.form.invalid.outline : props.theme.colors.form.valid.outline)};
		outline: 0.5px solid
			${(props) => (props.invalid ? props.theme.colors.form.invalid.outline : props.theme.colors.form.valid.outline)};
		box-shadow: 0 0 0.5px
			${(props) => (props.invalid ? props.theme.colors.form.invalid.shadow : props.theme.colors.form.valid.shadow)};
		transition: box-shadow, border, outline 225ms ease-in-out;
	}
	&:disabled {
		background: ${(props) => props.theme.colors.form.disabled.background};
		color: ${(props) => props.theme.colors.form.disabled.label};
		box-shadow: none;
		border: 1px solid ${(props) => props.theme.colors.form.disabled.border};
	}
`;

export const EndTextContainer = styled.div<{
	sm: boolean | undefined;
	disabled: boolean;
}>`
	height: ${(props) => (props.sm ? STYLING.dimensions.form.small : `calc(${STYLING.dimensions.form.max} - 7.5px)`)};
	height: 100%;
	max-width: 100px;
	position: absolute;
	top: ${(props) => (props.sm ? '42.5%' : '37.5%')};
	right: 47.5px;
	transform: translate(0, -50%);
	display: flex;
	justify-content: center;
	align-items: center;
	overflow-x: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	background: transparent;
`;

export const EndText = styled.span<{ sm: boolean | undefined }>`
	color: ${(props) => props.theme.colors.font.primary.alt4};
	font-size: ${(props) => (props.sm ? props.theme.typography.size.small : '19px')};
	font-weight: ${(props) => props.theme.typography.weight.regular};
	width: 100%;
`;

export const ErrorContainer = styled.div`
	margin: 8.5px 0 0 0;
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
