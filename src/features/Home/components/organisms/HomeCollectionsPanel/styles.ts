import styled from 'styled-components';

export const FeatureGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: var(--asset-grid-gap);

	@media (max-width: 1050px) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	@media (max-width: 600px) {
		grid-template-columns: minmax(0, 1fr);
	}

	@media (max-width: 480px) {
		grid-template-columns: 1fr;
	}
`;

export const NoResults = styled.div`
	padding: 48px;
	border: 1px solid var(--home-line);
	border-width: 0 0 1px;
	border-radius: 0;
	color: var(--home-muted);
	text-align: center;
`;
