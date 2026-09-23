import { Link } from 'react-router-dom';

import type { AssetSummary, Collection } from 'api/collections';

import { DiscoveryAssetArtwork, useAssetPageWarmup } from 'features/Catalogue';
import { useMessages } from 'providers/LanguageProvider';

import { HOME_MESSAGES } from '../../../messages';
import { type HomeMarketSummary, homeMarketSummaryLabel, homeMarketSummaryListed } from '../../../model/home-market';
import { HomePendingMarketValue } from '../HomePendingMarketValue';

export default function HomeAssetTile(props: {
	asset: AssetSummary;
	collection: Collection;
	price: HomeMarketSummary | undefined;
	priority: boolean;
}) {
	const messages = useMessages(HOME_MESSAGES);
	const warmAssetPage = useAssetPageWarmup(props.asset.id, false);
	return (
		<Link
			to={`/asset/${props.collection.id}/${props.asset.id}`}
			onFocus={warmAssetPage}
			onMouseEnter={warmAssetPage}
			onTouchStart={warmAssetPage}
		>
			<DiscoveryAssetArtwork asset={props.asset} collection={props.collection} priority={props.priority} />
			<div className="home-asset-details">
				<div>
					<strong>{props.asset.name}</strong>
					<span>{props.collection.name}</span>
				</div>
				<b className={`home-asset-price${homeMarketSummaryListed(props.price) ? ' listed' : ''}`}>
					{props.price ? (
						homeMarketSummaryLabel(props.price, messages, messages.homeNotListed)
					) : (
						<HomePendingMarketValue />
					)}
				</b>
			</div>
		</Link>
	);
}
