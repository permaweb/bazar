import styled from 'styled-components';

// One kind of wallet holding — tokens or unique assets — with its own view filter and progressive reveal.
export const Group = styled.section`
	margin-top: var(--space-7);
`;

// The select rules keep the two-class weight they had in apps/bazar/styles.css, so they still win over the
// select atom's own width and menu placement.
export const Title = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-4);
	margin-bottom: var(--space-4);
	border-bottom: 1px solid var(--line);
	padding-bottom: var(--space-3);

	h2 {
		margin: 0;
		font-size: var(--type-display);
	}

	> .market-select {
		width: 190px;
		min-width: 190px;
	}

	.market-select-menu {
		right: 0;
		left: auto;
	}

	@media (max-width: 480px) {
		> .market-select {
			width: 160px;
			min-width: 160px;
		}
	}
`;

export const Heading = styled.div`
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 10px;

	> span {
		display: grid;
		place-items: center;
		min-width: 30px;
		height: 30px;
		border-radius: 5px;
		background: var(--panel);
		font-size: var(--type-small);
	}
`;

// The same grid the collection asset results use; both features keep their own copy of the rules.
export const Grid = styled.div`
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: var(--asset-grid-gap);

	@media (max-width: 1050px) {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	@media (max-width: 760px) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	@media (max-width: 480px) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
`;

export const Empty = styled.p`
	margin: 0;
	color: var(--muted);
	font-size: var(--type-body);
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
