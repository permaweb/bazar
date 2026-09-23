import React from 'react';

import type { ProfileSummary } from 'types/profile';

import * as S from './styles';

export type ProfileIdentityProps = {
	className?: string;
	href?: string;
	/** The link's accessible name, already resolved: a molecule may not read the language provider. */
	label: string;
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

/** How a profile names itself to assistive technology: its display name with the full address, or the address. */
export function profileAccessibleName(profile: ProfileSummary) {
	const displayName = profile.displayName?.trim();
	return displayName ? `${displayName}, ${profile.address}` : profile.address;
}

function profileInitial(profile: ProfileSummary) {
	return (profile.displayName?.trim() || profile.address).slice(0, 1);
}

export function ProfileAvatar(props: Pick<ProfileIdentityProps, 'className' | 'profile' | 'size'>) {
	const [imageFailed, setImageFailed] = React.useState(false);
	const classes = ['profile-avatar', `profile-avatar--${props.size ?? 'medium'}`, props.className ?? '']
		.filter(Boolean)
		.join(' ');

	if (props.profile.avatar && !imageFailed) {
		return (
			<S.Avatar $size={props.size ?? 'medium'} className={classes} data-profile-address={props.profile.address}>
				<img
					alt=""
					decoding="async"
					loading="lazy"
					onError={() => setImageFailed(true)}
					src={props.profile.avatar}
				/>
			</S.Avatar>
		);
	}

	return (
		<S.Avatar
			$fallback
			$size={props.size ?? 'medium'}
			aria-hidden="true"
			className={`${classes} profile-avatar--fallback`}
		>
			{profileInitial(props.profile)}
		</S.Avatar>
	);
}

export default function ProfileIdentity(props: ProfileIdentityProps) {
	const displayName = props.profile.displayName?.trim();
	const address = shortProfileAddress(props.profile.address);

	return (
		<S.Identity
			$size={props.size ?? 'small'}
			aria-label={props.label}
			className={['profile-identity', `profile-identity--${props.size ?? 'small'}`, props.className ?? '']
				.filter(Boolean)
				.join(' ')}
			href={props.href ?? profilePath(props.profile.address)}
		>
			{props.showAvatar ?? false ? <ProfileAvatar profile={props.profile} size={props.size ?? 'small'} /> : null}
			<S.Label className="profile-identity__label">
				{displayName ? <S.Name className="profile-identity__name">{displayName}</S.Name> : null}
				<S.Address className="profile-identity__address">{displayName ? `(${address})` : address}</S.Address>
			</S.Label>
		</S.Identity>
	);
}
