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
import { collectionActivityScanAnnouncement, DeferredMarketActivityList } from 'features/Activity';
import { appErrorMessage } from 'helpers/app-error';
import { assetGroupRevealComplete } from 'helpers/progressive-assets';
import { useMarketProvider } from 'providers/MarketProvider';

import { useCollectionActivity } from '../../../hooks/useCollectionActivity';
import { CollectionActivityAnalytics } from '../../molecules/CollectionActivityAnalytics';
import { CollectionIndexNotice } from '../../molecules/CollectionIndexNotice';
import { CollectionMarketSummary } from '../../molecules/CollectionMarketSummary';
import { CollectionTabs } from '../../molecules/CollectionTabs';

export default function CollectionActivityFeed() {
	const { collectionId = '' } = useParams();
	const market = useMarketProvider();
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
			<RouteState title="Collection activity">
				<Loading label="Reading collection index…" />
			</RouteState>
		);
	if (!collection && market.error)
		return (
			<RouteState title="Activity unavailable">
				<ErrorPanel message={market.error} onRetry={market.retry} />
			</RouteState>
		);
	if (!collection)
		return (
			<RouteState title="Collection not found">
				<ErrorPanel message="This collection could not be found on Arweave." />
			</RouteState>
		);
	const activityScanAnnouncement = collectionActivityScanAnnouncement({
		error: Boolean(activity.error),
		events: events.length,
		loading: activity.loading,
		pages: activity.pages,
		preservingEvents: activity.preserving,
	});
	return (
		<section className="collection-page collection-marketplace-page collection-activity-page view-compact">
			<Link className="back" to="/">
				<Icon icon={ArrowLeft} size="sm" /> All collections
			</Link>
			<div className="collection-market-navigation">
				<CollectionMarketSummary
					collection={collection}
					stats={[
						{
							label: 'Indexed events',
							value: activity.loading
								? `${events.length.toLocaleString()} so far`
								: events.length.toLocaleString(),
						},
						{
							label: 'Loaded / supply',
							value: `${collection.assets.length.toLocaleString()} / ${(
								collection.total ?? collection.assets.length
							).toLocaleString()}`,
						},
						{ label: 'Batches checked', value: activity.pages.toLocaleString() },
						{
							label: 'Activity status',
							value: activity.error
								? 'Needs retry'
								: activity.loading
								? activity.preserving
									? 'Refreshing'
									: 'Checking…'
								: 'Current',
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
						This feed covers {collection.assets.length.toLocaleString()} of{' '}
						{(collection.total ?? collection.assets.length).toLocaleString()} discovered tokens currently
						loaded in the collection.
					</span>
					<Link className="with-icon" to={`/collection/${collection.id}`}>
						Open collection to load more
						<Icon icon={ArrowUpRight} size="xs" />
					</Link>
				</div>
			) : null}
			{activity.error ? (
				<ErrorPanel
					message={`Activity scanning was interrupted. ${
						events.length ? `${events.length.toLocaleString()} existing events remain visible. ` : ''
					}${appErrorMessage(activity.error)}`}
					onRetry={() => {
						setActivityRevealAnnouncement('');
						activity.retry();
					}}
				/>
			) : null}
			<DeferredMarketActivityList
				ariaLabel="Recent market activity"
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
							`Showing ${nextLimit.toLocaleString()} of ${events.length.toLocaleString()} indexed activity events.`
						);
						window.requestAnimationFrame(() => {
							if (assetGroupRevealComplete(nextLimit, eventCountRef.current)) {
								activityRevealRef.current?.focus();
							}
						});
					}}
				>
					Show {Math.min(20, events.length - activityLimit).toLocaleString()} more activity events
				</Button>
			) : null}
			{activity.loading && !events.length ? (
				<Loading label="Reading indexed collection activity from Arweave…" />
			) : null}
			{!activity.loading && !activity.error && !events.length ? (
				<EmptyState title="No indexed market activity yet">
					This collection has no matching signed market actions in the current Arweave index.
				</EmptyState>
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
