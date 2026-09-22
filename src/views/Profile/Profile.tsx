import React from 'react';
import { useParams } from 'react-router-dom';

import { Loading } from 'components/atoms/Loading';

const AccountProfile = React.lazy(() =>
	import('features/Profile').then((module) => ({ default: module.AccountProfile }))
);

export default function Profile() {
	const params = useParams();
	return (
		<React.Suspense fallback={<Loading label="Loading profile…" />}>
			<AccountProfile address={params.address ?? ''} />
		</React.Suspense>
	);
}
