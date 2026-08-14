import React from 'react';
import { useParams } from 'react-router-dom';
import { Camera, MapPin, Pencil, Upload, X } from 'lucide-react';

import {
	profileAvatarUrl,
	PROFILE_AVATAR_CONTENT_TYPES,
	PROFILE_AVATAR_MAX_BYTES,
	ProfileClient,
	profileDisplayName,
	readAccountProfile,
	type ProfileUpdate,
} from 'api/profile';

import { Button } from 'components/Button';
import { ProfileAvatar, type ProfileSummary, shortProfileAddress } from 'components/ProfileIdentity';
import { useWallet } from 'providers/WalletProvider';

import { useDialogFocus } from '../app/useDialogFocus';

import './ProfileRoute.css';

import MyAssetsRoute from './MyAssetsRoute';

export type ProfileRouteProps = {
	action?: React.ReactNode;
	children?: React.ReactNode;
	error?: string | null;
	isLoading?: boolean;
	onRetry?: () => void;
	onEdit?: (trigger: HTMLButtonElement) => void;
	profile: ProfileSummary;
};

export function ProfilePage({
	action,
	children,
	error,
	isLoading = false,
	onEdit,
	onRetry,
	profile,
}: ProfileRouteProps) {
	const name = profile.displayName?.trim() || shortProfileAddress(profile.address);

	return (
		<section className="profile-page">
			<section className="profile-page__hero" aria-labelledby="profile-page-title">
				<div className="profile-page__identity">
					{onEdit ? (
						<button
							aria-label="Edit profile picture"
							className="profile-page__avatar-button"
							onClick={(event) => onEdit(event.currentTarget)}
							type="button"
						>
							<ProfileAvatar className="profile-page__avatar" profile={profile} size="large" />
							<span aria-hidden="true" className="profile-page__avatar-edit">
								<Camera className="ui-icon" />
							</span>
						</button>
					) : (
						<ProfileAvatar className="profile-page__avatar" profile={profile} size="large" />
					)}
					<div className="profile-page__heading">
						<p className="profile-page__eyebrow">Arweave profile</p>
						<div className="profile-page__title-row">
							<h1 id="profile-page-title">{name}</h1>
							{onEdit ? (
								<Button
									aria-label="Edit profile"
									className="profile-page__edit-button"
									onClick={(event) => onEdit(event.currentTarget)}
									size="icon"
									variant="ghost"
								>
									<Pencil aria-hidden="true" className="ui-icon" />
								</Button>
							) : null}
						</div>
						<p className="profile-page__address" title={profile.address}>
							{profile.address}
						</p>
					</div>
					{action ? <div className="profile-page__action">{action}</div> : null}
				</div>
				{profile.bio ? <p className="profile-page__bio">{profile.bio}</p> : null}
			</section>

			{isLoading ? (
				<div aria-live="polite" className="profile-page__notice">
					<MapPin aria-hidden="true" size={16} /> Resolving this profile from Arweave…
				</div>
			) : null}
			{error ? (
				<div className="profile-page__notice profile-page__notice--error" role="alert">
					<span>{error}</span>
					{onRetry ? (
						<button onClick={onRetry} type="button">
							Retry
						</button>
					) : null}
				</div>
			) : null}
			{children ? <section className="profile-page__content">{children}</section> : null}
		</section>
	);
}

type ProfileEditUpdate = {
	displayName: string;
	displayNameChanged: boolean;
	avatarFile: File | null;
	removeAvatar: boolean;
};

