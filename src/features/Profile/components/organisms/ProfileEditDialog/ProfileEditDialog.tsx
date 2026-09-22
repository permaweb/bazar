import React from 'react';
import { Upload, X } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { FileInput } from 'components/atoms/FileInput';
import { Icon } from 'components/atoms/Icon';
import { IconButton } from 'components/atoms/IconButton';
import { TextInput } from 'components/atoms/TextInput';
import { DialogHeading } from 'components/molecules/DialogHeading';
import { useDialogFocus } from 'hooks/useDialogFocus';
import type { ProfileSummary } from 'types/profile';

import { ProfileEditUpdate, profileImageError, profileUpdateError } from '../ProfilePage';

export default function ProfileEditDialog(props: {
	onClose(): void;
	onSave(update: ProfileEditUpdate, onStatus: (status: string) => void): Promise<void>;
	open: boolean;
	profile: ProfileSummary;
	restoreTarget(): HTMLElement | null;
}) {
	const [displayName, setDisplayName] = React.useState('');
	const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = React.useState('');
	const [dragging, setDragging] = React.useState(false);
	const [removeAvatar, setRemoveAvatar] = React.useState(false);
	const [status, setStatus] = React.useState('');
	const [error, setError] = React.useState('');
	const fileInput = React.useRef<HTMLInputElement>(null);
	const busy = Boolean(status);
	const displayNameChanged = displayName.trim() !== (props.profile.displayName ?? '').trim();
	const pictureChanged = Boolean(avatarFile) || removeAvatar;
	const close = React.useCallback(() => {
		if (!busy) props.onClose();
	}, [busy, props.onClose]);
	const dialogRef = useDialogFocus<HTMLDivElement>(props.open, close, props.restoreTarget);

	React.useEffect(() => {
		if (!props.open) return;
		setDisplayName(props.profile.displayName ?? '');
		setAvatarFile(null);
		setAvatarPreview(props.profile.avatar ?? '');
		setDragging(false);
		setRemoveAvatar(false);
		setStatus('');
		setError('');
	}, [props.open, props.profile.avatar, props.profile.displayName]);

	React.useEffect(() => {
		if (!avatarFile) {
			setAvatarPreview(removeAvatar ? '' : props.profile.avatar ?? '');
			return;
		}
		const url = URL.createObjectURL(avatarFile);
		setAvatarPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [avatarFile, props.profile.avatar, removeAvatar]);

	if (!props.open) return null;

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError('');
		setStatus(avatarFile ? 'Preparing picture…' : 'Preparing profile…');
		try {
			await props.onSave({ displayName, displayNameChanged, avatarFile, removeAvatar }, setStatus);
		} catch (cause) {
			setStatus('');
			setError(profileUpdateError(cause));
		}
	};
	const selectAvatar = (file: File | null) => {
		if (!file) return;
		const validationError = profileImageError(file);
		if (validationError) {
			setAvatarFile(null);
			setRemoveAvatar(false);
			setError(validationError);
			return;
		}
		setError('');
		setAvatarFile(file);
		setRemoveAvatar(false);
	};

	return (
		<div
			className="dialog-backdrop profile-edit-backdrop"
			onMouseDown={(event) => event.target === event.currentTarget && close()}
			role="presentation"
		>
			<section
				aria-labelledby="profile-edit-title"
				aria-modal="true"
				className="dialog dialog-compact profile-edit-dialog"
				ref={dialogRef}
				role="dialog"
				tabIndex={-1}
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
				<form className="profile-edit-form" onSubmit={(event) => void submit(event)}>
					<label>
						<span>Profile name</span>
						<TextInput
							autoComplete="nickname"
							autoFocus
							disabled={busy}
							maxLength={64}
							onChange={(event) => setDisplayName(event.target.value)}
							placeholder="How people will see you"
							value={displayName}
						/>
					</label>
					<div className="profile-edit-form__field">
						<span>Profile picture</span>
						<FileInput
							accept="image/png,image/jpeg,image/webp,image/gif"
							className="profile-edit-form__file-input"
							disabled={busy}
							onChange={(event) => {
								selectAvatar(event.target.files?.[0] ?? null);
								event.target.value = '';
							}}
							ref={fileInput}
						/>
						<Button
							aria-label={avatarPreview ? 'Change profile picture' : 'Choose profile picture'}
							className={`profile-edit-dropzone${dragging ? ' is-dragging' : ''}${
								avatarPreview ? ' has-preview' : ''
							}`}
							disabled={busy}
							onClick={() => fileInput.current?.click()}
							onDragEnter={(event) => {
								event.preventDefault();
								setDragging(true);
							}}
							onDragLeave={(event) => {
								const next = event.relatedTarget;
								if (!(next instanceof Node) || !event.currentTarget.contains(next)) setDragging(false);
							}}
							onDragOver={(event) => {
								event.preventDefault();
								setDragging(true);
							}}
							onDrop={(event) => {
								event.preventDefault();
								setDragging(false);
								selectAvatar(event.dataTransfer.files?.[0] ?? null);
							}}
							size="custom"
						>
							{avatarPreview ? <img alt="Profile picture preview" src={avatarPreview} /> : null}
							<span className="profile-edit-dropzone__prompt">
								<Icon icon={Upload} />
								<strong>{avatarPreview ? 'Drop or choose a new image' : 'Drop an image here'}</strong>
								<small>PNG, JPEG, WebP, or GIF · up to 10 MB</small>
							</span>
						</Button>
						{avatarPreview ? (
							<Button
								className="profile-edit-form__remove-picture"
								disabled={busy}
								onClick={() => {
									setAvatarFile(null);
									setRemoveAvatar(true);
								}}
								size="custom"
								variant="ghost"
							>
								Remove picture
							</Button>
						) : null}
					</div>
					{error ? (
						<p className="profile-edit-form__error" role="alert">
							{error}
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
							disabled={busy || (!displayNameChanged && !pictureChanged)}
							type="submit"
							variant="primary"
						>
							{status || 'Save profile'}
						</Button>
					</div>
				</form>
			</section>
		</div>
	);
}
