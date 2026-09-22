import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';

import { collectionAsset } from 'api/collections';
import {
	type CollectionActivityEvent,
	discoverCollectionActivity,
	discoverCollectionActivityBatched,
	loadMarketActivity,
	saveMarketActivity,
} from 'api/discovery';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { Loading } from 'components/atoms/Loading';
import { EmptyState } from 'components/molecules/EmptyState';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import { RouteState } from 'components/molecules/RouteState';
import {
	collectionActivityScanAnnouncement,
	collectionActivityVersion,
	collectionAssetWindowDelta,
	collectionCandidateMembership,
	DeferredMarketActivityList,
	newestCollectionActivity,
	retainNewestCollectionActivity,
} from 'features/Activity';
import { marketplaceFailureKind, marketplaceRequestFailureMessage } from 'helpers/marketplace-error';
import { assetGroupRevealComplete } from 'helpers/progressive-assets';
import { useMarketProvider } from 'providers/MarketProvider';

import { CollectionActivityAnalytics } from '../../molecules/CollectionActivityAnalytics';
import { CollectionIndexNotice } from '../../molecules/CollectionIndexNotice';
import { CollectionMarketSummary } from '../../molecules/CollectionMarketSummary';
import { CollectionTabs } from '../../molecules/CollectionTabs';

