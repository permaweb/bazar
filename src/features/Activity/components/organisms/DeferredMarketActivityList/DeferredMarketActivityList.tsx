import React from 'react';

import { Loading } from 'components/atoms/Loading';
import { useMessages } from 'providers/LanguageProvider';

import { ACTIVITY_MESSAGES } from '../../../messages';

const LazyMarketActivityList = React.lazy(async () => {
	const module = await import('../MarketActivityList');
	return { default: module.MarketActivityList };
});

export default function DeferredMarketActivityList(props: React.ComponentProps<typeof LazyMarketActivityList>) {
	const messages = useMessages(ACTIVITY_MESSAGES);
	return (
		<React.Suspense fallback={<Loading label={messages.activityLoading} />}>
			<LazyMarketActivityList {...props} />
		</React.Suspense>
	);
}
