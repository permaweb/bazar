import React from 'react';
import { Camera, MapPin, Pencil } from 'lucide-react';

import { Icon } from 'components/atoms/Icon';
import { Pressable } from 'components/atoms/Pressable';
import { ProfileAvatar, shortProfileAddress } from 'components/molecules/ProfileIdentity';
import { useMessages } from 'providers/LanguageProvider';
import type { ProfileSummary } from 'types/profile';

import { PROFILE_MESSAGES } from '../../../messages';

import * as S from './styles';

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
		<S.Page className="profile-page">
			<S.Hero className="profile-page__hero" aria-labelledby="profile-page-title">
				<S.Identity className="profile-page__identity">
					{props.onEdit ? (
						<S.AvatarButton
							aria-label={messages.profilePageEditAvatarLabel}
							className="profile-page__avatar-button"
							onClick={(event) => props.onEdit?.(event.currentTarget)}
							type="button"
						>
							<ProfileAvatar className="profile-page__avatar" profile={props.profile} size="large" />
							<S.AvatarEdit aria-hidden="true" className="profile-page__avatar-edit">
								<Icon icon={Camera} />
							</S.AvatarEdit>
						</S.AvatarButton>
					) : (
						<ProfileAvatar className="profile-page__avatar" profile={props.profile} size="large" />
					)}
					<S.Heading className="profile-page__heading">
						<S.EyebrowText className="profile-page__eyebrow">{messages.profilePageEyebrow}</S.EyebrowText>
						<S.TitleRow className="profile-page__title-row">
							<h1 id="profile-page-title">{name}</h1>
							{props.onEdit ? (
								<S.EditButton
									aria-label={messages.profilePageEditLabel}
									className="profile-page__edit-button"
									onClick={(event) => props.onEdit?.(event.currentTarget)}
									size="icon"
									variant="ghost"
								>
									<Icon icon={Pencil} />
								</S.EditButton>
							) : null}
						</S.TitleRow>
						<S.Address className="profile-page__address" title={props.profile.address}>
							{props.profile.address}
						</S.Address>
					</S.Heading>
					{props.action ? <S.Action className="profile-page__action">{props.action}</S.Action> : null}
				</S.Identity>
				{props.profile.bio ? <S.Bio className="profile-page__bio">{props.profile.bio}</S.Bio> : null}
			</S.Hero>

			{props.isLoading ?? false ? (
				<S.Notice aria-live="polite" className="profile-page__notice">
					<MapPin aria-hidden="true" size={16} /> {messages.profilePageResolving}
				</S.Notice>
			) : null}
			{props.error ? (
				<S.Notice className="profile-page__notice profile-page__notice--error" role="alert">
					<span>{props.error}</span>
					{props.onRetry ? (
						<Pressable onClick={props.onRetry} type="button">
							{messages.profilePageRetry}
						</Pressable>
					) : null}
				</S.Notice>
			) : null}
			{props.children ? <S.Content className="profile-page__content">{props.children}</S.Content> : null}
		</S.Page>
	);
}
