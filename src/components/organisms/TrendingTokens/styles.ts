import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
`;

export const Header = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: 20px;
	margin: 0 0 20px 0;
`;

export const TokensWrapper = styled.div`
	display: flex;
	flex-direction: column;
	gap: 20px;
`;

export const TokenLine = styled.button`
	min-height: 121.5px;
	display: flex;
	align-items: center;
	justify-content: flex-start;
	flex-wrap: wrap;
	gap: 20px;
	padding: 30px;
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: calc(${(props) => props.theme.typography.size.lg} + 4px);
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-family: ${(props) => props.theme.typography.family.alt1};
		display: block;
	}

	&:hover {
		background: ${(props) => props.theme.colors.container.primary.active};
	}

	@media (max-width: ${STYLING.cutoffs.tablet}) {
		justify-content: space-between;
	}
`;

export const TokenImage = styled.div<{}>`
	height: 60px;
	width: 60px;
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: 50%;
	overflow: hidden;
	display: flex;
	justify-content: center;
	align-items: center;
	position: relative;
	img {
		height: 100%;
		width: 100%;
		object-fit: cover;
	}
`;

export const TokenTicker = styled.div`
	margin: 0 0 0 auto;
	span {
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: ${(props) => props.theme.typography.size.lg};
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-family: ${(props) => props.theme.typography.family.primary};
		display: block;
	}

	@media (max-width: ${STYLING.cutoffs.tablet}) {
		display: none;
	}
`;

export const SDMessageInfo = styled.div`
	width: 100%;
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-family: ${(props) => props.theme.typography.family.primary};
		display: block;
	}
`;
