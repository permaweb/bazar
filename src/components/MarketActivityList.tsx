import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CircleX, ShoppingCart, Tag } from 'lucide-react';

import { transactionExplorerUrl } from 'api/arweave-explorer';
import type { CollectionActivityEvent } from 'api/asset-discovery';
import { type AssetState, parseSwapOrder } from 'api/asset-marketplace';
import type { AssetSummary, Collection } from 'api/collections';

import { ArCurrencyText } from 'components/ArCurrencyLabel';
import { Tooltip } from 'components/Tooltip';
import { WalletAddress } from 'components/WalletAddress';

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'always' });
const absoluteTime = new Intl.DateTimeFormat(undefined, {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
});

function CompactActivityAmount({ amount }: { amount: string }) {
	const containerRef = React.useRef<HTMLSpanElement>(null);
	const textRef = React.useRef<HTMLSpanElement>(null);
	const [ticker, setTicker] = React.useState({ active: false, shift: 0, duration: 0 });

	React.useEffect(() => {
		const container = containerRef.current;
		const text = textRef.current;
		if (!container || !text) return;
		let disposed = false;
		const update = () => {
			if (disposed) return;
			const active = text.scrollWidth > container.clientWidth + 1;
			const shift = active ? text.scrollWidth + 24 : 0;
			const duration = active ? Math.max(4, shift / 32) : 0;
			setTicker((current) =>
				current.active === active && current.shift === shift && current.duration === duration
					? current
					: { active, shift, duration }
			);
		};
		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
		observer?.observe(container);
		window.addEventListener('resize', update);
		void document.fonts?.ready.then(update);
		update();
		return () => {
			disposed = true;
			observer?.disconnect();
			window.removeEventListener('resize', update);
		};
	}, [amount]);

	const value = <ArCurrencyText>{amount}</ArCurrencyText>;
	return (
		<span
			className={`activity-compact-amount${ticker.active ? ' is-overflowing' : ''}`}
			ref={containerRef}
			style={
				ticker.active
					? ({
							'--activity-ticker-duration': `${ticker.duration}s`,
							'--activity-ticker-shift': `-${ticker.shift}px`,
					  } as React.CSSProperties)
					: undefined
			}
		>
			<span className="activity-compact-amount-static" ref={textRef}>
				{value}
			</span>
			<span aria-hidden="true" className="activity-compact-amount-track">
				<span>{value}</span>
				<span>{value}</span>
			</span>
		</span>
	);
}

