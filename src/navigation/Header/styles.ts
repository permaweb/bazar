import React from 'react';
import { Link } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';

import { IconButton } from 'components/atoms/IconButton';
import { Dialog } from 'components/organisms/Dialog';
import { omitProps } from 'helpers/props';

const brandMarkLaunch = keyframes`
	0%,
	100% {
		transform: translate(0, 0) rotate(0deg) scale(1);
	}
	9% {
		transform: translate(0, 1px) rotate(0deg) scale(1.04, 0.94);
	}
	31% {
		transform: translate(0.5px, -4px) rotate(1deg) scale(0.98, 1.04);
	}
	50% {
		transform: translate(1px, -4.5px) rotate(1.5deg) scale(1);
	}
	67% {
		transform: translate(1px, 0.75px) rotate(1deg) scale(1.03, 0.96);
	}
	79% {
		transform: translate(-1.5px, 0) rotate(-5deg) scale(1);
	}
	91% {
		transform: translate(0.5px, -0.25px) rotate(2deg) scale(1);
	}
`;

const brandMarkRoadMotion = keyframes`
	0%,
	16%,
	38%,
	66%,
	100% {
		transform: translate(0, 0);
	}
	24% {
		transform: translate(0.35px, -0.65px);
	}
	47% {
		transform: translate(-0.25px, -0.3px);
	}
	76% {
		transform: translate(0.4px, -0.5px);
	}
	84% {
		transform: translate(-0.15px, 0.2px);
	}
`;

const brandMarkSpeedLinesA = keyframes`
	0%,
	8%,
	31%,
	57%,
	76%,
	100% {
		opacity: 0;
	}
	14% {
		opacity: 0.7;
		transform: translateX(3px) scaleX(0.35);
	}
	25% {
		opacity: 0;
		transform: translateX(-5px) scaleX(1.2);
	}
	63% {
		opacity: 0.52;
		transform: translateX(1px) scaleX(0.72);
	}
	72% {
		opacity: 0;
		transform: translateX(-3px) scaleX(1.45);
	}
`;

const brandMarkSpeedLinesB = keyframes`
	0%,
	19%,
	42%,
	69%,
	91%,
	100% {
		opacity: 0;
	}
	25% {
		opacity: 0.62;
		transform: translateX(2px) scaleX(0.45);
	}
	36% {
		opacity: 0;
		transform: translateX(-4px) scaleX(1.35);
	}
	74% {
		opacity: 0.44;
		transform: translateX(0) scaleX(0.85);
	}
	86% {
		opacity: 0;
		transform: translateX(-5px) scaleX(1.1);
	}
`;

export const SiteHeader = styled.header`
	height: 61px;
	background: color-mix(in srgb, var(--paper) 95%, var(--transparent));
	backdrop-filter: blur(14px);
	position: sticky;
	top: 0;
	z-index: 50;
`;

export const HeaderContent = styled.div`
	height: 100%;
	display: grid;
	grid-template-columns: minmax(180px, 1fr) minmax(240px, 360px) minmax(0, 1fr);
	align-items: center;
	gap: 16px;

	@media (max-width: 900px) {
		grid-template-columns: auto minmax(180px, 1fr) auto;
	}

	@media (max-width: 760px) {
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 8px;
	}

	@media (max-width: 600px) {
		grid-template-columns: 44px minmax(44px, 1fr) auto;
	}
`;

export const BrandMark = styled.span`
	position: relative;
	width: 26px;
	height: 24px;
	display: grid;
	place-items: center;

	&::before,
	&::after {
		position: absolute;
		z-index: 0;
		left: -8px;
		height: 1px;
		border-radius: 999px;
		background: currentColor;
		content: '';
		opacity: 0;
		transform-origin: right center;
	}

	&::before {
		top: 7px;
		width: 7px;
		box-shadow: 2px 5px 0 currentColor;
	}

	&::after {
		top: 17px;
		left: -6px;
		width: 5px;
	}

	img {
		position: relative;
		z-index: 1;
		width: 26px;
		height: 24px;
		display: block;
		object-fit: contain;
		transform-origin: center bottom;
	}

	@media (max-width: 760px) {
		width: 25px;
		height: 23px;

		img {
			width: 25px;
			height: 23px;
		}
	}
`;

