import { LoaderCircle } from 'lucide-react';

import { useMessages } from 'providers/LanguageProvider';

import { HOME_MESSAGES } from '../../../messages';

import * as S from './styles';

export default function HomeMarketGhostCard(props: { kind: 'collection' }) {
	const messages = useMessages(HOME_MESSAGES);
	const collection = props.kind === 'collection';
	return (
		<S.Ghost
			className={`home-market-ghost home-market-ghost--${props.kind}${collection ? ' home-feature-card' : ''}`}
			role="status"
		>
			<LoaderCircle aria-hidden="true" />
			<strong>{collection ? messages.homeLoadingCollections : messages.homeLoadingAssets}</strong>
			<span>{collection ? messages.homeCheckingIndexes : messages.homeCheckingListings}</span>
		</S.Ghost>
	);
}