export function MarketActivityList({
	ariaLabel,
	collectionId,
	compact = false,
	describeEvent = marketActivityDetail,
	eventAmount,
	events,
	id,
	loading = false,
	reservationState,
	resolveAsset,
	resolveCollection,
}: {
	ariaLabel: string;
	collectionId?: string;
	compact?: boolean;
	describeEvent?(event: CollectionActivityEvent): string;
	eventAmount?(event: CollectionActivityEvent): string;
	events: CollectionActivityEvent[];
	id?: string;
	loading?: boolean;
	reservationState?: AssetState | null;
	resolveAsset(event: CollectionActivityEvent): AssetSummary | undefined;
	resolveCollection?(event: CollectionActivityEvent): Pick<Collection, 'id' | 'name'> | undefined;
}) {
	const [now, setNow] = React.useState(() => Date.now());
	React.useEffect(() => {
		let timer: number | undefined;
		const schedule = () => {
			window.clearTimeout(timer);
			if (document.visibilityState !== 'visible') return;
			const current = Date.now();
			setNow(current);
			const delay = marketActivityRefreshDelay(events, current);
			if (delay !== null) timer = window.setTimeout(schedule, delay);
		};
		const resume = () => schedule();
		document.addEventListener('visibilitychange', resume);
		schedule();
		return () => {
			window.clearTimeout(timer);
			document.removeEventListener('visibilitychange', resume);
		};
	}, [events]);
	return (
		<ul aria-busy={loading} aria-label={ariaLabel} className={`activity-list${compact ? ' compact' : ''}`} id={id}>
			{events.map((event) => {
				const asset = resolveAsset(event);
				const collection = resolveCollection?.(event);
				const reservation = marketActivityReservation(event, reservationState);
				const headline = reservation ? (
					<>
						Reserved. Payment deadline at block {reservation.deadline.toLocaleString()}.
						{reservation.expired ? (
							<>
								{' '}
								<span className="activity-reservation-expired">(Expired)</span>
							</>
						) : null}
					</>
				) : (
					marketActivityLabel(event.action, Boolean(event.purchaseProof))
				);
				const detail = [collection?.name, describeEvent(event)].filter(Boolean).join(' · ');
				const amount = eventAmount?.(event) ?? '';
				const assetCollectionId = collection?.id ?? collectionId;
				const transactionId = event.purchaseProof?.transactionId ?? event.id;
				const transactionHeight = event.purchaseProof?.height ?? event.height;
				const timestamp = event.timestamp
					? formatMarketActivityTimestamp(event.timestamp, now)
					: 'Pending confirmation';
				const absoluteTimestamp = event.timestamp
					? formatMarketActivityAbsoluteTimestamp(event.timestamp)
					: undefined;
				const timestampDateTime = event.timestamp ? new Date(event.timestamp * 1_000).toISOString() : undefined;
				const transactionLabel =
					transactionHeight > 0
						? `View ${
								event.purchaseProof ? 'settlement proof' : 'submitted transaction'
						  } included in block ${transactionHeight.toLocaleString()}`
						: 'View submitted transaction';
				if (compact) {
					return (
						<li className="activity-row activity-row-compact" key={event.id}>
							<span aria-hidden="true" className={`activity-icon action-${event.action}`}>
								{marketActivitySymbol(event.action)}
							</span>
							<div className="activity-compact-summary">
								<strong>{headline}</strong>
								{detail ? (
									<small>
										<ArCurrencyText>{detail}</ArCurrencyText>
									</small>
								) : null}
							</div>
							<CompactActivityAmount amount={amount || '—'} />
							<div className="activity-compact-actor">
								{event.actor ? (
									<WalletAddress address={event.actor} label="actor" />
								) : (
									<span>Unknown</span>
								)}
							</div>
							<Tooltip className="activity-compact-time-wrap" content={absoluteTimestamp ?? timestamp}>
								{(tooltipId) => (
									<time
										aria-describedby={tooltipId}
										className="activity-compact-time"
										dateTime={timestampDateTime}
									>
										{timestamp}
									</time>
								)}
							</Tooltip>
							<a
								aria-label={transactionLabel}
								className="activity-compact-transaction"
								href={transactionExplorerUrl(transactionId)}
								target="_blank"
								rel="noreferrer"
							>
								<ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
							</a>
						</li>
					);
				}
				return (
					<li className="activity-row" key={event.id}>
						<span aria-hidden="true" className={`activity-icon action-${event.action}`}>
							{marketActivitySymbol(event.action)}
						</span>
						<div className={`activity-main${amount ? ' has-amount' : ''}`}>
							<div className="activity-main-copy">
								<strong>{headline}</strong>
								{asset && assetCollectionId ? (
									<Link to={`/asset/${assetCollectionId}/${asset.id}`}>{asset.name}</Link>
								) : asset ? (
									<span>{asset.name}</span>
								) : (
									<span>{shortActivityValue(event.processId)}</span>
								)}
								<small className={detail ? undefined : 'activity-time-only'}>
									<ArCurrencyText>{detail}</ArCurrencyText>
									<Tooltip className="activity-mobile-time" content={absoluteTimestamp ?? timestamp}>
										{(tooltipId) => (
											<time aria-describedby={tooltipId} dateTime={timestampDateTime}>
												{detail ? ' · ' : ''}
												{timestamp}
											</time>
										)}
									</Tooltip>
								</small>
							</div>
							{amount ? (
								<strong className="activity-amount">
									<ArCurrencyText>{amount}</ArCurrencyText>
								</strong>
							) : null}
						</div>
						<div className="activity-meta">
							<div className="activity-actor">
								<span>Actor</span>
								{event.actor ? (
									<WalletAddress address={event.actor} label="actor" />
								) : (
									<strong>Unknown</strong>
								)}
							</div>
							<div className="activity-block">
								<Tooltip className="activity-desktop-time" content={absoluteTimestamp ?? timestamp}>
									{(tooltipId) => (
										<time aria-describedby={tooltipId} dateTime={timestampDateTime}>
											{timestamp}
										</time>
									)}
								</Tooltip>
								<a
									aria-label={transactionLabel}
									href={transactionExplorerUrl(transactionId)}
									target="_blank"
									rel="noreferrer"
								>
									<span className="activity-transaction-long" aria-hidden="true">
										{transactionHeight > 0
											? `View ${
													event.purchaseProof ? 'settlement proof' : 'submitted transaction'
											  } · included in block ${transactionHeight.toLocaleString()}`
											: 'View submitted transaction'}
									</span>
									<span className="activity-transaction-short" aria-hidden="true">
										View transaction
									</span>
									<ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
								</a>
							</div>
						</div>
					</li>
				);
			})}
		</ul>
	);
}

