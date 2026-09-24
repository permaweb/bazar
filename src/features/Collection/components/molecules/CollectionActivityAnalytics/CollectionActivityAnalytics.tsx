import { History } from 'lucide-react';

import { useMessages } from 'providers/LanguageProvider';

import { COLLECTION_MESSAGES } from '../../../messages';
import * as Analytics from '../../../styles/analytics';

import * as S from './styles';

export default function CollectionActivityAnalytics(props: {
	error: boolean;
	events: number;
	loading: boolean;
	pages: number;
}) {
	const language = useMessages(COLLECTION_MESSAGES);
	return (
		<Analytics.Panel
			className="collection-analytics collection-activity-analytics"
			aria-label={language.activityAnalyticsLabel}
		>
			<Analytics.Heading className="collection-analytics-heading">
				<div>
					<span>{language.analyticsEyebrow}</span>
					<h2>{language.analyticsHeading}</h2>
				</div>
				<History aria-hidden="true" />
			</Analytics.Heading>
			<Analytics.Tabs className="collection-analytics-tabs">
				<span>{language.analyticsActivityTab}</span>
			</Analytics.Tabs>
			<S.Summary className="collection-activity-summary">
				<div>
					<span>{language.analyticsIndexedEvents}</span>
					<strong>{props.events.toLocaleString()}</strong>
				</div>
				<div>
					<span>{language.analyticsBatchesChecked}</span>
					<strong>{props.pages.toLocaleString()}</strong>
				</div>
				<div>
					<span>{language.analyticsSource}</span>
					<strong>{language.analyticsSourceArweaveIndex}</strong>
				</div>
				<div>
					<span>{language.analyticsStatus}</span>
					<strong>
						{props.error
							? language.activityStatusNeedsRetry
							: props.loading
							? language.activityStatusRefreshing
							: language.activityStatusCurrent}
					</strong>
				</div>
			</S.Summary>
		</Analytics.Panel>
	);
}
