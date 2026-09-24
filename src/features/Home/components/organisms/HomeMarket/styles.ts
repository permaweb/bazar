import styled, { keyframes } from 'styled-components';

const homeEnter = keyframes`
	from {
		opacity: 0;
		transform: translateY(8px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
`;

export const Shell = styled.div`
	height: calc(100vh - 122px);
	height: calc(100dvh - 122px);
	min-height: 0;
	overflow: visible;
	position: relative;
	color: var(--ink);
	background: var(--paper);
	--home-line: var(--line);
	--home-muted: var(--muted);

	& :focus-visible {
		outline: 2px solid var(--muted-subtle);
		outline-offset: 2px;
	}

	@media (max-width: 1050px) {
		height: auto;
		min-height: calc(100vh - 122px);
		min-height: calc(100dvh - 122px);
		overflow: visible;
	}
`;

export const Main = styled.div`
	min-width: 0;
	height: 100%;
	margin-left: 0;

	@media (max-width: 1050px) {
		height: auto;
	}
`;

export const Content = styled.div`
	height: 100%;
	padding: 0;
	overflow: visible;

	@media (max-width: 1050px) {
		height: auto;
		padding: 0;
	}

	@media (max-width: 480px) {
		padding-bottom: 0;
	}
`;

export const MarketLayout = styled.div`
	width: 100vw;
	height: 100%;
	margin-inline: calc(50% - 50vw);
	display: block;
	overflow-y: auto;
	overscroll-behavior: contain;
	scroll-padding-bottom: var(--page-footer-spacing);
	scrollbar-width: none;

	&::-webkit-scrollbar {
		width: 0;
		height: 0;
	}

	@media (max-width: 1050px) {
		height: auto;
		display: block;
		overflow-y: visible;
		overscroll-behavior: auto;
	}
`;

// The market section is always both `.home-section` and `.home-assets`; the two class blocks are
// merged here in the order the stylesheet applied them.
export const Section = styled.section`
	min-height: 100%;
	width: calc(100% - var(--page-gutter) - var(--page-gutter));
	min-width: 0;
	max-width: calc(var(--max-view-width) - var(--page-gutter) - var(--page-gutter));
	margin: 0 auto;
	padding-top: 0;
	padding-bottom: var(--page-footer-spacing);
	scroll-margin-top: 108px;
	container-type: inline-size;
	animation: ${homeEnter} 0.35s cubic-bezier(0, 0, 0.2, 1) both;

	&:nth-child(2) {
		animation-delay: 0.05s;
	}

	&:nth-child(3) {
		animation-delay: 0.1s;
	}

	.market-select {
		min-width: 190px;
	}

	.market-select-label {
		display: none;
	}

	> .home-section-heading {
		border-bottom: 0;
	}

	> :is(.error-panel, .inline-error, .collection-source-notice, .pending-operation-notice) {
		margin-bottom: var(--asset-grid-gap);
	}

	> .load-more {
		border-radius: 0;
		border-right: 0;
		border-left: 0;
	}

	@media (max-width: 1050px) {
		height: auto;
		overflow: visible;
		border-left: 0;
	}

	@media (max-width: 600px) {
		.home-section-heading {
			align-items: stretch;
			flex-direction: column;
			gap: 14px;
		}

		.market-select {
			width: 100%;
			min-width: 0;
		}
	}

	@media (max-width: 480px) {
		margin-bottom: 0;
	}
`;

export const SectionHeading = styled.div`
	min-height: 108px;
	margin: 0;
	padding: 28px 0;
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 24px;
	border-bottom: 1px solid var(--home-line);
	background: var(--paper-translucent);
	backdrop-filter: blur(14px);
	position: sticky;
	top: 0;
	z-index: 4;

	h1,
	h2 {
		margin: 0;
		color: var(--ink);
		text-shadow: none;
		letter-spacing: 0.01em;
		font-weight: 400;
		font-size: var(--type-body);
	}

	p {
		margin: 15px 0 0;
		color: var(--home-muted);
		font-size: var(--type-body);
		letter-spacing: 0.01em;
	}

	@media (max-width: 1050px) {
		position: static;
	}

	@media (max-width: 480px) {
		margin-bottom: 0;
		padding: 20px 0;
	}
`;

export const MarketTabs = styled.div`
	display: flex;
	align-items: center;
	gap: 6px;

	.home-market-tab .ui-icon {
		width: 13px;
		height: 13px;
	}
`;

export const AssetFilters = styled.div`
	position: relative;
	display: flex;
	align-items: flex-end;
	gap: 10px;

	@media (max-width: 480px) {
		width: 100%;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
`;