export const Brand = styled(Link)`
	display: inline-flex;
	align-items: center;
	gap: 9px;
	font-family: 'DM Sans', sans-serif;
	font-weight: 400;
	font-size: var(--type-body);

	&:is(:hover, :focus-visible) .brand-mark img {
		animation: ${brandMarkLaunch} 760ms cubic-bezier(0.22, 0.8, 0.28, 1) 1,
			${brandMarkRoadMotion} 980ms 760ms linear infinite;
	}

	&:is(:hover, :focus-visible) .brand-mark::before {
		animation: ${brandMarkSpeedLinesA} 1.35s 640ms linear infinite;
	}

	&:is(:hover, :focus-visible) .brand-mark::after {
		animation: ${brandMarkSpeedLinesB} 1.83s 820ms linear infinite;
	}

	@media (max-width: 760px) {
		gap: 7px;
		min-width: 44px;
		min-height: 44px;
		justify-content: center;
	}

	@media (max-width: 600px) {
		min-width: 44px;
		min-height: 44px;
		justify-content: center;

		> span:not(.brand-mark) {
			display: none;
		}
	}
`;

export const Nav = styled.nav`
	grid-column: 3;
	justify-self: end;
	display: flex;
	align-items: center;
	gap: 0;
	font-size: var(--type-body);
	font-weight: 400;

	.ui-icon {
		color: var(--muted-subtle);
	}

	@media (max-width: 600px) {
		gap: 8px;
	}
`;

/**
 * The create link and the gateway trigger are sized from here: the stylesheet scoped those rules to
 * `.site-nav-primary`, and the two-class specificity is what keeps them ahead of the atoms' own rules. The
 * `max-width: 760px` `min-height: 44px` for `> a` is gone: the later unconditional block below already overrode it.
 */
export const NavPrimary = styled.div`
	display: flex;
	align-items: center;
	white-space: nowrap;
	gap: 2px;

	> a,
	> .ui-tooltip > a {
		min-height: 36px;
		padding: 0 10px;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		border: 1px solid var(--transparent);
		border-radius: 7px;
		color: var(--muted);
	}

	> a::after,
	> .ui-tooltip > a::after {
		display: none;
	}

	> a:hover,
	> a.active,
	> .ui-tooltip > a:hover,
	> .ui-tooltip > a.active {
		color: var(--ink);
		border-color: var(--line);
		background: var(--surface-subtle);
	}

	> a,
	> .ui-tooltip > a {
		width: 36px;
		min-height: 36px;
		padding: 0;
		justify-content: center;
	}

	> .create-link-tooltip {
		display: inline-flex;
	}

	> .create-link-tooltip > .create-link {
		width: auto;
		padding: 0 10px;
	}

	.gateway summary {
		width: 36px;
		min-width: 36px;
		min-height: 36px;
		padding: 0;
		justify-content: center;
		overflow: visible;
	}

	.gateway-trigger-tooltip {
		width: 100%;
		height: 100%;
		align-items: center;
		justify-content: center;
	}

	.gateway summary .ui-icon {
		color: var(--muted-subtle);
	}

	@media (max-width: 900px) {
		> a:not(.my-assets-link) {
			display: none;
		}
	}

	@media (max-width: 760px) {
		> a:not(.my-assets-link) {
			display: none;
		}
	}

	@media (max-width: 600px) {
		> .create-link-tooltip > .create-link {
			width: 36px;
			padding: 0;
		}

		.gateway summary {
			width: 44px;
			min-width: 44px;
			height: 44px;
			min-height: 44px;
			padding: 0;
			border-radius: 7px;
		}
	}
`;

export const NavWallet = styled.div`
	position: relative;
	display: flex;
	align-items: center;
	white-space: nowrap;
	gap: 6px;
	margin-left: 8px;
	padding-left: 8px;

	@media (max-width: 600px) {
		margin-left: 0;
		padding-left: 0;
		border-left: 0;
		gap: 8px;
	}
`;

export const CreateLinkLabel = styled.span`
	@media (max-width: 600px) {
		display: none;
	}
`;

export const SiteSearch = styled.form`
	grid-column: 2;
	width: 100%;
	height: 35px;
	padding: 0 9px 0 13px;
	display: flex;
	align-items: center;
	gap: 8px;
	border: 1px solid var(--line);
	border-radius: 5px;
	color: var(--muted-subtle);
	background: var(--paper);

	input {
		min-width: 0;
		min-height: 0;
		height: 100%;
		padding: 0;
		border: 0;
		color: var(--ink);
		background: var(--transparent);
		box-shadow: none;
		font-size: var(--type-body);
	}

	input:focus {
		border: 0;
		box-shadow: none;
	}

	input:focus-visible {
		outline: 0;
	}

	input::placeholder {
		color: var(--muted);
	}

	&.expanded {
		border-color: var(--line-dark);
		box-shadow: 0 0 0 3px var(--focus-soft);
	}

	@media (max-width: 900px) {
		height: 44px;
	}

	@media (max-width: 600px) {
		position: relative;
		width: 44px;
		min-width: 44px;
		height: 44px;
		min-height: 44px;
		justify-self: end;
		justify-content: center;
		padding: 0;
		border-radius: 7px;

		input {
			position: absolute;
			inset: -1px;
			width: calc(100% + 2px);
			height: calc(100% + 2px);
			opacity: 0;
			cursor: pointer;
		}
	}
`;

