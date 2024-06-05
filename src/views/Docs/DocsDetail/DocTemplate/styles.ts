import styled from 'styled-components';

import { fadeIn2, open } from 'helpers/animations';
import { STYLING } from 'helpers/config';

export const Wrapper = styled.div<{ isView: boolean }>`
	width: ${(props) => (props.isView ? 'calc(100% - 300px)' : '100%')};
	padding: ${(props) => (props.isView ? '0 0 0 30px' : '0')};
	animation: ${open} ${fadeIn2};
	margin: 0 0 0 auto;

	@media (max-width: ${STYLING.cutoffs.initial}) {
		width: 100%;
		padding: 0;
		margin: 70px 0 0 0;
	}

	h1,
	h2,
	h3,
	h4,
	h5,
	h6 {
		font-size: clamp(32px, 3.75vw, 44px) !important;
		font-weight: ${(props) => props.theme.typography.weight.bold} !important;
		font-family: ${(props) => props.theme.typography.family.primary} !important;
		color: ${(props) => props.theme.colors.font.primary.alt1} !important;
		margin: 0 0 20px 0;
		line-height: 1.5 !important;
	}

	h2,
	h3,
	h4,
	h5,
	h6 {
		margin: 25px 0px 10px 0;
	}

	h2 {
		font-size: clamp(22px, 3.05vw, 34px) !important;
		scroll-margin-top: 100px;
		a {
			font-size: clamp(22px, 3.05vw, 34px) !important;
		}
	}
	h3 {
		font-size: clamp(18px, 2.05vw, 24px) !important;
	}
	h4 {
		margin: 20px 0 10px 0;
	}
	h4,
	h5,
	h6 {
		font-size: clamp(13px, 1.95vw, 18px) !important;
	}

	strong,
	b {
		font-weight: ${(props) => props.theme.typography.weight.xBold} !important;
	}

	p,
	span,
	li,
	div,
	pre {
		font-size: ${(props) => props.theme.typography.size.base} !important;
		font-weight: ${(props) => props.theme.typography.weight.regular} !important;
		font-family: ${(props) => props.theme.typography.family.primary} !important;
		color: ${(props) => props.theme.colors.font.primary.alt1} !important;
		line-height: 1.65 !important;
		margin: 20px 0;
	}

	a {
		font-size: ${(props) => props.theme.typography.size.base} !important;
		text-decoration: underline;
	}

	ul {
		li {
			list-style-type: none;
			padding-left: 1em;
			position: relative;

			&::before {
				content: '\u2022';
				position: absolute;
				left: 0;
				text-align: center;
			}
		}
	}

	ol {
		counter-reset: my-counter;
		li {
			list-style-type: none;
			padding-left: 1em;
			position: relative;

			&::before {
				counter-increment: my-counter;
				content: counter(my-counter) '. ';
				position: absolute;
				left: 0;
				text-align: center;
			}
		}
	}

	a {
		color: ${(props) => props.theme.colors.font.primary.alt4};
		&:hover {
			text-decoration-thickness: 1.65px;
		}
	}

	code {
		padding: 2.5px 10px !important;
		background: ${(props) => props.theme.colors.container.alt3.background} !important;
		border-radius: ${STYLING.dimensions.radius.primary} !important;
		color: ${(props) => props.theme.colors.font.primary.alt1} !important;
		font-weight: ${(props) => props.theme.typography.weight.regular} !important;
		font-size: ${(props) => props.theme.typography.size.small} !important;
	}

	pre {
		padding: 10px !important;
		background: ${(props) => props.theme.colors.container.alt3.background} !important;
		border-radius: ${STYLING.dimensions.radius.primary} !important;
		overflow: auto;
		code {
			padding: 0 !important;
			background: ${(props) => props.theme.colors.transparent} !important;
			color: ${(props) => props.theme.colors.font.primary.alt1} !important;
			font-weight: ${(props) => props.theme.typography.weight.regular} !important;
			font-size: ${(props) => props.theme.typography.size.small} !important;
			border-radius: 0 !important;
			line-height: 1.5 !important;
		}
	}

	img {
		width: 100%;
		max-width: 700px;
		background: ${(props) => props.theme.colors.container.primary.background};
		border: 1px solid ${(props) => props.theme.colors.border.primary};
		border-radius: ${STYLING.dimensions.radius.primary};
		margin: 30px 0 0 0;
	}
`;

export const CodeBlock = styled.div`
	display: flex;
	justify-content: space-between;
	position: relative;
	margin: 0 !important;

	pre,
	code {
		padding: 0 !important;
		margin: 0 !important;
		background: ${(props) => props.theme.colors.transparent} !important;
		border: 1px solid ${(props) => props.theme.colors.transparent} !important;
		color: ${(props) => props.theme.colors.font.primary.alt1} !important;
		font-weight: ${(props) => props.theme.typography.weight.regular} !important;
		font-size: ${(props) => props.theme.typography.size.small} !important;
		border-radius: 0 !important;
		line-height: 1.5 !important;
	}

	div {
		margin: 0 !important;
	}

	button {
		margin: 1.5px 0 0 10px !important;
	}
`;

export const CopyIcon = styled.button<{
	dimensions: { wrapper: number; icon: number } | undefined;
}>`
	height: ${(props) => (props.dimensions ? `${props.dimensions.wrapper.toString()}px` : `32.5px`)};
	min-width: ${(props) => (props.dimensions ? `${props.dimensions.wrapper.toString()}px` : `32.5px`)};
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 2.5px 0 0 0;
	background: ${(props) => props.theme.colors.button.alt1.background};
	border-radius: ${STYLING.dimensions.radius.primary};
	position: relative;

	border: none;
	padding: 0;
	font: inherit;

	&:focus {
		outline: none;
		svg {
			opacity: ${(props) => (props.disabled ? '1' : '0.75')};
		}
	}

	&:hover {
		background: ${(props) => props.theme.colors.button.alt1.hover};
	}

	svg {
		height: ${(props) => (props.dimensions ? `${props.dimensions.icon.toString()}px` : `17.5px`)};
		width: ${(props) => (props.dimensions ? `${props.dimensions.icon.toString()}px` : `17.5px`)};
		fill: ${(props) => props.theme.colors.button.alt1.label};
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);

		&:hover {
			cursor: ${(props) => (props.disabled ? 'default' : 'pointer')};
			opacity: 1;
		}
	}

	&:disabled {
		background: ${(props) => props.theme.colors.button.alt1.disabled.background};
		color: ${(props) => props.theme.colors.button.alt1.disabled.label};
		svg {
			fill: ${(props) => props.theme.colors.button.alt1.disabled.label};
		}
	}
`;
