import styled from 'styled-components';

import { Icon } from '../../atoms/Icon';

export const StatusHeading = styled.h3`
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 10px;

	.result-outcome & {
		flex-direction: row;
		align-items: center;
		margin: 0;
	}

	.result-status-icon {
		width: 34px;
		height: 34px;
		stroke-width: 1.6;
	}
`;

/** The outcome glyph takes its tone from the result panel it sits in. */
export const StatusIcon = styled(Icon)`
	.result.success & {
		color: var(--positive-text);
	}

	.result.error & {
		color: var(--warning-text);
	}
`;

export const Alert = styled.div`
	margin: 0;
	display: grid;
	gap: 8px;

	h3,
	p {
		margin: 0;
	}

	p {
		color: var(--muted);
		font-size: var(--type-body);
		line-height: 1.5;
	}
`;

export const StatusRow = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;

	/*
	 * Only the direction moves here: the align-items and gap this rule also declared were already overridden by
	 * the row's own unconditional values when it lived in the stylesheet, so they never applied.
	 */
	@media (max-width: 480px) {
		flex-direction: column;
	}
`;

export const StatusMeta = styled.span`
	color: var(--muted);
	font-size: var(--type-body);
	font-weight: 500;
	white-space: nowrap;
`;

export const ExternalLink = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 4px;

	.ui-icon {
		width: 15px;
		height: 15px;
	}
`;

export const Subject = styled.div`
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 14px;
`;

export const SubjectMedia = styled.div`
	width: 72px;
	height: 72px;
	flex: 0 0 72px;
`;

export const SubjectCopy = styled.div`
	min-width: 0;
	display: grid;
	gap: 3px;

	> span,
	> small {
		color: var(--muted);
		font-size: var(--type-small);
	}

	> strong {
		overflow-wrap: anywhere;
		color: var(--ink);
		font-size: 1.05rem;
		font-weight: 500;
	}
`;

/**
 * The panel a dialog shows once an operation finishes. Several features render it directly, so the styling lives
 * with this molecule and they compose it; `.result` and its success/error modifiers stay stable class hooks.
 */
export const ResultPanel = styled.div`
	min-width: 0;
	padding: 0 0 6px;
	text-align: left;

	h3 {
		font-size: var(--type-display);
	}

	&.success {
		width: 100%;
		margin: 0;
		padding: 0 0 6px;
		display: grid;
		gap: 16px;
		text-align: left;
	}

	&.error {
		display: grid;
		gap: 16px;
	}

	&.error > p {
		color: var(--muted);
		font-size: var(--type-body);
		line-height: 1.5;
	}

	&.success .result-outcome {
		display: grid;
		gap: 8px;
	}

	&.success .result-outcome h3,
	&.success .result-outcome p {
		margin: 0;
	}

	&.success .result-outcome p {
		color: var(--muted);
		line-height: 1.5;
	}

	&.success > a {
		min-width: 0;
		margin: 0;
		padding: 12px 14px;
		overflow-wrap: anywhere;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--panel);
		text-decoration: none;
	}

	&.success > .settlement-receipt {
		width: 100%;
		margin: 0;
	}

	&.success > button {
		width: 100%;
		min-height: 44px;
		margin: 0;
		justify-content: center;
	}

	&.error > button {
		width: 100%;
		min-height: 44px;
		margin: 0;
	}

	> a {
		display: block;
		margin: 6px 0;
		color: var(--muted);
		font-size: var(--type-body);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	/* A receipt inside the panel fills it instead of centring its own narrow card. */
	.settlement-receipt-navigation,
	.settlement-receipt-paging,
	.settlement-receipt {
		width: 100%;
		margin-inline: 0;
	}

	@media (max-width: 480px) {
		padding: 12px 0;

		> a {
			min-height: 44px;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	}
`;

// The settlement facts block: what was paid, to whom, and the proofs.
export const SettlementReceipt = styled.div`
	width: min(440px, 100%);
	margin: 18px auto;
	padding: 14px 16px;
	display: grid;
	gap: 6px;
	border: 1px solid var(--line);
	border-radius: 8px;
	background: var(--panel);
	text-align: left;

	> div:not(.settlement-receipt-links) {
		display: flex;
		justify-content: space-between;
		gap: 20px;
		color: var(--muted);
		font-size: var(--type-body);
	}

	strong,
	> div a {
		color: var(--ink);
	}

	> div a {
		text-underline-offset: 3px;
	}

	@media (max-width: 480px) {
		padding: 12px;

		> div:not(.settlement-receipt-links) {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			gap: 2px;
		}

		strong,
		a {
			min-width: 0;
			overflow-wrap: anywhere;
			text-align: left;
		}

		> div:not(.settlement-receipt-links) > a {
			min-height: 44px;
			display: flex;
			align-items: center;
		}
	}
`;

export const SettlementReceiptLinks = styled.div`
	margin-top: 6px;
	padding-top: 8px;
	border-top: 1px solid var(--line);

	a {
		display: block;
		margin: 4px 0;
		color: var(--muted);
		font-size: var(--type-body);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	@media (max-width: 480px) {
		a {
			min-height: 44px;
			display: flex;
			align-items: center;
		}
	}
`;
