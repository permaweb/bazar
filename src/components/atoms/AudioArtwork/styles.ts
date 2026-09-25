import styled from 'styled-components';

export const Artwork = styled.span`
	width: 100%;
	height: 100%;
	min-width: 0;
	min-height: 0;
	display: grid;
	place-content: center;
	justify-items: center;
	gap: 8px;
	color: var(--ink);
	background-color: var(--surface);
	background-image: radial-gradient(var(--line-dark) 0.7px, var(--transparent) 0.7px);
	background-size: 3px 3px;

	svg {
		width: clamp(32px, 11%, 62px);
		height: auto;
		stroke-width: 1.25;
		color: var(--accent);
	}

	strong {
		font-size: var(--type-body);
		font-weight: 400;
	}

	small {
		color: var(--muted);
		font-size: var(--type-small);
	}
`;
