import styled from 'styled-components';

export const Wrapper = styled.div`
	width: 100%;
`;

export const Header = styled.div`
	padding: 15px 20px 20px 20px;
`;

export const ACLink = styled.div`
	margin: 5px 0 0 0;
	a {
		font-size: ${(props) => props.theme.typography.size.small};
		line-height: calc(${(props) => props.theme.typography.size.small} + 5px);
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		text-decoration: underline;
		&:hover {
			color: ${(props) => props.theme.colors.font.primary.alt8};
		}
	}
`;
