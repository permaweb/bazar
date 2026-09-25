import styled from 'styled-components';

// The two-column collection route: assets on the left, the sticky analytics panel on the right.

export const Page = styled.section`
	display: grid;
	grid-template-columns: minmax(0, 1fr) 320px;
	column-gap: 18px;
	padding-top: 24px;

	> :not(.collection-analytics) {
		grid-column: 1;
	}

	> .back {
		margin-bottom: 14px;
	}

	.collection-tabs {
		margin-bottom: 12px;
	}

	&.collection-activity-page > .activity-list {
		margin-top: 0;
	}

	@media (max-width: 1180px) {
		grid-template-columns: minmax(0, 1fr) 286px;
	}

	@media (max-width: 900px) {
		display: block;
	}

	@media (max-width: 600px) {
		padding-top: 14px;

		.collection-tabs :is(a, button) {
			min-height: 44px;
			flex: 1;
			display: inline-flex;
			align-items: center;
			justify-content: center;
		}
	}
`;

// The heading, tabs and toolbar stay put while the assets scroll under them.
export const Navigation = styled.div`
	position: sticky;
	top: 85px;
	z-index: 30;
	background: var(--paper);

	&::before {
		content: '';
		position: absolute;
		right: 0;
		bottom: 100%;
		left: 0;
		height: 24px;
		background: var(--paper);
		pointer-events: none;
	}

	@media (max-width: 900px) {
		position: static;

		&::before {
			display: none;
		}
	}
`;

// The live region that announces progressive reveal; it is visually hidden until the reveal completes.
export const RevealStatus = styled.p`
	&.reveal-complete {
		width: fit-content;
	}

	&.reveal-complete:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 4px;
	}
`;

export const RevealSentinel = styled.span`
	display: block;
	width: 100%;
	height: 1px;
	pointer-events: none;
`;
