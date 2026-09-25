import styled from 'styled-components';

export const Portal = styled.svg`
	overflow: visible;
	fill: none;
	stroke: currentColor;
	stroke-linecap: round;
	stroke-linejoin: round;
`;

export const Glow = styled.path`
	fill: currentColor;
	stroke: none;
	opacity: 0.09;
`;

export const Door = styled.path`
	opacity: 0.7;
`;

export const Twinkle = styled.path`
	transform-box: fill-box;
	transform-origin: center;
	opacity: 0;
`;
