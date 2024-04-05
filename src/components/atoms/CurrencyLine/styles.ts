import styled from 'styled-components';

export const Wrapper = styled.div`
	display: flex;
	align-items: center;
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
	}
	a {
		span {
			color: ${(props) => props.theme.colors.font.primary};
			&:hover {
				color: ${(props) => props.theme.colors.font.alt1};
			}
		}
	}
`;

export const Currency = styled.div`
	margin: 0 0 0 5px;
`;
