import styled from 'styled-components';

// Shared by the fungible operation dialog and the sell/transfer field groups it renders.

export const Form = styled.form`
	display: grid;
	gap: 18px;

	> .ui-button--primary.wide,
	> .ui-button--danger.wide {
		min-width: 0;
		overflow-wrap: anywhere;
		white-space: normal;
	}

	/* In the dialog's form phase the form becomes the scrolling body of a column. */
	.dialog-form-phase > & {
		flex: 1 1 auto;
		min-height: 0;
		grid-template-rows: minmax(0, 1fr) auto;
		gap: var(--space-3);
		overflow: hidden;
	}

	@media (max-height: 480px) {
		.dialog-form-phase > & {
			flex: 1 1 auto;
			min-height: 0;
			grid-template-rows: minmax(0, 1fr) auto;
			gap: 8px;
			overflow: hidden;
		}
	}
`;

export const Fields = styled.div`
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 12px;

	@media (max-width: 760px) {
		grid-template-columns: 1fr;
	}
`;

export const Balance = styled.div`
	min-width: 0;
	padding: 14px 16px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 18px;
	border: 1px solid var(--line);
	border-radius: 8px;
	background: var(--panel);
	font-size: var(--type-body);

	span {
		min-width: 0;
		color: var(--muted);
		overflow-wrap: anywhere;
	}

	strong {
		min-width: 0;
		font-size: var(--type-body);
		overflow-wrap: anywhere;
		text-align: right;
	}
`;

// `.trade-quote` and `.trade-balance` always shared one rule; they stay one styled element.
export const Quote = Balance;

export const Guidance = styled.p`
	margin: -7px 0 0;
	color: var(--warning-text);
	font-size: var(--type-body);
	line-height: 1.5;
`;

export const Disclosure = styled.p`
	margin: -2px 0 0;
	padding: 12px 14px;
	border-left: 3px solid var(--warning-border);
	background: var(--warning-surface);
	color: var(--warning-text);
	font-size: var(--type-body);
	line-height: 1.55;
`;

export const FormFooter = styled.div`
	min-width: 0;
	display: grid;
	gap: 10px;

	> .wide {
		min-height: 44px;
		margin-top: 0;
	}
`;
