import styled, { keyframes } from 'styled-components';

import { Button } from '../Button';

const menuIn = keyframes`
	from {
		opacity: 0;
		transform: translateY(-3px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
`;

export const Root = styled.div`
	position: relative;
	display: grid;
	gap: 5px;
	min-width: 152px;

	@media (max-width: 760px) {
		width: 100%;
		min-width: 0;
	}
`;

export const Label = styled.span`
	color: var(--muted-subtle);
	font: 400 var(--type-small) 'DM Sans', sans-serif;
`;

export const Trigger = styled(Button)`
	width: 100%;
	min-height: 40px;
	padding: 9px 10px 9px 12px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	border: 1px solid var(--line-dark);
	border-radius: 7px;
	color: var(--ink);
	background: var(--paper);
	cursor: pointer;
	font-size: var(--type-body);
	font-weight: 400;
	text-align: left;
	transition: background 120ms ease, border-color 120ms ease;

	/*
	 * A container that restyles the trigger (the collection market tools) still wins these ties: its rule weighs
	 * the same, and its module imports this atom, so styled-components emits its rules after these.
	 */
	&:hover,
	&.open {
		border-color: var(--line-dark);
		background: var(--surface-subtle);
	}

	&:focus-visible {
		border-color: var(--muted-subtle);
		box-shadow: 0 0 0 3px var(--focus-strong);
		outline: none;
	}

	@media (max-width: 480px) {
		min-height: 44px;
	}

	svg {
		width: 14px;
		height: 14px;
		flex: 0 0 auto;
		color: var(--muted-subtle);
		transition: transform 120ms ease;
	}

	&.open svg {
		transform: rotate(180deg);
	}

	@media (max-width: 760px) {
		width: 100%;
		min-width: 0;
	}

	/* The shared narrow-viewport touch target the global stylesheet still applies to other controls. */
	@media (max-width: 480px) {
		min-height: 44px;
	}
`;

export const Menu = styled.div`
	position: absolute;
	top: calc(100% + 6px);
	right: 0;
	z-index: 70;
	min-width: 190px;
	padding: 5px;
	display: grid;
	gap: 1px;
	overflow: hidden;
	border: 1px solid var(--line);
	border-radius: 9px;
	background: var(--paper);
	box-shadow: 0 12px 32px var(--shadow-menu);
	animation: ${menuIn} 120ms ease-out;

	@media (max-width: 760px) {
		left: 0;
		right: auto;
		width: max(100%, 190px);
	}
`;

export const Option = styled(Button)`
	min-height: 36px;
	padding: 8px 9px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 14px;
	border: 0;
	border-radius: 5px;
	color: var(--muted);
	background: var(--transparent);
	cursor: pointer;
	font-size: var(--type-body);
	font-weight: 400;
	text-align: left;

	&:hover,
	&:focus-visible,
	&.active {
		color: var(--ink);
		background: var(--surface-subtle);
		outline: none;
	}

	@media (max-width: 480px) {
		min-height: 44px;
	}

	svg {
		width: 14px;
		height: 14px;
		flex: 0 0 auto;
		color: var(--muted-subtle);
	}

	@media (max-width: 480px) {
		min-height: 44px;
	}
`;
