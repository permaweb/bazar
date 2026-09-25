import styled from 'styled-components';

export { Summary } from '../../../styles/operation-panel';

// The form inside an operation dialog. In the dialog's form phase it becomes the scrolling body of a column.
export const Form = styled.form`
	display: grid;
	gap: var(--space-4);

	.wide {
		margin-top: 2px;
	}

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

export const FieldHelp = styled.p`
	color: var(--muted);
	font-size: var(--type-body);
	line-height: 1.5;
	min-height: 1.1em;
	margin: -9px 0 0;

	&.field-help-error {
		color: var(--negative);
	}
`;

/** The `color: var(--muted)` the shared muted-text rule set is dropped: the disclosure's own rule replaced it. */
export const Disclosure = styled.p`
	font-size: var(--type-body);
	line-height: 1.5;
	margin: 0;
	padding: 12px 14px;
	border-left: 3px solid var(--warning-border);
	background: var(--warning-surface);
	color: var(--warning-text);
`;
