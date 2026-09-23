import React from 'react';
import { Link } from 'react-router-dom';

import type { AssetSummary, Collection } from 'api/collections';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { AudioArtwork } from 'components/atoms/AudioArtwork';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { isAudioContentType } from 'helpers/asset-media';
import { short } from 'helpers/format';

import { useAssetPageWarmup } from '../../../hooks/useAssetPageWarmup';

export const AssetCard = React.memo(function AssetCard(props: {
	collection: Collection;
	asset: AssetSummary;
	badge?: string;
	price?: string;
	priceListed?: boolean;
	collectionContext?: boolean;
	priority?: boolean;
}) {
	const warmAssetPage = useAssetPageWarmup(props.asset.id, props.collection.kind === 'tokens');
	return (
		<Link
			className={`asset-card${props.collection.kind === 'tokens' ? ' token-asset-card' : ''}${
				props.collectionContext ?? false ? ' collection-context' : ''
			}`}
			onFocus={warmAssetPage}
			onMouseEnter={warmAssetPage}
			onTouchStart={warmAssetPage}
			to={`/asset/${props.collection.id}/${props.asset.id}`}
		>
			<div className="asset-media">
				{props.collection.kind === 'tokens' && (props.collectionContext ?? false) ? (
					<TokenAvatar
						fetchPriority={props.priority ?? false ? 'high' : 'auto'}
						image={props.asset.image}
						loading={props.priority ?? false ? 'eager' : 'lazy'}
						ticker={props.asset.ticker ?? 'Token'}
					/>
				) : props.asset.image ? (
					<ArtworkImage
						src={props.asset.image}
						fetchPriority={props.priority ?? false ? 'high' : 'auto'}
						loading={props.priority ?? false ? 'eager' : 'lazy'}
						alt=""
					/>
				) : isAudioContentType(props.asset.contentType) ? (
					<AudioArtwork contentType={props.asset.contentType} name={props.asset.name} />
				) : props.collection.kind === 'tokens' ? (
					<TokenAvatar
						fetchPriority={props.priority ?? false ? 'high' : 'auto'}
						image={props.asset.image}
						loading={props.priority ?? false ? 'eager' : 'lazy'}
						ticker={props.asset.ticker ?? 'Token'}
					/>
				) : (
					<span>{props.asset.name.slice(0, 1)}</span>
				)}
			</div>
			<div className="asset-card-copy">
				{!(props.collectionContext ?? false) ? <p>{props.collection.name}</p> : null}
				<div className="asset-card-heading">
					<h3>{props.asset.name}</h3>
					{props.price ? (
						<strong className={props.priceListed ?? false ? 'listed' : undefined}>{props.price}</strong>
					) : null}
				</div>
				{props.badge ? <span className="asset-card-status">{props.badge}</span> : null}
				{!(props.collectionContext ?? false) ? <span>{short(props.asset.id)}</span> : null}
			</div>
		</Link>
	);
});

export default AssetCard;
