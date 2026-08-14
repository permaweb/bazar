import React from 'react';

import { profileAvatarUrl, profileDisplayName, readAccountProfile } from 'api/profile';

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

export function useAccountProfileSummary(address: string): ProfileSummary {
	const [profile, setProfile] = React.useState<Awaited<ReturnType<typeof readAccountProfile>>>();
	React.useEffect(() => {
		if (!/^[A-Za-z0-9_-]{43}$/.test(address)) {
			setProfile(undefined);
			return;
		}
		const controller = new AbortController();
		void readAccountProfile(address, { signal: controller.signal }).then(
			(value) => {
				if (!controller.signal.aborted) setProfile(value);
			},
			() => undefined
		);
		return () => controller.abort();
	}, [address]);
	return {
		address,
		...(profileDisplayName(profile) ? { displayName: profileDisplayName(profile) } : {}),
		...(profileAvatarUrl(profile) ? { avatar: profileAvatarUrl(profile) } : {}),
	};
}
