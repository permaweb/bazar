import styled from 'styled-components';

// The asset detail page shell shared by the unique asset page, the fungible token page and their loading shell.
// Rules keep their original stylesheet order inside each block so the last declaration still wins.

export const Page = styled.section`
	width: 100%;
	padding-top: 30px;

	> .back {
		margin-bottom: 18px;
	}

	.asset-hero-media {
		width: 100%;
		max-height: calc(100vh - 116px);
		max-height: calc(100dvh - 116px);
		border-radius: 12px;
	}

	.asset-media-label {
		color: var(--fixed-ink);
		border-color: var(--image-detail-border);
		background: var(--image-control-surface);
		box-shadow: 0 8px 28px var(--shadow-soft);
	}

	.asset-details h1 {
		margin: 15px 0 12px;
		font-size: var(--type-page-title);
		line-height: 1.04;
		letter-spacing: -0.02em;
	}

	.asset-details h1:focus-visible {
		outline: 2px solid var(--coral);
		outline-offset: 7px;
		border-radius: 2px;
	}

	@media (max-width: 1050px) {
		.asset-hero-media {
			max-height: none;
		}
	}

	@media (max-width: 760px) {
		padding-top: 22px;

		.asset-details h1 {
			font-size: var(--type-page-title);
		}
	}

	@media (max-width: 480px) {
		padding-top: 18px;

		.asset-details h1 {
			margin: 12px 0 10px;
			font-size: var(--type-page-title);
		}
	}
`;

export const AtomicPage = styled(Page)`
	.asset-hero-media.interactive-hero-media {
		aspect-ratio: 16 / 10;
		background: var(--fixed-ink);
	}

	.asset-detail-layout {
		grid-template-columns: minmax(0, 1.05fr) minmax(480px, 0.95fr);
		grid-template-rows: auto 1fr;
		row-gap: 0;
	}

	.asset-commerce-primary {
		grid-column: 2;
		grid-row: 1;
	}

	.asset-commerce-secondary {
		grid-column: 2;
		grid-row: 2;
	}

	.asset-visual-column {
		grid-column: 1;
		grid-row: 1 / span 2;
	}

	@media (max-width: 1050px) {
		.asset-detail-layout {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto auto auto;
			row-gap: 20px;
		}

		.asset-commerce-primary {
			grid-column: 1;
			grid-row: 1;
		}

		.asset-visual-column {
			grid-column: 1;
			grid-row: 2;
		}

		.asset-commerce-secondary {
			grid-column: 1;
			grid-row: 3;
		}

		.asset-hero-media {
			aspect-ratio: 1;
			max-height: none;
		}
	}
`;

export const FungiblePage = styled(Page)`
	.asset-detail-layout {
		grid-template-columns: minmax(520px, 1.02fr) minmax(0, 0.98fr);
		grid-template-rows: auto;
		gap: 18px;
	}

	.asset-commerce-primary {
		grid-column: 1;
		grid-row: 1;
	}

	.asset-commerce-secondary {
		grid-column: 2;
		grid-row: 1;
	}

	.asset-commerce-card {
		margin-top: 0;
	}

	.asset-commerce-actions {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.asset-commerce-actions .ui-button--primary {
		grid-column: 1 / -1;
	}

	.market-note {
		font-size: var(--type-body);
	}

	@media (max-width: 1050px) {
		.asset-detail-layout {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto auto;
			row-gap: 18px;
		}

		.asset-commerce-primary {
			grid-column: 1;
			grid-row: 1;
		}

		.asset-commerce-secondary {
			grid-column: 1;
			grid-row: 2;
		}
	}

	@media (max-width: 480px) {
		.asset-commerce-card {
			margin-top: 0;
		}
	}

	.asset-detail-layout {
		grid-template-columns: minmax(0, 45fr) minmax(0, 55fr);
		gap: clamp(22px, 2.6vw, 38px);
	}

	.asset-market-stats {
		grid-template-columns: minmax(145px, 1.6fr) repeat(2, minmax(0, 1fr)) minmax(64px, 0.7fr);
	}

	.asset-commerce-primary,
	.asset-commerce-secondary {
		min-width: 0;
	}

	.asset-commerce-primary {
		position: sticky;
		top: 82px;
		align-self: start;
	}

	.asset-detail-tabs {
		--asset-detail-tabs-header-gap: 21px;
		position: sticky;
		top: 82px;
		z-index: 20;
		background: var(--paper);
	}

	.asset-detail-tabs::before {
		content: '';
		position: absolute;
		right: 0;
		bottom: 100%;
		left: 0;
		height: var(--asset-detail-tabs-header-gap);
		background: var(--paper);
		pointer-events: none;
	}

	.asset-commerce-card {
		padding: 0;
		border: 0;
		border-radius: 0;
		background: var(--transparent);
	}

	.asset-buy-summary {
		padding: 16px;
		border: 1px solid var(--line-dark);
		border-radius: 10px;
	}

	.asset-buy-summary-empty {
		padding: 22px 24px;
	}

	@media (max-width: 1050px) {
		.asset-detail-layout {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto;
			row-gap: 24px;
		}

		.asset-commerce-primary {
			position: static;
			top: auto;
		}

		.asset-detail-tabs {
			--asset-detail-tabs-header-gap: 0px;
			top: 61px;
		}
	}
`;

export const Layout = styled.div`
	display: grid;
	grid-template-columns: minmax(0, 1.05fr) minmax(480px, 0.95fr);
	align-items: start;
	gap: clamp(34px, 4vw, 68px);

	@media (max-width: 1050px) {
		grid-template-columns: minmax(0, 1fr);
	}

	@media (max-width: 480px) {
		gap: 24px;
	}
`;

