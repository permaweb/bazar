import {
	type CollectionActivityEvent,
	type CollectionActivityPageOptions,
	discoverCollectionActivityPage,
} from 'api/asset-discovery';

export type GlobalActivityFilter = 'all' | CollectionActivityEvent['action'];
export const GLOBAL_ACTIVITY_PAGE_SIZE = 100;

export type GlobalActivityPageState = {
	events: CollectionActivityEvent[];
	cursor: string | null;
	hasNextPage: boolean;
	loaded: boolean;
};

const emptyPage = (): GlobalActivityPageState => ({ events: [], cursor: null, hasNextPage: true, loaded: false });

/** Some gateways repeat a mined transaction as an undated row later in the same stream. */
export function mergeIndexedActivityEvent(
	previous: CollectionActivityEvent | undefined,
	event: CollectionActivityEvent
) {
	if (!previous) return event;
	const purchaseProof = event.purchaseProof ?? previous.purchaseProof;
	return {
		...previous,
		...event,
		actor: event.actor || previous.actor,
		height: event.height || previous.height,
		timestamp: event.timestamp || previous.timestamp,
		...(purchaseProof ? { purchaseProof } : {}),
	};
}

/** One bounded native GraphQL page per request; filtered-out rows still advance the raw cursor. */
export function createGlobalActivityPager(
	options: Pick<CollectionActivityPageOptions, 'acceptProcessId' | 'fetch' | 'graphql' | 'requestTimeoutMs'>
) {
	const streams = new Map<GlobalActivityFilter, GlobalActivityPageState>();
	const visited = new Map<GlobalActivityFilter, Set<string>>();
	const proofs = new Map<string, NonNullable<CollectionActivityEvent['purchaseProof']>>();
	const get = (filter: GlobalActivityFilter) => streams.get(filter) ?? emptyPage();
	return {
		get,
		async load(
			filter: GlobalActivityFilter,
			{ refresh = false, signal }: { refresh?: boolean; signal?: AbortSignal } = {}
		) {
			const previous = get(filter);
			if (previous.loaded && !previous.hasNextPage && !refresh) return previous;
			const page = await discoverCollectionActivityPage({
				...options,
				actions: filter === 'all' ? undefined : [filter],
				cursor: refresh ? null : previous.cursor,
				pageSize: GLOBAL_ACTIVITY_PAGE_SIZE,
				includeCount: false,
				signal,
			});
			signal?.throwIfAborted();
			const cursors = refresh ? new Set<string>() : new Set(visited.get(filter));
			if (page.hasNextPage && (!page.cursor || cursors.has(page.cursor))) {
				throw new Error('collection-activity-pagination-stalled');
			}
			if (page.cursor) cursors.add(page.cursor);
			const events = new Map((refresh ? [] : previous.events).map((event) => [event.id, event]));
			for (const event of page.events) {
				const proof = proofs.get(event.id);
				events.set(
					event.id,
					mergeIndexedActivityEvent(events.get(event.id), proof ? { ...event, purchaseProof: proof } : event)
				);
			}
			// Preserve the gateway's descending order, including pending transactions at the head.
			const next = {
				events: [...events.values()],
				cursor: page.cursor,
				hasNextPage: page.hasNextPage,
				loaded: true,
			};
			streams.set(filter, next);
			visited.set(filter, cursors);
			return next;
		},
		confirm(event: CollectionActivityEvent) {
			if (!event.purchaseProof) return;
			for (const [id, proof] of proofs) {
				if (id !== event.id && proof.transactionId === event.purchaseProof.transactionId) return;
			}
			proofs.set(event.id, event.purchaseProof);
			for (const [filter, state] of streams) {
				streams.set(filter, {
					...state,
					events: state.events.map((previous) =>
						previous.id === event.id ? { ...previous, purchaseProof: event.purchaseProof } : previous
					),
				});
			}
		},
	};
}
