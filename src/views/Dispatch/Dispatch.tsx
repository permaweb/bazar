import React from 'react';

import { Loading } from 'components/atoms/Loading';
import { useMessages } from 'providers/LanguageProvider';

import { DISPATCH_VIEW_MESSAGES } from './messages';

const HolderDispatch = React.lazy(() =>
	import('features/Dispatch').then((module) => ({ default: module.HolderDispatch }))
);

export default function Dispatch() {
	const messages = useMessages(DISPATCH_VIEW_MESSAGES);

	return (
		<React.Suspense fallback={<Loading label={messages.dispatchViewLoading} />}>
			<HolderDispatch />
		</React.Suspense>
	);
}
