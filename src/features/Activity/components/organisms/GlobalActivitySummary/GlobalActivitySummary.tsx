import { Button } from 'components/atoms/Button';
import { asyncData, isAsyncPending } from 'helpers/async-state';

import { useGlobalActivityStats } from '../../../hooks/useGlobalActivityStats';
import { GlobalActivityCharts } from '../GlobalActivityCharts';

/** The summary owns its requests and loading state; row filters never reset it. */
export default function GlobalActivitySummary(props: {
	/** The exact marketplace membership this summary covers, as a stable JSON array of process IDs. */
	recipientScope: string;
	graphql: string;
	marketLoading: boolean;
	feedLoading: boolean;
}) {
	const stats = useGlobalActivityStats({
		recipientScope: props.recipientScope,
		graphql: props.graphql,
		marketLoading: props.marketLoading,
		feedLoading: props.feedLoading,
	});
	const loading = isAsyncPending(stats.state);
	const unavailable = stats.state.status === 'error';

	return (
		<div className="global-activity-summary" aria-busy={loading}>
			<GlobalActivityCharts stats={asyncData(stats.state)} loading={loading} unavailable={unavailable} />
			{unavailable ? (
				<div className="collection-source-notice retry-notice">
					<span role="status">Global stats could not finish loading. Activity below is still available.</span>
					<Button size="small" onClick={stats.retry}>
						Retry stats
					</Button>
				</div>
			) : null}
		</div>
	);
}
