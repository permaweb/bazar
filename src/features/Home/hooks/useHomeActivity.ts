import React from 'react';

import type { Collection } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';

import {
	ACTIVITY_MESSAGES,
	createGlobalActivityPager,
	filterGlobalActivity,
	type GlobalActivityFilter,
	globalActivityRevealDescription,
} from 'features/Activity';
import { type AppError, toAppError } from 'helpers/app-error';
import { arweaveGraphqlEndpoint } from 'helpers/config';
import { useMessages } from 'providers/LanguageProvider';

import { HOME_MESSAGES } from '../messages';
import {
	HOME_ACTIVITY_REVEAL_STEP,
	homeActivityLoadedAnnouncement,
	type HomeActivityRequestKind,
	homeActivityScope,
	INITIAL_HOME_ACTIVITY_REQUEST,
	nextHomeActivityRequest,
} from '../model/home-activity';

export type HomeActivityFeed = {
	/** The exact marketplace membership this feed checks, as a stable JSON array of process IDs. */
	scope: string;
	graphql: string;
	filter: GlobalActivityFilter;
	/** Every loaded event for the active filter, newest first. */
	events: CollectionActivityEvent[];
	/** The loaded events the active filter matches. */
	filteredEvents: CollectionActivityEvent[];
	/** How many matching rows are revealed; the rest need another reveal. */
	limit: number;
	hasNextPage: boolean;
	loading: boolean;
	error: AppError | undefined;
	announcement: string;
	setFilter(filter: GlobalActivityFilter): void;
	requestPage(kind: HomeActivityRequestKind): void;
	revealMore(): void;
};

/**
 * The global activity feed, one bounded native GraphQL page per request. Each filter keeps its own cursor, so
 * switching filters never rereads another filter's history, and a failed request keeps the last good page and retries
 * its exact cursor.
 */
export function useHomeActivity(collections: Collection[], marketLoading: boolean): HomeActivityFeed {
	const messages = useMessages(HOME_MESSAGES);
	const activityMessages = useMessages(ACTIVITY_MESSAGES);
	const [filter, setFilter] = React.useState<GlobalActivityFilter>('all');
	const [limit, setLimit] = React.useState(HOME_ACTIVITY_REVEAL_STEP);
	const [request, setRequest] = React.useState(INITIAL_HOME_ACTIVITY_REQUEST);
	const [events, setEvents] = React.useState<CollectionActivityEvent[]>([]);
	const [hasNextPage, setHasNextPage] = React.useState(true);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<AppError | undefined>(undefined);
	const [announcement, setAnnouncement] = React.useState('');
	const scope = React.useMemo(() => homeActivityScope(collections), [collections]);
	const graphql = arweaveGraphqlEndpoint();
	const recipientCount = React.useMemo(() => (JSON.parse(scope) as string[]).length, [scope]);
	const pager = React.useMemo(() => {
		const recipients = new Set<string>(JSON.parse(scope) as string[]);
		return createGlobalActivityPager({ graphql, acceptProcessId: (id) => recipients.has(id) });
	}, [graphql, scope]);

	React.useEffect(() => {
		setLimit(HOME_ACTIVITY_REVEAL_STEP);
		setAnnouncement('');
	}, [filter, pager]);

	React.useEffect(() => {
		const controller = new AbortController();
		const cached = pager.get(filter);
		setEvents(cached.events);
		setHasNextPage(cached.hasNextPage);
		setError(undefined);
		setLoading(true);
		if (marketLoading) return () => controller.abort();
		if (!recipientCount) {
			setLoading(false);
			setHasNextPage(false);
			return () => controller.abort();
		}
		void (async () => {
			let current = cached;
			try {
				if (!cached.loaded || request.kind !== 'initial') {
					current = await pager.load(filter, { signal: controller.signal });
				}
				if (controller.signal.aborted) return;
				setEvents(current.events);
				setHasNextPage(current.hasNextPage);
				if (request.kind === 'more') setLimit((revealed) => revealed + HOME_ACTIVITY_REVEAL_STEP);
				setAnnouncement(homeActivityLoadedAnnouncement(current.events.length, messages));
			} catch (cause) {
				if (controller.signal.aborted) return;
				setError(toAppError(cause, 'index-unavailable'));
				setLoading(false);
				return;
			}
			setLoading(false);
		})();
		return () => controller.abort();
	}, [filter, marketLoading, messages, pager, recipientCount, request]);

	const filteredEvents = filterGlobalActivity(events, filter);

	function requestPage(kind: HomeActivityRequestKind) {
		if (loading) return;
		setRequest((current) => nextHomeActivityRequest(current, kind));
	}

	function handleFilterChange(next: GlobalActivityFilter) {
		setFilter(next);
		setRequest((current) => nextHomeActivityRequest(current, 'initial'));
	}

	function revealMore() {
		const nextLimit = Math.min(filteredEvents.length, limit + HOME_ACTIVITY_REVEAL_STEP);
		setLimit(nextLimit);
		setAnnouncement(
			globalActivityRevealDescription(
				nextLimit,
				filteredEvents.length,
				events.length,
				filter !== 'all',
				activityMessages
			)
		);
	}

	return {
		scope,
		graphql,
		filter,
		events,
		filteredEvents,
		limit,
		hasNextPage,
		loading,
		error,
		announcement,
		setFilter: handleFilterChange,
		requestPage,
		revealMore,
	};
}
