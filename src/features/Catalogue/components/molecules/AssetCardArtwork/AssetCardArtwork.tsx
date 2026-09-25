import type { AssetSummary, Collection } from 'api/collections';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { AudioArtwork } from 'components/atoms/AudioArtwork';
import { TokenArtwork } from 'components/atoms/TokenArtwork';
import { isAudioContentType } from 'helpers/asset-media';
import { useMessages } from 'providers/LanguageProvider';

import { CATALOGUE_MESSAGES } from '../../../messages';
import { audioArtworkLabel } from '../../../model/artwork';

export default function AssetCardArtwork(props: { asset: AssetSummary; collection: Collection; priority?: boolean }) {
	const messages = useMessages(CATALOGUE_MESSAGES);
	return (
		<div className="asset-media">
			{props.asset.image ? (
				<ArtworkImage
					src={props.asset.image}
					fetchPriority={props.priority ?? false ? 'high' : 'auto'}
					loading={props.priority ?? false ? 'eager' : 'lazy'}
					alt=""
					unavailableLabel={messages.catalogueArtworkUnavailable}
				/>
			) : isAudioContentType(props.asset.contentType) ? (
				<AudioArtwork
					contentType={props.asset.contentType}
					label={audioArtworkLabel(props.asset, messages)}
					typeLabel={messages.catalogueAudioArtworkType}
				/>
			) : props.collection.kind === 'tokens' ? (
				<TokenArtwork
					className="circle-only-token-art"
					subtitle={messages.catalogueTokenArtworkSubtitle}
					ticker={props.asset.ticker ?? messages.tokenTickerFallback}
				/>
			) : (
				<span>{props.asset.name.slice(0, 1)}</span>
			)}
		</div>
	);
}
