import styled, { keyframes } from 'styled-components';

import { Pressable } from 'components/atoms/Pressable';

const creditBadgeSpin = keyframes`
	to {
		transform: rotate(360deg);
	}
`;

const creditParticleBurst = keyframes`
	0% {
		transform: translate(0, 0) scale(0.5);
		opacity: 0;
	}
	30% {
		opacity: 1;
	}
	100% {
		transform: translate(var(--udl-particle-x, 0), var(--udl-particle-y, 0)) scale(0);
		opacity: 0;
	}
`;

const paymentCoinRise = keyframes`
	0% {
		transform: translateY(1px);
	}
	45% {
		transform: translateY(-2px);
	}
	100% {
		transform: translateY(1px);
	}
`;

const paymentPlusLoop = keyframes`
	0% {
		transform: translateY(3px) scale(0.7);
		opacity: 0;
	}
	35% {
		opacity: 1;
	}
	100% {
		transform: translateY(-4px) scale(1.08);
		opacity: 0;
	}
`;

const globeLinesLeft = keyframes`
	from {
		transform: translateX(0);
	}
	to {
		transform: translateX(-50%);
	}
`;

/** The `.create-license` card: the heading strip plus either the UDL options or the "no licence" note. */
export const License = styled.section`
	overflow: visible;
	border: 1px solid var(--line-dark);
	border-radius: 9px;
	background: var(--panel);

	input {
		min-height: 38px;
		border: 1px solid var(--line-dark);
		border-radius: 6px;
		color: var(--ink);
		background: var(--paper);
		font: inherit;
		width: 100%;
		padding: 8px 10px;
	}

	input:focus {
		border-color: var(--line-dark);
		outline: none;
	}
`;

export const Heading = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 18px;
	padding: 15px 16px;

	> div {
		display: grid;
		gap: 3px;
	}

	strong {
		font-size: var(--type-body);
	}

	/* The Select atom sizes itself; the licence strip gives it a fixed column. */
	> .market-select {
		width: 256px;
		min-width: 256px;
	}

	> div > span {
		color: var(--muted-subtle);
		font-size: var(--type-small);
		line-height: 1.4;
	}

	@media (max-width: 480px) {
		align-items: stretch;
		flex-direction: column;

		> .market-select {
			width: 100%;
			min-width: 0;
		}
	}
`;

export const None = styled.p`
	color: var(--muted-subtle);
	font-size: var(--type-small);
	line-height: 1.4;
	padding: 0 16px 15px;
`;

export const Options = styled.div`
	display: grid;
	gap: 16px;
	padding: 16px;
	border-top: 1px solid var(--line);
	border-radius: 0 0 8px 8px;
	background: var(--paper);

	> p {
		margin: 0;
		color: var(--muted-subtle);
		font-size: var(--type-body);
		line-height: 1.5;
	}

	> p a {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		color: var(--ink);
		font-weight: 400;
	}
`;

export const OptionsLogo = styled.img`
	width: 150px;
	height: auto;
`;

export const Presets = styled.div`
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;

	@media (max-width: 480px) {
		grid-template-columns: 1fr;
	}
