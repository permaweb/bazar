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
