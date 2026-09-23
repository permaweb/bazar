import React from 'react';
import { Upload, X } from 'lucide-react';

import { AudioArtwork } from 'components/atoms/AudioArtwork';
import { Button } from 'components/atoms/Button';
import { FileInput } from 'components/atoms/FileInput';
import { Icon } from 'components/atoms/Icon';
import { TokenArtwork } from 'components/atoms/TokenArtwork';
import type { EmbeddedAudioMetadata } from 'helpers/audio-metadata';
import { formatAudioDuration } from 'helpers/audio-metadata';
import { formatBytes } from 'helpers/format';

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
							<TokenArtwork ticker={props.ticker.trim() || 'TKN'} />
						)}
					</div>
					<span>
						<strong>{props.name.trim() || 'Unnamed token'}</strong>
						<small className="fungible-token-preview-ticker">{props.ticker.trim() || 'Set a ticker'}</small>
						<small>
							{isWholeTokenSupply(props.wholeSupply)
								? `${props.wholeSupply} ${props.ticker.trim() || 'tokens'} total · ${
										props.denomination || '0'
								  } decimal places`
								: 'Set the whole-token supply'}
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
									alt={`${props.name || props.file?.name || 'Audio'} album artwork`}
								/>
							) : (
								<AudioArtwork
									contentType={props.selectedContentType ?? undefined}
									name={props.file?.name ?? props.name}
								/>
							)
						) : (
							<img src={props.preview} alt="Asset preview" />
						)
					) : (
						<span>
							<Upload aria-hidden="true" />
							<strong>{props.mode === 'asset' ? 'Choose media' : 'Choose collection images'}</strong>
							<small>
								{props.mode === 'asset'
									? 'Images up to 10 MB · MP3 or WAV up to 100 MB'
									: 'PNG, JPG, WebP, or GIF · up to 10 MB each · 10 images maximum'}
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
					<strong>{props.readingAudioMetadata ? 'Reading embedded metadata…' : 'Audio metadata'}</strong>
					{!props.readingAudioMetadata ? (
						<dl>
							<div>
								<dt>Title</dt>
								<dd>{props.audioMetadata.title || 'Not embedded'}</dd>
							</div>
							<div>
								<dt>Artist</dt>
								<dd>{props.audioMetadata.artist || 'Not embedded'}</dd>
							</div>
							<div>
								<dt>Album</dt>
								<dd>{props.audioMetadata.album || 'Not embedded'}</dd>
							</div>
							<div>
								<dt>Duration</dt>
								<dd>{formatAudioDuration(props.audioMetadata.duration) || 'Unavailable'}</dd>
							</div>
						</dl>
					) : null}
				</div>
			) : null}
			{props.mode === 'asset' && props.audioSelected ? (
				<div className="mint-artwork-field">
					<div>
						<span>
							<strong>Album artwork</strong>
							<small>
								{props.audioMetadata.artwork && props.artwork === props.audioMetadata.artwork
									? 'Embedded artwork found · replace it if needed'
									: 'Optional · PNG, JPG, WebP, or GIF · up to 10 MB'}
							</small>
						</span>
						{props.artworkPreview ? <img src={props.artworkPreview} alt="Album artwork preview" /> : null}
					</div>
					<div>
						<Button type="button" onClick={() => artworkInput.current?.click()} size="custom">
							<Icon icon={Upload} size="sm" /> {props.artwork ? 'Replace artwork' : 'Add artwork'}
						</Button>
						{props.artwork ? (
							<Button type="button" size="custom" variant="danger" onClick={handleArtworkRemove}>
								<Icon icon={X} size="sm" /> Remove
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
								aria-label={`Remove ${item.name}`}
								onClick={() => props.onCollectionFileRemove(index)}
								variant="danger"
							>
								<Icon icon={X} size="sm" />
							</Button>
						</div>
					))}
					<Button type="button" onClick={() => fileInput.current?.click()} size="custom">
						<Icon icon={Upload} size="sm" /> Add images
					</Button>
				</div>
			) : null}
		</div>
	);
}
