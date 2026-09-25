import styled, { createGlobalStyle } from 'styled-components';

import { Button } from 'components/atoms/Button';
import { Dialog } from 'components/organisms/Dialog';

/**
 * The backdrop is the dialog organism's own element and takes only a caller-supplied class name, so the one
 * rule this dialog has for it is declared globally instead of through a styled element.
 */
export const BackdropStyle = createGlobalStyle`
	@media (max-width: 640px) {
		.profile-edit-backdrop {
			padding: 12px;
			place-items: end center;
		}
	}
`;

// The rest of the generic modal chrome stays in apps/bazar/styles.css with the dialog organism; only the
// profile-specific rules moved here.
export const Root = styled(Dialog)`
	width: min(560px, 100%);

	h2 {
		margin: 0;
	}

	@media (max-width: 640px) {
		padding: 24px 20px;
		border-radius: 12px;
	}
`;

export const Form = styled.form`
	display: grid;
	gap: 20px;

	label,
	.profile-edit-form__field {
		display: grid;
		gap: 8px;
		color: var(--ink);
		font-size: var(--type-small);
		font-weight: 500;
	}

	label input {
		width: 100%;
		min-width: 0;
		padding: 11px 12px;
		border: 1px solid var(--line-dark);
		border-radius: 8px;
		color: var(--ink);
		background: var(--paper);
		font: inherit;
		font-weight: 400;
	}

	label input:focus-visible {
		border-color: var(--ink);
		outline: 2px solid color-mix(in srgb, var(--ink) 18%, transparent);
		outline-offset: 1px;
	}

	.profile-edit-form__file-input {
		display: none;
	}
`;

export const Note = styled.p`
	margin: 0;
	color: var(--muted-subtle);
	font-size: var(--type-small);
	font-weight: 400;
	line-height: 1.45;
`;

// The picture dropzone doubles as the button that opens the file picker.
export const Dropzone = styled(Button)`
	position: relative;
	width: 100%;
	min-height: 168px;
	padding: 0;
	overflow: hidden;
	display: grid;
	place-items: center;
	border: 1px dashed var(--line-dark);
	border-radius: 9px;
	background: var(--surface-subtle);
	cursor: pointer;

	&:is(:hover, :focus-visible),
	&.is-dragging {
		border-color: var(--ink);
		background: var(--surface-hover);
	}

	&:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--ink) 18%, transparent);
		outline-offset: 2px;
	}

	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	&.has-preview .profile-edit-dropzone__prompt {
		width: 100%;
		height: 100%;
		align-content: center;
		background: color-mix(in srgb, var(--fixed-shade) 62%, transparent);
		color: color-mix(in srgb, var(--contrast-text) 78%, transparent);
	}

	&.has-preview .profile-edit-dropzone__prompt strong {
		color: var(--contrast-text);
	}
`;

export const DropzonePrompt = styled.span`
	position: relative;
	z-index: 1;
	padding: 24px;
	display: grid;
	justify-items: center;
	gap: 7px;
	color: var(--muted-subtle);
	text-align: center;

	.ui-icon {
		width: 22px;
		height: 22px;
	}

	strong {
		color: var(--ink);
		font-size: var(--type-body);
		font-weight: 500;
	}

	small {
		font-size: var(--type-small);
		font-weight: 400;
	}
`;

export const RemovePicture = styled(Button)`
	width: max-content;
	padding: 2px 0;
	color: var(--muted);
	font-size: var(--type-small);
`;

export const Error = styled.p`
	margin: 0;
	color: var(--danger);
	font-size: var(--type-small);
`;

export const Actions = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: 10px;
`;