`;

/** One preset card. Its modifier class also drives the icon animations of the icon it renders. */
export const Preset = styled(Pressable)`
	min-width: 0;
	padding: 13px;
	display: grid;
	align-content: start;
	gap: 5px;
	border: 1px solid var(--line-dark);
	border-radius: 7px;
	background: var(--paper);
	color: var(--ink);
	cursor: pointer;
	font: inherit;
	text-align: left;

	&:hover {
		border-color: var(--ink);
	}

	&[aria-pressed='true'] {
		border-color: var(--ink);
		background: var(--panel);
		box-shadow: inset 0 0 0 1px var(--ink);
	}

	&:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	&.udl-preset--share-with-payment .udl-payment-icon {
		width: 22px;
		height: 22px;
		margin: -3px -2px -3px 0;
	}

	&.udl-preset--open-use .udl-wireframe-globe {
		width: 19px;
		height: 19px;
		margin: -1px 0;
	}

	&.udl-preset--share-with-credit .udl-credit-icon {
		width: 20px;
		height: 20px;
		margin: -2px -1px -2px 0;
	}

	&.udl-preset--share-with-credit:is(:hover, :focus-visible) .udl-preset-title .ui-icon {
		color: var(--ink);
	}

	&.udl-preset--share-with-credit:is(:hover, :focus-visible) .udl-credit-icon__badge {
		animation: ${creditBadgeSpin} 2400ms linear infinite;
		transform-box: view-box;
		transform-origin: 12px 12px;
	}

	&.udl-preset--share-with-credit:is(:hover, :focus-visible) .udl-credit-icon__particle {
		animation: ${creditParticleBurst} 620ms ease-out 440ms both;
	}

	&.udl-preset--share-with-credit:is(:hover, :focus-visible) .udl-credit-icon__particle:nth-child(2) {
		animation-delay: 500ms;
	}

	&.udl-preset--share-with-credit:is(:hover, :focus-visible) .udl-credit-icon__particle:nth-child(3) {
		animation-delay: 550ms;
	}

	&.udl-preset--share-with-credit:is(:hover, :focus-visible) .udl-credit-icon__particle:nth-child(4) {
		animation-delay: 610ms;
	}

	&.udl-preset--share-with-payment:is(:hover, :focus-visible) .udl-preset-title .ui-icon {
		color: var(--positive);
	}

	&.udl-preset--share-with-payment:is(:hover, :focus-visible) .udl-payment-icon__coin {
		animation: ${paymentCoinRise} 680ms ease-out both;
	}

	&.udl-preset--share-with-payment:is(:hover, :focus-visible) .udl-payment-icon__plus {
		animation: ${paymentPlusLoop} 950ms ease-out 560ms infinite;
	}

	&.udl-preset--share-with-payment:is(:hover, :focus-visible) .udl-payment-icon__plus:nth-child(2) {
		animation-delay: 680ms;
	}

	&.udl-preset--share-with-payment:is(:hover, :focus-visible) .udl-payment-icon__plus:nth-child(3) {
		animation-delay: 800ms;
	}

	&.udl-preset--share-with-payment:is(:hover, :focus-visible) .udl-payment-icon__plus:nth-child(4) {
		animation-delay: 920ms;
	}

	&.udl-preset--open-use:is(:hover, :focus-visible) .udl-preset-title .ui-icon {
		color: var(--event-blue);
	}

	&.udl-preset--open-use:is(:hover, :focus-visible) .udl-wireframe-globe__details {
		animation: ${globeLinesLeft} 1800ms linear infinite;
		transform-box: view-box;
		transform-origin: center;
	}

	strong {
		font-size: var(--type-body);
		font-weight: 500;
	}

	> span {
		color: var(--muted-subtle);
		font-size: var(--type-small);
		line-height: 1.4;
	}
`;

export const PresetTitle = styled.div`
	display: flex;
	align-items: center;
	gap: 6px;

	.ui-icon {
		flex: 0 0 auto;
		transform-origin: center;
		transition: color 160ms ease;
	}
`;

export const PresetPayment = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20px;
	padding: 14px 16px;
	border: 1px solid var(--line);
	border-radius: 8px;
	background: var(--panel);

	@media (max-width: 480px) {
		align-items: stretch;
		flex-direction: column;
		gap: 12px;
	}
`;

export const PresetPaymentCopy = styled.div`
	display: grid;
	gap: 3px;

	strong {
		font-size: var(--type-body);
		font-weight: 500;
	}

	span {
		color: var(--muted-subtle);
		font-size: var(--type-small);
		line-height: 1.4;
	}
`;

export const CreditCheck = styled.path`
	color: var(--positive);
`;

export const CreditParticle = styled.circle`
	opacity: 0;
	transform-box: fill-box;
	transform-origin: center;

	&:nth-child(1) {
		--udl-particle-x: -2px;
		--udl-particle-y: -2px;
	}

	&:nth-child(2) {
		--udl-particle-x: 2px;
		--udl-particle-y: -2px;
	}

	&:nth-child(3) {
		--udl-particle-x: -2px;
		--udl-particle-y: 2px;
	}

	&:nth-child(4) {
		--udl-particle-x: 2px;
		--udl-particle-y: 2px;
	}
`;

export const PaymentPlus = styled.path`
	opacity: 0;
`;

