import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { Loading } from 'components/atoms/Loading';
import { EmptyState } from 'components/molecules/EmptyState';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import { RouteState } from 'components/molecules/RouteState';
import { ACTIVITY_MESSAGES, collectionActivityScanAnnouncement, DeferredMarketActivityList } from 'features/Activity';
import { formatMessage } from 'helpers/i18n';
import { assetGroupRevealComplete } from 'helpers/progressive-assets';
import { useAppErrorMessage } from 'hooks/useAppErrorMessage';
import { useMessages, usePlural } from 'providers/LanguageProvider';
import { useMarketProvider } from 'providers/MarketProvider';

import { useCollectionActivity } from '../../../hooks/useCollectionActivity';
import { COLLECTION_MESSAGES } from '../../../messages';
import { CollectionActivityAnalytics } from '../../molecules/CollectionActivityAnalytics';
import { CollectionIndexNotice } from '../../molecules/CollectionIndexNotice';
import { CollectionMarketSummary } from '../../molecules/CollectionMarketSummary';
import { CollectionTabs } from '../../molecules/CollectionTabs';

export default function CollectionActivityFeed() {
	const { collectionId = '' } = useParams();
	const language = useMessages(COLLECTION_MESSAGES);
	const market = useMarketProvider();
	const activityMessages = useMessages(ACTIVITY_MESSAGES);
	const errorMessage = useAppErrorMessage();
	const plural = usePlural();
	const collection = market.collections.find((item) => item.id === collectionId);
	const activity = useCollectionActivity(collection);
	const events = activity.events;
	const [activityLimit, setActivityLimit] = React.useState(20);
	const [activityRevealAnnouncement, setActivityRevealAnnouncement] = React.useState('');
	const activityListId = React.useId();
	const activityRevealRef = React.useRef<HTMLParagraphElement>(null);
	const eventCountRef = React.useRef(events.length);
	eventCountRef.current = events.length;

	React.useEffect(() => {
		setActivityLimit(20);
		setActivityRevealAnnouncement('');
	}, [activity.scope]);

	if (!collection && market.loading)
		return (
			<RouteState
				title={language.collectionActivityRouteTitle}
				backLabel={language.backAllCollections}
				eyebrow={language.collectionRouteEyebrow}
			>
				<Loading label={language.readingCollectionIndex} />
			</RouteState>
		);
	if (!collection && market.error)
		return (
			<RouteState
				title={language.activityUnavailableTitle}
				backLabel={language.backAllCollections}
				eyebrow={language.collectionRouteEyebrow}
			>
				<ErrorPanel
					heading={language.collectionErrorHeading}
					message={market.error}
					retryAction={{ label: language.retry, onClick: market.retry }}
				/>
			</RouteState>
		);
	if (!collection)
		return (
			<RouteState
				title={language.collectionNotFoundTitle}
				backLabel={language.backAllCollections}
				eyebrow={language.collectionRouteEyebrow}
			>
				<ErrorPanel heading={language.collectionErrorHeading} message={language.collectionNotFoundDetail} />
			</RouteState>
		);
	const activityScanAnnouncement = collectionActivityScanAnnouncement(
		{
			error: Boolean(activity.error),
			events: events.length,
			loading: activity.loading,
			pages: activity.pages,
			preservingEvents: activity.preserving,
		},
		activityMessages,
		plural
	);
	return (
		<section className="collection-page collection-marketplace-page collection-activity-page view-compact">
			<Link className="back" to="/">
				<Icon icon={ArrowLeft} size="sm" /> {language.backAllCollections}
			</Link>
			<div className="collection-market-navigation">
				<CollectionMarketSummary
					collection={collection}
					stats={[
						{
							label: language.statIndexedEvents,
							value: activity.loading
								? formatMessage(language.indexedEventsSoFar, {
										count: events.length.toLocaleString(),
								  })
								: events.length.toLocaleString(),
						},
						{
							label: language.statLoadedSupply,
							value: formatMessage(language.loadedSupplyValue, {
								loaded: collection.assets.length.toLocaleString(),
								total: (collection.total ?? collection.assets.length).toLocaleString(),
							}),
						},
						{ label: language.statBatchesChecked, value: activity.pages.toLocaleString() },
						{
							label: language.statActivityStatus,
							value: activity.error
								? language.activityStatusNeedsRetry
								: activity.loading
								? activity.preserving
									? language.activityStatusRefreshing
									: language.statChecking
								: language.activityStatusCurrent,
						},
					]}
				/>
				<CollectionTabs collection={collection} active="activity" />
			</div>
			<LiveRegion>{activityScanAnnouncement}</LiveRegion>
			<CollectionIndexNotice collection={collection} checking={market.loading} onRetry={market.retry} />
			{collection.kind === 'tokens' && collection.hasMore ? (
				<div className="collection-source-notice">
					<span role="status">
						{formatMessage(language.activityFeedScope, {
							loaded: collection.assets.length.toLocaleString(),
							total: (collection.total ?? collection.assets.length).toLocaleString(),
						})}
					</span>
					<Link className="with-icon" to={`/collection/${collection.id}`}>
						{language.activityFeedOpenCollection}
						<Icon icon={ArrowUpRight} size="xs" />
					</Link>
				</div>
			) : null}
			{activity.error ? (
				<ErrorPanel
					heading={language.collectionErrorHeading}
					message={
						events.length
							? formatMessage(language.activityInterruptedWithEvents, {
									count: events.length.toLocaleString(),
									error: errorMessage(activity.error),
							  })
							: formatMessage(language.activityInterrupted, {
									error: errorMessage(activity.error),
							  })
					}
					retryAction={{
						label: language.retry,
						onClick: () => {
							setActivityRevealAnnouncement('');
							activity.retry();
						},
					}}
				/>
			) : null}
			<DeferredMarketActivityList
				ariaLabel={language.activityListLabel}
				collectionId={collection.id}
				events={events.slice(0, activityLimit)}
				id={activityListId}
				loading={activity.loading}
				resolveAsset={activity.resolveAsset}
			/>
			<p
				className={
					activityRevealAnnouncement && events.length > 20 && activityLimit >= events.length
						? 'collection-result-count reveal-complete'
						: 'sr-only'
				}
				aria-live="polite"
				ref={activityRevealRef}
				role="status"
				tabIndex={-1}
			>
				{activityRevealAnnouncement}
			</p>
			{activityLimit < events.length ? (
				<Button
					aria-controls={activityListId}
					className="load-more"
					size="custom"
					type="button"
					onClick={() => {
						const nextLimit = Math.min(events.length, activityLimit + 20);
						setActivityLimit(nextLimit);
						setActivityRevealAnnouncement(
							formatMessage(language.activityShowing, {
								shown: nextLimit.toLocaleString(),
								total: events.length.toLocaleString(),
							})
						);
						window.requestAnimationFrame(() => {
							if (assetGroupRevealComplete(nextLimit, eventCountRef.current)) {
								activityRevealRef.current?.focus();
							}
						});
					}}
				>
					{formatMessage(language.activityShowMore, {
						count: Math.min(20, events.length - activityLimit).toLocaleString(),
					})}
				</Button>
			) : null}
			{activity.loading && !events.length ? <Loading label={language.activityLoading} /> : null}
			{!activity.loading && !activity.error && !events.length ? (
				<EmptyState title={language.activityEmptyTitle}>{language.activityEmptyDetail}</EmptyState>
			) : null}
			<CollectionActivityAnalytics
				error={Boolean(activity.error)}
				events={events.length}
				loading={activity.loading}
				pages={activity.pages}
			/>
		</section>
	);
}
