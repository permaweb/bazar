import styled from 'styled-components';

export { MarketNote } from '../../../styles/asset-page';
export { Description, EmptyCopy, Facts, LicenseProperties } from '../../../styles/panels';

export const AboutRights = styled.section`
	margin-top: var(--space-6);
	padding-top: var(--space-4);
	border-top: 1px solid var(--line-dark);

	h2 {
		margin: 0;
		font: 500 var(--type-body) 'DM Sans', sans-serif;
	}

	.license-properties {
		margin-top: 10px;
	}

	> .asset-empty-copy {
		margin-top: 10px;
	}
`;
