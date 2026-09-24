import styled from 'styled-components';

export { Summary } from '../../../styles/operation-panel';

/**
 * The form inside an operation dialog. Its `.dialog-form-phase > .operation-form` layout rules stay in the global
 * stylesheet: they are grouped with the fungible dialog's `.trade-form` and belong to the dialog chrome.
 */
export const Form = styled.form`
	display: grid;
	gap: var(--space-4);

	.wide {
		margin-top: 2px;
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
