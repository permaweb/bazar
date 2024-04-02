import styled from 'styled-components';

export const Wrapper = styled.div`
	margin: 30px 0 0 0;
`;

export const TotalsWrapper = styled.div`
	width: fit-content;
	> * {
		&:not(:last-child) {
			margin: 0 0 7.5px 0;
		}
		&:first-child {
			padding: 0 0 7.5px 0;
			border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
		}
		&:last-child {
			margin: 0;
		}
	}
`;

export const TotalQuantityLine = styled.div`
	display: flex;
	align-items: center;
	p,
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		color: ${(props) => props.theme.colors.font.alt1};
		word-wrap: break-word;
	}
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;