type SearchDialogProps = Omit<React.ComponentProps<typeof Dialog>, 'className'> & {
	className?: string;
	panelClassName: string;
};

/**
 * `Dialog` owns both elements the search overlay styles and names them with plain class strings, so the generated
 * class rides along with the backdrop's `search-overlay` and the panel keeps `search-panel`, styled from inside.
 */
function SearchDialogBase(props: SearchDialogProps) {
	return React.createElement(Dialog, {
		...omitProps(props, ['className', 'panelClassName']),
		backdropClassName: `${props.backdropClassName}${props.className ? ` ${props.className}` : ''}`,
		className: props.panelClassName,
	});
}

export const SearchDialog = styled(SearchDialogBase)`
	position: fixed;
	inset: 0;
	height: 100dvh;
	z-index: 80;
	padding: calc(71px + env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
		max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
	display: flex;
	align-items: flex-start;
	justify-content: center;
	background: var(--search-scrim);
	backdrop-filter: blur(4px);

	.search-panel {
		width: min(920px, 100%);
		height: min(700px, 100%);
		display: grid;
		grid-template-columns: 190px minmax(0, 1fr);
		grid-template-rows: 64px minmax(0, 1fr);
		overflow: hidden;
		border: 1px solid var(--line-dark);
		border-radius: 10px;
		background: var(--paper);
		box-shadow: 0 24px 70px var(--shadow-strong);
	}

	@media (max-width: 760px) {
		.search-panel {
			grid-template-columns: 1fr;
			grid-template-rows: 64px 61px minmax(0, 1fr);
		}
	}

	@media (max-width: 480px) {
		padding: calc(67px + env(safe-area-inset-top)) max(6px, env(safe-area-inset-right))
			max(6px, env(safe-area-inset-bottom)) max(6px, env(safe-area-inset-left));

		.search-panel {
			width: 100%;
			height: 100%;
			border-radius: 9px;
		}
	}
`;

export const PanelClose = styled(IconButton)`
	svg {
		width: 15px;
		height: 15px;
	}
`;

export const PanelQuery = styled.form`
	grid-column: 1 / -1;
	padding: 0 20px;
	display: flex;
	align-items: center;
	gap: 10px;
	border-bottom: 1px solid var(--line);
	color: var(--muted-subtle);
	background: var(--paper);

	input {
		min-width: 0;
		min-height: 0;
		padding: 0;
		border: 0;
		color: var(--ink);
		background: var(--transparent);
		box-shadow: none;
		font-size: var(--type-body);
		font-weight: 400;
	}

	input:focus {
		border: 0;
		box-shadow: none;
	}

	input:focus-visible {
		outline: 0;
	}

	input::placeholder {
		color: var(--muted);
	}

	button {
		min-height: 0;
		padding: 0;
		border: 0;
		color: var(--muted);
		background: var(--transparent);
		font-size: var(--type-small);
		font-weight: 400;
	}

	button:hover {
		color: var(--ink);
		background: var(--transparent);
	}

	.search-panel-submit,
	.search-panel-close {
		width: 30px;
		height: 30px;
		margin-left: 4px;
		display: grid;
		flex: 0 0 auto;
		place-items: center;
		border-radius: 6px;
		color: var(--muted-subtle);
		background: var(--surface-subtle);
	}

	.search-panel-submit {
		color: var(--ink);
		background: var(--button-accent);
	}

	.search-panel-submit:hover {
		color: var(--ink);
		background: var(--button-accent-hover);
	}

	.search-panel-close:hover {
		background: var(--surface);
	}

	@media (max-width: 760px) {
		.search-panel-submit,
		.search-panel-close {
			width: 44px;
			height: 44px;
		}
	}

	@media (max-width: 480px) {
		padding-inline: 13px 10px;

		input {
			font-size: var(--type-body);
		}

		button:not(.search-panel-submit):not(.search-panel-close) {
			min-height: 44px;
			padding-inline: 6px;
		}
	}
`;

