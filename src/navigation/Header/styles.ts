import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
    height: ${STYLING.dimensions.nav.height};
    width: 100%;
    position: sticky;
    z-index: 1;
	top: 0;
    background: ${(props) => props.theme.colors.view.background};
    border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
`;

export const Content = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

export const LogoWrapper = styled.div`
    height: 35px;
    width: 35px;
    svg {
        height: 35px;
        width: 35px;
        fill: ${(props) => props.theme.colors.icon.alt2.fill};
        &:hover {
            fill: ${(props) => props.theme.colors.icon.alt2.active};
        }
	}
`;

export const ActionsWrapper = styled.div`
    display: flex;
    align-items: center;
`;

export const NavWrapper = styled.div`
    display: flex;
    align-items: center;
    margin: 0 20px 0 0;
    padding: 0 20px 0 0;
    border-right: 1px solid ${(props) => props.theme.colors.border.primary};
    > * {
		&:not(:last-child) {
			margin: 0 20px 0 0;
		}
		&:last-child {
			margin: 0;
		}
	}
    a {
        color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
    }
`;