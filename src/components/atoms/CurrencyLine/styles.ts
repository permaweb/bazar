import styled from 'styled-components';

export const Wrapper = styled.div<{ useReverseLayout: boolean }>`
	display: flex;
	flex-direction: ${(props) => (props.useReverseLayout ? 'row-reverse' : 'row')};
	align-items: center;
	gap: 7.5px;
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
	}
	img {
		height: 17.5px;
		width: 17.5px;
	}
	a {
		span {
			color: ${(props) => props.theme.colors.font.primary};
			&:hover {
				color: ${(props) => props.theme.colors.font.alt1};
			}
		}
		img {
			&:hover {
				opacity: 0.85;
			}
		}
	}
`;

export const Currency = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
`;
