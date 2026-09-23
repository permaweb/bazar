import type { HomeCollectionsView } from '../../../model/home-market-view';
import { HomeCollectionCard } from '../../molecules/HomeCollectionCard';
import { HomeMarketGhostCard } from '../../molecules/HomeMarketGhostCard';

export default function HomeCollectionsPanel(props: {
	collections: HomeCollectionsView;
	marketFailed: boolean;
	query: string;
}) {
	return (
		<div
			aria-busy={props.collections.pending}
			aria-labelledby="home-collections-tab"
			id="home-collections-panel"
			role="tabpanel"
		>
			{props.collections.items.length || props.collections.pending ? (
				<div className="home-feature-grid">
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
				</div>
			) : null}
			{props.collections.ready && !props.marketFailed && props.collections.items.length === 0 ? (
				<div className="home-no-results">No collections match “{props.query}”.</div>
			) : null}
		</div>
	);
}
