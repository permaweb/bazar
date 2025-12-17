import React from 'react';
import { ReactSVG } from 'react-svg';

import Arweave from 'arweave';
import AOProfile from '@permaweb/aoprofile';

import { Button } from 'components/atoms/Button';
import { FormField } from 'components/atoms/FormField';
import { Notification } from 'components/atoms/Notification';
import { TextArea } from 'components/atoms/TextArea';
import { connect, createDataItemSigner } from 'helpers/aoconnect';
import { ASSETS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { NotificationType } from 'helpers/types';
import { checkValidAddress } from 'helpers/utils';
import { updateProfileMetadata } from 'helpers/profileUpdate';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useEvmWallet } from 'providers/EvmWalletProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { WalletBlock } from 'wallet/WalletBlock';

const debug = (..._args: any[]) => {};

import * as S from './styles';
import { IProps } from './types';

const MAX_BIO_LENGTH = 500;
const MAX_IMAGE_SIZE = 100000;
const ALLOWED_BANNER_TYPES = 'image/png, image/jpeg, image/gif';
const ALLOWED_AVATAR_TYPES = 'image/png, image/jpeg, image/gif';

export default function ProfileManage(props: IProps) {
	const permawebProvider = usePermawebProvider();
	const arProvider = useArweaveProvider();
	const evmWallet = useEvmWallet();

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
		// Determine wallet type: if Arweave wallet is connected, use Arweave; otherwise use EVM
		const isEvmProfile = !arProvider.walletAddress && evmWallet.evmAddress && props.profile?.id;

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'ProfileManage.tsx:67',
				message: 'handleSubmit: Determining wallet type',
				data: {
					hasArweave: !!arProvider.walletAddress,
					hasEvm: !!evmWallet.evmAddress,
					profileId: props.profile?.id,
					isEvmProfile,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run2',
				hypothesisId: 'K',
			}),
		}).catch(() => {});
		// #endregion

		if (isEvmProfile) {
			// EVM wallet profile update
			if (!evmWallet.evmAddress || !props.profile?.id) {
				setProfileResponse({
					message: 'Ethereum wallet not connected',
					status: 'warning',
				});
				return;
			}

			setLoading(true);
			try {
				const result = await updateProfileMetadata({
					profileId: props.profile.id,
					walletAddress: evmWallet.evmAddress,
					walletType: 'evm',
					metadata: {
						DisplayName: name,
						Username: username,
						Description: bio || undefined,
						Thumbnail: avatar || undefined,
						Banner: banner || undefined,
					},
				});

				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'ProfileManage.tsx:90',
						message: 'handleSubmit: EVM profile update result',
						data: { success: result.success, error: result.error },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run2',
						hypothesisId: 'I',
					}),
				}).catch(() => {});
				// #endregion

				if (result.success) {
					setProfileResponse({
						message: `${language.profileUpdated}!`,
						status: 'success',
					});
					handleUpdate();

					// For ETH profiles, manually fetch the updated profile
					// since refreshProfile() only works for Arweave wallets
					if (props.profile?.id) {
						// Wait for gateway to index the update (longer wait for EVM)
						setTimeout(async () => {
							try {
								// #region agent log
								fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										location: 'ProfileManage.tsx:115',
										message: 'Fetching updated ETH profile',
										data: { profileId: props.profile.id },
										timestamp: Date.now(),
										sessionId: 'debug-session',
										runId: 'run2',
										hypothesisId: 'R',
									}),
								}).catch(() => {});
								// #endregion

								const updatedProfile = await permawebProvider.libs.getProfileById(props.profile.id);

								// #region agent log
								fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										location: 'ProfileManage.tsx:120',
										message: 'Updated ETH profile fetched',
										data: {
											profileId: updatedProfile?.id,
											displayName: updatedProfile?.DisplayName,
											username: updatedProfile?.Username,
										},
										timestamp: Date.now(),
										sessionId: 'debug-session',
										runId: 'run2',
										hypothesisId: 'R',
									}),
								}).catch(() => {});
								// #endregion

								if (updatedProfile) {
									// Update local state to reflect the new profile data
									setName(updatedProfile.DisplayName || '');
									setUsername(updatedProfile.Username || '');
									setBio(updatedProfile.Description || '');
									setBanner(
										updatedProfile.Banner && checkValidAddress(updatedProfile.Banner) ? updatedProfile.Banner : null
									);
									setAvatar(
										updatedProfile.Thumbnail && checkValidAddress(updatedProfile.Thumbnail)
											? updatedProfile.Thumbnail
											: null
									);

									// For ETH profiles, the profile will be refreshed in WalletConnect
									// via the useEffect that watches ethProfileId
									// The updated profile data will show up in the navbar automatically

									// #region agent log
									fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
										method: 'POST',
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({
											location: 'ProfileManage.tsx:140',
											message: 'ETH profile updated successfully',
											data: {
												profileId: updatedProfile.id,
												displayName: updatedProfile.DisplayName,
												username: updatedProfile.Username,
											},
											timestamp: Date.now(),
											sessionId: 'debug-session',
											runId: 'run2',
											hypothesisId: 'R',
										}),
									}).catch(() => {});
									// #endregion

									// Trigger a re-fetch of the profile in WalletConnect by toggling a state
									// This will cause WalletConnect to re-fetch the profile data
									// We'll do this by calling handleUpdate which might trigger a refresh
									handleUpdate();
								}
							} catch (fetchError) {
								// #region agent log
								fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										location: 'ProfileManage.tsx:135',
										message: 'Error fetching updated ETH profile',
										data: { error: fetchError instanceof Error ? fetchError.message : 'Unknown error' },
										timestamp: Date.now(),
										sessionId: 'debug-session',
										runId: 'run2',
										hypothesisId: 'R',
									}),
								}).catch(() => {});
								// #endregion
								console.warn('Failed to fetch updated profile, but update was successful:', fetchError);
							}
						}, 5000); // Wait 5 seconds for gateway to index
					} else {
						// For Arweave profiles, use the standard refresh
						setTimeout(() => {
							permawebProvider.refreshProfile();
						}, 2000);
					}
				} else {
					setProfileResponse({
						message: result.error || language.errorUpdatingProfile,
						status: 'warning',
					});
				}
			} catch (e: any) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'ProfileManage.tsx:115',
						message: 'handleSubmit: EVM profile update error',
						data: { error: e.message },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run2',
						hypothesisId: 'I',
					}),
				}).catch(() => {});
				// #endregion
				setProfileResponse({
					message: e.message ?? e,
					status: 'warning',
				});
			} finally {
				setLoading(false);
			}
		} else if (arProvider.wallet) {
			// Arweave wallet profile update (original logic)
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
							debug(status)
						);
					}

					if (updateResponse) {
						setProfileResponse({
							message: `${language.profileUpdated}!`,
							status: 'success',
						});
						permawebProvider.refreshProfile();
						handleUpdate();
					} else {
						debug(updateResponse);
						setProfileResponse({
							message: language.errorUpdatingProfile,
							status: 'warning',
						});
					}
				} else {
					const profileId = await permawebProvider.libs.createProfile(data, (status: any) => debug(status));

					debug(`Profile ID: ${profileId}`);

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
				debug(e);
				setProfileResponse({
					message: e.message ?? e,
					status: 'warning',
				});
			}
			setLoading(false);
		} else {
			setProfileResponse({
				message: 'No wallet connected',
				status: 'warning',
			});
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
		// Show wallet connection prompt only if neither Arweave nor EVM wallet is connected
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'ProfileManage.tsx:291',
				message: 'getConnectedView: Checking wallet connection',
				data: { hasArweave: !!arProvider.walletAddress, hasEvm: !!evmWallet.evmAddress, profileId: props.profile?.id },
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run2',
				hypothesisId: 'J',
			}),
		}).catch(() => {});
		// #endregion
		if (!arProvider.walletAddress && !evmWallet.evmAddress) return <WalletBlock />;
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
