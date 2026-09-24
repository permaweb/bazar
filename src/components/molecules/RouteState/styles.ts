import styled from 'styled-components';

export const Shell = styled.section`
	width: min(760px, 100%);
	min-height: calc(100vh - 124px);
	min-height: calc(100dvh - 124px);
	margin: 0 auto;
	padding: 40px 0 var(--page-footer-spacing);

	> .back {
		margin-bottom: var(--space-5);
	}

	h1 {
		margin: 8px 0 24px;
		font-size: var(--type-page-title);
		line-height: 0.98;
		letter-spacing: -0.03em;
	}
`;
