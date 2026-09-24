import styled from 'styled-components';

// The grid owns the discovery tiles' artwork rules: `DiscoveryAssetArtwork` only ever renders inside
// it, and the original sheet expressed those rules against this container.
//
// The grid's own track sizing stays in apps/bazar/styles.css: its breakpoints are `@container`
// queries, and the stylis version bundled with styled-components v5 drops the selector inside an
// at-rule it does not know, so those rules cannot be compiled here.
export const AssetGrid = styled.div`
	a {
		min-width: 0;
		min-height: 0;
		grid-column: span 1;
		grid-row: span 1;
		display: flex;
		flex-direction: column;
		position: relative;
		overflow: hidden;
		border: 1px solid var(--home-line);
		border-radius: 0;
		background: var(--panel);
	}

	> a {
		content-visibility: auto;
		contain-intrinsic-size: 420px;
	}

	img,
	.artwork-fallback {
		width: 100%;
		aspect-ratio: 1.12;
		display: grid;
		place-items: center;
		object-fit: cover;
		border: 1px solid var(--home-line);
		border-radius: 10px;
		transition: opacity 100ms ease, border-color 100ms ease;
	}

	img {
		background: var(--panel);
	}

	a:hover img {
		transform: none;
		opacity: 0.94;
		border-color: var(--line-dark);
	}

	.home-asset-media,
	img.home-asset-media,
	.name-asset-artwork.home-asset-media,
	.artwork-fallback.home-asset-media {
		width: 100%;
		height: auto;
		min-height: 0;
		aspect-ratio: auto;
		flex: 1 1 auto;
		display: block;
		object-fit: cover;
		border: 0;
		border-bottom: 1px solid var(--home-line);
		border-radius: 0;
		background: var(--panel);
		transition: opacity 100ms ease;
	}

	a:hover .home-asset-media {
		transform: none;
		opacity: 0.86;
		border-color: var(--home-line);
	}

	a:hover .home-asset-details {
		background: var(--button-accent);
	}

	> .home-market-ghost {
		min-height: 0;
		grid-column: span 1;
		grid-row: span 1;
		border: 1px solid var(--home-line);
		border-radius: 0;
	}

	> .home-market-ghost > strong,
	> .home-market-ghost > span {
		overflow: visible;
		text-overflow: clip;
		white-space: normal;
	}
`;

export const AssetsEmpty = styled.div`
	min-height: 160px;
	padding: 36px 28px;
	border-radius: 0;
	border-right: 0;
	border-left: 0;
	border-top: 1px solid var(--home-line);
	color: var(--home-muted);
	font-size: var(--type-body);
`;

export const MarketLoading = styled.div`
	min-height: 160px;
	display: grid;
	place-items: center;
	border-top: 1px solid var(--home-line);
	background: var(--transparent);

	.loading {
		justify-content: center;
		padding: 36px 28px;
	}
`;

export const MarketSections = styled.div`
	display: grid;
	gap: clamp(36px, 5vw, 68px);
`;

export const MarketSection = styled.section`
	min-width: 0;

	&:first-child .discover-market-heading {
		border-top: 0;
	}
`;

export const MarketHeading = styled.div`
	min-height: 68px;
	padding: var(--space-3) 0;
	display: flex;
	align-items: end;
	justify-content: space-between;
	gap: 18px;
	border-top: 1px solid var(--line);

	h2,
	p {
		margin: 0;
	}

	h2 {
		font-size: var(--type-display);
		font-weight: 400;
		letter-spacing: -0.015em;
	}

	.eyebrow {
		margin-bottom: 5px;
		color: var(--muted-subtle);
	}

	button {
		min-height: 36px;
		padding-inline: 8px 0;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		border: 0;
		color: var(--muted);
		background: var(--transparent);
		font-size: var(--type-small);
	}

	button:hover:not(:disabled) {
		color: var(--ink);
		background: var(--transparent);
	}

	@media (max-width: 760px) {
		align-items: center;
	}
`;

export const SectionEmpty = styled.p`
	margin: 0;
	padding: 28px 0;
	border-top: 1px solid var(--line);
	border-bottom: 1px solid var(--line);
	color: var(--muted);
`;
