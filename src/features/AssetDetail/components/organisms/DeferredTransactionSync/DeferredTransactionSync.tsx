import React from 'react';

import { Loading } from 'components/atoms/Loading';
import { LazyArweaveTransactionSync } from 'features/TransactionSync';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';

export default function DeferredTransactionSync(props: React.ComponentProps<typeof LazyArweaveTransactionSync>) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	return (
		<React.Suspense fallback={<Loading label={messages.progressLoadingSync} />}>
			<LazyArweaveTransactionSync {...props} />
		</React.Suspense>
	);
}
