import React from 'react';

import type { Collection } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';

import { Button } from 'components/atoms/Button';
import { Loading } from 'components/atoms/Loading';
import { EmptyState } from 'components/molecules/EmptyState';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import { DeferredMarketActivityList, globalActivityCollection, type GlobalActivityFilter } from 'features/Activity';
import { formatMessage } from 'helpers/i18n';
import { useAppErrorMessage } from 'hooks/useAppErrorMessage';
import { useMessages } from 'providers/LanguageProvider';

import { useHomeActivity } from '../../../hooks/useHomeActivity';
import { HOME_MESSAGES } from '../../../messages';
import { HOME_ACTIVITY_REVEAL_STEP, homeActivityAsset, homeActivityRevealLabel } from '../../../model/home-activity';

export default function HomeActivityPanel(props: { collections: Collection[]; marketLoading: boolean }) {
	const messages = useMessages(HOME_MESSAGES);
	const errorMessage = useAppErrorMessage();
	const activity = useHomeActivity(props.collections, props.marketLoading);
	const activityListId = React.useId();
	const activityFilters: Array<{ value: GlobalActivityFilter; label: string }> = React.useMemo(
		() => [
			{ value: 'all', label: messages.homeActivityFilterAll },
			{ value: 'make-offer', label: messages.homeActivityFilterListings },
			{ value: 'transfer', label: messages.homeActivityFilterTransfers },
			{ value: 'cancel-order', label: messages.homeActivityFilterCancellations },
		],
		[messages]
	);
	const canReveal = activity.limit < activity.filteredEvents.length;
	const activeFilter = activityFilters.find((filter) => filter.value === activity.filter) ?? activityFilters[0];
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
			<div aria-label={messages.homeActivityFilterGroup} className="activity-filters" role="group">
				{activityFilters.map((filter) => (
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
					<Loading
						label={
							activity.events.length
								? messages.homeActivityLoadingMore
								: messages.homeActivityLoadingInitial
						}
					/>
				</div>
			) : null}
			{activity.error ? (
				activity.events.length ? (
					<div className="collection-source-notice home-activity-partial-notice retry-notice">
						<span role="status">
							{formatMessage(messages.homeActivityPartialError, {
								error: errorMessage(activity.error),
							})}
						</span>
						<Button onClick={handleRetry} size="small">
							{messages.homeActivityRetry}
						</Button>
					</div>
				) : (
					<ErrorPanel
						heading={messages.homeErrorHeading}
						message={formatMessage(messages.homeActivityError, {
							error: errorMessage(activity.error),
						})}
						retryAction={{ label: messages.homeErrorRetry, onClick: handleRetry }}
					/>
				)
			) : null}
			<DeferredMarketActivityList
				ariaLabel={formatMessage(messages.homeActivityListLabel, {
					filter: activeFilter.label,
				})}
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
				<EmptyState title={messages.homeActivityEmptyTitle}>
					{activity.hasNextPage ? messages.homeActivityEmptyMore : messages.homeActivityEmptyNone}
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
					{homeActivityRevealLabel(
						{
							loading: activity.loading,
							canReveal,
							revealCount: Math.min(
								HOME_ACTIVITY_REVEAL_STEP,
								activity.filteredEvents.length - activity.limit
							),
							matchingCount: activity.filteredEvents.length,
						},
						messages
					)}
				</Button>
			) : !activity.loading && !activity.error ? (
				<p className="collection-result-count">{messages.homeActivityEnd}</p>
			) : null}
		</div>
	);
}
