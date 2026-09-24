import React from 'react';

import type { AssetSummary, Collection } from 'api/collections';
import type { AssetState } from 'api/marketplace';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { AudioArtwork } from 'components/atoms/AudioArtwork';
import { InteractiveHtmlArtwork } from 'components/atoms/InteractiveHtmlArtwork';
import { Loading } from 'components/atoms/Loading';
import { NameArtwork } from 'components/atoms/NameArtwork';
import { isAudioContentType, isHtmlContentType } from 'helpers/asset-media';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { audioArtworkLabel } from '../../../model/asset-detail';

import * as S from './styles';

const DeferredAudioWaveformPlayer = React.lazy(async () => {
	const module = await import('../AudioWaveformPlayer');
	return { default: module.AudioWaveformPlayer };
});

export default function UniqueAssetMedia(props: { asset: AssetSummary; collection: Collection; state: AssetState }) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const audio = isAudioContentType(props.asset.contentType);
	const interactive = isHtmlContentType(props.asset.contentType);
	return (
		<S.HeroMedia
			className={`asset-hero-media${audio ? ' audio-hero-media' : ''}${
				interactive ? ' interactive-hero-media' : ''
			}`}
		>
			{interactive && props.asset.media ? (
				<InteractiveHtmlArtwork
					src={props.asset.media}
					title={formatMessage(messages.uniqueMediaInteractiveArtwork, { name: props.asset.name })}
				/>
			) : audio ? (
				<S.AudioPlayerFrame className="asset-audio-player">
					{props.asset.image ? (
						<ArtworkImage
							src={props.asset.image}
							alt={formatMessage(messages.uniqueMediaAlbumArtwork, { name: props.asset.name })}
							fetchPriority="high"
							loading="eager"
							unavailableLabel={messages.assetDetailArtworkUnavailable}
						/>
					) : (
						<AudioArtwork
							contentType={props.asset.contentType}
							label={audioArtworkLabel(props.asset, messages)}
							typeLabel={messages.assetDetailAudioArtworkType}
						/>
					)}
					{props.asset.media ? (
						<React.Suspense fallback={<Loading label={messages.uniqueMediaLoadingPlayer} />}>
							<DeferredAudioWaveformPlayer name={props.asset.name} src={props.asset.media} />
						</React.Suspense>
					) : null}
				</S.AudioPlayerFrame>
			) : props.asset.image ? (
				<ArtworkImage
					src={props.asset.image}
					alt={props.asset.name}
					fetchPriority="high"
					loading="eager"
					unavailableLabel={messages.assetDetailArtworkUnavailable}
				/>
			) : props.collection.kind === 'names' ? (
				<NameArtwork name={props.asset.name} />
			) : (
				<span>{props.asset.name.slice(0, 1)}</span>
			)}
			{props.collection.kind !== 'names' ? (
				<S.MediaLabel className="asset-media-label">
					<span>{messages.uniqueMediaPermanentAsset}</span>
					<strong>
						{props.asset.contentType ?? (props.asset.image ? 'image' : props.state.device ?? 'process')}
					</strong>
				</S.MediaLabel>
			) : null}
		</S.HeroMedia>
	);
}
