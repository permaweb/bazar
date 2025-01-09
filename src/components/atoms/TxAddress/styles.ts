import styled from 'styled-components';

export const Wrapper = styled.div<{ disabled: boolean }>`
	display: flex;
	align-items: center;
	p {
		color: ${(props) => props.theme.colors.font.primary} !important;
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary} !important;
		font-weight: ${(props) => props.theme.typography.weight.bold} !important;
		text-decoration: ${(props) => (props.disabled ? 'none' : 'underline')};

		&:hover {
			cursor: ${(props) => (props.disabled ? 'default' : 'pointer')};
			color: ${(props) => (props.disabled ? props.theme.colors.font.primary : props.theme.colors.font.alt1)};
		}
	}
`;

export const Details = styled.div``;
