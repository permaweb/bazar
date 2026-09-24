import styled from 'styled-components';

export { Heading, Page, Recovery } from '../../../styles/create-form';

export const TokenSummary = styled.div`
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 24px;
	margin-bottom: 32px;
	padding: 18px 20px;
	border: 1px solid var(--line);
	border-radius: 12px;
	background: var(--surface-subtle);

	.token-artwork {
		flex: 0 0 auto;
	}

	dl {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 32px;
		margin: 0;
	}

	dl dt {
		color: var(--muted);
		font-size: var(--type-small);
	}

	dl dd {
		margin: 2px 0 0;
		font-weight: 600;
		word-break: break-all;
	}

	> a {
		margin-left: auto;
		color: inherit;
		font-size: var(--type-small);
		text-decoration: underline;
	}
`;
