import styled from 'styled-components';

// The token rows of a token collection.
export const TokenList = styled.div`
	margin-top: 18px;
`;

/**
 * The asset cards of a unique or name collection. The collection page always carries one of the `view-*` layout
 * classes, so the `.view-* &` rules below decide `grid-template-columns` in every case.
 */
export const Grid = styled.div`
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	/*
	 * .collection-market-grid set the gap after both the .asset-grid base and the 480px block, so 8px always won.
	 * The overridden var(--asset-grid-gap) and the 480px 10px are dropped rather than moved: a media block is
	 * emitted after the block's own declarations, so moving them would flip the result.
	 */
	gap: 8px;

	&.names-collection-grid {
		grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
	}

	&.names-collection-grid .asset-card {
		min-height: 94px;
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr);
	}

	&.names-collection-grid .asset-media {
		min-height: 94px;
		aspect-ratio: auto;
		border-right: 1px solid var(--line);
		font-size: var(--type-display);
	}

	&.names-collection-grid .asset-card-copy {
		min-width: 0;
		align-content: center;
		display: grid;
	}

	@media (max-width: 1050px) {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	@media (max-width: 760px) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	@media (max-width: 480px) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.view-comfortable & {
		grid-template-columns: repeat(4, minmax(0, 1fr));

		@media (max-width: 600px) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.view-compact & {
		grid-template-columns: repeat(auto-fill, minmax(138px, 1fr));

		@media (max-width: 600px) {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.asset-card {
		border-radius: 7px;
	}

	.asset-card-copy {
		padding: 10px;
	}

	.asset-card-heading {
		margin: 0;
		display: grid;
		gap: 7px;
	}

	.asset-card-heading h3,
	.asset-card-heading > strong {
		overflow: hidden;
		font-size: var(--type-small);
		line-height: 1.25;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.asset-card-heading h3 {
		font-weight: 400;
	}

	.asset-card-heading > strong.listed {
		color: var(--ink);
	}

	.view-list & {
		grid-template-columns: repeat(2, minmax(0, 1fr));

		.asset-card {
			min-height: 82px;
			display: grid;
			grid-template-columns: 82px minmax(0, 1fr);
		}

		.asset-media {
			min-height: 82px;
			aspect-ratio: auto;
		}

		.asset-card-copy {
			display: grid;
			align-content: center;
		}

		@media (max-width: 600px) {
			grid-template-columns: minmax(0, 1fr);
		}
	}
`;
