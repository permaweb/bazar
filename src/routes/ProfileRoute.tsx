import React from 'react';
import { useParams } from 'react-router-dom';
import { Camera, MapPin, Pencil, Upload, X } from 'lucide-react';

import {
	type AccountProfile,
	PROFILE_AVATAR_CONTENT_TYPES,
	PROFILE_AVATAR_MAX_BYTES,
	profileAvatarUrl,
	ProfileClient,
	profileDisplayName,
	type ProfileUpdate,
	readAccountProfile,
} from 'api/profile';

import { Button } from 'components/Button';
import {
	announceProfileUpdated,
	ProfileAvatar,
	ProfileSaveError,
	type ProfileSaveStage,
	type ProfileSummary,
	profileUpdateError,
	shortProfileAddress,
} from 'components/ProfileIdentity';
import { useWallet } from 'providers/WalletProvider';

import './ProfileRoute.css';

import { useDialogFocus } from '../app/useDialogFocus';

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

export type ProfileEditUpdate = {
	displayName: string;
	displayNameChanged: boolean;
	avatarFile: File | null;
	removeAvatar: boolean;
};

/** A picture whose upload was accepted, kept so a retry of the same File by the same owner reuses it. */
export type UploadedProfileAvatar = { address: string; file: File; avatar: string };

export const PROFILE_PICTURE_REUSED_STATUS = 'Picture already uploaded. Preparing profile…';

/**
 * Upload the picture (unless this exact File was already uploaded for this address),
 * then publish the profile. `uploaded` is the caller's holder: it is set only once
 * uploadAvatar resolves (an accepted POST) and cleared on success or when the File
 * or address no longer match.
 */
export async function saveProfileEdit(
	client: Pick<ProfileClient, 'uploadAvatar' | 'update'>,
	address: string,
	update: ProfileEditUpdate,
	uploaded: { current: UploadedProfileAvatar | null },
	onStatus: (status: string) => void
): Promise<AccountProfile> {
	const fields: ProfileUpdate = update.displayNameChanged ? { displayName: update.displayName } : {};
	if (update.removeAvatar) fields.avatar = '';
	const file = update.avatarFile;
	const reused =
		file && uploaded.current?.address === address && uploaded.current.file === file ? uploaded.current : null;
	if (!reused) uploaded.current = null;
	let stage: ProfileSaveStage = 'picture-preparing';
	try {
		if (reused) {
			fields.avatar = reused.avatar;
			onStatus(PROFILE_PICTURE_REUSED_STATUS);
		} else if (file) {
			const data = new Uint8Array(await file.arrayBuffer());
			const avatar = await client.uploadAvatar(address, data, file.type, {
				onPhase: (phase) => {
					stage = phase === 'signing' ? 'picture-signing' : 'picture-uploading';
					onStatus(phase === 'signing' ? 'Approve picture…' : 'Uploading picture…');
				},
			});
			uploaded.current = { address, file, avatar };
			fields.avatar = avatar;
			onStatus('Preparing profile…');
		} else {
			onStatus('Preparing profile…');
		}
		stage = 'profile-preparing';
		const updated = await client.update(address, fields, {
			onPhase: (phase) => {
				stage = phase === 'signing' ? 'profile-signing' : 'profile-publishing';
				onStatus(phase === 'signing' ? 'Approve profile…' : 'Publishing profile…');
			},
		});
		uploaded.current = null;
		return updated;
	} catch (cause) {
		throw new ProfileSaveError(stage, uploaded.current !== null, cause);
	}
}

/**
 * Always-mounted polite status region. It must exist before its text changes,
 * because a live region inserted together with its text is often not announced.
 */
export function ProfileStatusAnnouncement({ message }: { message: string | null }) {
	return (
		<p aria-live="polite" className="sr-only" role="status">
			{message ?? ''}
		</p>
	);
}

