import styled from 'styled-components';

// Shown while the live-offer pass is still running, and when it finds nothing.
export const Empty = styled.div`
	min-height: 310px;
	padding: 36px 24px;
	display: grid;
	place-content: center;
	justify-items: start;
	gap: 9px;

	> svg {
		width: 20px;
		height: 20px;
		color: var(--muted);
	}

	strong {
		font-weight: 400;
	}

	p {
		margin: 0 0 5px;
		color: var(--muted);
		font-size: var(--type-small);
		line-height: 1.5;
	}

	.ui-button {
		min-height: 34px;
		padding: 7px 10px;
	}
`;

// Live offers as a depth-shaded orderbook; each row's shading comes from its own --order-depth.
export const Orderbook = styled.div`
	.collection-orderbook-head,
	li a {
		display: grid;
		grid-template-columns: minmax(0, 1.3fr) minmax(60px, 0.7fr) minmax(72px, 0.8fr);
		align-items: center;
		gap: 8px;
	}

	.collection-orderbook-head {
		padding: 10px 12px;
		color: var(--muted-subtle);
		font-size: var(--type-small);
	}

	.collection-orderbook-head span:not(:first-child),
	li span:not(:first-child) {
		text-align: right;
	}

	ul {
		margin: 0;
		padding: 0 0 8px;
		list-style: none;
	}

	li a {
		position: relative;
		isolation: isolate;
		padding: 7px 12px;
		overflow: hidden;
		font: 400 0.72rem / 1.25 ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	li a::before {
		content: '';
		position: absolute;
		z-index: -1;
		top: 0;
		right: 0;
		bottom: 0;
		width: var(--order-depth, 0%);
		background: color-mix(in srgb, var(--positive) 12%, var(--transparent));
	}

	li a:hover {
		background: var(--surface-subtle);
	}

	li span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	li span:first-child {
		color: var(--positive-text);
	}
`;
