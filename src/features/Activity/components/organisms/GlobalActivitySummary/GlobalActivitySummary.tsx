import { Button } from 'components/atoms/Button';
import { asyncData, isAsyncPending } from 'helpers/async-state';
import { useMessages } from 'providers/LanguageProvider';

import { useGlobalActivityStats } from '../../../hooks/useGlobalActivityStats';
import { ACTIVITY_MESSAGES } from '../../../messages';
import { GlobalActivityCharts } from '../GlobalActivityCharts';

/** The summary owns its requests and loading state; row filters never reset it. */
export default function GlobalActivitySummary(props: {
	/** The exact marketplace membership this summary covers, as a stable JSON array of process IDs. */
	recipientScope: string;
	graphql: string;
	marketLoading: boolean;
	feedLoading: boolean;
}) {
	const messages = useMessages(ACTIVITY_MESSAGES);
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
					<span role="status">{messages.globalStatsUnavailable}</span>
					<Button size="small" onClick={stats.retry}>
						{messages.globalStatsRetry}
					</Button>
				</div>
			) : null}
		</div>
	);
}
