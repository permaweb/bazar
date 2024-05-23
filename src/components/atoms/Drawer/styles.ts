import styled from 'styled-components';

import { fadeIn2, open } from 'helpers/animations';
import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	background: ${(props) => props.theme.colors.accordion.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${STYLING.dimensions.radius.primary};
	overflow: hidden;
`;

export const Action = styled.button`
	height: 55.5px;
	width: 100%;
	&:hover {
		background: ${(props) => props.theme.colors.accordion.hover};
	}
`;

export const Label = styled.div`
	height: 100%;
	width: 100%;
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 2.5px 20px 0 20px;
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.accordion.color};
		padding: 0 0 2.5px 0;
	}
	svg {
		width: 17.5px !important;
		fill: ${(props) => props.theme.colors.accordion.color};
	}
`;

export const Arrow = styled.div`
	margin: 2.5px 0 0 0;
	svg {
		transform: rotate(270deg);
	}
`;

export const Title = styled.div`
	display: flex;
	align-items: center;
	svg {
		margin: 0 15px 0 0;
	}
`;

export const Content = styled.div`
	animation: ${open} ${fadeIn2};
	border-top: 1px solid ${(props) => props.theme.colors.border.primary};
	border-bottom-left-radius: ${STYLING.dimensions.radius.primary};
	border-bottom-right-radius: ${STYLING.dimensions.radius.primary};
`;
