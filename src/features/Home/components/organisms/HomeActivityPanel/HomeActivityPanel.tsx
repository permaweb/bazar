import React from 'react';

import type { Collection } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';

import { Button } from 'components/atoms/Button';
import { Loading } from 'components/atoms/Loading';
import { EmptyState } from 'components/molecules/EmptyState';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import { DeferredMarketActivityList, globalActivityCollection, type GlobalActivityFilter } from 'features/Activity';
import { appErrorMessage } from 'helpers/app-error';

import { useHomeActivity } from '../../../hooks/useHomeActivity';
import { HOME_ACTIVITY_REVEAL_STEP, homeActivityAsset, homeActivityRevealLabel } from '../../../model/home-activity';

const ACTIVITY_FILTERS: Array<{ value: GlobalActivityFilter; label: string }> = [
	{ value: 'all', label: 'All' },
	{ value: 'make-offer', label: 'Listings' },
	{ value: 'transfer', label: 'Transfers' },
	{ value: 'cancel-order', label: 'Cancellations' },
];

export default function HomeActivityPanel(props: { collections: Collection[]; marketLoading: boolean }) {
	const activity = useHomeActivity(props.collections, props.marketLoading);
	const activityListId = React.useId();
	const canReveal = activity.limit < activity.filteredEvents.length;
	const resolveCollection = (event: CollectionActivityEvent) =>
		globalActivityCollection(props.collections, event.processId);

	function handleRetry() {
		activity.requestPage('initial');
	}

	function handleReveal() {
		if (canReveal) activity.revealMore();
		else activity.requestPage('more');
	}

	return (
		<div
			aria-busy={activity.loading}
			aria-labelledby="home-activity-tab"
			className="home-activity-panel"
			id="home-activity-panel"
			role="tabpanel"
		>
			<div aria-label="Filter global activity" className="activity-filters" role="group">
				{ACTIVITY_FILTERS.map((filter) => (
					<Button
						aria-controls={activityListId}
						aria-pressed={activity.filter === filter.value}
						className="activity-filter"
						key={filter.value}
						onClick={() => activity.setFilter(filter.value)}
						size="small"
					>
						{filter.label}
					</Button>
				))}
			</div>
			{activity.loading ? (
				<div className="global-activity-loading">
					<Loading label={activity.events.length ? 'Loading activity…' : 'Loading recent activity…'} />
				</div>
			) : null}
			{activity.error ? (
				activity.events.length ? (
					<div className="collection-source-notice home-activity-partial-notice retry-notice">
						<span role="status">
							This page could not be loaded. Your loaded activity is still available.{' '}
							{appErrorMessage(activity.error)}
						</span>
						<Button onClick={handleRetry} size="small">
							Retry activity
						</Button>
					</div>
				) : (
					<ErrorPanel
						message={`Activity could not be loaded. ${appErrorMessage(activity.error)}`}
						onRetry={handleRetry}
					/>
				)
			) : null}
			<DeferredMarketActivityList
				ariaLabel={`Global market activity, ${
					ACTIVITY_FILTERS.find((filter) => filter.value === activity.filter)?.label
				}`}
				events={activity.filteredEvents.slice(0, activity.limit)}
				id={activityListId}
				loading={activity.loading}
				resolveAsset={(event) => homeActivityAsset(props.collections, event)}
				resolveCollection={resolveCollection}
			/>
			<p className="sr-only" role="status" aria-live="polite">
				{activity.announcement}
			</p>
			{!activity.loading && !activity.error && !activity.filteredEvents.length ? (
				<EmptyState title="No matching activity loaded">
					{activity.hasNextPage
						? 'Check older activity for more results.'
						: 'No matching events were found for the currently loaded marketplace assets.'}
				</EmptyState>
			) : null}
			{canReveal || activity.hasNextPage ? (
				<Button
					aria-controls={activityListId}
					className="load-more"
					disabled={activity.loading}
					size="custom"
					type="button"
					onClick={handleReveal}
				>
					{homeActivityRevealLabel({
						loading: activity.loading,
						canReveal,
						revealCount: Math.min(
							HOME_ACTIVITY_REVEAL_STEP,
							activity.filteredEvents.length - activity.limit
						),
						matchingCount: activity.filteredEvents.length,
					})}
				</Button>
			) : !activity.loading && !activity.error ? (
				<p className="collection-result-count">End of indexed activity for this filter.</p>
			) : null}
		</div>
	);
}
