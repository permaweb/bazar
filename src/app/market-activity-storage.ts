import type { CollectionActivityEvent } from 'api/asset-discovery';

export const MARKET_ACTIVITY_STORAGE_KEY = 'bazar-market-activity:v1';

type ActivityStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type StoredActivity = {
	scope: string;
	savedAt: number;
	events: CollectionActivityEvent[];
};

export function loadMarketActivity(storage: ActivityStorage, scope: string) {
	const entries = readEntries(storage);
	return entries.find((entry) => entry.scope === scope)?.events ?? [];
}

export function saveMarketActivity(
	storage: ActivityStorage,
	scope: string,
	events: CollectionActivityEvent[],
	savedAt = Date.now()
) {
	try {
		const entries = readEntries(storage).filter((entry) => entry.scope !== scope);
		entries.unshift({ scope, savedAt, events: events.slice(0, 100) });
		storage.setItem(MARKET_ACTIVITY_STORAGE_KEY, JSON.stringify({ version: 1, entries: entries.slice(0, 24) }));
	} catch {
		// Activity is an immutable display cache; live discovery remains authoritative.
	}
}

function readEntries(storage: ActivityStorage): StoredActivity[] {
	let value: unknown;
	try {
		value = JSON.parse(storage.getItem(MARKET_ACTIVITY_STORAGE_KEY) ?? 'null');
	} catch {
		storage.removeItem(MARKET_ACTIVITY_STORAGE_KEY);
		return [];
	}
	if (!record(value) || value.version !== 1 || !Array.isArray(value.entries)) return [];
	return value.entries.flatMap((entry) => {
		if (!record(entry) || typeof entry.scope !== 'string' || !Number.isFinite(entry.savedAt)) return [];
		if (!Array.isArray(entry.events)) return [];
		const events = entry.events.flatMap((event) => (activityEvent(event) ? [event] : []));
		return events.length ? [{ scope: entry.scope, savedAt: Number(entry.savedAt), events }] : [];
	});
}

function activityEvent(value: unknown): value is CollectionActivityEvent {
	if (!record(value)) return false;
	if (
		typeof value.id !== 'string' ||
		typeof value.processId !== 'string' ||
		typeof value.actor !== 'string' ||
		!['make-offer', 'register-interest', 'transfer', 'cancel-order'].includes(String(value.action)) ||
		!Number.isFinite(value.height) ||
		!Number.isFinite(value.timestamp)
	)
		return false;
	for (const field of ['asking', 'quantity', 'orderId', 'recipient']) {
		if (value[field] !== undefined && typeof value[field] !== 'string') return false;
	}
	return (
		value.purchaseProof === undefined ||
		(record(value.purchaseProof) &&
			typeof value.purchaseProof.transactionId === 'string' &&
			Number.isFinite(value.purchaseProof.height))
	);
}

function record(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
