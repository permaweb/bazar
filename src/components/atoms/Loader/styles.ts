import styled from 'styled-components';

import { loaderKeyFrame } from 'helpers/animations';

export const Wrapper = styled.div`
	height: 100%;
	width: 100%;
	position: fixed;
	z-index: 11;
	top: 0;
	left: 0;
	background: ${(props) => props.theme.colors.view.background};
`;

export const Container = styled.div<{ relative: boolean; noPosition?: boolean }>`
	height: ${(props) => (props.noPosition ? 'auto' : '50px')};
	width: ${(props) => (props.noPosition ? 'auto' : '50px')};
	position: ${(props) => (props.noPosition ? 'static' : props.relative ? 'relative' : 'fixed')};
	top: ${(props) => (props.noPosition ? 'auto' : props.relative ? 'auto' : '50%')};
	left: ${(props) => (props.noPosition ? 'auto' : props.relative ? 'auto' : '50%')};
	transform: ${(props) => (props.noPosition ? 'none' : props.relative ? 'translate(0, 0)' : 'translate(-50%, -50%)')};
	margin: ${(props) => (props.noPosition ? '7.5px 0 0 0' : props.relative ? 'auto' : '0')};
	z-index: 3;
`;

export const Blade = styled.div<{ noPosition?: boolean }>`
	background-color: ${(props) =>
		props.noPosition ? props.theme.colors.font.light3 : props.theme.colors.loader.primary};
	position: absolute;
	left: 0.4629em;
	bottom: 0;
	border-radius: 12px;
	transform-origin: center -0.2222em;
	-webkit-animation: ${loaderKeyFrame} 0.75s linear infinite;
	animation: ${loaderKeyFrame} 0.75s linear infinite;
`;
export const Spinner = styled.div<{
	size: number;
	height: number;
	width: number;
	noPosition?: boolean;
}>`
	font-size: ${(props) => `${props.size.toString()}px`};
	position: relative;
	display: inline-block;
	width: 1em;
	height: 1em;
	position: ${(props) => (props.noPosition ? 'relative' : 'absolute')};
	left: ${(props) => (props.noPosition ? 'auto' : '0')};
	right: ${(props) => (props.noPosition ? 'auto' : '0')};
	top: ${(props) => (props.noPosition ? 'auto' : '0')};
	bottom: ${(props) => (props.noPosition ? 'auto' : '0')};
	margin: ${(props) => (props.noPosition ? '0' : 'auto')};
	& ${Blade}:nth-child(1) {
		transform: rotate(0deg);
		animation-delay: -0.6875s;
		height: ${(props) => `${props.height.toString()}px`};
		width: ${(props) => `${props.width.toString()}px`};
	}
	& ${Blade}:nth-child(2) {
		transform: rotate(30deg);
		animation-delay: -0.625s;
		height: ${(props) => `${props.height.toString()}px`};
		width: ${(props) => `${props.width.toString()}px`};
	}
	& ${Blade}:nth-child(3) {
		transform: rotate(60deg);
		animation-delay: -0.5625s;
		height: ${(props) => `${props.height.toString()}px`};
		width: ${(props) => `${props.width.toString()}px`};
	}
	& ${Blade}:nth-child(4) {
		transform: rotate(90deg);
		animation-delay: -0.5s;
		height: ${(props) => `${props.height.toString()}px`};
		width: ${(props) => `${props.width.toString()}px`};
	}
	& ${Blade}:nth-child(5) {
		transform: rotate(120deg);
		animation-delay: -0.4375s;
		height: ${(props) => `${props.height.toString()}px`};
		width: ${(props) => `${props.width.toString()}px`};
	}
	& ${Blade}:nth-child(6) {
		transform: rotate(150deg);
		animation-delay: -0.375s;
		height: ${(props) => `${props.height.toString()}px`};
		width: ${(props) => `${props.width.toString()}px`};
	}
	& ${Blade}:nth-child(7) {
		transform: rotate(180deg);
		animation-delay: -0.3125s;
		height: ${(props) => `${props.height.toString()}px`};
		width: ${(props) => `${props.width.toString()}px`};
	}
	& ${Blade}:nth-child(8) {
		transform: rotate(210deg);
		animation-delay: -0.25s;
		height: ${(props) => `${props.height.toString()}px`};
		width: ${(props) => `${props.width.toString()}px`};
	}
	& ${Blade}:nth-child(9) {
		transform: rotate(240deg);
		animation-delay: -0.1875s;
		height: ${(props) => `${props.height.toString()}px`};
		width: ${(props) => `${props.width.toString()}px`};
	}
	& ${Blade}:nth-child(10) {
		transform: rotate(270deg);
		animation-delay: -0.125s;
		height: ${(props) => `${props.height.toString()}px`};
		width: ${(props) => `${props.width.toString()}px`};
	}
	& ${Blade}:nth-child(11) {
		transform: rotate(300deg);
		animation-delay: -0.0625s;
		height: ${(props) => `${props.height.toString()}px`};
		width: ${(props) => `${props.width.toString()}px`};
	}
	& ${Blade}:nth-child(12) {
		transform: rotate(330deg);
		animation-delay: 0s;
		height: ${(props) => `${props.height.toString()}px`};
		width: ${(props) => `${props.width.toString()}px`};
	}
`;

export const Placeholder = styled.div`
	height: 100%;
	width: 100%;
	position: relative;
	background: ${(props) => props.theme.colors.container.alt1.background};
`;

export const MessageWrapper = styled.div`
	max-width: 90vw;
	padding: 11.5px 40px !important;
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 20px;
	border: none !important;

	span {
		font-size: ${(props) => props.theme.typography.size.xSmall} !important;
	}
`;
