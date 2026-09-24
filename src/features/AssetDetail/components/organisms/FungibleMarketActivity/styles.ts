import styled from 'styled-components';

export { MarketNote } from '../../../styles/asset-page';
export { EmptyCopy, MarketActivityFooter } from '../../../styles/panels';

export const Activity = styled.section`
	margin-top: var(--space-4);
`;

export const Heading = styled.div`
	margin-bottom: 8px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;

	> div {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	h2 {
		margin: 0;
		font: 500 var(--type-body) 'DM Sans', sans-serif;
	}

	span {
		color: var(--muted);
		font-size: var(--type-small);
	}
`;
