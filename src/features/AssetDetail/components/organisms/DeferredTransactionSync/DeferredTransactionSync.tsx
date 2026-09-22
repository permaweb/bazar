import React from 'react';

import { Loading } from 'components/atoms/Loading';
import { LazyArweaveTransactionSync } from 'features/TransactionSync';

export default function DeferredTransactionSync(props: React.ComponentProps<typeof LazyArweaveTransactionSync>) {
	return (
		<React.Suspense fallback={<Loading label="Loading transaction progress…" />}>
			<LazyArweaveTransactionSync {...props} />
		</React.Suspense>
	);
}
