import styled from 'styled-components';

export { Summary, SummaryLink } from '../../../styles/operation-panel';

/** The re-check row below the quote; it swaps to the shared `.inline-error` notice when the quote is unavailable. */
export const CheckAction = styled.div`
	&.quote-check-action {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		color: var(--muted);
		font-size: var(--type-body);
	}
`;
