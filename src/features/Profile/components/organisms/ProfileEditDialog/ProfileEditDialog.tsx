import React from 'react';
import { Upload, X } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { FileInput } from 'components/atoms/FileInput';
import { Icon } from 'components/atoms/Icon';
import { IconButton } from 'components/atoms/IconButton';
import { TextInput } from 'components/atoms/TextInput';
import { DialogHeading } from 'components/molecules/DialogHeading';
import { Dialog } from 'components/organisms/Dialog';
import type { ProfileSummary } from 'types/profile';

import { type ProfileEditSaveHandler, useProfileEditForm } from '../../../hooks/useProfileEditForm';

export default function ProfileEditDialog(props: {
	onClose(): void;
	onSave: ProfileEditSaveHandler;
	open: boolean;
	profile: ProfileSummary;
	restoreTarget(): HTMLElement | null;
}) {
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
		<Dialog
			as="section"
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
						label="Close profile editor"
						onClick={close}
					/>
				}
				eyebrow="Your public identity"
				title="Edit profile"
				titleId="profile-edit-title"
			/>
			<form className="profile-edit-form" onSubmit={handleSubmit}>
				<label>
					<span>Profile name</span>
					<TextInput
						autoComplete="nickname"
						autoFocus
						disabled={busy}
						maxLength={64}
						onChange={(event) => editor.setDisplayName(event.target.value)}
						placeholder="How people will see you"
						value={editor.form.displayName}
					/>
				</label>
				<div className="profile-edit-form__field">
					<span>Profile picture</span>
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
					<Button
						aria-label={editor.avatarPreview ? 'Change profile picture' : 'Choose profile picture'}
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
						{editor.avatarPreview ? <img alt="Profile picture preview" src={editor.avatarPreview} /> : null}
						<span className="profile-edit-dropzone__prompt">
							<Icon icon={Upload} />
							<strong>
								{editor.avatarPreview ? 'Drop or choose a new image' : 'Drop an image here'}
							</strong>
							<small>PNG, JPEG, WebP, or GIF · up to 10 MB</small>
						</span>
					</Button>
					{editor.avatarPreview ? (
						<Button
							className="profile-edit-form__remove-picture"
							disabled={busy}
							onClick={editor.removeAvatar}
							size="custom"
							variant="ghost"
						>
							Remove picture
						</Button>
					) : null}
				</div>
				{editor.error ? (
					<p className="profile-edit-form__error" role="alert">
						{editor.error}
					</p>
				) : null}
				<p className="profile-edit-form__note">
					Your profile is saved permanently on Arweave. A new picture may require two wallet approvals.
				</p>
				<div className="profile-edit-form__actions">
					<Button disabled={busy} onClick={close} variant="ghost">
						Cancel
					</Button>
					<Button
						disabled={busy || (!editor.displayNameChanged && !editor.pictureChanged)}
						type="submit"
						variant="primary"
					>
						{editor.status || 'Save profile'}
					</Button>
				</div>
			</form>
		</Dialog>
	);
}
