import styled from 'styled-components';

export const Wrapper = styled.div`
	display: flex;
	align-items: center;
	svg {
		margin: 0 0 -0.75px 0.25px;
	}
`;

export const Label = styled.div`
	margin: 0 0 0 10px;
	a {
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;
