import styled from 'styled-components';

import { Button } from 'components/atoms/Button';

/**
 * The dispatch pages reuse the creation page's `.create-*` and `.mint-*` class names. The create feature carries
 * the same declarations in `features/Create/styles/create-form.ts`: the two are separate lazy routes and a feature
 * may not import another feature's internals, so each states them for the elements it renders.
 */

export const Page = styled.section`
	width: 100%;
	min-height: calc(100vh - 61px);
	margin: 0 auto;
	padding: clamp(48px, 6vw, 84px) 0 80px;

	@media (max-width: 1050px) {
		padding: 30px 0 54px;
	}

	@media (max-width: 480px) {
		padding: 24px 0 48px;
	}
`;

export const Heading = styled.div`
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(280px, 480px);
	align-items: end;
	gap: 48px;
	margin-bottom: 40px;

	.eyebrow {
		margin: 0 0 9px;
	}

	h1 {
		margin: 0;
		font-size: var(--type-page-title);
		line-height: 0.96;
		letter-spacing: -0.035em;
	}

	> p {
		margin: 0;
		color: var(--muted);
		font-size: var(--type-body);
		line-height: 1.6;
	}

	@media (max-width: 1050px) {
		grid-template-columns: 1fr;
		gap: 16px;
	}

	@media (max-width: 480px) {
		margin-bottom: 26px;

		h1 {
			font-size: var(--type-page-title);
		}
	}
`;

/**
 * `.dispatch-layout` collapsed the two creation columns to one. It used to win on file order; restating it inside
 * the breakpoint keeps the wider rule's `1fr` from being overridden by the single-column modifier.
 */
export const Layout = styled.div`
	display: grid;
	gap: clamp(30px, 5vw, 72px);
	align-items: start;
	grid-template-columns: minmax(0, 1.04fr) minmax(360px, 0.96fr);

	&.dispatch-layout {
		grid-template-columns: minmax(0, 1fr);
	}

	@media (max-width: 1050px) {
		&,
		&.dispatch-layout {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 480px) {
		gap: 28px;
	}
`;

export const Form = styled.form`
	display: grid;
	gap: var(--space-5);
`;

export const Field = styled.div`
	position: relative;
	display: grid;
	gap: 8px;

	label {
		font-size: var(--type-body);
		font-weight: 400;
	}

	label small {
		margin-left: 5px;
		color: var(--muted-subtle);
		font-weight: 400;
	}

	input,
	textarea {
		width: 100%;
		border: 1px solid var(--line-dark);
		border-radius: 7px;
		background: var(--paper);
		color: var(--ink);
	}

	input {
		min-height: 46px;
		padding: 10px 14px;
	}

	textarea {
		min-height: 132px;
		padding: 13px 14px 30px;
		resize: vertical;
		line-height: 1.5;
	}

	input:focus,
	textarea:focus {
		border-color: var(--line-dark);
		outline: none;
	}

	> span {
		position: absolute;
		right: 11px;
		bottom: 9px;
		color: var(--muted-subtle);
		font-size: var(--type-small);
	}

	&:has(input) > span {
		bottom: -17px;
	}
`;

export const Summary = styled.div`
	margin-top: var(--space-2);
	padding: var(--space-4) 0;
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 16px;
	border-top: 1px solid var(--line);
	border-bottom: 1px solid var(--line);

	div {
		display: grid;
		gap: 4px;
	}

	span {
		color: var(--muted-subtle);
		font-size: var(--type-small);
	}

	strong {
		font-size: var(--type-body);
		font-weight: 400;
	}

	@media (max-width: 480px) {
		grid-template-columns: 1fr;
	}
`;

export const Notice = styled.div`
	display: flex;
	align-items: flex-start;
	gap: 10px;
	color: var(--muted-subtle);
	font-size: var(--type-body);
	line-height: 1.5;
`;

/**
 * The submit button keeps the specificity it had: its `:hover` rule still loses the background to
 * `.ui-button:hover:not(:disabled):not([aria-disabled='true'])`, which carries one more compound.
 */
export const SubmitButton = styled(Button)`
	min-height: 46px;
	padding: 0 15px;
	border: 1px solid var(--line);
	border-radius: 7px;
	background: var(--button-accent);
	cursor: pointer;
	font-weight: 400;
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 9px;

	&:hover:not(:disabled) {
		background: var(--button-accent-hover);
	}

	&:disabled {
		cursor: wait;
		opacity: 0.62;
	}
`;

export const Recovery = styled.div`
	margin: -17px 0 32px;
	padding: 14px 16px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20px;
	border: 1px solid var(--line);
	border-radius: 8px;
	background: var(--panel);

	button {
		min-height: 46px;
		padding: 0 15px;
		border: 1px solid var(--line);
		border-radius: 7px;
		background: var(--button-accent);
		cursor: pointer;
		font-weight: 400;
	}

	button:hover:not(:disabled) {
		background: var(--button-accent-hover);
	}

	button:disabled {
		cursor: wait;
		opacity: 0.62;
	}

	> div:first-child {
		display: grid;
		gap: 3px;
	}

	strong {
		font-size: var(--type-body);
	}

	span {
		color: var(--muted);
		font-size: var(--type-body);
	}

	> div:last-child {
		display: flex;
		gap: 8px;
	}

	button {
		min-height: 36px;
		font-size: var(--type-body);
	}
`;

export const Success = styled.div`
	padding: 16px;
	display: grid;
	grid-template-columns: 36px minmax(0, 1fr) auto;
	align-items: center;
	gap: 13px;
	border: 1px solid var(--positive-border);
	border-radius: 8px;
	background: var(--positive-surface);

	button {
		min-height: 46px;
		padding: 0 15px;
		border: 1px solid var(--line);
		border-radius: 7px;
		background: var(--button-accent);
		cursor: pointer;
		font-weight: 400;
	}

	button:hover {
		background: var(--button-accent-hover);
	}

	> span {
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		color: var(--positive-text);
		background: var(--positive-surface);
	}

	> span svg {
		width: 17px;
		height: 17px;
	}

	&.propagating > span svg,
	&.propagating button svg {
		animation: infinity-pulse 1.15s ease-in-out infinite;
	}

	p {
		margin: 3px 0 0;
		color: var(--muted);
		font-size: var(--type-body);
	}

	button {
		min-height: 38px;
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: var(--type-body);
	}

	button:disabled {
		cursor: default;
		opacity: 0.68;
	}
`;

export const Table = styled.table`
	width: 100%;
	border-collapse: collapse;
	font-size: var(--type-small);

	th,
	td {
		padding: 10px 16px;
		text-align: left;
		border-bottom: 1px solid var(--line);
	}

	thead th {
		position: sticky;
		top: 0;
		background: var(--surface-subtle);
		color: var(--muted);
		font-weight: 500;
	}

	tbody tr:last-child td {
		border-bottom: none;
	}

	td:nth-child(2) {
		font-variant-numeric: tabular-nums;
		word-break: break-all;
	}
`;

export const TableWrapper = styled.div`
	max-height: 420px;
	overflow: auto;
	border: 1px solid var(--line);
	border-radius: 12px;
`;
