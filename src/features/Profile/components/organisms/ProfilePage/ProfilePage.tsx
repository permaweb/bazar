import React from 'react';
import { Camera, MapPin, Pencil } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Pressable } from 'components/atoms/Pressable';
import { ProfileAvatar, shortProfileAddress } from 'components/molecules/ProfileIdentity';
import { useMessages } from 'providers/LanguageProvider';
import type { ProfileSummary } from 'types/profile';

import './ProfileRoute.css';

import { PROFILE_MESSAGES } from '../../../messages';

export default function ProfilePage(props: {
	action?: React.ReactNode;
	children?: React.ReactNode;
	error?: string | null;
	isLoading?: boolean;
	onRetry?: () => void;
	onEdit?: (trigger: HTMLButtonElement) => void;
	profile: ProfileSummary;
}) {
	const messages = useMessages(PROFILE_MESSAGES);
	const name = props.profile.displayName?.trim() || shortProfileAddress(props.profile.address);

	return (
		<section className="profile-page">
			<section className="profile-page__hero" aria-labelledby="profile-page-title">
				<div className="profile-page__identity">
					{props.onEdit ? (
						<Pressable
							aria-label={messages.profilePageEditAvatarLabel}
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
						<p className="profile-page__eyebrow">{messages.profilePageEyebrow}</p>
						<div className="profile-page__title-row">
							<h1 id="profile-page-title">{name}</h1>
							{props.onEdit ? (
								<Button
									aria-label={messages.profilePageEditLabel}
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
					<MapPin aria-hidden="true" size={16} /> {messages.profilePageResolving}
				</div>
			) : null}
			{props.error ? (
				<div className="profile-page__notice profile-page__notice--error" role="alert">
					<span>{props.error}</span>
					{props.onRetry ? (
						<Pressable onClick={props.onRetry} type="button">
							{messages.profilePageRetry}
						</Pressable>
					) : null}
				</div>
			) : null}
			{props.children ? <section className="profile-page__content">{props.children}</section> : null}
		</section>
	);
}
