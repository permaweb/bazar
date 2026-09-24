import styled from 'styled-components';

import { Button } from 'components/atoms/Button';

export { Field, HiddenFileInput } from '../../../styles/create-form';

/**
 * The logo drop zone is a `Button`, so its `:hover` rule keeps its original weight: the shared
 * `.ui-button:hover:not(:disabled):not([aria-disabled='true'])` still wins the border and background.
 */
export const LogoDropzone = styled(Button)`
	width: 100%;
	min-height: 116px;
	padding: 14px;
	display: grid;
	place-items: center;
	border: 1px dashed var(--line-dark);
	border-radius: 8px;
	background: var(--panel);
	color: var(--muted-subtle);
	cursor: pointer;
	text-align: left;

	&:hover:not(:disabled) {
		border-color: var(--ink);
		background: var(--surface-hover);
	}

	> span {
		display: grid;
		justify-items: center;
		gap: 5px;
		text-align: center;
	}

	> span > svg {
		width: 24px;
		height: 24px;
		margin-bottom: 3px;
	}

	> span strong {
		color: var(--ink);
		font-size: var(--type-body);
		font-weight: 500;
	}

	> span small {
		font-size: var(--type-small);
	}

	&.has-file {
		grid-template-columns: 76px minmax(0, 1fr);
		place-items: center start;
		gap: 14px;
		border-style: solid;
		background: var(--paper);
	}

	&.has-file > img {
		width: 76px;
		height: 76px;
		display: block;
		border: 1px solid var(--line);
		border-radius: 50%;
		object-fit: cover;
	}

	&.has-file > span {
		min-width: 0;
		justify-items: start;
		text-align: left;
	}

	&.has-file > span strong,
	&.has-file > span small {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

export const LogoMeta = styled.div`
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;

	> span {
		min-width: 0;
		color: var(--muted-subtle);
		font-size: var(--type-small);
		line-height: 1.45;
	}

	code {
		display: block;
		margin-top: 2px;
		overflow-wrap: anywhere;
		color: var(--ink);
	}

	> button {
		min-height: 32px;
		padding: 5px 9px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex: 0 0 auto;
		font-size: var(--type-small);
	}
`;
