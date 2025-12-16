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

export const EbookAction = styled.div`
	button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: ${(props) => props.theme.colors.button.primary.background};
		border: 1px solid ${(props) => props.theme.colors.button.primary.border};
		border-radius: ${STYLING.dimensions.radius.primary};
		color: ${(props) => props.theme.colors.font.primary};
		cursor: pointer;
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		transition: all 100ms;

		&:hover {
			background: ${(props) => props.theme.colors.button.primary.active.background};
			border-color: ${(props) => props.theme.colors.button.primary.active.border};
		}

		svg {
			width: 16px;
			height: 16px;
			fill: ${(props) => props.theme.colors.font.primary};
		}

		span {
			color: ${(props) => props.theme.colors.font.primary};
		}
	}
`;
