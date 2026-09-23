import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

import type { Collection } from 'api/collections';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { BazarMark } from 'components/atoms/BazarMark';
import { Icon } from 'components/atoms/Icon';
import { NamesCubePreview } from 'components/atoms/NamesCubePreview';
import { TokenAvatar } from 'components/atoms/TokenAvatar';
import { useMessages } from 'providers/LanguageProvider';

import { HOME_MESSAGES } from '../../../messages';
import {
	homeCollectionAssetCountLabel,
	homeCollectionDescription,
	type HomeMarketSummary,
	homeMarketSummaryLabel,
	homeMarketSummaryListed,
} from '../../../model/home-market';
import { HomePendingMarketValue } from '../HomePendingMarketValue';

export default function HomeCollectionCard(props: {
	collection: Collection;
	floor: HomeMarketSummary | undefined;
	floorPending: boolean;
	index: number;
}) {
	const messages = useMessages(HOME_MESSAGES);
	const image = props.collection.assets.find((asset) => asset.image)?.image;
	const tokenPreview = props.collection.assets.find((asset) => asset.image) ?? props.collection.assets[0];
	return (
		<Link className={`home-feature-card feature-${props.index}`} to={`/collection/${props.collection.id}`}>
			<div className="home-feature-art">
				{props.collection.kind === 'tokens' ? (
					<TokenAvatar
						className="home-token-collection-art"
						fetchPriority={props.index === 0 ? 'high' : 'auto'}
						image={tokenPreview?.image}
						loading={props.index === 0 ? 'eager' : 'lazy'}
						ticker={tokenPreview?.ticker ?? messages.homeTokenTickerFallback}
					/>
				) : image ? (
					<ArtworkImage
						src={image}
						alt=""
						fetchPriority={props.index === 0 ? 'high' : 'auto'}
						loading={props.index === 0 ? 'eager' : 'lazy'}
						fallback={
							<span className="home-image-collection-fallback" aria-hidden="true">
								<BazarMark />
								<strong>{props.collection.name.replace(/^\[TEST\]\s*/, '')}</strong>
								<small>{messages.homeImageCollectionFallback}</small>
							</span>
						}
					/>
				) : props.collection.kind === 'names' ? (
					<NamesCubePreview />
				) : (
					<div className="home-name-art">
						<BazarMark />
						<span>{messages.homeArSymbol}</span>
					</div>
				)}
				<div className="home-feature-glow" />
			</div>
			<div className="home-feature-copy">
				<h2>{props.collection.name}</h2>
				<span>{homeCollectionDescription(props.collection, messages)}</span>
			</div>
			<div className="home-feature-stats">
				<div>
					<span>
						{props.collection.kind === 'names' && props.collection.hasMore
							? messages.homeCollectionLoaded
							: messages.homeCollectionAssets}
					</span>
					<strong>{homeCollectionAssetCountLabel(props.collection, messages)}</strong>
				</div>
				<div>
					<span>
						{props.collection.hasMore ? messages.homeCollectionLoadedFloor : messages.homeCollectionFloor}
					</span>
					<strong className={homeMarketSummaryListed(props.floor) ? 'listed' : undefined}>
						{!props.floorPending && props.floor ? (
							<ArCurrencyText>
								{homeMarketSummaryLabel(
									props.floor,
									messages,
									props.collection.hasMore
										? messages.homeCollectionNoLoadedListings
										: messages.homeCollectionNoLiveListings,
									messages.homeSummaryUnindexed
								)}
							</ArCurrencyText>
						) : (
							<HomePendingMarketValue />
						)}
					</strong>
				</div>
			</div>
			<strong className="home-card-action">
				{messages.homeOpenCollection}
				<span>
					<Icon icon={ArrowUpRight} size="xs" />
				</span>
			</strong>
		</Link>
	);
}
