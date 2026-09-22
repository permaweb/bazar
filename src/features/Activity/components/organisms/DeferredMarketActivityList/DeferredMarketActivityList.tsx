import React from 'react';

import { Loading } from 'components/atoms/Loading';

const LazyMarketActivityList = React.lazy(async () => {
	const module = await import('../MarketActivityList');
	return { default: module.MarketActivityList };
});

export default function DeferredMarketActivityList(props: React.ComponentProps<typeof LazyMarketActivityList>) {
	return (
		<React.Suspense fallback={<Loading label="Loading activity…" />}>
			<LazyMarketActivityList {...props} />
		</React.Suspense>
	);
}
