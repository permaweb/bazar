import styled from 'styled-components';

export const Wrapper = styled.button<{ sm: boolean }>`
	position: relative;
	height: ${(props) => (props.sm ? 'fit-content' : '37.5px')};
	width: fit-content !important;
	background: ${(props) =>
		props.sm ? props.theme.colors.transparent : props.theme.colors.container.primary.background};
	padding: ${(props) => (props.sm ? '2.5px 6.5px' : '6.5px 10px')};
	display: flex;
	align-items: center;
	cursor: pointer;
	&:hover {
		background: ${(props) => props.theme.colors.container.primary.hover};
		cursor: pointer;
	}
	&:disabled {
		background: ${(props) => props.theme.colors.button.primary.disabled.background};
		cursor: default;
	}
	p {
		margin: ${(props) => (props.sm ? '0 7.5px 0 0' : '0 12.5px 0 0')};
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
	svg {
		transition: all 300ms;
		margin: 3.5px 0 0 0;
		height: ${(props) => (props.sm ? '15px' : '21.5px')} !important;
		width: ${(props) => (props.sm ? '15px' : '23.5px')} !important;
	}
`;

export const Button = styled.button`
	position: relative;
	display: flex;
	align-items: center;
	background-color: ${(props) => props.theme.colors.button.primary.background};
	color: ${(props) => props.theme.colors.font.primary};
	padding: 10px;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	&:disabled {
		background-color: ${(props) => props.theme.colors.button.primary.disabled.background};
		cursor: not-allowed;
	}
	&:hover {
		background-color: ${(props) => props.theme.colors.button.primary.hover};
	}
`;

export const Tooltip = styled.div`
	position: absolute;
	bottom: -30px;
	left: 50%;
	transform: translateX(-50%);
	padding: 5px 5px;
	border-radius: 4px;
	font-size: ${(props) => props.theme.typography.size.xxxsmall};
	visibility: hidden;
	transition: opacity 0.3s, visibility 0.3s;
	white-space: nowrap;

	${Wrapper}:hover &,
	${Button}:hover & {
		opacity: 1;
		visibility: visible;
	}
`;
