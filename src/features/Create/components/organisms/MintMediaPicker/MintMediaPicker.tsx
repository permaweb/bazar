import React from 'react';
import { Upload, X } from 'lucide-react';

import { AudioArtwork } from 'components/atoms/AudioArtwork';
import { Button } from 'components/atoms/Button';
import { FileInput } from 'components/atoms/FileInput';
import { Icon } from 'components/atoms/Icon';
import { TokenArtwork } from 'components/atoms/TokenArtwork';
import { audioFormatLabel } from 'helpers/asset-media';
import type { EmbeddedAudioMetadata } from 'helpers/audio-metadata';
import { formatAudioDuration } from 'helpers/audio-metadata';
import { formatBytes } from 'helpers/format';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { CREATE_MESSAGES } from '../../../messages';
import { type CreatorMode, isWholeTokenSupply } from '../../../model/mint-form';

export default function MintMediaPicker(props: {
	mode: CreatorMode;
	name: string;
	ticker: string;
	wholeSupply: string;
	denomination: string;
	logoPreview: string;
	file: File | null;
	preview: string;
	selectedContentType: string | null;
	audioSelected: boolean;
	artwork: File | null;
	artworkPreview: string;
	audioMetadata: EmbeddedAudioMetadata;
	readingAudioMetadata: boolean;
	collectionFiles: File[];
	collectionPreviews: string[];
	onFileSelect: (file: File | null) => void;
	onCollectionFilesSelect: (files: File[]) => void;
	onCollectionFileRemove: (index: number) => void;
	onArtworkSelect: (artwork: File | null) => void;
	onArtworkRemove: () => void;
}) {
	const messages = useMessages(CREATE_MESSAGES);
	const fileInput = React.useRef<HTMLInputElement>(null);
	const artworkInput = React.useRef<HTMLInputElement>(null);

	const handleArtworkRemove = () => {
		props.onArtworkRemove();
		if (artworkInput.current) artworkInput.current.value = '';
	};

	return (
		<div className="create-preview-column">
			{props.mode === 'fungible' ? (
				<div className="fungible-token-preview">
					<div className="fungible-token-preview-mark" aria-hidden="true">
						{props.logoPreview ? (
							<img src={props.logoPreview} alt="" />
						) : (
							<TokenArtwork
								subtitle={messages.mintTokenArtworkSubtitle}
								ticker={props.ticker.trim() || messages.mintTokenFallbackTicker}
							/>
						)}
					</div>
					<span>
						<strong>{props.name.trim() || messages.mintTokenPreviewUnnamed}</strong>
						<small className="fungible-token-preview-ticker">
							{props.ticker.trim() || messages.mintTokenPreviewSetTicker}
						</small>
						<small>
							{isWholeTokenSupply(props.wholeSupply)
								? formatMessage(messages.mintTokenPreviewSupply, {
										supply: props.wholeSupply,
										ticker: props.ticker.trim() || messages.mintTokenSupplyFallbackTicker,
										denomination: props.denomination || '0',
								  })
								: messages.mintTokenPreviewSetSupply}
						</small>
					</span>
				</div>
			) : (
				<Button
					className={`mint-dropzone${props.mode === 'asset' && props.preview ? ' has-file' : ''}${
						props.mode === 'collection' && props.collectionPreviews.length
							? ' has-file collection-files'
							: ''
					}`}
					type="button"
					size="custom"
					onClick={() => fileInput.current?.click()}
					onDragOver={(event) => event.preventDefault()}
					onDrop={(event) => {
						event.preventDefault();
						if (props.mode === 'collection')
							props.onCollectionFilesSelect(Array.from(event.dataTransfer.files ?? []));
						else props.onFileSelect(event.dataTransfer.files?.[0] ?? null);
					}}
				>
					{props.mode === 'collection' && props.collectionPreviews.length ? (
						<span className="collection-preview-grid">
							{props.collectionPreviews.slice(0, 6).map((url, index) => (
								<span key={`${props.collectionFiles[index]?.name}-${index}`}>
									<img src={url} alt="" />
									<small>{index + 1}</small>
								</span>
							))}
							{props.collectionPreviews.length > 6 ? (
								<strong>+{props.collectionPreviews.length - 6}</strong>
							) : null}
						</span>
					) : props.mode === 'asset' && props.preview ? (
						props.audioSelected ? (
							props.artworkPreview ? (
								<img
									src={props.artworkPreview}
									alt={formatMessage(messages.mintArtworkAlt, {
										name: props.name || props.file?.name || messages.mintArtworkAltFallbackName,
									})}
								/>
							) : (
								<AudioArtwork
									contentType={props.selectedContentType ?? undefined}
									label={formatMessage(messages.mintAudioArtworkLabel, {
										format: audioFormatLabel(props.selectedContentType ?? undefined),
										name: props.file?.name ?? props.name,
									})}
									typeLabel={messages.mintAudioArtworkType}
								/>
							)
						) : (
							<img src={props.preview} alt={messages.mintAssetPreviewAlt} />
						)
					) : (
						<span>
							<Upload aria-hidden="true" />
							<strong>
								{props.mode === 'asset'
									? messages.mintChooseMedia
									: messages.mintChooseCollectionImages}
							</strong>
							<small>
								{props.mode === 'asset'
									? messages.mintMediaHintAsset
									: messages.mintMediaHintCollection}
							</small>
						</span>
					)}
				</Button>
			)}
			<FileInput
				ref={fileInput}
				className="mint-file-input"
				multiple={props.mode === 'collection'}
				accept={
					props.mode === 'collection'
						? 'image/png,image/jpeg,image/webp,image/gif'
						: 'image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/wav,.mp3,.wav'
				}
				onChange={(event) => {
					if (props.mode === 'collection')
						props.onCollectionFilesSelect(Array.from(event.target.files ?? []));
					else props.onFileSelect(event.target.files?.[0] ?? null);
				}}
			/>
			{props.mode === 'asset' && props.file ? (
				<div className="mint-file-meta">
					<span>{props.file.name}</span>
					<strong>{formatBytes(props.file.size)}</strong>
				</div>
			) : null}
			{props.mode === 'asset' && props.audioSelected ? (
				<div className="mint-audio-metadata" aria-live="polite">
					<strong>
						{props.readingAudioMetadata
							? messages.mintAudioMetadataReading
							: messages.mintAudioMetadataHeading}
					</strong>
					{!props.readingAudioMetadata ? (
						<dl>
							<div>
								<dt>{messages.mintAudioTitle}</dt>
								<dd>{props.audioMetadata.title || messages.mintAudioNotEmbedded}</dd>
							</div>
							<div>
								<dt>{messages.mintAudioArtist}</dt>
								<dd>{props.audioMetadata.artist || messages.mintAudioNotEmbedded}</dd>
							</div>
							<div>
								<dt>{messages.mintAudioAlbum}</dt>
								<dd>{props.audioMetadata.album || messages.mintAudioNotEmbedded}</dd>
							</div>
							<div>
								<dt>{messages.mintAudioDuration}</dt>
								<dd>
									{formatAudioDuration(props.audioMetadata.duration) ||
										messages.mintAudioDurationUnavailable}
								</dd>
							</div>
						</dl>
					) : null}
				</div>
			) : null}
			{props.mode === 'asset' && props.audioSelected ? (
				<div className="mint-artwork-field">
					<div>
						<span>
							<strong>{messages.mintArtworkHeading}</strong>
							<small>
								{props.audioMetadata.artwork && props.artwork === props.audioMetadata.artwork
									? messages.mintArtworkEmbeddedHint
									: messages.mintArtworkOptionalHint}
							</small>
						</span>
						{props.artworkPreview ? (
							<img src={props.artworkPreview} alt={messages.mintArtworkPreviewAlt} />
						) : null}
					</div>
					<div>
						<Button type="button" onClick={() => artworkInput.current?.click()} size="custom">
							<Icon icon={Upload} size="sm" />{' '}
							{props.artwork ? messages.mintArtworkReplace : messages.mintArtworkAdd}
						</Button>
						{props.artwork ? (
							<Button type="button" size="custom" variant="danger" onClick={handleArtworkRemove}>
								<Icon icon={X} size="sm" /> {messages.mintRemove}
							</Button>
						) : null}
					</div>
					<FileInput
						ref={artworkInput}
						className="mint-file-input"
						accept="image/png,image/jpeg,image/webp,image/gif"
						onChange={(event) => props.onArtworkSelect(event.target.files?.[0] ?? null)}
					/>
				</div>
			) : null}
			{props.mode === 'collection' && props.collectionFiles.length ? (
				<div className="collection-file-list">
					{props.collectionFiles.map((item, index) => (
						<div key={`${item.name}-${item.size}-${index}`}>
							<span>
								<strong>{index + 1}</strong>
								{item.name.replace(/\.[^.]+$/, '')}
							</span>
							<Button
								type="button"
								size="icon"
								aria-label={formatMessage(messages.mintCollectionFileRemove, { name: item.name })}
								onClick={() => props.onCollectionFileRemove(index)}
								variant="danger"
							>
								<Icon icon={X} size="sm" />
							</Button>
						</div>
					))}
					<Button type="button" onClick={() => fileInput.current?.click()} size="custom">
						<Icon icon={Upload} size="sm" /> {messages.mintCollectionAddImages}
					</Button>
				</div>
			) : null}
		</div>
	);
}
