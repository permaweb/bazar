import styled from 'styled-components';

import { fadeIn2, open } from 'helpers/animations';
import { STYLING } from 'helpers/config';

const INFO_DIMENSION = '550px';

export const Wrapper = styled.div`
	width: 100%;
	display: flex;
	animation: ${open} ${fadeIn2};
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		flex-direction: column;
	}
`;

export const InfoWrapper = styled.div`
	width: ${INFO_DIMENSION};
	max-width: 100%;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		width: 100%;
	}
`;

export const ActionWrapper = styled.div`
	width: calc(100% - ${INFO_DIMENSION});
	max-width: 100%;
	padding: 0 0 0 40px;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		width: 100%;
		padding: 0;
	}
`;
