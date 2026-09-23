import React from 'react';

import type { AssetSummary, Collection } from 'api/collections';
import type { AssetState } from 'api/marketplace';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { AudioArtwork } from 'components/atoms/AudioArtwork';
import { InteractiveHtmlArtwork } from 'components/atoms/InteractiveHtmlArtwork';
import { Loading } from 'components/atoms/Loading';
import { NameArtwork } from 'components/atoms/NameArtwork';
import { isAudioContentType, isHtmlContentType } from 'helpers/asset-media';

const DeferredAudioWaveformPlayer = React.lazy(async () => {
	const module = await import('../AudioWaveformPlayer');
	return { default: module.AudioWaveformPlayer };
});

export default function UniqueAssetMedia(props: { asset: AssetSummary; collection: Collection; state: AssetState }) {
	const audio = isAudioContentType(props.asset.contentType);
	const interactive = isHtmlContentType(props.asset.contentType);
	return (
		<div
			className={`asset-hero-media${audio ? ' audio-hero-media' : ''}${
				interactive ? ' interactive-hero-media' : ''
			}`}
		>
			{interactive && props.asset.media ? (
				<InteractiveHtmlArtwork name={props.asset.name} src={props.asset.media} />
			) : audio ? (
				<div className="asset-audio-player">
					{props.asset.image ? (
						<ArtworkImage
							src={props.asset.image}
							alt={`${props.asset.name} album artwork`}
							fetchPriority="high"
							loading="eager"
						/>
					) : (
						<AudioArtwork contentType={props.asset.contentType} name={props.asset.name} />
					)}
					{props.asset.media ? (
						<React.Suspense fallback={<Loading label="Loading audio player…" />}>
							<DeferredAudioWaveformPlayer name={props.asset.name} src={props.asset.media} />
						</React.Suspense>
					) : null}
				</div>
			) : props.asset.image ? (
				<ArtworkImage src={props.asset.image} alt={props.asset.name} fetchPriority="high" loading="eager" />
			) : props.collection.kind === 'names' ? (
				<NameArtwork name={props.asset.name} />
			) : (
				<span>{props.asset.name.slice(0, 1)}</span>
			)}
			{props.collection.kind !== 'names' ? (
				<div className="asset-media-label">
					<span>Permanent asset</span>
					<strong>
						{props.asset.contentType ?? (props.asset.image ? 'image' : props.state.device ?? 'process')}
					</strong>
				</div>
			) : null}
		</div>
	);
}
