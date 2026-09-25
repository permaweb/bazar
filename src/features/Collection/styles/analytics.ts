import styled from 'styled-components';

// The sticky panel beside a collection's assets, shared by the live-offer orderbook and the activity summary.

export const Panel = styled.aside`
	position: sticky;
	top: 85px;
	grid-column: 2;
	grid-row: 3 / span 999;
	align-self: start;
	min-height: 430px;
	border: 1px solid var(--line);
	border-radius: 8px;
	background: var(--paper);
	overflow: hidden;

	@media (max-width: 900px) {
		position: static;
		min-height: 0;
	}
`;

export const Heading = styled.div`
	padding: 16px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;

	> div {
		display: grid;
		gap: 2px;
	}

	span {
		color: var(--muted-subtle);
		font-size: var(--type-small);
	}

	h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	> svg {
		width: 18px;
		height: 18px;
		color: var(--muted);
	}
`;

export const Tabs = styled.div`
	display: flex;
	padding: 0 16px;
	border-bottom: 1px solid var(--line);

	> span {
		position: relative;
		padding: 9px 0 10px;
		color: var(--ink);
		font: 400 var(--type-body) 'DM Sans', sans-serif;
	}

	> span::after {
		content: '';
		position: absolute;
		right: 0;
		bottom: -1px;
		left: 0;
		height: 2px;
		background: var(--accent);
	}
`;
