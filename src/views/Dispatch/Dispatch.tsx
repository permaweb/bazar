import React from 'react';

import { Loading } from 'components/atoms/Loading';

const HolderDispatch = React.lazy(() =>
	import('features/Dispatch').then((module) => ({ default: module.HolderDispatch }))
);

export default function Dispatch() {
	return (
		<React.Suspense fallback={<Loading label="Loading dispatch…" />}>
			<HolderDispatch />
		</React.Suspense>
	);
}
