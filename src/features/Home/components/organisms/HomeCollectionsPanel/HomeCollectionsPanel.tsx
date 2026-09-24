import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { HOME_MESSAGES } from '../../../messages';
import type { HomeCollectionsView } from '../../../model/home-market-view';
import { HomeCollectionCard } from '../../molecules/HomeCollectionCard';
import { HomeMarketGhostCard } from '../../molecules/HomeMarketGhostCard';

import * as S from './styles';

export default function HomeCollectionsPanel(props: {
	collections: HomeCollectionsView;
	marketFailed: boolean;
	query: string;
}) {
	const messages = useMessages(HOME_MESSAGES);
	return (
		<div
			aria-busy={props.collections.pending}
			aria-labelledby="home-collections-tab"
			id="home-collections-panel"
			role="tabpanel"
		>
			{props.collections.items.length || props.collections.pending ? (
				<S.FeatureGrid className="home-feature-grid">
					{props.collections.items.map((collection, index) => {
						const floor = props.collections.floors[collection.id];
						return (
							<HomeCollectionCard
								collection={collection}
								floor={floor}
								floorPending={!floor || (props.collections.retrying && floor.status === 'unavailable')}
								index={index}
								key={collection.id}
							/>
						);
					})}
					{props.collections.pending ? <HomeMarketGhostCard kind="collection" /> : null}
				</S.FeatureGrid>
			) : null}
			{props.collections.ready && !props.marketFailed && props.collections.items.length === 0 ? (
				<S.NoResults className="home-no-results">
					{formatMessage(messages.homeNoCollections, { query: props.query })}
				</S.NoResults>
			) : null}
		</div>
	);
}