export const VisualColumn = styled.div`
	min-width: 0;
	position: sticky;
	top: 82px;

	@media (max-width: 1050px) {
		position: static;
	}
`;

export const CommerceColumn = styled.div`
	min-width: 0;
`;

export const HeroMedia = styled.div`
	position: relative;
	aspect-ratio: 1;
	display: grid;
	place-items: center;
	overflow: hidden;
	border: 1px solid var(--line);
	border-radius: 10px;
	background-color: var(--surface);
	background-image: radial-gradient(var(--line-dark) 0.75px, var(--transparent) 0.75px);
	background-size: 3px 3px;
	color: var(--accent);
	font: 400 var(--type-display) 'DM Sans', sans-serif;
	box-shadow: none;

	> img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: var(--paper);
	}

	@media (max-width: 1050px) {
		order: 1;
		max-height: 760px;
	}
`;

export const AudioPlayerFrame = styled.div`
	width: 100%;
	height: 100%;
	min-height: 0;
	padding: 22px 22px 76px;
	display: grid;
	grid-template-rows: minmax(0, 1fr) auto;
	gap: 18px;

	> img,
	> .audio-artwork {
		width: 100%;
		height: 100%;
		min-height: 0;
		object-fit: contain;
		border-radius: 8px;
		background: var(--paper);
	}
`;

export const MediaLabel = styled.div`
	position: absolute;
	left: 14px;
	right: 14px;
	bottom: 14px;
	padding: 10px 12px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	border: 1px solid var(--image-control-border);
	border-radius: 8px;
	background: var(--image-overlay-surface);
	backdrop-filter: blur(12px);
	color: var(--contrast-text);
	font-size: var(--type-small);
	z-index: 1;

	strong {
		font-family: 'DM Sans', sans-serif;
	}
`;

export const Details = styled.div`
	padding-top: clamp(4px, 2vw, 30px);

	h1 {
		margin: 14px 0 15px;
		font-size: var(--type-page-title);
		line-height: 1;
		letter-spacing: -0.025em;
	}

	@media (max-width: 1050px) {
		order: 2;
	}
`;

export const Identity = styled(Details)`
	padding: var(--space-1) 0 var(--space-4);

	@media (max-width: 480px) {
		padding-bottom: var(--space-3);
	}
`;

export const Kicker = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;

	.eyebrow {
		margin: 0;
	}

	@media (max-width: 480px) {
		align-items: flex-start;
		flex-direction: column;
		gap: 8px;
	}
`;

export const CollectionLink = styled.span`
	min-width: 0;
	color: var(--muted);
	font-size: var(--type-body);
	font-weight: 400;
	overflow-wrap: anywhere;

	&:hover {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	@media (max-width: 760px) {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
`;

export const OwnerLine = styled.div`
	display: flex;
	align-items: center;
	gap: 7px;
	color: var(--muted);
	font-size: var(--type-body);

	a,
	.wallet-address {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		color: var(--ink);
		font-weight: 400;
	}
`;

export const MarketNote = styled.p`
	margin: 14px 0 0;
	color: var(--muted);
	font-size: var(--type-small);
	line-height: 1.5;

	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
`;

export const TokenHeader = styled.header`
	min-width: 0;
	margin-bottom: 20px;
	padding: 16px 8px;
	display: grid;
	grid-template-columns: 68px minmax(0, 1fr) minmax(180px, auto);
	align-items: center;
	gap: 18px;

	@media (max-width: 760px) {
		padding-inline: 2px;
		grid-template-columns: 58px minmax(0, 1fr);
		gap: 10px 14px;
	}

	@media (max-width: 480px) {
		margin-bottom: 14px;
		padding-block: 13px;
	}
`;

export const TokenIdentity = styled.div`
	min-width: 0;
	display: grid;
	gap: 8px;
`;

export const TokenTitle = styled.div`
	min-width: 0;
	display: flex;
	align-items: baseline;
	flex-wrap: wrap;
	gap: 8px;

	h1 {
		min-width: 0;
		margin: 0;
		color: var(--ink);
		font-size: clamp(1.3rem, 2.1vw, 1.65rem);
		font-weight: 450;
		line-height: 1.05;
		letter-spacing: -0.015em;
		overflow-wrap: anywhere;
	}

	.layout-placeholder-title {
		width: min(360px, 62vw);
		height: 1.8rem;
		margin: 0;
	}

	h1:focus-visible {
		outline: 2px solid var(--coral);
		outline-offset: 5px;
		border-radius: 2px;
	}

	@media (max-width: 760px) {
		h1 {
			font-size: 1.3rem;
		}
	}
`;

export const TokenName = styled.span`
	color: var(--muted);
	font-size: 1.05rem;
	font-weight: 400;
`;

export const TokenMeta = styled.div`
	min-width: 0;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6px;

	a,
	span {
		min-height: 22px;
		padding: 3px 7px;
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--line);
		border-radius: 4px;
		color: var(--muted);
		background: var(--paper);
		font-size: var(--type-small);
		line-height: 1;
		letter-spacing: 0.025em;
	}

	a:hover {
		color: var(--ink);
		border-color: var(--line-dark);
	}

	@media (max-width: 480px) {
		gap: 4px;

		a,
		span {
			padding-inline: 5px;
		}
	}
`;

export const TokenBalance = styled.div`
	min-width: 0;
	display: grid;
	justify-items: end;
	gap: 3px;
	text-align: right;

	span {
		color: var(--muted);
		font-size: var(--type-small);
	}

	strong {
		max-width: 28ch;
		overflow: hidden;
		color: var(--ink);
		font-size: var(--type-body);
		font-weight: 550;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 760px) {
		grid-column: 2;
		justify-items: start;
		text-align: left;
	}
`;
