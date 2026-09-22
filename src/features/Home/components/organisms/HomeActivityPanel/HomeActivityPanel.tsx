import React from 'react';
import { RefreshCw } from 'lucide-react';

import { type Collection, collectionAsset } from 'api/collections';
import {
	type CollectionActivityEvent,
	confirmPurchaseActivity,
	discoverAllCollectionActivityBatched,
	loadMarketActivity,
	saveMarketActivity,
} from 'api/discovery';
import { readAssetStateCached } from 'api/marketplace';
import { operationWithDeadline } from 'api/network';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Loading } from 'components/atoms/Loading';
import { VisuallyHidden } from 'components/atoms/VisuallyHidden';
import { EmptyState } from 'components/molecules/EmptyState';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import {
	collectionActivityVersion,
	DeferredMarketActivityList,
	filterGlobalActivity,
	GlobalActivityCharts,
	globalActivityCollection,
	GlobalActivityFilter,
	globalActivityRecipientIds,
	globalActivityRevealDescription,
	globalActivityWindowDescription,
	newestCollectionActivity,
} from 'features/Activity';
import { requestFailureKind, requestFailureMessage } from 'helpers/app-error';
import { assetGroupRevealComplete } from 'helpers/progressive-assets';

export default function HomeActivityPanel(props: { collections: Collection[]; marketLoading: boolean }) {
	const [events, setEvents] = React.useState<CollectionActivityEvent[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [verifyingPurchases, setVerifyingPurchases] = React.useState(false);
	const [purchaseVerificationFailures, setPurchaseVerificationFailures] = React.useState(0);
	const [purchaseVerificationIncomplete, setPurchaseVerificationIncomplete] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [retry, setRetry] = React.useState(0);
	const [activityFilter, setActivityFilter] = React.useState<GlobalActivityFilter>('all');
	const [activityLimit, setActivityLimit] = React.useState(20);
	const [activityRevealAnnouncement, setActivityRevealAnnouncement] = React.useState('');
	const eventsRef = React.useRef(events);
	const scopeRef = React.useRef('');
	const activityListId = React.useId();
	const activityWindowDescriptionId = React.useId();
	const activityRevealRef = React.useRef<HTMLParagraphElement>(null);
	const eventCountRef = React.useRef(events.length);
	eventsRef.current = events;
	eventCountRef.current = events.length;
	const activityScope = props.collections
		.map((collection) => `${collection.id}:${collectionActivityVersion(collection)}`)
		.sort()
		.join('|');
	const activityRecipients = React.useMemo(() => globalActivityRecipientIds(props.collections), [props.collections]);
	const hasMoreActivityAssets = props.collections.some((collection) => collection.hasMore);

	React.useEffect(() => {
		setActivityLimit(20);
		setActivityRevealAnnouncement('');
	}, [activityFilter, activityScope]);

	React.useEffect(() => {
		if (!activityScope || scopeRef.current === activityScope) return;
		try {
			const cachedEvents = loadMarketActivity(window.localStorage, activityScope).filter((event) =>
				Boolean(globalActivityCollection(props.collections, event.processId))
			);
			if (!cachedEvents.length) return;
			scopeRef.current = activityScope;
			eventsRef.current = cachedEvents;
			setEvents(cachedEvents);
		} catch {
			// Browser storage is optional; live Arweave discovery continues below.
		}
	}, [activityScope, props.collections]);

	React.useEffect(() => {
		if (props.marketLoading) return;
		if (!props.collections.length) {
			setEvents([]);
			setLoading(false);
			setVerifyingPurchases(false);
			setPurchaseVerificationFailures(0);
			setPurchaseVerificationIncomplete(false);
			return;
		}
		const controller = new AbortController();
		const sameScope = scopeRef.current === activityScope;
		let cachedEvents: CollectionActivityEvent[] = [];
		if (!sameScope) {
			try {
				cachedEvents = loadMarketActivity(window.localStorage, activityScope).filter((event) =>
					Boolean(globalActivityCollection(props.collections, event.processId))
				);
			} catch {
				// Browser storage is optional; live Arweave discovery continues below.
			}
		}
		const initialEvents = sameScope && eventsRef.current.length ? eventsRef.current : cachedEvents;
		const preserveEvents = initialEvents.length > 0;
		const found = new Map(initialEvents.map((event) => [event.id, event]));
		scopeRef.current = activityScope;
		if (!preserveEvents) {
			eventsRef.current = [];
			setEvents([]);
		} else if (!sameScope) {
			eventsRef.current = initialEvents;
			setEvents(initialEvents);
		}
		setLoading(true);
		setVerifyingPurchases(false);
		setPurchaseVerificationFailures(0);
		setPurchaseVerificationIncomplete(false);
		setError(null);
		let publishFrame: number | undefined;
		const commitFound = () => {
			publishFrame = undefined;
			if (controller.signal.aborted) return;
			eventsRef.current = newestCollectionActivity([...found.values()], Number.MAX_SAFE_INTEGER);
			setEvents(eventsRef.current);
		};
		const publish = (nextEvents: CollectionActivityEvent[], immediately = false) => {
			if (controller.signal.aborted) return;
			for (const event of nextEvents) {
				const previous = found.get(event.id);
				found.set(
					event.id,
					previous?.purchaseProof && !event.purchaseProof
						? { ...event, purchaseProof: previous.purchaseProof }
						: event
				);
			}
			if (immediately) {
				if (publishFrame !== undefined) window.cancelAnimationFrame(publishFrame);
				commitFound();
			} else {
				publishFrame ??= window.requestAnimationFrame(commitFound);
			}
		};
		const proofFailureProcesses = new Set<string>();
		const publishedProofPayments = new Set(
			initialEvents.flatMap((event) =>
				event.purchaseProof?.transactionId ? [event.purchaseProof.transactionId] : []
			)
		);
		let proofVerificationIncomplete = false;
		const verifyPurchases = async (candidates: CollectionActivityEvent[]) => {
			if (!candidates.some((event) => event.action === 'register-interest' && !event.purchaseProof)) return;
			setVerifyingPurchases(true);
			try {
				await operationWithDeadline(
					(signal) =>
						confirmPurchaseActivity(candidates, {
							signal,
							verificationTimeoutMs: 15_000,
							onFailure: (processId) => {
								proofFailureProcesses.add(processId);
							},
							onProof: (event) => {
								const paymentId = event.purchaseProof?.transactionId;
								if (!paymentId || publishedProofPayments.has(paymentId)) return;
								publishedProofPayments.add(paymentId);
								publish([event]);
							},
							readCurrent: (processId, readSignal) =>
								readAssetStateCached(processId, { signal: readSignal, maxAttempts: 1 }),
						}),
					controller.signal,
					{
						timeoutMs: 45_000,
						timeoutError: 'purchase-proof-verification-budget-exhausted',
					}
				);
			} catch (cause) {
				if (controller.signal.aborted) return;
				proofVerificationIncomplete = true;
			}
		};
		const initialEventIds = new Set(initialEvents.map((event) => event.id));
		// Cached activity can be verified immediately while the index refresh runs.
		// This prevents a complete recipient scan from delaying recent purchase proofs.
		const initialVerification = verifyPurchases(initialEvents);
		void (async () => {
			const historyFailures: unknown[] = [];
			try {
				const completeEvents = await discoverAllCollectionActivityBatched({
					recipients: activityRecipients,
					concurrency: 2,
					signal: controller.signal,
					onPage: (page) => publish(page),
				});
				publish(completeEvents, true);
			} catch (cause) {
				if (controller.signal.aborted) return;
				historyFailures.push(cause);
			}
			if (controller.signal.aborted) return;
			if (publishFrame !== undefined) window.cancelAnimationFrame(publishFrame);
			commitFound();
			// The complete indexed-history scan ends here. Purchase-proof verification is
			// slower optional enrichment and must not keep the history loader running.
			setLoading(false);
			try {
				await initialVerification;
				await verifyPurchases(
					initialEvents.length
						? eventsRef.current.filter((event) => !initialEventIds.has(event.id))
						: eventsRef.current
				);
			} catch (cause) {
				if (controller.signal.aborted) return;
				proofVerificationIncomplete = true;
			}
			if (controller.signal.aborted) return;
			if (publishFrame !== undefined) window.cancelAnimationFrame(publishFrame);
			publishFrame = undefined;
			setVerifyingPurchases(false);
			setPurchaseVerificationFailures(proofFailureProcesses.size);
			setPurchaseVerificationIncomplete(proofVerificationIncomplete);
			commitFound();
			try {
				saveMarketActivity(window.localStorage, activityScope, eventsRef.current);
			} catch {
				// The live result remains available even when storage is unavailable.
			}
			if (historyFailures.length) {
				const kind = historyFailures.some((cause) => requestFailureKind(cause) === 'rate-limited')
					? 'rate-limited'
					: 'unavailable';
				setError(requestFailureMessage('index', kind));
			}
		})();
		return () => {
			controller.abort();
			if (publishFrame !== undefined) window.cancelAnimationFrame(publishFrame);
		};
	}, [activityRecipients, activityScope, props.collections, props.marketLoading, retry]);

	const filteredEvents = filterGlobalActivity(events, activityFilter);
	eventCountRef.current = filteredEvents.length;
	const activityFilters: Array<{ value: GlobalActivityFilter; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'make-offer', label: 'Listings' },
		{ value: 'register-interest', label: 'Confirmed purchases' },
		{ value: 'transfer', label: 'Transfers' },
		{ value: 'cancel-order', label: 'Cancellations' },
	];
	const retryActivity = () => {
		if (loading) return;
		setActivityRevealAnnouncement('');
		setRetry((value) => value + 1);
	};
	const resolveCollection = (event: CollectionActivityEvent) =>
		globalActivityCollection(props.collections, event.processId);
	return (
		<div
			aria-busy={loading || verifyingPurchases}
			aria-labelledby="home-activity-tab"
			className="home-activity-panel"
			id="home-activity-panel"
			role="tabpanel"
		>
			<GlobalActivityCharts events={events} />
			{loading ? (
				<div className="global-activity-loading">
					<Loading label="Loading complete global activity history…" />
				</div>
			) : verifyingPurchases ? (
				<div className="global-activity-loading">
					<Loading label="Verifying confirmed purchases…" />
				</div>
			) : null}
			<p className="activity-window-description" id={activityWindowDescriptionId}>
				{globalActivityWindowDescription(
					events.length,
					activityRecipients.length,
					loading,
					hasMoreActivityAssets
				)}
			</p>
			<div
				aria-describedby={activityWindowDescriptionId}
				aria-label="Filter global activity"
				className="activity-filters"
				role="group"
			>
				{activityFilters.map((filter) => {
					const count = filterGlobalActivity(events, filter.value).length;
					const verificationPending = filter.value === 'register-interest' && verifyingPurchases;
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
			{error ? (
				events.length ? (
					<div className="collection-source-notice home-activity-partial-notice retry-notice">
						<span role="status">
							The complete history scan hasn’t finished. Showing {events.length.toLocaleString()} indexed{' '}
							{events.length === 1 ? 'event' : 'events'} already loaded.
						</span>
						<Button className="with-icon" onClick={retryActivity} size="custom" type="button">
							<Icon icon={RefreshCw} size="sm" /> Retry
						</Button>
					</div>
				) : (
					<ErrorPanel message={`Global activity could not be loaded. ${error}`} onRetry={retryActivity} />
				)
			) : null}
			{purchaseVerificationFailures || purchaseVerificationIncomplete ? (
				<div className="collection-source-notice home-activity-partial-notice retry-notice">
					<span role="status">
						{purchaseVerificationIncomplete ? (
							<>Purchase verification reached its time limit. </>
						) : (
							<>
								{purchaseVerificationFailures.toLocaleString()} marketplace{' '}
								{purchaseVerificationFailures === 1 ? 'asset could' : 'assets could'} not be fully
								checked.{' '}
							</>
						)}
						Successfully verified purchases are still shown.
					</span>
					<Button className="with-icon" onClick={retryActivity} size="custom" type="button">
						<Icon icon={RefreshCw} size="sm" /> Retry verification
					</Button>
				</div>
			) : null}
			<DeferredMarketActivityList
				ariaLabel={`Global market activity, ${
					activityFilters.find((filter) => filter.value === activityFilter)?.label
				}`}
				events={filteredEvents.slice(0, activityLimit)}
				id={activityListId}
				loading={loading}
				resolveAsset={(event) => {
					const collection = resolveCollection(event);
					return collection ? collectionAsset(collection, event.processId) : undefined;
				}}
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
					onClick={() => {
						const nextLimit = Math.min(filteredEvents.length, activityLimit + 20);
						setActivityLimit(nextLimit);
						setActivityRevealAnnouncement(
							globalActivityRevealDescription(
								nextLimit,
								filteredEvents.length,
								events.length,
								activityFilter !== 'all'
							)
						);
						window.requestAnimationFrame(() => {
							if (assetGroupRevealComplete(nextLimit, eventCountRef.current)) {
								activityRevealRef.current?.focus();
							}
						});
					}}
				>
					Show {Math.min(20, filteredEvents.length - activityLimit).toLocaleString()} more activity events
				</Button>
			) : null}
			{!loading && !verifyingPurchases && !error && events.length > 0 && !filteredEvents.length ? (
				<EmptyState title="No matching activity">
					No submitted actions match this filter in the indexed history loaded above.
				</EmptyState>
			) : null}
			{!loading && !error && !events.length ? (
				<EmptyState title="No indexed market activity yet">
					The current marketplace collections have no matching signed market actions in the Arweave index.
				</EmptyState>
			) : null}
		</div>
	);
}
