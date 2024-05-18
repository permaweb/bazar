import styled from 'styled-components';

export const Wrapper = styled.div`
	position: relative;
`;

export const Action = styled.button`
	height: 35px;
	padding: 0 15px;
	display: flex;
	align-items: center;
	gap: 10px;
	img {
		width: 10px;
	}
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		display: block;
	}
	&:hover {
		background: ${(props) => props.theme.colors.container.primary.active};
	}
`;

export const Dropdown = styled.div`
	height: 400px;
	width: 400px;
	max-width: 90vw;
	position: absolute;
	top: 45px;
	right: 0;
`;
