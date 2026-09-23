import type { Collection } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';
import { type AssetState, parseSwapOrder } from 'api/marketplace';

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'always' });
const absoluteTime = new Intl.DateTimeFormat(undefined, {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	hour: 'numeric',
	minute: '2-digit',
});

export type MarketActivityReservation = { deadline: number; expired: boolean };

export function marketActivityReservation(
	event: CollectionActivityEvent,
	state?: AssetState | null
): MarketActivityReservation | null {
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
	if (event.action === 'make-offer' && event.asking) return `${activityWinstonToAr(event.asking)} AR total`;
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

// Milliseconds until the soonest relative timestamp in the list changes its visible text, or null when none is dated.
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

export function shortActivityValue(value: string) {
	return `${value.slice(0, 6)}…${value.slice(-5)}`;
}

export type MarketActivityRow = {
	reservation: MarketActivityReservation | null;
	label: string;
	detail: string;
	amount: string;
	assetCollectionId: string | undefined;
	transactionId: string;
	transactionHeight: number;
	timestamp: string;
	absoluteTimestamp: string | undefined;
	timestampDateTime: string | undefined;
	transactionLabel: string;
	transactionSummary: string;
};

// Everything one activity row displays, derived from the event and the list's optional formatters.
export function marketActivityRow(
	event: CollectionActivityEvent,
	context: {
		now: number;
		collection?: Pick<Collection, 'id' | 'name'>;
		collectionId?: string;
		reservationState?: AssetState | null;
		describeEvent?(event: CollectionActivityEvent): string;
		eventAmount?(event: CollectionActivityEvent): string;
	}
): MarketActivityRow {
	const reservation = marketActivityReservation(event, context.reservationState);
	const transactionHeight = event.purchaseProof?.height ?? event.height;
	const transactionKind = event.purchaseProof ? 'settlement proof' : 'submitted transaction';
	const timestamp = event.timestamp
		? formatMarketActivityTimestamp(event.timestamp, context.now)
		: 'Pending confirmation';
	return {
		reservation,
		label: marketActivityLabel(event.action, Boolean(event.purchaseProof)),
		detail: [context.collection?.name, (context.describeEvent ?? marketActivityDetail)(event)]
			.filter(Boolean)
			.join(' · '),
		amount: context.eventAmount?.(event) ?? '',
		assetCollectionId: context.collection?.id ?? context.collectionId,
		transactionId: event.purchaseProof?.transactionId ?? event.id,
		transactionHeight,
		timestamp,
		absoluteTimestamp: event.timestamp ? formatMarketActivityAbsoluteTimestamp(event.timestamp) : undefined,
		timestampDateTime: event.timestamp ? new Date(event.timestamp * 1_000).toISOString() : undefined,
		transactionLabel:
			transactionHeight > 0
				? `View ${transactionKind} included in block ${transactionHeight.toLocaleString()}`
				: 'View submitted transaction',
		transactionSummary:
			transactionHeight > 0
				? `View ${transactionKind} · included in block ${transactionHeight.toLocaleString()}`
				: 'View submitted transaction',
	};
}

// Display-only conversion kept from the original list formatter: it rounds through a JavaScript number, so totals
// above 2^53 winston lose trailing digits. Signed quantities never pass through here.
function activityWinstonToAr(value: string) {
	return (Number(value) / 1_000_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 12 });
}
