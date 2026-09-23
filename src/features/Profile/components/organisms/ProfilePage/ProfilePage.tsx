import React from 'react';
import { Camera, MapPin, Pencil } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Pressable } from 'components/atoms/Pressable';
import { ProfileAvatar, shortProfileAddress } from 'components/molecules/ProfileIdentity';
import type { ProfileSummary } from 'types/profile';

import './ProfileRoute.css';

export default function ProfilePage(props: {
	action?: React.ReactNode;
	children?: React.ReactNode;
	error?: string | null;
	isLoading?: boolean;
	onRetry?: () => void;
	onEdit?: (trigger: HTMLButtonElement) => void;
	profile: ProfileSummary;
}) {
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
