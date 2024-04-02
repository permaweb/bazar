import styled from 'styled-components';

import { fadeIn1, open } from 'helpers/animations';
import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	max-width: 90vw;
	position: fixed;
	left: 50%;
	bottom: 20px;
	transform: translate(-50%, 0);
	z-index: 20;
	animation: ${open} ${fadeIn1};
	display: flex;
	align-items: center;
	padding: 11.5px 17.5px;
	background: ${(props) => props.theme.colors.container.alt10.background};
	border-radius: ${STYLING.dimensions.radius.primary};
`;

export const Message = styled.span`
	color: ${(props) => props.theme.colors.font.light1};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	font-size: ${(props) => props.theme.typography.size.small};
`;

export const Close = styled.div`
	margin: 0 0 0 80px;
	button {
		span {
			color: ${(props) => props.theme.colors.font.light1} !important;
			font-size: ${(props) => props.theme.typography.size.xSmall};
		}
		&:hover {
			span {
				color: ${(props) => props.theme.colors.font.light1} !important;
				opacity: 0.75;
			}
		}
	}
`;
