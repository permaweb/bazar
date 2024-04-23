import styled from 'styled-components';

import { fadeIn2, open } from 'helpers/animations';

export const Wrapper = styled.div`
	width: 500px;
	max-width: 95vw;
	display: flex;
	flex-direction: column;
	align-items: center;
	margin: 0 auto;
	padding: 20px 20px;
	animation: ${open} ${fadeIn2};
	p {
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		text-align: center;
	}
	button {
		margin: 25px 0 0 0;
	}
`;

export const Icon = styled.div`
	height: 125px;
	width: 125px;
	display: flex;
	justify-content: center;
	align-items: center;
	background: ${(props) => props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	box-shadow: 0 5px 15px 0 ${(props) => props.theme.colors.shadow.primary};
	border-radius: 50%;
	margin: 0 0 20px 0;
	svg {
		height: 75px;
		width: 75px;
		fill: ${(props) => props.theme.colors.icon.primary.fill};
		margin: 3.5px 0 0 0;
	}
`;

export const WCWrapper = styled.div`
	height: auto;
`;
