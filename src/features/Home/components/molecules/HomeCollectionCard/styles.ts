import { Link } from 'react-router-dom';
import styled from 'styled-components';

export const Card = styled(Link)`
	min-width: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	border: 1px solid var(--home-line);
	border-radius: 0;
	background: var(--paper);
	box-shadow: none;
	aspect-ratio: 1 / 1;
	content-visibility: auto;
	contain-intrinsic-size: 420px;
	transition: background 100ms ease, border-color 100ms ease;

	&:hover {
		transform: none;
		border-color: var(--line-dark);
		background: var(--panel);
	}

	&:hover .home-feature-art > img {
		transform: none;
		opacity: 0.94;
	}

	&:hover .home-card-action {
		border-color: var(--button-accent-hover);
		color: var(--ink);
		background: var(--button-accent-hover);
	}

	&.feature-1 .home-image-collection-fallback {
		background: radial-gradient(circle at 75% 24%, var(--gradient-blue), var(--transparent) 27%),
			radial-gradient(circle at 24% 77%, var(--gradient-coral-soft), var(--transparent) 32%),
			var(--surface-subtle);
	}

	@media (max-width: 600px) {
		aspect-ratio: auto;
	}
`;

export const FeatureArt = styled.div`
	height: clamp(150px, 10vw, 220px);
	position: relative;
	flex: 1 1 auto;
	min-height: 0;
	overflow: hidden;
	container-type: size;
	border-bottom: 1px solid var(--home-line);
	border-radius: 0;
	background: var(--panel);

	> img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
		filter: none;
		transition: opacity 100ms ease;
	}

	.names-cube-preview img {
		object-fit: cover;
	}

	/* The token avatar sizes itself from this container's query units. */
	.home-token-collection-art {
		--token-avatar-size: min(62cqw, 62cqh, 240px);
	}

	> .home-token-collection-art {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	@media (max-width: 1050px) {
		height: 230px;
	}

	@media (max-width: 600px) {
		flex: 0 0 auto;
	}

	@media (max-width: 480px) {
		height: 190px;
	}
`;

export const Glow = styled.div`
	display: none;
`;

export const ImageFallback = styled.span`
	width: 100%;
	height: 100%;
	padding: 24px;
	display: grid;
	place-content: center;
	justify-items: center;
	gap: 8px;
	overflow: hidden;
	position: relative;
	background: radial-gradient(circle at 74% 26%, var(--gradient-coral), var(--transparent) 27%),
		radial-gradient(circle at 22% 78%, var(--gradient-purple), var(--transparent) 31%), var(--surface-subtle);
	color: var(--ink);
	text-align: center;

	img {
		width: 42px;
		height: auto;
	}

	strong {
		max-width: 24ch;
		font-size: var(--type-display);
		overflow-wrap: anywhere;
	}

	small {
		color: var(--muted);
		font-size: var(--type-small);
		font-weight: 400;
	}
`;

export const NameArt = styled.div`
	width: 100%;
	height: 100%;
	display: grid;
	place-items: center;
	position: relative;
	background: radial-gradient(circle at 75% 28%, var(--gradient-coral-strong), var(--transparent) 27%),
		radial-gradient(circle at 25% 78%, var(--gradient-blue-soft), var(--transparent) 31%), var(--panel);

	img {
		width: 35%;
		height: auto;
		display: block;
		opacity: 0.88;
	}

	span {
		position: absolute;
		right: 8%;
		bottom: -13%;
		color: color-mix(in srgb, var(--ink) 6%, var(--transparent));
		font-size: var(--type-display);
		font-weight: 400;
		letter-spacing: -0.1em;
	}
`;

export const Copy = styled.div`
	padding: 18px 18px 12px;

	h2 {
		margin: 0;
		color: var(--ink);
		text-shadow: none;
		font-size: 1.5rem;
		letter-spacing: 0.01em;
		font-weight: 400;
	}

	> span {
		min-height: 3em;
		max-height: 3em;
		margin-top: 6px;
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		color: var(--muted);
		font-size: var(--type-body);
		line-height: 1.5;
	}

	@media (max-width: 480px) {
		padding: 14px 14px 10px;

		> span {
			min-height: 0;
		}
	}
`;

export const Stats = styled.div`
	margin: 0;
	padding: 13px 18px 15px;
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
	border-top: 1px solid var(--home-line);

	div {
		display: grid;
		gap: 2px;
	}

	span {
		color: var(--muted-subtle);
		font-size: var(--type-small);
	}

	strong {
		overflow: hidden;
		color: var(--ink);
		font-size: var(--type-body);
		font-weight: 400;
		text-overflow: ellipsis;
	}

	strong.listed {
		color: var(--positive-text);
	}

	/* The pending placeholder keeps the stat's own font; it beat the label rule above in the
	 * stylesheet's original order, so state that here rather than rely on injection order. */
	.home-market-value-pending > span {
		font: inherit;
	}

	@media (max-width: 480px) {
		padding: 11px 14px 13px;
	}
`;

export const CardAction = styled.strong`
	width: 100%;
	min-height: 44px;
	margin: auto 0 0;
	padding: 0 18px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	border: 0;
	border-top: 1px solid var(--button-accent-hover);
	border-radius: 0;
	color: var(--ink);
	background: var(--button-accent);
	font-size: var(--type-body);
	font-weight: 400;

	span {
		width: 14px;
		height: 14px;
		display: grid;
		place-items: center;
		border-radius: 3px;
		background: var(--transparent);
	}

	@media (max-width: 480px) {
		padding-inline: 14px;
	}
`;
