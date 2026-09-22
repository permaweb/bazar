import { type Collection, isVisibleAssetId } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';

const globalActivityCollections = new WeakMap<Collection[], Map<string, Collection>>();

export function globalActivityCollection(collections: Collection[], processId: string) {
	if (!isVisibleAssetId(processId)) return undefined;
	let indexed = globalActivityCollections.get(collections);
	if (!indexed) {
		indexed = new Map();
		for (const collection of collections) {
			const processIds =
				collection.kind === 'names'
					? Object.keys(collection.namespace?.namesById ?? {})
					: collection.assets.map((asset) => asset.id);
			for (const id of processIds) {
				if (isVisibleAssetId(id)) indexed.set(id, collection);
			}
		}
		globalActivityCollections.set(collections, indexed);
	}
	return indexed.get(processId);
}

export function globalActivityRecipientIds(collections: Collection[]) {
	const ids = new Set<string>();
	for (const collection of collections) {
		const processIds =
			collection.kind === 'names'
				? Object.keys(collection.namespace?.namesById ?? {})
				: collection.assets.map((asset) => asset.id);
		for (const id of processIds) if (isVisibleAssetId(id)) ids.add(id);
	}
	return [...ids];
}

export type GlobalActivityFilter = 'all' | CollectionActivityEvent['action'];

export const GLOBAL_ACTIVITY_WINDOW_SIZE = 100;

export function filterGlobalActivity(events: CollectionActivityEvent[], filter: GlobalActivityFilter) {
	if (filter === 'all') return events;
	return events.filter(
		(event) => event.action === filter && (filter !== 'register-interest' || Boolean(event.purchaseProof))
	);
}

export function globalActivityWindowDescription(
	eventCount: number,
	assetCount = 0,
	loading = false,
	hasMoreAssets = false
) {
	const count = Math.max(0, Math.floor(eventCount));
	const assets = Math.max(0, Math.floor(assetCount));
	if (loading) {
		return `Reading complete indexed history for ${assets.toLocaleString()} marketplace ${
			assets === 1 ? 'asset' : 'assets'
		}. ${count.toLocaleString()} ${count === 1 ? 'event' : 'events'} found so far.`;
	}
	return `All ${count.toLocaleString()} indexed ${count === 1 ? 'event' : 'events'} found for ${
		hasMoreAssets ? 'the currently loaded ' : ''
	}${assets.toLocaleString()} marketplace ${assets === 1 ? 'asset is' : 'assets are'} loaded.${
		hasMoreAssets ? ' More assets remain in paged collections.' : ''
	}`;
}

export function globalActivityRevealDescription(
	shownCount: number,
	matchingCount: number,
	_loadedCount: number,
	filtered: boolean,
	_limit = GLOBAL_ACTIVITY_WINDOW_SIZE
) {
	const shown = Math.max(0, Math.floor(shownCount));
	const matching = Math.max(0, Math.floor(matchingCount));
	const qualifier = filtered ? ' matching' : '';
	if (shown < matching) {
		return `Showing ${shown.toLocaleString()} of ${matching.toLocaleString()}${qualifier} indexed events.`;
	}
	const eventLabel = matching === 1 ? 'event' : 'events';
	const verb = matching === 1 ? 'is' : 'are';
	return `All ${matching.toLocaleString()}${qualifier} indexed ${eventLabel} ${verb} shown.`;
}

export function collectionActivityVersion(collection: Collection) {
	if (collection.kind === 'names') return collection.namespace?.manifestId ?? '';
	return `${collection.manifestId ?? ''}:${collection.assets.map((asset) => asset.id).join('.')}`;
}

export function newestCollectionActivity(events: CollectionActivityEvent[], limit = GLOBAL_ACTIVITY_WINDOW_SIZE) {
	const byId = new Map<string, CollectionActivityEvent>();
	for (const event of events) {
		const previous = byId.get(event.id);
		byId.set(
			event.id,
			previous?.purchaseProof && !event.purchaseProof
				? { ...event, purchaseProof: previous.purchaseProof }
				: event
		);
	}
	return [...byId.values()]
		.sort((a, b) => b.height - a.height || b.timestamp - a.timestamp || a.id.localeCompare(b.id))
		.slice(0, limit);
}

export function retainNewestCollectionActivity(
	events: Map<string, CollectionActivityEvent>,
	additions: CollectionActivityEvent[],
	limit = 100
) {
	const retained = newestCollectionActivity([...events.values(), ...additions], limit);
	events.clear();
	for (const event of retained) events.set(event.id, event);
	return retained;
}

export function collectionListingScopeVersion(collection: Collection) {
	return collection.kind === 'tokens'
		? collection.manifestId ?? collection.id
		: collectionActivityVersion(collection);
}

export function collectionAssetWindowDelta(previousIds: Iterable<string>, currentIds: string[]) {
	const previous = new Set(previousIds);
	const current = new Set(currentIds);
	const reset = [...previous].some((assetId) => !current.has(assetId));
	return {
		reset,
		added: reset ? currentIds : currentIds.filter((assetId) => !previous.has(assetId)),
	};
}

export function collectionActivityWindowDelta(
	kind: Collection['kind'],
	listedOnly: boolean,
	previousIds: Iterable<string>,
	currentIds: string[]
) {
	const recipientBatched = kind !== 'names' || !listedOnly;
	const window = collectionAssetWindowDelta(previousIds, currentIds);
	return {
		recipientBatched,
		reset: recipientBatched && window.reset,
		added: recipientBatched ? window.added : currentIds,
	};
}

export function collectionCandidateMembership(collection: Collection) {
	if (collection.kind === 'names') {
		const namesById = collection.namespace?.namesById ?? {};
		return (processId: string) => isVisibleAssetId(processId) && Object.hasOwn(namesById, processId);
	}
	const assetIds = new Set(collection.assets.filter((asset) => isVisibleAssetId(asset.id)).map((asset) => asset.id));
	return (processId: string) => isVisibleAssetId(processId) && assetIds.has(processId);
}

export function collectionActivityScanAnnouncement({
	error,
	events,
	loading,
	pages,
	preservingEvents,
}: {
	error: boolean;
	events: number;
	loading: boolean;
	pages: number;
	preservingEvents: boolean;
}) {
	if (!loading) {
		return error
			? `Activity scanning stopped. ${events.toLocaleString()} previously indexed ${
					events === 1 ? 'event remains' : 'events remain'
			  } visible.`
			: `Activity scan complete. ${events.toLocaleString()} indexed ${events === 1 ? 'event' : 'events'} found.`;
	}
	if (pages === 0) {
		return preservingEvents
			? 'Refreshing indexed activity from Arweave. Existing events remain visible.'
			: 'Reading indexed activity from Arweave.';
	}
	const milestone = pages < 10 ? 1 : Math.floor(pages / 10) * 10;
	return `${preservingEvents ? 'Activity refresh' : 'Activity scan'} checked ${milestone.toLocaleString()} ${
		milestone === 1 ? 'batch' : 'batches'
	} so far.`;
}
