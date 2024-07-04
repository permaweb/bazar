import styled from 'styled-components';

export const Wrapper = styled.div`
	display: flex;
	align-items: center;
	svg {
		margin: 0 0 -0.75px 0px;
	}
`;

export const Label = styled.div`
	max-width: 200px;
	overflow: hidden;
	margin: 0 0 0 10px;
	a {
		width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		display: block;
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;
