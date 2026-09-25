import styled from 'styled-components';

export const Page = styled.section`
	padding: var(--space-6) 0 var(--space-8);

	> .back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
`;

export const Layout = styled.div`
	margin-top: var(--space-5);
	display: grid;
	grid-template-columns: minmax(240px, 0.72fr) minmax(0, 1fr);
	gap: clamp(28px, 5vw, 72px);
	align-items: start;

	@media (max-width: 760px) {
		grid-template-columns: 1fr;
	}
`;

export const Artwork = styled.div`
	aspect-ratio: 1;
	overflow: hidden;
	display: grid;
	place-items: center;
	border: 1px solid var(--line);
	border-radius: 12px;
	background: var(--panel);

	img,
	.audio-artwork {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	> .token-artwork {
		font-size: clamp(2rem, 6vw, 5rem);
	}

	@media (max-width: 760px) {
		max-width: 420px;
	}
`;

export const ArtworkFallback = styled.span`
	color: var(--muted);
	font-size: var(--type-display);
`;

export const Copy = styled.div`
	min-width: 0;
	display: grid;
	gap: 14px;

	h1,
	p {
		margin: 0;
	}

	> p:not(.eyebrow):not(.mint-pending-gateway) {
		color: var(--muted);
		line-height: 1.5;
	}
`;

export const Phases = styled.ol`
	margin: 6px 0;
	padding: 0;
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	list-style: none;

	li {
		position: relative;
		display: grid;
		gap: 7px;
		color: var(--muted-subtle);
		font-size: var(--type-small);
	}

	li::before {
		content: '';
		position: absolute;
		top: 13px;
		right: 0;
		left: 28px;
		height: 1px;
		background: var(--line-dark);
	}

	li:last-child::before {
		display: none;
	}

	li > span {
		width: 26px;
		height: 26px;
		z-index: 1;
		display: grid;
		place-items: center;
		border: 1px solid var(--line-dark);
		border-radius: 50%;
		background: var(--paper);
	}

	li > span svg {
		width: 14px;
		height: 14px;
	}

	li.reached {
		color: var(--ink);
	}

	li.reached > span {
		border-color: var(--ink);
		background: var(--ink);
		color: var(--paper);
	}

	@media (max-width: 760px) {
		grid-template-columns: 1fr;
		gap: 9px;

		li {
			grid-template-columns: 26px 1fr;
			align-items: center;
		}

		li::before {
			top: 26px;
			bottom: -9px;
			left: 13px;
			width: 1px;
			height: auto;
		}
	}
`;

export const GatewayNote = styled.p`
	padding: 10px 12px;
	border: 1px solid var(--line);
	border-radius: 8px;
	background: var(--panel);
	color: var(--muted);
	font-size: var(--type-small);
	line-height: 1.45;
`;

export const Actions = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 8px;

	a,
	button {
		min-height: 40px;
		padding: 0 13px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		border: 1px solid var(--line-dark);
		border-radius: 7px;
		background: var(--button-accent);
		color: var(--ink);
		font-size: var(--type-body);
	}

	button:disabled {
		cursor: wait;
		opacity: 0.62;
	}
`;
