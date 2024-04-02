import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		margin: 20px 0 0 0;
	}
`;

export const Header = styled.div`
	padding: 15px 20px 20px 20px;
`;

export const ACLink = styled.div`
	margin: 5px 0 0 0;
	a {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		text-decoration: underline;
		&:hover {
			color: ${(props) => props.theme.colors.font.primary.alt8};
		}
	}
`;

export const OwnerLine = styled.div`
	margin: 10px 0 0 0;
	display: flex;
	align-items: center;
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		color: ${(props) => props.theme.colors.font.alt1};
		overflow-x: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	button {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		text-decoration: underline;
		margin: 0 0 0 5px;
		&:hover {
			color: ${(props) => props.theme.colors.font.alt1};
		}
	}
`;

export const TabsWrapper = styled.div`
	margin: 20px 0 0 0;
`;

export const TabWrapper = styled.div<{ label: string; icon?: string }>``;

export const TabContent = styled.div`
	margin: 20px 0 0 0;
`;
