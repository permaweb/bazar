import { History } from 'lucide-react';

export default function CollectionActivityAnalytics(props: {
	error: boolean;
	events: number;
	loading: boolean;
	pages: number;
}) {
	return (
		<aside className="collection-analytics collection-activity-analytics" aria-label="Activity analytics">
			<div className="collection-analytics-heading">
				<div>
					<span>Market</span>
					<h2>Analytics</h2>
				</div>
				<History aria-hidden="true" />
			</div>
			<div className="collection-analytics-tabs">
				<span>Activity</span>
			</div>
			<div className="collection-activity-summary">
				<div>
					<span>Indexed events</span>
					<strong>{props.events.toLocaleString()}</strong>
				</div>
				<div>
					<span>Batches checked</span>
					<strong>{props.pages.toLocaleString()}</strong>
				</div>
				<div>
					<span>Source</span>
					<strong>Arweave index</strong>
				</div>
				<div>
					<span>Status</span>
					<strong>{props.error ? 'Needs retry' : props.loading ? 'Refreshing' : 'Current'}</strong>
				</div>
			</div>
		</aside>
	);
}
