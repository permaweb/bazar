import React from 'react';
import { ReactSVG } from 'react-svg';

import Arweave from 'arweave';
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import AOProfile from '@permaweb/aoprofile';

import { Button } from 'components/atoms/Button';
import { FormField } from 'components/atoms/FormField';
import { Notification } from 'components/atoms/Notification';
import { TextArea } from 'components/atoms/TextArea';
import { ASSETS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { NotificationType } from 'helpers/types';
import { checkValidAddress } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { WalletBlock } from 'wallet/WalletBlock';

import * as S from './styles';
import { IProps } from './types';

const MAX_BIO_LENGTH = 500;
const MAX_IMAGE_SIZE = 100000;
const ALLOWED_BANNER_TYPES = 'image/png, image/jpeg, image/gif';
const ALLOWED_AVATAR_TYPES = 'image/png, image/jpeg, image/gif';

export default function ProfileManage(props: IProps) {
	const permawebProvider = usePermawebProvider();
	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const bannerInputRef = React.useRef<any>(null);
	const avatarInputRef = React.useRef<any>(null);

	const [name, setName] = React.useState<string>('');
	const [username, setUsername] = React.useState<string>('');
	const [bio, setBio] = React.useState<string | null>('');
	const [banner, setBanner] = React.useState<string | null>(null);
	const [avatar, setAvatar] = React.useState<string | null>(null);

	const [loading, setLoading] = React.useState<boolean>(false);
	const [profileResponse, setProfileResponse] = React.useState<NotificationType | null>(null);

	React.useEffect(() => {
		if (props.profile) {
			setUsername(props.profile.username || '');
			setName(props.profile.displayName || '');
			setBio(props.profile.description || '');
			setBanner(props.profile.banner && checkValidAddress(props.profile.banner) ? props.profile.banner : null);
			setAvatar(props.profile.thumbnail && checkValidAddress(props.profile.thumbnail) ? props.profile.thumbnail : null);
		}
	}, [props.profile]);

	function handleUpdate() {
		if (props.handleUpdate) props.handleUpdate();
	}

	async function handleSubmit() {
		if (arProvider.wallet) {
			setLoading(true);

			const ao = connect({ MODE: 'legacy' });
			const signer = createDataItemSigner(arProvider.wallet);

			const { updateProfile } = AOProfile.init({
				ao,
				signer,
				arweave: Arweave.init({}),
			});

			let data: any = {
				username: username,
				displayName: name,
				description: bio,
			};

			if (avatar) data.thumbnail = avatar;
			if (banner) data.banner = banner;

			try {
				if (props.profile && props.profile.id) {
					let updateResponse = null;
					if (props.profile.isLegacyProfile) {
						updateResponse = await updateProfile({
							profileId: props.profile.id,
							data: {
								userName: username,
								displayName: name,
								description: bio,
								thumbnail: avatar,
								banner: banner,
							},
						});
					} else {
						updateResponse = await permawebProvider.libs.updateProfile(data, props.profile.id, (status: any) =>
							console.log(status)
						);
					}

					if (updateResponse) {
						setProfileResponse({
							message: `${language.profileUpdated}!`,
							status: 'success',
						});
						handleUpdate();
					} else {
						console.log(updateResponse);
						setProfileResponse({
							message: language.errorUpdatingProfile,
							status: 'warning',
						});
					}
				} else {
					const profileId = await permawebProvider.libs.createProfile(data, (status: any) => console.log(status));

					console.log(`Profile ID: ${profileId}`);

					if (profileId) {
						setProfileResponse({
							message: `${language.profileCreated}!`,
							status: 'success',
						});
						permawebProvider.handleInitialProfileCache(arProvider.walletAddress, profileId);
						handleUpdate();
					} else {
						setProfileResponse({
							message: language.errorUpdatingProfile,
							status: 'warning',
						});
					}
				}
			} catch (e: any) {
				console.log(e);
				setProfileResponse({
					message: e.message ?? e,
					status: 'warning',
				});
			}
			setLoading(false);
		}
	}

	function getImageSizeMessage() {
		if (!avatar && !banner) return null;
		if (checkValidAddress(avatar) && checkValidAddress(banner)) return null;

		const avatarSize = avatar ? (avatar.length * 3) / 4 : 0;
		const bannerSize = banner ? (banner.length * 3) / 4 : 0;

		if (avatarSize > MAX_IMAGE_SIZE || bannerSize > MAX_IMAGE_SIZE)
			return <span>One or more images exceeds max size of 100KB</span>;
		return null;
	}

	function getInvalidBio() {
		if (bio && bio.length > MAX_BIO_LENGTH) {
			return {
				status: true,
				message: `${language.maxCharsReached} (${bio.length} / ${MAX_BIO_LENGTH})`,
			};
		}
		return { status: false, message: null };
	}

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, type: 'banner' | 'avatar') {
		if (e.target.files && e.target.files.length) {
			const file = e.target.files[0];
			if (file.type.startsWith('image/')) {
				const reader = new FileReader();

				reader.onload = (event: ProgressEvent<FileReader>) => {
					if (event.target?.result) {
						switch (type) {
							case 'banner':
								setBanner(event.target.result as any);
								break;
							case 'avatar':
								setAvatar(event.target.result as any);
								break;
							default:
								break;
						}
					}
				};

				reader.readAsDataURL(file);
			}
			e.target.value = '';
		}
	}

	function getBannerWrapper() {
		if (banner) return <img src={checkValidAddress(banner) ? getTxEndpoint(banner) : banner} />;
		return (
			<>
				<ReactSVG src={ASSETS.media} />
				<span>{language.uploadBanner}</span>
			</>
		);
	}

	function getAvatarWrapper() {
		if (avatar) return <img src={checkValidAddress(avatar) ? getTxEndpoint(avatar) : avatar} />;
		return (
			<>
				<ReactSVG src={ASSETS.user} />
				<span>{language.uploadAvatar}</span>
			</>
		);
	}

	function getConnectedView() {
		if (!arProvider.walletAddress) return <WalletBlock />;
		else {
			return (
				<>
					<S.Wrapper>
						<S.Body>
							<S.PWrapper>
								<S.BWrapper>
									<S.BInput
										hasBanner={banner !== null}
										onClick={() => bannerInputRef.current.click()}
										disabled={loading}
									>
										{getBannerWrapper()}
									</S.BInput>
									<input
										ref={bannerInputRef}
										type={'file'}
										onChange={(e: any) => handleFileChange(e, 'banner')}
										disabled={loading}
										accept={ALLOWED_BANNER_TYPES}
									/>
									<S.AInput
										hasAvatar={avatar !== null}
										onClick={() => avatarInputRef.current.click()}
										disabled={loading}
									>
										{getAvatarWrapper()}
									</S.AInput>
									<input
										ref={avatarInputRef}
										type={'file'}
										onChange={(e: any) => handleFileChange(e, 'avatar')}
										disabled={loading}
										accept={ALLOWED_AVATAR_TYPES}
									/>
								</S.BWrapper>
								<S.PActions>
									<Button
										type={'primary'}
										label={language.removeAvatar}
										handlePress={() => setAvatar(null)}
										disabled={loading || !avatar}
									/>
									<Button
										type={'primary'}
										label={language.removeBanner}
										handlePress={() => setBanner(null)}
										disabled={loading || !banner}
									/>
								</S.PActions>
								<S.PInfoMessage>
									<span>Images have a max size of 100KB</span>
								</S.PInfoMessage>
							</S.PWrapper>
							<S.Form>
								<S.TForm>
									<FormField
										label={language.name}
										value={name}
										onChange={(e: any) => setName(e.target.value)}
										disabled={loading}
										invalid={{ status: false, message: null }}
										required
										hideErrorMessage
									/>
									<FormField
										label={language.username}
										value={username}
										onChange={(e: any) => setUsername(e.target.value)}
										disabled={loading}
										invalid={{ status: false, message: null }}
										hideErrorMessage
										required
									/>
								</S.TForm>
								<TextArea
									label={language.bio}
									value={bio || ''}
									onChange={(e: any) => setBio(e.target.value)}
									disabled={loading}
									invalid={getInvalidBio()}
								/>
							</S.Form>
							<S.SAction>
								{props.handleClose && (
									<Button
										type={'primary'}
										label={language.close}
										handlePress={() => props.handleClose(true)}
										disabled={loading}
										loading={false}
									/>
								)}
								<Button
									type={'alt1'}
									label={language.save}
									handlePress={handleSubmit}
									disabled={!username || !name || loading || getImageSizeMessage() !== null}
									loading={loading}
								/>
							</S.SAction>
							<S.MInfoWrapper>{getImageSizeMessage()}</S.MInfoWrapper>
						</S.Body>
					</S.Wrapper>
					{profileResponse && (
						<Notification
							message={profileResponse.message}
							type={profileResponse.status}
							callback={() => setProfileResponse(null)}
						/>
					)}
				</>
			);
		}
	}

	return getConnectedView();
}
