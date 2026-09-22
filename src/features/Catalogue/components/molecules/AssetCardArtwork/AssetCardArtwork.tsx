import type { AssetSummary, Collection } from 'api/collections';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { AudioArtwork } from 'components/atoms/AudioArtwork';
import { TokenArtwork } from 'components/atoms/TokenArtwork';
import { isAudioContentType } from 'helpers/asset-media';

export default function AssetCardArtwork(props: { asset: AssetSummary; collection: Collection; priority?: boolean }) {
	return (
		<div className="asset-media">
			{props.asset.image ? (
				<ArtworkImage
					src={props.asset.image}
					fetchPriority={props.priority ?? false ? 'high' : 'auto'}
					loading={props.priority ?? false ? 'eager' : 'lazy'}
					alt=""
				/>
			) : isAudioContentType(props.asset.contentType) ? (
				<AudioArtwork contentType={props.asset.contentType} name={props.asset.name} />
			) : props.collection.kind === 'tokens' ? (
				<TokenArtwork className="circle-only-token-art" ticker={props.asset.ticker ?? 'Token'} />
			) : (
				<span>{props.asset.name.slice(0, 1)}</span>
			)}
		</div>
	);
}
