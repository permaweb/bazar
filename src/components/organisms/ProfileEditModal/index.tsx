import React from 'react';
import { Button } from 'components/atoms/Button';
import { FormField } from 'components/atoms/FormField';
import { IconButton } from 'components/atoms/IconButton';
import { Loader } from 'components/atoms/Loader';
import { Notification } from 'components/atoms/Notification';
import { TextArea } from 'components/atoms/TextArea';
import { ASSETS } from 'helpers/config';
import { updateProfileMetadata } from 'helpers/profileUpdate';
import { NotificationType, ProfileType } from 'helpers/types';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { CloseHandler } from 'wrappers/CloseHandler';

import * as S from './styles';

interface IProps {
	profile: ProfileType | null;
	walletAddress: string;
	walletType: 'arweave' | 'evm';
	isOpen: boolean;
	onClose: () => void;
}

const MAX_BIO_LENGTH = 500;

export function ProfileEditModal(props: IProps) {
	const permawebProvider = usePermawebProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [displayName, setDisplayName] = React.useState<string>('');
	const [username, setUsername] = React.useState<string>('');
	const [bio, setBio] = React.useState<string>('');
	const [loading, setLoading] = React.useState<boolean>(false);
	const [notification, setNotification] = React.useState<NotificationType | null>(null);

	React.useEffect(() => {
		if (props.profile) {
			setDisplayName(props.profile.DisplayName || '');
			setUsername(props.profile.Username || '');
			setBio(props.profile.Description || '');
		}
	}, [props.profile]);

	const handleSubmit = async () => {
		if (!props.profile?.id) return;

		setLoading(true);
		setNotification(null);

		try {
			const result = await updateProfileMetadata({
				profileId: props.profile.id,
				walletAddress: props.walletAddress,
				walletType: props.walletType,
				metadata: {
					DisplayName: displayName,
					Username: username,
					Description: bio,
				},
			});

			if (result.success) {
				setNotification({
					message: `${language.profileUpdated}!`,
					status: 'success',
				});
				permawebProvider.refreshProfile();
				setTimeout(() => {
					props.onClose();
				}, 1500);
			} else {
				setNotification({
					message: result.error || language.errorUpdatingProfile,
					status: 'warning',
				});
			}
		} catch (error) {
			console.error('Profile update error:', error);
			setNotification({
				message: error instanceof Error ? error.message : language.errorUpdatingProfile,
				status: 'warning',
			});
		} finally {
			setLoading(false);
		}
	};

	if (!props.isOpen) return null;

	return (
		<S.Overlay>
			<CloseHandler active={props.isOpen} disabled={!props.isOpen} callback={props.onClose}>
				<S.Modal>
					<S.Header>
						<S.Title>{language.editProfile}</S.Title>
						<IconButton
							type={'primary'}
							src={ASSETS.close}
							handlePress={props.onClose}
							dimensions={{ wrapper: 32, icon: 16 }}
							tooltip={language.close}
						/>
					</S.Header>

					<S.Content>
						<FormField
							label={language.name}
							value={displayName}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
							disabled={loading}
							invalid={{ status: false, message: null }}
						/>

						<FormField
							label={language.username}
							value={username}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
							disabled={loading}
							invalid={{ status: false, message: null }}
						/>

						<S.TextAreaWrapper>
							<TextArea
								label={language.bio}
								value={bio}
								onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
									if (e.target.value.length <= MAX_BIO_LENGTH) {
										setBio(e.target.value);
									}
								}}
								disabled={loading}
								invalid={{ status: false, message: null }}
							/>
							<S.CharCount>
								{bio.length}/{MAX_BIO_LENGTH}
							</S.CharCount>
						</S.TextAreaWrapper>

						{notification && (
							<Notification
								message={notification.message}
								type={notification.status}
								callback={() => setNotification(null)}
							/>
						)}
					</S.Content>

					<S.Footer>
						<Button type={'alt2'} label={language.cancel} handlePress={props.onClose} disabled={loading} height={40} />
						<Button
							type={'primary'}
							label={loading ? <Loader /> : language.save}
							handlePress={handleSubmit}
							disabled={loading || !displayName.trim()}
							height={40}
						/>
					</S.Footer>
				</S.Modal>
			</CloseHandler>
		</S.Overlay>
	);
}
