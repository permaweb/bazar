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
		height: auto;
		display: block;
	}
`;

export const Header = styled.div`
	h4 {
		line-height: 1.15;
		margin: -5px 0 10px 0;
	}
`;

export const OwnerLinesWrapper = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 15px;
	margin: 5px 0 0 0;
`;

export const OwnerLine = styled.div`
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

export const ACActionWrapper = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 25px;
	margin: 25px 0 0 0;
`;

export const ACAction = styled.div`
	a,
	button {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		display: flex;
		align-items: center;
		gap: 10px;
		&:hover {
			color: ${(props) => props.theme.colors.font.alt1};
		}
	}
	svg {
		height: 17.5px;
		width: 17.5px;
		margin: 5px 0 0 0;
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
	> * {
		&:not(:last-child) {
			margin: 0 0 10px 0;
			padding: 0 0 10px 0;
			border-bottom: 1px solid ${(props) => props.theme.colors.border.alt4};
		}
		&:last-child {
			margin: 0;
		}
	}
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