export const Categories = styled.aside`
	grid-column: 1;
	grid-row: 2;
	padding: 14px 11px;
	display: grid;
	align-content: start;
	gap: 3px;
	border-right: 1px solid var(--line);
	background: var(--paper);

	button {
		width: 100%;
		min-height: 38px;
		padding: 0 11px;
		display: flex;
		align-items: center;
		gap: 10px;
		border: 0;
		color: var(--muted);
		background: var(--transparent);
		font-size: var(--type-body);
		text-align: left;
	}

	button .ui-icon {
		color: var(--muted-subtle);
	}

	button:hover,
	button.active {
		color: var(--ink);
		background: var(--surface);
		border-color: var(--transparent);
	}

	@media (max-width: 760px) {
		grid-column: 1;
		grid-row: 2;
		padding: 0 10px;
		display: flex;
		align-items: center;
		gap: 6px;
		overflow-x: auto;
		border-right: 0;
		border-bottom: 1px solid var(--line);

		button {
			width: auto;
			min-width: max-content;
			min-height: 44px;
			padding-inline: 11px;
			font-size: var(--type-body);
		}

		button .ui-icon {
			display: none;
		}
	}
`;

export const PanelMain = styled.div`
	grid-column: 2;
	grid-row: 2;
	min-width: 0;
	min-height: 0;
	display: grid;
	grid-template-rows: minmax(0, 1fr);

	@media (max-width: 760px) {
		grid-column: 1;
		grid-row: 3;
	}
`;

export const PanelContent = styled.div`
	min-height: 0;
	padding: 18px 16px 28px;
	overflow-y: auto;
	background: var(--panel);

	@media (max-width: 480px) {
		padding-inline: 10px;
	}
`;

export const ResultSection = styled.section`
	& + & {
		margin-top: 22px;
	}
`;

export const ResultHeading = styled.div`
	min-height: 24px;
	margin-bottom: 8px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;

	h2 {
		margin: 0;
		color: var(--muted-subtle);
		font-size: var(--type-small);
		font-weight: 400;
	}

	> span,
	button {
		min-height: 0;
		padding: 0;
		border: 0;
		color: var(--muted-subtle);
		background: var(--transparent);
		font-size: var(--type-small);
		font-weight: 400;
	}

	button:hover {
		color: var(--ink);
		background: var(--transparent);
	}

	@media (max-width: 480px) {
		button {
			min-width: 44px;
			min-height: 44px;
		}
	}
`;

export const RecentSearches = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 7px;

	button {
		min-height: 34px;
		display: flex;
		align-items: center;
		gap: 8px;
		border-color: var(--line);
		background: var(--paper);
		font-size: var(--type-body);
	}

	button .ui-icon {
		color: var(--muted-subtle);
	}

	@media (max-width: 480px) {
		button {
			min-height: 44px;
		}
	}
`;

const resultGrid = `
	a {
		min-width: 0;
		min-height: 64px;
		padding: 9px 10px;
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr) auto;
		align-items: center;
		gap: 10px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--paper);
		transition: border-color 100ms ease, background 100ms ease;
	}

	a:hover {
		border-color: var(--line-dark);
		background: var(--paper);
	}

	a > span:nth-child(2) {
		min-width: 0;
		display: grid;
		gap: 3px;
	}

	strong,
	small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		color: var(--ink);
		font-size: var(--type-body);
		font-weight: 400;
	}

	small {
		color: var(--muted-subtle);
		font-size: var(--type-small);
	}

	a > .ui-icon {
		color: var(--muted-subtle);
	}

	@media (max-width: 480px) {
		grid-template-columns: 1fr;
	}
`;

export const CollectionGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;

	${resultGrid}
`;

export const AssetGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--asset-grid-gap);

	${resultGrid}
`;

export const ResultImage = styled.span`
	width: 44px;
	height: 44px;
	display: grid;
	place-items: center;
	overflow: hidden;
	border: 1px solid var(--line);
	border-radius: 7px;
	background: var(--panel);

	/*
	 * Scoped to the direct image: as a descendant rule this used to sit above .names-cube-preview img in the
	 * stylesheet and lose to it, which a component stylesheet cannot reproduce. The nested previews set the same
	 * width/height/object-fit on their own images, so narrowing to the direct child keeps every result identical.
	 */
	> img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	> img[src$='.svg'] {
		width: 26px;
		height: 26px;
		object-fit: contain;
	}

	&.token-avatar-slot {
		overflow: visible;
		border: 0;
		border-radius: 50%;
		background: var(--transparent);
	}

	.token-avatar {
		--token-avatar-size: 44px;
	}

	> .bazar-mark {
		width: 30px;
		height: 27px;
		display: block;
		object-fit: contain;
		object-position: center;
	}
`;

export const Empty = styled.div`
	min-height: 300px;
	display: grid;
	place-content: center;
	gap: 6px;
	color: var(--ink);
	text-align: center;

	span {
		color: var(--muted);
		font-size: var(--type-body);
	}
`;
