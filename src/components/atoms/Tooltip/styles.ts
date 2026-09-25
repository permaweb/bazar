import styled from 'styled-components';

/**
 * The surface keeps the `ui-tooltip__content` class as its stable hook: the anchor below and a few feature
 * containers reach it by that name, and the floating layer renders it through a portal outside the anchor.
 */
export const Surface = styled.span`
	position: absolute;
	z-index: 70;
	right: 0;
	width: max-content;
	max-width: min(320px, calc(88vw - 36px));
	padding: 10px 12px;
	border: 1px solid var(--line-dark);
	border-radius: 7px;
	color: var(--ink);
	background: var(--surface-subtle);
	box-shadow: 0 10px 28px var(--shadow-menu);
	font-size: var(--type-small);
	line-height: 1.45;
	overflow-wrap: anywhere;
	white-space: normal;
	opacity: 0;
	visibility: hidden;
	pointer-events: none;
	transition: opacity 120ms ease, visibility 0s linear 120ms;

	&::before,
	&::after {
		content: '';
		position: absolute;
		right: 11px;
		width: 0;
		height: 0;
		border-right: 7px solid var(--transparent);
		border-left: 7px solid var(--transparent);
	}

	&:where(.ui-tooltip__content--visible) {
		opacity: 1;
		visibility: visible;
		transition-delay: 0ms;
	}
`;

// Placement, alignment and the reveal states all read the anchor's modifier classes, so they live here and reach
// the surface by class name; `:where()` keeps each selector at the weight its stylesheet rule had.
export const Anchor = styled.span`
	position: relative;
	display: inline-flex;

	&:where(.ui-tooltip--bottom) .ui-tooltip__content {
		top: calc(100% + 9px);
	}

	&:where(.ui-tooltip--bottom) .ui-tooltip__content::before {
		top: -8px;
		border-bottom: 8px solid var(--line-dark);
	}

	&:where(.ui-tooltip--bottom) .ui-tooltip__content::after {
		top: -6px;
		right: 12px;
		border-right-width: 6px;
		border-bottom: 7px solid var(--surface-subtle);
		border-left-width: 6px;
	}

	&:where(.ui-tooltip--top) .ui-tooltip__content {
		bottom: calc(100% + 9px);
	}

	&:where(.ui-tooltip--top) .ui-tooltip__content::before {
		bottom: -8px;
		border-top: 8px solid var(--line-dark);
	}

	&:where(.ui-tooltip--top) .ui-tooltip__content::after {
		right: 12px;
		bottom: -6px;
		border-top: 7px solid var(--surface-subtle);
		border-right-width: 6px;
		border-left-width: 6px;
	}

	&:where(.ui-tooltip--align-start) .ui-tooltip__content {
		right: auto;
		left: 0;
	}

	&:where(.ui-tooltip--align-center) .ui-tooltip__content {
		right: auto;
		left: 50%;
		transform: translateX(-50%);
	}

	&:where(.ui-tooltip--align-start) .ui-tooltip__content::before,
	&:where(.ui-tooltip--align-start) .ui-tooltip__content::after {
		right: auto;
		left: 11px;
	}

	&:where(.ui-tooltip--align-start) .ui-tooltip__content::after {
		left: 12px;
	}

	&:where(.ui-tooltip--align-center) .ui-tooltip__content::before,
	&:where(.ui-tooltip--align-center) .ui-tooltip__content::after {
		right: auto;
		left: 50%;
		transform: translateX(-50%);
	}

	&:where(.ui-tooltip--floating-layer) .ui-tooltip__content {
		position: fixed;
		right: auto;
		bottom: auto;
		transform: none;
	}

	&:where(.ui-tooltip--floating-layer) .ui-tooltip__content::before {
		right: auto;
		left: calc(var(--ui-tooltip-arrow-left) - 7px);
	}

	&:where(.ui-tooltip--floating-layer) .ui-tooltip__content::after {
		right: auto;
		left: calc(var(--ui-tooltip-arrow-left) - 6px);
	}

	&:hover .ui-tooltip__content,
	&:has(> :focus-visible) .ui-tooltip__content {
		opacity: 1;
		visibility: visible;
	}

	&:hover .ui-tooltip__content {
		transition-delay: var(--ui-tooltip-delay, 0ms), var(--ui-tooltip-delay, 0ms);
	}

	&:has(> :focus-visible) .ui-tooltip__content {
		transition-delay: 0ms;
	}

	&:where(.ui-tooltip--disabled):hover .ui-tooltip__content,
	&:where(.ui-tooltip--disabled):has(> :focus-visible) .ui-tooltip__content {
		opacity: 0;
		visibility: hidden;
	}
`;
