import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
    height: ${STYLING.dimensions.nav.height};
    width: 100%;
    position: sticky;
	top: 0;
    background: ${(props) => props.theme.colors.view.background};
    border-bottom: 1px solid ${(props) => props.theme.colors.border.primary}
`;