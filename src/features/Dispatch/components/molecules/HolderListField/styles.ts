import styled from 'styled-components';

import { Pressable } from 'components/atoms/Pressable';
import { Tooltip } from 'components/atoms/Tooltip';

export const List = styled.div`
	display: grid;
	gap: 8px;
`;

export const Head = styled.div`
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: var(--type-small);
	color: var(--muted);
`;

/** The format hint reuses the shared tooltip and widens its anchored surface to the left. */
export const Hint = styled(Tooltip)`
	display: inline-flex;
	align-items: center;
	color: var(--muted);
	cursor: help;

	> span:first-child {
		display: inline-flex;
		align-items: center;
	}

	> span:first-child > svg {
		width: 14px;
		height: 14px;
	}

	.ui-tooltip__content {
		right: auto;
		left: 0;
		width: min(340px, 78vw);
		line-height: 1.5;
	}

	.ui-tooltip__content::before,
	.ui-tooltip__content::after {
		right: auto;
		left: 1px;
	}

	.ui-tooltip__content::after {
		left: 2px;
	}

	.ui-tooltip__content code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.92em;
		color: var(--ink);
		overflow-wrap: anywhere;
	}
`;

export const Rows = styled.div`
	display: grid;
	gap: 6px;
`;

export const Row = styled.div`
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 0.42fr) auto;
	gap: 6px;
	align-items: center;

	input {
		min-width: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: var(--type-small);
	}
`;

export const RemoveRow = styled(Pressable)`
	display: grid;
	place-items: center;
	width: 34px;
	height: 34px;
	border: 1px solid var(--border);
	border-radius: 8px;
	background: var(--surface);
	color: var(--muted);
	cursor: pointer;

	&:hover:not(:disabled) {
		color: var(--negative-text, var(--text));
		border-color: var(--negative-border, var(--border));
	}

	&:disabled {
		opacity: 0.4;
		cursor: default;
	}

	svg {
		width: 15px;
		height: 15px;
	}
`;

export const AddRow = styled(Pressable)`
	justify-self: start;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 10px;
	border: 1px dashed var(--border);
	border-radius: 8px;
	background: var(--transparent);
	color: var(--text);
	font-size: var(--type-small);
	cursor: pointer;

	&:hover:not(:disabled) {
		border-color: var(--accent, var(--text));
	}

	&:disabled {
		opacity: 0.5;
		cursor: default;
	}

	svg {
		width: 15px;
		height: 15px;
	}
`;
