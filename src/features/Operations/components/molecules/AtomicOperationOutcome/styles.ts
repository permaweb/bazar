import styled, { css } from 'styled-components';

import { ArtworkImage } from 'components/atoms/ArtworkImage';

/** Both the image and its initial-letter fallback carry `.operation-outcome-subject-artwork`. */
const subjectArtwork = css`
	width: 100%;
	height: 100%;
	display: grid;
	place-items: center;
	border: 1px solid var(--line);
	border-radius: 9px;
	background: var(--panel);
	object-fit: cover;
`;

export const SubjectArtwork = styled(ArtworkImage)`
	${subjectArtwork}
`;

export const SubjectArtworkFallback = styled.span`
	${subjectArtwork}
	color: var(--muted);
	font-size: var(--type-display);
`;