/**
 * Both term grids. `.udl-payment-terms-grid` is a single column at every width; the `1050px` breakpoint collapsed
 * every grid, so the media block restates the payment modifier to keep the original `1fr` (the narrower rule used
 * to win on file order alone).
 */
export const Grid = styled.div`
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 14px;

	&.udl-payment-terms-grid {
		grid-template-columns: minmax(0, 1fr);
	}

	@media (max-width: 1050px) {
		&,
		&.udl-payment-terms-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 480px) {
		&.udl-other-terms-grid {
			grid-template-columns: 1fr;
		}
	}
`;

export const TermSection = styled.section`
	display: grid;
	gap: 14px;
	padding: 14px;
	border: 1px solid var(--line);
	border-radius: 7px;
	background: var(--panel);

	.udl-value-label {
		background: var(--panel);
	}

	&.udl-custom-license input[aria-invalid='true'] {
		border-color: var(--negative);
	}
`;

export const TermSectionHeading = styled.div`
	display: grid;
	gap: 3px;

	strong {
		color: var(--ink);
		font-size: var(--type-body);
		font-weight: 500;
	}

	span {
		color: var(--muted-subtle);
		font-size: var(--type-small);
		line-height: 1.4;
	}
`;

export const Field = styled.div`
	min-width: 0;
	display: grid;
	align-content: start;
	gap: 6px;

	> label {
		color: var(--muted-subtle);
		font-size: var(--type-small);
		font-weight: 400;
	}

	&.udl-grant-field.has-value {
		grid-column: 1 / -1;
	}
`;

export const FieldControl = styled.div`
	min-width: 0;
	display: grid;

	> .market-select {
		width: 100%;
		min-width: 0;
	}

	&.with-value {
		grid-template-columns: minmax(0, 1fr) 98px;
		gap: 7px;
	}

	&.with-suffix {
		position: relative;
	}

	&.with-suffix input {
		padding-right: 50px;
	}

	&.with-suffix > span {
		position: absolute;
		top: 50%;
		right: 10px;
		color: var(--muted-subtle);
		font-size: var(--type-small);
		transform: translateY(-50%);
		pointer-events: none;
	}

	@media (max-width: 480px) {
		&.with-value {
			grid-template-columns: 1fr;
		}
	}
`;

export const Value = styled.label`
	position: relative;
	min-width: 0;

	> input {
		height: 40px;
		padding-right: 5px;
	}

	> input.has-currency-suffix {
		padding-right: 58px;
	}

	&.udl-preset-payment-value {
		flex: 0 0 180px;
	}

	&.udl-preset-payment-value .udl-value-label {
		background: var(--panel);
	}

	@media (max-width: 480px) {
		&.udl-preset-payment-value {
			flex-basis: auto;
			width: 100%;
		}
	}
`;

export const ValueLabel = styled.span`
	color: var(--muted-subtle);
	font-size: var(--type-small);
	font-weight: 400;
	position: absolute;
	z-index: 1;
	top: -6px;
	left: 8px;
	padding: 0 3px;
	background: var(--paper);
`;

export const ValueSuffix = styled.span`
	position: absolute;
	top: 50%;
	right: 9px;
	color: var(--muted-subtle);
	font-size: var(--type-small);
	transform: translateY(-50%);
	pointer-events: none;

	.ar-currency-label {
		gap: 3px;
	}
`;

export const Advanced = styled.details`
	border-top: 1px solid var(--line);
	padding-top: 13px;

	summary {
		width: max-content;
		color: var(--muted-subtle);
		cursor: pointer;
		font-size: var(--type-body);
		font-weight: 400;
	}

	&[open] summary {
		margin-bottom: 13px;
	}
`;

/**
 * Holds the source tabs and the panel below them. The tabs are a shared `SegmentedTabs`, so their two overrides
 * stay here as contextual rules on the `.udl-source-tabs` class the editor passes down.
 */
export const AdvancedContent = styled.div`
	display: grid;
	gap: 14px;

	.udl-source-tabs {
		width: 100%;
	}

	.udl-source-tabs button {
		flex: 1 1 0;
	}
`;

export const SourcePanel = styled.div`
	display: grid;
	gap: 14px;
`;

export const FieldHelp = styled.span`
	color: var(--muted-subtle);
	font-size: var(--type-small);
	line-height: 1.4;

	a {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		color: var(--ink);
	}
`;
