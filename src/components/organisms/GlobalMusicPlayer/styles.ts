import styled from 'styled-components';

export const Wrapper = styled.div`
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	z-index: 1000;
	background: ${(props) => props.theme.colors.container.primary.background};
	border-top: 1px solid ${(props) => props.theme.colors.border.primary};
	box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
`;
