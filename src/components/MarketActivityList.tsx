import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CircleX, ShoppingCart, Tag } from 'lucide-react';

import { transactionExplorerUrl } from 'api/arweave-explorer';
import type { CollectionActivityEvent } from 'api/asset-discovery';
import type { AssetSummary, Collection } from 'api/collections';

import { WalletAddress } from 'components/WalletAddress';

export function MarketActivityList({
	ariaLabel,
	collectionId,
	describeEvent = marketActivityDetail,
	events,
	id,
	loading = false,
	resolveAsset,
	resolveCollection,
}: {
	ariaLabel: string;
	collectionId?: string;
	describeEvent?(event: CollectionActivityEvent): string;
	events: CollectionActivityEvent[];
	id?: string;
	loading?: boolean;
	resolveAsset(event: CollectionActivityEvent): AssetSummary | undefined;
	resolveCollection?(event: CollectionActivityEvent): Pick<Collection, 'id' | 'name'> | undefined;
}) {
	const [now, setNow] = React.useState(() => Date.now());
	React.useEffect(() => {
		setNow(Date.now());
		const interval = window.setInterval(() => setNow(Date.now()), 1_000);
		return () => window.clearInterval(interval);
	}, []);
	return (
		<ul aria-busy={loading} aria-label={ariaLabel} className="activity-list" id={id}>
			{events.map((event) => {
				const asset = resolveAsset(event);
				const collection = resolveCollection?.(event);
				const detail = [collection?.name, describeEvent(event)].filter(Boolean).join(' · ');
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
				return (
					<li className="activity-row" key={event.id}>
						<span aria-hidden="true" className={`activity-icon action-${event.action}`}>
							{marketActivitySymbol(event.action)}
						</span>
						<div className="activity-main">
							<strong>{marketActivityLabel(event.action, Boolean(event.purchaseProof))}</strong>
							{asset && assetCollectionId ? (
								<Link to={`/asset/${assetCollectionId}/${asset.id}`}>{asset.name}</Link>
							) : asset ? (
								<span>{asset.name}</span>
							) : (
								<span>{shortActivityValue(event.processId)}</span>
							)}
							<small className={detail ? undefined : 'activity-time-only'}>
								{detail}
								<time
									className="activity-mobile-time"
									dateTime={timestampDateTime}
									title={absoluteTimestamp}
								>
									{detail ? ' · ' : ''}
									{timestamp}
								</time>
							</small>
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
								<time
									className="activity-desktop-time"
									dateTime={timestampDateTime}
									title={absoluteTimestamp}
								>
									{timestamp}
								</time>
								<a
									aria-label={
										transactionHeight > 0
											? `View ${
													event.purchaseProof ? 'settlement proof' : 'submitted transaction'
											  } included in block ${transactionHeight.toLocaleString()}`
											: 'View submitted transaction'
									}
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
	const relative = new Intl.RelativeTimeFormat('en', { numeric: 'always' });
	if (elapsedSeconds < 60) return relative.format(-elapsedSeconds, 'second');
	const elapsedMinutes = Math.floor(elapsedSeconds / 60);
	if (elapsedMinutes < 60) return relative.format(-elapsedMinutes, 'minute');
	const elapsedHours = Math.floor(elapsedMinutes / 60);
	if (elapsedHours < 24) return relative.format(-elapsedHours, 'hour');
	const elapsedDays = Math.floor(elapsedHours / 24);
	if (elapsedDays < 7) return relative.format(-elapsedDays, 'day');
	const elapsedWeeks = Math.floor(elapsedDays / 7);
	if (elapsedWeeks < 4) return relative.format(-elapsedWeeks, 'week');
	const elapsedMonths = Math.max(1, Math.floor(elapsedDays / 30));
	if (elapsedMonths < 12) return relative.format(-elapsedMonths, 'month');
	return relative.format(-Math.floor(elapsedDays / 365), 'year');
}

export function formatMarketActivityAbsoluteTimestamp(timestamp: number) {
	return new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(new Date(timestamp * 1000));
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