export function marketActivityReservation(event: CollectionActivityEvent, state?: AssetState | null) {
	if (event.action !== 'register-interest' || event.purchaseProof || !event.orderId || !state) return null;
	const rawOrders = state.raw.orders;
	if (!rawOrders || typeof rawOrders !== 'object' || Array.isArray(rawOrders)) return null;
	const order = parseSwapOrder(event.orderId, (rawOrders as Record<string, unknown>)[event.orderId]);
	const effectiveOrder = state.orders[event.orderId];
	if (
		order?.status !== 'reserved' ||
		order.buyer !== event.actor ||
		order.reservedUntil === undefined ||
		!effectiveOrder ||
		!['open', 'reserved'].includes(effectiveOrder.status)
	) {
		return null;
	}
	return { deadline: order.reservedUntil, expired: effectiveOrder.status === 'open' };
}

export function marketActivityLabel(action: CollectionActivityEvent['action'], purchaseConfirmed = false) {
	return {
		'make-offer': 'Listing submitted',
		'register-interest': purchaseConfirmed ? 'Purchase confirmed' : 'Purchase submitted',
		transfer: 'Transfer submitted',
		'cancel-order': 'Cancellation submitted',
	}[action];
}

export function marketActivityDetail(event: CollectionActivityEvent) {
	if (event.action === 'make-offer' && event.asking) return `${winstonToAr(event.asking)} AR total`;
	if (event.action === 'transfer' && event.recipient) return `To ${shortActivityValue(event.recipient)}`;
	if (event.action === 'register-interest' && event.orderId) return `Order ${shortActivityValue(event.orderId)}`;
	if (event.action === 'cancel-order' && event.orderId) return `Order ${shortActivityValue(event.orderId)}`;
	return '';
}

export function formatMarketActivityTimestamp(timestamp: number, now = Date.now()) {
	const elapsedSeconds = Math.max(1, Math.floor((now - timestamp * 1_000) / 1_000));
	if (elapsedSeconds < 60) return relativeTime.format(-elapsedSeconds, 'second');
	const elapsedMinutes = Math.floor(elapsedSeconds / 60);
	if (elapsedMinutes < 60) return relativeTime.format(-elapsedMinutes, 'minute');
	const elapsedHours = Math.floor(elapsedMinutes / 60);
	if (elapsedHours < 24) return relativeTime.format(-elapsedHours, 'hour');
	const elapsedDays = Math.floor(elapsedHours / 24);
	if (elapsedDays < 7) return relativeTime.format(-elapsedDays, 'day');
	const elapsedWeeks = Math.floor(elapsedDays / 7);
	if (elapsedWeeks < 4) return relativeTime.format(-elapsedWeeks, 'week');
	const elapsedMonths = Math.max(1, Math.floor(elapsedDays / 30));
	if (elapsedMonths < 12) return relativeTime.format(-elapsedMonths, 'month');
	return relativeTime.format(-Math.floor(elapsedDays / 365), 'year');
}

export function formatMarketActivityAbsoluteTimestamp(timestamp: number) {
	return absoluteTime.format(new Date(timestamp * 1000));
}

export function marketActivityRefreshDelay(events: CollectionActivityEvent[], now = Date.now()) {
	let delay = Number.POSITIVE_INFINITY;
	for (const event of events) {
		if (!event.timestamp) continue;
		const elapsed = Math.max(0, now - event.timestamp * 1_000);
		const interval =
			elapsed < 60_000 ? 1_000 : elapsed < 3_600_000 ? 60_000 : elapsed < 86_400_000 ? 3_600_000 : 86_400_000;
		delay = Math.min(delay, interval - (elapsed % interval));
	}
	return Number.isFinite(delay) ? Math.max(250, delay + 20) : null;
}

function marketActivitySymbol(action: CollectionActivityEvent['action']) {
	const ActivityIcon = {
		'make-offer': Tag,
		'register-interest': ShoppingCart,
		transfer: ArrowRight,
		'cancel-order': CircleX,
	}[action];
	return <ActivityIcon className="ui-icon" aria-hidden="true" />;
}

function shortActivityValue(value: string) {
	return `${value.slice(0, 6)}…${value.slice(-5)}`;
}

function winstonToAr(value: string) {
	return (Number(value) / 1_000_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 12 });
}