function ProfileEditDialog({
	onClose,
	onSave,
	open,
	profile,
	restoreTarget,
}: {
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
	const displayNameChanged = displayName.trim() !== (profile.displayName ?? '').trim();
	const pictureChanged = Boolean(avatarFile) || removeAvatar;
	const close = React.useCallback(() => {
		if (!busy) onClose();
	}, [busy, onClose]);
	const dialogRef = useDialogFocus<HTMLDivElement>(open, close, restoreTarget);

	React.useEffect(() => {
		if (!open) return;
		setDisplayName(profile.displayName ?? '');
		setAvatarFile(null);
		setAvatarPreview(profile.avatar ?? '');
		setDragging(false);
		setRemoveAvatar(false);
		setStatus('');
		setError('');
	}, [open, profile.avatar, profile.displayName]);

	React.useEffect(() => {
		if (!avatarFile) {
			setAvatarPreview(removeAvatar ? '' : profile.avatar ?? '');
			return;
		}
		const url = URL.createObjectURL(avatarFile);
		setAvatarPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [avatarFile, profile.avatar, removeAvatar]);

	if (!open) return null;

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError('');
		setStatus(avatarFile ? 'Preparing picture…' : 'Preparing profile…');
		try {
			await onSave({ displayName, displayNameChanged, avatarFile, removeAvatar }, setStatus);
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
				<div className="dialog-heading">
					<div>
						<p className="eyebrow">Your public identity</p>
						<h2 id="profile-edit-title">Edit profile</h2>
					</div>
					<Button
						aria-label="Close profile editor"
						disabled={busy}
						onClick={close}
						size="icon"
						variant="ghost"
					>
						<X aria-hidden="true" className="ui-icon" />
					</Button>
				</div>
				<form className="profile-edit-form" onSubmit={(event) => void submit(event)}>
					<label>
						<span>Profile name</span>
						<input
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
						<input
							accept="image/png,image/jpeg,image/webp,image/gif"
							className="profile-edit-form__file-input"
							disabled={busy}
							onChange={(event) => {
								selectAvatar(event.target.files?.[0] ?? null);
								event.target.value = '';
							}}
							ref={fileInput}
							type="file"
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
								<Upload aria-hidden="true" className="ui-icon" />
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

function profileImageError(file: File) {
	if (!PROFILE_AVATAR_CONTENT_TYPES.includes(file.type)) return 'Choose a PNG, JPEG, WebP, or GIF image.';
	if (!file.size || file.size > PROFILE_AVATAR_MAX_BYTES) return 'Choose an image smaller than 10 MB.';
	return '';
}

function profileUpdateError(cause: unknown) {
	if (cause instanceof Error && cause.message === 'invalid-profile-avatar') {
		return 'The existing profile picture is not a valid image reference. Choose a new picture and try again.';
	}
	if (cause instanceof Error && cause.message === 'invalid-profile-avatar-type') {
		return 'Choose a PNG, JPEG, WebP, or GIF image.';
	}
	if (cause instanceof Error && cause.message === 'invalid-profile-avatar-size') {
		return 'Choose an image smaller than 10 MB.';
	}
	if (cause instanceof Error && cause.message === 'wallet-account-changed') {
		return 'The connected wallet changed. Return to your current wallet profile and try again.';
	}
	return 'Your profile could not be updated. Please try again.';
}

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;

export default function ProfileRoute() {
	const { address = '' } = useParams();
	const wallet = useWallet();
	const [retry, setRetry] = React.useState(0);
	const [profile, setProfile] = React.useState<Awaited<ReturnType<typeof readAccountProfile>>>();
	const [error, setError] = React.useState('');
	const [editOpen, setEditOpen] = React.useState(false);
	const editTrigger = React.useRef<HTMLButtonElement | null>(null);

	React.useEffect(() => {
		setError('');
		setProfile(undefined);
		if (!ADDRESS.test(address)) {
			setError('This is not a valid Arweave profile address.');
			return;
		}
		const controller = new AbortController();
		void readAccountProfile(address, { signal: controller.signal }).then(
			(value) => {
				if (!controller.signal.aborted) setProfile(value);
			},
			() => {
				if (!controller.signal.aborted) setError('This profile could not be read from Arweave.');
			}
		);
		return () => controller.abort();
	}, [address, retry]);

	const summary: ProfileSummary = {
		address,
		...(profileDisplayName(profile) ? { displayName: profileDisplayName(profile) } : {}),
		...(profile?.bio ? { bio: profile.bio } : {}),
		...(profileAvatarUrl(profile) ? { avatar: profileAvatarUrl(profile) } : {}),
	};
	const openEditor = (trigger: HTMLButtonElement) => {
		editTrigger.current = trigger;
		setEditOpen(true);
	};
	const saveProfile = async (update: ProfileEditUpdate, onStatus: (status: string) => void) => {
		const client = new ProfileClient();
		const fields: ProfileUpdate = update.displayNameChanged ? { displayName: update.displayName } : {};
		if (update.removeAvatar) fields.avatar = '';
		if (update.avatarFile) {
			const data = new Uint8Array(await update.avatarFile.arrayBuffer());
			fields.avatar = await client.uploadAvatar(address, data, update.avatarFile.type, {
				onPhase: (phase) => onStatus(phase === 'signing' ? 'Approve picture…' : 'Uploading picture…'),
			});
		}
		onStatus('Preparing profile…');
		const updated = await client.update(address, fields, {
			onPhase: (phase) => onStatus(phase === 'signing' ? 'Approve profile…' : 'Publishing profile…'),
		});
		setProfile(updated);
		setEditOpen(false);
	};
	return (
		<>
			<ProfilePage
				error={error}
				isLoading={ADDRESS.test(address) && profile === undefined && !error}
				onEdit={wallet.address === address ? openEditor : undefined}
				onRetry={() => setRetry((value) => value + 1)}
				profile={summary}
			>
				{ADDRESS.test(address) ? <MyAssetsRoute address={address} embedded /> : null}
			</ProfilePage>
			<ProfileEditDialog
				onClose={() => setEditOpen(false)}
				onSave={saveProfile}
				open={editOpen}
				profile={summary}
				restoreTarget={() => editTrigger.current}
			/>
		</>
	);
}
