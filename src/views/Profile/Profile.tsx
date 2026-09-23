import React from 'react';
import { useParams } from 'react-router-dom';

import { Loading } from 'components/atoms/Loading';
import { useMessages } from 'providers/LanguageProvider';

import { PROFILE_VIEW_MESSAGES } from './messages';

const AccountProfile = React.lazy(() =>
	import('features/Profile').then((module) => ({ default: module.AccountProfile }))
);

export default function Profile() {
	const params = useParams();
	const messages = useMessages(PROFILE_VIEW_MESSAGES);

	return (
		<React.Suspense fallback={<Loading label={messages.profileViewLoading} />}>
			<AccountProfile address={params.address ?? ''} />
		</React.Suspense>
	);
}
