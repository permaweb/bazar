import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		margin: 20px 0 0 0;
	}
`;

export const DataWrapper = styled.div`
	height: 600px;
	width: 100%;
	display: block;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		display: none;
	}
`;

export const OwnerLine = styled.div`
	display: flex;
	align-items: center;
	p {
		flex: none;
		margin: 0 10px 0 0;
	}
`;
