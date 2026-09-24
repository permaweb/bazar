import { Link } from 'react-router-dom';
import styled from 'styled-components';

// The collection grids restyle these cards from their own context; those rules stay with the
// Collection components that own the context class.
export const Card = styled(Link)`
	content-visibility: auto;
	contain-intrinsic-size: 360px;
	border: 1px solid var(--line);
	border-radius: 10px;
	overflow: hidden;
	background: var(--paper);
	box-shadow: none;
	transition: background 0.1s ease, border-color 0.1s ease;

	&:hover {
		transform: none;
		border-color: var(--line-dark);
		background: var(--panel);
		box-shadow: none;
	}

	&:hover .asset-media img {
		transform: none;
	}

	&.collection-context .asset-card-heading {
		margin-block: 0;
	}
`;

export const Copy = styled.div`
	padding: 15px;

	p,
	span {
		margin: 0;
		font-size: var(--type-body);
		color: var(--muted);
	}

	h3 {
		margin: 6px 0 11px;
		font-size: var(--type-body);
		text-shadow: none;
	}

	.asset-card-status {
		width: max-content;
		margin-top: 7px;
		padding: 3px 6px;
		border: 1px solid var(--line);
		border-radius: 4px;
		color: var(--muted);
		background: var(--panel);
		font-size: var(--type-small);
		line-height: 1.1;
	}

	@media (max-width: 480px) {
		padding: 10px;

		p,
		span {
			font-size: var(--type-small);
		}
	}
`;

export const Heading = styled.div`
	margin: 6px 0 11px;
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;

	h3 {
		min-width: 0;
		margin: 0;
	}

	> strong {
		flex: 0 0 auto;
		color: var(--muted);
		font-size: var(--type-body);
		font-weight: 400;
		white-space: nowrap;
	}

	> strong.listed {
		color: var(--positive-text);
	}

	@media (max-width: 480px) {
		margin: 5px 0 8px;
		display: grid;
		justify-content: stretch;
		gap: 6px;

		h3 {
			min-height: 2.02rem;
			display: -webkit-box;
			overflow: hidden;
			font-size: var(--type-body);
			line-height: 1.2;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			white-space: normal;
		}

		> strong {
			font-size: var(--type-small);
			white-space: normal;
			overflow-wrap: anywhere;
		}
	}
`;
