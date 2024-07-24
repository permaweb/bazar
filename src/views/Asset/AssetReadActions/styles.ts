import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 15px;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		flex-direction: row;
	}
`;
