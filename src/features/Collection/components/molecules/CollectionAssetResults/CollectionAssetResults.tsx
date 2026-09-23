import type { AssetSummary, Collection } from 'api/collections';

import { TokenMarketRow } from 'components/molecules/TokenMarketRow';
import { AssetCard } from 'features/Catalogue';
import { short } from 'helpers/format';

import {
	collectionCardPriceLabel,
	collectionCardPriceListed,
	type CollectionCardPrices,
} from '../../../model/collection-market';

// The revealed assets of a collection: token market rows for token collections, asset cards otherwise.
export default function CollectionAssetResults(props: {
	collection: Collection;
	assets: AssetSummary[];
	prices: CollectionCardPrices;
	pricesFailed: boolean;
	listedOnly: boolean;
	gridId: string;
	summaryId: string;
	onWarmToken(processId: string): void;
}) {
	if (props.collection.kind === 'tokens') {
		return (
			<div
				aria-describedby={props.summaryId}
				aria-label={`${props.collection.name} tokens`}
				className="token-market-list collection-token-list"
				id={props.gridId}
				role="list"
			>
				{props.assets.map((asset, index) => {
					const price = props.prices[asset.id];
					return (
						<TokenMarketRow
							asset={asset}
							badge={props.listedOnly ? 'For sale' : undefined}
							collection={props.collection}
							context={`Process · ${short(asset.id)}`}
							key={asset.id}
							metric={{
								label: 'Unit price',
								value: collectionCardPriceLabel(price, props.pricesFailed),
								tone: collectionCardPriceListed(price) ? 'positive' : 'default',
							}}
							onWarm={() => props.onWarmToken(asset.id)}
							priority={index < 2}
						/>
					);
				})}
			</div>
		);
	}
	return (
		<div
			aria-describedby={props.summaryId}
			aria-label={`${props.collection.name} assets`}
			className={`asset-grid collection-market-grid${
				props.collection.kind === 'names' ? ' names-collection-grid' : ''
			}`}
			id={props.gridId}
		>
			{props.assets.map((asset, index) => {
				const price = props.prices[asset.id];
				return (
					<AssetCard
						key={asset.id}
						collection={props.collection}
						asset={asset}
						priority={index < 2}
						collectionContext
						badge={props.listedOnly ? 'For sale' : undefined}
						price={collectionCardPriceLabel(price, props.pricesFailed)}
						priceListed={collectionCardPriceListed(price)}
					/>
				);
			})}
		</div>
	);
}
