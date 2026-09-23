import { Search } from 'lucide-react';

import type { Collection } from 'api/collections';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { EmptyState } from 'components/molecules/EmptyState';

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
	if (props.matchCount) return null;
	const filtered = Boolean(props.query) || props.initial !== 'all';
	const pagedTokenScope = props.collection.kind === 'tokens' && props.collection.hasMore;
	if (props.listedOnly) {
		if (!props.listingsSettled) return null;
		return (
			<EmptyState
				title={
					props.query
						? `No live listings match “${props.query}”`
						: props.initial !== 'all'
						? `No live listings begin with ${props.initial}`
						: props.failures
						? 'No live listings yet'
						: pagedTokenScope
						? 'No live listings in loaded tokens'
						: 'No live listings found'
				}
				action={
					filtered ? (
						<Button type="button" onClick={props.onClearFilters} size="custom">
							Clear filters
						</Button>
					) : null
				}
			>
				{filtered
					? 'Clear the current filters to see every live listing.'
					: props.failures
					? 'Some candidates could not be checked through the configured AO peers. Retry them before treating this as an empty market.'
					: pagedTokenScope
					? `Every offer candidate among the ${props.collection.assets.length.toLocaleString()} loaded tokens was checked against current process state. Load more tokens to extend this market view.`
					: props.candidates
					? `Every indexed offer candidate was checked against current process state through ${props.gateway}; none remains live.`
					: 'Arweave returned no indexed offer candidates for this collection window. Live state remains the marketplace truth once a candidate is found.'}
			</EmptyState>
		);
	}
	return (
		<div className="collection-empty-state">
			<span>
				<Icon icon={Search} />
			</span>
			<h3>
				{props.query
					? pagedTokenScope
						? `No loaded tokens match “${props.query}”`
						: `No assets match “${props.query}”`
					: props.initial !== 'all'
					? `No names beginning with ${props.initial}`
					: 'Nothing here yet'}
			</h3>
			<p>
				{props.query
					? pagedTokenScope
						? 'Search the next token records or clear the current query.'
						: 'Try a shorter search or clear the current query.'
					: props.initial !== 'all'
					? 'Try another letter or return to all names.'
					: 'This collection does not contain any indexed assets yet.'}
			</p>
			{filtered ? (
				<Button type="button" onClick={props.onClearFilters} size="custom">
					{props.initial !== 'all' ? 'View all names' : 'Clear search'}
				</Button>
			) : null}
		</div>
	);
}
