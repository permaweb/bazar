import React from 'react';
import { ReactSVG } from 'react-svg';
import { Button } from 'components/atoms/Button';
import { Notification } from 'components/atoms/Notification';
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

const MAX_IMAGE_SIZE = 100000; // 100KB
const ALLOWED_IMAGE_TYPES = 'image/png, image/jpeg, image/gif';

export default function CollectionManage(props: IProps) {
	const permawebProvider = usePermawebProvider();
	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const bannerInputRef = React.useRef<any>(null);
	const thumbnailInputRef = React.useRef<any>(null);

	const [banner, setBanner] = React.useState<string | null>(null);
	const [thumbnail, setThumbnail] = React.useState<string | null>(null);

	const [loading, setLoading] = React.useState<boolean>(false);
	const [collectionResponse, setCollectionResponse] = React.useState<NotificationType | null>(null);

	React.useEffect(() => {
		if (props.collection) {
			setBanner(props.collection.banner && checkValidAddress(props.collection.banner) ? props.collection.banner : null);
			setThumbnail(
				props.collection.thumbnail && checkValidAddress(props.collection.thumbnail) ? props.collection.thumbnail : null
			);
		}
	}, [props.collection]);

	function handleUpdate() {
		if (props.handleUpdate) props.handleUpdate();
	}

	async function handleSubmit() {
		if (arProvider.wallet && props.collection?.id) {
			setLoading(true);
			setCollectionResponse(null);

			try {
				// Upload images to Arweave if they are new (not already transaction IDs)
				let bannerTxId: string | null = null;
				let thumbnailTxId: string | null = null;

				// Resolve banner if it's a new image (data URL)
				if (banner && !checkValidAddress(banner)) {
					bannerTxId = await permawebProvider.libs.resolveTransaction(banner);
				} else if (banner && checkValidAddress(banner)) {
					bannerTxId = banner;
				}

				// Resolve thumbnail if it's a new image (data URL)
				if (thumbnail && !checkValidAddress(thumbnail)) {
					thumbnailTxId = await permawebProvider.libs.resolveTransaction(thumbnail);
				} else if (thumbnail && checkValidAddress(thumbnail)) {
					thumbnailTxId = thumbnail;
				}

				// Use Eval to directly update Banner and Thumbnail variables, then sync state to HyperBEAM
				// This follows the same pattern as ActivityProcess updates (line 137 in collections.ts)
				// We use Send() directly since syncState() is a local function not available in Eval context
				const { message } = await import('helpers/aoconnect');
				const { createDataItemSigner } = await import('helpers/aoconnect');
				const signer = createDataItemSigner(arProvider.wallet);
				let hasUpdates = false;

				// Build Eval code to update variables and sync state
				const evalLines: string[] = [];

				// Update Banner if changed
				if (bannerTxId && bannerTxId !== props.collection.banner) {
					evalLines.push(`Banner = '${bannerTxId}'`);
					hasUpdates = true;
				}

				// Update Thumbnail if changed
				if (thumbnailTxId && thumbnailTxId !== props.collection.thumbnail) {
					evalLines.push(`Thumbnail = '${thumbnailTxId}'`);
					hasUpdates = true;
				}

				// Only send if there are updates
				if (hasUpdates) {
					// Call Send directly to sync state with HyperBEAM
					// syncState() is a local function not available in Eval, so we construct the Send call manually
					// We'll build the state object in JavaScript, encode it to JSON, then pass it to Lua

					// Build the state object with updated values
					const stateObj = {
						Name: props.collection.title || '',
						Description: props.collection.description || '',
						Creator: props.collection.creator || '',
						Banner: bannerTxId || props.collection.banner || '',
						Thumbnail: thumbnailTxId || props.collection.thumbnail || '',
						DateCreated: props.collection.dateCreated || '',
						Assets: props.collection.assetIds || [],
						ActivityProcess: props.collection.activityProcess || '',
					};

					// Encode to JSON string in JavaScript
					const stateJson = JSON.stringify(stateObj);

					// Escape single quotes for Lua string
					const escapedJson = stateJson.replace(/'/g, "\\'");

					// Build Eval code: update variables and sync state to HyperBEAM
					// We pass the JSON string directly to Send (encoded in JavaScript, not Lua)
					const evalCode = `${evalLines.join('\n')}\nSend({ device = 'patch@1.0', collection = '${escapedJson}' })`;

					try {
						// Send Eval message to update variables and sync state
						const messageId = await message({
							process: props.collection.id,
							signer: signer,
							tags: [{ name: 'Action', value: 'Eval' }],
							data: evalCode,
						});

						setCollectionResponse({
							message: 'Collection images updated successfully! State is syncing...',
							status: 'success',
						});
						// Wait a bit for state to sync before refreshing
						await new Promise((resolve) => setTimeout(resolve, 5000));
						handleUpdate();
					} catch (evalError: any) {
						console.error('Eval error:', evalError);
						setCollectionResponse({
							message: evalError.message ?? 'Failed to update collection images',
							status: 'warning',
						});
					}
				} else {
					setCollectionResponse({
						message: 'No changes to save',
						status: 'warning',
					});
				}
			} catch (e: any) {
				console.error('Error updating collection:', e);
				setCollectionResponse({
					message: e.message ?? 'Failed to update collection images',
					status: 'warning',
				});
			}
			setLoading(false);
		}
	}

	function getImageSizeMessage() {
		if (!thumbnail && !banner) return null;
		if (checkValidAddress(thumbnail) && checkValidAddress(banner)) return null;

		const thumbnailSize = thumbnail ? (thumbnail.length * 3) / 4 : 0;
		const bannerSize = banner ? (banner.length * 3) / 4 : 0;

		if (thumbnailSize > MAX_IMAGE_SIZE || bannerSize > MAX_IMAGE_SIZE)
			return <span>One or more images exceeds max size of 100KB</span>;
		return null;
	}

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, type: 'banner' | 'thumbnail') {
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
							case 'thumbnail':
								setThumbnail(event.target.result as any);
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
				<span>Upload Banner</span>
			</>
		);
	}

	function getThumbnailWrapper() {
		if (thumbnail) return <img src={checkValidAddress(thumbnail) ? getTxEndpoint(thumbnail) : thumbnail} />;
		return (
			<>
				<ReactSVG src={ASSETS.media} />
				<span>Upload Thumbnail</span>
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
										accept={ALLOWED_IMAGE_TYPES}
									/>
									<S.AInput
										hasAvatar={thumbnail !== null}
										onClick={() => thumbnailInputRef.current.click()}
										disabled={loading}
									>
										{getThumbnailWrapper()}
									</S.AInput>
									<input
										ref={thumbnailInputRef}
										type={'file'}
										onChange={(e: any) => handleFileChange(e, 'thumbnail')}
										disabled={loading}
										accept={ALLOWED_IMAGE_TYPES}
									/>
								</S.BWrapper>
								<S.PActions>
									<Button
										type={'primary'}
										label={'Remove Thumbnail'}
										handlePress={() => setThumbnail(null)}
										disabled={loading || !thumbnail}
									/>
									<Button
										type={'primary'}
										label={'Remove Banner'}
										handlePress={() => setBanner(null)}
										disabled={loading || !banner}
									/>
								</S.PActions>
								<S.PInfoMessage>
									<span>Images have a max size of 100KB</span>
								</S.PInfoMessage>
							</S.PWrapper>
							<S.SAction>
								{props.handleClose && (
									<Button
										type={'primary'}
										label={language.close}
										handlePress={() => props.handleClose()}
										disabled={loading}
										loading={false}
									/>
								)}
								<Button
									type={'alt1'}
									label={language.save}
									handlePress={handleSubmit}
									disabled={loading || getImageSizeMessage() !== null}
									loading={loading}
								/>
							</S.SAction>
							<S.MInfoWrapper>{getImageSizeMessage()}</S.MInfoWrapper>
						</S.Body>
					</S.Wrapper>
					{collectionResponse && (
						<Notification
							message={collectionResponse.message}
							type={collectionResponse.status}
							callback={() => setCollectionResponse(null)}
						/>
					)}
				</>
			);
		}
	}

	return getConnectedView();
}
