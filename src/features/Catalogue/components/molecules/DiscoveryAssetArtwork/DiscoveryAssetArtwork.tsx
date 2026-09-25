import type { AssetSummary, Collection } from 'api/collections';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { AudioArtwork } from 'components/atoms/AudioArtwork';
import { NameArtwork } from 'components/atoms/NameArtwork';
import { TokenArtwork } from 'components/atoms/TokenArtwork';
import { isAudioContentType } from 'helpers/asset-media';
import { useMessages } from 'providers/LanguageProvider';

import { CATALOGUE_MESSAGES } from '../../../messages';
import { audioArtworkLabel } from '../../../model/artwork';

export default function DiscoveryAssetArtwork(props: {
	asset: AssetSummary;
	collection: Collection;
	priority?: boolean;
}) {
	const messages = useMessages(CATALOGUE_MESSAGES);
	if (props.asset.image) {
		return (
			<ArtworkImage
				className="home-asset-media"
				src={props.asset.image}
				alt=""
				fetchPriority={props.priority ?? false ? 'high' : 'auto'}
				loading={props.priority ?? false ? 'eager' : 'lazy'}
				unavailableLabel={messages.catalogueArtworkUnavailable}
			/>
		);
	}
	if (isAudioContentType(props.asset.contentType)) {
		return (
			<AudioArtwork
				className="home-asset-media"
				contentType={props.asset.contentType}
				label={audioArtworkLabel(props.asset, messages)}
				typeLabel={messages.catalogueAudioArtworkType}
			/>
		);
	}
	if (props.collection.kind === 'names') {
		return <NameArtwork className="home-asset-media" name={props.asset.name} />;
	}
	return (
		<TokenArtwork
			className={`home-asset-media home-token-art${
				props.collection.kind === 'tokens' ? ' circle-only-token-art' : ''
			}`}
			subtitle={messages.catalogueTokenArtworkSubtitle}
			ticker={props.asset.ticker ?? messages.tokenTickerFallback}
		/>
	);
}
