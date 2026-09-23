import { type Collection, collectionAsset } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';

import { globalActivityCollection, globalActivityRecipientIds } from 'features/Activity';

/** How many rows the feed reveals at a time, and how far each successful page request extends that window. */
export const HOME_ACTIVITY_REVEAL_STEP = 20;

/** Which page a request asked for: a fresh first page, or the next older one. */
export type HomeActivityRequestKind = 'initial' | 'more';

export type HomeActivityRequest = { kind: HomeActivityRequestKind; id: number };

export const INITIAL_HOME_ACTIVITY_REQUEST: HomeActivityRequest = { kind: 'initial', id: 0 };

/** The next request for `kind`; the id makes every request distinct, so a repeat still reloads. */
export function nextHomeActivityRequest(
	current: HomeActivityRequest,
	kind: HomeActivityRequestKind
): HomeActivityRequest {
	return { kind, id: current.id + 1 };
}

/**
 * The exact marketplace membership the feed checks locally, as a stable JSON array. The global GraphQL query is
 * unscoped, so membership is filtered in the browser instead of sending every recipient.
 */
export function homeActivityScope(collections: Collection[]) {
	return JSON.stringify([...globalActivityRecipientIds(collections)].sort());
}

// The loaded asset an activity event refers to, when its collection is part of the market.
export function homeActivityAsset(collections: Collection[], event: CollectionActivityEvent) {
	const collection = globalActivityCollection(collections, event.processId);
	return collection ? collectionAsset(collection, event.processId) : undefined;
}

export function homeActivityLoadedAnnouncement(eventCount: number) {
	return `${Math.max(0, Math.floor(eventCount)).toLocaleString()} indexed events loaded.`;
}

/** The label of the feed's single paging control, which reveals loaded rows before requesting an older page. */
export function homeActivityRevealLabel(input: {
	loading: boolean;
	canReveal: boolean;
	revealCount: number;
	matchingCount: number;
}) {
	if (input.loading) return 'Loading activity…';
	if (input.canReveal) return `Show ${input.revealCount} more events`;
	return input.matchingCount ? 'Load older activity' : 'Check older activity';
}
