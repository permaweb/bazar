import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { getProfile, sendMessage } from 'api';

import { Button } from 'components/atoms/Button';
import { Checkbox } from 'components/atoms/Checkbox';
import { FormField } from 'components/atoms/FormField';
import { Notification } from 'components/atoms/Notification';
import { TextArea } from 'components/atoms/TextArea';
import { Modal } from 'components/molecules/Modal';
import { ASSETS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { ProfileHeaderType } from 'helpers/types';
import { checkValidAddress } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { WalletBlock } from 'wallet/WalletBlock';

import * as S from './styles';
import { IProps } from './types';

const MAX_BIO_LENGTH = 500;
const ALLOWED_BANNER_TYPES = 'image/png, image/jpeg, image/gif';
const ALLOWED_AVATAR_TYPES = 'image/png, image/jpeg, image/gif';

// TODO: pass profile as prop
export default function ProfileManage(props: IProps) {
	const navigate = useNavigate();

	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const bannerInputRef = React.useRef<any>(null);
	const avatarInputRef = React.useRef<any>(null);

	const [username, setUsername] = React.useState<string>('');
	const [displayName, setDisplayName] = React.useState<string>('');
	const [bio, setBio] = React.useState<string>('');
	const [banner, setBanner] = React.useState<any>(null);
	const [avatar, setAvatar] = React.useState<any>(null);
	const [usernameAsDisplayName, setUsernameAsDisplayName] = React.useState<boolean>(true);

	const [loading, setLoading] = React.useState<boolean>(false);
	const [fullProfile, setFullProfile] = React.useState<ProfileHeaderType | null>(null);
	const [profileResponse, setProfileResponse] = React.useState<string | null>(null);

	// const [profileExists, setProfileExists] = React.useState<boolean>(false);

	React.useEffect(() => {
		(async function () {
			if (!props.initial && arProvider.walletAddress) {
				setFullProfile(await getProfile({ address: arProvider.walletAddress }));
			}
		})();
	}, [props.initial, arProvider.walletAddress]);

	React.useEffect(() => {
		if (fullProfile) {
			setUsername(fullProfile.username ?? '');
			setDisplayName(fullProfile.displayName ?? '');
			setBio(fullProfile.bio ?? '');
			setBanner(fullProfile.banner ?? null);
			setAvatar(fullProfile.avatar ?? null);
			setUsernameAsDisplayName(false);
		}
	}, [fullProfile]);

	// React.useEffect(() => {
	// 	(async function () {
	// 		if (connectedProfile && connectedProfile.walletAddress) {
	// 			try {
	// 				setProfileExists((await getCurrentProfile({ address: connectedProfile.walletAddress })).txId !== null);
	// 			} catch (e: any) {
	// 				console.error(e);
	// 			}
	// 		}
	// 	})();
	// }, [connectedProfile]);

	React.useEffect(() => {
		if (usernameAsDisplayName) setDisplayName(username);
	}, [usernameAsDisplayName, username]);

	async function handleSubmit() {
		if (arProvider.wallet) {
			setLoading(true);
			let updateResponse = await sendMessage({
				processId: fullProfile.id,
				action: 'Update-Profile',
				data: {
					Username: username,
				},
				wallet: arProvider.wallet,
			});
			console.log(updateResponse);
			setLoading(false);
		}
		// if (connectedProfile && connectedProfile.walletAddress && username && displayName) {
		// 	setLoading(true);
		// 	try {
		// 		await updateProfile({
		// 			address: connectedProfile.walletAddress,
		// 			displayName: displayName,
		// 			username: username,
		// 			avatar: avatar,
		// 			banner: banner,
		// 			bio: bio,
		// 		});
		// 		setProfileResponse(language.profileUpdated);
		// 	} catch (e: any) {
		// 		setProfileResponse(e.message ?? e);
		// 	}
		// 	setLoading(false);
		// }
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
								setBanner(event.target.result);
								break;
							case 'avatar':
								setAvatar(event.target.result);
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
										disabled={loading || (!props.initial && !fullProfile)}
									>
										{getBannerWrapper()}
									</S.BInput>
									<input
										ref={bannerInputRef}
										type={'file'}
										onChange={(e: any) => handleFileChange(e, 'banner')}
										disabled={loading || (!props.initial && !fullProfile)}
										accept={ALLOWED_BANNER_TYPES}
									/>
									<S.AInput
										hasAvatar={avatar !== null}
										onClick={() => avatarInputRef.current.click()}
										disabled={loading || (!props.initial && !fullProfile)}
									>
										{getAvatarWrapper()}
									</S.AInput>
									<input
										ref={avatarInputRef}
										type={'file'}
										onChange={(e: any) => handleFileChange(e, 'avatar')}
										disabled={loading || (!props.initial && !fullProfile)}
										accept={ALLOWED_AVATAR_TYPES}
									/>
								</S.BWrapper>
								<S.PActions>
									<Button
										type={'primary'}
										label={language.removeAvatar}
										handlePress={() => setAvatar(null)}
										disabled={loading || !avatar || (!props.initial && !fullProfile)}
									/>
									<Button
										type={'primary'}
										label={language.removeBanner}
										handlePress={() => setBanner(null)}
										disabled={loading || !banner || (!props.initial && !fullProfile)}
									/>
								</S.PActions>
							</S.PWrapper>
							<S.Form>
								<S.TForm className={'border-wrapper-alt2'}>
									<FormField
										label={language.username}
										value={username}
										onChange={(e: any) => setUsername(e.target.value)}
										disabled={loading || (!props.initial && !fullProfile)}
										invalid={{ status: false, message: null }}
										hideErrorMessage
										required
									/>
									<FormField
										label={language.name}
										value={displayName}
										onChange={(e: any) => setDisplayName(e.target.value)}
										disabled={loading || (!props.initial && !fullProfile) || usernameAsDisplayName}
										invalid={{ status: false, message: null }}
										required
										hideErrorMessage
									/>
									<S.CWrapper>
										<span>{language.usernameAsDisplayName}</span>
										<div className={'c-wrapper-checkbox'}>
											<Checkbox
												checked={usernameAsDisplayName}
												handleSelect={() => setUsernameAsDisplayName(!usernameAsDisplayName)}
												disabled={loading}
											/>
										</div>
									</S.CWrapper>
								</S.TForm>
								<TextArea
									label={language.bio}
									value={bio}
									onChange={(e: any) => setBio(e.target.value)}
									disabled={loading || (!props.initial && !fullProfile)}
									invalid={getInvalidBio()}
								/>
							</S.Form>
							<S.SAction>
								<Button
									type={'primary'}
									label={language.close}
									handlePress={() => props.handleClose(true)}
									disabled={loading}
									loading={loading || (!props.initial && !fullProfile)}
								/>
								<Button
									type={'alt1'}
									label={language.save}
									handlePress={handleSubmit}
									disabled={!username || !displayName || loading}
									loading={loading || (!props.initial && !fullProfile)}
								/>
							</S.SAction>
						</S.Body>
					</S.Wrapper>
					{profileResponse && <Notification message={profileResponse} callback={() => setProfileResponse(null)} />}
					{/* {profileExists && props.initial && (
						<Modal header={language.profileExists} handleClose={null}>
							<S.MWrapper>
								<S.MInfo>
									<span>{language.profileExistsInfo}</span>
								</S.MInfo>
								<S.MActions>
									{arProvider.walletAddress && (
										<Button
											type={'alt1'}
											label={language.viewProfile}
											handlePress={() => navigate(URLS.profileAssets(arProvider.walletAddress))}
											disabled={false}
											formSubmit
										/>
									)}
								</S.MActions>
							</S.MWrapper>
						</Modal>
					)} */}
				</>
			);
		}
	}

	return getConnectedView();
}
