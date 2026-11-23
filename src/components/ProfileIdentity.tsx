import React from 'react';

import { type AccountProfile, profileAvatarUrl, profileDisplayName, readAccountProfile } from 'api/profile';

import { sameAccount } from 'helpers/host-account';

import './ProfileIdentity.css';

export type ProfileSummary = {
	address: string;
	avatar?: string;
	bio?: string;
	displayName?: string;
};

export type ProfileIdentityProps = {
	className?: string;
	href?: string;
	profile: ProfileSummary;
	showAvatar?: boolean;
	size?: 'large' | 'medium' | 'small';
};

export function shortProfileAddress(address: string) {
	if (address.length <= 14) return address;
	return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

export function profilePath(address: string) {
	return `#/profile/${encodeURIComponent(address)}`;
}

function profileInitial(profile: ProfileSummary) {
	return (profile.displayName?.trim() || profile.address).slice(0, 1);
}

export function ProfileAvatar({
	className,
	profile,
	size = 'medium',
}: Pick<ProfileIdentityProps, 'className' | 'profile' | 'size'>) {
	const [imageFailed, setImageFailed] = React.useState(false);
	const classes = ['profile-avatar', `profile-avatar--${size}`, className ?? ''].filter(Boolean).join(' ');

	if (profile.avatar && !imageFailed) {
		return (
			<span className={classes} data-profile-address={profile.address}>
				<img alt="" decoding="async" loading="lazy" onError={() => setImageFailed(true)} src={profile.avatar} />
			</span>
		);
	}

	return (
		<span aria-hidden="true" className={`${classes} profile-avatar--fallback`}>
			{profileInitial(profile)}
		</span>
	);
}

export function ProfileIdentity({
	className,
	href,
	profile,
	showAvatar = false,
	size = 'small',
}: ProfileIdentityProps) {
	const displayName = profile.displayName?.trim();
	const address = shortProfileAddress(profile.address);
	const accessibleLabel = displayName ? `${displayName}, ${profile.address}` : profile.address;

	return (
		<a
			aria-label={`View profile for ${accessibleLabel}`}
			className={['profile-identity', `profile-identity--${size}`, className ?? ''].filter(Boolean).join(' ')}
			href={href ?? profilePath(profile.address)}
		>
			{showAvatar ? <ProfileAvatar profile={profile} size={size} /> : null}
			<span className="profile-identity__label">
				{displayName ? <span className="profile-identity__name">{displayName}</span> : null}
				<span className="profile-identity__address">{displayName ? `(${address})` : address}</span>
			</span>
		</a>
	);
}

export function ProfileIdentityForAddress({
	address,
	className,
	showAvatar = false,
	size = 'small',
}: Omit<ProfileIdentityProps, 'profile'> & { address: string }) {
	const profile = useAccountProfileSummary(address);
	return <ProfileIdentity className={className} profile={profile} showAvatar={showAvatar} size={size} />;
}

/**
 * Where a profile save stopped. A new picture and the profile are two separate signed,
 * paid L1 posts, so a failure after the picture landed must not lose it.
 */
export type ProfileSaveStage =
	| 'picture-preparing'
	| 'picture-signing'
	| 'picture-uploading'
	| 'profile-preparing'
	| 'profile-signing'
	| 'profile-publishing';

export class ProfileSaveError extends Error {
	constructor(readonly stage: ProfileSaveStage, readonly pictureUploaded: boolean, cause: unknown) {
		super(cause instanceof Error ? cause.message : String(cause), { cause });
		this.name = 'ProfileSaveError';
	}
}

const PROFILE_PICTURE_KEPT =
	'Your picture was uploaded, but your profile was not published. Save again to finish. Only one approval is needed.';

/**
 * User copy for a failed ProfileClient write (profile editor and "Set as profile picture").
 * Profile writes save nothing for later, so no copy here may offer to resume one.
 */
export function profileUpdateError(cause: unknown) {
	const code = cause instanceof Error ? cause.message : '';
	const stage = cause instanceof ProfileSaveError ? cause.stage : undefined;
	const reason = profileSaveFailureReason(code, stage);
	if (cause instanceof ProfileSaveError && cause.pictureUploaded) {
		return reason ? `${reason} ${PROFILE_PICTURE_KEPT}` : PROFILE_PICTURE_KEPT;
	}
	return reason || 'Your profile could not be updated. Please try again.';
}

function profileSaveFailureReason(code: string, stage: ProfileSaveStage | undefined) {
	switch (code) {
		case 'invalid-profile-avatar':
			return 'The existing profile picture is not a valid image reference. Choose a new picture and try again.';
		case 'invalid-profile-avatar-type':
			return 'Choose a PNG, JPEG, WebP, or GIF image.';
		case 'invalid-profile-avatar-size':
			return 'Choose an image smaller than 10 MB.';
		case 'wallet-account-changed':
			return 'The connected wallet changed. Return to your current wallet profile and try again.';
		case 'wallet-sign-unavailable':
			return 'Connect an Arweave wallet that can sign transactions.';
	}
	// The wallet's own sign call failed or was declined: nothing from this step was posted.
	if (stage === 'picture-signing') return 'Your wallet did not approve the picture, so nothing was uploaded.';
	if (stage === 'profile-signing') return 'Your wallet did not approve the profile.';
	return '';
}

/** Window event announcing a saved profile, so every mounted identity view shows it at once. */
export const PROFILE_UPDATED_EVENT = 'bazar:profile-updated';

export type ProfileUpdatedDetail = { address: string; profile: AccountProfile };

/** A profile read result, keyed by the address it was read for. */
export type LoadedAccountProfile = { address: string; profile: AccountProfile | null };

/** The summary for `address`; a profile loaded for any other address contributes nothing. */
export function profileSummaryFor(address: string, loaded: LoadedAccountProfile | undefined): ProfileSummary {
	const profile = loaded?.address === address ? loaded.profile : undefined;
	const displayName = profileDisplayName(profile);
	const avatar = profileAvatarUrl(profile);
	return { address, ...(displayName ? { displayName } : {}), ...(avatar ? { avatar } : {}) };
}

export function profileUpdateMatches(event: Event, address: string): boolean {
	const detail = (event as CustomEvent<Partial<ProfileUpdatedDetail> | null>).detail;
	return Boolean(detail?.profile) && sameAccount(detail?.address, address);
}

export function announceProfileUpdated(target: EventTarget, address: string, profile: AccountProfile) {
	target.dispatchEvent(
		new CustomEvent<ProfileUpdatedDetail>(PROFILE_UPDATED_EVENT, { detail: { address, profile } })
	);
}

export function subscribeProfileUpdated(
	target: EventTarget,
	address: string,
	onUpdate: (profile: AccountProfile) => void
): () => void {
	const listener = (event: Event) => {
		if (profileUpdateMatches(event, address)) onUpdate((event as CustomEvent<ProfileUpdatedDetail>).detail.profile);
	};
	target.addEventListener(PROFILE_UPDATED_EVENT, listener);
	return () => target.removeEventListener(PROFILE_UPDATED_EVENT, listener);
}

export function useAccountProfileSummary(address: string): ProfileSummary {
	const [loaded, setLoaded] = React.useState<LoadedAccountProfile>();
	React.useEffect(() => {
		if (!/^[A-Za-z0-9_-]{43}$/.test(address)) {
			setLoaded(undefined);
			return;
		}
		const controller = new AbortController();
		// A saved profile wins over a read that was already in flight when it was announced.
		let announced = false;
		const unsubscribe = subscribeProfileUpdated(window, address, (profile) => {
			announced = true;
			setLoaded({ address, profile });
		});
		void readAccountProfile(address, { signal: controller.signal }).then(
			(profile) => {
				if (!controller.signal.aborted && !announced) setLoaded({ address, profile });
			},
			() => undefined
		);
		return () => {
			unsubscribe();
			controller.abort();
		};
	}, [address]);
	return profileSummaryFor(address, loaded);
}
