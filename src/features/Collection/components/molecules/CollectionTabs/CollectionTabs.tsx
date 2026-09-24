import { Link } from 'react-router-dom';
import { History } from 'lucide-react';

import type { Collection } from 'api/collections';

import { Icon } from 'components/atoms/Icon';
import { Pressable } from 'components/atoms/Pressable';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { COLLECTION_MESSAGES } from '../../../messages';
import { collectionIdentity } from '../../../model/collection-market';

import * as S from './styles';

export default function CollectionTabs(props: {
	collection: Collection;
	active: 'assets' | 'offers' | 'activity';
	onSelectAssets?(): void;
	onSelectOffers?(): void;
}) {
	const language = useMessages(COLLECTION_MESSAGES);
	const assetsLabel = props.collection.kind === 'tokens' ? language.tabTokens : language.tabItems;
	return (
		<S.Tabs
			className="collection-tabs"
			aria-label={formatMessage(language.tabsLabel, {
				name: collectionIdentity(props.collection, language).name,
			})}
		>
			{props.onSelectAssets ? (
				<Pressable
					aria-current={props.active === 'assets' ? 'page' : undefined}
					className={props.active === 'assets' ? 'active' : ''}
					onClick={props.onSelectAssets}
					type="button"
				>
					{assetsLabel}
				</Pressable>
			) : (
				<Link
					aria-current={props.active === 'assets' ? 'page' : undefined}
					className={props.active === 'assets' ? 'active' : ''}
					to={`/collection/${props.collection.id}`}
				>
					{assetsLabel}
				</Link>
			)}
			{props.onSelectOffers ? (
				<Pressable
					aria-current={props.active === 'offers' ? 'page' : undefined}
					className={props.active === 'offers' ? 'active' : ''}
					onClick={props.onSelectOffers}
					type="button"
				>
					{language.tabOffers}
				</Pressable>
			) : (
				<Link
					aria-current={props.active === 'offers' ? 'page' : undefined}
					className={props.active === 'offers' ? 'active' : ''}
					to={`/collection/${props.collection.id}?view=offers`}
				>
					{language.tabOffers}
				</Link>
			)}
			<Link
				aria-current={props.active === 'activity' ? 'page' : undefined}
				className={props.active === 'activity' ? 'active' : ''}
				to={`/collection/${props.collection.id}/activity`}
			>
				<Icon icon={History} size="sm" /> {language.tabActivity}
			</Link>
		</S.Tabs>
	);
}
