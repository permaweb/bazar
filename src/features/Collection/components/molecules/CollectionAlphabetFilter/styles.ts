import styled from 'styled-components';

import { Button } from 'components/atoms/Button';

// On narrow viewports the strip scrolls under two edge controls, with a fade under each of them.
export const Shell = styled.div`
	position: relative;
	margin: -14px 0 20px;

	@media (max-width: 480px) {
		margin-top: -8px;
		margin-right: -14px;

		&::before,
		&::after {
			content: '';
			position: absolute;
			z-index: 1;
			top: 0;
			bottom: 2px;
			width: 30px;
			pointer-events: none;
		}

		&::before {
			left: 44px;
			background: linear-gradient(90deg, var(--paper), var(--transparent));
		}

		&::after {
			right: 44px;
			background: linear-gradient(270deg, var(--paper), var(--transparent));
		}

		&.at-start::before,
		&.at-end::after {
			display: none;
		}
	}
`;

export const Filter = styled.nav`
	padding-bottom: 2px;
	display: flex;
	gap: 4px;
	overflow-x: auto;
	scrollbar-width: thin;

	button {
		width: 30px;
		min-width: 30px;
		min-height: 30px;
		padding: 0;
		border-color: var(--line);
		border-radius: 5px;
		color: var(--muted);
		background: var(--paper);
		font-size: var(--type-small);
	}

	button:first-child {
		width: 38px;
		min-width: 38px;
	}

	button:hover:not(:disabled),
	button.active {
		color: var(--ink);
		border-color: var(--line-dark);
		background: var(--button-accent);
	}

	@media (max-width: 480px) {
		margin: 0;
		padding-right: 14px;
		scroll-padding-inline: 58px;
		scrollbar-width: none;

		button,
		button:first-child {
			width: 44px;
			min-width: 44px;
			min-height: 44px;
		}

		&::-webkit-scrollbar {
			display: none;
		}
	}
`;

export const Scroll = styled(Button)`
	display: none;

	@media (max-width: 480px) {
		position: absolute;
		z-index: 2;
		top: 0;
		width: 44px;
		min-width: 44px;
		min-height: 44px;
		padding: 0;
		display: inline-grid;
		place-items: center;
		border-color: var(--line-dark);
		border-radius: 5px;
		color: var(--ink);
		background: color-mix(in srgb, var(--paper) 94%, var(--transparent));
		box-shadow: 0 4px 14px var(--shadow-floating);

		svg {
			width: 15px;
			height: 15px;
		}

		&.alphabet-scroll-previous {
			left: 0;
		}

		&.alphabet-scroll-next {
			right: 0;
		}
	}
`;
