import styled from 'styled-components';

/**
 * `.collection-title` and `.collection-market-header` always sit on the same element, so their rules are
 * consolidated here in stylesheet order and only the winning declarations are kept. `.collection-market-header`
 * came last, so it also beat the 760px `align-items`/`gap`, the whole 480px block and the 480px heading size,
 * which are dropped rather than moved: a media block is emitted after the block's own declarations, so moving
 * them would flip the result. The stylesheet paired every rule with `.section-heading`, a class no component
 * renders any more; only the `.collection-title` half moved.
 */
export const Header = styled.div`
	display: grid;
	grid-template-columns: minmax(260px, 1.35fr) minmax(460px, 1fr) auto;
	justify-content: space-between;
	align-items: center;
	gap: 24px;
	margin-bottom: 18px;

	h1 {
		margin: 0;
		font-size: clamp(1.25rem, 2vw, 1.75rem);
		line-height: 1.1;
		letter-spacing: -0.02em;
	}

	> p {
		max-width: 500px;
		color: var(--muted);
		line-height: 1.6;
		margin: 0;
	}

	.eyebrow {
		margin-bottom: 3px;
	}

	.collection-description {
		max-width: 48ch;
		margin-top: 6px;
	}

	.collection-description > p {
		font-size: var(--type-small);
		-webkit-line-clamp: 1;
		line-clamp: 1;
	}

	@media (max-width: 760px) {
		flex-direction: column;
	}

	@media (max-width: 480px) {
		> p {
			font-size: var(--type-body);
			line-height: 1.55;
		}
	}

	@media (max-width: 1180px) {
		grid-template-columns: minmax(260px, 1fr) minmax(400px, 1fr);
	}

	@media (max-width: 900px) {
		grid-template-columns: minmax(0, 1fr);
	}

	@media (max-width: 600px) {
		gap: 14px;
	}
`;

export const Identity = styled.div`
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 14px;
`;

export const Avatar = styled.div`
	width: 58px;
	height: 58px;
	flex: 0 0 auto;
	display: grid;
	place-items: center;
	overflow: hidden;
	border: 1px solid var(--line-dark);
	border-radius: 50%;
	background: var(--surface);
	font: 400 var(--type-display) 'DM Sans', sans-serif;

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	@media (max-width: 600px) {
		width: 48px;
		height: 48px;
	}
`;

export const HeadingCopy = styled.div`
	min-width: 0;
	flex: 1;
`;

export const TitleCopy = styled.div`
	display: flex;
	align-items: flex-end;
	flex-direction: column;
	gap: 16px;
	grid-column: 3;
	grid-row: 1;

	> p {
		margin: 0;
	}

	@media (max-width: 1180px) {
		display: none;
	}
`;

export const Stats = styled.div`
	min-width: 0;
	display: grid;
	grid-column: 2;
	grid-row: 1;
	grid-template-columns: repeat(4, minmax(88px, 1fr));
	gap: 18px;

	> div {
		min-width: 0;
		display: grid;
		gap: 3px;
	}

	span {
		overflow: hidden;
		color: var(--muted-subtle);
		font-size: var(--type-small);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		overflow: hidden;
		font-size: var(--type-body);
		font-weight: 400;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 1180px) {
		grid-column: 2;
	}

	@media (max-width: 900px) {
		grid-column: 1;
		grid-row: 2;
	}

	@media (max-width: 600px) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px 18px;
	}
`;
