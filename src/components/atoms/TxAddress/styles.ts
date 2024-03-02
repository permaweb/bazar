import styled from 'styled-components';

export const Wrapper = styled.div`
	display: flex;
	align-items: center;
	p {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.base};
		line-height: 1.5;
		font-weight: ${(props) => props.theme.typography.weight.bold};
		margin: 0 7.5px 0 0;
	}
	button {
		padding: 2.5px 0 0 0;
		margin: 0 0 0 2.5px;
	}
`;

export const Details = styled.div``;
