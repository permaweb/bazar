import type { AssetSummary, Collection } from 'api/collections';

import { TokenMarketRow } from 'components/molecules/TokenMarketRow';
import { useAssetPageWarmup } from 'features/Catalogue';
import { short } from 'helpers/format';

import {
	type HomeMarketSummary,
	homeMarketSummaryLabel,
	homeMarketSummaryListed,
	type HomeTokenPriceChange,
	homeTokenPriceChangeLabel,
} from '../../../model/home-market';
import { homeTokenPriceChangeTone } from '../../../model/home-market-view';
import { HomePendingMarketValue } from '../HomePendingMarketValue';

export default function HomeTokenRow(props: {
	asset: AssetSummary;
	collection: Collection;
	image: string | undefined;
	price: HomeMarketSummary | undefined;
	change: HomeTokenPriceChange | undefined;
	priority: boolean;
}) {
	const warmAssetPage = useAssetPageWarmup(props.asset.id, true);
	return (
		<TokenMarketRow
			asset={{ ...props.asset, image: props.image ?? props.asset.image }}
			collection={props.collection}
			context={`Fungible token · ${short(props.asset.id)}`}
			metric={{
				label: 'Unit price',
				value: props.price ? homeMarketSummaryLabel(props.price, 'Not listed') : <HomePendingMarketValue />,
				tone: homeMarketSummaryListed(props.price) ? 'positive' : 'default',
			}}
			secondaryMetric={{
				label: '24h change',
				value:
					props.change === undefined ? <HomePendingMarketValue /> : homeTokenPriceChangeLabel(props.change),
				tone: homeTokenPriceChangeTone(props.change),
			}}
			onWarm={warmAssetPage}
			priority={props.priority}
		/>
	);
}
