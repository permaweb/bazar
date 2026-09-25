import styled from 'styled-components';

import { ArtworkImage } from '../ArtworkImage';

// `--token-avatar-size` stays a custom property so callers (market rows, dialog headings, the discover grid)
// keep resizing the avatar from their own rules without knowing how it is built.
export const Avatar = styled.span`
	--token-avatar-size: 100%;
	position: relative;
	isolation: isolate;
	width: var(--token-avatar-size);
	height: var(--token-avatar-size);
	max-width: 100%;
	aspect-ratio: 1;
	flex: 0 0 auto;
	display: grid;
	place-items: center;
	overflow: hidden;
	border: 1px solid var(--line-dark);
	border-radius: 50%;
	color: var(--ink);
	background: var(--transparent);
	container-type: inline-size;

	strong {
		position: relative;
		z-index: 1;
		width: 78%;
		overflow: hidden;
		color: var(--ink);
		font: 400 18cqw / 1 'DM Sans', sans-serif;
		letter-spacing: 0;
		text-align: center;
		text-overflow: clip;
		white-space: nowrap;
	}

	&.ticker-long strong {
		font-size: 18cqw;
		letter-spacing: 0;
	}

	&.ticker-8 strong {
		font-size: 16cqw;
		letter-spacing: -0.01em;
	}

	> .artwork-fallback {
		width: 100%;
		height: 100%;
		border: 0;
		border-radius: inherit;
		object-fit: cover;
	}
`;

export const Image = styled(ArtworkImage)`
	width: 100%;
	height: 100%;
	border: 0;
	border-radius: inherit;
	object-fit: cover;
`;
