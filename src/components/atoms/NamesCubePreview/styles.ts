import styled from 'styled-components';

export const Preview = styled.span`
	grid-column: 1 / -1;
	width: 100%;
	height: 100%;
	display: block;
	overflow: hidden;
	background: var(--surface-hover);

	img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: contain;
	}
`;
