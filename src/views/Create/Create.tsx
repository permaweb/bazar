import React from 'react';

import { Loading } from 'components/atoms/Loading';
import { useMessages } from 'providers/LanguageProvider';

import { CREATE_VIEW_MESSAGES } from './messages';

const AssetCreator = React.lazy(() => import('features/Create').then((module) => ({ default: module.AssetCreator })));

export default function Create() {
	const messages = useMessages(CREATE_VIEW_MESSAGES);

	return (
		<React.Suspense fallback={<Loading label={messages.createViewLoading} />}>
			<AssetCreator />
		</React.Suspense>
	);
}
