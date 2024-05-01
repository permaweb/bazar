import styled from 'styled-components';

import * as GS from 'app/styles';
import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
`;

export const DataWrapper = styled.div`
	height: 420px;
	width: 100%;
	margin: 0 0 20px 0;
	display: none;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		display: block;
	}
`;

export const Header = styled.div`
	padding: 15px 20px 20px 20px;
`;

export const ACLink = styled.div`
	margin: 5px 0 0 0;
	display: flex;
	align-items: center;
	gap: 5px;
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
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
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

export const OrderCancel = styled.div`
	margin: 0 0 0 5px;
`;

export const MDrawerHeader = styled.div``;

export const DrawerContent = styled(GS.DrawerContent)`
	background: transparent;
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		> * {
			&:not(:last-child) {
				padding: 0 0 15px 0;
				border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
			}
		}
	}
`;

export const DrawerContentLine = styled(GS.DrawerContentLine)``;

export const DrawerContentFlex = styled(GS.DrawerContentFlex)`
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		margin: 5px 0 10px 0;
	}
`;

export const DrawerContentDetailAlt = styled(GS.DrawerContentDetailAlt)`
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		margin: 0 0 10px 0;
	}
`;
