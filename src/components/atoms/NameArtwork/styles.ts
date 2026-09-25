import styled from 'styled-components';

export const Artwork = styled.span`
	position: relative;
	width: 100%;
	height: 100%;
	display: block;
	container-type: inline-size;
	overflow: hidden;
	color: var(--muted);
	background-color: var(--surface);

	&::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		background-image: radial-gradient(var(--name-dot) 0.75px, var(--transparent) 0.75px);
		background-size: 3px 3px;
		background-position: -1.5px -1.5px;
		pointer-events: none;
	}

	> strong {
		position: absolute;
		z-index: 1;
		top: 50%;
		left: 7%;
		right: 7%;
		overflow: visible;
		color: var(--muted);
		font-size: var(--type-display);
		font-weight: 400;
		line-height: 0.95;
		text-align: center;
		text-overflow: clip;
		white-space: nowrap;
		transform: translateY(-50%);
	}
`;
