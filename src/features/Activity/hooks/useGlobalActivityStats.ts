import React from 'react';

import { toAppError } from 'helpers/app-error';
import { type AsyncState, LOADING } from 'helpers/async-state';

import type { GlobalActivityChartStats } from '../model/activity-chart';
import {
	createGlobalActivityStatsScan,
	loadGlobalActivityStats,
	saveGlobalActivityStats,
} from '../model/global-activity-stats';

const BACKGROUND_PAGE_INTERVAL_MS = 100;

/**
 * The independent global summary: one background scan of the complete indexed history for the loaded marketplace
 * recipients. It owns its own requests, yields between pages while the row feed is loading, and reuses a completed
 * summary cached for this gateway and exact asset membership.
 */
export function useGlobalActivityStats(input: {
	/** The exact marketplace membership this summary covers, as a stable JSON array of process IDs. */
	recipientScope: string;
	graphql: string;
	marketLoading: boolean;
	feedLoading: boolean;
}): { state: AsyncState<GlobalActivityChartStats>; retry(): void } {
	const [state, setState] = React.useState<AsyncState<GlobalActivityChartStats>>(LOADING);
	const [attempt, setAttempt] = React.useState(0);
	const feedBusy = React.useRef(input.feedLoading);
	feedBusy.current = input.feedLoading;
	const scope = `${input.graphql}|${input.recipientScope}`;
	const recipientScope = input.recipientScope;
	const graphql = input.graphql;
	const scan = React.useMemo(
		() => createGlobalActivityStatsScan(JSON.parse(recipientScope) as string[], { graphql }),
		[graphql, recipientScope]
	);

	React.useEffect(() => {
		const controller = new AbortController();
		setState(LOADING);
		if (input.marketLoading) return () => controller.abort();
		if (!attempt) {
			let cached = null;
			try {
				cached = loadGlobalActivityStats(window.localStorage, scope);
			} catch {
				// Browser storage is optional; the background scan below rebuilds the summary.
			}
			if (cached) {
				setState({ status: 'success', data: cached.stats });
				return () => controller.abort();
			}
		}
		const beforePage = async () => {
			// Yield between requests, and give foreground page requests first use of the connection.
			do {
				await new Promise<void>((resolve) => window.setTimeout(resolve, BACKGROUND_PAGE_INTERVAL_MS));
				controller.signal.throwIfAborted();
			} while (feedBusy.current);
		};
		void scan.run(controller.signal, beforePage).then(
			(stats) => {
				if (controller.signal.aborted) return;
				setState({ status: 'success', data: stats });
				try {
					saveGlobalActivityStats(window.localStorage, { scope, savedAt: Date.now(), stats });
				} catch {
					// The summary stays on screen when storage is unavailable.
				}
			},
			(cause) => {
				if (controller.signal.aborted) return;
				setState({ status: 'error', error: toAppError(cause, 'index-unavailable') });
			}
		);
		return () => controller.abort();
	}, [attempt, input.marketLoading, scan, scope]);

	function retry() {
		setAttempt((current) => current + 1);
	}

	return { state, retry };
}
