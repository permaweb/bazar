import styled from 'styled-components';

import { EMBEDDED_WALLET_STYLE } from 'helpers/config';

export const Error = styled.p<{ $visible: boolean }>`
	position: fixed;
	z-index: ${EMBEDDED_WALLET_STYLE.zIndex};
	top: ${EMBEDDED_WALLET_STYLE.viewportPadding};
	right: ${EMBEDDED_WALLET_STYLE.viewportPadding};
	width: min(${EMBEDDED_WALLET_STYLE.panelMaxWidth}, calc(100vw - ${EMBEDDED_WALLET_STYLE.viewportPaddingTotal}));
	box-sizing: border-box;
	padding: ${EMBEDDED_WALLET_STYLE.errorPadding};
	background: ${(props) => props.theme.colors.container.alt1.background};
	border: ${EMBEDDED_WALLET_STYLE.border} solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${EMBEDDED_WALLET_STYLE.borderRadius};
	color: ${(props) => props.theme.colors.font.primary};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-size: ${(props) => props.theme.typography.size.body};
	opacity: ${(props) => (props.$visible ? 1 : 0)};
	visibility: ${(props) => (props.$visible ? 'visible' : 'hidden')};
	pointer-events: ${(props) => (props.$visible ? 'auto' : 'none')};
	transition: opacity ${EMBEDDED_WALLET_STYLE.transitionDuration} ease;
`;
