import styled from 'styled-components';

/**
 * The size and variant modifiers stay at one class of specificity through `:where()`, exactly as the class rules
 * they replace did, so the many `styled(Button)` wrappers and the containers that restyle a button by descendant
 * selector keep winning. Source order inside this block is the order the rules had in the stylesheet, and a
 * wrapper's module always evaluates after this one, so styled-components emits the wrapper's rules later.
 */
export const Root = styled.button`
	min-height: 35px;
	border: 1px solid var(--line-dark);
	background: var(--panel);
	border-radius: 5px;
	padding: 8px 13px;
	cursor: pointer;
	transition: border-color 0.1s ease, background 0.1s ease;
	font-size: var(--type-body);
	font-weight: 400;

	&:hover:not(:disabled):not([aria-disabled='true']) {
		border-color: var(--line-dark);
		background: var(--surface-hover);
		transform: none;
	}

	&:where(.ui-button--medium, .ui-button--small, .ui-button--icon) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
	}

	&:where(.ui-button--icon) {
		width: 35px;
		min-width: 0;
		min-height: 35px;
		flex: 0 0 auto;
		padding: 0;
		border-radius: 6px;
	}

	&:where(.ui-button--small) {
		min-height: 28px;
		padding: 0 9px;
		border: 1px solid var(--home-line);
		border-radius: 6px;
		color: var(--home-muted);
		background: var(--paper);
		font-size: var(--type-body);
		box-shadow: none;
	}

	&:where(.ui-button--small):hover:not(:disabled):not([aria-disabled='true']),
	&:where(.ui-button--small)[aria-current='page'],
	&:where(.ui-button--small)[aria-selected='true'] {
		color: var(--ink);
		border-color: var(--line-dark);
		background: var(--surface-subtle);
	}

	&:where(.ui-button--primary) {
		color: var(--ink);
		border-color: var(--button-accent-hover);
		background: var(--button-accent);
	}

	&:where(.ui-button--primary):hover:not(:disabled):not([aria-disabled='true']) {
		color: var(--ink);
		border-color: var(--line-dark);
		background: var(--button-accent-hover);
	}

	&:where(.ui-button--ghost) {
		color: var(--muted);
		border-color: var(--transparent);
		background: var(--transparent);
		box-shadow: none;
	}

	&:where(.ui-button--ghost):hover:not(:disabled):not([aria-disabled='true']) {
		color: var(--ink);
		border-color: var(--transparent);
		background: var(--surface-hover);
	}

	&:where(.ui-button--danger) {
		color: var(--negative);
		border-color: var(--negative-border);
		background: var(--negative-surface);
	}

	&:where(.ui-button--danger):hover:not(:disabled):not([aria-disabled='true']) {
		color: var(--negative);
		border-color: var(--negative);
		background: var(--negative-subtle-surface);
	}

	&:disabled,
	&[aria-disabled='true'] {
		cursor: default;
		color: var(--muted-subtle);
		opacity: 0.72;
	}

	/* A form's full-width submit. It follows the variants, as it did in the stylesheet. */
	&:where(.wide) {
		width: 100%;
		margin-top: 24px;
	}

	/* A dialog's dismiss control: a bare square that drops the button box entirely. */
	&:where(.close) {
		width: 35px;
		height: 35px;
		display: grid;
		flex: 0 0 auto;
		place-items: center;
		border: 0;
		background: var(--transparent);
		padding: 0;
	}

	@media (max-width: 760px) {
		&:where(.close) {
			width: 44px;
			height: 44px;
		}
	}

	/* The marketplace's lead action: callers opt in with market-primary-action, so it keeps two classes. */
	&.market-primary-action {
		min-height: 45px;
		border-radius: 7px;
		color: var(--paper);
		border-color: var(--ink);
		background: var(--ink);
	}

	&.market-primary-action:hover:not(:disabled):not([aria-disabled='true']) {
		color: var(--paper);
		border-color: var(--accent-dark);
		background: var(--accent-dark);
	}

	&.market-primary-action:disabled,
	&.market-primary-action[aria-disabled='true'] {
		color: var(--muted-subtle);
		border-color: var(--line);
		background: var(--surface);
	}
`;
