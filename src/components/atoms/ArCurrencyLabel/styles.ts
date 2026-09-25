import styled from 'styled-components';

export const Label = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 3px;
	vertical-align: -0.14em;
	white-space: nowrap;

	img {
		width: 1em;
		height: 1em;
		flex: 0 0 auto;
		display: block;
		aspect-ratio: auto;
		border: 0;
		border-radius: 0;
		background: var(--transparent);
		object-fit: contain;
		transition: none;
	}

	/*
	 * html[data-theme=…] rather than :root[data-theme=…]: a nested selector that starts with a colon is read as a
	 * pseudo-class on the component itself, which would never match the document root.
	 */
	html[data-theme='dimmed'] & img,
	html[data-theme='dark'] & img {
		filter: invert(1);
	}
`;