/** The stored name and picture the editor started from; fixed for one open. */
type ProfileEditSeed = { displayName: string; avatar: string };

function profileEditSeed(profile: ProfileSummary): ProfileEditSeed {
	return { displayName: profile.displayName ?? '', avatar: profile.avatar ?? '' };
}

export function ProfileEditDialog({
	onClose,
	onSave,
	open,
	ownerConnected,
	profile,
	restoreTarget,
}: {
	onClose(): void;
	onSave(update: ProfileEditUpdate, onStatus: (status: string) => void): Promise<void>;
	open: boolean;
	/** Whether the connected wallet owns this profile. When it stops, the editor closes unless a save is in flight. */
	ownerConnected: boolean;
	profile: ProfileSummary;
	restoreTarget(): HTMLElement | null;
}) {
	// Read at open time only: a profile change while the editor is open must not
	// reseed it and wipe what the owner typed.
	const profileRef = React.useRef(profile);
	profileRef.current = profile;
	const [seed, setSeed] = React.useState(() => profileEditSeed(profile));
	const [displayName, setDisplayName] = React.useState(seed.displayName);
	const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = React.useState(seed.avatar);
	const [dragging, setDragging] = React.useState(false);
	const [removeAvatar, setRemoveAvatar] = React.useState(false);
	// null while editing; the current wallet step while a save is in flight.
	const [savePhase, setSavePhase] = React.useState<string | null>(null);
	const [error, setError] = React.useState('');
	const fileInput = React.useRef<HTMLInputElement>(null);
	const dropzone = React.useRef<HTMLButtonElement>(null);
	const busy = savePhase !== null;
	// When the connected wallet stops owning the profile the editor leaves,
	// unless a save is in flight or its failure is on screen: that outcome stays
	// until the owner closes it (Save is disabled meanwhile).
	const visible = open && (ownerConnected || busy || Boolean(error));
	const displayNameChanged = displayName.trim() !== seed.displayName.trim();
	const pictureChanged = Boolean(avatarFile) || removeAvatar;
	const close = React.useCallback(() => {
		if (!busy) onClose();
	}, [busy, onClose]);
	const dialogRef = useDialogFocus<HTMLDivElement>(visible, close, restoreTarget);

	React.useEffect(() => {
		if (!open) return;
		const next = profileEditSeed(profileRef.current);
		setSeed(next);
		setDisplayName(next.displayName);
		setAvatarFile(null);
		setAvatarPreview(next.avatar);
		setDragging(false);
		setRemoveAvatar(false);
		setSavePhase(null);
		setError('');
	}, [open]);

	React.useEffect(() => {
		if (open && !visible) onClose();
	}, [onClose, open, visible]);

	React.useEffect(() => {
		if (!avatarFile) {
			setAvatarPreview(removeAvatar ? '' : seed.avatar);
			return;
		}
		const url = URL.createObjectURL(avatarFile);
		setAvatarPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [avatarFile, removeAvatar, seed.avatar]);

	if (!visible) return null;

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		// Every control is disabled while saving; keep focus inside the dialog
		// instead of letting it fall to <body> with the disabled submit button.
		dialogRef.current?.focus();
		setError('');
		setSavePhase(avatarFile ? 'Preparing picture…' : 'Preparing profile…');
		try {
			await onSave({ displayName, displayNameChanged, avatarFile, removeAvatar }, setSavePhase);
		} catch (cause) {
			setSavePhase(null);
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
							data-dialog-initial
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
							ref={dropzone}
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
									// This button unmounts once the preview clears; hand focus to the
									// dropzone, which now reads "Choose profile picture".
									window.requestAnimationFrame(() => dropzone.current?.focus());
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
					<ProfileStatusAnnouncement message={savePhase} />
					<p className="profile-edit-form__note">
						Your profile is saved permanently on Arweave. A new picture may require two wallet approvals.
					</p>
					<div className="profile-edit-form__actions">
						<Button disabled={busy} onClick={close} variant="ghost">
							Cancel
						</Button>
						<Button
							disabled={busy || !ownerConnected || (!displayNameChanged && !pictureChanged)}
							type="submit"
							variant="primary"
						>
							{savePhase ?? 'Save profile'}
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

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;

/**
 * Profile page load state:
 *   invalid  -- the route address is not an Arweave address (terminal; nothing to retry)
 *   loading  -- the profile read is in flight
 *   ready    -- the read resolved; `profile` is null when the address has no profile yet
 *   error    -- the read failed; Retry starts loading again
 */
export type ProfileLoadStatus = 'invalid' | 'loading' | 'ready' | 'error';

export const INVALID_PROFILE_ADDRESS = 'This is not a valid Arweave profile address.';

export function profileLoadView({
	address,
	profile,
	readError,
	walletAddress,
}: {
	address: string;
	profile: AccountProfile | null | undefined;
	readError: string;
	walletAddress: string | null | undefined;
}) {
	const status: ProfileLoadStatus = !ADDRESS.test(address)
		? 'invalid'
		: readError
		? 'error'
		: profile === undefined
		? 'loading'
		: 'ready';
	return {
		status,
		error: status === 'invalid' ? INVALID_PROFILE_ADDRESS : status === 'error' ? readError : '',
		isLoading: status === 'loading',
		// Only a loaded profile can be edited: before the read lands, or after it
		// failed, the editor would start from an empty name, and a picture-only
		// save would publish that empty name over the stored one.
		canEdit: status === 'ready' && walletAddress === address,
		canRetry: status === 'error',
	};
}

export default function ProfileRoute() {
	const { address = '' } = useParams();
	const wallet = useWallet();
	const [retry, setRetry] = React.useState(0);
	const [profile, setProfile] = React.useState<AccountProfile | null>();
	const [error, setError] = React.useState('');
	const [editOpen, setEditOpen] = React.useState(false);
	const [savedNotice, setSavedNotice] = React.useState<string | null>(null);
	const editTrigger = React.useRef<HTMLButtonElement | null>(null);
	const uploadedAvatar = React.useRef<UploadedProfileAvatar | null>(null);

	React.useEffect(() => {
		setError('');
		setProfile(undefined);
		setSavedNotice(null);
		// An invalid address is derived by profileLoadView; there is nothing to read.
		if (!ADDRESS.test(address)) return;
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
		// The reopened dialog starts without a chosen File, so no earlier upload can match.
		uploadedAvatar.current = null;
		setSavedNotice(null);
		setEditOpen(true);
	};
	const saveProfile = async (update: ProfileEditUpdate, onStatus: (status: string) => void) => {
		const updated = await saveProfileEdit(new ProfileClient(), address, update, uploadedAvatar, onStatus);
		setProfile(updated);
		announceProfileUpdated(window, address, updated);
		setEditOpen(false);
		// The dialog's own status region unmounts on close and focus returns to the
		// edit trigger in a frame; announce the result on the page after that.
		window.requestAnimationFrame(() => setSavedNotice('Profile saved.'));
	};
	const view = profileLoadView({ address, profile, readError: error, walletAddress: wallet.address });
	return (
		<>
			<ProfilePage
				error={view.error}
				isLoading={view.isLoading}
				onEdit={view.canEdit ? openEditor : undefined}
				onRetry={view.canRetry ? () => setRetry((value) => value + 1) : undefined}
				profile={summary}
			>
				{view.status !== 'invalid' ? <MyAssetsRoute address={address} /> : null}
			</ProfilePage>
			<ProfileEditDialog
				onClose={() => setEditOpen(false)}
				onSave={saveProfile}
				open={editOpen}
				ownerConnected={wallet.address === address}
				profile={summary}
				restoreTarget={() => editTrigger.current}
			/>
			<ProfileStatusAnnouncement message={savedNotice} />
		</>
	);
}
