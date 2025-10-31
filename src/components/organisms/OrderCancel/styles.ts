import styled from 'styled-components';

export const Action = styled.button`
	span {
		font-size: ${(props) => props.theme.typography.size.small};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.warning.primary};
	}
	&:hover {
		span {
			color: ${(props) => props.theme.colors.warning.alt1};
		}
	}
`;

export const MWrapper = styled.div`
	p {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		color: ${(props) => props.theme.colors.font.alt1};
	}
`;

export const FlexActions = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 25px 0 0 0;
	button {
		width: 100% !important;
		span {
			font-size: ${(props) => props.theme.typography.size.xLg} !important;
			font-family: ${(props) => props.theme.typography.family.alt1};
			text-transform: uppercase;
		}
	}
`;
