import styled from 'styled-components';

import * as GS from 'app/styles';
import { STYLING } from 'helpers/config';

export const Wrapper = styled.div``;

export const TabsWrapper = styled.div`
	margin: 7.5px 0 0 0;
	padding: 20px;
`;

export const TabWrapper = styled.div<{ label: string; icon?: string }>``;

export const TabContent = styled.div``;

export const DrawerContent = styled(GS.DrawerContent)`
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		> * {
			&:not(:last-child) {
				padding: 0 0 15px 0;
				border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
			}
		}
	}
`;

export const Divider = styled.div`
	height: 1px;
	width: 100%;
	border-top: 1px dotted ${(props) => props.theme.colors.border.primary};
	margin: 22.5px 0 15px 0 !important;
`;
