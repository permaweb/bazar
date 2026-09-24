import styled, { css } from 'styled-components';

const ghostSurface = css`
	border: 1px solid var(--home-line);
	background: radial-gradient(circle at 50% 42%, var(--ghost-glow), var(--transparent) 34%), var(--panel);
`;

export const Ghost = styled.div`
	min-width: 0;
	min-height: 220px;
	padding: 28px;
	display: grid;
	place-content: center;
	justify-items: center;
	gap: 8px;
	overflow: hidden;
	border-radius: 10px;
	color: var(--home-muted);
	text-align: center;
	${ghostSurface}

	> svg {
		width: 22px;
		height: 22px;
		margin-bottom: 3px;
		animation: spin 0.8s linear infinite;
	}

	> strong {
		color: var(--ink);
		font-size: var(--type-body);
		font-weight: 400;
	}

	> span {
		max-width: 24ch;
		color: var(--home-muted);
		font-size: var(--type-small);
		line-height: 1.4;
		white-space: normal;
	}

	/* The collection variant sits in the feature grid, so it also carries the card surface: the
	 * declarations below are the ones .home-feature-card contributed on top of the ghost. */
	&.home-feature-card {
		flex-direction: column;
		border-radius: 0;
		box-shadow: none;
		aspect-ratio: 1 / 1;
		content-visibility: auto;
		contain-intrinsic-size: 420px;
		transition: background 100ms ease, border-color 100ms ease;

		@media (max-width: 600px) {
			aspect-ratio: auto;
		}
	}

	&.home-feature-card:hover {
		transform: none;
		border-color: var(--home-line);
		background: radial-gradient(circle at 50% 42%, var(--ghost-glow), var(--transparent) 34%), var(--panel);
	}
`;
