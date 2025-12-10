import React from 'react';
import { ReactSVG } from 'react-svg';

import { Button } from 'components/atoms/Button';
import { Notification } from 'components/atoms/Notification';
import { message, result } from 'helpers/aoconnect';
import { createDataItemSigner } from 'helpers/aoconnect';
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

				// According to Nick's instructions: use Eval to directly set variables
				// Just do: Thumbnail = '<new tx id>' and Banner = '<new tx id>', then syncState()
				// This bypasses handlers and directly updates the process state
				const signer = createDataItemSigner(arProvider.wallet);
				const currentTimestamp = Date.now().toString();
				let hasUpdates = false;

				// Build Eval code to update variables directly
				let evalCode = '';

				// Update Banner if changed
				if (bannerTxId && bannerTxId !== props.collection.banner) {
					evalCode += `Banner = '${bannerTxId}'\n`;
					hasUpdates = true;
				}

				// Update Thumbnail if changed
				if (thumbnailTxId && thumbnailTxId !== props.collection.thumbnail) {
					evalCode += `Thumbnail = '${thumbnailTxId}'\n`;
					hasUpdates = true;
				}

				// Update LastUpdate and sync state
				if (hasUpdates) {
					evalCode += `LastUpdate = '${currentTimestamp}'\n`;
					evalCode += `syncState()\n`;

					// Send Eval message to directly update the variables
					// This bypasses any handler authorization checks
					await message({
						process: props.collection.id,
						signer: signer,
						tags: [{ name: 'Action', value: 'Eval' }],
						data: evalCode,
					});
					// Wait for eval to complete
					await new Promise((resolve) => setTimeout(resolve, 3000));
				}

				if (
					(bannerTxId && bannerTxId !== props.collection.banner) ||
					(thumbnailTxId && thumbnailTxId !== props.collection.thumbnail)
				) {
					setCollectionResponse({
						message: 'Collection images updated successfully!',
						status: 'success',
					});
					handleUpdate();
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
