import React from 'react';

import { Button } from 'components/Button';
import { GlobalActivityCharts } from 'components/GlobalActivityCharts';

import {
	createGlobalActivityStatsScan,
	type GlobalActivityStatsSnapshot,
	loadGlobalActivityStats,
	saveGlobalActivityStats,
} from '../app/global-activity-stats';

/** The summary owns its requests and loading state; row filters never reset it. */
export function GlobalActivitySummary({
	recipientScope,
	graphql,
	marketLoading,
	feedLoading,
}: {
	recipientScope: string;
	graphql: string;
	marketLoading: boolean;
	feedLoading: boolean;
}) {
	const [snapshot, setSnapshot] = React.useState<GlobalActivityStatsSnapshot | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState(false);
	const [retry, setRetry] = React.useState(0);
	const feedBusy = React.useRef(feedLoading);
	feedBusy.current = feedLoading;
	const scope = `${graphql}|${recipientScope}`;
	const scan = React.useMemo(
		() => createGlobalActivityStatsScan(JSON.parse(recipientScope), { graphql }),
		[recipientScope, graphql]
	);

	React.useEffect(() => {
		const controller = new AbortController();
		setError(false);
		setLoading(true);
		setSnapshot(null);
		if (marketLoading) return () => controller.abort();
		if (!retry) {
			let cached: GlobalActivityStatsSnapshot | null = null;
			try {
				cached = loadGlobalActivityStats(window.localStorage, scope);
			} catch {
				/* Storage is optional. */
			}
			if (cached) {
				setSnapshot(cached);
				setLoading(false);
				return () => controller.abort();
			}
		}
		const beforePage = async () => {
			// Yield between requests, and give foreground page requests first use of the connection.
			do {
				await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
				controller.signal.throwIfAborted();
			} while (feedBusy.current);
		};
		void scan
			.run(controller.signal, beforePage)
			.then((stats) => {
				if (controller.signal.aborted) return;
				const next = { scope, savedAt: Date.now(), stats };
				setSnapshot(next);
				setLoading(false);
				try {
					saveGlobalActivityStats(window.localStorage, next);
				} catch {
					/* Storage is optional. */
				}
			})
			.catch(() => {
				if (controller.signal.aborted) return;
				setError(true);
				setLoading(false);
			});
		return () => controller.abort();
	}, [marketLoading, retry, scan, scope]);

	return (
		<div className="global-activity-summary" aria-busy={loading}>
			<GlobalActivityCharts stats={snapshot?.stats} loading={loading} unavailable={error} />
			{error ? (
				<div className="collection-source-notice retry-notice">
					<span role="status">Global stats could not finish loading. Activity below is still available.</span>
					<Button size="small" onClick={() => setRetry((value) => value + 1)}>
						Retry stats
					</Button>
				</div>
			) : null}
		</div>
	);
}
