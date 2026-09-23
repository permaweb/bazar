import { Link } from 'react-router-dom';
import { History } from 'lucide-react';

import type { Collection } from 'api/collections';

import { Icon } from 'components/atoms/Icon';
import { Pressable } from 'components/atoms/Pressable';

import { collectionIdentity } from '../../../model/collection-market';

export default function CollectionTabs(props: {
	collection: Collection;
	active: 'assets' | 'offers' | 'activity';
	onSelectAssets?(): void;
	onSelectOffers?(): void;
}) {
	return (
		<nav className="collection-tabs" aria-label={`${collectionIdentity(props.collection).name} views`}>
			{props.onSelectAssets ? (
				<Pressable
					aria-current={props.active === 'assets' ? 'page' : undefined}
					className={props.active === 'assets' ? 'active' : ''}
					onClick={props.onSelectAssets}
					type="button"
				>
					{props.collection.kind === 'tokens' ? 'Tokens' : 'Items'}
				</Pressable>
			) : (
				<Link
					aria-current={props.active === 'assets' ? 'page' : undefined}
					className={props.active === 'assets' ? 'active' : ''}
					to={`/collection/${props.collection.id}`}
				>
					{props.collection.kind === 'tokens' ? 'Tokens' : 'Items'}
				</Link>
			)}
			{props.onSelectOffers ? (
				<Pressable
					aria-current={props.active === 'offers' ? 'page' : undefined}
					className={props.active === 'offers' ? 'active' : ''}
					onClick={props.onSelectOffers}
					type="button"
				>
					Offers
				</Pressable>
			) : (
				<Link
					aria-current={props.active === 'offers' ? 'page' : undefined}
					className={props.active === 'offers' ? 'active' : ''}
					to={`/collection/${props.collection.id}?view=offers`}
				>
					Offers
				</Link>
			)}
			<Link
				aria-current={props.active === 'activity' ? 'page' : undefined}
				className={props.active === 'activity' ? 'active' : ''}
				to={`/collection/${props.collection.id}/activity`}
			>
				<Icon icon={History} size="sm" /> Activity
			</Link>
		</nav>
	);
}
