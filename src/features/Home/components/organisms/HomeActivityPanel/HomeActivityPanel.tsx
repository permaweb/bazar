import React from 'react';
import { RefreshCw } from 'lucide-react';

import type { Collection } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Loading } from 'components/atoms/Loading';
import { VisuallyHidden } from 'components/atoms/VisuallyHidden';
import { EmptyState } from 'components/molecules/EmptyState';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import {
	DeferredMarketActivityList,
	filterGlobalActivity,
	GlobalActivityCharts,
	globalActivityCollection,
	GlobalActivityFilter,
	globalActivityRevealDescription,
	globalActivityWindowDescription,
} from 'features/Activity';
import { appErrorMessage } from 'helpers/app-error';
import { assetGroupRevealComplete } from 'helpers/progressive-assets';

import { useHomeActivity } from '../../../hooks/useHomeActivity';
import { homeActivityAsset } from '../../../model/home-activity';

const ACTIVITY_FILTERS: Array<{ value: GlobalActivityFilter; label: string }> = [
	{ value: 'all', label: 'All' },
	{ value: 'make-offer', label: 'Listings' },
	{ value: 'register-interest', label: 'Confirmed purchases' },
	{ value: 'transfer', label: 'Transfers' },
	{ value: 'cancel-order', label: 'Cancellations' },
];

export default function HomeActivityPanel(props: { collections: Collection[]; marketLoading: boolean }) {
	const activity = useHomeActivity(props.collections, props.marketLoading);
	const [activityFilter, setActivityFilter] = React.useState<GlobalActivityFilter>('all');
	const [activityLimit, setActivityLimit] = React.useState(20);
	const [activityRevealAnnouncement, setActivityRevealAnnouncement] = React.useState('');
	const activityListId = React.useId();
	const activityWindowDescriptionId = React.useId();
	const activityRevealRef = React.useRef<HTMLParagraphElement>(null);
	const eventCountRef = React.useRef(activity.events.length);
	const filteredEvents = filterGlobalActivity(activity.events, activityFilter);
	eventCountRef.current = filteredEvents.length;

	React.useEffect(() => {
		setActivityLimit(20);
		setActivityRevealAnnouncement('');
	}, [activityFilter, activity.scope]);

	const handleRetry = () => {
		if (activity.loading) return;
		setActivityRevealAnnouncement('');
		activity.retry();
	};
	const handleShowMore = () => {
		const nextLimit = Math.min(filteredEvents.length, activityLimit + 20);
		setActivityLimit(nextLimit);
		setActivityRevealAnnouncement(
			globalActivityRevealDescription(
				nextLimit,
				filteredEvents.length,
				activity.events.length,
				activityFilter !== 'all'
			)
		);
		window.requestAnimationFrame(() => {
			if (assetGroupRevealComplete(nextLimit, eventCountRef.current)) {
				activityRevealRef.current?.focus();
			}
		});
	};
	const resolveCollection = (event: CollectionActivityEvent) =>
		globalActivityCollection(props.collections, event.processId);
	return (
		<div
			aria-busy={activity.loading || activity.verifyingPurchases}
			aria-labelledby="home-activity-tab"
			className="home-activity-panel"
			id="home-activity-panel"
			role="tabpanel"
		>
			<GlobalActivityCharts events={activity.events} />
			{activity.loading ? (
				<div className="global-activity-loading">
					<Loading label="Loading complete global activity history…" />
				</div>
			) : activity.verifyingPurchases ? (
				<div className="global-activity-loading">
					<Loading label="Verifying confirmed purchases…" />
				</div>
			) : null}
			<p className="activity-window-description" id={activityWindowDescriptionId}>
				{globalActivityWindowDescription(
					activity.events.length,
					activity.recipientCount,
					activity.loading,
					activity.hasMoreAssets
				)}
			</p>
			<div
				aria-describedby={activityWindowDescriptionId}
				aria-label="Filter global activity"
				className="activity-filters"
				role="group"
			>
				{ACTIVITY_FILTERS.map((filter) => {
					const count = filterGlobalActivity(activity.events, filter.value).length;
					const verificationPending = filter.value === 'register-interest' && activity.verifyingPurchases;
					return (
						<Button
							aria-controls={activityListId}
							aria-pressed={activityFilter === filter.value}
							className="activity-filter"
							key={filter.value}
							onClick={() => setActivityFilter(filter.value)}
							size="small"
						>
							<span>{filter.label}</span>
							<span aria-hidden="true" className="activity-filter-count">
								{verificationPending && count === 0 ? '…' : count.toLocaleString()}
							</span>
							{verificationPending ? (
								<VisuallyHidden>{count.toLocaleString()} verified so far</VisuallyHidden>
							) : null}
						</Button>
					);
				})}
			</div>
			{activity.error ? (
				activity.events.length ? (
					<div className="collection-source-notice home-activity-partial-notice retry-notice">
						<span role="status">
							The complete history scan hasn’t finished. Showing {activity.events.length.toLocaleString()}{' '}
							indexed {activity.events.length === 1 ? 'event' : 'events'} already loaded.
						</span>
						<Button className="with-icon" onClick={handleRetry} size="custom" type="button">
							<Icon icon={RefreshCw} size="sm" /> Retry
						</Button>
					</div>
				) : (
					<ErrorPanel
						message={`Global activity could not be loaded. ${appErrorMessage(activity.error)}`}
						onRetry={handleRetry}
					/>
				)
			) : null}
			{activity.purchaseVerificationFailures || activity.purchaseVerificationIncomplete ? (
				<div className="collection-source-notice home-activity-partial-notice retry-notice">
					<span role="status">
						{activity.purchaseVerificationIncomplete ? (
							<>Purchase verification reached its time limit. </>
						) : (
							<>
								{activity.purchaseVerificationFailures.toLocaleString()} marketplace{' '}
								{activity.purchaseVerificationFailures === 1 ? 'asset could' : 'assets could'} not be
								fully checked.{' '}
							</>
						)}
						Successfully verified purchases are still shown.
					</span>
					<Button className="with-icon" onClick={handleRetry} size="custom" type="button">
						<Icon icon={RefreshCw} size="sm" /> Retry verification
					</Button>
				</div>
			) : null}
			<DeferredMarketActivityList
				ariaLabel={`Global market activity, ${
					ACTIVITY_FILTERS.find((filter) => filter.value === activityFilter)?.label
				}`}
				events={filteredEvents.slice(0, activityLimit)}
				id={activityListId}
				loading={activity.loading}
				resolveAsset={(event) => homeActivityAsset(props.collections, event)}
				resolveCollection={resolveCollection}
			/>
			<p
				className={
					activityRevealAnnouncement && filteredEvents.length > 20 && activityLimit >= filteredEvents.length
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
			{activityLimit < filteredEvents.length ? (
				<Button
					aria-controls={activityListId}
					className="load-more"
					size="custom"
					type="button"
					onClick={handleShowMore}
				>
					Show {Math.min(20, filteredEvents.length - activityLimit).toLocaleString()} more activity events
				</Button>
			) : null}
			{!activity.loading &&
			!activity.verifyingPurchases &&
			!activity.error &&
			activity.events.length > 0 &&
			!filteredEvents.length ? (
				<EmptyState title="No matching activity">
					No submitted actions match this filter in the indexed history loaded above.
				</EmptyState>
			) : null}
			{!activity.loading && !activity.error && !activity.events.length ? (
				<EmptyState title="No indexed market activity yet">
					The current marketplace collections have no matching signed market actions in the Arweave index.
				</EmptyState>
			) : null}
		</div>
	);
}
