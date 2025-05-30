import styled from 'styled-components';

import { STYLING } from 'helpers/config';

const INFO_DIMENSION = '560px';

export const Wrapper = styled.div`
	width: 100%;
	display: flex;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		flex-direction: column-reverse;
	}
`;

export const TradingInfoWrapper = styled.div`
	width: ${INFO_DIMENSION};
	max-width: 100%;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		width: 100%;
	}
`;

export const TradingActionWrapper = styled.div`
	width: calc(100% - ${INFO_DIMENSION});
	max-width: 100%;
	padding: 0 0 0 25px;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		width: 100%;
		padding: 0;
	}
`;

export const ReadingOverlay = styled.div`
	min-height: 100vh;
	height: 100%;
	width: 100%;
	position: fixed;
	z-index: 11;
	top: 0;
	left: 0;
	background: ${(props) => props.theme.colors.view.background};
	backdrop-filter: blur(2.5px);
`;

export const ReadingWrapper = styled.div`
	height: 100%;
	width: 100%;
	max-width: 70vw;
	display: flex;
	justify-content: center;
	align-items: center;
	margin: auto;
	position: relative;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		padding: 10px;
		max-width: none;
		flex-direction: column-reverse;
	}
`;

export const ReadingInfoWrapper = styled.div`
	height: calc(100% - 40px);
	width: calc(100% - 40px);
	max-width: 100%;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		height: 100%;
		width: 100%;
	}
`;

export const ReadingActionWrapper = styled.div`
	height: calc(100% - 40px);
	width: 40px;
	max-width: 100%;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		height: fit-content;
		width: 100%;
		position: absolute;
		top: 20px;
		z-index: 1;
		padding: 0 20px;
	}
`;