export default function CollectionActivityFeed() {
	const { collectionId = '' } = useParams();
	const market = useMarketProvider();
	const collection = market.collections.find((item) => item.id === collectionId);
	const [events, setEvents] = React.useState<CollectionActivityEvent[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [pages, setPages] = React.useState(0);
	const [preservingEvents, setPreservingEvents] = React.useState(false);
	const [retry, setRetry] = React.useState(0);
	const [activityLimit, setActivityLimit] = React.useState(20);
	const [activityRevealAnnouncement, setActivityRevealAnnouncement] = React.useState('');
	const eventsRef = React.useRef<CollectionActivityEvent[]>([]);
	const activityBatchEvents = React.useRef(new Map<string, CollectionActivityEvent>());
	const activityLoadedAssetIds = React.useRef(new Set<string>());
	const activityRunMode = React.useRef<'refresh' | 'retry'>('refresh');
	const scopeRef = React.useRef('');
	const activityListId = React.useId();
	const activityRevealRef = React.useRef<HTMLParagraphElement>(null);
	const eventCountRef = React.useRef(events.length);
	eventCountRef.current = events.length;
	const activityScope = React.useMemo(
		() =>
			collection
				? `${collection.id}:${
						collection.kind === 'names'
							? collectionActivityVersion(collection)
							: collection.manifestId ?? collection.id
				  }`
				: '',
		[collection]
	);
	const activityWindowVersion = React.useMemo(
		() => collection?.assets.map((asset) => asset.id).join('.') ?? '',
		[collection?.assets]
	);

	React.useEffect(() => {
		setActivityLimit(20);
		setActivityRevealAnnouncement('');
	}, [activityScope]);

	React.useEffect(() => {
		if (!collection) return;
		const controller = new AbortController();
		const includesCollectionAsset = collectionCandidateMembership(collection);
		const sameScope = scopeRef.current === activityScope;
		let cachedEvents: CollectionActivityEvent[] = [];
		if (!sameScope) {
			try {
				cachedEvents = loadMarketActivity(window.localStorage, activityScope).filter((event) =>
					includesCollectionAsset(event.processId)
				);
			} catch {
				// Browser storage is optional; live Arweave discovery continues below.
			}
		}
		const assetIds = collection.assets.map((asset) => asset.id);
		const assetWindow = collectionAssetWindowDelta(activityLoadedAssetIds.current, assetIds);
		const retryMissing =
			collection.kind !== 'names' && sameScope && !assetWindow.reset && activityRunMode.current === 'retry';
		const continueWindow =
			collection.kind !== 'names' && sameScope && !assetWindow.reset && assetWindow.added.length > 0;
		const incremental = retryMissing || continueWindow;
		const initialEvents = sameScope && eventsRef.current.length ? eventsRef.current : cachedEvents;
		const preserveEvents = initialEvents.length > 0;
		let nextEvents = newestCollectionActivity(initialEvents);
		scopeRef.current = activityScope;
		activityRunMode.current = 'refresh';
		if (!incremental) {
			activityBatchEvents.current.clear();
			activityLoadedAssetIds.current.clear();
			retainNewestCollectionActivity(activityBatchEvents.current, initialEvents);
		}
		if (!preserveEvents) {
			eventsRef.current = [];
			setEvents([]);
		} else if (!sameScope) {
			eventsRef.current = initialEvents;
			setEvents(initialEvents);
		}
		setPreservingEvents(preserveEvents);
		setLoading(true);
		setPages(0);
		setError(null);
		const discovery =
			collection.kind === 'names'
				? discoverCollectionActivity({
						signal: controller.signal,
						limit: 100,
						acceptProcessId: includesCollectionAsset,
						requiredExecutionDevice: 'carrier@1.0',
						onPage: (page) => {
							if (controller.signal.aborted) return;
							nextEvents = newestCollectionActivity([...nextEvents, ...page]);
							setPages((current) => current + 1);
							eventsRef.current = nextEvents;
							setEvents(eventsRef.current);
						},
				  })
				: discoverCollectionActivityBatched({
						signal: controller.signal,
						limit: 100,
						recipients: incremental
							? assetIds.filter((assetId) => !activityLoadedAssetIds.current.has(assetId))
							: assetIds,
						onBatch: (batchEvents, completedRecipients) => {
							if (controller.signal.aborted || scopeRef.current !== activityScope) return;
							for (const assetId of completedRecipients) activityLoadedAssetIds.current.add(assetId);
							setPages((current) => current + 1);
							eventsRef.current = retainNewestCollectionActivity(
								activityBatchEvents.current,
								batchEvents
							);
							setEvents(eventsRef.current);
						},
				  });
		void discovery.then(
			() => {
				if (!controller.signal.aborted) {
					eventsRef.current =
						collection.kind === 'names'
							? newestCollectionActivity(nextEvents)
							: newestCollectionActivity([...activityBatchEvents.current.values()]);
					setEvents(eventsRef.current);
					try {
						saveMarketActivity(window.localStorage, activityScope, eventsRef.current);
					} catch {
						// The live result remains available when storage is unavailable.
					}
					setLoading(false);
					setPreservingEvents(false);
				}
			},
			(cause) => {
				if (!controller.signal.aborted) {
					setError(marketplaceRequestFailureMessage('index', marketplaceFailureKind(cause)));
					setLoading(false);
				}
			}
		);
		return () => controller.abort();
	}, [activityScope, activityWindowVersion, retry]);

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
		error: Boolean(error),
		events: events.length,
		loading,
		pages,
		preservingEvents,
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
							value: loading
								? `${events.length.toLocaleString()} so far`
								: events.length.toLocaleString(),
						},
						{
							label: 'Loaded / supply',
							value: `${collection.assets.length.toLocaleString()} / ${(
								collection.total ?? collection.assets.length
							).toLocaleString()}`,
						},
						{ label: 'Batches checked', value: pages.toLocaleString() },
						{
							label: 'Activity status',
							value: error
								? 'Needs retry'
								: loading
								? preservingEvents
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
			{error ? (
				<ErrorPanel
					message={`Activity scanning was interrupted. ${
						events.length ? `${events.length.toLocaleString()} existing events remain visible. ` : ''
					}${error}`}
					onRetry={() => {
						setActivityRevealAnnouncement('');
						activityRunMode.current = 'retry';
						setRetry((value) => value + 1);
					}}
				/>
			) : null}
			<DeferredMarketActivityList
				ariaLabel="Recent market activity"
				collectionId={collection.id}
				events={events.slice(0, activityLimit)}
				id={activityListId}
				loading={loading}
				resolveAsset={(event) => collectionAsset(collection, event.processId)}
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
			{loading && !events.length ? <Loading label="Reading indexed collection activity from Arweave…" /> : null}
			{!loading && !error && !events.length ? (
				<EmptyState title="No indexed market activity yet">
					This collection has no matching signed market actions in the current Arweave index.
				</EmptyState>
			) : null}
			<CollectionActivityAnalytics
				error={Boolean(error)}
				events={events.length}
				loading={loading}
				pages={pages}
			/>
		</section>
	);
}
