import styled from 'styled-components';

// `is-loading` keeps its `!important`: the fallback grid below and several media wrappers set `opacity` on the
// same element, and the fade-in must win until the decoded image is ready.
export const Image = styled.img`
	transition: opacity 180ms ease;

	&.is-loading {
		opacity: 0 !important;
	}
`;

export const Fallback = styled.span`
	width: 100%;
	height: 100%;
	display: grid;
	place-content: center;
	justify-items: center;
	gap: 7px;
	color: var(--muted);
	background: var(--surface-subtle);
	font-family: 'DM Sans', sans-serif;
	font-size: var(--type-small);

	> svg {
		width: 22px;
		height: 22px;
		stroke-width: 1.4;
	}

	> small {
		font-size: inherit;
	}
`;
