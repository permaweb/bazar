import { Search } from 'lucide-react';

import type { Collection } from 'api/collections';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { EmptyState } from 'components/molecules/EmptyState';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { COLLECTION_MESSAGES } from '../../../messages';

import * as S from './styles';

// Explains why no assets or live listings match, and offers to clear the search and letter filters.
export default function CollectionMarketEmptyState(props: {
	collection: Collection;
	listedOnly: boolean;
	/** The listing pass is still running or failed; live listings are not known yet. */
	listingsSettled: boolean;
	matchCount: number;
	query: string;
	initial: string;
	failures: number;
	candidates: number;
	gateway: string;
	onClearFilters(): void;
}) {
	const language = useMessages(COLLECTION_MESSAGES);
	if (props.matchCount) return null;
	const filtered = Boolean(props.query) || props.initial !== 'all';
	const pagedTokenScope = props.collection.kind === 'tokens' && props.collection.hasMore;
	if (props.listedOnly) {
		if (!props.listingsSettled) return null;
		return (
			<EmptyState
				title={
					props.query
						? formatMessage(language.listingsEmptyQueryTitle, { query: props.query })
						: props.initial !== 'all'
						? formatMessage(language.listingsEmptyInitialTitle, { initial: props.initial })
						: props.failures
						? language.listingsEmptyFailuresTitle
						: pagedTokenScope
						? language.listingsEmptyLoadedTokensTitle
						: language.listingsEmptyTitle
				}
				action={
					filtered ? (
						<Button type="button" onClick={props.onClearFilters} size="custom">
							{language.clearFilters}
						</Button>
					) : null
				}
			>
				{filtered
					? language.listingsEmptyFilteredDetail
					: props.failures
					? language.listingsEmptyFailuresDetail
					: pagedTokenScope
					? formatMessage(language.listingsEmptyLoadedTokensDetail, {
							count: props.collection.assets.length.toLocaleString(),
					  })
					: props.candidates
					? formatMessage(language.listingsEmptyCandidatesDetail, { gateway: props.gateway })
					: language.listingsEmptyDetail}
			</EmptyState>
		);
	}
	return (
		<S.Empty className="collection-empty-state">
			<span>
				<Icon icon={Search} />
			</span>
			<h3>
				{props.query
					? formatMessage(
							pagedTokenScope
								? language.assetsEmptyLoadedTokensQueryTitle
								: language.assetsEmptyQueryTitle,
							{ query: props.query }
					  )
					: props.initial !== 'all'
					? formatMessage(language.assetsEmptyInitialTitle, { initial: props.initial })
					: language.assetsEmptyTitle}
			</h3>
			<p>
				{props.query
					? pagedTokenScope
						? language.assetsEmptyLoadedTokensQueryDetail
						: language.assetsEmptyQueryDetail
					: props.initial !== 'all'
					? language.assetsEmptyInitialDetail
					: language.assetsEmptyDetail}
			</p>
			{filtered ? (
				<Button type="button" onClick={props.onClearFilters} size="custom">
					{props.initial !== 'all' ? language.viewAllNames : language.clearSearch}
				</Button>
			) : null}
		</S.Empty>
	);
}
