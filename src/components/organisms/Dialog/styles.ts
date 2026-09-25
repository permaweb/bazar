import styled from 'styled-components';

/**
 * Both elements take their class names entirely from the caller, so every rule here is gated on the class that
 * asked for it: the header's search overlay passes `search-overlay` with no `dialog-backdrop` and must not pick
 * up the modal chrome. `:where()` keeps each selector at exactly the weight its stylesheet rule had, and a
 * `styled(Dialog)` wrapper's module always evaluates after this one, so a caller's own rules are emitted later
 * and keep winning the ties they won when this chrome lived in apps/bazar/styles.css.
 */
export const Backdrop = styled.div`
	&:where(.dialog-backdrop) {
		position: fixed;
		inset: 0;
		height: 100dvh;
		z-index: 100;
		padding: max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right))
			max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
		display: grid;
		place-items: center;
		background: var(--dialog-scrim);
		backdrop-filter: blur(8px);
		transition: background 420ms cubic-bezier(0.32, 0.72, 0, 1),
			backdrop-filter 420ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	&:where(.dialog-backdrop-hiding) {
		background: var(--dialog-scrim-clear);
		backdrop-filter: blur(0);
		pointer-events: none;
	}

	&:where(.dialog-backdrop)[hidden] {
		display: none;
	}

	&:where(.dialog-backdrop-hiding) .dialog {
		filter: blur(1.5px);
		opacity: 0;
		transform: translate3d(var(--dialog-hide-x, 0), var(--dialog-hide-y, 0), 0)
			scale(var(--dialog-hide-scale, 0.04));
	}

	@media (max-width: 480px) {
		&:where(.dialog-backdrop) {
			padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
				max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
		}
	}

	/*
	 * Transaction side panels slide in from the trailing edge instead of sitting centred. This stays after the
	 * narrow-viewport padding above, as it did in the stylesheet, so padding:0 still wins on a phone.
	 */
	&:where(.operation-panel-backdrop) {
		padding: 0;
		display: flex;
		align-items: stretch;
		justify-content: flex-end;
	}

	&:where(.operation-panel-backdrop).dialog-backdrop-hiding .operation-side-panel {
		filter: none;
		opacity: 0;
		transform: translate3d(100%, 0, 0);
	}
`;

export const Panel = styled.div`
	&:where(.dialog) {
		width: min(1120px, 100%);
		max-height: 100%;
		overflow: auto;
		border: 1px solid var(--line-dark);
		border-radius: 10px;
		background: var(--paper);
		padding: clamp(24px, 4vw, 48px);
		box-shadow: 0 24px 70px var(--shadow-strong);
		opacity: 1;
		transform: translate3d(0, 0, 0) scale(1);
		transform-origin: center;
		will-change: transform, opacity, filter;
		transition: transform 480ms cubic-bezier(0.32, 0.72, 0, 1), opacity 360ms ease 80ms, filter 420ms ease;
	}

	&:where(.dialog-compact) {
		width: min(720px, 100%);
	}

	/*
	 * A dialog showing a form turns into a column so the form body scrolls and the footer stays put. It follows
	 * the panel block above, as it did in the stylesheet, so its overflow keeps beating the panel's own.
	 */
	&:where(.dialog-form-phase) {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	&:where(.dialog) label {
		min-width: 0;
		display: grid;
		gap: 8px;
		font-size: var(--type-body);
		font-weight: 400;
		overflow-wrap: anywhere;
	}

	&:where(.dialog) label input {
		min-width: 0;
	}

	/* The side panel: a full-height sheet on the trailing edge, so it drops the centred panel's box. */
	&:where(.dialog).operation-side-panel,
	&:where(.dialog).operation-side-panel.dialog-compact,
	&:where(.dialog).operation-side-panel.fungible-dialog {
		width: min(680px, 100%);
		height: 100%;
		max-height: none;
		padding: max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right))
			max(24px, env(safe-area-inset-bottom)) 24px;
		border-width: 0 0 0 1px;
		border-radius: 0;
		box-shadow: -18px 0 52px var(--shadow-strong);
		transform-origin: right center;
	}

	/* Inside the side panel the summary blocks lose their card framing and run to the panel's own padding. */
	&:where(.operation-side-panel) .operation-summary,
	&:where(.operation-side-panel) .settlement-receipt,
	&:where(.operation-side-panel) .settlement-error-detail,
	&:where(.operation-side-panel) .trade-balance,
	&:where(.operation-side-panel) .trade-quote,
	&:where(.operation-side-panel) .cancel-summary,
	&:where(.operation-side-panel) .batch-quote,
	&:where(.operation-side-panel) .matched-listings,
	&:where(.operation-side-panel) .purchase-route {
		padding: 0;
		border: 0;
		border-radius: 0;
		background: var(--transparent);
	}

	&:where(.operation-side-panel) .settlement-error-detail {
		margin-inline: 0;
	}

	&:where(.operation-side-panel) .batch-quote {
		gap: 12px 20px;
		overflow: visible;
	}

	&:where(.operation-side-panel) .batch-quote > div,
	&:where(.operation-side-panel) .batch-quote > div:nth-child(n) {
		padding: 0;
		border: 0;
	}

	&:where(.operation-side-panel) .purchase-settlement-receipt {
		gap: 0;
		overflow: visible;
	}

	&:where(.operation-side-panel) .purchase-settlement-receipt .settlement-receipt-amount,
	&:where(.operation-side-panel) .settlement-receipt-facts,
	&:where(.operation-side-panel) .receipt-proof-links {
		padding-inline: 0;
	}

	&:where(.operation-side-panel) .purchase-settlement-receipt .settlement-receipt-amount,
	&:where(.operation-side-panel) .settlement-receipt-facts > div + div,
	&:where(.operation-side-panel) .settlement-receipt-links {
		border: 0;
	}

	&:where(.operation-side-panel) .settlement-receipt-links {
		padding-top: 0;
	}

	&:where(.operation-side-panel) .receipt-proof-links {
		padding-top: 12px;
		gap: 12px;
		border-top: 1px solid var(--line);
		background: var(--transparent);
	}

	&:where(.operation-side-panel) .receipt-proof-links a {
		min-height: 48px;
		padding: 9px 11px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--paper);
	}

	&:where(.operation-side-panel) .receipt-proof-links a:hover {
		border-color: var(--line-dark);
		background: var(--surface-hover);
	}

	&:where(.operation-side-panel) .matched-listings-heading,
	&:where(.operation-side-panel) .matched-listings ul,
	&:where(.operation-side-panel) .purchase-route summary,
	&:where(.operation-side-panel) .purchase-route li {
		padding-inline: 0;
	}

	@media (max-width: 760px) {
		&:where(.dialog) input,
		&:where(.dialog) select,
		&:where(.dialog) textarea {
			font-size: var(--type-body);
		}
	}

	@media (max-width: 600px) {
		&:where(.dialog).operation-side-panel,
		&:where(.dialog).operation-side-panel.dialog-compact,
		&:where(.dialog).operation-side-panel.fungible-dialog {
			width: 100%;
			padding: max(20px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
				max(20px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
		}
	}

	@media (max-height: 480px) {
		&:where(.dialog-form-phase) {
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
	}

	@media (max-width: 480px) {
		&:where(.dialog, .fungible-dialog) {
			padding: 20px 16px;
		}

		&:where(.dialog) button {
			min-height: 44px;
		}
	}
`;
