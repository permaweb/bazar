import styled from 'styled-components';

// `html[data-theme=…]` rather than `:root[data-theme=…]`: a nested selector that starts with a colon is read as
// a pseudo-class on the component itself, which would never match the document root.
export const Mark = styled.img`
	html[data-theme='dimmed'] &,
	html[data-theme='dark'] & {
		filter: invert(1);
	}
`;
