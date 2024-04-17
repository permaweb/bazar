import styled from 'styled-components';

import { STYLING } from 'helpers/config';

const INFO_DIMENSION = '550px';

export const Wrapper = styled.div`
	width: 100%;
	display: flex;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		flex-direction: column-reverse;
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
