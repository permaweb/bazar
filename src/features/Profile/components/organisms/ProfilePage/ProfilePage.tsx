import React from 'react';
import { Camera, MapPin, Pencil } from 'lucide-react';

import { PROFILE_AVATAR_CONTENT_TYPES, PROFILE_AVATAR_MAX_BYTES } from 'api/profile';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Pressable } from 'components/atoms/Pressable';
import { ProfileAvatar, shortProfileAddress } from 'components/molecules/ProfileIdentity';
import type { ProfileSummary } from 'types/profile';

import './ProfileRoute.css';

export type ProfileRouteProps = {
	action?: React.ReactNode;
	children?: React.ReactNode;
	error?: string | null;
	isLoading?: boolean;
	onRetry?: () => void;
	onEdit?: (trigger: HTMLButtonElement) => void;
	profile: ProfileSummary;
};

export default function ProfilePage(props: ProfileRouteProps) {
	const name = props.profile.displayName?.trim() || shortProfileAddress(props.profile.address);

	return (
		<section className="profile-page">
			<section className="profile-page__hero" aria-labelledby="profile-page-title">
				<div className="profile-page__identity">
					{props.onEdit ? (
						<Pressable
							aria-label="Edit profile picture"
							className="profile-page__avatar-button"
							onClick={(event) => props.onEdit?.(event.currentTarget)}
							type="button"
						>
							<ProfileAvatar className="profile-page__avatar" profile={props.profile} size="large" />
							<span aria-hidden="true" className="profile-page__avatar-edit">
								<Icon icon={Camera} />
							</span>
						</Pressable>
					) : (
						<ProfileAvatar className="profile-page__avatar" profile={props.profile} size="large" />
					)}
					<div className="profile-page__heading">
						<p className="profile-page__eyebrow">Arweave profile</p>
						<div className="profile-page__title-row">
							<h1 id="profile-page-title">{name}</h1>
							{props.onEdit ? (
								<Button
									aria-label="Edit profile"
									className="profile-page__edit-button"
									onClick={(event) => props.onEdit?.(event.currentTarget)}
									size="icon"
									variant="ghost"
								>
									<Icon icon={Pencil} />
								</Button>
							) : null}
						</div>
						<p className="profile-page__address" title={props.profile.address}>
							{props.profile.address}
						</p>
					</div>
					{props.action ? <div className="profile-page__action">{props.action}</div> : null}
				</div>
				{props.profile.bio ? <p className="profile-page__bio">{props.profile.bio}</p> : null}
			</section>

			{props.isLoading ?? false ? (
				<div aria-live="polite" className="profile-page__notice">
					<MapPin aria-hidden="true" size={16} /> Resolving this profile from Arweave…
				</div>
			) : null}
			{props.error ? (
				<div className="profile-page__notice profile-page__notice--error" role="alert">
					<span>{props.error}</span>
					{props.onRetry ? (
						<Pressable onClick={props.onRetry} type="button">
							Retry
						</Pressable>
					) : null}
				</div>
			) : null}
			{props.children ? <section className="profile-page__content">{props.children}</section> : null}
		</section>
	);
}

export type ProfileEditUpdate = {
	displayName: string;
	displayNameChanged: boolean;
	avatarFile: File | null;
	removeAvatar: boolean;
};

export function profileImageError(file: File) {
	if (!PROFILE_AVATAR_CONTENT_TYPES.includes(file.type)) return 'Choose a PNG, JPEG, WebP, or GIF image.';
	if (!file.size || file.size > PROFILE_AVATAR_MAX_BYTES) return 'Choose an image smaller than 10 MB.';
	return '';
}

export function profileUpdateError(cause: unknown) {
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
