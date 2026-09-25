import styled, { keyframes } from 'styled-components';

import { PortalIcon } from 'components/atoms/PortalIcon';
import { Tooltip } from 'components/atoms/Tooltip';

/** Only the gateway trigger and apply button animate the portal glyph's twinkles. */
const portalIconTwinkle = keyframes`
	0%,
	100% {
		transform: scale(0.65) rotate(0deg);
		opacity: 0.28;
	}
	50% {
		transform: scale(1.18) rotate(90deg);
		opacity: 1;
	}
`;

export const PortalGlyph = styled(PortalIcon)`
	width: 18px;
	height: 18px;
	stroke-width: 1.6;
`;

export const Gateway = styled.details`
	position: relative;

	summary {
		min-height: 36px;
		padding: 0 10px;
		display: flex;
		align-items: center;
		gap: 7px;
		cursor: pointer;
		list-style: none;
		border: 1px solid var(--transparent);
		border-radius: 7px;
		color: var(--muted);
	}

	summary:hover {
		color: var(--ink);
		border-color: var(--line);
		background: var(--surface-subtle);
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary:is(:hover, :focus-visible) .portal-icon__twinkle,
	form button:is(:hover, :focus-visible) .portal-icon__twinkle {
		animation: ${portalIconTwinkle} 900ms ease-in-out infinite;
	}

	summary:is(:hover, :focus-visible) .portal-icon__twinkle--red,
	form button:is(:hover, :focus-visible) .portal-icon__twinkle--red {
		stroke: var(--negative);
	}

	summary:is(:hover, :focus-visible) .portal-icon__twinkle--green,
	form button:is(:hover, :focus-visible) .portal-icon__twinkle--green {
		animation-delay: -300ms;
		stroke: var(--positive);
	}

	summary:is(:hover, :focus-visible) .portal-icon__twinkle--blue,
	form button:is(:hover, :focus-visible) .portal-icon__twinkle--blue {
		animation-delay: -600ms;
		stroke: var(--event-blue);
	}

	&[open] > div {
		position: absolute;
		right: 0;
		top: 38px;
		width: min(410px, 88vw);
		padding: 18px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--paper);
		box-shadow: 0 16px 40px var(--shadow-soft);
		white-space: normal;
		overflow-wrap: anywhere;
		z-index: 60;
	}

	.gateway-permaweb-os-toggle {
		width: 100%;
		min-height: 54px;
		margin: 0 0 16px;
		padding: 9px 10px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-color: var(--line);
		text-align: left;
	}

	.gateway-permaweb-os-toggle > span:first-child {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	.gateway-permaweb-os-toggle strong,
	.gateway-permaweb-os-toggle small {
		display: block;
	}

	.gateway-permaweb-os-toggle strong {
		color: var(--ink);
		font-size: var(--type-body);
		font-weight: 500;
	}

	.gateway-permaweb-os-toggle small {
		color: var(--muted);
		font-size: var(--type-small);
		line-height: 1.35;
	}

	.gateway-peer-remove {
		width: 40px;
		min-height: 40px;
		margin-top: 0;
		padding: 0;
		display: grid;
		place-items: center;
		color: var(--muted);
	}

	.gateway-peer-remove:hover:not(:disabled) {
		color: var(--negative-text);
	}

	.gateway-peer-add {
		min-height: 32px;
		margin-top: 7px;
		padding: 5px 7px;
		border: 0;
		background: var(--transparent);
		color: var(--muted);
		font-size: var(--type-small);
	}

	.gateway-peer-add:hover:not(:disabled) {
		color: var(--ink);
		background: var(--surface-hover);
	}

	button {
		margin-top: 10px;
	}

	.gateway-apply-row > button,
	.gateway-peer-help-trigger {
		margin-top: 0;
	}

	.gateway-apply-button {
		flex: 1 1 auto;
	}

	.gateway-peer-help-trigger {
		width: 34px;
		min-height: 34px;
		padding: 0;
		display: grid;
		place-items: center;
		border-radius: 50%;
	}

	summary .gateway-label {
		display: none;
	}

	@media (max-width: 600px) {
		grid-area: 1 / 1 / 2 / 2;

		&[open] > div {
			right: -44px;
			width: min(360px, calc(100vw - 20px));
		}
	}
`;

export const Control = styled.div`
	display: flex;
	align-items: center;

	@media (max-width: 600px) {
		position: relative;
		display: grid;
		place-items: center;

		> .ui-tooltip {
			grid-area: 1 / 1 / 2 / 2;
			z-index: 1;
			align-self: start;
			justify-self: end;
			transform: translate(3px, -3px);
		}
	}
`;

export const Refreshing = styled.span`
	width: 26px;
	height: 36px;
	display: grid;
	place-items: center;
	color: var(--muted-subtle);
	cursor: help;

	> svg {
		animation: spin 0.8s linear infinite;
	}

	&:focus-visible {
		outline: 2px solid var(--muted-subtle);
		outline-offset: -5px;
		border-radius: 7px;
	}

	@media (max-width: 600px) {
		width: 16px;
		height: 16px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--paper);

		> svg {
			width: 10px;
			height: 10px;
		}

		&:focus-visible {
			outline-offset: 1px;
		}
	}
`;

export const SummaryContent = styled.span`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 7px;
`;

export const ToggleControl = styled.span`
	width: 34px;
	height: 20px;
	flex: 0 0 auto;
	padding: 2px;
	display: flex;
	align-items: center;
	justify-content: flex-start;
	border: 1px solid var(--line-dark);
	border-radius: 999px;
	background: var(--surface-subtle);
	color: var(--paper);

	&::before {
		content: '';
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--muted);
		transition: transform 120ms ease;
	}

	.gateway-permaweb-os-toggle[aria-checked='true'] & {
		justify-content: flex-end;
		border-color: var(--accent);
		background: var(--accent);
	}

	.gateway-permaweb-os-toggle[aria-checked='true'] &::before {
		background: var(--paper);
	}

	> svg {
		display: none;
	}
`;

export const PeerEditor = styled.fieldset`
	min-width: 0;
	margin: 0;
	padding: 0;
	border: 0;

	legend {
		margin-bottom: 4px;
		padding: 0;
		font-size: var(--type-body);
	}
`;

export const PeerDescription = styled.p`
	margin: 0 0 9px;
	color: var(--muted);
	font-size: var(--type-small);
	line-height: 1.4;
`;

export const PeerFields = styled.div`
	display: grid;
	gap: 7px;
`;

export const PeerRow = styled.div`
	min-width: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	align-items: center;
	gap: 6px;

	input {
		min-width: 0;
	}
`;

export const ErrorMessage = styled.p`
	margin: 8px 0 0;
	color: var(--negative-text);
	font-size: var(--type-small);
`;

export const ApplyRow = styled.div`
	margin-top: 10px;
	display: flex;
	align-items: stretch;
	gap: 6px;
`;

export const PeerHelp = styled(Tooltip)`
	flex: 0 0 auto;
`;
