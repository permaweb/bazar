import styled from 'styled-components';

export const Wrapper = styled.button<{ sm: boolean }>`
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
