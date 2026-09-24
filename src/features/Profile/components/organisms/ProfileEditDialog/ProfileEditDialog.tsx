import React from 'react';
import { Upload, X } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { FileInput } from 'components/atoms/FileInput';
import { Icon } from 'components/atoms/Icon';
import { IconButton } from 'components/atoms/IconButton';
import { TextInput } from 'components/atoms/TextInput';
import { DialogHeading } from 'components/molecules/DialogHeading';
import { useMessages } from 'providers/LanguageProvider';
import type { ProfileSummary } from 'types/profile';

import { type ProfileEditSaveHandler, useProfileEditForm } from '../../../hooks/useProfileEditForm';
import { PROFILE_MESSAGES } from '../../../messages';

import * as S from './styles';

export default function ProfileEditDialog(props: {
	onClose(): void;
	onSave: ProfileEditSaveHandler;
	open: boolean;
	profile: ProfileSummary;
	restoreTarget(): HTMLElement | null;
}) {
	const messages = useMessages(PROFILE_MESSAGES);
	const fileInput = React.useRef<HTMLInputElement>(null);
	const editor = useProfileEditForm(props.open, props.profile, props.onSave);
	const busy = editor.busy;
	const close = React.useCallback(() => {
		if (!busy) props.onClose();
	}, [busy, props.onClose]);

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		void editor.submit();
	};

	return (
		<>
			<S.BackdropStyle />
			<S.Root
				forwardedAs="section"
				backdropClassName="dialog-backdrop profile-edit-backdrop"
				className="dialog dialog-compact profile-edit-dialog"
				labelledBy="profile-edit-title"
				onDismiss={close}
				open={props.open}
				restoreTarget={props.restoreTarget}
			>
				<DialogHeading
					control={
						<IconButton
							disabled={busy}
							icon={X}
							iconClassName="ui-icon"
							label={messages.profileEditClose}
							onClick={close}
						/>
					}
					eyebrow={messages.profileEditEyebrow}
					title={messages.profileEditTitle}
					titleId="profile-edit-title"
				/>
				<S.Form className="profile-edit-form" onSubmit={handleSubmit}>
					<label>
						<span>{messages.profileEditNameLabel}</span>
						<TextInput
							autoComplete="nickname"
							autoFocus
							disabled={busy}
							maxLength={64}
							onChange={(event) => editor.setDisplayName(event.target.value)}
							placeholder={messages.profileEditNamePlaceholder}
							value={editor.form.displayName}
						/>
					</label>
					<div className="profile-edit-form__field">
						<span>{messages.profileEditPictureLabel}</span>
						<FileInput
							accept="image/png,image/jpeg,image/webp,image/gif"
							className="profile-edit-form__file-input"
							disabled={busy}
							onChange={(event) => {
								editor.selectAvatar(event.target.files?.[0] ?? null);
								event.target.value = '';
							}}
							ref={fileInput}
						/>
						<S.Dropzone
							aria-label={
								editor.avatarPreview
									? messages.profileEditPictureChange
									: messages.profileEditPictureChoose
							}
							className={`profile-edit-dropzone${editor.form.dragging ? ' is-dragging' : ''}${
								editor.avatarPreview ? ' has-preview' : ''
							}`}
							disabled={busy}
							onClick={() => fileInput.current?.click()}
							onDragEnter={(event) => {
								event.preventDefault();
								editor.setDragging(true);
							}}
							onDragLeave={(event) => {
								const next = event.relatedTarget;
								if (!(next instanceof Node) || !event.currentTarget.contains(next))
									editor.setDragging(false);
							}}
							onDragOver={(event) => {
								event.preventDefault();
								editor.setDragging(true);
							}}
							onDrop={(event) => {
								event.preventDefault();
								editor.setDragging(false);
								editor.selectAvatar(event.dataTransfer.files?.[0] ?? null);
							}}
							size="custom"
						>
							{editor.avatarPreview ? (
								<img alt={messages.profileEditPicturePreview} src={editor.avatarPreview} />
							) : null}
							<S.DropzonePrompt className="profile-edit-dropzone__prompt">
								<Icon icon={Upload} />
								<strong>
									{editor.avatarPreview
										? messages.profileEditPictureReplacePrompt
										: messages.profileEditPicturePrompt}
								</strong>
								<small>{messages.profileEditPictureHint}</small>
							</S.DropzonePrompt>
						</S.Dropzone>
						{editor.avatarPreview ? (
							<S.RemovePicture
								className="profile-edit-form__remove-picture"
								disabled={busy}
								onClick={editor.removeAvatar}
								size="custom"
								variant="ghost"
							>
								{messages.profileEditRemovePicture}
							</S.RemovePicture>
						) : null}
					</div>
					{editor.error ? (
						<S.Error className="profile-edit-form__error" role="alert">
							{editor.error}
						</S.Error>
					) : null}
					<S.Note className="profile-edit-form__note">{messages.profileEditNote}</S.Note>
					<S.Actions className="profile-edit-form__actions">
						<Button disabled={busy} onClick={close} variant="ghost">
							{messages.profileEditCancel}
						</Button>
						<Button
							disabled={busy || (!editor.displayNameChanged && !editor.pictureChanged)}
							type="submit"
							variant="primary"
						>
							{editor.status || messages.profileEditSave}
						</Button>
					</S.Actions>
				</S.Form>
			</S.Root>
		</>
	);
}
